"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { CampaignPicker } from "@/components/campaign-picker";
import { RecordPicker, type RecordPickerGroup } from "@/components/record-picker";
import {
  TimelineEventList,
  type TimelineEvent,
} from "@/components/timeline-event-list";
import { apiFetch } from "@/lib/api";
import { MALAYSIAN_STATES, propertyAddressSummary } from "@/lib/malaysia-areas";
import { useAuth } from "@/lib/use-auth";
import {
  isOverdueLead,
  isSupportedLeadStatusFilter,
} from "@/lib/workspace-filters";

type ListingType = "Sale" | "Rental" | "Both";

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  last_interaction_at?: string | null;
  preferred_location?: string | null;
  preferred_state?: string | null;
  preferred_city?: string | null;
  preferred_areas?: string[] | null;
  preferred_property_type?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  campaign_name?: string | null;
  campaign?: {
    id?: string;
    name: string;
    channel: string;
    status: string;
  } | null;
  ren?: {
    email: string;
    full_name: string;
  } | null;
};

type LeadDetail = Lead & {
  campaign_id?: string | null;
  linked_properties: LinkedProperty[];
  timeline: TimelineEvent[];
  upcoming_viewings?: ViewingSummary[];
};

type LinkedProperty = {
  status: string;
  properties: PropertyOption;
};

type PropertyOption = {
  id: string;
  name: string;
  type?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  listing_type: ListingType;
  status?: string | null;
  listing_price?: number | null;
  expected_rental?: number | null;
};

type ViewingSummary = {
  id: string;
  lead_id: string;
  property_id: string;
  scheduled_at: string;
  status: string;
};

type CurrentUser = {
  id: string;
  role?: string | null;
};

type TeamUser = {
  id: string;
  full_name: string;
  email: string;
};

const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
];

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

const DRAWER_TABS = ["details", "timeline", "properties"] as const;
type DrawerTab = (typeof DRAWER_TABS)[number];

function formatCurrency(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function statusBadgeClass(status: string) {
  if (status === "Won") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Lost") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "Negotiation" || status === "Proposal") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (status === "Qualified") return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function nextActionLabel(lead: Lead) {
  if (!isOverdueLead(lead)) return "On track";
  const last = lead.last_interaction_at
    ? new Date(lead.last_interaction_at)
    : new Date();
  const due = new Date(last);
  due.setDate(due.getDate() + 2);
  const days = Math.max(
    0,
    Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24))
  );
  return days > 0 ? `Overdue ${days}d` : "Due today";
}

function propertyDescription(property: PropertyOption) {
  return [property.type, propertyAddressSummary(property), property.status]
    .filter(Boolean)
    .join(" · ");
}

