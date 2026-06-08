## MODIFIED Requirements

### Requirement: Operational command centre layout

The system SHALL render the main dashboard as an action-first operational command centre using five ordered sections that follow the lead-to-close journey: (1) a KPI health strip, (2) an operational workspace, (3) an opportunity-management section, (4) recent activity, and (5) quick actions. The layout SHALL use card-based grouping with consistent spacing and equal-height cards within a row, and SHALL NOT place more than two major content columns side-by-side.

#### Scenario: Dashboard section order

- **WHEN** an authenticated user loads the main dashboard
- **THEN** the dashboard displays the KPI health strip first, the operational workspace second, the opportunity-management section third, recent activity fourth, and quick actions fifth

#### Scenario: Dashboard answers operational questions

- **WHEN** an authenticated user reviews any dashboard card
- **THEN** the card either answers at least one operational question (what needs attention now, what is scheduled, what opportunities need action, or how the business is performing) or triggers a workflow action

#### Scenario: Cards link into workflows

- **WHEN** an authenticated user interacts with an operational or opportunity card
- **THEN** the card provides direct navigation into the relevant workspace among Leads, Properties, Viewings, Deals, Campaigns, Timeline, or Tasks

### Requirement: KPI Summary

The system SHALL display a concise KPI health strip as the first dashboard section, with the following metrics for the current user or active dashboard scope, scoped to the selected range where applicable:

- `Active Leads`: count of leads in the active in-flight lifecycle statuses.
- `Properties Listed`: count of properties listed in the selected range.
- `Deals Closed`: count of deals closed in the selected range.
- `Monthly Commission`: sum of `COALESCE(commission_override, commission_total)` for those deals.
- `Follow-ups Due`: count of leads with a follow-up due now.

The KPI strip SHALL use five visually consistent cards and SHALL NOT contain decorative charts.

#### Scenario: KPI strip appears first

- **WHEN** an authenticated user loads the dashboard
- **THEN** the KPI health strip is the first section, above the operational workspace and all other content

#### Scenario: Active Leads excludes inactive outcomes

- **WHEN** an REN loads the dashboard
- **THEN** `Active Leads` excludes any lead with a terminal inactive status such as `Closed`, `Lost`, or the application's equivalent terminal statuses

### Requirement: Quick Actions

The system SHALL display a Quick Actions section as the final dashboard section with four card-based buttons: `Add Lead`, `Add Property`, `Schedule Viewing`, and `Add Campaign`. Each button SHALL open the corresponding creation workflow. Record creation SHALL also remain available from the global top-bar create menu so it is not dependent on scrolling to the Quick Actions section.

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

### Requirement: Dashboard prioritises action over reporting

The system SHALL keep the dashboard action-first: business reporting SHALL be limited to a concise KPI health strip and a compact lifecycle pipeline summary, while the bulk of the surface SHALL be action-oriented work queues and opportunity cards with one-click navigation. The dashboard SHALL NOT contain large charts, excessive analytics, decorative widgets, or editable settings forms.

#### Scenario: Reporting stays concise

- **WHEN** the dashboard displays business performance information
- **THEN** it is limited to the five-card KPI health strip and a compact pipeline summary, with no large charts or decorative analytics widgets

#### Scenario: Every section drives action

- **WHEN** an authenticated user scrolls the dashboard below the KPI strip
- **THEN** each subsequent section presents actionable queues, opportunity cards, recent activity, or quick-create actions rather than additional reporting

## ADDED Requirements

### Requirement: Operational workspace

The system SHALL display an operational workspace as the second dashboard section containing three action queues: follow-ups due, today's schedule, and hot prospects. Each queue SHALL be scoped to the current user unless the active dashboard scope represents a team view, and SHALL link into the relevant record or workspace.

#### Scenario: Follow-ups due queue

- **WHEN** an REN has leads requiring follow-up
- **THEN** the operational workspace displays a follow-ups due queue ordered by urgency, with each item linking to the relevant lead record

#### Scenario: Today's schedule

- **WHEN** an REN loads the dashboard
- **THEN** the operational workspace displays today's scheduled viewings with status badges and times, linking to the viewings workspace

#### Scenario: Hot prospects use a stage-based heuristic

- **WHEN** an REN loads the dashboard
- **THEN** the Hot Prospects card lists in-flight leads in the `Proposal` or `Negotiation` stages, ordered by most recent interaction, with each item linking to the lead record

### Requirement: Opportunity management section

The system SHALL display an opportunity-management section as the third dashboard section containing recommended property matches, deals requiring progression, and a read-only monthly goal card.

#### Scenario: Recommended property matches use a lightweight signal

- **WHEN** an REN has in-flight leads with no active linked property
- **THEN** the Recommended Property Matches card lists those leads as "needs matching", each linking to the lead so the REN can attach inventory

#### Scenario: Deals requiring progression

- **WHEN** an REN has leads in the `Negotiation` stage
- **THEN** the Deals Requiring Progression card lists those opportunities and links into the deals or leads workspace

#### Scenario: Monthly goal is read-only

- **WHEN** an REN loads the dashboard
- **THEN** the Monthly Goal card shows read-only progress of commission against the monthly target (and the team target where the active scope is a team view) and SHALL NOT present an editable target form

### Requirement: Lifecycle pipeline summary

The system SHALL display a compact customer-lifecycle pipeline summary with connected stages and counts. The summary SHALL be glanceable and SHALL NOT render as a large chart or analytics dashboard.

#### Scenario: Pipeline communicates lifecycle progress

- **WHEN** an authenticated user loads the dashboard
- **THEN** the dashboard displays connected pipeline stages with a count for each customer lifecycle stage in a compact card format

## REMOVED Requirements

### Requirement: Today's Tasks section

**Reason**: The standalone three-row "Today's Tasks" action-panel widget is superseded by the KPI health strip (which surfaces follow-up and viewing counts) and the operational workspace cards (follow-ups due, today's schedule, hot prospects). It is removed to avoid duplicate task counts.

### Requirement: Primary workspace

**Reason**: Replaced by the "Operational workspace" requirement, which restructures the primary work queues around follow-ups, today's schedule, and hot prospects, with recent activity promoted to its own dashboard section.

### Requirement: Pipeline and follow-up workspace

**Reason**: Split into the "Opportunity management section" (deals requiring progression, recommended property matches, monthly goal) and the "Lifecycle pipeline summary" (compact funnel); the follow-ups queue moves into the operational workspace.
