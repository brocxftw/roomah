import "@testing-library/jest-dom/vitest";

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardContentTestObject } from "./dashboard-content.to";

describe("DashboardContent", () => {
  it("renders the command centre sections in journey order with workflow links", () => {
    const page = new DashboardContentTestObject();
    page.render();

    page.expectTextOrder([
      "Active Leads",
      "Follow-ups Due",
      "Today's Schedule",
      "Hot Prospects",
      "Recommended Property Matches",
      "Deals Requiring Progression",
      "Monthly Goal",
      "Recent Activity",
      "Quick Create",
    ]);

    expect(screen.getByRole("link", { name: /call maria buyer/i })).toHaveAttribute(
      "href",
      "/app/leads/lead-follow-up"
    );
    expect(screen.getByRole("link", { name: /review daniel prospect/i })).toHaveAttribute(
      "href",
      "/app/leads/lead-hot"
    );
    expect(screen.getByRole("link", { name: /match inventory for priya/i })).toHaveAttribute(
      "href",
      "/app/leads/lead-match"
    );
    expect(screen.getByRole("link", { name: /progress sophia deal/i })).toHaveAttribute(
      "href",
      "/app/leads/lead-deal"
    );
    expect(screen.getByRole("link", { name: /add lead/i })).toHaveAttribute(
      "href",
      "/app/leads/new"
    );
  });

  it("drops the pipeline funnel and keeps the surface action-first", () => {
    const page = new DashboardContentTestObject();
    page.render();

    expect(screen.queryByText("Lifecycle Pipeline")).toBeNull();
    expect(screen.queryByText("Pipeline")).toBeNull();
    expect(screen.queryByText(/conversion rate/i)).toBeNull();
  });

  it("pairs recent activity with quick actions in one row", () => {
    const page = new DashboardContentTestObject();
    page.render();

    const row = screen.getByRole("region", { name: "Activity and actions" });
    expect(within(row).getByText("Recent Activity")).toBeVisible();
    expect(within(row).getByText("Quick Create")).toBeVisible();
  });

  it("renders recommendation-style match cards with an attach action and no score", () => {
    const page = new DashboardContentTestObject();
    page.render();

    const matches = screen.getByRole("region", {
      name: "Recommended Property Matches",
    });
    expect(
      within(matches).getByRole("link", { name: /match inventory for priya/i })
    ).toBeVisible();
    expect(within(matches).getByText(/attach property/i)).toBeVisible();
    expect(within(matches).queryByText(/%\s*match/i)).toBeNull();
  });

  it("shows a per-row quick action on operational cards", () => {
    const page = new DashboardContentTestObject();
    page.render();

    const followUps = screen.getByRole("region", { name: "Follow-ups Due" });
    expect(within(followUps).getByText(/^call$/i)).toBeVisible();

    const hot = screen.getByRole("region", { name: "Hot Prospects" });
    expect(within(hot).getByText(/^review$/i)).toBeVisible();
  });

  it("renders actionable empty states for quiet work queues", () => {
    const page = new DashboardContentTestObject();
    page.render({
      tasks: {
        follow_ups_due: [],
        upcoming_viewings: [],
        deals_closing_soon: [],
        hot_prospects: [],
        leads_needing_property_match: [],
      },
      today_agenda: [],
    });

    expect(screen.getByText("No overdue follow-ups.")).toBeVisible();
    expect(screen.getByText("No viewings scheduled for today.")).toBeVisible();
    expect(screen.getByText("No proposal or negotiation prospects right now.")).toBeVisible();
    expect(screen.getByText("Every in-flight lead has a property match.")).toBeVisible();
    expect(screen.getByText("No negotiation-stage deals need action.")).toBeVisible();
  });

  it("shows read-only monthly goal progress", () => {
    const page = new DashboardContentTestObject();
    page.render();

    const goal = screen.getByRole("region", { name: "Monthly Goal" });
    expect(within(goal).getByText("25%")).toBeVisible();
    expect(within(goal).getByText(/RM 125,000.00 of RM 500,000.00/i)).toBeVisible();
    expect(within(goal).queryByRole("textbox")).toBeNull();
  });
});
