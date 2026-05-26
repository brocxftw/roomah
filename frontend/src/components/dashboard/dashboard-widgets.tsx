import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Flame,
  Home,
  Plus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { FormEvent, useState } from "react";
import type React from "react";

type KpiCard = {
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  accent: "red" | "amber" | "emerald" | "blue" | "slate";
};

const kpiAccent: Record<KpiCard["accent"], string> = {
  red: "text-red-600 bg-red-50",
  amber: "text-amber-600 bg-amber-50",
  emerald: "text-emerald-600 bg-emerald-50",
  blue: "text-blue-600 bg-blue-50",
  slate: "text-slate-700 bg-slate-100",
};

export function KpiStrip({
  followUpsOverdue,
  viewingsToday,
  dealsClosed,
  activeLeads,
  monthlyCommission,
}: {
  followUpsOverdue: number;
  viewingsToday: number;
  dealsClosed: number;
  activeLeads: number;
  monthlyCommission: string;
}) {
  const cards: KpiCard[] = [
    {
      label: "Follow-ups Overdue",
      value: followUpsOverdue,
      icon: Flame,
      accent: "red",
    },
    {
      label: "Viewings Today",
      value: viewingsToday,
      icon: CalendarDays,
      accent: "amber",
    },
    {
      label: "Deals Closed",
      value: dealsClosed,
      helper: "This month",
      icon: CheckCircle2,
      accent: "emerald",
    },
    {
      label: "Active Leads",
      value: activeLeads,
      icon: Users,
      accent: "blue",
    },
    {
      label: "This Month's Commission",
      value: `RM ${monthlyCommission}`,
      icon: Wallet,
      accent: "slate",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${kpiAccent[card.accent]}`}
              >
                <Icon className="size-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {card.value}
            </p>
            {card.helper ? (
              <p className="mt-1 text-xs text-slate-500">{card.helper}</p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

type PriorityCardProps = {
  title: string;
  count: number;
  href: string;
  tone: "red" | "amber" | "green";
  icon: "flame" | "calendar" | "wallet";
};

const toneStyles: Record<PriorityCardProps["tone"], string> = {
  red: "border-red-200 bg-red-50 text-red-900 hover:border-red-300",
  amber: "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300",
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300",
};

const priorityIcons = {
  flame: Flame,
  calendar: CalendarDays,
  wallet: Wallet,
};

export function PriorityCards({
  counts,
}: {
  counts: {
    overdue_follow_ups: number;
    viewings_today: number;
    deals_due: number;
  };
}) {
  const cards: PriorityCardProps[] = [
    {
      title: "Overdue Follow-ups",
      count: counts.overdue_follow_ups,
      href: "/app/leads?status=overdue",
      tone: "red",
      icon: "flame",
    },
    {
      title: "Viewings Today",
      count: counts.viewings_today,
      href: "/app/viewings?today=true",
      tone: "amber",
      icon: "calendar",
    },
    {
      title: "Deals Closing Soon",
      count: counts.deals_due,
      href: "/app/deals?status=closing",
      tone: "green",
      icon: "wallet",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = priorityIcons[card.icon];
        return (
          <Link
            key={card.title}
            href={card.href}
            className={`rounded-xl border p-4 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${toneStyles[card.tone]}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{card.title}</p>
              <Icon className="size-5" aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-semibold">{card.count}</p>
          </Link>
        );
      })}
    </section>
  );
}

export function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
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
    { label: "Add Campaign", href: "/app/campaigns/new", icon: Plus },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Icon className="size-4" aria-hidden />
            </span>
            {action.label}
          </Link>
        );
      })}
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
        <h3 className="text-base font-semibold">Today&apos;s Agenda</h3>
        <Link
          href="/app/viewings?today=true"
          className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
        >
          View all
        </Link>
      </div>
      <ul className="mt-4 space-y-3">
        {items.length === 0 ? (
          <li className="text-sm text-slate-500">
            No viewings scheduled for today.
          </li>
        ) : (
          items.map((item) => {
            const scheduled = new Date(item.scheduled_at);
            const timeLabel = scheduled.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800"
              >
                <div>
                  <p className="text-sm font-medium">Viewing at {timeLabel}</p>
                  <p className="text-xs text-slate-500">
                    Lead {item.lead_id.slice(0, 8)} · Property{" "}
                    {item.property_id.slice(0, 8)}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {item.status}
                </span>
              </li>
            );
          })
        )}
      </ul>
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

