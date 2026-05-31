"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Building2, MapPin, Search, UserRound } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type LeadResult = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
};

type PropertyResult = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
};

type Suggestion =
  | {
      kind: "lead";
      id: string;
      label: string;
      detail?: string;
      href: string;
    }
  | {
      kind: "property";
      id: string;
      label: string;
      detail?: string;
      href: string;
    }
  | {
      kind: "location";
      id: string;
      label: string;
      detail?: string;
      href: string;
    };

const MIN_QUERY_LENGTH = 2;
const MAX_PER_GROUP = 5;

function joinLocation(property: PropertyResult): string {
  return [property.city, property.state, property.postcode]
    .filter((part): part is string => Boolean(part && part.trim().length))
    .join(", ");
}

function buildSuggestions(
  query: string,
  leads: LeadResult[],
  properties: PropertyResult[]
): Suggestion[] {
  const lowerQuery = query.trim().toLowerCase();
  const out: Suggestion[] = [];

  for (const lead of leads.slice(0, MAX_PER_GROUP)) {
    out.push({
      kind: "lead",
      id: `lead-${lead.id}`,
      label: lead.name,
      detail: lead.phone ?? lead.email ?? lead.status ?? undefined,
      href: `/app/leads/${lead.id}`,
    });
  }

  for (const property of properties.slice(0, MAX_PER_GROUP)) {
    out.push({
      kind: "property",
      id: `property-${property.id}`,
      label: property.name,
      detail: joinLocation(property) || undefined,
      href: `/app/properties/${property.id}`,
    });
  }

  const locationKeyToProperty = new Map<string, PropertyResult>();
  for (const property of properties) {
    const candidates = [property.city, property.state, property.postcode];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (!candidate.toLowerCase().includes(lowerQuery)) continue;
      const key = candidate.trim().toLowerCase();
      if (!key || locationKeyToProperty.has(key)) continue;
      locationKeyToProperty.set(key, property);
      if (locationKeyToProperty.size >= MAX_PER_GROUP) break;
    }
    if (locationKeyToProperty.size >= MAX_PER_GROUP) break;
  }

  for (const [key, property] of locationKeyToProperty) {
    out.push({
      kind: "location",
      id: `location-${key}`,
      label: property.city
        ? property.city
        : property.state
          ? property.state
          : (property.postcode ?? key),
      detail: joinLocation(property) || undefined,
      href: `/app/properties?q=${encodeURIComponent(key)}`,
    });
  }

  return out;
}

function groupLabel(kind: Suggestion["kind"]) {
  switch (kind) {
    case "lead":
      return "Leads";
    case "property":
      return "Properties";
    case "location":
      return "Locations";
  }
}

function GroupIcon({ kind }: { kind: Suggestion["kind"] }) {
  switch (kind) {
    case "lead":
      return <UserRound className="size-4" aria-hidden />;
    case "property":
      return <Building2 className="size-4" aria-hidden />;
    case "location":
      return <MapPin className="size-4" aria-hidden />;
  }
}

export function GlobalSearch() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = query.trim();
  const hasMinQuery = trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || !hasMinQuery) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const token = await getToken();
        const params = new URLSearchParams({ q: trimmed });
        const [leads, properties] = await Promise.all([
          apiFetch<LeadResult[]>(`/leads?${params.toString()}`, token).catch(
            () => [] as LeadResult[]
          ),
          apiFetch<PropertyResult[]>(
            `/properties?${params.toString()}`,
            token
          ).catch(() => [] as PropertyResult[]),
        ]);
        if (cancelled) return;
        const next = buildSuggestions(trimmed, leads, properties);
        setSuggestions(next);
        setHighlightIndex(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trimmed, hasMinQuery]);

  const grouped = useMemo(() => {
    const groups: { kind: Suggestion["kind"]; items: Suggestion[] }[] = [];
    const map = new Map<Suggestion["kind"], Suggestion[]>();
    for (const item of suggestions) {
      const list = map.get(item.kind) ?? [];
      list.push(item);
      map.set(item.kind, list);
    }
    for (const kind of ["lead", "property", "location"] as const) {
      const items = map.get(kind);
      if (items && items.length) groups.push({ kind, items });
    }
    return groups;
  }, [suggestions]);

  const flatSuggestions = useMemo(
    () => grouped.flatMap((group) => group.items),
    [grouped]
  );

  const navigate = useCallback(
    (suggestion: Suggestion) => {
      setOpen(false);
      router.push(suggestion.href);
    },
    [router]
  );

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    if (!open) setOpen(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((current) =>
        flatSuggestions.length === 0
          ? 0
          : (current + 1) % flatSuggestions.length
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((current) =>
        flatSuggestions.length === 0
          ? 0
          : (current - 1 + flatSuggestions.length) % flatSuggestions.length
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = flatSuggestions[highlightIndex];
      if (target) navigate(target);
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <div
        className={[
          "flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition focus-within:ring-2 focus-within:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
          open ? "ring-2 ring-ring" : "",
        ].join(" ")}
      >
        <Search className="size-4 shrink-0 text-slate-500" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={onChange}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search leads, properties, locations..."
          className="h-11 w-full bg-transparent text-sm outline-none"
          aria-label="Global search"
          aria-controls="global-search-listbox"
        />
        <span className="ml-auto hidden rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">
          Ctrl + K
        </span>
      </div>

      {open ? (
        <div
          id="global-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {!hasMinQuery ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              Start typing to search leads, properties, and locations.
            </p>
          ) : loading ? (
            <p className="px-4 py-3 text-sm text-slate-500">Searching...</p>
          ) : flatSuggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              No matches for &ldquo;{trimmed}&rdquo;.
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.kind} className="py-1">
                <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {groupLabel(group.kind)}
                </p>
                <ul className="px-1 pb-1">
                  {group.items.map((item) => {
                    const flatIndex = flatSuggestions.indexOf(item);
                    const isHighlighted = flatIndex === highlightIndex;
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onMouseEnter={() => setHighlightIndex(flatIndex)}
                          onClick={() => navigate(item)}
                          role="option"
                          aria-selected={isHighlighted}
                          className={[
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                            isHighlighted
                              ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                              : "text-slate-700 dark:text-slate-200",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                              "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                            ].join(" ")}
                          >
                            <GroupIcon kind={item.kind} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {item.label}
                            </span>
                            {item.detail ? (
                              <span className="block truncate text-xs text-slate-500">
                                {item.detail}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            {groupLabel(item.kind).slice(0, -1)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
