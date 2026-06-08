## 1. Backend payload (lightweight match signal)

- [x] 1.1 In `GET /dashboard`, reuse the active `lead_properties` link map already computed for the funnel to derive in-flight leads with no active linked property.
- [x] 1.2 Expose these as a new payload field (e.g. `tasks.leads_needing_property_match`) with the lead fields the card needs (`id`, `name`, `status`, `last_interaction_at`).
- [x] 1.3 Ensure scoping matches the rest of the payload (current REN unless manager/team scope) and add a backend test covering the new field.

## 2. Dashboard widgets

- [x] 2.1 Add a `HotProspects` widget that lists `Proposal`/`Negotiation` leads ordered by most recent interaction, each linking to the lead record.
- [x] 2.2 Add a `RecommendedPropertyMatches` widget that lists leads needing a property match, each linking to the lead record with an attach-property affordance.
- [x] 2.3 Add a `DealsRequiringProgression` widget from negotiation-stage leads, linking into the deals/leads workspace.
- [x] 2.4 Add a `MonthlyGoal` widget showing read-only commission-vs-target progress (personal, plus team where scope applies).
- [x] 2.5 Update `PipelineFunnel` to a compact, glanceable summary card and confirm it carries no large/decorative chart.
- [x] 2.6 Remove the standalone `TodayTasksWidget` (three-row action panel) now that its counts live in the KPI strip and operational workspace.

## 3. Page layout / ordering

- [x] 3.1 Re-order `frontend/src/app/app/page.tsx` into the five journey sections: KPI strip, operational workspace, opportunity management, recent activity, quick actions.
- [x] 3.2 Build the operational workspace row (follow-ups due, today's schedule, hot prospects) with equal-height cards.
- [x] 3.3 Build the opportunity-management row (recommended property matches, deals requiring progression, monthly goal) with equal-height cards, plus the compact pipeline summary.
- [x] 3.4 Place recent activity and the quick-actions section last.
- [x] 3.5 Apply design-system constraints: 8px spacing, 12px card radius, white surfaces on light-grey background, status badges over coloured text, max two major columns per row.

## 4. Navigation wiring

- [x] 4.1 Confirm every card links into the correct workspace (Leads, Properties, Viewings, Deals, Campaigns, Timeline, Tasks) with working filtered URLs.
- [x] 4.2 Verify quick-create actions still open their wizards and that the global top-bar create menu remains available.

## 5. Tests and verification

- [x] 5.1 Add/update frontend tests for the new section order and the four new/updated cards (rendering + links).
- [x] 5.2 Add/update frontend tests for empty states (no follow-ups, no hot prospects, no matches, no deals).
- [x] 5.3 Run backend tests for the dashboard payload (including the new match-signal field).
- [x] 5.4 Run frontend typecheck and lint.
- [x] 5.5 Run `openspec validate redesign-dashboard-command-centre --strict` and fix any issues.
