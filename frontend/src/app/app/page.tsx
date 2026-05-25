"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";

type Dashboard = {
  tasks: {
    follow_ups_due: { id: string; name: string; last_interaction_at: string }[];
    upcoming_viewings: { id: string; scheduled_at: string; lead_id: string }[];
    deals_closing_soon: {
      id: string;
      name: string;
      last_interaction_at: string;
    }[];
  };
  kpis: {
    active_leads: number;
    properties_listed: number;
    deals_closed: number;
    monthly_commission: string;
    follow_ups_due: number;
    campaign_conversion_rate_month: number | null;
    top_performing_campaign_month?: {
      id: string;
      name: string;
      channel: string;
      leads_generated: number;
      conversions: number;
    } | null;
  };
};

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      const token = await getToken();
      const data = await apiFetch<Dashboard>("/dashboard", token);
      setDashboard(data);
    }

    void loadDashboard().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    });
  }, [getToken]);

  if (!dashboard) {
    return (
      <p className="text-sm text-muted-foreground">
        {error ?? "Loading dashboard..."}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">
          Today&apos;s Tasks
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <TaskCard
            title="Follow-ups Due"
            items={dashboard.tasks.follow_ups_due.map((lead) => ({
              id: lead.id,
              label: lead.name,
              href: `/app/leads/${lead.id}`,
            }))}
          />
          <TaskCard
            title="Upcoming Viewings"
            items={dashboard.tasks.upcoming_viewings.map((viewing) => ({
              id: viewing.id,
              label: new Date(viewing.scheduled_at).toLocaleString(),
              href: "/app/viewings",
            }))}
          />
          <TaskCard
            title="Deals Closing Soon"
            items={dashboard.tasks.deals_closing_soon.map((lead) => ({
              id: lead.id,
              label: lead.name,
              href: `/app/leads/${lead.id}`,
            }))}
          />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Quick Actions</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <QuickAction href="/app/leads/new" label="Add Lead" />
          <QuickAction href="/app/properties/new" label="Add Property" />
          <QuickAction href="/app/viewings/new" label="Schedule Viewing" />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold">KPI Summary</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-7">
          <Kpi label="Active Leads" value={dashboard.kpis.active_leads} />
          <Kpi
            label="Properties Listed"
            value={dashboard.kpis.properties_listed}
          />
          <Kpi label="Deals Closed" value={dashboard.kpis.deals_closed} />
          <Kpi
            label="Monthly Commission"
            value={`RM ${dashboard.kpis.monthly_commission}`}
          />
          <Kpi label="Follow-ups Due" value={dashboard.kpis.follow_ups_due} />
          <CampaignConversionRateCard
            value={dashboard.kpis.campaign_conversion_rate_month}
          />
          <TopPerformingCampaignCard
            campaign={dashboard.kpis.top_performing_campaign_month}
          />
        </div>
      </section>
    </div>
  );
}

function TaskCard({
  title,
  items,
}: {
  title: string;
  items: { id: string; label: string; href: string }[];
}) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block rounded-md bg-muted px-3 py-2 text-sm"
          >
            {item.label}
          </Link>
        ))}
        {!items.length ? (
          <p className="text-sm text-muted-foreground">Nothing due.</p>
        ) : null}
      </div>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
    >
      {label}
    </Link>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function CampaignConversionRateCard({ value }: { value: number | null }) {
  return (
    <Kpi
      label="Campaign Conversion Rate"
      value={value == null ? "-" : `${(value * 100).toFixed(0)}%`}
    />
  );
}

function TopPerformingCampaignCard({
  campaign,
}: {
  campaign?: {
    name: string;
    channel: string;
    leads_generated: number;
    conversions: number;
  } | null;
}) {
  if (!campaign) {
    return <Kpi label="Top Campaign" value="No conversions yet" />;
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">Top Campaign</p>
      <p className="mt-2 text-lg font-semibold">{campaign.name}</p>
      <p className="text-sm text-muted-foreground">
        {campaign.channel} · {campaign.leads_generated} leads ·{" "}
        {campaign.conversions} conversions
      </p>
    </div>
  );
}
