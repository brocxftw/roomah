"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  Copy,
  Eye,
  ExternalLink,
  Megaphone,
  Minus,
  PauseCircle,
  Pencil,
  RefreshCcw,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  campaign_start_date: string;
  campaign_end_date?: string | null;
  ad_spending: string | number;
  budget?: string | number | null;
  impressions?: number | null;
  clicks?: number | null;
  leads_generated: number;
  conversions: number;
  cost_per_lead?: string | number | null;
  conversion_rate?: string | number | null;
  external_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CampaignDetail = Campaign & {
  attributed_leads: AttributedLead[];
};

type AttributedLead = {
  id: string;
  name: string;
  status: string;
  ren?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

const CAMPAIGN_STATUSES = ["Draft", "Active", "Paused", "Completed"];
const CAMPAIGN_CHANNELS = [
  "Facebook",
  "Instagram",
  "Google",
  "TikTok",
  "Email",
  "Referral",
  "Walk_In",
  "Other",
];
const DRAWER_TABS = ["overview", "performance", "leads", "timeline"] as const;
type DrawerTab = (typeof DRAWER_TABS)[number];

const DATE_RANGE_OPTIONS = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
] as const;
type DateRangeValue = (typeof DATE_RANGE_OPTIONS)[number]["value"];

const PAGE_SIZE = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type KpiCardData = {
  id: string;
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  iconClass: string;
};

function asNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value?: string | number | null) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(asNumber(value));
}

function formatNumber(value?: string | number | null) {
  return new Intl.NumberFormat("en-MY").format(asNumber(value));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPercent(value?: string | number | null) {
  const numeric = asNumber(value);
  if (numeric <= 1 && numeric > 0) return `${Math.round(numeric * 100)}%`;
  return `${Math.round(numeric)}%`;
}

function dateRangeStart(value: DateRangeValue): Date | null {
  const now = new Date();
  if (value === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (value === "week") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  }
  if (value === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (value === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterStartMonth, 1);
  }
  return null;
}

function campaignPeriod(campaign: Campaign) {
  return `${formatDate(campaign.campaign_start_date)} - ${
    campaign.campaign_end_date ? formatDate(campaign.campaign_end_date) : "Ongoing"
  }`;
}

function derivedCostPerLead(campaign: Campaign) {
  if (campaign.cost_per_lead !== null && campaign.cost_per_lead !== undefined) {
    return asNumber(campaign.cost_per_lead);
  }
  if (!campaign.leads_generated) return 0;
  return asNumber(campaign.ad_spending) / campaign.leads_generated;
}

function derivedConversionRate(campaign: Campaign) {
  if (campaign.conversion_rate !== null && campaign.conversion_rate !== undefined) {
    return asNumber(campaign.conversion_rate);
  }
  if (!campaign.leads_generated) return 0;
  return (campaign.conversions / campaign.leads_generated) * 100;
}

function costPerConversion(campaign: Campaign) {
  if (!campaign.conversions) return 0;
  return asNumber(campaign.ad_spending) / campaign.conversions;
}

function channelInitial(channel: string) {
  if (channel === "Walk_In") return "WI";
  return channel.slice(0, 2).toUpperCase();
}

function statusBadgeClass(status: string) {
  if (status === "Active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Paused") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "Completed") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function parseExternalPlatform(url?: string | null, channel?: string) {
  if (!url) return null;
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = "";
  }
  const platform = host.includes("facebook") || host === "fb.watch"
    ? "Facebook"
    : host.includes("instagram")
      ? "Instagram"
      : host.includes("tiktok")
        ? "TikTok"
        : host.includes("threads")
          ? "Threads"
          : host.includes("google")
            ? "Google"
            : channel && ["Facebook", "Instagram", "TikTok", "Google"].includes(channel)
              ? channel
              : null;
  return {
    url,
    label: platform ? `View on ${platform}` : "View campaign",
  };
}

