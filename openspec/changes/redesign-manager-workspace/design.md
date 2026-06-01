## Context

The Manager experience today lives at `frontend/src/app/app/manager/page.tsx` as an 8-column flat table with inline `<input>` editing for `full_name` / `phone_number` and a separate stub `frontend/src/app/app/manager/ren/[renId]/page.tsx` that explicitly defers REN drilldown to a future pass. Backend coverage exists: `backend/app/routes/manager.py` exposes `GET /manager/dashboard` (per-REN pipeline + viewing count + commission + monthly trend), `PATCH /manager/team-target` (team-level target), and `GET /manager/campaigns` (per-channel rollup). RLS is already team-scoped via `supabase/migrations/202605241013_enable_rls_and_policies.sql`: a MANAGER's JWT grants team-wide select/insert/update on every team-scoped table while a REN is restricted to records they own.

`resources/team manager.json` describes a three-panel executive workspace with KPI cards, a three-column analytics row, a 70/30 team table plus operational alerts rail, and a persistent team member drawer with Overview and Performance tabs. Sibling redesigns (`redesign-leads-workspace`, `redesign-properties-workspace`, `redesign-campaigns-workspace`, `redesign-viewings-workspace`, `redesign-deals-workspace`) have already established the master-detail interaction pattern, the deep-linked drawer selection model via `?<entity>=<id>&tab=<tab>`, the soft pill badge system, and the sticky-header table style. This change brings Manager into that family.

The `users` row already carries `full_name`, `phone_number`, `active_status`, `commission_rate`, and `monthly_target_amount` fields (referenced throughout `backend/app/routes/users.py` and `backend/app/routes/dashboard.py`). The existing `UserAdminUpdate` payload accepts `full_name`, `phone_number`, and `active_status` for managers, but `commission_rate` and `monthly_target_amount` are not yet editable through the manager admin path. The current `PATCH /users/me` route forbids self-edits to `commission_rate`, `role`, `team_id`, `email`, and `active_status`, which is the rule the drawer must respect.

## Goals / Non-Goals

**Goals:**

