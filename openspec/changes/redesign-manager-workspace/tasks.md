## 1. Dependencies and Data Model

- [x] 1.1 Add `recharts` to the frontend `package.json` for executive donut, line, and bar charts.
- [x] 1.2 Add Supabase migration creating `coaching_notes` with columns `id`, `team_id`, `ren_id`, `manager_id`, `body`, `created_at`, `updated_at`, foreign keys to `teams`, `users` (ren), and `users` (manager), and indexes on `(team_id, ren_id)` and `(team_id, created_at desc)`.
- [x] 1.3 Add RLS policies for `coaching_notes` restricting select / insert / delete to `team_id = jwt_team_id() AND jwt_role() = 'MANAGER'`.
- [x] 1.4 Add a `CoachingNote` Pydantic model in `backend/app/models.py` mirroring the table shape.
- [x] 1.5 Confirm `users.commission_rate` and `users.monthly_target_amount` columns exist in the Supabase schema and add a backfill migration if either is missing.

## 2. Backend Manager Domain and Hydration

- [x] 2.1 Add a `GET /manager/workspace` endpoint in `backend/app/routes/manager.py` that returns KPIs, analytics series, per-REN performance rows, operational alerts, and the optional selected REN drawer payload, gated by `require_manager`.
- [x] 2.2 Reuse and extend helpers from `dashboard.py` and the existing `manager.py` to compute Closed Won MTD, Commission MTD, Active Pipeline Value (with weighted variant), Team Conversion %, and Target Attainment.
- [x] 2.3 Build the analytics series: pipeline distribution (deal counts by stage), weekly closed-won counts for the trailing 12 weeks, and monthly commission totals for the trailing 6 months.
- [x] 2.4 Build the per-REN performance rows: avatar info, active pipeline, viewings/deals counters, current-month commission, conversion %, and the trailing 6-month commission sparkline series.
- [x] 2.5 Build the operational alerts: overdue follow-up count, upcoming viewing count (next 7 days), and deals closing soon count (next 14 days using `expected_close_date`).
- [x] 2.6 Build the selected-member drawer payload: contact, commission configuration, monthly target + month-to-date attainment, REN-scoped analytics series, recent coaching notes, and REN-scoped counters.
- [x] 2.7 Extend `UserAdminUpdate` in `backend/app/routes/users.py` to accept optional `commission_rate` and `monthly_target_amount` and ensure `PATCH /users/{user_id}` persists them while still requiring `MANAGER`.
- [x] 2.8 Update `PATCH /users/me` so it continues to forbid `commission_rate` self-edits and the existing self-target behavior remains unchanged.
- [x] 2.9 Add coaching notes endpoints in `backend/app/routes/manager.py`:
  - `GET /manager/team/{ren_id}/notes` returning notes ordered by `created_at desc` with author display name.
  - `POST /manager/team/{ren_id}/notes` accepting `{ body: str }` and creating a note with `manager_id = current user`, `team_id = current team`.
  - `DELETE /manager/team/{ren_id}/notes/{note_id}` removing the note.
- [x] 2.10 Apply `require_manager` to every coaching-notes endpoint and validate that `body` is non-empty after trimming.

## 3. Backend Tests

- [x] 3.1 Add tests for `GET /manager/workspace` covering payload shape, manager role enforcement, and optional `?ren=<id>` drawer hydration.
- [x] 3.2 Add tests for KPI calculations: Closed Won MTD, Commission MTD, Active Pipeline Value, Team Conversion %, and Target Attainment (including no-target neutral case).
- [x] 3.3 Add tests for analytics series content and ordering (12 weekly buckets for performance trend, 6 monthly buckets for commission trend, pipeline donut grouping by stage).
- [x] 3.4 Add tests for per-REN performance rows including ordering by full name and inclusion only of `role = REN` rows in the table.
- [x] 3.5 Add tests for operational alerts: overdue follow-ups, upcoming viewings (next 7 days), deals closing soon (next 14 days based on `expected_close_date`).
- [x] 3.6 Add tests for `PATCH /users/{user_id}` accepting `commission_rate` and `monthly_target_amount` from a manager and rejecting non-manager callers.
- [x] 3.7 Add tests that historical closed-won deals keep their snapshotted `commission_rate` after the REN's rate is updated.
- [x] 3.8 Add tests for coaching notes endpoints: manager create/list/delete, REN denied access, cross-team isolation, and empty-body rejection.
- [x] 3.9 Add tests confirming `GET /manager/dashboard` and `GET /manager/campaigns` remain backwards compatible.

## 4. Frontend Workspace Shell and State

- [x] 4.1 Replace the current `frontend/src/app/app/manager/page.tsx` content with the master-detail workspace shell using existing AppShell title/action conventions.
- [x] 4.2 Implement URL state for `?ren=<id>` selection and `?tab=overview|performance` drawer tab, defaulting to `overview` when only `ren` is present.
- [x] 4.3 Implement workspace data loading from `GET /manager/workspace`, including selected-member hydration when `?ren=<id>` is present, with loading, empty, and error states.
- [x] 4.4 Replace `frontend/src/app/app/manager/ren/[renId]/page.tsx` with a redirect to `/app/manager?ren=<renId>` that preserves existing deep links.
- [x] 4.5 Hide the workspace from non-managers by guarding the page on `role = MANAGER` and rendering a "not authorized" state for RENs.

