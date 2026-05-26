"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  KpiStrip,
  PipelineFunnel,
  PriorityCards,
  QuickActions,
  RecentActivity,
  SectionTitle,
  TargetProgress,
  TodayAgenda,
} from "@/components/dashboard/dashboard-widgets";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type TargetProgressData = {
  scope: "personal" | "team";
  target_amount: string | null;
  current_amount: string;
  progress_ratio: number | null;
  date_range: string;
};

type Dashboard = {
  priority_counts: {
    overdue_follow_ups: number;
    viewings_today: number;
    deals_due: number;
  };
  today_agenda: {
    id: string;
    lead_id: string;
    property_id: string;
    scheduled_at: string;
    status: string;
  }[];
  target_progress: TargetProgressData;
  personal_progress: TargetProgressData | null;
  funnel: { stage: string; count: number }[];
  recent_activity: {
    id: string;
    event_type: string;
    created_at: string;
    payload?: Record<string, unknown> | null;
  }[];
  kpis: {
    active_leads: number;
    deals_closed: number;
    monthly_commission: string;
    follow_ups_due: number;
  };
};

export default function DashboardPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateRange = searchParams.get("date_range") ?? "month";

  async function loadDashboard() {
    const token = await getToken();
    const params = new URLSearchParams({ date_range: dateRange });
    const data = await apiFetch<Dashboard>(`/dashboard?${params.toString()}`, token);
    setDashboard(data);
  }

  useEffect(() => {
    void loadDashboard().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, dateRange]);

  async function saveTarget(scope: "personal" | "team", amount: string) {
    const token = await getToken();
    const endpoint = scope === "team" ? "/manager/team-target" : "/users/me";
    await apiFetch(endpoint, token, {
      method: "PATCH",
      body: JSON.stringify({ monthly_target_amount: Number(amount) }),
    });
    await loadDashboard();
  }

  if (!dashboard) {
    return (
      <p className="text-sm text-muted-foreground">
        {error ?? "Loading dashboard..."}
      </p>
    );
  }

  const isManager = dashboard.target_progress.scope === "team";
  const personal = dashboard.personal_progress;

  return (
    <div className="space-y-6">
      <KpiStrip
        followUpsOverdue={dashboard.kpis.follow_ups_due}
        viewingsToday={dashboard.priority_counts.viewings_today}
        dealsClosed={dashboard.kpis.deals_closed}
        activeLeads={dashboard.kpis.active_leads}
        monthlyCommission={dashboard.kpis.monthly_commission}
      />

      <SectionTitle
        title="See how your business is doing"
        description="Start with the work most likely to need action now."
      />
      <PriorityCards counts={dashboard.priority_counts} />

      <SectionTitle
        title="Quick Actions"
        description="Create the next record without leaving the dashboard."
      />
      <QuickActions />

      <TodayAgenda items={dashboard.today_agenda} />

      <PipelineFunnel stages={dashboard.funnel} />

      {isManager && personal ? (
        <section className="grid gap-6 lg:grid-cols-3">
          <TargetProgress
            scope="team"
            title="Team Monthly Target"
            targetAmount={dashboard.target_progress.target_amount}
            currentAmount={dashboard.target_progress.current_amount}
            progressRatio={dashboard.target_progress.progress_ratio}
            dateRange={dashboard.target_progress.date_range}
            onSaveTarget={(amount) => saveTarget("team", amount)}
          />
          <TargetProgress
            scope="personal"
            title="Your Monthly Target"
            targetAmount={personal.target_amount}
            currentAmount={personal.current_amount}
            progressRatio={personal.progress_ratio}
            dateRange={personal.date_range}
            onSaveTarget={(amount) => saveTarget("personal", amount)}
          />
          <RecentActivity
            items={dashboard.recent_activity}
            dateRange={dashboard.target_progress.date_range}
          />
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
          <TargetProgress
            scope={dashboard.target_progress.scope}
            targetAmount={dashboard.target_progress.target_amount}
            currentAmount={dashboard.target_progress.current_amount}
            progressRatio={dashboard.target_progress.progress_ratio}
            dateRange={dashboard.target_progress.date_range}
            onSaveTarget={(amount) =>
              saveTarget(dashboard.target_progress.scope, amount)
            }
          />
          <RecentActivity
            items={dashboard.recent_activity}
            dateRange={dashboard.target_progress.date_range}
          />
        </section>
      )}
    </div>
  );
}
