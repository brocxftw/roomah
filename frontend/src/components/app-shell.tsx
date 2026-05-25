"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";

import { useAuth } from "@/lib/use-auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { signOut } = useAuth();

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
            <Link href="/app/viewings" className="text-sm font-medium">
              Viewings
            </Link>
            <Link href="/app/deals" className="text-sm font-medium">
              Deals
            </Link>
            <Link href="/app/manager" className="text-sm font-medium">
              Manager
            </Link>
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
