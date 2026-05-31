# Dashboard Specification

## Purpose

Define the requirements for the main ROOMAH dashboard at `/app`. The dashboard is an operational command centre that helps RENs answer three questions on every login: what needs attention now, what is happening in the pipeline, and how is the business performing. Layout, content, and analytics are constrained to keep daily operational decisions first-class.

## Requirements

### Requirement: Operational command centre layout

The system SHALL render the main dashboard as an operational command centre using four ordered sections: action panel, KPI summary, primary workspace, and pipeline/work queue workspace. The layout SHALL use card-based grouping and SHALL NOT place more than two major content columns side-by-side.

#### Scenario: Dashboard section order

- **WHEN** an authenticated user loads the main dashboard
- **THEN** the dashboard displays the action panel first, the KPI summary second, the primary workspace third, and the pipeline/work queue workspace fourth

#### Scenario: Dashboard answers operational questions

- **WHEN** an authenticated user reviews any dashboard element
- **THEN** the element supports at least one of these questions: what needs attention now, what is happening in the pipeline, or how the business is performing

### Requirement: Today's Tasks section

The system SHALL display a Today's Tasks widget in the top action panel of the dashboard with three task rows: follow-ups due, viewings today, and deals closing soon. The task rows SHALL be scoped to the current user unless the current dashboard scope intentionally represents a team view, and SHALL prioritise actionable items over analytics.

#### Scenario: Follow-ups due row

- **WHEN** an REN loads the dashboard
- **THEN** the Follow-ups Due row displays the count of leads they own where `status IN ('Active','Negotiating')` and `follow_up_due_at <= now()` or the equivalent follow-up due calculation, and links to the filtered lead list

#### Scenario: Viewings today row

- **WHEN** an REN loads the dashboard
- **THEN** the Viewings Today row displays the count of viewings assigned to them with `status = scheduled` and `scheduled_at` during the current day, and links to the filtered viewings list

#### Scenario: Deals closing soon row

- **WHEN** an REN loads the dashboard
- **THEN** the Deals Closing Soon row displays the count of their leads with `status = Negotiating`, and links to the filtered deals or leads workspace

### Requirement: Quick Actions

The system SHALL display four Quick Action buttons in the top action panel of the dashboard: `Add Lead`, `Add Property`, `Schedule Viewing`, and `Add Campaign`. Each button SHALL open the corresponding creation workflow.

#### Scenario: Add Lead opens lead wizard

- **WHEN** an REN clicks `Add Lead`
- **THEN** the system opens the lead-creation wizard at Step 1

#### Scenario: Add Property opens property wizard

- **WHEN** an REN clicks `Add Property`
- **THEN** the system opens the property-creation wizard at Step 1

#### Scenario: Schedule Viewing opens viewing scheduler

- **WHEN** an REN clicks `Schedule Viewing`
- **THEN** the system opens the viewing scheduler

#### Scenario: Add Campaign opens campaign workflow

- **WHEN** an authenticated user clicks `Add Campaign`
- **THEN** the system opens the campaign-creation workflow

### Requirement: KPI Summary

The system SHALL display a concise KPI summary below the action panel with the following metrics for the current user or active dashboard scope, scoped to the current month where applicable:

- `Active Leads`: count of leads with `status IN ('Active','Negotiating')` or the active in-flight lifecycle statuses used by the application.
- `Properties Listed`: count of properties with `status = Active`.
- `Deals Closed`: count of deals with `closed_at` in the current calendar month.
- `Monthly Commission`: sum of `COALESCE(commission_override, commission_total)` for the same deals.
- `Follow-ups Due`: count of leads with a follow-up due now.

The KPI summary SHALL use five visually consistent cards and SHALL NOT contain decorative charts.

#### Scenario: KPIs reflect current month

- **WHEN** an REN loads the dashboard
- **THEN** `Deals Closed` and `Monthly Commission` count only deals closed in the current calendar month

#### Scenario: Active Leads excludes inactive outcomes

- **WHEN** an REN loads the dashboard
- **THEN** `Active Leads` excludes any lead with a terminal inactive status such as `Closed`, `Lost`, or the application's equivalent terminal statuses

#### Scenario: KPI summary appears below action panel

- **WHEN** an authenticated user loads the dashboard
- **THEN** the KPI summary appears below the Today's Tasks and Quick Actions action panel

### Requirement: Primary workspace

The system SHALL display a primary workspace below the KPI summary with today's appointments as the primary work queue and recent activity as a compact activity feed.

#### Scenario: Today's appointments are primary

- **WHEN** an authenticated user loads the dashboard
- **THEN** today's scheduled viewings appear in the primary workspace as a CRM-style table with status badges and a link to the full viewings workspace

#### Scenario: Recent activity supports daily context

- **WHEN** recent activity exists for the selected dashboard range
- **THEN** the dashboard displays the activity in a compact vertical feed with event labels and timestamps

### Requirement: Pipeline and follow-up workspace

The system SHALL display a secondary workspace containing a customer-lifecycle pipeline summary and a follow-ups due queue.

#### Scenario: Pipeline communicates lifecycle progress

- **WHEN** an authenticated user loads the dashboard
- **THEN** the dashboard displays connected pipeline stages with counts for each customer lifecycle stage

#### Scenario: Follow-ups due queue supports action

- **WHEN** the user has leads requiring follow-up
- **THEN** the dashboard displays a follow-ups due queue ordered by urgency with links to the relevant lead records

### Requirement: Operational content boundaries

The dashboard SHALL avoid excessive analytics, decorative charts, editable settings forms, and content that does not directly support daily operational decision-making.

#### Scenario: Dashboard excludes target editing form

- **WHEN** an authenticated user loads the main dashboard
- **THEN** the dashboard does not display an editable target-setting form

#### Scenario: Dashboard keeps analytics concise

- **WHEN** the dashboard displays business performance information
- **THEN** it is limited to concise KPI cards and operationally relevant pipeline progress

### Requirement: Dashboard prioritises tasks over analytics

The system SHALL render primary actions and workflow queues before analytics-heavy content. The top dashboard section SHALL surface urgent tasks and quick-create actions, while analytics SHALL be limited to concise KPI cards and an operational pipeline summary.

#### Scenario: Action panel appears first

- **WHEN** an authenticated user loads the dashboard
- **THEN** the Today's Tasks widget and Quick Actions appear before KPI cards, pipeline visuals, recent activity, or target progress information
