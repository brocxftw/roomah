import Link from "next/link";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth-form";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 font-sans">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 rounded-3xl bg-white px-8 py-16 text-center shadow-sm">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-zinc-500">
            ROOMAH
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950">
            Operational CRM for Malaysian RENs
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-zinc-600">
            Track leads, properties, viewings, follow-ups, deals, and
            commissions from one daily workspace.
          </p>
        </div>

        <Suspense fallback={<p className="text-sm text-zinc-500">Loading sign in...</p>}>
          <AuthForm />
        </Suspense>
        <Link href="/app" className="text-sm font-medium text-zinc-600">
          Open workspace if already signed in
        </Link>
      </main>
    </div>
  );
}
