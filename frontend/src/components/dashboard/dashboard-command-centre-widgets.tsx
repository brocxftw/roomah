import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  Flame,
  Home,
  Target,
} from "lucide-react";

type DashboardLead = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  last_interaction_at?: string | null;
};

type TargetProgressData = {
  scope: "personal" | "team";
  target_amount: string | null;
  current_amount: string;
  progress_ratio: number | null;
  date_range: string;
};

const commissionFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCommission(amount: string | number | null | undefined) {
  const numeric =
    typeof amount === "number" ? amount : Number.parseFloat(String(amount ?? 0));
  if (!Number.isFinite(numeric)) return "0.00";
  return commissionFormatter.format(numeric);
}

function formatInteraction(value?: string | null) {
  if (!value) return "No recent interaction";
  return new Date(value).toLocaleDateString();
}

function sortedByRecentInteraction(items: DashboardLead[]) {
  return [...items].sort((a, b) => {
    const aTime = a.last_interaction_at
      ? new Date(a.last_interaction_at).getTime()
      : 0;
    const bTime = b.last_interaction_at
      ? new Date(b.last_interaction_at).getTime()
      : 0;
    return bTime - aTime;
  });
}

function leadName(lead: DashboardLead) {
  return lead.name ?? `Lead ${lead.id.slice(0, 8)}`;
}

function CardHeader({
  title,
  description,
  count,
  href,
}: {
  title: string;
  description: string;
  count?: number;
  href?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        {typeof count === "number" ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {count}
          </span>
        ) : null}
        {href ? (
          <Link
            href={href}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
          >
            View all
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function HotProspects({ items }: { items: DashboardLead[] }) {
  const prospects = sortedByRecentInteraction(
    items.filter((lead) => ["Proposal", "Negotiation"].includes(lead.status ?? ""))
  );

  return (
    <section
      aria-label="Hot Prospects"
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <CardHeader
        title="Hot Prospects"
        description="High-interest leads ready for your next move."
        count={prospects.length}
        href="/app/leads?status=hot"
      />
      <div className="mt-4 flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {prospects.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            No proposal or negotiation prospects right now.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {prospects.slice(0, 5).map((lead) => (
              <Link
                key={lead.id}
                href={`/app/leads/${lead.id}`}
                className="group grid gap-3 p-4 text-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-slate-800 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                aria-label={`Review ${leadName(lead)}`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-medium text-slate-950 dark:text-slate-50">
                    <Flame className="size-4 text-amber-500" aria-hidden />
                    {leadName(lead)}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Last interaction: {formatInteraction(lead.last_interaction_at)}
                  </span>
                </span>
                <span className="flex items-center gap-2 justify-self-start sm:justify-self-end">
                  <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    {lead.status}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white transition group-hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">
                    Review
                    <ArrowRight className="size-3" aria-hidden />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function RecommendedPropertyMatches({ items }: { items: DashboardLead[] }) {
  const leads = sortedByRecentInteraction(items);

  return (
    <section
      aria-label="Recommended Property Matches"
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <CardHeader
        title="Recommended Property Matches"
        description="Leads that need inventory attached before momentum drops."
        count={leads.length}
        href="/app/properties"
      />
      <div className="mt-4 flex flex-1 flex-col gap-3">
        {leads.length === 0 ? (
          <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">
            Every in-flight lead has a property match.
          </p>
        ) : (
          leads.slice(0, 4).map((lead) => (
            <article
              key={lead.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40">
                  <Home className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-950 dark:text-slate-50">
                    {leadName(lead)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {lead.status ?? "In-flight"} · no property linked yet
                  </p>
                </div>
              </div>
              <Link
                href={`/app/leads/${lead.id}`}
                aria-label={`Match inventory for ${leadName(lead)}`}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Home className="size-3.5" aria-hidden />
                Attach property
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function DealsRequiringProgression({ items }: { items: DashboardLead[] }) {
  const deals = sortedByRecentInteraction(items);

  return (
    <section
      aria-label="Deals Requiring Progression"
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <CardHeader
        title="Deals Requiring Progression"
        description="Negotiation-stage deals that need a next step."
        count={deals.length}
        href="/app/deals?status=negotiation"
      />
      <div className="mt-4 flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {deals.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            No negotiation-stage deals need action.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {deals.slice(0, 5).map((lead) => (
              <Link
                key={lead.id}
                href={`/app/leads/${lead.id}`}
                className="group grid gap-3 p-4 text-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-slate-800 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                aria-label={`Progress ${leadName(lead)}`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-medium text-slate-950 dark:text-slate-50">
                    <CircleDollarSign className="size-4 text-emerald-500" aria-hidden />
                    {leadName(lead)}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Last interaction: {formatInteraction(lead.last_interaction_at)}
                  </span>
                </span>
                <span className="w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {lead.status ?? "Negotiation"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function MonthlyGoal({
  targetProgress,
  personalProgress,
}: {
  targetProgress: TargetProgressData;
  personalProgress?: TargetProgressData | null;
}) {
  const displayProgress = personalProgress ?? targetProgress;
  const percent =
    displayProgress.progress_ratio === null
      ? null
      : Math.min(Math.round(displayProgress.progress_ratio * 100), 100);

  return (
    <section
      aria-label="Monthly Goal"
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <CardHeader
        title="Monthly Goal"
        description="Read-only progress against your commission target."
      />
      <div className="mt-5 flex flex-1 flex-col justify-between gap-5">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {percent === null ? "-" : `${percent}%`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {displayProgress.target_amount
                  ? `RM ${formatCommission(displayProgress.current_amount)} of RM ${formatCommission(displayProgress.target_amount)}`
                  : `RM ${formatCommission(displayProgress.current_amount)} booked`}
              </p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Target className="size-5" aria-hidden />
            </span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
        </div>
        {targetProgress.scope === "team" && personalProgress ? (
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
              <BadgeCheck className="size-4" aria-hidden />
              Personal progress shown; team target remains visible in KPIs.
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
