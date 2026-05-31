"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarPlus,
  Camera,
  CheckCircle2,
  Copy,
  Home,
  ImagePlus,
  Layers3,
  Minus,
  Pencil,
  RefreshCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { apiFetch } from "@/lib/api";
import { MALAYSIAN_STATES, propertyAddressSummary } from "@/lib/malaysia-areas";
import {
  PROPERTY_TYPES,
  canonicalPropertyType,
  propertyTypeLabel,
} from "@/lib/property-types";
import { resolvePropertyImage } from "@/lib/property-stock";
import { useAuth } from "@/lib/use-auth";

type ListingType = "Sale" | "Rental" | "Both";
type DrawerTab = "overview" | "details" | "images" | "timeline" | "activity";
type DateRangeValue = "" | "today" | "week" | "month" | "quarter";

type PropertyImage = {
  id: string;
  storage_path: string;
  is_cover: boolean;
  sort_order: number;
};

type TeamUser = {
  id: string;
  full_name: string;
  email: string;
};

type CurrentUser = {
  id: string;
  role?: string | null;
};

type PropertyRow = {
  id: string;
  name: string;
  type: string;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city: string;
  state: string;
  postcode: string;
  price: number;
  listing_type: ListingType;
  market_value?: number | null;
  listing_price?: number | null;
  expected_rental?: number | null;
  year_built?: number | null;
  maintenance_fee?: number | null;
  status: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  parking?: number | null;
  furnishing?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  cover_image_url?: string | null;
  image_count?: number | null;
  ren?: {
    email: string;
    full_name: string;
  } | null;
};

type PropertyDetail = PropertyRow & {
  images: PropertyImage[];
};

type KpiCard = {
  id: "total" | "active" | "pending" | "inactive";
  label: string;
  value: string;
  trend: number | null;
  icon: LucideIcon;
  iconClass: string;
};

const DRAWER_TABS: DrawerTab[] = [
  "overview",
  "details",
  "images",
  "timeline",
  "activity",
];
const DATE_RANGE_OPTIONS: { value: DateRangeValue; label: string }[] = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
];
const PAGE_SIZE = 20;
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function money(value: number | string | null | undefined) {
  if (value == null || value === "") return "-";
  return `RM ${Number(value).toLocaleString("en-MY")}`;
}

function primaryPrice(property: PropertyRow) {
  if (property.listing_type === "Rental") {
    return property.expected_rental ?? property.price;
  }
  return property.listing_price ?? property.price;
}

function secondaryPrice(property: PropertyRow) {
  if (property.listing_type === "Both") {
    return `Rent ${money(property.expected_rental)}`;
  }
  if (property.market_value != null) return `Market ${money(property.market_value)}`;
  return property.listing_type;
}

function salePrice(property: PropertyRow) {
  return property.listing_price ?? property.price ?? null;
}

function rentalPrice(property: PropertyRow) {
  return property.expected_rental ?? property.price ?? null;
}

function priceColumnLabel(listingType: string) {
  if (listingType === "Sale") return "Selling Price";
  if (listingType === "Rental") return "Rental Price";
  return "Price";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function monthRange(monthsAgo: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);
  return { start, end };
}

function inRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function dateRangeBounds(value: DateRangeValue) {
  if (!value) return null;
  const now = new Date();
  const start = new Date(now);
  if (value === "today") start.setHours(0, 0, 0, 0);
  if (value === "week") start.setDate(now.getDate() - 7);
  if (value === "month") start.setMonth(now.getMonth() - 1);
  if (value === "quarter") start.setMonth(now.getMonth() - 3);
  return { start, end: now };
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? null : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function statusBadgeClass(status: string) {
  if (status === "Active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Pending") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function listingBadgeClass(listingType: ListingType) {
  if (listingType === "Sale") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (listingType === "Rental") return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-violet-50 text-violet-700 ring-violet-200";
}

function propertyReference(id: string) {
  return `PROP-${id.slice(0, 8).toUpperCase()}`;
}

function computePropertyKpis(properties: PropertyRow[]): KpiCard[] {
  const current = monthRange(0);
  const previous = monthRange(1);
  const scopes = [
    {
      id: "total" as const,
      label: "Total listings",
      predicate: () => true,
      icon: Layers3,
      iconClass: "bg-slate-100 text-slate-700",
    },
    {
      id: "active" as const,
      label: "Active",
      predicate: (property: PropertyRow) => property.status === "Active",
      icon: CheckCircle2,
      iconClass: "bg-emerald-50 text-emerald-600",
    },
    {
      id: "pending" as const,
      label: "Pending",
      predicate: (property: PropertyRow) => property.status === "Pending",
      icon: Building2,
      iconClass: "bg-amber-50 text-amber-600",
    },
    {
      id: "inactive" as const,
      label: "Inactive",
      predicate: (property: PropertyRow) => property.status === "Inactive",
      icon: XCircle,
      iconClass: "bg-slate-100 text-slate-600",
    },
  ];
  return scopes.map((scope) => {
    const filtered = properties.filter(scope.predicate);
    const currentCount = filtered.filter((property) =>
      inRange(property.created_at, current.start, current.end)
    ).length;
    const previousCount = filtered.filter((property) =>
      inRange(property.created_at, previous.start, previous.end)
    ).length;
    return {
      ...scope,
      value: filtered.length.toLocaleString("en-MY"),
      trend: pctChange(currentCount, previousCount),
    };
  });
}

export default function PropertiesPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const drawerRef = useRef<HTMLElement | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [state, setState] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>("");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [newImagePath, setNewImagePath] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedPropertyId = searchParams.get("property");
  const listingType = searchParams.get("listing_type") ?? "";
  const canFilterOwner = currentUser?.role === "MANAGER";
  const kpiCards = useMemo(() => computePropertyKpis(properties), [properties]);
  const totalPages = showAll
    ? 1
    : Math.max(1, Math.ceil(properties.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProperties = showAll
    ? properties
    : properties.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    async function loadSupportingData() {
      const token = await getToken();
      const user = await apiFetch<CurrentUser>("/users/me", token);
      setCurrentUser(user);
      if (user.role === "MANAGER") {
        setTeamUsers(await apiFetch<TeamUser[]>("/users", token));
      }
    }

    void loadSupportingData().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load users");
    });
  }, [getToken]);

  useEffect(() => {
    async function loadProperties() {
      const token = await getToken();
      const params = new URLSearchParams();
      const bounds = dateRangeBounds(dateRange);
      if (query) params.set("q", query);
      if (status) params.set("status_filter", status);
      if (propertyType) params.set("type_filter", propertyType);
      if (listingType) params.set("listing_type", listingType);
      if (state) params.set("state", state);
      if (canFilterOwner && ownerId) params.set("ren_id", ownerId);
      if (bounds) {
        params.set("created_from", bounds.start.toISOString());
        params.set("created_to", bounds.end.toISOString());
      }
      const data = await apiFetch<PropertyRow[]>(
        `/properties${params.size ? `?${params.toString()}` : ""}`,
        token
      );
      setProperties(data);
      setError(null);
    }

    void loadProperties().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load properties");
    });
  }, [
    getToken,
    query,
    status,
    propertyType,
    listingType,
    state,
    ownerId,
    canFilterOwner,
    dateRange,
  ]);

  async function loadSelectedProperty(propertyId: string) {
    setLoadingDetail(true);
    try {
      const token = await getToken();
      const data = await apiFetch<PropertyDetail>(`/properties/${propertyId}`, token);
      setSelectedProperty(data);
      setError(null);
    } catch (err) {
      setSelectedProperty(null);
      setError(err instanceof Error ? err.message : "Failed to load property");
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && DRAWER_TABS.includes(tab as DrawerTab)) {
      setDrawerTab(tab as DrawerTab);
    }
    if (!selectedPropertyId) {
      setSelectedProperty(null);
      return;
    }
    if (!UUID_PATTERN.test(selectedPropertyId)) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("property");
      params.delete("tab");
      router.replace(`/app/properties${params.size ? `?${params.toString()}` : ""}`);
      return;
    }
    void loadSelectedProperty(selectedPropertyId);
    // loadSelectedProperty depends on stable auth and selected route state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, searchParams, getToken]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (drawerRef.current?.contains(target)) return;
      if ((event.target as HTMLElement).closest("[data-property-row]")) return;
      updateSelection(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
    // updateSelection should use current search params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, searchParams]);

  useEffect(() => {
    setPage(1);
    setShowAll(false);
  }, [query, status, propertyType, listingType, state, ownerId, dateRange]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  function updateSelection(propertyId: string | null, tab = drawerTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (!propertyId) {
      params.delete("property");
      params.delete("tab");
    } else {
      params.set("property", propertyId);
      params.set("tab", tab);
    }
    router.replace(`/app/properties${params.size ? `?${params.toString()}` : ""}`);
  }

  function updateDrawerTab(tab: DrawerTab) {
    setDrawerTab(tab);
    if (selectedPropertyId) updateSelection(selectedPropertyId, tab);
  }

  function resetFilters() {
    setQuery("");
    setStatus("");
    setPropertyType("");
    setState("");
    setOwnerId("");
    setDateRange("");
    setPage(1);
    setShowAll(false);
    router.replace("/app/properties");
  }

  async function refreshSelectedProperty() {
    if (selectedPropertyId) await loadSelectedProperty(selectedPropertyId);
  }

  async function updateStatus(nextStatus: string) {
    if (!selectedProperty) return;
    const token = await getToken();
    await apiFetch(`/properties/${selectedProperty.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    await refreshSelectedProperty();
    setProperties((current) =>
      current.map((property) =>
        property.id === selectedProperty.id
          ? { ...property, status: nextStatus }
          : property
      )
    );
  }

  async function setCover(imageId: string) {
    if (!selectedProperty) return;
    const token = await getToken();
    await apiFetch(`/properties/${selectedProperty.id}/images/${imageId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ is_cover: true }),
    });
    await refreshSelectedProperty();
  }

  async function registerImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProperty || !newImagePath.trim()) return;
    const token = await getToken();
    await apiFetch(`/properties/${selectedProperty.id}/images/complete`, token, {
      method: "POST",
      body: JSON.stringify({
        storage_path: newImagePath.trim(),
        is_cover: !selectedProperty.images.length,
        sort_order: selectedProperty.images.length,
      }),
    });
    setNewImagePath("");
    await refreshSelectedProperty();
  }

  async function deleteImage(imageId: string) {
    if (!selectedProperty) return;
    const token = await getToken();
    await apiFetch(`/properties/${selectedProperty.id}/images/${imageId}`, token, {
      method: "DELETE",
    });
    await refreshSelectedProperty();
  }

  async function deleteListing() {
    if (!selectedProperty) return;
    const confirmed = window.confirm(`Delete ${selectedProperty.name}?`);
    if (!confirmed) return;
    const token = await getToken();
    try {
      await apiFetch(`/properties/${selectedProperty.id}`, token, { method: "DELETE" });
      setProperties((current) =>
        current.filter((property) => property.id !== selectedProperty.id)
      );
      updateSelection(null);
      setMessage("Listing deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete property");
    }
  }

  const selectedImage = selectedProperty
    ? resolvePropertyImage(selectedProperty)
    : "/property-stock/default.jpg";

  const showAgentColumn = currentUser?.role === "MANAGER";
  const tableGridClass = showAgentColumn
    ? "grid-cols-[minmax(280px,2fr)_1fr_1fr_1fr_1fr_1fr]"
    : "grid-cols-[minmax(280px,2fr)_1fr_1fr_1fr_1fr]";
  const priceLabel = priceColumnLabel(listingType);

  return (
    <div>
      <div className={selectedPropertyId ? "pr-0 xl:pr-[380px]" : ""}>
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card) => (
              <div key={card.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`rounded-xl p-2 ${card.iconClass}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <TrendBadge value={card.trend} />
                </div>
                <p className="mt-4 text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {card.value}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-w-64 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, owner, city, state, postcode"
                  className="w-full bg-transparent outline-none"
                />
              </label>
              <Select value={status} onChange={setStatus} label="All statuses">
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Inactive">Inactive</option>
              </Select>
              <Select value={propertyType} onChange={setPropertyType} label="All types">
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <Select value={state} onChange={setState} label="All states">
                {MALAYSIAN_STATES.map((stateName) => (
                  <option key={stateName} value={stateName}>
                    {stateName}
                  </option>
                ))}
              </Select>
              {canFilterOwner ? (
                <Select value={ownerId} onChange={setOwnerId} label="All agents">
                  {teamUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </Select>
              ) : null}
              <select
                value={dateRange}
                onChange={(event) => setDateRange(event.target.value as DateRangeValue)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                {DATE_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-600"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </section>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div
              className={`grid ${tableGridClass} gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500`}
            >
              <span>Property</span>
              <span>Classification</span>
              <span>Listing</span>
              <span>{priceLabel}</span>
              {showAgentColumn ? <span>Agent</span> : null}
              <span>Updated</span>
            </div>
            {paginatedProperties.map((property) => {
              const selected = property.id === selectedPropertyId;
              const imageCount = property.image_count ?? 0;
              return (
                <button
                  key={property.id}
                  type="button"
                  data-property-row
                  onClick={() => updateSelection(property.id)}
                  className={`grid w-full ${tableGridClass} items-center gap-4 border-b border-slate-100 px-4 py-4 text-left text-sm last:border-b-0 hover:bg-slate-50 ${
                    selected ? "bg-blue-50/60" : ""
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="relative h-16 w-24 shrink-0 rounded-xl bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${resolvePropertyImage(property)})`,
                      }}
                    >
                      {imageCount > 1 ? (
                        <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                          {imageCount}
                        </span>
                      ) : null}
                    </span>
                    <span>
                      <span className="block font-medium text-slate-950">
                        {property.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {propertyReference(property.id)}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {propertyAddressSummary(property)}
                      </span>
                    </span>
                  </span>
                  <span>
                    <span className="block font-medium text-slate-700">
                      {propertyTypeLabel(property.type)}
                    </span>
                    <span className="block text-xs text-slate-500">{property.state}</span>
                  </span>
                  <span className="inline-flex flex-col items-start gap-1.5">
                    <Badge className={listingBadgeClass(property.listing_type)}>
                      {property.listing_type}
                    </Badge>
                    <Badge className={statusBadgeClass(property.status)}>
                      {property.status}
                    </Badge>
                  </span>
                  <PriceCell property={property} listingType={listingType} />
                  {showAgentColumn ? (
                    <span className="text-slate-600">
                      {property.ren?.full_name ?? property.ren?.email ?? "Unassigned"}
                    </span>
                  ) : null}
                  <span>
                    <span className="block text-slate-700">
                      {formatDate(property.updated_at)}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Created {formatDate(property.created_at)}
                    </span>
                  </span>
                </button>
              );
            })}
            {!paginatedProperties.length ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No properties found.
              </div>
            ) : null}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <p>
              Showing {paginatedProperties.length} of {properties.length} properties.
              {" "}
              Default photos courtesy of{" "}
              <a
                href="/property-stock/ATTRIBUTIONS.md"
                className="font-medium text-slate-700 underline"
              >
                Unsplash
              </a>
              .
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="rounded-xl border border-slate-200 px-3 py-2"
              >
                {showAll ? "Paginate" : "Show all"}
              </button>
              <button
                type="button"
                disabled={safePage <= 1 || showAll}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages || showAll}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {message ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <p className="pointer-events-auto rounded-full bg-slate-900/95 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {message}
          </p>
        </div>
      ) : null}

      {selectedPropertyId ? (
        <aside
          ref={drawerRef}
          className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl xl:inset-x-auto xl:right-0 xl:top-0 xl:h-screen xl:max-h-none xl:w-[380px] xl:rounded-none"
        >
          {loadingDetail || !selectedProperty ? (
            <div className="p-6 text-sm text-slate-500">
              {loadingDetail ? "Loading property..." : "Select a property."}
            </div>
          ) : (
            <div className="flex min-h-full flex-col">
              <div
                className="h-56 bg-cover bg-center"
                style={{ backgroundImage: `url(${selectedImage})` }}
              />
              <div className="space-y-5 p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">
                        {selectedProperty.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {propertyReference(selectedProperty.id)}
                      </p>
                    </div>
                    <Badge className={statusBadgeClass(selectedProperty.status)}>
                      {selectedProperty.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {propertyTypeLabel(selectedProperty.type)} ·{" "}
                    {propertyAddressSummary(selectedProperty)}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {money(primaryPrice(selectedProperty))}
                  </p>
                </div>

                <div className="flex border-b border-slate-200 text-sm">
                  {DRAWER_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => updateDrawerTab(tab)}
                      className={`border-b-2 px-3 py-2 capitalize ${
                        drawerTab === tab
                          ? "border-slate-950 text-slate-950"
                          : "border-transparent text-slate-500"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {drawerTab === "overview" ? (
                  <OverviewTab property={selectedProperty} />
                ) : null}
                {drawerTab === "details" ? (
                  <DetailsTab property={selectedProperty} />
                ) : null}
                {drawerTab === "images" ? (
                  <ImagesTab
                    property={selectedProperty}
                    fallbackImage={selectedImage}
                    newImagePath={newImagePath}
                    onNewImagePathChange={setNewImagePath}
                    onRegisterImage={registerImage}
                    onSetCover={setCover}
                    onDeleteImage={deleteImage}
                  />
                ) : null}
                {drawerTab === "timeline" ? (
                  <TimelineTab property={selectedProperty} />
                ) : null}
                {drawerTab === "activity" ? (
                  <ActivityTab property={selectedProperty} />
                ) : null}
              </div>
              <footer className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/app/properties/new?edit=${selectedProperty.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Listing
                  </Link>
                  <Link
                    href={`/app/viewings/new?property=${selectedProperty.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Viewing
                  </Link>
                  <select
                    value={selectedProperty.status}
                    onChange={(event) => void updateStatus(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                  <Link
                    href={`/app/campaigns/templates?property=${selectedProperty.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <Copy className="h-4 w-4" />
                    Promote
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteListing()}
                    className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Listing
                  </button>
                </div>
              </footer>
            </div>
          )}
        </aside>
      ) : null}
    </div>
  );
}

function TrendBadge({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
        <Minus className="h-3 w-3" />
        No prior
      </span>
    );
  }
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
        positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value)}%
    </span>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
    >
      <option value="">{label}</option>
      {children}
    </select>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${className}`}
    >
      {children}
    </span>
  );
}

function PriceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function PricingCardContent({ property }: { property: PropertyDetail }) {
  if (property.listing_type === "Both") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <PriceTile label="Market price" value={money(salePrice(property))} />
        <PriceTile label="Rental price" value={money(rentalPrice(property))} />
      </div>
    );
  }
  if (property.listing_type === "Rental") {
    return <PriceTile label="Rental price" value={money(rentalPrice(property))} />;
  }
  return <PriceTile label="Selling price" value={money(salePrice(property))} />;
}

function PriceCell({
  property,
  listingType,
}: {
  property: PropertyRow;
  listingType: string;
}) {
  if (listingType === "Sale") {
    return (
      <span>
        <span className="block font-semibold text-slate-950">
          {money(salePrice(property))}
        </span>
      </span>
    );
  }
  if (listingType === "Rental") {
    return (
      <span>
        <span className="block font-semibold text-slate-950">
          {money(rentalPrice(property))}
        </span>
      </span>
    );
  }
  if (listingType === "Both") {
    return (
      <span>
        <span className="block font-semibold text-slate-950">
          {money(salePrice(property))}
        </span>
        <span className="block text-xs text-slate-500">
          Rent {money(rentalPrice(property))}
        </span>
      </span>
    );
  }
  return (
    <span>
      <span className="block font-semibold text-slate-950">
        {money(primaryPrice(property))}
      </span>
      <span className="block text-xs text-slate-500">
        {secondaryPrice(property)}
      </span>
    </span>
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
    <section className="rounded-2xl border border-slate-200 p-4">
      <h4 className="font-medium text-slate-950">{title}</h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{value || "-"}</dd>
    </div>
  );
}

function OverviewTab({ property }: { property: PropertyDetail }) {
  return (
    <div className="space-y-4">
      <InfoCard title="Key Information">
        <dl className="grid grid-cols-2 gap-3">
          <KeyValue label="Type" value={propertyTypeLabel(property.type)} />
          <KeyValue label="Status" value={property.status} />
          <KeyValue label="Location" value={property.city} />
          <KeyValue label="Agent" value={property.ren?.full_name ?? property.ren?.email} />
          <KeyValue label="Bedrooms" value={property.bedrooms} />
          <KeyValue label="Bathrooms" value={property.bathrooms} />
        </dl>
      </InfoCard>
      <InfoCard title="Pricing">
        <PricingCardContent property={property} />
      </InfoCard>
      <InfoCard title="Description">
        <p className="text-sm leading-6 text-slate-600">
          {property.description || "No listing description has been added yet."}
        </p>
      </InfoCard>
    </div>
  );
}

function DetailsTab({ property }: { property: PropertyDetail }) {
  return (
    <InfoCard title="Full Details">
      <dl className="grid grid-cols-2 gap-3">
        <KeyValue label="Owner" value={property.owner_name} />
        <KeyValue label="Owner email" value={property.owner_email} />
        <KeyValue label="Owner phone" value={property.owner_phone} />
        <KeyValue label="Address" value={property.address_line_1} />
        <KeyValue label="City" value={property.city} />
        <KeyValue label="State" value={property.state} />
        <KeyValue label="Postcode" value={property.postcode} />
        <KeyValue label="Listing type" value={property.listing_type} />
        <KeyValue label="Market value" value={money(property.market_value)} />
        <KeyValue label="Listing price" value={money(property.listing_price)} />
        <KeyValue label="Expected rental" value={money(property.expected_rental)} />
        <KeyValue label="Year built" value={property.year_built} />
        <KeyValue label="Maintenance fee" value={money(property.maintenance_fee)} />
        <KeyValue label="Sqft" value={property.sqft} />
        <KeyValue label="Parking" value={property.parking} />
        <KeyValue label="Furnishing" value={property.furnishing} />
      </dl>
    </InfoCard>
  );
}

function ImagesTab({
  property,
  fallbackImage,
  newImagePath,
  onNewImagePathChange,
  onRegisterImage,
  onSetCover,
  onDeleteImage,
}: {
  property: PropertyDetail;
  fallbackImage: string;
  newImagePath: string;
  onNewImagePathChange: (value: string) => void;
  onRegisterImage: (event: FormEvent<HTMLFormElement>) => void;
  onSetCover: (imageId: string) => void;
  onDeleteImage: (imageId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <form onSubmit={onRegisterImage} className="rounded-2xl border border-slate-200 p-4">
        <label className="text-sm font-medium">Register image path</label>
        <div className="mt-2 flex gap-2">
          <input
            value={newImagePath}
            onChange={(event) => onNewImagePathChange(event.target.value)}
            placeholder="Storage path"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <ImagePlus className="h-4 w-4" />
            Add
          </button>
        </div>
      </form>
      {!property.images.length ? (
        <div
          className="flex h-48 items-end rounded-2xl bg-cover bg-center p-4"
          style={{ backgroundImage: `url(${fallbackImage})` }}
        >
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs">
            Stock fallback until a cover image is uploaded
          </span>
        </div>
      ) : null}
      <div className="grid gap-3">
        {property.images.map((image) => (
          <div key={image.id} className="rounded-2xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="break-all text-sm font-medium text-slate-800">
                  {image.storage_path}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {image.is_cover ? "Cover image" : "Gallery image"} · Order{" "}
                  {image.sort_order}
                </p>
              </div>
              <Camera className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-3 flex gap-2">
              {!image.is_cover ? (
                <button
                  type="button"
                  onClick={() => onSetCover(image.id)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  Set cover
                </button>
              ) : null}
              {!image.is_cover && property.images.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onDeleteImage(image.id)}
                  className="rounded-xl border border-red-200 px-3 py-2 text-xs text-red-600"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineTab({ property }: { property: PropertyDetail }) {
  const events = [
    { label: "Listing created", date: property.created_at, icon: Home },
    { label: "Listing updated", date: property.updated_at, icon: Pencil },
    { label: "Status now " + property.status, date: property.updated_at, icon: CheckCircle2 },
    ...(property.images.length
      ? [{ label: `${property.images.length} images registered`, date: property.updated_at, icon: Camera }]
      : []),
  ];
  return (
    <InfoCard title="Timeline">
      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.label} className="flex gap-3">
            <span className="rounded-full bg-slate-100 p-2 text-slate-500">
              <event.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium">{event.label}</p>
              <p className="text-xs text-slate-500">{formatDate(event.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </InfoCard>
  );
}

function ActivityTab({ property }: { property: PropertyDetail }) {
  return (
    <InfoCard title="Recent Activity">
      <dl className="grid grid-cols-2 gap-3">
        <KeyValue label="Last updated" value={formatDate(property.updated_at)} />
        <KeyValue label="Last status" value={property.status} />
        <KeyValue label="Last viewed by" value={property.ren?.full_name ?? "Current team"} />
        <KeyValue label="Canonical type" value={canonicalPropertyType(property.type) ?? "Legacy type"} />
      </dl>
    </InfoCard>
  );
}