function computeCampaignKpis(campaigns: Campaign[]): KpiCardData[] {
  const totalSpend = campaigns.reduce(
    (sum, campaign) => sum + asNumber(campaign.ad_spending),
    0
  );
  const totalLeads = campaigns.reduce(
    (sum, campaign) => sum + campaign.leads_generated,
    0
  );
  const totalConversions = campaigns.reduce(
    (sum, campaign) => sum + campaign.conversions,
    0
  );
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "Active"
  ).length;
  const averageCostPerLead = totalLeads ? totalSpend / totalLeads : 0;
  const conversionRate = totalLeads ? (totalConversions / totalLeads) * 100 : 0;
  return [
    {
      id: "active",
      label: "Active Campaigns",
      value: String(activeCampaigns),
      helper: "Currently running",
      icon: Megaphone,
      iconClass: "bg-emerald-50 text-emerald-600",
    },
    {
      id: "spend",
      label: "Total Spend",
      value: formatCurrency(totalSpend),
      helper: "Across visible campaigns",
      icon: CircleDollarSign,
      iconClass: "bg-slate-100 text-slate-700",
    },
    {
      id: "leads",
      label: "Leads Generated",
      value: formatNumber(totalLeads),
      helper: "Attributed leads",
      icon: Users,
      iconClass: "bg-blue-50 text-blue-600",
    },
    {
      id: "conversions",
      label: "Conversions",
      value: formatNumber(totalConversions),
      helper: "Closed outcomes",
      icon: Target,
      iconClass: "bg-purple-50 text-purple-600",
    },
    {
      id: "cpl",
      label: "Avg Cost / Lead",
      value: formatCurrency(averageCostPerLead),
      helper: "Portfolio efficiency",
      icon: BarChart3,
      iconClass: "bg-amber-50 text-amber-600",
    },
    {
      id: "rate",
      label: "Conversion Rate",
      value: formatPercent(conversionRate),
      helper: "Conversions / leads",
      icon: RefreshCcw,
      iconClass: "bg-cyan-50 text-cyan-600",
    },
  ];
}

function syntheticTimeline(campaign: CampaignDetail) {
  const events = [
    {
      id: "created",
      title: "Campaign created",
      detail: `${campaign.channel} campaign added to ROOMAH.`,
      date: campaign.created_at ?? campaign.campaign_start_date,
    },
    {
      id: "status",
      title: `Status is ${campaign.status}`,
      detail: "Current operational status from campaign record.",
      date: campaign.updated_at ?? campaign.created_at ?? campaign.campaign_start_date,
    },
  ];
  if (campaign.attributed_leads.length) {
    events.push({
      id: "leads",
      title: `${campaign.attributed_leads.length} attributed leads`,
      detail: "Leads are currently tied to this campaign.",
      date: campaign.updated_at ?? campaign.created_at ?? campaign.campaign_start_date,
    });
  }
  if (campaign.conversions) {
    events.push({
      id: "conversions",
      title: `${campaign.conversions} conversions recorded`,
      detail: "Conversions are derived from campaign lead outcomes.",
      date: campaign.updated_at ?? campaign.created_at ?? campaign.campaign_start_date,
    });
  }
  return events;
}