- Make `/app/manager` a single-page management command centre where a manager can read the team's executive metrics, identify bottlenecks via analytics and alerts, drill into a single REN's performance, and adjust that REN's targets / commission / status / notes without leaving the page.
- Keep the layout aligned with `resources/team manager.json`: executive KPI row, three-column analytics row, 70/30 team performance section with operational alerts, and a sticky right-side team member drawer with Overview and Performance tabs.
- Use five executive KPI cards with month-over-month deltas: Closed Won (MTD), Commission MTD, Active Pipeline Value, Team Conversion %, and Target Attainment.
- Replace the separate `/manager/ren/[renId]` drilldown page with deep-linked drawer selection via `/app/manager?ren=<id>&tab=<tab>` while redirecting the legacy URL.
- Persist coaching notes per REN as a stream of timestamped manager-authored entries the drawer can display and append.
- Allow managers to edit commission rate and monthly target per REN through the existing `PATCH /users/{user_id}` admin path, with backend rejection if a non-manager attempts the same change.
- Ship a single hydrated `GET /manager/workspace` endpoint that returns everything the workspace needs in one round-trip (KPIs, analytics series, per-REN rows, alerts, and the selected REN's drawer payload).
- Add `recharts` as the chart library and use it for a pipeline-distribution donut, a performance-trend line, and a commission-trend bar.

**Non-Goals:**

- Replacing the application shell, left sidebar, or global slate color palette.
- Introducing hierarchical per-manager sub-team RLS. A forward-looking conceptual model (manager leads a sub-team, one REN reports to one manager, manager sees aggregates, no cross-sub-team reassignment) is documented here but no schema changes are shipped in this change.
- Multi-tenant team isolation beyond the existing single-team scaffold.
- Building a full BI/reporting dashboard, supporting custom charts, exporting analytics, scheduling reports, or large date-range comparisons beyond the prescribed 12-week / 6-month windows.
- Redesigning Leads, Properties, Campaigns, Viewings, or Deals workspaces.
- Editing a REN's role, team, or auth identity from the drawer.
- File-uploaded coaching attachments. Coaching notes are text-only for v1.

## Decisions

### Decision: One hydrated `GET /manager/workspace` endpoint powers the page

Add a new `GET /manager/workspace` endpoint that returns a single payload containing team-level KPIs, analytics series, per-REN performance rows, operational alerts (follow-ups, upcoming viewings, deals closing soon), and the selected REN's drawer payload (contact, commission, targets, recent notes, performance breakdown). The endpoint reads from `users`, `leads`, `viewings`, `deals`, and `coaching_notes` server-side, computes aggregates, and returns everything the workspace needs without follow-up calls.

Alternatives considered:

- Reuse `GET /manager/dashboard` and add many follow-up calls from the page (campaigns, alerts, notes, analytics). Rejected because it would cause noticeable waterfall loading and duplicate hydration logic across the page.
- Build a `GraphQL`-style flexible endpoint. Rejected because the rest of the backend uses focused REST endpoints and the analytics/alerts shape is stable.

### Decision: Use deep-linked drawer selection and redirect the legacy detail page

`/app/manager` owns REN selection state. Selecting a row updates the URL to `/app/manager?ren=<id>&tab=<tab>` and loads that REN's hydrated drawer payload into the right-side drawer. `/app/manager/ren/[renId]` becomes a redirect to `/app/manager?ren=<id>` so existing deep links keep working. This matches every other ROOMAH workspace.

Alternatives considered:

- Keep the legacy `/manager/ren/[renId]` page as a parallel detail surface. Rejected because it preserves the navigation-heavy interaction the redesign is meant to remove and creates two competing detail experiences.
- Embed REN detail inline in the table row (expand/collapse). Rejected because it crowds the master grid and conflicts with the persistent-drawer interaction model used by the rest of the app.

### Decision: Choose five executive KPI cards and standard windows

The KPI row shows five cards: Closed Won (MTD), Commission MTD, Active Pipeline Value (with weighted-pipeline subtext), Team Conversion %, and Target Attainment vs. the team's monthly target. Each card has an icon on the left, a primary metric, and a month-over-month change indicator (up arrow / down arrow / neutral). MTD windows compare current calendar month vs. previous calendar month. Conversion is leads created in the trailing 30 days divided by leads created and won in the same window. Target Attainment is current-month team commission divided by `teams.monthly_target_amount`. At-risk operational signals (overdue follow-ups, missed viewings, deals closing soon) are not a KPI card; they live in the Operational Alerts rail where they are actionable.

Alternatives considered:

- Include an "At-risk" KPI card. Rejected because alerts belong in the alerts rail where they expose a CTA, not in a non-actionable counter.
- Include a "Top Performer" card. Rejected because it duplicates the trend column of the team table and adds noise without driving action.

### Decision: Use `recharts` for the three analytics charts

Add `recharts` as a frontend dependency. Use a donut for Pipeline Distribution (team deal counts by stage), a line for Performance Trend (weekly closed-won deal count over the last 12 weeks), and a bar chart for Commission Trend (monthly commission over the last 6 months). All three charts use the chart palette in `team manager.json` (`#14B8A6` / `#7DD3FC` / `#A7F3D0` / `#67E8F9` / `#CBD5E1`), minimal gridlines, no legend clutter, and avoid stacking unless required for readability.

Alternatives considered:

- Hand-roll SVG charts. Rejected because the design needs hoverable tooltips and consistent axis behavior across three chart types and bespoke SVG would expand scope without meaningful UX gain.
- Use a heavyweight chart library (e.g. ECharts / Highcharts). Rejected because the design explicitly calls for "minimal", "executive", "support decisions, not exploration" and these libraries bring more API surface and bundle size than needed.

### Decision: Coaching notes get their own append-only table

Add a `coaching_notes` table with `id`, `team_id`, `ren_id`, `manager_id`, `body`, `created_at`, `updated_at`. RLS restricts `SELECT`, `INSERT`, and `DELETE` to users whose JWT role is `MANAGER` and whose `team_id` matches the row's `team_id`. RENs cannot see, write, or delete coaching notes. Notes are append-only from the UI: the drawer supports adding a new note and removing an existing note (with confirmation), but does not support inline editing of an existing note. Each note is stored with the authoring manager's `id` so the drawer can show authorship.

Alternatives considered:

- Reuse `timeline_events` with a `coaching_note` event type. Rejected because `timeline_events.lead_id` is a non-null FK to `leads.id`; coaching notes are scoped to a REN, not a lead, so the relationship is wrong.
- Add a single `users.manager_notes` text field. Rejected because the drawer card explicitly renders a chronological stream and audit who-wrote-what is meaningful for coaching context.

### Decision: Reuse `PATCH /users/{user_id}` for commission and target edits

Extend `UserAdminUpdate` in `backend/app/routes/users.py` to accept optional `commission_rate` and `monthly_target_amount` fields in addition to the existing `full_name`, `phone_number`, and `active_status`. The route is already gated by `require_manager`, so RENs cannot reach it. The existing `PATCH /users/me` route continues to reject self-edits to `commission_rate` (already enforced) and is extended to forbid `monthly_target_amount` when the actor is editing another REN; self-edit of one's own `monthly_target_amount` remains permitted for both REN and MANAGER (the existing behavior tests already cover this).

Alternatives considered:

- Add a separate `PATCH /manager/team/{ren_id}` endpoint. Rejected because `PATCH /users/{user_id}` already exists, is already manager-only, and the drawer would otherwise have to choose between two near-identical routes.
- Build a richer commission structure (tiered, bonus, split). Rejected as scope creep; v1 commission is a single decimal rate and that is what the drawer edits.

### Decision: Keep RLS team-wide for the MVP

The existing team-scoped RLS (REN sees own records, MANAGER sees the entire team) is correct for the MVP because the system runs a single team. The conceptual model used in this design (manager owns a sub-team, one-to-many manager-to-RENs, manager sees aggregates of their RENs, no cross-sub-team reassignment) is recorded here so future schema work can map onto it, but no schema or policy changes are made in this change. The Manager workspace surfaces aggregates over the entire team; individual record drilldown still happens through the existing module workspaces (Leads, Properties, Viewings, Deals, Campaigns) using their existing RLS policies.

Alternatives considered:

- Ship hierarchical RLS in this change. Rejected because it would touch every existing policy in `202605241013_enable_rls_and_policies.sql`, force a schema migration on `users` or a new `team_memberships` table, and is unrelated to the page redesign that motivates this change.
- Switch the Manager page to expose individual records inline. Rejected because the design positions the page as an aggregate/coaching surface and the existing modules already own the individual-record interaction model.

### Decision: Drawer holds Overview and Performance tabs only

The drawer ships with exactly two tabs: Overview and Performance. Overview stacks four cards: Contact Information (key-value), Commission Configuration (commission rate + monthly target, editable), Targets (current monthly target + month-to-date attainment progress), and Manager Notes (chronological coaching note stream with an inline composer). Performance shows the selected REN's pipeline donut, weekly closed-won line, monthly commission bar, recent activity counters, and trend sparkline at REN scope.

Alternatives considered:

- Add Activity and Notes tabs separately. Rejected because activity belongs to the Performance tab and notes are already a card in Overview.
- Add a "Settings" tab for commission and targets. Rejected because Overview already contains the editable cards and adding a tab adds navigation without changing the data shape.

### Decision: Hide non-manager users from the Manager workspace data set

The team performance table and analytics include only users with `role = REN` (or who own at least one lead, property, viewing, or deal). MANAGER rows are excluded from the team table because the workspace is for managing RENs, not other managers. A manager who also acts as a REN on their own records still has those records counted in team-level KPIs and analytics, but does not appear as a row in the team table.

Alternatives considered:

- Include managers as table rows. Rejected because it conflates the management surface with the managed set and adds confusing self-rows for the viewer.
- Include only users with `role = REN`. Adopted but slightly relaxed to also include MANAGER rows that own records, surfaced only inside team-level KPI calculations, not in the table.

## Risks / Trade-offs

- **Forward-looking hierarchical RLS may diverge from MVP behavior** → Capture the conceptual model in design.md as an explicit decision and recommend a separate change to introduce the hierarchical model when needed. No schema is written in this change.
- **Hydrated `GET /manager/workspace` could become slow as the team grows** → Keep aggregations server-side, scope all queries by `team_id`, paginate or cap the alerts arrays at a sensible upper bound (e.g. the next 10 alerts per rail), and add indexes only if observed performance demands it.
- **Coaching notes can accumulate sensitive content** → Restrict select/insert/delete via RLS to `jwt_role() = 'MANAGER'` on the matching `team_id`, keep notes plain-text only, and require explicit delete confirmation in the UI.
- **`recharts` adds a chart dependency** → Use it only for the three executive charts on this page; do not adopt it as a default chart library across the rest of the workspace until there is a second consumer.
- **Drawer state can drift from URL** → Treat `/app/manager?ren=<id>&tab=<tab>` as the source of truth for selection and tab state; the drawer only renders from URL state and writes back through router updates.
- **Commission rate edits are now possible from the drawer** → The existing `PATCH /users/{id}` is already manager-gated and the rate snapshot pattern on deals means historical deals keep their snapshotted rate. Add a confirmation step in the drawer when commission rate changes by more than a small threshold to avoid fat-finger edits.

## Migration Plan

1. Add `coaching_notes` table migration with team-scoped RLS policies that require `jwt_role() = 'MANAGER'` for select / insert / delete. Add team/ren indexes.
2. Extend `UserAdminUpdate` to accept optional `commission_rate` and `monthly_target_amount` and update `PATCH /users/{user_id}` to persist them while preserving `require_manager`.
3. Add `GET /manager/workspace` returning KPIs, analytics series, per-REN performance rows, operational alerts, and (optional) selected REN drawer payload. Reuse existing helpers from `dashboard.py` and `manager.py` for commission and pipeline math.
4. Add coaching notes endpoints: `GET /manager/team/{ren_id}/notes`, `POST /manager/team/{ren_id}/notes`, `DELETE /manager/team/{ren_id}/notes/{note_id}` gated by `require_manager`.
5. Update backend tests for new endpoints, the extended user admin update, and RLS enforcement (REN denied on coaching note routes, manager edits to commission/target succeed, REN cannot reach `PATCH /users/{user_id}`).
6. Add `recharts` to the frontend package and verify build output size delta.
7. Build the frontend workspace: KPI cards, analytics row, team performance table + alerts rail, persistent drawer (Overview + Performance), with `?ren=<id>&tab=<tab>` URL state and a redirect from `/app/manager/ren/[renId]`.
8. Validate that `GET /manager/dashboard` and `GET /manager/campaigns` continue to work for backward compatibility while the new workspace endpoint serves the redesigned page.
9. Rollback strategy: the new endpoint and table are additive; the legacy `GET /manager/dashboard` and `GET /manager/campaigns` remain available, so reverting the frontend to the prior page is safe. The `coaching_notes` table can be dropped without affecting any other table because no foreign keys reference it outbound.

## Open Questions

- Should coaching notes support markdown rendering, or is plain text sufficient for v1?
- Should the Performance Trend line chart use weekly closed-won count or weekly conversion %? The design proposes count for readability; conversion % may be more actionable for managers reviewing pipeline quality.
- Should Target Attainment use the team's `monthly_target_amount` only, or fall back to the sum of REN-level `monthly_target_amount` when the team value is unset?
- Should the drawer expose role transitions (REN ↔ MANAGER)? Not in v1, but worth documenting if/when sub-team scoping arrives.
