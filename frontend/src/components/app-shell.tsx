"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type CurrentUser = {
  email: string;
  full_name: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { getToken, signOut } = useAuth();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

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

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div>
            <p className="text-sm text-muted-foreground">ROOMAH</p>
            <h1 className="text-lg font-semibold">REN Workspace</h1>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/app" className="text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/app/leads" className="text-sm font-medium">
              Leads
            </Link>
            <Link href="/app/properties" className="text-sm font-medium">
              Properties
            </Link>
            <Link href="/app/campaigns" className="text-sm font-medium">
              Campaigns
            </Link>
            <Link href="/app/viewings" className="text-sm font-medium">
              Viewings
            </Link>
            <Link href="/app/deals" className="text-sm font-medium">
              Deals
            </Link>
            <Link href="/app/manager" className="text-sm font-medium">
              Manager
            </Link>
            <Link href="/app/profile" className="text-sm font-medium">
              Profile
            </Link>
            {currentUser ? (
              <div className="text-right text-sm">
                <p className="font-medium">{currentUser.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentUser.email}
                </p>
              </div>
            ) : null}
            <button
              type="button"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
              onClick={() => {
                void handleSignOut();
              }}
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
