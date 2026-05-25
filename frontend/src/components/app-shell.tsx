"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Search,
  Settings,
  Sun,
  UserCircle2,
} from "lucide-react";

import roomahLogo from "@/app/app/roomah-logo.png";
import { PageHeader } from "@/components/layout/page-header";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type CurrentUser = {
  email: string;
  full_name: string;
  role?: string | null;
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
  }
> = {
  "/app": {
    title: "Dashboard",
    description: "Track your daily activity and priorities.",
    primaryAction: { label: "+ Add Lead", href: "/app/leads/new" },
  },
  "/app/leads": {
    title: "Leads",
    description: "Manage active conversations and next actions.",
    primaryAction: { label: "+ Add Lead", href: "/app/leads/new" },
  },
  "/app/properties": {
    title: "Properties",
    description: "Maintain listings and property availability.",
    primaryAction: { label: "+ Add Property", href: "/app/properties/new" },
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
  },
  "/app/profile": {
    title: "Profile",
    description: "Update account settings and preferences.",
  },
};

function getPageMeta(pathname: string) {
  const entries = Object.entries(pageMeta).sort(
    ([a], [b]) => b.length - a.length
  );
  const matched = entries.find(([key]) =>
    pathname === key || pathname.startsWith(`${key}/`)
  );
  if (!matched) {
    return {
      title: "Workspace",
      description: "Stay focused on your next best action.",
    };
  }
  return matched[1];
}

function isNavActive(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === "/app";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
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
                "group flex min-h-11 items-center gap-3 px-3 text-sm font-medium transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "border-l-4 border-l-teal-500 bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  : "border-l-4 border-l-transparent text-slate-300 hover:bg-slate-800 hover:text-white",
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
                  "h-5 w-5 shrink-0",
                  active ? "opacity-90" : "brightness-0 invert opacity-80",
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
  const { getToken, signOut } = useAuth();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("roomah-theme") === "dark";
  });
  const canSeeManager = currentUser?.role === "MANAGER";
  const sidebarCompact = sidebarCollapsed && !sidebarHovered;
  const shellMeta = getPageMeta(pathname);
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
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={[
          "fixed inset-y-0 left-0 z-30 hidden h-screen shrink-0 border-r border-slate-200 bg-slate-900 text-slate-100 shadow-sm transition-[width] duration-200 md:flex md:flex-col",
          sidebarCompact ? "w-20" : "w-[280px]",
        ].join(" ")}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-700 px-3">
          <Link href="/app" className="flex min-w-0 items-center gap-3">
            <Image src={roomahLogo} alt="ROOMAH" className="h-10 w-auto" priority />
            {!sidebarCompact ? (
              <span className="truncate text-base font-semibold tracking-wide">
                ROOMAH
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className="hidden h-10 min-w-10 items-center justify-center rounded-md text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-100 lg:inline-flex"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? ">" : "<"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <AppNavLinks
            pathname={pathname}
            canSeeManager={canSeeManager}
            compact={sidebarCompact}
          />
        </div>
        <div className="space-y-1 border-t border-slate-700 p-2">
          <Link
            href="/app/profile"
            className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
          >
            <Settings className="size-4 shrink-0" aria-hidden />
            {!sidebarCompact ? <span className="truncate">Settings</span> : null}
          </Link>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
            onClick={toggleDarkMode}
          >
            {isDarkMode ? (
              <Sun className="size-4 shrink-0" aria-hidden />
            ) : (
              <Moon className="size-4 shrink-0" aria-hidden />
            )}
            {!sidebarCompact ? (
              <span className="truncate">{isDarkMode ? "Light mode" : "Dark mode"}</span>
            ) : null}
          </button>
        </div>
      </aside>

      <div
        className={[
          "transition-[padding] duration-200",
          sidebarCollapsed ? "md:pl-20" : "md:pl-[280px]",
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

              <button
                type="button"
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 text-left text-sm text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => setCommandPaletteOpen(true)}
              >
                <Search className="size-4 shrink-0" aria-hidden />
                <span className="truncate">
                  Search leads, properties, locations...
                </span>
                <span className="ml-auto hidden rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">
                  Ctrl + K
                </span>
              </button>

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
                    href="/app/deals"
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    + Deal
                  </Link>
                </div>
              </details>

              <details className="relative">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 px-2 text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                    {userInitials}
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
                      <p className="text-xs text-slate-500">{currentUser.email}</p>
                    </div>
                  ) : null}
                  <Link
                    href="/app/profile"
                    className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <UserCircle2 className="size-4" aria-hidden />
                    Profile
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
            title={shellMeta.title}
            description={shellMeta.description}
            primaryAction={shellMeta.primaryAction}
            secondaryAction={shellMeta.secondaryAction}
          />

          <main className="w-full min-w-0 overflow-x-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {children}
          </main>
        </div>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden">
          <div className="h-full w-[280px] overflow-y-auto bg-slate-900 p-4 text-slate-100 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Link href="/app" className="flex items-center gap-2">
                <Image src={roomahLogo} alt="ROOMAH" className="h-10 w-auto rounded" />
                <span className="font-semibold">ROOMAH</span>
              </Link>
              <button
                type="button"
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg text-sm hover:bg-slate-800"
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

      {commandPaletteOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-20">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 dark:border-slate-700">
              <Search className="size-4 text-slate-500" aria-hidden />
              <input
                autoFocus
                placeholder="Search leads, properties, locations..."
                className="h-11 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="mt-3 grid gap-1 text-sm">
              <Link
                href="/app/leads"
                className="rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Go to Leads
              </Link>
              <Link
                href="/app/properties"
                className="rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Go to Properties
              </Link>
              <Link
                href="/app/campaigns"
                className="rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Go to Campaigns
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
