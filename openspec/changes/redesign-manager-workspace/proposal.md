## Why

The current Manager page is the last major module that has not been redesigned to the ROOMAH master-detail workspace pattern used by Leads, Properties, Campaigns, Viewings, and Deals. It is a navigation-heavy 8-column grid with inline `<input>` editing and a stub `/manager/ren/<renId>` detail page, so it cannot serve as a management command centre. `resources/team manager.json` defines an executive workspace that gives team leads a real-time read on team performance, pipeline health, commissions, operational risks, and coaching opportunities, all without leaving the page.

## What Changes

- Replace the current `/app/manager` table with a ROOMAH master-detail workspace built around executive KPIs, management analytics, a team performance table, an operational alerts rail, and a persistent right-side team member drawer.
- Keep the left application navigation and overall slate palette unchanged while applying the card-based spacing, soft pill badges, sticky-header table, and structured visual hierarchy from `resources/team manager.json`.
- Use a five-card executive KPI summary for Closed Won (MTD), Commission MTD, Active Pipeline Value (with weighted pipeline subtext), Team Conversion %, and Target Attainment vs. team monthly target, each with a month-over-month change indicator and an icon on the left.
- Add a three-column analytics row with a Pipeline Distribution donut chart (deal stages across the team), a Performance Trend line chart (weekly closed-won count over the last 12 weeks), and a Commission Trend bar chart (monthly commission over the last 6 months).
- Add a 70/30 team performance section pairing a Team Performance table on the left with a stacked Operational Alerts rail on the right surfacing follow-ups due, upcoming viewings, and deals closing soon.
- Make the Team Performance table the primary management workspace with sticky header, soft borders, hover state, selected-row highlight, and columns for team member (avatar + name), pipeline (active workload), activity (viewings + deals + performance metrics), financial (commission + conversion %), trend (mini sparkline), and an overflow actions menu.
- Replace `/app/manager/ren/[renId]` as the primary interaction model with deep-linked drawer selection via `/app/manager?ren=<id>&tab=<tab>` and redirect existing REN detail URLs into the workspace so shared links still open the selected team member context.
- Add a persistent right-side Team Member drawer that opens only when a REN is selected, contains a member header (avatar, name, role badge, active/inactive status), an underline tab strip with Overview and Performance tabs, and a sticky action footer for save, deactivate/reactivate, and close controls.
- In the Overview tab, render four stacked information cards: Contact Information (key-value), Commission Configuration (commission rate + monthly target, both editable), Targets (monthly commission target + month-to-date attainment progress), and Manager Notes (chronological coaching note stream with inline composer).
- In the Performance tab, render the selected REN's pipeline distribution, recent activity counters, weighted pipeline value, closed-won MTD, commission MTD, target attainment, and trend sparkline at REN scope so managers can compare individual performance against team aggregates without navigating away.
- Add coaching notes: persistent, append-only manager-authored notes scoped to a REN that appear in the drawer Manager Notes card with author and timestamp, backed by a new `coaching_notes` table and manager-only API endpoints.
- Extend the existing manager admin update path so commission rate and monthly target amount can be edited per REN from the drawer using the existing `PATCH /users/{user_id}` route, while preserving the rule that RENs cannot edit their own commission rate.
- Add a `GET /manager/workspace` endpoint that hydrates the workspace in one round-trip with team-level KPIs, analytics series, per-REN performance rows, operational alerts, and the selected REN's drawer payload (contact, commission, targets, recent notes, performance breakdown).
- Add `recharts` as a chart dependency so the analytics row can render the donut, line, and bar charts with the soft brand palette and minimal gridlines required by the design.
- **BREAKING**: `/app/manager/ren/[renId]` no longer renders an independent page; it redirects to `/app/manager?ren=<id>` to preserve deep links.
- Row Level Security remains the existing team-scoped model (REN sees own records, MANAGER sees the entire team) for the MVP. Hierarchical per-manager sub-team scoping is intentionally out of scope and captured as a forward-looking design note rather than a schema change.

## Capabilities

### New Capabilities
<!-- None. This change extends the existing team-management capability. -->

### Modified Capabilities
- `team-management`: Manager dashboard listing, REN drilldown, and target updates are extended to support a master-detail management command centre with executive KPIs, management analytics, a team performance table, operational alerts, a persistent team member drawer, coaching notes, commission configuration edits, and a hydrated workspace endpoint.

## Impact

- **Frontend**: Rewrites `frontend/src/app/app/manager/page.tsx`, replaces `frontend/src/app/app/manager/ren/[renId]/page.tsx` with a redirect into the workspace, and introduces manager workspace helpers for KPI cards, analytics charts, team performance table, operational alerts, and the team member drawer with Overview and Performance tabs.
- **Backend**: Adds a hydrated `GET /manager/workspace` endpoint in `backend/app/routes/manager.py`, extends `UserAdminUpdate` in `backend/app/routes/users.py` to allow manager-authored commission rate and monthly target edits, and adds coaching notes endpoints (`GET /manager/team/{ren_id}/notes`, `POST /manager/team/{ren_id}/notes`, `DELETE /manager/team/{ren_id}/notes/{note_id}`) gated by the `require_manager` helper.
- **Data model**: Adds a `coaching_notes` table (id, team_id, ren_id, manager_id, body, created_at, updated_at) with team-scoped RLS that restricts select/insert/delete to users whose JWT role is `MANAGER` on the matching team. No changes to `users`, `leads`, `properties`, `viewings`, `deals`, or `timeline_events` schemas.
- **Dependencies**: Adds `recharts` to the frontend package for executive donut, line, and bar charts.
- **OpenSpec**: Adds a team-management spec delta, implementation design, and task list under `openspec/changes/redesign-manager-workspace/`.
- **Existing behavior**: `GET /manager/dashboard` and `GET /manager/campaigns` remain available for backward compatibility while the new workspace endpoint becomes the primary data source for the redesigned page.
- **Out of scope**: Shell-wide color palette changes, hierarchical per-manager sub-team RLS, replacing the existing team-wide manager reassignment behavior, multi-tenant team isolation beyond the existing single-team scaffold, building a full BI/reporting dashboard, exporting analytics, and changes to Leads / Properties / Campaigns / Viewings / Deals workspaces.
