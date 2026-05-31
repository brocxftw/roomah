import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Flame,
  Home,
  Megaphone,
  Plus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type React from "react";

type IconComponent = React.ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
}>;

type Tone = "red" | "amber" | "emerald" | "blue" | "slate";

type KpiCard = {
  label: string;
  value: string | number;
  helper: string;
  icon: IconComponent;
  accent: Tone;
};

const accentStyles: Record<Tone, string> = {
  red: "bg-red-50 text-red-700 ring-red-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

const taskToneStyles: Record<Tone, string> = {
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  slate: "bg-slate-100 text-slate-700",
};

export function KpiStrip({
  activeLeads,
  propertiesListed,
  dealsClosed,
  monthlyCommission,
  followUpsDue,
  targetProgressPercent,
}: {
  activeLeads: number;
  propertiesListed: number;
  dealsClosed: number;
  monthlyCommission: string;
  followUpsDue: number;
  targetProgressPercent?: number | null;
}) {
  const cards: KpiCard[] = [
    {
      label: "Active Leads",
      value: activeLeads,
      helper: "In-flight customer conversations",
      icon: Users,
      accent: "blue",
    },
    {
      label: "Properties Listed",
      value: propertiesListed,
      helper: "Active inventory",
      icon: Home,
      accent: "slate",
    },
    {
      label: "Deals Closed",
      value: dealsClosed,
      helper: "This month",
      icon: CheckCircle2,
      accent: "emerald",
    },
    {
      label: "Monthly Commission",
      value: `RM ${monthlyCommission}`,
      helper:
        targetProgressPercent === null || targetProgressPercent === undefined
          ? "This month"
          : `${targetProgressPercent}% of target`,
      icon: Wallet,
      accent: "emerald",
    },
    {
      label: "Follow-ups Due",
      value: followUpsDue,
      helper: "Needs attention now",
      icon: Flame,
      accent: followUpsDue > 0 ? "red" : "slate",
    },
  ];

  return (
    <section
      aria-label="Business performance"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${accentStyles[card.accent]}`}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {card.value}
                </p>
                <p className="mt-2 text-xs text-slate-500">{card.helper}</p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function TodayTasksWidget({
  counts,
}: {
  counts: {
    overdue_follow_ups: number;
    viewings_today: number;
    deals_due: number;
  };
}) {
  const tasks = [
    {
      label: "Follow-ups Due",
      description: "Reconnect with leads that have gone quiet.",
      count: counts.overdue_follow_ups,
      href: "/app/leads?status=overdue",
      tone: "red" as const,
      icon: Flame,
    },
    {
      label: "Viewings Today",
      description: "Prepare, attend, and complete today's appointments.",
      count: counts.viewings_today,
      href: "/app/viewings?today=true",
      tone: "amber" as const,
      icon: CalendarDays,
    },
    {
      label: "Deals Closing Soon",
      description: "Move negotiation-stage leads toward a close.",
      count: counts.deals_due,
      href: "/app/deals?status=closing",
      tone: "emerald" as const,
      icon: Wallet,
    },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Today&apos;s Tasks
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Start with the work most likely to need action now.
          </p>
        </div>
      </div>
      <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
        {tasks.map((task) => {
          const Icon = task.icon;
          return (
            <Link
              key={task.label}
              href={task.href}
              className="group flex items-center gap-4 py-4 first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${taskToneStyles[task.tone]}`}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {task.label}
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  {task.description}
                </span>
              </span>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-slate-900 px-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                {task.count}
              </span>
              <ArrowRight
                className="size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

type QuickActionItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

export function QuickActions() {
  const actions: QuickActionItem[] = [
    { label: "Add Lead", href: "/app/leads/new", icon: UserPlus },
    { label: "Add Property", href: "/app/properties/new", icon: Home },
    {
      label: "Schedule Viewing",
      href: "/app/viewings/new",
      icon: CalendarDays,
    },
    { label: "Add Campaign", href: "/app/campaigns/new", icon: Megaphone },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Quick Create</h2>
        <p className="mt-1 text-sm text-slate-500">
          Create the next record without leaving the dashboard.
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="group flex min-h-28 flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex items-center justify-between gap-3">
                {action.label}
                <Plus
                  className="size-4 text-slate-400 transition group-hover:text-slate-700 dark:group-hover:text-slate-200"
                  aria-hidden
                />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

type AgendaItem = {
  id: string;
  lead_id: string;
  property_id: string;
  scheduled_at: string;
  status: string;
};

export function TodayAgenda({ items }: { items: AgendaItem[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Today&apos;s Appointments</h3>
          <p className="mt-1 text-xs text-slate-500">
            Scheduled viewings to prepare, attend, and complete today.
          </p>
        </div>
        <Link
          href="/app/viewings?today=true"
          className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
        >
          View all
        </Link>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            No viewings scheduled for today.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((item) => {
              const scheduled = new Date(item.scheduled_at);
              const timeLabel = scheduled.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={item.id}
                  className="grid gap-3 p-4 text-sm sm:grid-cols-[90px_minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="font-semibold text-slate-950 dark:text-slate-50">
                    {timeLabel}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      Viewing appointment
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Lead {item.lead_id.slice(0, 8)} · Property{" "}
                      {item.property_id.slice(0, 8)}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium capitalize text-amber-800">
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

type FunnelStage = { stage: string; count: number; value: string };

const funnelStyles: Record<string, { bar: string; bg: string; text: string }> =
  {
    New: { bar: "bg-sky-500", bg: "bg-sky-50", text: "text-sky-700" },
    Contacted: {
      bar: "bg-blue-500",
      bg: "bg-blue-50",
      text: "text-blue-700",
    },
    Qualified: {
      bar: "bg-indigo-500",
      bg: "bg-indigo-50",
      text: "text-indigo-700",
    },
    Proposal: {
      bar: "bg-purple-500",
      bg: "bg-purple-50",
      text: "text-purple-700",
    },
    Negotiation: {
      bar: "bg-amber-500",
      bg: "bg-amber-50",
      text: "text-amber-700",
    },
    Won: {
      bar: "bg-emerald-500",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
    },
  };

export function PipelineFunnel({
  stages,
  conversionRate,
}: {
  stages: FunnelStage[];
  conversionRate: number | null;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">Pipeline</h3>
          <p className="text-xs text-slate-500">
            Customer lifecycle progress by stage.
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-right dark:bg-slate-800">
          <p className="text-xs text-slate-500">Conversion Rate</p>
          <p className="text-sm font-semibold">
            {conversionRate === null
              ? "—"
              : `${(conversionRate * 100).toFixed(1)}%`}
          </p>
        </div>
      </div>
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Pipeline stage progression"
      >
        {stages.map((stage, index) => {
          const styles = funnelStyles[stage.stage] ?? {
            bar: "bg-slate-500",
            bg: "bg-slate-50",
            text: "text-slate-700",
          };
          return (
            <div key={stage.stage} className="relative">
              <div
                className={`h-full rounded-xl border border-slate-200 p-4 ${styles.bg} dark:border-slate-800`}
              >
                <p className={`text-sm font-semibold ${styles.text}`}>
                  {stage.stage}
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                  {stage.count}
                </p>
                <p className="mt-1 text-xs text-slate-500">RM {stage.value}</p>
                <div className="mt-4 h-1.5 rounded-full bg-white/80">
                  <div className={`h-full w-full rounded-full ${styles.bar}`} />
                </div>
              </div>
              {index < stages.length - 1 ? (
                <ArrowRight
                  className="absolute -right-2 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-slate-300 xl:block"
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

type ActivityItem = {
  id: string;
  event_type: string;
  created_at: string;
  payload?: Record<string, unknown> | null;
};

const eventLabels: Record<string, string> = {
  lead_created: "Lead created",
  property_linked: "Property linked",
  property_unlinked: "Property unlinked",
  lead_campaign_attributed: "Campaign attributed",
  lead_campaign_reattributed: "Campaign re-attributed",
  viewing_scheduled: "Viewing scheduled",
  viewing_completed: "Viewing completed",
  viewing_reassigned: "Viewing reassigned",
  deal_closed: "Deal closed",
  lead_status_changed: "Lead status changed",
  lead_reassigned: "Lead reassigned",
  manual_call: "Call logged",
  manual_note: "Note logged",
  manual_callback: "Callback scheduled",
};

export function RecentActivity({
  items,
  dateRange,
}: {
  items: ActivityItem[];
  dateRange: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Recent Activity</h3>
        <p className="text-xs text-slate-500">{dateRange}</p>
      </div>
      <ul className="mt-5 space-y-0">
        {items.slice(0, 5).map((item) => {
          const created = new Date(item.created_at);
          const label = eventLabels[item.event_type] ?? item.event_type;
          return (
            <li
              key={item.id}
              className="relative flex gap-3 border-l border-slate-200 pb-5 pl-5 last:border-l-transparent last:pb-0 dark:border-slate-800"
            >
              <span className="absolute -left-2 top-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-slate-400 ring-4 ring-white dark:bg-slate-900 dark:ring-slate-900">
                <CircleDot className="size-3" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
                  {label}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {created.toLocaleString()}
                </p>
              </div>
            </li>
          );
        })}
        {items.length === 0 ? (
          <li className="text-sm text-slate-500">No recent activity.</li>
        ) : null}
      </ul>
    </section>
  );
}

type FollowUpLead = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  last_interaction_at?: string | null;
};

export function FollowUpsQueue({ items }: { items: FollowUpLead[] }) {
  const sortedItems = [...items].sort((a, b) => {
    const aTime = a.last_interaction_at
      ? new Date(a.last_interaction_at).getTime()
      : 0;
    const bTime = b.last_interaction_at
      ? new Date(b.last_interaction_at).getTime()
      : 0;
    return aTime - bTime;
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Follow-ups Due</h3>
          <p className="mt-1 text-xs text-slate-500">
            Leads that need the next touchpoint.
          </p>
        </div>
        <Link
          href="/app/leads?status=overdue"
          className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
        >
          View all
        </Link>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {sortedItems.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No overdue follow-ups.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {sortedItems.slice(0, 6).map((lead) => {
              const lastInteraction = lead.last_interaction_at
                ? new Date(lead.last_interaction_at).toLocaleDateString()
                : "No recent interaction";
              return (
                <Link
                  key={lead.id}
                  href={`/app/leads/${lead.id}`}
                  className="grid gap-3 p-4 text-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-slate-800 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-950 dark:text-slate-50">
                      {lead.name ?? `Lead ${lead.id.slice(0, 8)}`}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Last interaction: {lastInteraction}
                    </span>
                  </span>
                  <span className="w-fit rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                    {lead.status ?? "Follow-up"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
