"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  LineChartIcon,
  MessageSquareText,
  MoreHorizontal,
  Percent,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type DrawerTab = "overview" | "performance";

type CurrentUser = {
  role?: string | null;
};

type KpiMetric = {
  count?: number;
  value?: string | number | null;
  weighted_value?: string | number | null;
  target_amount?: string | number | null;
  current_amount?: string | number | null;
  progress_ratio?: number | null;
  change?: number | null;
};

type ChartDatum = {
  period?: string;
  stage?: string;
  count?: number;
  commission?: string | number;
};

type TeamPerformanceRow = {
  ren_id: string;
  name: string;
  email: string;
  phone_number?: string | null;
  role?: string | null;
  active_status: boolean;
  avatar_initials: string;
  active_pipeline: number;
  activity: {
    completed_viewings: number;
    upcoming_viewings: number;
    closed_won_mtd: number;
  };
  financial: {
    commission_mtd: string | number;
    conversion_rate?: number | null;
  };
  trend: ChartDatum[];
};

type CoachingNote = {
  id: string;
  body: string;
  created_at: string;
  author?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type SelectedMember = {
  ren_id: string;
  not_found?: boolean;
  name?: string | null;
  avatar_initials?: string | null;
  status?: string | null;
  contact?: {
    full_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
    active_status?: boolean | null;
  };
  commission_configuration?: {
    commission_rate?: string | number | null;
    monthly_target_amount?: string | number | null;
  };
  targets?: {
    target_amount?: string | number | null;
    current_amount?: string | number | null;
    progress_ratio?: number | null;
  };
  performance?: TeamPerformanceRow & {
    pipeline_distribution: ChartDatum[];
    performance_trend: ChartDatum[];
    commission_trend: ChartDatum[];
  };
  notes?: CoachingNote[];
};

type ManagerWorkspace = {
  kpis: {
    closed_won_mtd: KpiMetric;
    commission_mtd: KpiMetric;
    active_pipeline_value: KpiMetric;
    team_conversion: KpiMetric;
    target_attainment: KpiMetric;
  };
  analytics: {
    pipeline_distribution: ChartDatum[];
    performance_trend: ChartDatum[];
    commission_trend: ChartDatum[];
  };
  team_performance: TeamPerformanceRow[];
  alerts: {
    follow_ups_due: { count: number; href: string };
    upcoming_viewings: { count: number; href: string };
    deals_closing_soon: { count: number; href: string };
  };
  selected_member: SelectedMember | null;
};

type DrawerForm = {
  full_name: string;
  phone_number: string;
  commission_rate: string;
  monthly_target_amount: string;
};

const CHART_COLORS = ["#0F172A", "#334155", "#64748B", "#94A3B8", "#CBD5E1"];
const CHART_PRIMARY = "#0F172A";
const CHART_GRID = "#E2E8F0";

function numberValue(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-MY", { day: "2-digit", month: "short" });
}

function stageLabel(value?: string | null) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function KpiCard({
  icon: Icon,
  title,
  value,
  subtext,
  change,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  subtext?: string;
  change?: number | null;
}) {
  const trend =
    change === null || change === undefined
      ? { label: "No prior data", tone: "text-slate-500", Icon: MoreHorizontal }
      : change >= 0
        ? { label: `${Math.round(change * 100)}% vs last`, tone: "text-emerald-600", Icon: TrendingUp }
        : { label: `${Math.round(Math.abs(change) * 100)}% vs last`, tone: "text-rose-600", Icon: TrendingDown };
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {value}
          </p>
          {subtext ? <p className="mt-1 text-xs text-slate-500">{subtext}</p> : null}
          <p className={`mt-3 flex items-center gap-1 text-xs font-medium ${trend.tone}`}>
            <trend.Icon className="h-3.5 w-3.5" />
            {trend.label}
          </p>
        </div>
      </div>
    </article>
  );
}

function AnalyticsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="h-56">{children}</div>
    </section>
  );
}