function pipelineInsight(stages: FunnelStage[]) {
  const drops = stages.slice(0, -1).map((stage, index) => {
    const nextStage = stages[index + 1];
    return {
      from: stage.stage,
      to: nextStage.stage,
      count: Math.max(stage.count - nextStage.count, 0),
    };
  });
  const largestDrop = drops.reduce(
    (largest, drop) => (drop.count > largest.count ? drop : largest),
    { from: "", to: "", count: 0 }
  );

  if (largestDrop.count > 0) {
    return {
      label: "Largest snapshot gap",
      title: `${largestDrop.from} to ${largestDrop.to}`,
      description: `${largestDrop.count} fewer ${
        largestDrop.count === 1 ? "lead" : "leads"
      } in ${largestDrop.to} than ${largestDrop.from}.`,
    };
  }

  const stalledStage = stages.reduce(
    (largest, stage) => (stage.count > largest.count ? stage : largest),
    stages[0] ?? { stage: "pipeline", count: 0, value: "0" }
  );

  return {
    label: "Stalled stage to watch",
    title: stalledStage.stage,
    description: stalledStage.count
      ? `${stalledStage.count} ${
          stalledStage.count === 1 ? "lead is" : "leads are"
        } currently concentrated here.`
      : "No active leads are currently in the pipeline snapshot.",
  };
}

export function PipelineFunnel({
  stages,
  conversionRate,
}: {
  stages: FunnelStage[];
  conversionRate: number | null;
}) {
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);
  const insight = pipelineInsight(stages);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">Pipeline</h3>
          <p className="text-xs text-slate-500">
            Lead snapshot by stage. Values reflect linked listing prices.
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
        <div className="space-y-3" aria-label="Pipeline filter graph">
          {stages.map((stage) => {
            const styles = funnelStyles[stage.stage] ?? {
              bar: "bg-slate-500",
              bg: "bg-slate-50",
              text: "text-slate-700",
            };
            const width = Math.max(
              Math.round((stage.count / maxCount) * 100),
              8
            );
            return (
              <div key={stage.stage} className="flex justify-center">
                <div
                  className={`w-full rounded-xl border border-slate-200 p-3 ${styles.bg} dark:border-slate-800`}
                  style={{ width: `${width}%` }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${styles.text}`}>
                        {stage.stage}
                      </p>
                      <p className="text-xs text-slate-500">
                        RM {stage.value}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {stage.count} {stage.count === 1 ? "lead" : "leads"}
                    </p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/80">
                    <div className={`h-full rounded-full ${styles.bar}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pipeline insight
          </p>
          <p className="mt-3 text-sm text-slate-500">{insight.label}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {insight.title}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {insight.description}
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Based on the current pipeline snapshot, not historical stage
            transitions.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function TargetProgress({
  scope,
  title,
  targetAmount,
  currentAmount,
  progressRatio,
  dateRange,
  onSaveTarget,
}: {
  scope: "personal" | "team";
  title?: string;
  targetAmount: string | null;
  currentAmount: string;
  progressRatio: number | null;
  dateRange: string;
  onSaveTarget: (amount: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const percent = Math.min(Math.round((progressRatio ?? 0) * 100), 100);
  const heading =
    title ??
    (scope === "team" ? "Team Monthly Target" : "Your Monthly Target");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!amount) return;
    setSaving(true);
    setMessage(null);
    try {
      await onSaveTarget(amount);
      setMessage("Target updated.");
      setAmount("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to update target."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{heading}</h3>
          <p className="text-xs text-slate-500">{dateRange}</p>
        </div>
        <p className="text-2xl font-semibold">{percent}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        RM {currentAmount} of {targetAmount ? `RM ${targetAmount}` : "no target"}
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Set new target (RM)"
          className="min-h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={saving || !amount}
          className="inline-flex min-h-10 items-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
      {message ? (
        <p className="mt-2 text-xs text-slate-500">{message}</p>
      ) : null}
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
      <ul className="mt-4 space-y-3">
        {items.slice(0, 5).map((item) => {
          const created = new Date(item.created_at);
          const label = eventLabels[item.event_type] ?? item.event_type;
          return (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-slate-500">
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