export default function LeadsPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [preferredState, setPreferredState] = useState("");
  const [preferredCity, setPreferredCity] = useState("");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("details");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [manualEventType, setManualEventType] = useState("manual_call");
  const [manualNote, setManualNote] = useState("");
  const [closeDealOpen, setCloseDealOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusFilter = searchParams.get("status");
  const selectedLeadId = searchParams.get("lead");
  const isOverdueFilterActive = isSupportedLeadStatusFilter(statusFilter);
  const canFilterOwner = currentUser?.role === "MANAGER";
  const visibleLeads = isOverdueFilterActive
    ? leads.filter((lead) => isOverdueLead(lead))
    : leads;
  const activeLinkedProperties =
    selectedLead?.linked_properties.filter((link) => link.status === "active") ?? [];
  const activeLinkedPropertyIds = new Set(
    activeLinkedProperties.map((link) => link.properties.id)
  );
  const linkPropertyGroups: RecordPickerGroup[] = [
    {
      label: "Available properties",
      options: properties
        .filter((property) => !activeLinkedPropertyIds.has(property.id))
        .map((property) => ({
          value: property.id,
          label: property.name,
          description: propertyDescription(property),
          badge: property.listing_type,
        })),
    },
  ];
  const dealPropertyGroups: RecordPickerGroup[] = [
    {
      label: "Active linked properties",
      options: activeLinkedProperties.map((link) => ({
        value: link.properties.id,
        label: link.properties.name,
        description: propertyDescription(link.properties),
        badge: link.properties.listing_type,
      })),
    },
  ];
  const leadKpis = useMemo(() => {
    const active = leads.filter((lead) => !["Won", "Lost"].includes(lead.status));
    const converted = leads.filter((lead) => lead.status === "Won").length;
    const denominator = leads.filter((lead) => lead.status !== "Lost").length;
    return {
      active: active.length,
      new: leads.filter((lead) => lead.status === "New").length,
      overdue: leads.filter((lead) => isOverdueLead(lead)).length,
      conversionRate: denominator ? Math.round((converted / denominator) * 100) : 0,
    };
  }, [leads]);

  useEffect(() => {
    async function loadLeads() {
      const token = await getToken();
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (status && !isOverdueFilterActive) params.set("status_filter", status);
      if (source) params.set("source_filter", source);
      if (canFilterOwner && ownerId) params.set("owner_id", ownerId);
      if (preferredState) params.set("preferred_state", preferredState);
      if (preferredCity) params.set("preferred_city", preferredCity);

      try {
        const data = await apiFetch<Lead[]>(
          `/leads${params.size ? `?${params.toString()}` : ""}`,
          token
        );
        setLeads(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leads");
      }
    }

    void loadLeads();
  }, [
    getToken,
    query,
    status,
    source,
    ownerId,
    preferredState,
    preferredCity,
    canFilterOwner,
    isOverdueFilterActive,
  ]);

  useEffect(() => {
    async function loadSupportingData() {
      const token = await getToken();
      if (!token) return;
      const [user, propertyRows] = await Promise.all([
        apiFetch<CurrentUser>("/users/me", token),
        apiFetch<PropertyOption[]>("/properties", token),
      ]);
      setCurrentUser(user);
      setProperties(
        propertyRows.filter((property) =>
          ["Active", "Pending"].includes(property.status ?? "")
        )
      );
      if (user.role === "MANAGER") {
        const users = await apiFetch<TeamUser[]>("/users", token);
        setTeamUsers(users);
      }
    }

    void loadSupportingData().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load lead data");
    });
  }, [getToken]);

  async function loadSelectedLead(leadId: string) {
    setLoadingDetail(true);
    const token = await getToken();
    try {
      const data = await apiFetch<LeadDetail>(`/leads/${leadId}`, token);
      setSelectedLead(data);
      setSelectedCampaignId(data.campaign_id ?? null);
      setError(null);
    } catch (err) {
      setSelectedLead(null);
      setError(err instanceof Error ? err.message : "Failed to load lead");
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && DRAWER_TABS.includes(tab as DrawerTab)) {
      setDrawerTab(tab as DrawerTab);
    }
    if (!selectedLeadId) {
      setSelectedLead(null);
      return;
    }
    void loadSelectedLead(selectedLeadId);
    // loadSelectedLead depends on stable auth and selected route state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId, searchParams, getToken]);

  function updateSelection(leadId: string | null, tab = drawerTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (!leadId) {
      params.delete("lead");
      params.delete("tab");
    } else {
      params.set("lead", leadId);
      params.set("tab", tab);
    }
    router.replace(`/app/leads${params.size ? `?${params.toString()}` : ""}`);
  }

  function updateDrawerTab(tab: DrawerTab) {
    setDrawerTab(tab);
    if (selectedLeadId) updateSelection(selectedLeadId, tab);
  }

  function resetFilters() {
    setQuery("");
    setStatus("");
    setSource("");
    setOwnerId("");
    setPreferredState("");
    setPreferredCity("");
    router.replace("/app/leads");
  }

  async function refreshSelectedLead() {
    if (selectedLeadId) await loadSelectedLead(selectedLeadId);
  }

  async function updateStatus(nextStatus: string) {
    if (!selectedLead) return;
    const token = await getToken();
    await apiFetch(`/leads/${selectedLead.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    await refreshSelectedLead();
  }

  async function updateCampaign() {
    if (!selectedLead) return;
    const token = await getToken();
    await apiFetch(`/leads/${selectedLead.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ campaign_id: selectedCampaignId }),
    });
    setEditingCampaign(false);
    await refreshSelectedLead();
  }

  async function linkProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLead || !propertyId) return;
    const token = await getToken();
    await apiFetch(`/leads/${selectedLead.id}/links`, token, {
      method: "POST",
      body: JSON.stringify({ property_id: propertyId }),
    });
    setPropertyId("");
    await refreshSelectedLead();
  }

  async function logManualEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLead || !manualNote.trim()) return;
    const token = await getToken();
    await apiFetch(`/leads/${selectedLead.id}/timeline`, token, {
      method: "POST",
      body: JSON.stringify({
        event_type: manualEventType,
        note: manualNote,
      }),
    });
    setManualNote("");
    await refreshSelectedLead();
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-4">
        {[
          ["Active leads", leadKpis.active, "Open conversations"],
          ["New leads", leadKpis.new, "Fresh intake"],
          ["Overdue follow-ups", leadKpis.overdue, "Needs attention"],
          ["Conversion rate", `${leadKpis.conversionRate}%`, "Won vs active pool"],
        ].map(([label, value, caption]) => (
          <div key={label} className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{caption}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_repeat(6,minmax(130px,auto))]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, phone, email, or location"
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All sources</option>
            {CAMPAIGN_CHANNELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {canFilterOwner ? (
            <select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              className="min-h-11 rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All owners</option>
              {teamUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={preferredState}
            onChange={(event) => setPreferredState(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All states</option>
            {MALAYSIAN_STATES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            value={preferredCity}
            onChange={(event) => setPreferredCity(event.target.value)}
            placeholder="City / area"
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="button"
            className="min-h-11 rounded-lg border px-3 py-2 text-sm text-slate-600"
          >
            Advanced
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </section>

      {isOverdueFilterActive ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span>Showing leads with overdue follow-ups.</span>
          <Link
            href="/app/leads"
            className="font-medium underline underline-offset-4"
          >
            Clear filter
          </Link>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="grid grid-cols-[1.4fr_1.2fr_1.2fr_0.8fr_0.8fr] gap-4 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Lead</span>
            <span>Contact</span>
            <span>Classification</span>
            <span>Status</span>
            <span>Next action</span>
          </div>
          {visibleLeads.map((lead) => {
            const selected = selectedLeadId === lead.id;
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => updateSelection(lead.id)}
                className={[
                  "grid w-full grid-cols-[1.4fr_1.2fr_1.2fr_0.8fr_0.8fr] gap-4 border-b px-4 py-4 text-left text-sm transition last:border-b-0 hover:bg-slate-50",
                  selected ? "bg-blue-50/60 ring-1 ring-inset ring-blue-200" : "",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {initials(lead.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">
                      {lead.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {[lead.preferred_city, lead.preferred_state]
                        .filter(Boolean)
                        .join(", ") || "No location set"}
                    </span>
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{lead.phone}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {lead.email}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate">
                    {lead.campaign?.name ?? "Unattributed"}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {lead.campaign?.channel ?? lead.ren?.full_name ?? "No owner"}
                  </span>
                </span>
                <span>
                  <span
                    className={[
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                      statusBadgeClass(lead.status),
                    ].join(" ")}
                  >
                    {lead.status}
                  </span>
                </span>
                <span
                  className={[
                    "text-sm font-medium",
                    isOverdueLead(lead) ? "text-red-600" : "text-slate-500",
                  ].join(" ")}
                >
                  {nextActionLabel(lead)}
                </span>
              </button>
            );
          })}
          {!visibleLeads.length ? (
            <p className="p-6 text-sm text-muted-foreground">No leads found.</p>
          ) : null}
        </section>

        <LeadDrawer
          lead={selectedLead}
          loading={loadingDetail}
          tab={drawerTab}
          onTabChange={updateDrawerTab}
          onClose={() => updateSelection(null)}
          onStatusChange={updateStatus}
          editingCampaign={editingCampaign}
          setEditingCampaign={setEditingCampaign}
          selectedCampaignId={selectedCampaignId}
          setSelectedCampaignId={setSelectedCampaignId}
          onCampaignSave={updateCampaign}
          propertyId={propertyId}
          setPropertyId={setPropertyId}
          linkPropertyGroups={linkPropertyGroups}
          onLinkProperty={linkProperty}
          manualEventType={manualEventType}
          setManualEventType={setManualEventType}
          manualNote={manualNote}
          setManualNote={setManualNote}
          onLogManualEvent={logManualEvent}
          onCloseDeal={() => setCloseDealOpen(true)}
        />
      </div>

      {selectedLead ? (
        <CloseDealModal
          open={closeDealOpen}
          lead={selectedLead}
          propertyGroups={dealPropertyGroups}
          onClose={() => setCloseDealOpen(false)}
          onComplete={async () => {
            setCloseDealOpen(false);
            await refreshSelectedLead();
          }}
          getToken={getToken}
        />
      ) : null}
    </div>
  );
}

function LeadDrawer({
  lead,
  loading,
  tab,
  onTabChange,
  onClose,
  onStatusChange,
  editingCampaign,
  setEditingCampaign,
  selectedCampaignId,
  setSelectedCampaignId,
  onCampaignSave,
  propertyId,
  setPropertyId,
  linkPropertyGroups,
  onLinkProperty,
  manualEventType,
  setManualEventType,
  manualNote,
  setManualNote,
  onLogManualEvent,
  onCloseDeal,
}: {
  lead: LeadDetail | null;
  loading: boolean;
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  editingCampaign: boolean;
  setEditingCampaign: (value: boolean) => void;
  selectedCampaignId: string | null;
  setSelectedCampaignId: (value: string | null) => void;
  onCampaignSave: () => void;
  propertyId: string;
  setPropertyId: (value: string) => void;
  linkPropertyGroups: RecordPickerGroup[];
  onLinkProperty: (event: FormEvent<HTMLFormElement>) => void;
  manualEventType: string;
  setManualEventType: (value: string) => void;
  manualNote: string;
  setManualNote: (value: string) => void;
  onLogManualEvent: (event: FormEvent<HTMLFormElement>) => void;
  onCloseDeal: () => void;
}) {
  return (
    <aside
      className={[
        "rounded-xl border bg-white shadow-sm xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto",
        lead
          ? "fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto xl:relative xl:inset-auto xl:z-auto xl:w-auto xl:max-w-none"
          : "hidden xl:block",
      ].join(" ")}
    >
      {!lead ? (
        <div className="flex min-h-96 items-center justify-center p-6 text-center text-sm text-slate-500">
          Select a lead to review details, timeline, linked properties, and actions.
        </div>
      ) : (
        <div className="flex min-h-full flex-col">
          <div className="border-b p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {initials(lead.name)}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{lead.name}</h3>
                  <p className="text-sm text-slate-500">{lead.phone}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-2 py-1 text-sm xl:hidden"
              >
                Close
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                  statusBadgeClass(lead.status),
                ].join(" ")}
              >
                {lead.status}
              </span>
              <span className="truncate text-xs text-slate-500">{lead.email}</span>
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
            {loading ? <p className="text-sm text-slate-500">Loading lead...</p> : null}
            {tab === "details" ? (
              <div className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Status</span>
                  <select
                    value={lead.status}
                    onChange={(event) => onStatusChange(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    {LEAD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <InfoCard title="Preferences">
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-slate-500">Budget</dt>
                      <dd>
                        {formatCurrency(lead.budget_min)} -{" "}
                        {formatCurrency(lead.budget_max)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Location</dt>
                      <dd>
                        {[lead.preferred_city, lead.preferred_state]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Areas</dt>
                      <dd>{lead.preferred_areas?.join(", ") || "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Notes</dt>
                      <dd>{lead.preferred_location ?? "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Property type</dt>
                      <dd>{lead.preferred_property_type ?? "-"}</dd>
                    </div>
                  </dl>
                </InfoCard>

                <InfoCard title="Campaign Attribution">
                  {editingCampaign ? (
                    <div className="space-y-3">
                      <CampaignPicker
                        value={selectedCampaignId}
                        onChange={setSelectedCampaignId}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void onCampaignSave()}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCampaign(false)}
                          className="rounded-lg border px-3 py-2 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {lead.campaign?.name ?? "Unattributed"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {lead.campaign
                            ? `${lead.campaign.channel} · ${lead.campaign.status}`
                            : "No campaign selected"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingCampaign(true)}
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </InfoCard>

                <InfoCard title="Upcoming Work">
                  {lead.upcoming_viewings?.length ? (
                    <div className="space-y-2">
                      {lead.upcoming_viewings.map((viewing) => (
                        <p key={viewing.id} className="text-sm">
                          Viewing · {new Date(viewing.scheduled_at).toLocaleString()}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No upcoming viewings. Next action: {nextActionLabel(lead)}
                    </p>
                  )}
                </InfoCard>
              </div>
            ) : null}

            {tab === "timeline" ? (
              <div className="space-y-4">
                <form onSubmit={onLogManualEvent} className="space-y-3 rounded-lg border p-3">
                  <select
                    value={manualEventType}
                    onChange={(event) => setManualEventType(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="manual_call">Called customer</option>
                    <option value="manual_note">Negotiation note</option>
                    <option value="manual_callback">Callback requested</option>
                  </select>
                  <textarea
                    value={manualNote}
                    onChange={(event) => setManualNote(event.target.value)}
                    placeholder="Write a timeline note"
                    className="min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    Save interaction
                  </button>
                </form>
                <TimelineEventList events={lead.timeline} />
              </div>
            ) : null}

            {tab === "properties" ? (
              <div className="space-y-4">
                <InfoCard title="Linked Properties">
                  <div className="space-y-2">
                    {lead.linked_properties.map((link) => (
                      <div
                        key={link.properties.id}
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{link.properties.name}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                            {link.properties.listing_type}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {propertyDescription(link.properties)}
                        </p>
                      </div>
                    ))}
                    {!lead.linked_properties.length ? (
                      <p className="text-sm text-slate-500">No linked properties.</p>
                    ) : null}
                  </div>
                </InfoCard>
                <form onSubmit={onLinkProperty} className="space-y-3 rounded-lg border p-3">
                  <RecordPicker
                    label="Property to link"
                    value={propertyId}
                    onChange={setPropertyId}
                    groups={linkPropertyGroups}
                    placeholder="Select property"
                    searchPlaceholder="Search property name, type, location, or status"
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    Link property
                  </button>
                </form>
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-white p-4">
            <a
              href={`tel:${lead.phone}`}
              className="rounded-lg border px-3 py-2 text-center text-sm font-medium"
            >
              Call
            </a>
            <a
              href={`mailto:${lead.email}`}
              className="rounded-lg border px-3 py-2 text-center text-sm font-medium"
            >
              Email
            </a>
            <Link
              href="/app/viewings/new"
              className="rounded-lg border px-3 py-2 text-center text-sm font-medium"
            >
              Schedule viewing
            </Link>
            <button
              type="button"
              onClick={onCloseDeal}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Close deal
            </button>
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

function CloseDealModal({
  open,
  lead,
  propertyGroups,
  onClose,
  onComplete,
  getToken,
}: {
  open: boolean;
  lead: LeadDetail;
  propertyGroups: RecordPickerGroup[];
  onClose: () => void;
  onComplete: () => Promise<void>;
  getToken: () => Promise<string | null>;
}) {
  const [dealPropertyId, setDealPropertyId] = useState("");
  const [dealType, setDealType] = useState<"Sale" | "Rental">("Sale");
  const [salePrice, setSalePrice] = useState("");
  const [agencyFee, setAgencyFee] = useState("");
  const [lawyerFees, setLawyerFees] = useState("");
  const [commissionOverride, setCommissionOverride] = useState("");
  const [error, setError] = useState<string | null>(null);
  const linkedProperties = lead.linked_properties
    .filter((link) => link.status === "active")
    .map((link) => link.properties);
  const selectedProperty = linkedProperties.find(
    (property) => property.id === dealPropertyId
  );

  function selectDealProperty(propertyId: string) {
    setDealPropertyId(propertyId);
    const property = linkedProperties.find((item) => item.id === propertyId);
    if (!property) return;
    const nextDealType = property.listing_type === "Rental" ? "Rental" : "Sale";
    setDealType(nextDealType);
    setSalePrice(
      String(
        nextDealType === "Rental"
          ? property.expected_rental ?? ""
          : property.listing_price ?? ""
      )
    );
  }

  function updateDealType(nextDealType: "Sale" | "Rental") {
    setDealType(nextDealType);
    if (!selectedProperty) return;
    setSalePrice(
      String(
        nextDealType === "Rental"
          ? selectedProperty.expected_rental ?? ""
          : selectedProperty.listing_price ?? ""
      )
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await getToken();
    try {
      await apiFetch("/deals", token, {
        method: "POST",
        body: JSON.stringify({
          lead_id: lead.id,
          property_id: dealPropertyId,
          deal_type: dealType,
          sale_price: Number(salePrice),
          agency_fee: agencyFee ? Number(agencyFee) : null,
          lawyer_fees: lawyerFees ? Number(lawyerFees) : null,
          commission_override: commissionOverride
            ? Number(commissionOverride)
            : null,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close deal");
      return;
    }
    setDealPropertyId("");
    setSalePrice("");
    setAgencyFee("");
    setLawyerFees("");
    setCommissionOverride("");
    setError(null);
    await onComplete();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Close deal</h3>
            <p className="text-sm text-slate-500">{lead.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">
            Cancel
          </button>
        </div>
        <RecordPicker
          label="Linked property"
          value={dealPropertyId}
          onChange={selectDealProperty}
          groups={propertyGroups}
          placeholder="Select linked property"
          searchPlaceholder="Search linked property"
          required
        />
        {selectedProperty?.listing_type === "Both" ? (
          <div className="flex items-center gap-4 rounded-lg border px-3 py-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={dealType === "Sale"}
                onChange={() => updateDealType("Sale")}
              />
              Sale
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={dealType === "Rental"}
                onChange={() => updateDealType("Rental")}
              />
              Rental
            </label>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={salePrice}
            onChange={(event) => setSalePrice(event.target.value)}
            type="number"
            min="0"
            placeholder="Final sale/rental amount"
            className="rounded-lg border px-3 py-2"
            required
          />
          <input
            value={agencyFee}
            onChange={(event) => setAgencyFee(event.target.value)}
            type="number"
            min="0"
            placeholder="Agency fee override"
            className="rounded-lg border px-3 py-2"
          />
          <input
            value={lawyerFees}
            onChange={(event) => setLawyerFees(event.target.value)}
            type="number"
            min="0"
            placeholder="Lawyer fees override"
            className="rounded-lg border px-3 py-2"
          />
          <input
            value={commissionOverride}
            onChange={(event) => setCommissionOverride(event.target.value)}
            type="number"
            min="0"
            placeholder="Commission override"
            className="rounded-lg border px-3 py-2"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Close deal
        </button>
      </form>
    </div>
  );
}