function Sparkline({ data }: { data: ChartDatum[] }) {
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="commission"
            dot={false}
            stroke={CHART_PRIMARY}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProgressBar({ value }: { value?: number | null }) {
  const width = Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        className="h-full rounded-full bg-slate-900 dark:bg-slate-100"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default function ManagerDashboardPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedRenId = searchParams.get("ren");
  const drawerTab = (searchParams.get("tab") === "performance"
    ? "performance"
    : "overview") as DrawerTab;
  const [workspace, setWorkspace] = useState<ManagerWorkspace | null>(null);
  const [form, setForm] = useState<DrawerForm | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notAuthorized, setNotAuthorized] = useState(false);

  async function loadWorkspace() {
    const token = await getToken();
    const me = await apiFetch<CurrentUser>("/users/me", token);
    if (me.role !== "MANAGER") {
      setNotAuthorized(true);
      setLoading(false);
      return;
    }
    const query = selectedRenId ? `?ren=${selectedRenId}` : "";
    const data = await apiFetch<ManagerWorkspace>(`/manager/workspace${query}`, token);
    setWorkspace(data);
    const selected = data.selected_member;
    if (selected && !selected.not_found) {
      setForm({
        full_name: selected.contact?.full_name ?? selected.name ?? "",
        phone_number: selected.contact?.phone_number ?? "",
        commission_rate: String(selected.commission_configuration?.commission_rate ?? ""),
        monthly_target_amount: String(
          selected.commission_configuration?.monthly_target_amount ?? ""
        ),
      });
    } else {
      setForm(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    void loadWorkspace().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load manager workspace");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, selectedRenId]);

  const selectedMember = workspace?.selected_member ?? null;
  const rows = workspace?.team_performance ?? [];
  const hasPendingEdits = useMemo(() => {
    if (!selectedMember || !form) return false;
    return (
      form.full_name !== (selectedMember.contact?.full_name ?? selectedMember.name ?? "") ||
      form.phone_number !== (selectedMember.contact?.phone_number ?? "") ||
      form.commission_rate !== String(selectedMember.commission_configuration?.commission_rate ?? "") ||
      form.monthly_target_amount !==
        String(selectedMember.commission_configuration?.monthly_target_amount ?? "")
    );
  }, [form, selectedMember]);

  function selectRen(renId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ren", renId);
    params.delete("tab");
    router.push(`/app/manager?${params.toString()}`);
  }

  function closeDrawer() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ren");
    params.delete("tab");
    router.push(params.toString() ? `/app/manager?${params.toString()}` : "/app/manager");
  }

  function setTab(tab: DrawerTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/app/manager?${params.toString()}`);
  }

  async function saveMember(nextActiveStatus?: boolean) {
    if (!selectedMember || !form) return;
    const originalRate = numberValue(selectedMember.commission_configuration?.commission_rate);
    const nextRate = numberValue(form.commission_rate);
    const relativeDelta =
      originalRate === 0 ? 0 : Math.abs(nextRate - originalRate) / originalRate;
    if (
      nextActiveStatus === undefined &&
      relativeDelta > 0.25 &&
      !window.confirm("Commission rate changed by more than 25%. Save anyway?")
    ) {
      return;
    }
    const token = await getToken();
    await apiFetch(`/users/${selectedMember.ren_id}`, token, {
      method: "PATCH",
      body: JSON.stringify({
        full_name: form.full_name,
        phone_number: form.phone_number || null,
        commission_rate: form.commission_rate ? Number(form.commission_rate) : null,
        monthly_target_amount: form.monthly_target_amount
          ? Number(form.monthly_target_amount)
          : null,
        ...(nextActiveStatus === undefined ? {} : { active_status: nextActiveStatus }),
      }),
    });
    await loadWorkspace();
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMember || !noteBody.trim()) return;
    const token = await getToken();
    await apiFetch(`/manager/team/${selectedMember.ren_id}/notes`, token, {
      method: "POST",
      body: JSON.stringify({ body: noteBody }),
    });
    setNoteBody("");
    await loadWorkspace();
  }

  async function deleteNote(noteId: string) {
    if (!selectedMember || !window.confirm("Delete this coaching note?")) return;
    const token = await getToken();
    await apiFetch(`/manager/team/${selectedMember.ren_id}/notes/${noteId}`, token, {
      method: "DELETE",
    });
    await loadWorkspace();
  }

  if (notAuthorized) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-50">Not authorized</h2>
        <p className="mt-2 text-sm text-slate-500">
          The manager command centre is available to manager accounts only.
        </p>
      </div>
    );
  }

  if (loading && !workspace) {
    return <p className="text-sm text-slate-500">Loading manager workspace...</p>;
  }

  return (
    <div className="flex gap-6">
      <section className="min-w-0 flex-1 space-y-6">
        {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

        {workspace ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                icon={CheckCircle2}
                title="Closed Won MTD"
                value={`${workspace.kpis.closed_won_mtd.count ?? 0} deals`}
                subtext={formatCurrency(workspace.kpis.closed_won_mtd.value)}
                change={workspace.kpis.closed_won_mtd.change}
              />
              <KpiCard
                icon={CircleDollarSign}
                title="Commission MTD"
                value={formatCurrency(workspace.kpis.commission_mtd.value)}
                change={workspace.kpis.commission_mtd.change}
              />
              <KpiCard
                icon={BriefcaseBusiness}
                title="Active Pipeline"
                value={formatCurrency(workspace.kpis.active_pipeline_value.value)}
                subtext={`Weighted ${formatCurrency(
                  workspace.kpis.active_pipeline_value.weighted_value
                )}`}
              />
              <KpiCard
                icon={Percent}
                title="Team Conversion"
                value={formatPercent(
                  workspace.kpis.team_conversion.value === null ||
                    workspace.kpis.team_conversion.value === undefined
                    ? null
                    : numberValue(workspace.kpis.team_conversion.value)
                )}
                change={workspace.kpis.team_conversion.change}
              />
              <KpiCard
                icon={Target}
                title="Target Attainment"
                value={formatPercent(workspace.kpis.target_attainment.progress_ratio)}
                subtext={
                  workspace.kpis.target_attainment.target_amount
                    ? `${formatCurrency(
                        workspace.kpis.target_attainment.current_amount
                      )} / ${formatCurrency(workspace.kpis.target_attainment.target_amount)}`
                    : "No target set"
                }
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <AnalyticsCard
                title="Pipeline Distribution"
                description="Team deals by stage"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workspace.analytics.pipeline_distribution}
                      dataKey="count"
                      nameKey="stage"
                      innerRadius={54}
                      outerRadius={82}
                      paddingAngle={3}
                    >
                      {workspace.analytics.pipeline_distribution.map((item, index) => (
                        <Cell
                          key={item.stage ?? index}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, stageLabel(String(name))]} />
                  </PieChart>
                </ResponsiveContainer>
              </AnalyticsCard>
              <AnalyticsCard title="Performance Trend" description="Closed-won deals by week">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={workspace.analytics.performance_trend}>
                    <CartesianGrid stroke={CHART_GRID} vertical={false} />
                    <XAxis dataKey="period" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(value) => formatDate(String(value))} />
                    <Line type="monotone" dataKey="count" stroke={CHART_PRIMARY} strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </AnalyticsCard>
              <AnalyticsCard title="Commission Trend" description="Team commission by month">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workspace.analytics.commission_trend}>
                    <CartesianGrid stroke={CHART_GRID} vertical={false} />
                    <XAxis dataKey="period" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(value) => `RM${Number(value) / 1000}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(String(value))} />
                    <Bar dataKey="commission" fill={CHART_PRIMARY} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </AnalyticsCard>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 p-5 dark:border-slate-800">
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                    Team Performance
                  </h3>
                  <p className="text-sm text-slate-500">
                    Select a REN to open their management drawer.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-5 py-3">Team member</th>
                        <th className="px-5 py-3">Pipeline</th>
                        <th className="px-5 py-3">Activity</th>
                        <th className="px-5 py-3">Financial</th>
                        <th className="px-5 py-3">Trend</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 dark:text-slate-200">
                      {rows.map((row) => (
                        <tr
                          key={row.ren_id}
                          className={`cursor-pointer border-t border-slate-200 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${
                            selectedRenId === row.ren_id
                              ? "bg-slate-100 dark:bg-slate-800"
                              : ""
                          }`}
                          onClick={() => selectRen(row.ren_id)}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                                {row.avatar_initials}
                              </span>
                              <div>
                                <p className="font-medium text-slate-950 dark:text-slate-50">
                                  {row.name}
                                </p>
                                <p className="text-xs text-slate-500">{row.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-950 dark:text-slate-50">
                              {row.active_pipeline} active
                            </p>
                            <p className="text-xs text-slate-500">Open workload</p>
                          </td>
                          <td className="px-5 py-4">
                            <p>{row.activity.completed_viewings} completed viewings</p>
                            <p className="text-xs text-slate-500">
                              {row.activity.upcoming_viewings} upcoming ·{" "}
                              {row.activity.closed_won_mtd} won MTD
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-950 dark:text-slate-50">
                              {formatCurrency(row.financial.commission_mtd)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatPercent(row.financial.conversion_rate)} conversion
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <Sparkline data={row.trend} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectRen(row.ren_id);
                              }}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className="space-y-4">
                <AlertCard
                  icon={AlertTriangle}
                  title="Follow-ups Due"
                  value={workspace.alerts.follow_ups_due.count}
                  href={workspace.alerts.follow_ups_due.href}
                />
                <AlertCard
                  icon={CalendarClock}
                  title="Upcoming Viewings"
                  value={workspace.alerts.upcoming_viewings.count}
                  href={workspace.alerts.upcoming_viewings.href}
                />
                <AlertCard
                  icon={LineChartIcon}
                  title="Deals Closing Soon"
                  value={workspace.alerts.deals_closing_soon.count}
                  href={workspace.alerts.deals_closing_soon.href}
                />
              </aside>
            </section>
          </>
        ) : null}
      </section>

      {selectedMember ? (
        <TeamMemberDrawer
          tab={drawerTab}
          selectedMember={selectedMember}
          form={form}
          noteBody={noteBody}
          hasPendingEdits={hasPendingEdits}
          onClose={closeDrawer}
          onTabChange={setTab}
          onFormChange={setForm}
          onNoteBodyChange={setNoteBody}
          onSave={() => void saveMember()}
          onToggleStatus={(nextStatus) => void saveMember(nextStatus)}
          onAddNote={(event) => void addNote(event)}
          onDeleteNote={(noteId) => void deleteNote(noteId)}
        />
      ) : null}
    </div>
  );
}

function AlertCard({
  icon: Icon,
  title,
  value,
  href,
}: {
  icon: LucideIcon;
  title: string;
  value: number;
  href: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-medium text-slate-950 dark:text-slate-50">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-50">
            {value}
          </p>
          <Link
            className="mt-3 inline-block text-xs font-medium text-slate-700 underline-offset-2 transition hover:text-slate-950 hover:underline dark:text-slate-200 dark:hover:text-slate-50"
            href={href}
          >
            Review queue
          </Link>
        </div>
      </div>
    </article>
  );
}

function TeamMemberDrawer({
  tab,
  selectedMember,
  form,
  noteBody,
  hasPendingEdits,
  onClose,
  onTabChange,
  onFormChange,
  onNoteBodyChange,
  onSave,
  onToggleStatus,
  onAddNote,
  onDeleteNote,
}: {
  tab: DrawerTab;
  selectedMember: SelectedMember;
  form: DrawerForm | null;
  noteBody: string;
  hasPendingEdits: boolean;
  onClose: () => void;
  onTabChange: (tab: DrawerTab) => void;
  onFormChange: (form: DrawerForm) => void;
  onNoteBodyChange: (value: string) => void;
  onSave: () => void;
  onToggleStatus: (nextStatus: boolean) => void;
  onAddNote: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteNote: (noteId: string) => void;
}) {
  if (selectedMember.not_found) {
    return (
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[360px] shrink-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:block dark:border-slate-800 dark:bg-slate-900">
        <button
          className="float-right rounded-md border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          type="button"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
          Team member not found
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          This REN could not be found in the current team.
        </p>
      </aside>
    );
  }
  const active = selectedMember.contact?.active_status !== false;
  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:w-[370px] xl:shrink-0 xl:rounded-xl xl:shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
            {selectedMember.avatar_initials}
          </span>
          <div>
            <h3 className="font-semibold text-slate-950 dark:text-slate-50">
              {selectedMember.name}
            </h3>
            <p className="text-xs text-slate-500">{selectedMember.contact?.email}</p>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <button
          className="rounded-md border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          type="button"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 flex border-b border-slate-200 dark:border-slate-800">
        {(["overview", "performance"] as DrawerTab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`-mb-px px-3 py-2 text-sm font-medium capitalize transition ${
              tab === item
                ? "border-b-2 border-slate-900 text-slate-950 dark:border-slate-100 dark:text-slate-50"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
            onClick={() => onTabChange(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "overview" && form ? (
        <div className="mt-5 space-y-4 pb-20">
          <InfoCard title="Contact Information" icon={Users}>
            <label className="block text-xs font-medium text-slate-500">Full name</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              value={form.full_name}
              onChange={(event) => onFormChange({ ...form, full_name: event.target.value })}
            />
            <label className="mt-3 block text-xs font-medium text-slate-500">Phone</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              value={form.phone_number}
              onChange={(event) => onFormChange({ ...form, phone_number: event.target.value })}
            />
          </InfoCard>

          <InfoCard title="Commission Configuration" icon={CircleDollarSign}>
            <label className="block text-xs font-medium text-slate-500">Commission rate</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              type="number"
              step="0.001"
              value={form.commission_rate}
              onChange={(event) => onFormChange({ ...form, commission_rate: event.target.value })}
            />
            <label className="mt-3 block text-xs font-medium text-slate-500">Monthly target</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              type="number"
              value={form.monthly_target_amount}
              onChange={(event) =>
                onFormChange({ ...form, monthly_target_amount: event.target.value })
              }
            />
          </InfoCard>

          <InfoCard title="Targets" icon={Target}>
            <div className="flex justify-between text-sm text-slate-700 dark:text-slate-200">
              <span>{formatCurrency(selectedMember.targets?.current_amount)}</span>
              <span>{formatCurrency(selectedMember.targets?.target_amount)}</span>
            </div>
            <div className="mt-2">
              <ProgressBar value={selectedMember.targets?.progress_ratio} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {formatPercent(selectedMember.targets?.progress_ratio)} of monthly target
            </p>
          </InfoCard>

          <InfoCard title="Manager Notes" icon={MessageSquareText}>
            <form className="space-y-2" onSubmit={onAddNote}>
              <textarea
                className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                placeholder="Add a coaching note..."
                value={noteBody}
                onChange={(event) => onNoteBodyChange(event.target.value)}
              />
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                type="submit"
              >
                Add note
              </button>
            </form>
            <div className="mt-4 space-y-3">
              {selectedMember.notes?.length ? (
                selectedMember.notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  >
                    <p>{note.body}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{note.author?.full_name ?? note.author?.email ?? "Manager"}</span>
                      <button
                        type="button"
                        className="font-medium text-rose-600 transition hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                        onClick={() => onDeleteNote(note.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-slate-700">
                  No coaching notes yet. Add the first note to capture next steps.
                </p>
              )}
            </div>
          </InfoCard>
        </div>
      ) : null}

      {tab === "performance" ? (
        <div className="mt-5 space-y-4 pb-20">
          <InfoCard title="Pipeline Mix" icon={BarChart3}>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={selectedMember.performance?.pipeline_distribution ?? []}
                    dataKey="count"
                    nameKey="stage"
                    innerRadius={42}
                    outerRadius={68}
                  >
                    {(selectedMember.performance?.pipeline_distribution ?? []).map((item, index) => (
                      <Cell
                        key={item.stage ?? index}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, stageLabel(String(name))]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </InfoCard>
          <InfoCard title="Performance Trend" icon={LineChartIcon}>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedMember.performance?.performance_trend ?? []}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="period" tickFormatter={formatDate} tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="count" stroke={CHART_PRIMARY} strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </InfoCard>
          <InfoCard title="Commission Trend" icon={CircleDollarSign}>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedMember.performance?.commission_trend ?? []}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="period" tickFormatter={formatDate} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Bar dataKey="commission" fill={CHART_PRIMARY} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </InfoCard>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-slate-200 bg-white p-4 xl:absolute xl:inset-x-0 dark:border-slate-800 dark:bg-slate-900">
        <button
          className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          type="button"
          disabled={!hasPendingEdits}
          onClick={onSave}
        >
          Save
        </button>
        <button
          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          type="button"
          onClick={() => onToggleStatus(!active)}
        >
          {active ? "Deactivate" : "Reactivate"}
        </button>
      </div>
    </aside>
  );
}

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-700 dark:text-slate-200" />
        <h4 className="font-semibold text-slate-950 dark:text-slate-50">{title}</h4>
      </div>
      {children}
    </section>
  );
}
