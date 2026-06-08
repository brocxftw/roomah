import Link from "next/link";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth-form";
import { ForgotPasswordLink } from "@/components/forgot-password-link";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-white font-sans">
      <header className="relative z-20 px-6 py-5 sm:px-10">
        <Link
          href="/app"
          aria-label="ROOMAH"
          className="flex w-fit origin-left scale-[1.2] items-center gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/rumah-logo-collapse.svg"
            alt=""
            aria-hidden
            className="h-12 w-12 shrink-0 object-contain"
          />
          <span className="flex flex-col">
            <span
              className="text-[26px] font-bold leading-none text-[#102A43]"
              style={{ fontFamily: "var(--font-comfortaa)" }}
            >
              roomah
            </span>
            <span
              className="mt-1 text-[10px] font-medium uppercase leading-none tracking-[0.24em] text-slate-500"
              style={{ fontFamily: '"Garet", var(--font-garet), sans-serif' }}
            >
              Real Estate CRM
            </span>
          </span>
        </Link>
      </header>

      <main className="relative z-20 flex flex-1 flex-col items-center justify-center px-6 pb-44 pt-6">
        <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-slate-200 bg-white/90 px-8 py-12 text-center shadow-xl backdrop-blur-sm">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Welcome back
            </h1>
            <p className="mx-auto max-w-sm text-sm leading-6 text-slate-600">
              Track leads, properties, viewings, follow-ups, deals, and
              commissions from one daily workspace.
            </p>
          </div>

          <Suspense
            fallback={<p className="text-sm text-slate-500">Loading sign in...</p>}
          >
            <AuthForm />
          </Suspense>
          <ForgotPasswordLink />
        </div>
      </main>

      {/* Kuala Lumpur skyline backdrop, anchored to the bottom over white. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/login-verysmall.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 w-full origin-bottom scale-125 select-none object-contain object-bottom opacity-90"
      />
    </div>
  );
}
