"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  UserCircle2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { GlobalSearch } from "@/components/layout/global-search";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type CurrentUser = {
  email: string;
  full_name: string;
  role?: string | null;
  avatar_url?: string | null;
  session_timeout_minutes?: number | null;
};

type NavItem = {
  label: string;
  href: string;
  iconUrl: string;
  managerOnly?: boolean;
};

export const primaryNav: NavItem[] = [
  {
    label: "Dashboard",
    href: "/app",
    iconUrl: "https://img.icons8.com/?id=Yj5svDsC4jQA&format=png&size=24",
  },
  {
    label: "Leads",
    href: "/app/leads",
    iconUrl: "https://img.icons8.com/?id=86818&format=png&size=24",
  },
  {
    label: "Properties",
    href: "/app/properties",
    iconUrl: "https://img.icons8.com/?id=86634&format=png&size=24",
  },
  {
    label: "Campaigns",
    href: "/app/campaigns",
    iconUrl: "https://img.icons8.com/?id=92740&format=png&size=24",
  },
  {
    label: "Viewings",
    href: "/app/viewings",
    iconUrl: "https://img.icons8.com/?id=85102&format=png&size=24",
  },
  {
    label: "Deals",
    href: "/app/deals",
    iconUrl: "https://img.icons8.com/?id=85134&format=png&size=24",
  },
  {
    label: "Manager",
    href: "/app/manager",
    iconUrl: "https://img.icons8.com/?id=86565&format=png&size=24",
    managerOnly: true,
  },
];

export function getVisiblePrimaryNav(role?: string | null) {
  return primaryNav.filter((item) =>
    item.managerOnly ? role === "MANAGER" : true
  );
}

const pageMeta: Record<
  string,
  {
    title: string;
    description: string;
    primaryAction?: { label: string; href: string };
    secondaryAction?: { label: string; href: string };
    variant?: "default" | "greeting";
  }
> = {
  "/app": {
    title: "Dashboard",
    description: "Track your daily activity and priorities.",
    variant: "greeting",
  },
  "/app/leads": {
    title: "Leads",
    description: "Manage active conversations and next actions.",
    primaryAction: { label: "+ Add Lead", href: "/app/leads/new" },
  },
  "/app/leads/new": {
    title: "Add lead",
    description: "Capture customer details, budget, and preferences.",
  },
  "/app/properties": {
    title: "Properties",
    description:
      "Manage listings, images, pricing, and operational actions from one workspace.",
  },
  "/app/campaigns": {
    title: "Campaigns",
    description: "Review channels and campaign performance.",
    primaryAction: { label: "+ Add Campaign", href: "/app/campaigns/new" },
  },
  "/app/viewings": {
    title: "Viewings",
    description: "Schedule, prepare, and follow up on visits.",
    primaryAction: { label: "+ Schedule Viewing", href: "/app/viewings/new" },
  },
  "/app/deals": {
    title: "Deals",
    description: "Track negotiations and upcoming closings.",
  },
  "/app/manager": {
    title: "Manager",
    description: "Monitor team performance and campaign oversight.",
    primaryAction: { label: "+ Add Team Member", href: "/app/manager/team/new" },
  },
  "/app/profile": {
    title: "Settings",
    description: "Manage your profile, commission, notifications, and security.",
  },
};

function getPageMeta(
  pathname: string,
  searchParams?: { get: (key: string) => string | null }
) {
  const entries = Object.entries(pageMeta).sort(
    ([a], [b]) => b.length - a.length
  );
  const matched = entries.find(
    ([key]) => pathname === key || pathname.startsWith(`${key}/`)
  );
  const base =
    matched?.[1] ?? {
      title: "Workspace",
      description: "Stay focused on your next best action.",
    };
  if (pathname === "/app/leads/new" && searchParams?.get("edit")) {
    return {
      ...base,
      title: "Edit lead",
      description: "Update customer details, budget, and preferences.",
      primaryAction: undefined,
    };
  }
  return base;
}

function isNavActive(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const PROPERTY_LISTING_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "Sale", label: "Sale" },
  { value: "Rental", label: "Rental" },
  { value: "Both", label: "Both" },
];

function PropertyListingMasterFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentValue = searchParams.get("listing_type") ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("listing_type");
    } else {
      params.set("listing_type", value);
    }
    const query = params.size ? `?${params.toString()}` : "";
    router.replace(`${pathname}${query}`);
  }

  return (
    <div
      role="group"
      aria-label="Filter properties by listing type"
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm dark:border-slate-700 dark:bg-slate-800"
    >
      {PROPERTY_LISTING_FILTER_OPTIONS.map((option) => {
        const active = currentValue === option.value;
        return (
          <button
            key={option.value || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => handleChange(option.value)}
            className={[
              "min-h-9 rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AppNavLinks({
  pathname,
  canSeeManager,
  compact = false,
  onNavigate,
}: {
  pathname: string;
  canSeeManager: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {getVisiblePrimaryNav(canSeeManager ? "MANAGER" : null).map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={[
              "group flex min-h-12 items-center gap-3 rounded-md px-3 text-[17px] font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "bg-white/15 text-white"
                : "text-slate-200 hover:bg-white/10 hover:text-white",
              compact ? "justify-center px-2" : "",
            ].join(" ")}
            title={compact ? item.label : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.iconUrl}
              alt=""
              aria-hidden
              className={[
                "h-[25px] w-[25px] shrink-0 brightness-0 invert",
                active ? "opacity-100" : "opacity-80",
              ].join(" ")}
              loading="lazy"
            />
            {!compact ? <span className="truncate">{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken, signOut } = useAuth();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("roomah-theme") === "dark";
  });
  const canSeeManager = currentUser?.role === "MANAGER";
  const sidebarExpanded = sidebarHovered;
  const sidebarCompact = !sidebarExpanded;
  const shellMeta = getPageMeta(pathname, searchParams);
  const dashboardRange = searchParams.get("date_range") ?? "month";
  const userInitials = currentUser?.full_name
    ? currentUser.full_name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "U";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    window.localStorage.setItem("roomah-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    async function loadCurrentUser() {
      const token = await getToken();
      if (!token) return;
      const user = await apiFetch<CurrentUser>("/users/me", token);
      setCurrentUser(user);
    }

    void loadCurrentUser().catch(async (error) => {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("deactivated")
      ) {
        await signOut();
        router.push("/?reason=deactivated");
      }
    });
  }, [getToken, router, signOut]);

  useEffect(() => {
    function onSettingsUpdated(event: Event) {
      const nextUser = (event as CustomEvent<Partial<CurrentUser>>).detail;
      setCurrentUser((current) =>
        current ? { ...current, ...nextUser } : (nextUser as CurrentUser)
      );
    }

    window.addEventListener("roomah:user-settings-updated", onSettingsUpdated);
    return () =>
      window.removeEventListener(
        "roomah:user-settings-updated",
        onSettingsUpdated
      );
  }, []);

  useEffect(() => {
    const timeoutMinutes = currentUser?.session_timeout_minutes;
    if (!timeoutMinutes || timeoutMinutes <= 0) {
      return;
    }

    const timeoutMs = timeoutMinutes * 60 * 1000;
    let timeoutId: number | undefined;

    async function handleIdleTimeout() {
      await signOut();
      router.push("/");
      router.refresh();
    }

    function resetIdleTimer() {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void handleIdleTimeout();
      }, timeoutMs);
    }

    const events = ["keydown", "mousedown", "mousemove", "scroll", "touchstart"];
    for (const eventName of events) {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    }
    resetIdleTimer();

    return () => {
      window.clearTimeout(timeoutId);
      for (const eventName of events) {
        window.removeEventListener(eventName, resetIdleTimer);
      }
    };
  }, [currentUser?.session_timeout_minutes, router, signOut]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  function toggleDarkMode() {
    setIsDarkMode((current) => !current);
  }

  function updateDashboardRange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date_range", value);
    router.replace(`/app?${params.toString()}`);
  }

  const todayLabel = new Intl.DateTimeFormat("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Good Morning"
      : greetingHour < 18
        ? "Good Afternoon"
        : "Good Evening";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={[
          "fixed inset-y-0 left-0 z-30 hidden h-screen shrink-0 border-r border-white/10 bg-[#102A43] text-slate-100 shadow-sm transition-[width] duration-200 md:flex md:flex-col",
          sidebarExpanded ? "w-[252px]" : "w-20",
        ].join(" ")}
      >
        <div
          className={[
            "flex h-20 items-center border-b border-white/10",
            sidebarCompact ? "justify-center px-0" : "justify-between px-3",
          ].join(" ")}
        >
          <Link
            href="/app"
            aria-label="ROOMAH"
            className={[
              "flex min-w-0 items-center",
              sidebarCompact ? "h-full w-full justify-center" : "gap-3",
            ].join(" ")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/rumah-logo-collapse.svg"
              alt=""
              aria-hidden
              className="h-12 w-12 shrink-0 object-contain"
            />
            {!sidebarCompact ? (
              <span className="flex min-w-0 flex-col">
                <span
                  className="text-[26px] font-bold leading-none text-white"
                  style={{ fontFamily: "var(--font-comfortaa)" }}
                >
                  roomah
                </span>
                <span
                  className="mt-1 text-[10px] font-medium uppercase leading-none tracking-[0.24em] text-slate-300"
                  style={{ fontFamily: '"Garet", var(--font-garet), sans-serif' }}
                >
                  Real Estate CRM
                </span>
              </span>
            ) : null}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <AppNavLinks
            pathname={pathname}
            canSeeManager={canSeeManager}
            compact={sidebarCompact}
          />
        </div>
        <div className="space-y-1 border-t border-white/10 p-2">
          <Link
            href="/app/profile"
            className={[
              "flex min-h-12 items-center gap-3 rounded-md px-3 text-[17px] text-slate-200 transition hover:bg-white/10 hover:text-slate-100",
              sidebarCompact ? "justify-center px-2" : "",
            ].join(" ")}
          >
            <Settings className="size-5 shrink-0" aria-hidden />
            {!sidebarCompact ? (
              <span className="truncate">Settings</span>
            ) : null}
          </Link>
          {/* Dark mode toggle hidden for now; will implement later. */}
          <button
            type="button"
            className={[
              "hidden min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-[17px] text-slate-200 transition hover:bg-white/10 hover:text-slate-100",
              sidebarCompact ? "justify-center px-2" : "",
            ].join(" ")}
            onClick={toggleDarkMode}
          >
            {isDarkMode ? (
              <Sun className="size-5 shrink-0" aria-hidden />
            ) : (
              <Moon className="size-5 shrink-0" aria-hidden />
            )}
            {!sidebarCompact ? (
              <span className="truncate">
                {isDarkMode ? "Light mode" : "Dark mode"}
              </span>
            ) : null}
          </button>
        </div>
      </aside>

      <div
        className={[
          "transition-[padding] duration-200",
          sidebarExpanded ? "md:pl-[252px]" : "md:pl-20",
        ].join(" ")}
      >
        <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-6 p-4 md:p-6">
          <header className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" aria-hidden />
              </button>

              <GlobalSearch />

              <button
                type="button"
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Notifications"
              >
                <Bell className="size-4" aria-hidden />
              </button>

              <Link
                href="/app/viewings"
                className="hidden min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:inline-flex"
              >
                <CalendarDays className="size-4" aria-hidden />
                <span>Calendar</span>
              </Link>

              <details className="relative">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-medium text-slate-50 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
                  <Plus className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Create</span>
                  <ChevronDown className="size-4" aria-hidden />
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <Link
                    href="/app/leads/new"
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    + Lead
                  </Link>
                  <Link
                    href="/app/properties/new"
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    + Property
                  </Link>
                  <Link
                    href="/app/viewings/new"
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    + Viewing
                  </Link>
                  <Link
                    href="/app/campaigns/new"
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    + Campaign
                  </Link>
                  <Link
                    href="/app/deals"
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    + Deal
                  </Link>
                </div>
              </details>

              <details className="relative">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 px-2 text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                    {currentUser?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentUser.avatar_url}
                        alt=""
                        aria-hidden
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      userInitials
                    )}
                  </span>
                  <span className="hidden max-w-28 truncate text-left sm:block">
                    {currentUser?.full_name ?? "Profile"}
                  </span>
                  <ChevronDown className="size-4" aria-hidden />
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {currentUser ? (
                    <div className="mb-2 border-b border-slate-100 px-2 pb-2 text-sm dark:border-slate-700">
                      <p className="font-medium">{currentUser.full_name}</p>
                      <p className="text-xs text-slate-500">
                        {currentUser.email}
                      </p>
                    </div>
                  ) : null}
                  <Link
                    href="/app/profile"
                    className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <UserCircle2 className="size-4" aria-hidden />
                    Settings
                  </Link>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => {
                      void handleSignOut();
                    }}
                  >
                    <LogOut className="size-4" aria-hidden />
                    Sign out
                  </button>
                </div>
              </details>
            </div>
          </header>

          <PageHeader
            title={
              shellMeta.variant === "greeting"
                ? `${greeting}, ${currentUser?.full_name ?? "there"}`
                : shellMeta.title
            }
            description={
              shellMeta.variant === "greeting"
                ? todayLabel
                : shellMeta.description
            }
            primaryAction={shellMeta.primaryAction}
            secondaryAction={shellMeta.secondaryAction}
            variant={shellMeta.variant}
            rightSlot={
              shellMeta.variant === "greeting" ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Insights range
                  </span>
                  <select
                    value={dashboardRange}
                    onChange={(event) =>
                      updateDashboardRange(event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                  </select>
                </label>
              ) : pathname === "/app/properties" ? (
                <PropertyListingMasterFilter />
              ) : undefined
            }
          />

          <main className="w-full min-w-0 overflow-x-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {children}
          </main>
        </div>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden">
          <div className="h-full w-[280px] overflow-y-auto bg-[#102A43] p-4 text-slate-100 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Link href="/app" aria-label="ROOMAH" className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/rumah-logo-collapse.svg"
                  alt=""
                  aria-hidden
                  className="h-10 w-10 shrink-0 object-contain"
                />
                <span className="flex flex-col">
                  <span
                    className="text-[22px] font-bold leading-none text-white"
                    style={{ fontFamily: "var(--font-comfortaa)" }}
                  >
                    roomah
                  </span>
                  <span
                    className="mt-1 text-[9px] font-medium uppercase leading-none tracking-[0.24em] text-slate-300"
                    style={{ fontFamily: '"Garet", var(--font-garet), sans-serif' }}
                  >
                    Real Estate CRM
                  </span>
                </span>
              </Link>
              <button
                type="button"
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg text-sm hover:bg-white/10"
                onClick={() => setMobileSidebarOpen(false)}
              >
                Close
              </button>
            </div>
            <AppNavLinks
              pathname={pathname}
              canSeeManager={canSeeManager}
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
