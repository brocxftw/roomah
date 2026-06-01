"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Percent,
  Plus,
  Table2,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { WinDealModal, type CloseDealLead } from "@/components/close-deal-modal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type DealStage =
  | "negotiation"
  | "offer_made"
  | "pending_contract"
  | "final_approval"
  | "closed_won"
  | "closed_lost";
type DealView = "pipeline" | "list";
type DrawerTab = "overview" | "commission" | "timeline" | "documents";
type ListingType = "Sale" | "Rental" | "Both";

type UserOption = {
  id: string;
  email: string;
  full_name: string;
};

type DealLead = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
};

type DealProperty = {
  id: string;
  name?: string | null;
  type?: string | null;
  listing_type?: ListingType | null;
  status?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  listing_price?: number | string | null;
  expected_rental?: number | string | null;
};

type OriginViewing = {
  id: string;
  scheduled_at?: string | null;
  status?: string | null;
  interest_level?: number | null;
  notes?: string | null;
  completed_at?: string | null;
};

type DealDocument = {
  id: string;
  label: string;
  url: string;
  kind?: string | null;
  created_at?: string | null;
};

type DealTimelineEvent = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type Deal = {
  id: string;
  lead_id: string;
  property_id: string;
  ren_id: string;
  stage: DealStage;
  deal_type?: "Sale" | "Rental" | null;
  sale_price: string | number;
  commission_rate: string | number;
  agency_fee: string | number;
  lawyer_fees: string | number;
  commission_total: string | number;
  commission_override?: string | number | null;
  expected_close_date?: string | null;
  probability_override?: string | number | null;
  effective_probability: number;
  projected_commission: string | number;
  notes?: string | null;
  lost_reason?: string | null;
  lost_notes?: string | null;
  lost_at?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  document_count: number;
  lead?: DealLead | null;
  property?: DealProperty | null;
  owner?: UserOption | null;
  ren?: UserOption | null;
  origin_viewing?: OriginViewing | null;
  documents?: DealDocument[];
  timeline?: DealTimelineEvent[];
};

const DEAL_STAGES: { id: DealStage; label: string; tone: string }[] = [
  { id: "negotiation", label: "Negotiation", tone: "border-cyan-200 bg-cyan-50" },
  { id: "offer_made", label: "Offer Made", tone: "border-blue-200 bg-blue-50" },
  {
    id: "pending_contract",
    label: "Pending Contract",
    tone: "border-indigo-200 bg-indigo-50",
  },
  {
    id: "final_approval",
    label: "Final Approval",
    tone: "border-violet-200 bg-violet-50",
  },
  { id: "closed_won", label: "Closed Won", tone: "border-emerald-200 bg-emerald-50" },
  { id: "closed_lost", label: "Closed Lost", tone: "border-slate-200 bg-slate-50" },
];
const OPEN_STAGES = new Set<DealStage>([
  "negotiation",
  "offer_made",
  "pending_contract",
  "final_approval",
]);
const TERMINAL_STAGES = new Set<DealStage>(["closed_won", "closed_lost"]);
const DRAWER_TABS: DrawerTab[] = ["overview", "commission", "timeline", "documents"];
const PAGE_SIZE = 10;

