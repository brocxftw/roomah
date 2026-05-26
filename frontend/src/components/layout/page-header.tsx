import Link from "next/link";
import type React from "react";

type HeaderAction = {
  label: string;
  href: string;
};

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryAction,
  variant,
  rightSlot,
}: {
  title: string;
  description: string;
  primaryAction?: HeaderAction;
  secondaryAction?: HeaderAction;
  variant?: "default" | "greeting";
  rightSlot?: React.ReactNode;
}) {
  const isGreeting = variant === "greeting";
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1
            className={
              isGreeting
                ? "text-3xl font-semibold tracking-tight"
                : "text-2xl font-semibold tracking-tight"
            }
          >
            {title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
        {rightSlot || primaryAction || secondaryAction ? (
          <div className="flex flex-wrap items-center gap-3">
            {rightSlot ?? null}
            {secondaryAction ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {secondaryAction.label}
              </Link>
            ) : null}
            {primaryAction ? (
              <Link
                href={primaryAction.href}
                className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {primaryAction.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
