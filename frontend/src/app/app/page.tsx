"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  FollowUpsQueue,
  KpiStrip,
  PipelineFunnel,
  QuickActions,
  RecentActivity,
  TodayAgenda,
  TodayTasksWidget,
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

type DashboardLead = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  last_interaction_at?: string | null;
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
  funnel: { stage: string; count: number; value: string }[];
  pipeline_conversion_rate: number | null;
  pipeline_conversion_denominator: number;
  recent_activity: {
    id: string;
    event_type: string;
    created_at: string;
    payload?: Record<string, unknown> | null;
  }[];
  tasks: {
    follow_ups_due: DashboardLead[];
    upcoming_viewings: {
      id: string;
      lead_id: string;
      property_id: string;
      scheduled_at: string;
      status: string;
    }[];
    deals_closing_soon: DashboardLead[];
  };
  kpis: {
    active_leads: number;
    properties_listed: number;
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
    const data = await apiFetch<Dashboard>(
      `/dashboard?${params.toString()}`,
      token
    );
    setDashboard(data);
  }

  useEffect(() => {
    void loadDashboard().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, dateRange]);

  if (!dashboard) {
    return (
      <p className="text-sm text-muted-foreground">
        {error ?? "Loading dashboard..."}
      </p>
    );
  }

  const targetProgressPercent =
    dashboard.target_progress.progress_ratio === null
      ? null
      : Math.min(
          Math.round(dashboard.target_progress.progress_ratio * 100),
          100
        );

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <TodayTasksWidget counts={dashboard.priority_counts} />
        <QuickActions />
      </section>

      <KpiStrip
        activeLeads={dashboard.kpis.active_leads}
        propertiesListed={dashboard.kpis.properties_listed}
        dealsClosed={dashboard.kpis.deals_closed}
        monthlyCommission={dashboard.kpis.monthly_commission}
        followUpsDue={dashboard.kpis.follow_ups_due}
        targetProgressPercent={targetProgressPercent}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <TodayAgenda items={dashboard.today_agenda} />
        <RecentActivity
          items={dashboard.recent_activity}
          dateRange={dashboard.target_progress.date_range}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PipelineFunnel
          stages={dashboard.funnel}
          conversionRate={dashboard.pipeline_conversion_rate}
        />
        <FollowUpsQueue items={dashboard.tasks.follow_ups_due} />
      </section>
    </div>
  );
}
