"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Home,
  Mail,
  Pencil,
  Phone,
  RefreshCcw,
  Star,
  Target,
  UserRound,
  UserX,
  Users,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { Fragment, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { CreateDealModal, WinDealModal } from "@/components/close-deal-modal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type CalendarMode = "month" | "week" | "day";
type DrawerTab = "overview" | "follow-up" | "activity";
type DateRangeValue = "" | "today" | "week" | "month" | "quarter";
type FollowUpStatus = "pending" | "done" | "cancelled";
type ListingType = "Sale" | "Rental" | "Both";

type UserOption = {
  id: string;
  email: string;
  full_name: string;
};

type ViewingLead = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  preferred_property_type?: string | null;
  preferred_location?: string | null;
  budget_min?: number | string | null;
  budget_max?: number | string | null;
};

type ViewingProperty = {
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

type ConvertedDeal = {
  id: string;
  sale_price?: string | number | null;
  commission_total?: string | number | null;
  stage?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
};

type Viewing = {
  id: string;
  lead_id: string;
  property_id: string;
  assigned_ren_id: string;
  scheduled_at: string;
  status: string;
  interest_level?: number | null;
  notes?: string | null;
  completed_at?: string | null;
  follow_up_at?: string | null;
  follow_up_status?: FollowUpStatus | null;
  cancellation_reason?: string | null;
  cancellation_notes?: string | null;
  cancelled_at?: string | null;
  lead?: ViewingLead | null;
  property?: ViewingProperty | null;
  assigned_ren?: UserOption | null;
  converted_deal?: ConvertedDeal | null;
};

type KpiCardData = {
  id: string;
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  iconClass: string;
};

const DRAWER_TABS: DrawerTab[] = ["overview", "follow-up", "activity"];
const CALENDAR_MODES: CalendarMode[] = ["month", "week", "day"];
const PAGE_SIZE = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_SLOTS = Array.from({ length: 11 }, (_, index) => index + 8);
const DATE_RANGE_OPTIONS: { value: DateRangeValue; label: string }[] = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function timeLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:00 ${suffix}`;
}

function dateRangeStart(value: DateRangeValue): Date | null {
  const now = new Date();
  if (value === "today") return startOfDay(now);
  if (value === "week") {
    return startOfDay(addDays(now, -now.getDay()));
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

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

const INTEREST_MAX = 5;
const INTEREST_LABELS: Record<number, string> = {
  1: "Not Interested",
  2: "Slightly Interested",
  3: "Interested",
  4: "Very Interested",
  5: "Ready to Buy",
};

function interestLabel(level?: number | null) {
  const value = Number(level ?? 0);
  return INTEREST_LABELS[value] ?? "Not rated";
}

function interestStars(level?: number | null) {
  const active = Math.max(0, Math.min(INTEREST_MAX, Number(level ?? 0)));
  return `${"★".repeat(active)}${"☆".repeat(INTEREST_MAX - active)}`;
}

function statusBadgeClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "cancelled") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-blue-50 text-blue-700 ring-blue-200";
}

function followUpBadgeClass(status?: string | null, followUpAt?: string | null) {
  if (status === "done") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "cancelled") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (followUpAt && startOfDay(new Date(followUpAt)) < startOfDay(new Date())) {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}

function weekStart(date: Date) {
  return startOfDay(addDays(date, -date.getDay()));
}

function monthGridDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function viewingsForDate(viewings: Viewing[], date: Date) {
  return viewings.filter((viewing) => isSameDay(new Date(viewing.scheduled_at), date));
}

function dueFollowUpsForDate(viewings: Viewing[], date: Date) {
  return viewings.filter(
    (viewing) =>
      viewing.follow_up_status === "pending" &&
      viewing.follow_up_at &&
      isSameDay(new Date(viewing.follow_up_at), date)
  );
}

function computeKpis(viewings: Viewing[]): KpiCardData[] {
  const now = new Date();
  const completed = viewings.filter((viewing) => viewing.status === "completed");
  const rated = completed.filter((viewing) => viewing.interest_level);
  const averageInterest = rated.length
    ? rated.reduce((sum, viewing) => sum + Number(viewing.interest_level ?? 0), 0) /
      rated.length
    : 0;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const cancelled = viewings.filter((viewing) => viewing.status === "cancelled");
  const noShows = cancelled.filter(
    (viewing) => viewing.cancellation_reason === "no_show"
  ).length;
  const completedThisMonth = completed.filter(
    (viewing) =>
      viewing.completed_at && new Date(viewing.completed_at).getTime() >= monthStart.getTime()
  ).length;
  const conversionBase = completed.length;
  const converted = completed.filter((viewing) => viewing.converted_deal).length;
  return [
    {
      id: "today",
      label: "Today",
      value: String(viewingsForDate(viewings, now).length),
      helper: "Scheduled for today",
      icon: CalendarDays,
      iconClass: "bg-blue-50 text-blue-600",
    },
    {
      id: "interest",
      label: "Avg Interest",
      value: averageInterest ? `${averageInterest.toFixed(1)} / ${INTEREST_MAX}` : "-",
      helper: "Completed ratings",
      icon: Star,
      iconClass: "bg-amber-50 text-amber-600",
    },
    {
      id: "cancelled",
      label: "Cancelled / No-show",
      value: String(cancelled.length),
      helper: `${noShows} no-show${noShows === 1 ? "" : "s"}`,
      icon: XCircle,
      iconClass: "bg-red-50 text-red-600",
    },
    {
      id: "completed",
      label: "Completed This Month",
      value: String(completedThisMonth),
      helper: "Current calendar month",
      icon: CheckCircle2,
      iconClass: "bg-emerald-50 text-emerald-600",
    },
    {
      id: "conversion",
      label: "Conversion Rate",
      value: conversionBase ? `${Math.round((converted / conversionBase) * 100)}%` : "-",
      helper: `${converted} converted deals`,
      icon: Target,
      iconClass: "bg-purple-50 text-purple-600",
    },
  ];
}

function viewingSearchText(viewing: Viewing) {
  return [
    viewing.lead?.name,
    viewing.lead?.phone,
    viewing.lead?.email,
    viewing.property?.name,
    viewing.property?.type,
    viewing.property?.city,
    viewing.property?.state,
    viewing.assigned_ren?.full_name,
    viewing.assigned_ren?.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function ViewingsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [selectedViewing, setSelectedViewing] = useState<Viewing | null>(null);
  const [teamUsers, setTeamUsers] = useState<UserOption[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [agentId, setAgentId] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>("");
  const [followUpStatus, setFollowUpStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(
    (searchParams.get("calendar") as CalendarMode) || "month"
  );
  const [selectedDate, setSelectedDate] = useState(
    searchParams.get("date") ? new Date(`${searchParams.get("date")}T00:00`) : new Date()
  );
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [completeInterest, setCompleteInterest] = useState("2");
  const [completeNotes, setCompleteNotes] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [cancelReason, setCancelReason] = useState("lead_cancelled");
  const [cancelNotes, setCancelNotes] = useState("");
  const [startDealOpen, setStartDealOpen] = useState(false);
  const [closeNowOpen, setCloseNowOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingInterest, setSavingInterest] = useState(false);
  const [interestSavedAt, setInterestSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const selectedViewingId = searchParams.get("viewing");
  const selectedTab = searchParams.get("tab") as DrawerTab | null;
  const visibleDateRangeStart = useMemo(
    () => dateRangeStart(dateRange),
    [dateRange]
  );
  const propertyTypes = useMemo(
    () =>
      Array.from(
        new Set(viewings.map((viewing) => viewing.property?.type).filter(Boolean))
      ) as string[],
    [viewings]
  );
  const filteredViewings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return viewings.filter((viewing) => {
      if (needle && !viewingSearchText(viewing).includes(needle)) return false;
      if (status && viewing.status !== status) return false;
      if (agentId && viewing.assigned_ren_id !== agentId) return false;
      if (propertyType && viewing.property?.type !== propertyType) return false;
      if (followUpStatus && viewing.follow_up_status !== followUpStatus) return false;
      if (
        visibleDateRangeStart &&
        new Date(viewing.scheduled_at).getTime() < visibleDateRangeStart.getTime()
      ) {
        return false;
      }
      return true;
    });
  }, [
    viewings,
    query,
    status,
    agentId,
    propertyType,
    followUpStatus,
    visibleDateRangeStart,
  ]);
  const totalPages = showAll
    ? 1
    : Math.max(1, Math.ceil(filteredViewings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedViewings = showAll
    ? filteredViewings
    : filteredViewings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const kpiCards = useMemo(() => computeKpis(viewings), [viewings]);
  const agendaViewings = useMemo(
    () =>
      viewingsForDate(filteredViewings, selectedDate).sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      ),
    [filteredViewings, selectedDate]
  );
  const agendaFollowUps = useMemo(
    () => dueFollowUpsForDate(filteredViewings, selectedDate),
    [filteredViewings, selectedDate]
  );

  useEffect(() => {
    async function loadViewings() {
      const token = await getToken();
      const params = new URLSearchParams();
      if (status) params.set("status_filter", status);
      if (agentId) params.set("assigned_ren_id", agentId);
      if (propertyType) params.set("property_type", propertyType);
      if (followUpStatus) params.set("follow_up_status", followUpStatus);
      if (visibleDateRangeStart) {
        params.set("date_from", visibleDateRangeStart.toISOString());
      }
      const data = await apiFetch<Viewing[]>(
        `/viewings${params.size ? `?${params.toString()}` : ""}`,
        token
      );
      setViewings(data);
      setError(null);
    }

    void loadViewings().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load viewings");
    });
  }, [
    getToken,
    status,
    agentId,
    propertyType,
    followUpStatus,
    visibleDateRangeStart,
  ]);

  useEffect(() => {
    async function loadUsers() {
      const token = await getToken();
      if (!token) return;
      try {
        setTeamUsers(await apiFetch<UserOption[]>("/users", token));
      } catch {
        const currentUser = await apiFetch<UserOption>("/users/me", token);
        setTeamUsers([currentUser]);
      }
    }
    void loadUsers().catch(() => {
      // Non-fatal: agent filtering hides itself if user options are unavailable.
    });
  }, [getToken]);

  useEffect(() => {
    setPage(1);
    setShowAll(false);
  }, [query, status, agentId, propertyType, followUpStatus, dateRange]);

  async function loadSelectedViewing(viewingId: string) {
    setLoadingDetail(true);
    const token = await getToken();
    try {
      const detail = await apiFetch<Viewing>(`/viewings/${viewingId}`, token);
      setSelectedViewing(detail);
      setFollowUpDraft(detail.follow_up_at ? datetimeLocalValue(detail.follow_up_at) : "");
      setError(null);
    } catch (err) {
      setSelectedViewing(null);
      setError(err instanceof Error ? err.message : "Failed to load viewing");
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    setInterestSavedAt(null);
    if (selectedTab && DRAWER_TABS.includes(selectedTab)) {
      setDrawerTab(selectedTab);
    }
    if (!selectedViewingId) {
      setSelectedViewing(null);
      return;
    }
    if (!UUID_PATTERN.test(selectedViewingId)) {
      updateSelection(null);
      return;
    }
    void loadSelectedViewing(selectedViewingId);
    // loadSelectedViewing depends on stable auth and route state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedViewingId, selectedTab, getToken]);

  useEffect(() => {
    const nextDate = searchParams.get("date");
    const nextMode = searchParams.get("calendar") as CalendarMode | null;
    if (nextDate) setSelectedDate(new Date(`${nextDate}T00:00`));
    if (nextMode && CALENDAR_MODES.includes(nextMode)) setCalendarMode(nextMode);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedViewingId) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (drawerRef.current?.contains(target)) return;
      if (target.closest("[data-viewing-row=\"true\"]")) return;
      if (target.closest("[data-conversion-modal=\"true\"]")) return;
      updateSelection(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
    // updateSelection is stable enough for this listener; selectedViewingId guards lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedViewingId]);

  function replaceParams(nextParams: URLSearchParams) {
    router.replace(`/app/viewings${nextParams.size ? `?${nextParams.toString()}` : ""}`);
  }

  function updateSelection(viewingId: string | null, tab = drawerTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (!viewingId) {
      params.delete("viewing");
      params.delete("tab");
    } else {
      params.set("viewing", viewingId);
      params.set("tab", tab);
    }
    replaceParams(params);
  }

  function updateDrawerTab(tab: DrawerTab) {
    setDrawerTab(tab);
    if (selectedViewingId) updateSelection(selectedViewingId, tab);
  }

  function updateCalendar(date: Date, mode = calendarMode) {
    setSelectedDate(date);
    setCalendarMode(mode);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", dateKey(date));
    params.set("calendar", mode);
    replaceParams(params);
  }

  function resetFilters() {
    setQuery("");
    setStatus("");
    setAgentId("");
    setPropertyType("");
    setDateRange("");
    setFollowUpStatus("");
    setPage(1);
    setShowAll(false);
  }

  function scheduleFromSlot(date: Date, hour?: number) {
    const params = new URLSearchParams({
      date: dateKey(date),
    });
    if (hour !== undefined) params.set("time", `${String(hour).padStart(2, "0")}:00`);
    router.push(`/app/viewings/new?${params.toString()}`);
  }

  async function refreshWorkspace() {
    const token = await getToken();
    const data = await apiFetch<Viewing[]>("/viewings", token);
    setViewings(data);
    if (selectedViewingId) await loadSelectedViewing(selectedViewingId);
  }

  async function completeViewing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedViewing) return;
    const token = await getToken();
    try {
      await apiFetch(`/viewings/${selectedViewing.id}/complete`, token, {
        method: "POST",
        body: JSON.stringify({
          interest_level: Number(completeInterest),
          notes: completeNotes || null,
        }),
      });
      setCompleteNotes("");
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete viewing");
    }
  }

  async function updateFollowUp(statusValue?: FollowUpStatus) {
    if (!selectedViewing) return;
    const token = await getToken();
    try {
      await apiFetch(`/viewings/${selectedViewing.id}/follow-up`, token, {
        method: "PATCH",
        body: JSON.stringify({
          follow_up_at: followUpDraft
            ? new Date(followUpDraft).toISOString()
            : selectedViewing.follow_up_at,
          follow_up_status: statusValue ?? "pending",
        }),
      });
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update follow-up");
    }
  }

  async function cancelViewing(overrides?: {
    reason?: string;
    notes?: string | null;
    confirmMessage?: string;
  }) {
    if (!selectedViewing) return;
    const reason = overrides?.reason ?? cancelReason;
    const notes = overrides?.notes ?? cancelNotes ?? null;
    if (overrides?.confirmMessage && !window.confirm(overrides.confirmMessage)) {
      return;
    }
    const token = await getToken();
    try {
      await apiFetch(`/viewings/${selectedViewing.id}/cancel`, token, {
        method: "POST",
        body: JSON.stringify({
          cancellation_reason: reason,
          cancellation_notes: notes || null,
        }),
      });
      if (!overrides) setCancelNotes("");
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel viewing");
    }
  }

  async function updateInterest(level: number) {
    if (!selectedViewing) return;
    const previousViewing = selectedViewing;
    setSavingInterest(true);
    setInterestSavedAt(null);
    setSelectedViewing({ ...selectedViewing, interest_level: level });
    setViewings((current) =>
      current.map((viewing) =>
        viewing.id === selectedViewing.id ? { ...viewing, interest_level: level } : viewing
      )
    );
    const token = await getToken();
    try {
      await apiFetch(`/viewings/${selectedViewing.id}/interest`, token, {
        method: "PATCH",
        body: JSON.stringify({ interest_level: level }),
      });
      if (selectedViewingId) await loadSelectedViewing(selectedViewingId);
      setInterestSavedAt(Date.now());
    } catch (err) {
      setSelectedViewing(previousViewing);
      setError(err instanceof Error ? err.message : "Failed to update interest");
    } finally {
      setSavingInterest(false);
    }
  }

  const conversionLead =
    selectedViewing?.lead && selectedViewing.property
      ? {
          id: selectedViewing.lead.id,
          name: selectedViewing.lead.name ?? "Lead",
          linked_properties: [
            {
              status: "active",
              properties: {
                id: selectedViewing.property.id,
                name: selectedViewing.property.name ?? "Property",
                type: selectedViewing.property.type,
                city: selectedViewing.property.city,
                state: selectedViewing.property.state,
                postcode: selectedViewing.property.postcode,
                listing_type: selectedViewing.property.listing_type ?? "Sale",
                status: selectedViewing.property.status,
                listing_price: selectedViewing.property.listing_price,
                expected_rental: selectedViewing.property.expected_rental,
              },
            },
          ],
        }
      : null;
  const conversionPropertyGroups = conversionLead
    ? [
        {
          label: "Viewing property",
          options: conversionLead.linked_properties.map((link) => ({
            value: link.properties.id,
            label: link.properties.name,
            description: [
              link.properties.type,
              link.properties.city,
              link.properties.state,
            ]
              .filter(Boolean)
              .join(" · "),
            badge: link.properties.listing_type,
          })),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <KpiCard key={card.id} card={card} />
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Calendar & Daily Agenda
            </h3>
            <p className="text-sm text-slate-500">
              {selectedDate.toLocaleDateString("en-MY", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateCalendar(
                  calendarMode === "month"
                    ? new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
                    : addDays(selectedDate, calendarMode === "week" ? -7 : -1)
                )
              }
              className="rounded-lg border p-2"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() =>
                updateCalendar(
                  calendarMode === "month"
                    ? new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1)
                    : addDays(selectedDate, calendarMode === "week" ? 7 : 1)
                )
              }
              className="rounded-lg border p-2"
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => updateCalendar(new Date())}
              className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium"
            >
              Today
            </button>
            <div className="flex rounded-lg border bg-slate-50 p-1">
              {CALENDAR_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateCalendar(selectedDate, mode)}
                  className={[
                    "rounded-md px-3 py-1.5 text-xs font-medium capitalize",
                    calendarMode === mode
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500",
                  ].join(" ")}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-0 xl:grid-cols-[55fr_45fr]">
          <div className="border-b p-4 xl:border-b-0 xl:border-r">
            {calendarMode === "month" ? (
              <MonthCalendar
                selectedDate={selectedDate}
                viewings={filteredViewings}
                onSelectDate={(date) => updateCalendar(date)}
                onSelectViewing={(viewingId) => updateSelection(viewingId)}
                onSchedule={scheduleFromSlot}
              />
            ) : (
              <TimeGridCalendar
                mode={calendarMode}
                selectedDate={selectedDate}
                viewings={filteredViewings}
                onSelectDate={(date) => updateCalendar(date)}
                onSelectViewing={(viewingId) => updateSelection(viewingId)}
                onSchedule={scheduleFromSlot}
              />
            )}
          </div>
          <DailyAgenda
            selectedDate={selectedDate}
            viewings={agendaViewings}
            followUps={agendaFollowUps}
            onSelectViewing={updateSelection}
          />
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lead, property, agent"
            className="min-h-11 min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All agents</option>
            {teamUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>
          <select
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All property types</option>
            {propertyTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value as DateRangeValue)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            {DATE_RANGE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={followUpStatus}
            onChange={(event) => setFollowUpStatus(event.target.value)}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All follow-ups</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
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
        <div className="grid grid-cols-[0.8fr_1.2fr_1.3fr_0.9fr_0.8fr_0.7fr_0.9fr_0.5fr] gap-4 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Schedule</span>
          <span>Lead</span>
          <span>Property</span>
          <span>Agent</span>
          <span>Status</span>
          <span>Interest</span>
          <span>Follow-up</span>
          <span>Actions</span>
        </div>
        {paginatedViewings.map((viewing) => {
          const selected = selectedViewingId === viewing.id;
          return (
            <button
              key={viewing.id}
              type="button"
              data-viewing-row="true"
              onClick={() => updateSelection(viewing.id)}
              className={[
                "grid w-full grid-cols-[0.8fr_1.2fr_1.3fr_0.9fr_0.8fr_0.7fr_0.9fr_0.5fr] items-center gap-4 border-b px-4 py-4 text-left text-sm transition last:border-b-0 hover:bg-slate-50",
                selected ? "bg-blue-50/60 ring-1 ring-inset ring-blue-200" : "",
              ].join(" ")}
            >
              <span>
                <span className="block font-medium text-slate-900">
                  {formatDate(viewing.scheduled_at)}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(viewing.scheduled_at).toLocaleTimeString("en-MY", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">
                  {viewing.lead?.name ?? "Unknown lead"}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {viewing.lead?.phone ?? viewing.lead?.email ?? viewing.lead_id}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">
                  {viewing.property?.name ?? "Unknown property"}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {[viewing.property?.type, viewing.property?.city]
                    .filter(Boolean)
                    .join(" · ") || viewing.property_id}
                </span>
              </span>
              <span className="truncate text-slate-700">
                {viewing.assigned_ren?.full_name ?? viewing.assigned_ren_id}
              </span>
              <span>
                <StatusBadge status={viewing.status} />
              </span>
              <span className="font-medium text-amber-600">
                {interestStars(viewing.interest_level)}
              </span>
              <span>
                {viewing.follow_up_at ? (
                  <span
                    className={[
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                      followUpBadgeClass(viewing.follow_up_status, viewing.follow_up_at),
                    ].join(" ")}
                  >
                    {formatDate(viewing.follow_up_at)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">-</span>
                )}
              </span>
              <span className="text-xs font-medium text-slate-500">Open</span>
            </button>
          );
        })}
        {!filteredViewings.length ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-900">No viewings found.</p>
            <p className="mt-1 text-sm text-slate-500">
              Schedule a viewing or adjust filters to see more appointments.
            </p>
          </div>
        ) : null}
        {filteredViewings.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span>
              Showing {showAll ? filteredViewings.length : paginatedViewings.length} of{" "}
              {filteredViewings.length} viewings
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

      {selectedViewingId ? (
        <ViewingDrawer
          containerRef={drawerRef}
          viewing={selectedViewing}
          loading={loadingDetail}
          tab={drawerTab}
          completeInterest={completeInterest}
          setCompleteInterest={setCompleteInterest}
          completeNotes={completeNotes}
          setCompleteNotes={setCompleteNotes}
          followUpDraft={followUpDraft}
          setFollowUpDraft={setFollowUpDraft}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          cancelNotes={cancelNotes}
          setCancelNotes={setCancelNotes}
          onTabChange={updateDrawerTab}
          onClose={() => updateSelection(null)}
          onComplete={completeViewing}
          onFollowUpUpdate={updateFollowUp}
          onCancel={(overrides) => void cancelViewing(overrides)}
          onStartNegotiating={() => setStartDealOpen(true)}
          onCloseNow={() => setCloseNowOpen(true)}
          onInterestChange={(level) => void updateInterest(level)}
          savingInterest={savingInterest}
          interestSavedAt={interestSavedAt}
        />
      ) : null}

      {conversionLead && selectedViewing ? (
        <CreateDealModal
          open={startDealOpen}
          lead={conversionLead}
          propertyGroups={conversionPropertyGroups}
          preselectedPropertyId={selectedViewing.property_id}
          originViewingId={selectedViewing.id}
          initialNotes={selectedViewing.notes}
          onClose={() => setStartDealOpen(false)}
          onComplete={async () => {
            setStartDealOpen(false);
            await refreshWorkspace();
          }}
          getToken={getToken}
        />
      ) : null}

      {conversionLead && selectedViewing ? (
        <WinDealModal
          open={closeNowOpen}
          lead={conversionLead}
          propertyGroups={conversionPropertyGroups}
          preselectedPropertyId={selectedViewing.property_id}
          originViewingId={selectedViewing.id}
          onClose={() => setCloseNowOpen(false)}
          onComplete={async () => {
            setCloseNowOpen(false);
            await refreshWorkspace();
          }}
          getToken={getToken}
        />
      ) : null}
    </div>
  );
}

function datetimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
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
        <p className="mt-1 truncate text-xs text-slate-400">{card.helper}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1",
        statusBadgeClass(status),
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function MonthCalendar({
  selectedDate,
  viewings,
  onSelectDate,
  onSelectViewing,
  onSchedule,
}: {
  selectedDate: Date;
  viewings: Viewing[];
  onSelectDate: (date: Date) => void;
  onSelectViewing: (viewingId: string) => void;
  onSchedule: (date: Date) => void;
}) {
  const days = monthGridDays(selectedDate);
  const today = new Date();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayViewings = viewingsForDate(viewings, day);
          const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
          const isSelected = isSameDay(day, selectedDate);
          return (
            <div
              key={dateKey(day)}
              className={[
                "min-h-28 rounded-lg border p-2 text-left transition",
                isCurrentMonth ? "bg-white" : "bg-slate-50 text-slate-400",
                isSelected ? "ring-2 ring-blue-200" : "",
                isSameDay(day, today) ? "border-blue-300" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onSelectDate(day)}
                  className="text-sm font-semibold"
                >
                  {day.getDate()}
                </button>
                <button
                  type="button"
                  onClick={() => onSchedule(day)}
                  className="rounded px-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Schedule viewing"
                >
                  +
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {dayViewings.slice(0, 3).map((viewing) => (
                  <button
                    key={viewing.id}
                    type="button"
                    onClick={() => onSelectViewing(viewing.id)}
                    className="block w-full truncate rounded bg-slate-50 px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-blue-50"
                  >
                    {new Date(viewing.scheduled_at).toLocaleTimeString("en-MY", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    {viewing.lead?.name ?? "Viewing"}
                  </button>
                ))}
                {dayViewings.length > 3 ? (
                  <p className="px-2 text-[11px] text-slate-400">
                    +{dayViewings.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <LegendDot className="bg-blue-500" label="Scheduled" />
        <LegendDot className="bg-emerald-500" label="Completed" />
        <LegendDot className="bg-amber-500" label="Follow-up" />
        <LegendDot className="bg-slate-400" label="Cancelled" />
      </div>
    </div>
  );
}

function TimeGridCalendar({
  mode,
  selectedDate,
  viewings,
  onSelectDate,
  onSelectViewing,
  onSchedule,
}: {
  mode: CalendarMode;
  selectedDate: Date;
  viewings: Viewing[];
  onSelectDate: (date: Date) => void;
  onSelectViewing: (viewingId: string) => void;
  onSchedule: (date: Date, hour: number) => void;
}) {
  const days =
    mode === "week"
      ? Array.from({ length: 7 }, (_, index) => addDays(weekStart(selectedDate), index))
      : [selectedDate];
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[720px] border-l border-t"
        style={{ gridTemplateColumns: `88px repeat(${days.length}, minmax(120px, 1fr))` }}
      >
        <div className="border-b border-r bg-slate-50 p-2 text-xs font-medium text-slate-500">
          Time
        </div>
        {days.map((day) => (
          <button
            key={dateKey(day)}
            type="button"
            onClick={() => onSelectDate(day)}
            className={[
              "border-b border-r bg-slate-50 p-2 text-left text-xs font-semibold",
              isSameDay(day, selectedDate) ? "text-blue-700" : "text-slate-600",
            ].join(" ")}
          >
            {day.toLocaleDateString("en-MY", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            })}
          </button>
        ))}
        {TIME_SLOTS.map((hour) => (
          <Fragment key={hour}>
            <div className="border-b border-r bg-slate-50 p-2 text-xs text-slate-400">
              {timeLabel(hour)}
            </div>
            {days.map((day) => {
              const slotViewings = viewingsForDate(viewings, day).filter(
                (viewing) => new Date(viewing.scheduled_at).getHours() === hour
              );
              return (
                <div key={`${dateKey(day)}-${hour}`} className="min-h-20 border-b border-r p-1">
                  {slotViewings.map((viewing) => (
                    <button
                      key={viewing.id}
                      type="button"
                      onClick={() => onSelectViewing(viewing.id)}
                      className="mb-1 block w-full rounded-lg border bg-white p-2 text-left text-xs shadow-sm hover:bg-blue-50"
                    >
                      <span className="block truncate font-medium text-slate-900">
                        {viewing.lead?.name ?? "Viewing"}
                      </span>
                      <span className="block truncate text-slate-500">
                        {viewing.property?.name ?? viewing.property_id}
                      </span>
                      <span className="mt-1 block text-amber-600">
                        {interestStars(viewing.interest_level)}
                      </span>
                    </button>
                  ))}
                  {!slotViewings.length ? (
                    <button
                      type="button"
                      onClick={() => onSchedule(day, hour)}
                      className="flex h-full min-h-14 w-full items-center justify-center rounded-lg text-xs text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                    >
                      + Schedule
                    </button>
                  ) : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function DailyAgenda({
  selectedDate,
  viewings,
  followUps,
  onSelectViewing,
}: {
  selectedDate: Date;
  viewings: Viewing[];
  followUps: Viewing[];
  onSelectViewing: (viewingId: string) => void;
}) {
  return (
    <aside className="space-y-4 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-slate-900">Daily Agenda</h4>
          <p className="text-sm text-slate-500">
            {selectedDate.toLocaleDateString("en-MY", {
              weekday: "long",
              day: "2-digit",
              month: "short",
            })}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
          {viewings.length} viewing{viewings.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-3">
        {viewings.map((viewing) => (
          <button
            key={viewing.id}
            type="button"
            onClick={() => onSelectViewing(viewing.id)}
            className="w-full rounded-xl border bg-white p-3 text-left shadow-sm hover:bg-blue-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {new Date(viewing.scheduled_at).toLocaleTimeString("en-MY", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {viewing.lead?.name ?? "Unknown lead"}
                </p>
                <p className="text-xs text-slate-500">
                  {viewing.property?.name ?? viewing.property_id}
                </p>
              </div>
              <StatusBadge status={viewing.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="font-medium text-amber-600">
                {interestStars(viewing.interest_level)} {interestLabel(viewing.interest_level)}
              </span>
              <span className="text-slate-400">
                {viewing.assigned_ren?.full_name ?? "Agent"}
              </span>
            </div>
          </button>
        ))}
        {!viewings.length ? (
          <div className="rounded-xl border border-dashed bg-white p-5 text-center text-sm text-slate-500">
            No appointments on this date.
          </div>
        ) : null}
      </div>
      <div className="rounded-xl border bg-white p-3">
        <h5 className="text-sm font-semibold text-slate-900">
          Follow-ups due today
        </h5>
        <div className="mt-3 space-y-2">
          {followUps.map((viewing) => (
            <button
              key={viewing.id}
              type="button"
              onClick={() => onSelectViewing(viewing.id)}
              className="flex w-full items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-900"
            >
              <span className="truncate">
                {viewing.lead?.name ?? "Lead"} - {viewing.property?.name ?? "Property"}
              </span>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
          ))}
          {!followUps.length ? (
            <p className="text-xs text-slate-500">No follow-ups due on this date.</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function ViewingDrawer({
  containerRef,
  viewing,
  loading,
  tab,
  completeInterest,
  setCompleteInterest,
  completeNotes,
  setCompleteNotes,
  followUpDraft,
  setFollowUpDraft,
  cancelReason,
  setCancelReason,
  cancelNotes,
  setCancelNotes,
  onTabChange,
  onClose,
  onComplete,
  onFollowUpUpdate,
  onCancel,
  onStartNegotiating,
  onCloseNow,
  onInterestChange,
  savingInterest,
  interestSavedAt,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  viewing: Viewing | null;
  loading: boolean;
  tab: DrawerTab;
  completeInterest: string;
  setCompleteInterest: (value: string) => void;
  completeNotes: string;
  setCompleteNotes: (value: string) => void;
  followUpDraft: string;
  setFollowUpDraft: (value: string) => void;
  cancelReason: string;
  setCancelReason: (value: string) => void;
  cancelNotes: string;
  setCancelNotes: (value: string) => void;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  onComplete: (event: FormEvent<HTMLFormElement>) => void;
  onFollowUpUpdate: (status?: FollowUpStatus) => void;
  onCancel: (overrides?: {
    reason?: string;
    notes?: string | null;
    confirmMessage?: string;
  }) => void;
  onStartNegotiating: () => void;
  onCloseNow: () => void;
  onInterestChange: (level: number) => void;
  savingInterest: boolean;
  interestSavedAt: number | null;
}) {
  const cancelled = viewing?.status === "cancelled";
  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    setCurrentTime(Date.now());
  }, []);
  const canComplete =
    viewing?.status === "scheduled" &&
    currentTime > 0 &&
    new Date(viewing.scheduled_at).getTime() <= currentTime;
  return (
    <aside
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-3xl border bg-white shadow-2xl xl:inset-x-auto xl:right-0 xl:top-0 xl:h-screen xl:max-h-none xl:w-[400px] xl:rounded-none"
    >
      {!viewing ? (
        <div className="flex min-h-96 items-center justify-center p-6 text-center text-sm text-slate-500">
          {loading
            ? "Loading viewing..."
            : "Select a viewing to review details, follow-ups, and conversion actions."}
        </div>
      ) : (
        <div className="flex min-h-full flex-col">
          <div className="border-b p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Viewing #{viewing.id.slice(0, 8)}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {formatDateTime(viewing.scheduled_at)}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={viewing.status} />
                  {viewing.cancellation_reason ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
                      {titleCase(viewing.cancellation_reason)}
                    </span>
                  ) : null}
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
                <EntityCard
                  icon={UserRound}
                  title="Lead"
                  primary={viewing.lead?.name ?? viewing.lead_id}
                  secondary={viewing.lead?.phone ?? viewing.lead?.email ?? "-"}
                  meta={viewing.lead?.status ?? undefined}
                />
                <EntityCard
                  icon={Home}
                  title="Property"
                  primary={viewing.property?.name ?? viewing.property_id}
                  secondary={[viewing.property?.type, viewing.property?.city]
                    .filter(Boolean)
                    .join(" · ")}
                  meta={
                    viewing.property?.listing_price
                      ? formatCurrency(viewing.property.listing_price)
                      : undefined
                  }
                />
                <EntityCard
                  icon={Users}
                  title="Assigned Agent"
                  primary={viewing.assigned_ren?.full_name ?? viewing.assigned_ren_id}
                  secondary={viewing.assigned_ren?.email ?? "-"}
                />
                <InterestCard
                  level={viewing.interest_level}
                  onChange={onInterestChange}
                  saving={savingInterest}
                  saved={Boolean(interestSavedAt)}
                />
                <InfoCard title="Notes">
                  <p className="text-sm text-slate-600">{viewing.notes ?? "No notes yet."}</p>
                </InfoCard>
              </>
            ) : null}
            {tab === "follow-up" ? (
              <div className="space-y-4">
                <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Follow-up Recommendation
                      </p>
                      <p className="mt-1 text-sm text-amber-800">
                        {viewing.follow_up_at
                          ? `Recommended ${formatDateTime(viewing.follow_up_at)}`
                          : "Complete this viewing to generate a recommendation."}
                      </p>
                    </div>
                    {viewing.follow_up_status ? (
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                          followUpBadgeClass(
                            viewing.follow_up_status,
                            viewing.follow_up_at
                          ),
                        ].join(" ")}
                      >
                        {viewing.follow_up_status}
                      </span>
                    ) : null}
                  </div>
                </section>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Follow-up date
                  </span>
                  <input
                    type="datetime-local"
                    value={followUpDraft}
                    onChange={(event) => setFollowUpDraft(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onFollowUpUpdate("pending")}
                    className="rounded-lg border px-3 py-2 text-xs font-medium"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => onFollowUpUpdate("done")}
                    className="rounded-lg border px-3 py-2 text-xs font-medium"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => onFollowUpUpdate("cancelled")}
                    className="rounded-lg border px-3 py-2 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
                {canComplete ? (
                  <form onSubmit={onComplete} className="space-y-3 rounded-xl border p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Complete Viewing
                    </p>
                    <select
                      value={completeInterest}
                      onChange={(event) => setCompleteInterest(event.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      {[1, 2, 3, 4, 5].map((level) => (
                        <option key={level} value={String(level)}>
                          {`${level} star${level === 1 ? "" : "s"} - ${
                            INTEREST_LABELS[level]
                          }`}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={completeNotes}
                      onChange={(event) => setCompleteNotes(event.target.value)}
                      placeholder="Viewing outcome notes"
                      className="min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                    >
                      Complete viewing
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
            {tab === "activity" ? (
              <div className="space-y-4">
                <InfoCard title="Workflow Progress">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    {["Scheduled", "Completed", "Follow-up", "Conversion"].map(
                      (stage) => (
                        <div key={stage} className="rounded-lg border p-2">
                          <div
                            className={[
                              "mx-auto mb-2 h-2 w-2 rounded-full",
                              workflowStageComplete(stage, viewing)
                                ? "bg-emerald-500"
                                : "bg-slate-200",
                            ].join(" ")}
                          />
                          {stage}
                        </div>
                      )
                    )}
                  </div>
                </InfoCard>
                <InfoCard title="Cancellation Notes">
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      Use the Cancel or No-show buttons in the drawer footer for
                      quick actions. Add a detailed reason and notes here when
                      cancelling.
                    </p>
                    <select
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="lead_cancelled">Lead cancelled</option>
                      <option value="agent_cancelled">Agent cancelled</option>
                      <option value="no_show">No-show</option>
                      <option value="other">Other</option>
                    </select>
                    <textarea
                      value={cancelNotes}
                      onChange={(event) => setCancelNotes(event.target.value)}
                      placeholder="Cancellation notes"
                      className="min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => onCancel()}
                      disabled={cancelled}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel viewing with notes
                    </button>
                  </div>
                </InfoCard>
              </div>
            ) : null}
          </div>
          <div className="sticky bottom-0 space-y-2 border-t bg-white p-4">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/app/viewings/new?edit=${viewing.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Edit
              </Link>
              <Link
                href={`/app/viewings/new?edit=${viewing.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
              >
                <RefreshCcw className="h-4 w-4" aria-hidden />
                Reschedule
              </Link>
              <a
                href={viewing.lead?.phone ? `tel:${viewing.lead.phone}` : "#"}
                className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
              >
                <Phone className="h-4 w-4" aria-hidden />
                Call
              </a>
              <a
                href={viewing.lead?.email ? `mailto:${viewing.lead.email}` : "#"}
                className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Email
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={cancelled}
                onClick={() =>
                  onCancel({
                    reason: "lead_cancelled",
                    notes: null,
                    confirmMessage:
                      "Cancel this viewing? You can capture a detailed reason in the Activity tab.",
                  })
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" aria-hidden />
                Cancel
              </button>
              <button
                type="button"
                disabled={cancelled}
                onClick={() =>
                  onCancel({
                    reason: "no_show",
                    notes: null,
                    confirmMessage: "Mark this viewing as a no-show?",
                  })
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserX className="h-4 w-4" aria-hidden />
                No-show
              </button>
            </div>
            {viewing.converted_deal ? (
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-center text-sm font-medium text-slate-600">
                Deal converted
                {viewing.converted_deal.stage
                  ? ` · ${titleCase(viewing.converted_deal.stage)}`
                  : ""}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onStartNegotiating}
                  disabled={viewing.status !== "completed"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                >
                  <Handshake className="h-4 w-4" aria-hidden />
                  Start negotiating
                </button>
                <button
                  type="button"
                  onClick={onCloseNow}
                  disabled={viewing.status !== "completed"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Close now
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function workflowStageComplete(stage: string, viewing: Viewing) {
  if (stage === "Scheduled") return true;
  if (stage === "Completed") return viewing.status === "completed" || Boolean(viewing.completed_at);
  if (stage === "Follow-up") return viewing.follow_up_status === "done";
  if (stage === "Conversion") return Boolean(viewing.converted_deal);
  return false;
}

function EntityCard({
  icon: Icon,
  title,
  primary,
  secondary,
  meta,
}: {
  icon: LucideIcon;
  title: string;
  primary: string;
  secondary?: string;
  meta?: string;
}) {
  return (
    <section className="rounded-xl border p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {title}
          </p>
          <p className="mt-1 truncate font-medium text-slate-900">{primary}</p>
          {secondary ? (
            <p className="mt-1 truncate text-sm text-slate-500">{secondary}</p>
          ) : null}
          {meta ? <p className="mt-1 text-xs text-slate-400">{meta}</p> : null}
        </div>
      </div>
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

function InterestCard({
  level,
  onChange,
  saving,
  saved,
}: {
  level?: number | null;
  onChange: (next: number) => void;
  saving: boolean;
  saved: boolean;
}) {
  const current = Math.max(0, Math.min(INTEREST_MAX, Number(level ?? 0)));
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? current;
  const cardRef = useRef<HTMLElement | null>(null);

  function saveRating(next: number) {
    if (saving || next === current) return;
    onChange(next);
  }

  function saveFromCardClick(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relativeX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const next = Math.max(
      1,
      Math.min(INTEREST_MAX, Math.ceil((relativeX / rect.width) * INTEREST_MAX))
    );
    saveRating(next);
  }

  return (
    <section
      ref={cardRef}
      onClick={saveFromCardClick}
      className="cursor-pointer rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-amber-900">Customer Interest</p>
        {current > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
            {current} / {INTEREST_MAX}
          </span>
        ) : null}
      </div>
      <div
        role="radiogroup"
        aria-label="Customer interest rating"
        className="mt-2 flex items-center gap-1"
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: INTEREST_MAX }, (_, index) => {
          const value = index + 1;
          const active = value <= display;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={value === current}
              aria-label={`${value} star${value === 1 ? "" : "s"} - ${INTEREST_LABELS[value]}`}
              onMouseEnter={() => setHover(value)}
              onFocus={() => setHover(value)}
              onBlur={() => setHover(null)}
              onClick={() => saveRating(value)}
              disabled={saving}
              className="rounded-full p-1 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-wait disabled:opacity-70"
            >
              <Star
                className={[
                  "h-7 w-7",
                  active
                    ? "fill-amber-500 text-amber-500"
                    : "fill-transparent text-amber-300",
                ].join(" ")}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-sm text-amber-800">
        {display > 0 ? INTEREST_LABELS[display] : "Not rated yet"}
      </p>
      <p className="mt-2 text-xs font-medium text-amber-700">
        {saving ? "Saving rating..." : saved ? "Rating saved" : "Click a star to save"}
      </p>
    </section>
  );
}
