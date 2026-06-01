## MODIFIED Requirements

### Requirement: Team Manager dashboard

The system SHALL provide a Team Manager workspace accessible only to users with `role = MANAGER`. The workspace SHALL surface team-wide management context in a master-detail layout containing an executive KPI row, a management analytics row, a team performance table paired with an operational alerts rail, and a persistent right-side team member drawer. The workspace SHALL hydrate from a single `GET /manager/workspace` endpoint that returns the KPI values, analytics series, per-REN performance rows, operational alerts, and the optionally selected REN's drawer payload in one round-trip.

For each REN on the manager's team the workspace SHALL surface:

- REN name, avatar, role badge, and active/inactive status.
- Active pipeline workload (count of leads in `Active` or `Negotiating` states).
- Activity counters for the current period covering completed and upcoming viewings, won deals, and a derived performance indicator.
- Financial summary covering current-month commission (sum of `COALESCE(commission_override, commission_total)` on the REN's closed-won deals) and a conversion metric.
- A monthly commission trend sparkline.
- An overflow actions menu for in-place management actions exposed through the drawer.

#### Scenario: Manager opens the manager workspace

- **WHEN** a user with `role = MANAGER` navigates to `/app/manager`
- **THEN** the system returns the hydrated workspace payload with team KPIs, analytics series, per-REN performance rows, operational alerts, and (if a REN is selected via query string) the selected REN's drawer payload

#### Scenario: REN denied access

- **WHEN** a user with `role = REN` attempts to access the manager workspace route or any `/manager/*` API
- **THEN** the system returns a forbidden response and the UI shows a "not authorized" state

#### Scenario: Backward-compatible dashboard endpoint preserved

- **WHEN** a manager calls `GET /manager/dashboard` or `GET /manager/campaigns`
- **THEN** the system returns the existing response shapes so legacy consumers continue to work

## ADDED Requirements

### Requirement: Executive KPI cards

The system SHALL display exactly five executive KPI cards above the analytics row, each showing an icon on the left, a primary metric, and a month-over-month change indicator. The cards SHALL be Closed Won (MTD), Commission MTD, Active Pipeline Value, Team Conversion %, and Target Attainment.

#### Scenario: Closed Won (MTD) is calculated

- **WHEN** the workspace loads for a manager's team
- **THEN** the Closed Won (MTD) KPI displays the count and revenue of deals with `stage = closed_won` whose `closed_at` falls within the current calendar month and shows the percentage change versus the prior calendar month

#### Scenario: Commission MTD is calculated

- **WHEN** the workspace loads for a manager's team
- **THEN** the Commission MTD KPI displays the sum of `COALESCE(commission_override, commission_total)` for `stage = closed_won` deals whose `closed_at` falls within the current calendar month and shows the percentage change versus the prior calendar month

#### Scenario: Active Pipeline Value is calculated

- **WHEN** the workspace loads for a manager's team
- **THEN** the Active Pipeline Value KPI displays the sum of current deal values for non-terminal pipeline stages and a weighted pipeline subtext computed using effective probability per deal

#### Scenario: Team Conversion is calculated

- **WHEN** the workspace loads for a manager's team
- **THEN** the Team Conversion KPI displays leads that reached `closed_won` divided by leads created in the trailing 30-day window and shows the change versus the prior 30-day window

#### Scenario: Target Attainment is calculated

- **WHEN** the workspace loads for a manager's team and the team has a non-zero `monthly_target_amount`
- **THEN** the Target Attainment KPI displays current-month team commission divided by the team's `monthly_target_amount` as a progress indicator

#### Scenario: Target Attainment with no team target

- **WHEN** the workspace loads for a manager's team and the team has no `monthly_target_amount` set
- **THEN** the Target Attainment KPI displays a neutral "no target set" state without an error

### Requirement: Management analytics row

The system SHALL display a three-column analytics row beneath the KPI cards containing a Pipeline Distribution chart, a Performance Trend chart, and a Commission Trend chart rendered with the chart palette and minimal-gridline style defined in `resources/team manager.json`.

#### Scenario: Pipeline Distribution donut renders

- **WHEN** the workspace analytics row renders
- **THEN** the Pipeline Distribution chart displays a donut whose segments are team deal counts grouped by deal stage

#### Scenario: Performance Trend line renders

- **WHEN** the workspace analytics row renders
- **THEN** the Performance Trend chart displays a line of weekly `closed_won` deal counts for the team across the trailing 12 weeks

#### Scenario: Commission Trend bar renders

- **WHEN** the workspace analytics row renders
- **THEN** the Commission Trend chart displays a bar chart of monthly team commission totals across the trailing 6 months

#### Scenario: Charts use the brand palette

- **WHEN** any analytics chart renders
- **THEN** the chart uses the chart palette (`#14B8A6`, `#7DD3FC`, `#A7F3D0`, `#67E8F9`, `#CBD5E1`), minimal gridlines, and no decorative styling

### Requirement: Team performance table

The system SHALL render a Team Performance table that occupies the left 70% of the workspace section beneath the analytics row. The table SHALL have a sticky header, hover state, selected-row highlight, soft borders, and columns for team member (avatar + name), pipeline (active workload), activity (viewings + deals + performance metrics), financial (commission + conversion %), trend (mini sparkline), and an actions overflow menu.

#### Scenario: Table includes RENs

- **WHEN** the workspace loads
- **THEN** the team performance table renders one row per team member with `role = REN` ordered by full name

#### Scenario: Selecting a row updates the drawer instantly

- **WHEN** a manager clicks a row in the team performance table
- **THEN** the URL changes to `/app/manager?ren=<id>` and the right-side drawer renders the selected REN's hydrated payload without a full page navigation

#### Scenario: Active-pipeline column aggregates open leads

- **WHEN** the table renders a REN row
- **THEN** the pipeline column displays the count of that REN's leads in `Active` or `Negotiating` states

#### Scenario: Trend column shows monthly sparkline

- **WHEN** the table renders a REN row
- **THEN** the trend column displays a mini sparkline of that REN's monthly commission across the trailing 6 months

### Requirement: Operational alerts rail

The system SHALL render an Operational Alerts rail that occupies the right 30% of the workspace section beneath the analytics row and stacks three high-visibility alert cards vertically with 16px spacing.

#### Scenario: Follow-ups alert renders

- **WHEN** the workspace loads
- **THEN** the Follow-ups alert card displays the count of team leads whose follow-up window is due or overdue, with a CTA that links to the Leads workspace filtered to overdue follow-ups

#### Scenario: Upcoming viewings alert renders

- **WHEN** the workspace loads
- **THEN** the Upcoming Viewings alert card displays the count of scheduled team viewings in the next seven days with a CTA that links to the Viewings workspace

#### Scenario: Deals closing soon alert renders

- **WHEN** the workspace loads
- **THEN** the Deals Closing Soon alert card displays the count of open team deals whose `expected_close_date` falls within the next 14 days with a CTA that links to the Deals workspace

#### Scenario: Alert cards are compact and actionable

- **WHEN** an alert card renders
- **THEN** the card uses a compact layout with an icon, the metric value, and a CTA link, and does not attempt to render a list of full record details

### Requirement: Team member drawer

The system SHALL render a persistent right-side Team Member drawer (340-380px wide on desktop) that is visible only when a REN is selected via `?ren=<id>`. The drawer SHALL contain a header (avatar, name, role badge, active/inactive status), an underline tab strip with exactly two tabs labelled Overview and Performance, content cards specific to each tab, and a sticky action footer with save, deactivate/reactivate, and close controls. The drawer SHALL render from URL state and SHALL update the URL when the tab changes.

#### Scenario: Drawer is hidden by default

- **WHEN** the workspace loads without a `?ren=<id>` query parameter
- **THEN** the drawer does not render and the workspace expands to the full content width

#### Scenario: Selecting a REN opens the drawer

- **WHEN** the URL is `/app/manager?ren=<id>`
- **THEN** the drawer renders with the selected REN's header, tab strip, and Overview tab content

#### Scenario: Tab switch updates the URL

- **WHEN** the manager clicks the Performance tab
- **THEN** the URL updates to `/app/manager?ren=<id>&tab=performance` and the Performance tab content renders

#### Scenario: Closing the drawer returns to the team overview

- **WHEN** the manager closes the drawer
- **THEN** the URL drops the `ren` and `tab` parameters and the workspace returns to the team overview without a full page reload

#### Scenario: Drawer is responsive on smaller screens

- **WHEN** the workspace renders on tablet
- **THEN** the drawer remains collapsible and the analytics row may stack vertically

#### Scenario: Drawer becomes a bottom sheet on mobile

- **WHEN** the workspace renders on mobile
- **THEN** the drawer is presented as a bottom sheet and the KPI cards become horizontally scrollable

### Requirement: Drawer Overview tab cards

The system SHALL render four stacked cards inside the drawer Overview tab: Contact Information, Commission Configuration, Targets, and Manager Notes.

#### Scenario: Contact Information card renders

- **WHEN** the Overview tab renders for a selected REN
- **THEN** the Contact Information card displays full name, email, phone number, and active status using a key-value layout

#### Scenario: Commission Configuration card renders editable fields

- **WHEN** the Overview tab renders for a selected REN
- **THEN** the Commission Configuration card displays commission rate and monthly target as editable inputs, with a Save action that persists via `PATCH /users/{user_id}`

#### Scenario: Targets card renders attainment progress

- **WHEN** the Overview tab renders for a selected REN
- **THEN** the Targets card displays the REN's monthly commission target and a current-month attainment progress indicator

#### Scenario: Manager Notes card renders the coaching stream

- **WHEN** the Overview tab renders for a selected REN
- **THEN** the Manager Notes card displays the chronological stream of coaching notes (newest first) with author and timestamp, and exposes an inline composer for adding a new note

### Requirement: Drawer Performance tab content

The system SHALL render REN-scoped performance content inside the drawer Performance tab covering the same chart shapes as the team analytics row but filtered to the selected REN.

#### Scenario: Performance tab shows REN pipeline donut

- **WHEN** the Performance tab renders for a selected REN
- **THEN** the tab displays a pipeline-distribution donut whose segments are the REN's deal counts grouped by stage

#### Scenario: Performance tab shows REN trend line

- **WHEN** the Performance tab renders for a selected REN
- **THEN** the tab displays a weekly closed-won trend line for the trailing 12 weeks restricted to the REN's deals

#### Scenario: Performance tab shows REN commission bar

- **WHEN** the Performance tab renders for a selected REN
- **THEN** the tab displays a monthly commission bar chart for the trailing 6 months restricted to the REN's deals

#### Scenario: Performance tab shows REN counters

- **WHEN** the Performance tab renders for a selected REN
- **THEN** the tab displays REN-scoped counters for active pipeline workload, completed viewings, upcoming viewings, deals closing soon, and current-month closed-won

### Requirement: Coaching notes

The system SHALL persist coaching notes scoped to a REN and visible only to managers on the same team. Coaching notes SHALL be append-only from the UI (create and delete only, no inline edit) and each note SHALL record the authoring manager and creation timestamp.

#### Scenario: Manager creates a coaching note

- **WHEN** a manager submits a non-empty body to `POST /manager/team/{ren_id}/notes` for a REN on their team
- **THEN** the system creates a coaching note with `manager_id = current_app_user_id()`, `ren_id` = the target REN, `team_id = jwt_team_id()`, the provided body, and `created_at = now()`

#### Scenario: Manager lists coaching notes

- **WHEN** a manager calls `GET /manager/team/{ren_id}/notes` for a REN on their team
- **THEN** the system returns the REN's coaching notes ordered by `created_at` descending with author display name and timestamp

#### Scenario: Manager deletes a coaching note

- **WHEN** a manager calls `DELETE /manager/team/{ren_id}/notes/{note_id}` for a note belonging to their team
- **THEN** the system removes the note

#### Scenario: REN denied access to coaching notes

- **WHEN** a user with `role = REN` attempts to read or write coaching notes via any `/manager/team/*/notes` endpoint
- **THEN** the system returns a forbidden response

#### Scenario: Cross-team isolation enforced by RLS

- **WHEN** any user attempts to read, write, or delete a coaching note belonging to a different team
- **THEN** the database returns no rows for select and rejects the write regardless of how the query is constructed

#### Scenario: Empty note body rejected

- **WHEN** a manager submits a coaching note with an empty or whitespace-only body
- **THEN** the system rejects the request with a validation error

### Requirement: Manager edits commission rate and monthly target per REN

The system SHALL allow a `MANAGER` to edit a team member's `commission_rate` and `monthly_target_amount` from the drawer through the existing `PATCH /users/{user_id}` endpoint while continuing to reject the same edits from a non-manager actor.

#### Scenario: Manager updates a REN's commission rate

- **WHEN** a manager submits a `PATCH /users/{user_id}` request with `commission_rate` for a REN on their team
- **THEN** the system persists the new rate on the REN's `users` row and returns the updated record

#### Scenario: Manager updates a REN's monthly target

- **WHEN** a manager submits a `PATCH /users/{user_id}` request with `monthly_target_amount` for a REN on their team
- **THEN** the system persists the new target on the REN's `users` row and returns the updated record

#### Scenario: REN cannot edit another user's commission rate

- **WHEN** a user with `role = REN` submits a `PATCH /users/{user_id}` request targeting another user
- **THEN** the system returns a forbidden response

#### Scenario: REN cannot edit own commission rate via self-update

- **WHEN** a user with `role = REN` submits a `PATCH /users/me` request that includes `commission_rate`
- **THEN** the system returns a forbidden response

#### Scenario: Historical deals preserve snapshotted rate

- **WHEN** a manager changes a REN's commission rate after the REN has closed-won deals
- **THEN** the existing closed-won deals retain their previously snapshotted `commission_rate` and only future deals use the new rate

### Requirement: Legacy REN drilldown URL redirects into the workspace

The system SHALL redirect requests for `/app/manager/ren/[renId]` to `/app/manager?ren=<renId>` so existing deep links continue to open the selected team member inside the master-detail workspace.

#### Scenario: Legacy URL redirects to workspace selection

- **WHEN** a user navigates to `/app/manager/ren/<id>`
- **THEN** the system redirects to `/app/manager?ren=<id>` and the team member drawer opens for that REN

#### Scenario: Legacy URL for unknown REN

- **WHEN** a user navigates to `/app/manager/ren/<unknown-id>`
- **THEN** the system redirects to `/app/manager?ren=<unknown-id>` and the workspace surfaces a not-found state in the drawer without erroring the page

### Requirement: Hydrated workspace endpoint

The system SHALL expose `GET /manager/workspace` that returns the data needed to render the workspace in one round-trip, including KPI values, analytics series, per-REN performance rows, operational alerts, and the selected REN's drawer payload when a `ren` query parameter is supplied.

#### Scenario: Workspace payload shape

- **WHEN** a manager calls `GET /manager/workspace`
- **THEN** the response contains keys for `kpis`, `analytics`, `team_performance`, `alerts`, and `selected_member` (nullable)

#### Scenario: Selected member payload included on demand

- **WHEN** a manager calls `GET /manager/workspace?ren=<id>` for a REN on their team
- **THEN** the `selected_member` key contains contact info, commission configuration, current targets and attainment, REN-scoped performance series, and the most recent coaching notes

#### Scenario: Endpoint enforces manager role

- **WHEN** a user with `role = REN` calls `GET /manager/workspace`
- **THEN** the system returns a forbidden response