function numberValue(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function titleCase(value?: string | null) {
  if (!value) return "-";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function stageLabel(stage: DealStage) {
  return DEAL_STAGES.find((item) => item.id === stage)?.label ?? titleCase(stage);
}

function dealSearchText(deal: Deal) {
  return [
    deal.id,
    deal.lead?.name,
    deal.lead?.phone,
    deal.lead?.email,
    deal.property?.name,
    deal.property?.type,
    deal.property?.city,
    deal.owner?.full_name,
    deal.owner?.email,
  ]
    .join(" ")
    .toLowerCase();
}

function computeKpis(deals: Deal[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const openDeals = deals.filter((deal) => OPEN_STAGES.has(deal.stage));
  const wonThisMonth = deals.filter(
    (deal) =>
      deal.stage === "closed_won" &&
      deal.closed_at &&
      new Date(deal.closed_at).getTime() >= monthStart.getTime()
  );
  const terminalRecent = deals.filter((deal) => {
    const terminalDate = deal.stage === "closed_lost" ? deal.lost_at : deal.closed_at;
    return (
      (deal.stage === "closed_won" || deal.stage === "closed_lost") &&
      terminalDate &&
      new Date(terminalDate).getTime() >= thirtyDaysAgo.getTime()
    );
  });
  const recentWon = terminalRecent.filter((deal) => deal.stage === "closed_won").length;
  return [
    {
      label: "Pipeline Value",
      value: formatCurrency(
        openDeals.reduce((sum, deal) => sum + numberValue(deal.sale_price), 0)
      ),
      helper: `${openDeals.length} open deals`,
      icon: BriefcaseBusiness,
      tone: "bg-cyan-50 text-cyan-600",
    },
    {
      label: "Weighted Pipeline",
      value: formatCurrency(
        openDeals.reduce(
          (sum, deal) =>
            sum + numberValue(deal.sale_price) * (deal.effective_probability / 100),
          0
        )
      ),
      helper: "Value × probability",
      icon: TrendingUp,
      tone: "bg-blue-50 text-blue-600",
    },
    {
      label: "Closed Won (this month)",
      value: formatCurrency(
        wonThisMonth.reduce((sum, deal) => sum + numberValue(deal.sale_price), 0)
      ),
      helper: `${wonThisMonth.length} won this month`,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Commission (this month)",
      value: formatCurrency(
        wonThisMonth.reduce(
          (sum, deal) => sum + numberValue(deal.projected_commission),
          0
        )
      ),
      helper: "Effective commission",
      icon: CircleDollarSign,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: "Win Rate",
      value: terminalRecent.length
        ? `${Math.round((recentWon / terminalRecent.length) * 100)}%`
        : "-",
      helper: "Trailing 30 days",
      icon: Percent,
      tone: "bg-violet-50 text-violet-600",
    },
  ];
}

export default function DealsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [teamUsers, setTeamUsers] = useState<UserOption[]>([]);
  const [query, setQuery] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [dealType, setDealType] = useState("");
  const [closeFrom, setCloseFrom] = useState("");
  const [closeTo, setCloseTo] = useState("");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winOpen, setWinOpen] = useState(false);
  const [lostReason, setLostReason] = useState("budget");
  const [lostNotes, setLostNotes] = useState("");
  const [documentLabel, setDocumentLabel] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentKind, setDocumentKind] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editProbability, setEditProbability] = useState("");
  const [editExpectedClose, setEditExpectedClose] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const drawerRef = useRef<HTMLElement | null>(null);
  const currentView = (searchParams.get("view") as DealView | null) ?? "list";
  const selectedDealId = searchParams.get("deal");
  const selectedTab = (searchParams.get("tab") as DrawerTab | null) ?? "overview";

  const propertyTypes = useMemo(
    () =>
      Array.from(
        new Set(deals.map((deal) => deal.property?.type).filter(Boolean))
      ) as string[],
    [deals]
  );
  const filteredDeals = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return deals.filter((deal) => {
      if (needle && !dealSearchText(deal).includes(needle)) return false;
      if (ownerId && deal.ren_id !== ownerId) return false;
      if (stageFilter && deal.stage !== stageFilter) return false;
      if (propertyType && deal.property?.type !== propertyType) return false;
      if (dealType && deal.deal_type !== dealType) return false;
      if (
        closeFrom &&
        (!deal.expected_close_date || deal.expected_close_date < closeFrom)
      ) {
        return false;
      }
      if (closeTo && (!deal.expected_close_date || deal.expected_close_date > closeTo)) {
        return false;
      }
      return true;
    });
  }, [deals, query, ownerId, stageFilter, propertyType, dealType, closeFrom, closeTo]);
  const kpis = useMemo(() => computeKpis(filteredDeals), [filteredDeals]);
  const totalPages = showAll
    ? 1
    : Math.max(1, Math.ceil(filteredDeals.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedDeals = showAll
    ? filteredDeals
    : filteredDeals.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function loadDeals() {
    const token = await getToken();
    const data = await apiFetch<Deal[]>("/deals", token);
    setDeals(data);
    setError(null);
  }

  async function loadSelectedDeal(dealId: string) {
    setLoadingDetail(true);
    const token = await getToken();
    try {
      setSelectedDeal(await apiFetch<Deal>(`/deals/${dealId}`, token));
      setError(null);
    } catch (err) {
      setSelectedDeal(null);
      setError(err instanceof Error ? err.message : "Failed to load deal");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function refreshWorkspace() {
    await loadDeals();
    if (selectedDealId) await loadSelectedDeal(selectedDealId);
  }

  useEffect(() => {
    void loadDeals().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load deals");
    });
    // loadDeals depends on stable auth state and is intentionally route-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  useEffect(() => {
    async function loadUsers() {
      const token = await getToken();
      if (!token) return;
      setTeamUsers(await apiFetch<UserOption[]>("/users", token));
    }
    void loadUsers().catch(() => {
      // Non-fatal: owner filter hides options if user loading fails.
    });
  }, [getToken]);

  useEffect(() => {
    if (!selectedDealId) {
      setSelectedDeal(null);
      return;
    }
    void loadSelectedDeal(selectedDealId);
    // loadSelectedDeal uses stable auth and selected route state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDealId, getToken]);

  useEffect(() => {
    if (!selectedDealId) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (drawerRef.current?.contains(target)) return;
      if (target.closest("[data-deal-row=\"true\"]")) return;
      if (target.closest("[data-deal-card=\"true\"]")) return;
      if (target.closest("[data-deal-modal=\"true\"]")) return;
      updateSelection(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
    // updateSelection is stable enough for this listener; selectedDealId guards lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDealId]);

  useEffect(() => {
    setPage(1);
    setShowAll(false);
  }, [query, ownerId, stageFilter, propertyType, dealType, closeFrom, closeTo]);

  useEffect(() => {
    setEditValue(selectedDeal ? String(selectedDeal.sale_price ?? "") : "");
    setEditProbability(
      selectedDeal?.probability_override != null
        ? String(selectedDeal.probability_override)
        : ""
    );
    setEditExpectedClose(selectedDeal?.expected_close_date ?? "");
    setEditNotes(selectedDeal?.notes ?? "");
  }, [selectedDeal]);

  function replaceParams(nextParams: URLSearchParams) {
    router.replace(`/app/deals${nextParams.size ? `?${nextParams.toString()}` : ""}`);
  }

  function updateView(view: DealView) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    replaceParams(params);
  }

  function updateSelection(dealId: string | null, tab: DrawerTab = selectedTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (!dealId) {
      params.delete("deal");
      params.delete("tab");
    } else {
      params.set("deal", dealId);
      params.set("tab", tab);
    }
    replaceParams(params);
  }

  function updateDrawerTab(tab: DrawerTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    replaceParams(params);
  }

  async function moveDeal(dealId: string, nextStage: DealStage) {
    const existing = deals.find((deal) => deal.id === dealId);
    if (!existing || !OPEN_STAGES.has(nextStage) || existing.stage === nextStage) {
      return;
    }
    const token = await getToken();
    const wasClosed = TERMINAL_STAGES.has(existing.stage);
    setDeals((current) =>
      current.map((deal) => (deal.id === dealId ? { ...deal, stage: nextStage } : deal))
    );
    try {
      if (wasClosed) {
        await apiFetch(`/deals/${dealId}/reopen`, token, {
          method: "POST",
          body: JSON.stringify({ stage: nextStage }),
        });
      } else {
        await apiFetch(`/deals/${dealId}/stage`, token, {
          method: "PATCH",
          body: JSON.stringify({ stage: nextStage }),
        });
      }
      await refreshWorkspace();
    } catch (err) {
      setDeals((current) =>
        current.map((deal) => (deal.id === dealId ? existing : deal))
      );
      setError(err instanceof Error ? err.message : "Failed to move deal");
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const dealId = String(event.active.id);
    const nextStage = event.over?.id as DealStage | undefined;
    if (!nextStage || !OPEN_STAGES.has(nextStage)) return;
    void moveDeal(dealId, nextStage);
  }

  async function updateDealStage(stage: DealStage) {
    if (!selectedDeal) return;
    await moveDeal(selectedDeal.id, stage);
  }

  async function markLost() {
    if (!selectedDeal) return;
    const token = await getToken();
    try {
      await apiFetch(`/deals/${selectedDeal.id}/lose`, token, {
        method: "POST",
        body: JSON.stringify({
          lost_reason: lostReason,
          lost_notes: lostNotes || null,
        }),
      });
      setLostNotes("");
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark lost");
    }
  }

  async function saveDealDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDeal) return;
    const token = await getToken();
    try {
      await apiFetch(`/deals/${selectedDeal.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          sale_price: editValue ? Number(editValue) : undefined,
          probability_override: editProbability ? Number(editProbability) : null,
          expected_close_date: editExpectedClose || null,
          notes: editNotes || null,
        }),
      });
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save deal");
    }
  }

  async function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDeal) return;
    const token = await getToken();
    try {
      await apiFetch(`/deals/${selectedDeal.id}/documents`, token, {
        method: "POST",
        body: JSON.stringify({
          label: documentLabel,
          url: documentUrl,
          kind: documentKind || null,
        }),
      });
      setDocumentLabel("");
      setDocumentUrl("");
      setDocumentKind("");
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add document");
    }
  }

  async function deleteDocument(documentId: string) {
    if (!selectedDeal) return;
    const token = await getToken();
    try {
      await apiFetch(`/deals/${selectedDeal.id}/documents/${documentId}`, token, {
        method: "DELETE",
      });
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }

  function resetFilters() {
    setQuery("");
    setOwnerId("");
    setStageFilter("");
    setPropertyType("");
    setDealType("");
    setCloseFrom("");
    setCloseTo("");
  }

  const winLead = selectedDeal?.lead && selectedDeal.property
    ? ({
        id: selectedDeal.lead.id,
        name: selectedDeal.lead.name ?? "Lead",
        linked_properties: [
          {
            status: "active",
            properties: {
              id: selectedDeal.property.id,
              name: selectedDeal.property.name ?? "Property",
              type: selectedDeal.property.type,
              city: selectedDeal.property.city,
              state: selectedDeal.property.state,
              postcode: selectedDeal.property.postcode,
              listing_type: selectedDeal.property.listing_type ?? "Sale",
              status: selectedDeal.property.status,
              listing_price: selectedDeal.property.listing_price,
              expected_rental: selectedDeal.property.expected_rental,
            },
          },
        ],
      } satisfies CloseDealLead)
    : null;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((card) => (
          <KpiCard key={card.label} card={card} />
        ))}
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border bg-slate-50 p-1">
            {(["list", "pipeline"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => updateView(view)}
                className={[
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium capitalize",
                  currentView === view
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500",
                ].join(" ")}
              >
                {view === "pipeline" ? (
                  <BriefcaseBusiness className="h-4 w-4" aria-hidden />
                ) : (
                  <Table2 className="h-4 w-4" aria-hidden />
                )}
                {view}
              </button>
            ))}
          </div>
          <div className="text-sm text-slate-500">
            {filteredDeals.length} of {deals.length} deals
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search deals"
            className="rounded-lg border px-3 py-2 text-sm xl:col-span-2"
          />
          <select
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All owners</option>
            {teamUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All stages</option>
            {DEAL_STAGES.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
          <select
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All property types</option>
            {propertyTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={dealType}
            onChange={(event) => setDealType(event.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All deal types</option>
            <option value="Sale">Sale</option>
            <option value="Rental">Rental</option>
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border px-3 py-2 text-sm font-medium"
          >
            Reset
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-slate-500">
            Closing from
            <input
              value={closeFrom}
              onChange={(event) => setCloseFrom(event.target.value)}
              type="date"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Closing to
            <input
              value={closeTo}
              onChange={(event) => setCloseTo(event.target.value)}
              type="date"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      {currentView === "pipeline" ? (
        <DndContext onDragEnd={onDragEnd}>
          <section className="overflow-x-auto rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid min-w-[1280px] grid-cols-6 gap-4">
              {DEAL_STAGES.map((stage) => (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  deals={filteredDeals.filter((deal) => deal.stage === stage.id)}
                  selectedDealId={selectedDealId}
                  onSelect={updateSelection}
                />
              ))}
            </div>
          </section>
        </DndContext>
      ) : (
        <DealTable
          deals={paginatedDeals}
          selectedDealId={selectedDealId}
          page={safePage}
          totalPages={totalPages}
          showAll={showAll}
          onSelect={updateSelection}
          onPageChange={setPage}
          onToggleShowAll={() => setShowAll((value) => !value)}
        />
      )}

      {selectedDealId ? (
        <DealDrawer
          containerRef={drawerRef}
          deal={selectedDeal}
          loading={loadingDetail}
          tab={DRAWER_TABS.includes(selectedTab) ? selectedTab : "overview"}
          lostReason={lostReason}
          setLostReason={setLostReason}
          lostNotes={lostNotes}
          setLostNotes={setLostNotes}
          documentLabel={documentLabel}
          setDocumentLabel={setDocumentLabel}
          documentUrl={documentUrl}
          setDocumentUrl={setDocumentUrl}
          documentKind={documentKind}
          setDocumentKind={setDocumentKind}
          editValue={editValue}
          setEditValue={setEditValue}
          editProbability={editProbability}
          setEditProbability={setEditProbability}
          editExpectedClose={editExpectedClose}
          setEditExpectedClose={setEditExpectedClose}
          editNotes={editNotes}
          setEditNotes={setEditNotes}
          onTabChange={updateDrawerTab}
          onClose={() => updateSelection(null)}
          onMoveStage={updateDealStage}
          onMarkWon={() => setWinOpen(true)}
          onMarkLost={() => void markLost()}
          onSaveDealDetails={saveDealDetails}
          onAddDocument={addDocument}
          onDeleteDocument={(documentId) => void deleteDocument(documentId)}
        />
      ) : null}

      {winLead && selectedDeal ? (
        <WinDealModal
          open={winOpen}
          lead={winLead}
          propertyGroups={[]}
          dealId={selectedDeal.id}
          onClose={() => setWinOpen(false)}
          onComplete={async () => {
            setWinOpen(false);
            await refreshWorkspace();
          }}
          getToken={getToken}
        />
      ) : null}
    </div>
  );
}

function KpiCard({
  card,
}: {
  card: {
    label: string;
    value: string;
    helper: string;
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    tone: string;
  };
}) {
  const Icon = card.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${card.tone}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500">{card.label}</p>
        <p className="mt-1 truncate text-2xl font-semibold text-slate-900">
          {card.value}
        </p>
        <p className="mt-1 truncate text-xs text-slate-400">{card.helper}</p>
      </div>
    </div>
  );
}

function PipelineColumn({
  stage,
  deals,
  selectedDealId,
  onSelect,
}: {
  stage: (typeof DEAL_STAGES)[number];
  deals: Deal[];
  selectedDealId: string | null;
  onSelect: (dealId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={[
        "flex min-h-[420px] flex-col rounded-xl border p-3",
        stage.tone,
        isOver && OPEN_STAGES.has(stage.id) ? "ring-2 ring-slate-900" : "",
      ].join(" ")}
    >
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{stage.label}</h3>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
            {deals.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {formatCurrency(deals.reduce((sum, deal) => sum + numberValue(deal.sale_price), 0))}
        </p>
      </div>
      <div className="space-y-3">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            selected={selectedDealId === deal.id}
            onSelect={() => onSelect(deal.id)}
          />
        ))}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  selected,
  onSelect,
}: {
  deal: Deal;
  selected: boolean;
  onSelect: () => void;
}) {
  // Closed cards stay draggable so the user can drag them onto an open
  // column to trigger a reopen via /deals/{id}/reopen.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-deal-card="true"
      style={style}
      onClick={onSelect}
      className={[
        "w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-slate-300",
        selected ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200",
        isDragging ? "z-20 opacity-70" : "",
      ].join(" ")}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {deal.lead?.name ?? "Lead"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {deal.property?.name ?? "Property"}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
          {deal.effective_probability}%
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-900">
          {formatCurrency(deal.sale_price)}
        </span>
        <span className="text-slate-500">{deal.owner?.full_name ?? "-"}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>{formatDate(deal.expected_close_date)}</span>
        {deal.origin_viewing?.interest_level ? (
          <span>{"★".repeat(Number(deal.origin_viewing.interest_level))}</span>
        ) : null}
      </div>
    </button>
  );
}

function DealTable({
  deals,
  selectedDealId,
  page,
  totalPages,
  showAll,
  onSelect,
  onPageChange,
  onToggleShowAll,
}: {
  deals: Deal[];
  selectedDealId: string | null;
  page: number;
  totalPages: number;
  showAll: boolean;
  onSelect: (dealId: string) => void;
  onPageChange: (page: number) => void;
  onToggleShowAll: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-lg font-semibold text-slate-900">Deal List</h3>
        <button
          type="button"
          onClick={onToggleShowAll}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium"
        >
          {showAll ? "Paginate" : "Show all"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Deal</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Commission</th>
              <th className="px-4 py-3">Close Date</th>
              <th className="px-4 py-3">Probability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deals.map((deal) => (
              <tr
                key={deal.id}
                data-deal-row="true"
                onClick={() => onSelect(deal.id)}
                className={[
                  "cursor-pointer hover:bg-slate-50",
                  selectedDealId === deal.id ? "bg-slate-50" : "",
                ].join(" ")}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">
                    {deal.lead?.name ?? deal.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-slate-500">{deal.id.slice(0, 8)}</p>
                </td>
                <td className="px-4 py-3">{deal.property?.name ?? "-"}</td>
                <td className="px-4 py-3">{deal.owner?.full_name ?? "-"}</td>
                <td className="px-4 py-3">
                  <StageBadge stage={deal.stage} />
                </td>
                <td className="px-4 py-3 font-medium">{formatCurrency(deal.sale_price)}</td>
                <td className="px-4 py-3">{formatCurrency(deal.projected_commission)}</td>
                <td className="px-4 py-3">{formatDate(deal.expected_close_date)}</td>
                <td className="px-4 py-3">{deal.effective_probability}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!deals.length ? (
        <p className="p-4 text-sm text-slate-500">No deals match the current filters.</p>
      ) : null}
      {!showAll && totalPages > 1 ? (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-lg border px-3 py-1.5 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded-lg border px-3 py-1.5 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function DealDrawer({
  containerRef,
  deal,
  loading,
  tab,
  lostReason,
  setLostReason,
  lostNotes,
  setLostNotes,
  documentLabel,
  setDocumentLabel,
  documentUrl,
  setDocumentUrl,
  documentKind,
  setDocumentKind,
  editValue,
  setEditValue,
  editProbability,
  setEditProbability,
  editExpectedClose,
  setEditExpectedClose,
  editNotes,
  setEditNotes,
  onTabChange,
  onClose,
  onMoveStage,
  onMarkWon,
  onMarkLost,
  onSaveDealDetails,
  onAddDocument,
  onDeleteDocument,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  deal: Deal | null;
  loading: boolean;
  tab: DrawerTab;
  lostReason: string;
  setLostReason: (value: string) => void;
  lostNotes: string;
  setLostNotes: (value: string) => void;
  documentLabel: string;
  setDocumentLabel: (value: string) => void;
  documentUrl: string;
  setDocumentUrl: (value: string) => void;
  documentKind: string;
  setDocumentKind: (value: string) => void;
  editValue: string;
  setEditValue: (value: string) => void;
  editProbability: string;
  setEditProbability: (value: string) => void;
  editExpectedClose: string;
  setEditExpectedClose: (value: string) => void;
  editNotes: string;
  setEditNotes: (value: string) => void;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  onMoveStage: (stage: DealStage) => Promise<void>;
  onMarkWon: () => void;
  onMarkLost: () => void;
  onSaveDealDetails: (event: FormEvent<HTMLFormElement>) => void;
  onAddDocument: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteDocument: (documentId: string) => void;
}) {
  return (
    <aside
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-3xl border bg-white shadow-2xl xl:inset-x-auto xl:right-0 xl:top-0 xl:h-screen xl:max-h-none xl:w-[420px] xl:rounded-none"
    >
      {!deal ? (
        <div className="flex min-h-96 items-center justify-center p-6 text-center text-sm text-slate-500">
          {loading ? "Loading deal..." : "Select a deal to review pipeline details."}
        </div>
      ) : (
        <div className="flex min-h-full flex-col">
          <div className="border-b p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Deal #{deal.id.slice(0, 8)}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {deal.lead?.name ?? "Deal"}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StageBadge stage={deal.stage} />
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(deal.sale_price)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
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
            {tab === "overview" ? (
              <>
                <InfoCard title="Pipeline Health">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Probability</span>
                      <span className="font-medium">{deal.effective_probability}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{ width: `${deal.effective_probability}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Expected close: {formatDate(deal.expected_close_date)}
                    </p>
                  </div>
                </InfoCard>
                <EntityCard title="Lead" primary={deal.lead?.name ?? deal.lead_id} secondary={deal.lead?.phone ?? deal.lead?.email ?? "-"} />
                <EntityCard title="Property" primary={deal.property?.name ?? deal.property_id} secondary={[deal.property?.type, deal.property?.city].filter(Boolean).join(" · ")} />
                <EntityCard title="Owner" primary={deal.owner?.full_name ?? deal.ren_id} secondary={deal.owner?.email ?? "-"} />
                {deal.origin_viewing ? (
                  <InfoCard title="Viewing Origin">
                    <p className="text-sm text-slate-600">
                      {formatDate(deal.origin_viewing.scheduled_at)} ·{" "}
                      {deal.origin_viewing.interest_level
                        ? `${deal.origin_viewing.interest_level}/5 interest`
                        : "No rating"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {deal.origin_viewing.notes ?? "No viewing notes."}
                    </p>
                  </InfoCard>
                ) : null}
                <InfoCard title="Notes">
                  <p className="text-sm text-slate-600">{deal.notes ?? "No notes yet."}</p>
                </InfoCard>
                <form onSubmit={onSaveDealDetails} className="space-y-3 rounded-xl border p-3">
                  <p className="text-sm font-semibold text-slate-900">Edit Deal</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      type="number"
                      min="0"
                      placeholder="Current value"
                      className="rounded-lg border px-3 py-2 text-sm"
                    />
                    <input
                      value={editProbability}
                      onChange={(event) => setEditProbability(event.target.value)}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Probability %"
                      className="rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    value={editExpectedClose}
                    onChange={(event) => setEditExpectedClose(event.target.value)}
                    type="date"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    aria-label="Expected close date"
                  />
                  <textarea
                    value={editNotes}
                    onChange={(event) => setEditNotes(event.target.value)}
                    placeholder="Deal notes"
                    className="min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    Save deal
                  </button>
                </form>
              </>
            ) : null}
            {tab === "commission" ? (
              <InfoCard title="Commission Breakdown">
                <KeyValue label="Current value" value={formatCurrency(deal.sale_price)} />
                <KeyValue label="Commission rate" value={`${numberValue(deal.commission_rate) * 100}%`} />
                <KeyValue label="Agency fee" value={formatCurrency(deal.agency_fee)} />
                <KeyValue label="Lawyer fees" value={formatCurrency(deal.lawyer_fees)} />
                <KeyValue label="Commission total" value={formatCurrency(deal.commission_total)} />
                <KeyValue label="Override" value={deal.commission_override ? formatCurrency(deal.commission_override) : "-"} />
                <KeyValue label={deal.stage === "closed_won" ? "Final commission" : "Projected commission"} value={formatCurrency(deal.projected_commission)} strong />
              </InfoCard>
            ) : null}
            {tab === "timeline" ? (
              <InfoCard title="Timeline">
                <div className="space-y-3">
                  {(deal.timeline ?? []).map((event) => (
                    <div key={event.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium text-slate-900">{titleCase(event.event_type)}</p>
                      <p className="text-xs text-slate-500">{formatDate(event.created_at)}</p>
                    </div>
                  ))}
                  {!deal.timeline?.length ? (
                    <p className="text-sm text-slate-500">No deal timeline yet.</p>
                  ) : null}
                </div>
              </InfoCard>
            ) : null}
            {tab === "documents" ? (
              <div className="space-y-4">
                <InfoCard title="Documents">
                  <div className="space-y-2">
                    {(deal.documents ?? []).map((document) => (
                      <div key={document.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">{document.label}</p>
                          <p className="text-xs text-slate-500">{document.kind ?? "document"}</p>
                        </div>
                        <div className="flex gap-2">
                          <a href={document.url} target="_blank" rel="noreferrer" className="rounded-lg border p-2">
                            <ExternalLink className="h-4 w-4" aria-hidden />
                          </a>
                          <button type="button" onClick={() => onDeleteDocument(document.id)} className="rounded-lg border p-2 text-red-600">
                            <XCircle className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    ))}
                    {!deal.documents?.length ? (
                      <p className="text-sm text-slate-500">No document links yet.</p>
                    ) : null}
                  </div>
                </InfoCard>
                <form onSubmit={onAddDocument} className="space-y-3 rounded-xl border p-3">
                  <p className="text-sm font-semibold">Add document link</p>
                  <input value={documentLabel} onChange={(event) => setDocumentLabel(event.target.value)} placeholder="Label" className="w-full rounded-lg border px-3 py-2 text-sm" required />
                  <input value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} placeholder="https://..." className="w-full rounded-lg border px-3 py-2 text-sm" required />
                  <select value={documentKind} onChange={(event) => setDocumentKind(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
                    <option value="">Document kind</option>
                    {["offer", "contract", "loan", "tenancy", "receipt", "supporting", "other"].map((kind) => (
                      <option key={kind} value={kind}>{titleCase(kind)}</option>
                    ))}
                  </select>
                  <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                    <Plus className="h-4 w-4" aria-hidden />
                    Add link
                  </button>
                </form>
              </div>
            ) : null}
          </div>
          <div className="sticky bottom-0 space-y-2 border-t bg-white p-4">
            <select
              value=""
              onChange={(event) => {
                const next = event.target.value as DealStage | "";
                if (next) void onMoveStage(next);
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="" disabled>
                {TERMINAL_STAGES.has(deal.stage)
                  ? `Reopen ${stageLabel(deal.stage)} deal to...`
                  : `Move from ${stageLabel(deal.stage)} to...`}
              </option>
              {DEAL_STAGES.filter(
                (stage) =>
                  OPEN_STAGES.has(stage.id) && stage.id !== deal.stage
              ).map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {TERMINAL_STAGES.has(deal.stage)
                    ? `Reopen to ${stage.label}`
                    : `Move to ${stage.label}`}
                </option>
              ))}
            </select>
            {TERMINAL_STAGES.has(deal.stage) ? (
              <p className="text-xs text-slate-500">
                Reopening rewinds the close: lead status reverts and (for Won
                deals) the property goes back to Active and the campaign
                conversion is decremented.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onMarkWon}
                disabled={!OPEN_STAGES.has(deal.stage)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:bg-slate-300"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Mark Won
              </button>
              <button
                type="button"
                onClick={onMarkLost}
                disabled={!OPEN_STAGES.has(deal.stage)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" aria-hidden />
                Mark Lost
              </button>
            </div>
            {OPEN_STAGES.has(deal.stage) ? (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={lostReason}
                  onChange={(event) => setLostReason(event.target.value)}
                  className="rounded-lg border px-3 py-2 text-xs"
                >
                  {[
                    "budget",
                    "financing_denied",
                    "chose_competitor",
                    "property_issue",
                    "lead_unresponsive",
                    "agent_decision",
                    "other",
                  ].map((reason) => (
                    <option key={reason} value={reason}>
                      {titleCase(reason)}
                    </option>
                  ))}
                </select>
                <input
                  value={lostNotes}
                  onChange={(event) => setLostNotes(event.target.value)}
                  placeholder="Lost notes"
                  className="rounded-lg border px-3 py-2 text-xs"
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </aside>
  );
}

function StageBadge({ stage }: { stage: DealStage }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {stageLabel(stage)}
    </span>
  );
}

function EntityCard({
  title,
  primary,
  secondary,
}: {
  title: string;
  primary: string;
  secondary?: string | null;
}) {
  return (
    <section className="rounded-xl border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p className="mt-1 font-medium text-slate-900">{primary}</p>
      {secondary ? <p className="mt-1 text-sm text-slate-500">{secondary}</p> : null}
    </section>
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
    <section className="rounded-xl border p-3">
      <h4 className="mb-3 text-sm font-semibold text-slate-900">{title}</h4>
      {children}
    </section>
  );
}

function KeyValue({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "font-semibold text-slate-900" : "text-slate-700"}>
        {value}
      </span>
    </div>
  );
}
