import { render } from "@testing-library/react";
import { expect } from "vitest";

import { DashboardContent, type Dashboard } from "./page";

const defaultDashboard: Dashboard = {
  priority_counts: {
    overdue_follow_ups: 1,
    viewings_today: 1,
    deals_due: 1,
  },
  today_agenda: [
    {
      id: "viewing-1",
      lead_id: "lead-schedule",
      property_id: "property-1",
      scheduled_at: "2026-06-08T10:00:00.000Z",
      status: "scheduled",
    },
  ],
  target_progress: {
    scope: "personal",
    target_amount: "500000",
    current_amount: "125000",
    progress_ratio: 0.25,
    date_range: "month",
  },
  personal_progress: null,
  funnel: [
    { stage: "New", count: 2, value: "300000" },
    { stage: "Contacted", count: 1, value: "200000" },
    { stage: "Qualified", count: 1, value: "250000" },
    { stage: "Proposal", count: 1, value: "400000" },
    { stage: "Negotiation", count: 1, value: "500000" },
    { stage: "Won", count: 1, value: "450000" },
  ],
  pipeline_conversion_rate: 0.2,
  pipeline_conversion_denominator: 5,
  recent_activity: [
    {
      id: "activity-1",
      event_type: "manual_call",
      created_at: "2026-06-08T09:00:00.000Z",
      payload: null,
    },
  ],
  tasks: {
    follow_ups_due: [
      {
        id: "lead-follow-up",
        name: "Maria Buyer",
        phone: "60100000000",
        email: "maria@example.com",
        status: "Contacted",
        last_interaction_at: "2026-06-05T09:00:00.000Z",
      },
    ],
    upcoming_viewings: [],
    deals_closing_soon: [
      {
        id: "lead-deal",
        name: "Sophia Deal",
        phone: "60100000001",
        email: "sophia@example.com",
        status: "Negotiation",
        last_interaction_at: "2026-06-07T09:00:00.000Z",
      },
    ],
    hot_prospects: [
      {
        id: "lead-hot",
        name: "Daniel Prospect",
        phone: "60100000003",
        email: "daniel@example.com",
        status: "Proposal",
        last_interaction_at: "2026-06-08T09:00:00.000Z",
      },
    ],
    leads_needing_property_match: [
      {
        id: "lead-match",
        name: "Priya Match",
        phone: "60100000002",
        email: "priya@example.com",
        status: "Qualified",
        last_interaction_at: "2026-06-06T09:00:00.000Z",
      },
    ],
  },
  kpis: {
    active_leads: 12,
    properties_listed: 8,
    deals_closed: 3,
    monthly_commission: "125000",
    follow_ups_due: 1,
  },
};

type DashboardOverrides = Partial<
  Omit<Dashboard, "tasks"> & {
    tasks: Partial<Dashboard["tasks"]>;
  }
>;

function mergeDashboard(overrides: DashboardOverrides): Dashboard {
  return {
    ...defaultDashboard,
    ...overrides,
    tasks: {
      ...defaultDashboard.tasks,
      ...overrides.tasks,
    },
  };
}

export class DashboardContentTestObject {
  render(overrides: DashboardOverrides = {}) {
    render(<DashboardContent dashboard={mergeDashboard(overrides)} />);
  }

  expectTextOrder(labels: string[]) {
    const pageText = document.body.textContent ?? "";
    const positions = labels.map((label) => pageText.indexOf(label));

    expect(positions).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  }
}