export default function CampaignsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(
    null
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>("");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const selectedCampaignId = searchParams.get("campaign");
  const dateRangeStartDate = useMemo(
    () => dateRangeStart(dateRange),
    [dateRange]
  );
  const visibleCampaigns = useMemo(() => {
    if (!dateRangeStartDate) return campaigns;
    return campaigns.filter((campaign) => {
      const date = campaign.created_at ?? campaign.campaign_start_date;
      return new Date(date).getTime() >= dateRangeStartDate.getTime();
    });
  }, [campaigns, dateRangeStartDate]);
  const totalPages = showAll
    ? 1
    : Math.max(1, Math.ceil(visibleCampaigns.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedCampaigns = showAll
    ? visibleCampaigns
    : visibleCampaigns.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const kpiCards = useMemo(
    () => computeCampaignKpis(visibleCampaigns),
    [visibleCampaigns]
  );

  useEffect(() => {
    async function loadCampaigns() {
      const token = await getToken();
      const params = new URLSearchParams({
        include_completed: "true",
        include_draft: "true",
      });
      if (query) params.set("q", query);
      if (status) params.set("status_filter", status);
      if (channel) params.set("channel", channel);
      const data = await apiFetch<Campaign[]>(
        `/campaigns?${params.toString()}`,
        token
      );
      setCampaigns(data);
      setError(null);
    }

    void loadCampaigns().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    });
  }, [getToken, query, status, channel]);

  async function loadSelectedCampaign(campaignId: string) {
    setLoadingDetail(true);
    const token = await getToken();
    try {
      const data = await apiFetch<CampaignDetail>(`/campaigns/${campaignId}`, token);
      setSelectedCampaign(data);
      setError(null);
    } catch (err) {
      setSelectedCampaign(null);
      setError(err instanceof Error ? err.message : "Failed to load campaign");
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && DRAWER_TABS.includes(tab as DrawerTab)) {
      setDrawerTab(tab as DrawerTab);
    }
    if (!selectedCampaignId) {
      setSelectedCampaign(null);
      return;
    }
    if (!UUID_PATTERN.test(selectedCampaignId)) {
      router.replace("/app/campaigns");
      setSelectedCampaign(null);
      return;
    }
    void loadSelectedCampaign(selectedCampaignId);
    // loadSelectedCampaign depends on stable auth and selected route state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId, searchParams, getToken]);

  useEffect(() => {
    setPage(1);
    setShowAll(false);
    updateSelection(null);
    // updateSelection intentionally omitted; filters reset selected route state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, channel, dateRange]);

  useEffect(() => {
    if (!selectedCampaignId) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (drawerRef.current?.contains(target)) return;
      if (target.closest("[data-campaign-row=\"true\"]")) return;
      updateSelection(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
    // updateSelection is stable enough for this listener; selectedCampaignId guards lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId]);

  function updateSelection(campaignId: string | null, tab = drawerTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (!campaignId) {
      params.delete("campaign");
      params.delete("tab");
    } else {
      params.set("campaign", campaignId);
      params.set("tab", tab);
    }
    router.replace(`/app/campaigns${params.size ? `?${params.toString()}` : ""}`);
  }

  function updateDrawerTab(tab: DrawerTab) {
    setDrawerTab(tab);
    if (selectedCampaignId) updateSelection(selectedCampaignId, tab);
  }

  function resetFilters() {
    setQuery("");
    setStatus("");
    setChannel("");
    setDateRange("");
    setPage(1);
    setShowAll(false);
    router.replace("/app/campaigns");
  }

  async function pauseCampaign() {
    if (!selectedCampaign) return;
    const token = await getToken();
    const updated = await apiFetch<CampaignDetail>(
      `/campaigns/${selectedCampaign.id}`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "Paused" }),
      }
    );
    setSelectedCampaign({ ...selectedCampaign, ...updated });
    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === selectedCampaign.id ? { ...campaign, ...updated } : campaign
      )
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-6 md:grid-cols-3">
        {kpiCards.map((card) => (
          <KpiCard key={card.id} card={card} />
        ))}
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaign name"
            className="min-h-11 min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {CAMPAIGN_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All channels</option>
            {CAMPAIGN_CHANNELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(event) =>
              setDateRange(event.target.value as DateRangeValue)
            }
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            {DATE_RANGE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr_1fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-4 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Campaign</span>
          <span>Channel</span>
          <span>Status</span>
          <span>Period</span>
          <span>Spend</span>
          <span>Leads</span>
          <span>Cost / Lead</span>
          <span>Link</span>
        </div>
        {paginatedCampaigns.map((campaign) => {
          const selected = selectedCampaignId === campaign.id;
          const external = parseExternalPlatform(campaign.external_url, campaign.channel);
          return (
            <button
              key={campaign.id}
              type="button"
              data-campaign-row="true"
              onClick={() => updateSelection(campaign.id)}
              className={[
                "grid w-full grid-cols-[1.6fr_0.8fr_0.8fr_1fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-4 border-b px-4 py-4 text-left text-sm transition last:border-b-0 hover:bg-slate-50",
                selected ? "bg-blue-50/60 ring-1 ring-inset ring-blue-200" : "",
              ].join(" ")}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {channelInitial(campaign.channel)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">
                    {campaign.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    Updated {formatDate(campaign.updated_at)}
                  </span>
                </span>
              </span>
              <span className="truncate text-slate-700">{campaign.channel}</span>
              <span>
                <span
                  className={[
                    "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                    statusBadgeClass(campaign.status),
                  ].join(" ")}
                >
                  {campaign.status}
                </span>
              </span>
              <span className="text-slate-600">{campaignPeriod(campaign)}</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(campaign.ad_spending)}
              </span>
              <span className="text-slate-700">
                {campaign.leads_generated} / {campaign.conversions}
              </span>
              <span className="text-slate-700">
                {formatCurrency(derivedCostPerLead(campaign))}
              </span>
              <span>
                {external ? (
                  <a
                    href={external.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Open
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">-</span>
                )}
              </span>
            </button>
          );
        })}
        {!visibleCampaigns.length ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-900">No campaigns found.</p>
            <p className="mt-1 text-sm text-slate-500">
              Start from scratch or browse reusable campaign content templates.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/app/campaigns/templates"
                className="rounded-lg border px-3 py-2 text-sm font-medium"
              >
                Browse templates
              </Link>
              <Link
                href="/app/campaigns/new"
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              >
                Create campaign
              </Link>
            </div>
          </div>
        ) : null}
        {visibleCampaigns.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span>
              Showing {showAll ? visibleCampaigns.length : paginatedCampaigns.length} of {visibleCampaigns.length} campaigns
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium"
              >
                {showAll ? "Paginate" : "Show all"}
              </button>
              {!showAll ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={safePage <= 1}
                    className="rounded-lg border px-2 py-1.5 text-xs disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="px-2 text-xs">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    disabled={safePage >= totalPages}
                    className="rounded-lg border px-2 py-1.5 text-xs disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {selectedCampaignId ? (
        <CampaignDrawer
          containerRef={drawerRef}
          campaign={selectedCampaign}
          loading={loadingDetail}
          tab={drawerTab}
          onTabChange={updateDrawerTab}
          onClose={() => updateSelection(null)}
          onPause={() => void pauseCampaign()}
        />
      ) : null}
    </div>
  );
}

function KpiCard({ card }: { card: KpiCardData }) {
  const Icon = card.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${card.iconClass}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-500">{card.label}</p>
        <p className="mt-1 truncate text-2xl font-semibold text-slate-900">
          {card.value}
        </p>
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400">
          <Minus className="h-3.5 w-3.5" aria-hidden />
          <span>{card.helper}</span>
        </div>
      </div>
    </div>
  );
}

function CampaignDrawer({
  containerRef,
  campaign,
  loading,
  tab,
  onTabChange,
  onClose,
  onPause,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  campaign: CampaignDetail | null;
  loading: boolean;
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  onPause: () => void;
}) {
  const external = parseExternalPlatform(campaign?.external_url, campaign?.channel);
  return (
    <aside
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-3xl border bg-white shadow-2xl xl:inset-x-auto xl:right-0 xl:top-0 xl:h-screen xl:max-h-none xl:w-[380px] xl:rounded-none"
    >
      {!campaign ? (
        <div className="flex min-h-96 items-center justify-center p-6 text-center text-sm text-slate-500">
          {loading
            ? "Loading campaign..."
            : "Select a campaign to review performance, leads, timeline, and actions."}
        </div>
      ) : (
        <div className="flex min-h-full flex-col">
          <div className="border-b p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {channelInitial(campaign.channel)}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                  <p className="text-sm text-slate-500">{campaign.channel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                  statusBadgeClass(campaign.status),
                ].join(" ")}
              >
                {campaign.status}
              </span>
              <span className="text-xs text-slate-500">
                {campaignPeriod(campaign)}
              </span>
            </div>
          </div>

          <div className="border-b px-5">
            <div className="flex gap-5">
              {DRAWER_TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onTabChange(item)}
                  className={[
                    "border-b-2 py-3 text-sm font-medium capitalize",
                    tab === item
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500",
                  ].join(" ")}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-4 p-5">
            {loading ? <p className="text-sm text-slate-500">Loading campaign...</p> : null}
            {tab === "overview" ? (
              <div className="space-y-4">
                <InfoCard title="Campaign Context">
                  <dl className="space-y-2 text-sm">
                    <InfoRow label="Channel" value={campaign.channel} />
                    <InfoRow label="Period" value={campaignPeriod(campaign)} />
                    <InfoRow label="Budget" value={formatCurrency(campaign.budget)} />
                    <InfoRow
                      label="Spend"
                      value={formatCurrency(campaign.ad_spending)}
                    />
                  </dl>
                </InfoCard>
                {external ? (
                  <a
                    href={external.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    {external.label}
                  </a>
                ) : null}
                <InfoCard title="Actionable Insight">
                  <p className="text-sm text-slate-600">
                    {campaign.leads_generated
                      ? `${formatCurrency(derivedCostPerLead(campaign))} per lead with ${formatPercent(derivedConversionRate(campaign))} conversion efficiency.`
                      : "No leads attributed yet. Check targeting, creative, and campaign launch status."}
                  </p>
                </InfoCard>
              </div>
            ) : null}

            {tab === "performance" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Spend"
                  value={formatCurrency(campaign.ad_spending)}
                  helper={`Budget ${formatCurrency(campaign.budget)}`}
                />
                <MetricCard
                  label="Lead Gen"
                  value={formatNumber(campaign.leads_generated)}
                  helper={`${formatCurrency(derivedCostPerLead(campaign))} / lead`}
                />
                <MetricCard
                  label="Conversion"
                  value={formatNumber(campaign.conversions)}
                  helper={`${formatPercent(derivedConversionRate(campaign))} rate`}
                />
                <MetricCard
                  label="Efficiency"
                  value={formatCurrency(costPerConversion(campaign))}
                  helper="Cost / conversion"
                />
              </div>
            ) : null}

            {tab === "leads" ? (
              <div className="space-y-4">
                <Link
                  href={`/app/leads?campaign=${campaign.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  <Users className="h-4 w-4" aria-hidden />
                  View leads workspace
                </Link>
                <InfoCard title="Attributed Leads">
                  <div className="space-y-2">
                    {campaign.attributed_leads.map((lead) => (
                      <div key={lead.id} className="rounded-lg border px-3 py-2">
                        <p className="text-sm font-medium text-slate-900">
                          {lead.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {lead.status}
                          {lead.ren?.full_name ? ` · ${lead.ren.full_name}` : ""}
                        </p>
                      </div>
                    ))}
                    {!campaign.attributed_leads.length ? (
                      <p className="text-sm text-slate-500">
                        No leads attributed to this campaign yet.
                      </p>
                    ) : null}
                  </div>
                </InfoCard>
              </div>
            ) : null}

            {tab === "timeline" ? (
              <div className="space-y-3">
                {syntheticTimeline(campaign).map((event) => (
                  <div key={event.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium text-slate-900">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{event.detail}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {formatDate(event.date)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-white p-4">
            <Link
              href={`/app/campaigns/new?edit=${campaign.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </Link>
            <Link
              href={`/app/leads?campaign=${campaign.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            >
              <Eye className="h-4 w-4" aria-hidden />
              View leads
            </Link>
            <button
              type="button"
              onClick={onPause}
              disabled={campaign.status === "Paused"}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              <PauseCircle className="h-4 w-4" aria-hidden />
              Pause
            </button>
            <Link
              href={`/app/campaigns/new?duplicate=${campaign.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            >
              <Copy className="h-4 w-4" aria-hidden />
              Duplicate
            </Link>
            {external ? (
              <a
                href={external.url}
                target="_blank"
                rel="noreferrer"
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden />
                {external.label}
              </a>
            ) : null}
          </div>
        </div>
      )}
    </aside>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border p-3">
      <h4 className="mb-3 text-sm font-semibold text-slate-900">{title}</h4>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