## 5. Frontend KPI Row

- [x] 5.1 Build a reusable `ManagerKpiCard` component with icon, primary metric, optional subtext, and a month-over-month indicator (up/down/neutral arrow + color).
- [x] 5.2 Render five cards in the prescribed order: Closed Won (MTD), Commission MTD, Active Pipeline Value, Team Conversion %, Target Attainment.
- [x] 5.3 Wire the KPI values and deltas from the `kpis` block of `GET /manager/workspace`.
- [x] 5.4 Ensure the KPI cards align with the existing card style (12px radius, soft border, minimal shadow, 20px padding).

## 6. Frontend Analytics Row

- [x] 6.1 Build the Pipeline Distribution donut chart using `recharts` with the chart palette and stage-labelled segments.
- [x] 6.2 Build the Performance Trend line chart using `recharts` displaying weekly closed-won counts over the trailing 12 weeks.
- [x] 6.3 Build the Commission Trend bar chart using `recharts` displaying monthly commission totals over the trailing 6 months.
- [x] 6.4 Apply minimal gridlines, clean axis labels, no decorative styling, and consistent card framing across all three charts.
- [x] 6.5 Verify the analytics row stacks vertically on tablet and below per the responsive guidance in `team manager.json`.

## 7. Frontend Team Performance Table and Alerts Rail

- [x] 7.1 Build a 70/30 two-column section under the analytics row.
- [x] 7.2 Build the Team Performance table with sticky header, hover, selected-row highlight, soft borders, and columns: team member (avatar + name), pipeline (active workload), activity (viewings + deals + performance metrics), financial (commission + conversion), trend (sparkline), and actions overflow.
- [x] 7.3 Implement row selection that updates `?ren=<id>` and opens the drawer instantly.
- [x] 7.4 Build the Operational Alerts rail with three vertically stacked compact alert cards: Follow-ups, Upcoming Viewings, Deals Closing Soon, each with icon, count, and CTA link.
- [x] 7.5 Link alert CTAs to the relevant module workspaces with appropriate filter query parameters where supported.

## 8. Frontend Team Member Drawer

- [x] 8.1 Build the persistent right-side drawer (340-380px on desktop, collapsible on tablet, bottom-sheet on mobile) that renders only when `?ren=<id>` is present.
- [x] 8.2 Render the drawer header with avatar, name, role badge, active/inactive status pill, and a close control.
- [x] 8.3 Build the underline tab strip with Overview and Performance tabs and sync the active tab to `?tab=`.
- [x] 8.4 Build the Overview tab cards:
  - Contact Information (key-value).
  - Commission Configuration (commission rate + monthly target with editable inputs, Save action via `PATCH /users/{user_id}`).
  - Targets (current monthly target + month-to-date attainment progress bar).
  - Manager Notes (chronological coaching note stream with composer; delete via confirmation).
- [x] 8.5 Build the Performance tab content: REN-scoped pipeline donut, weekly closed-won line, monthly commission bar, and counters for active pipeline, completed viewings, upcoming viewings, deals closing soon, and current-month closed-won.
- [x] 8.6 Build the sticky action footer: Save (when edits are pending), Deactivate/Reactivate (calls `PATCH /users/{user_id}` with `active_status`), and Close.
- [x] 8.7 Surface a confirmation modal when commission rate is being raised or lowered by more than a configurable threshold (e.g. 25% relative change) to prevent fat-finger edits.

## 9. Coaching Notes UI Wiring

- [x] 9.1 Wire `GET /manager/team/{ren_id}/notes` to the Manager Notes card; render newest-first with author + timestamp.
- [x] 9.2 Wire the inline composer to `POST /manager/team/{ren_id}/notes`, optimistically appending the new note and refreshing on response.
- [x] 9.3 Wire delete-on-confirm to `DELETE /manager/team/{ren_id}/notes/{note_id}` with optimistic removal and rollback on error.
- [x] 9.4 Render an empty state for RENs with no notes that nudges the manager to add the first coaching note.

## 10. Validation and Polish

- [x] 10.1 Run backend tests for the manager workspace endpoint, KPI calculations, analytics series, alerts, coaching notes, and admin user updates.
- [x] 10.2 Run frontend typecheck and lint on changed files.
- [x] 10.3 Run frontend tests and add focused tests where existing test infrastructure supports pure helpers or components.
- [x] 10.4 Run a production frontend build to validate the `recharts` bundle impact.
- [x] 10.5 Validate OpenSpec change with `openspec validate redesign-manager-workspace --strict`.
- [ ] 10.6 Manually smoke test workspace loading, KPI accuracy, analytics rendering, team table selection, drawer tab switching, commission and target edits, coaching note create/delete, deactivate/reactivate, legacy `/app/manager/ren/<id>` redirect, and REN-denied access.
