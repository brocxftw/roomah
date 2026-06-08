## MODIFIED Requirements

### Requirement: Operational command centre layout

The system SHALL render the main dashboard as an action-first operational command centre aligned to `dashboard_v2.json`, using four ordered content rows below the page header that follow the lead-to-close journey: (1) a KPI summary row, (2) an operational workspace row, (3) an opportunity-management row, and (4) an activity-and-actions row. The layout SHALL use modular card-based grouping with consistent 8px-based spacing and equal-height cards within each row.

#### Scenario: Dashboard row order

- **WHEN** an authenticated user loads the main dashboard
- **THEN** the dashboard displays the KPI summary row first, the operational workspace row second, the opportunity-management row third, and the activity-and-actions row fourth

#### Scenario: Dashboard answers operational questions

- **WHEN** an authenticated user reviews any dashboard card
- **THEN** the card either answers at least one operational question (what needs attention now, what is scheduled, what opportunities need action, or how the business is performing) or triggers a workflow action

#### Scenario: Cards link into workflows

- **WHEN** an authenticated user interacts with an operational or opportunity card
- **THEN** the card provides direct navigation into the relevant workspace among Leads, Properties, Viewings, Deals, Campaigns, Timeline, or Tasks

### Requirement: Opportunity management section

The system SHALL display an opportunity-management row as the third dashboard section containing recommended property matches, deals requiring progression, and a read-only monthly goal card, laid out at a `40/40/20` ratio (matches and deals wide, monthly goal narrow) with equal-height cards.

#### Scenario: Recommended property matches use a lightweight signal

- **WHEN** an REN has in-flight leads with no active linked property
- **THEN** the Recommended Property Matches card lists those leads as recommendation-style cards with an "Attach property" action, and SHALL NOT display a fabricated numeric match score

#### Scenario: Deals requiring progression

- **WHEN** an REN has leads in the `Negotiation` stage
- **THEN** the Deals Requiring Progression card lists those opportunities and links into the deals or leads workspace

#### Scenario: Monthly goal is read-only

- **WHEN** an REN loads the dashboard
- **THEN** the Monthly Goal card shows read-only progress of commission against the monthly target (and the team target where the active scope is a team view) and SHALL NOT present an editable target form

### Requirement: Quick Actions

The system SHALL display quick actions within the activity-and-actions row so they remain visible alongside recent activity, with four card-based actions: `Add Lead`, `Add Property`, `Schedule Viewing`, and `Add Campaign`. Each action SHALL open the corresponding creation workflow, and record creation SHALL also remain available from the global top-bar create menu.

#### Scenario: Quick actions stay visible in the activity row

- **WHEN** an authenticated user views the activity-and-actions row
- **THEN** the quick actions panel is shown beside recent activity rather than as a separate trailing section

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

The system SHALL keep the dashboard action-first: business reporting SHALL be limited to the concise KPI summary row, while the rest of the surface SHALL be action-oriented work queues, opportunity cards, recent activity, and quick actions with one-click navigation. The dashboard SHALL NOT contain large charts, a pipeline/funnel visualization, excessive analytics, decorative widgets, or editable settings forms.

#### Scenario: Reporting stays concise

- **WHEN** the dashboard displays business performance information
- **THEN** it is limited to the five-card KPI summary row, with no pipeline visualization, large charts, or decorative analytics widgets

#### Scenario: Every section drives action

- **WHEN** an authenticated user scrolls the dashboard below the KPI summary row
- **THEN** each subsequent row presents actionable queues, opportunity cards, recent activity, or quick actions rather than additional reporting

## ADDED Requirements

### Requirement: Activity and actions row

The system SHALL display an activity-and-actions row as the final dashboard section containing recent activity and quick actions side by side at a `70/30` ratio.

#### Scenario: Recent activity supports daily context

- **WHEN** recent activity exists for the selected dashboard range
- **THEN** the row displays the activity as a compact feed with event labels and timestamps in the wider column

#### Scenario: Quick actions occupy the narrow column

- **WHEN** an authenticated user views the activity-and-actions row
- **THEN** the quick actions panel occupies the narrow column beside recent activity and remains visible without scrolling past additional sections

### Requirement: Operational card affordances

The operational workspace cards (follow-ups due, today's schedule, hot prospects) SHALL present per-row urgency or interest indicators and a single per-row quick action that supports the next workflow step, while keeping rows scannable and low-clutter.

#### Scenario: Follow-up rows expose a quick action

- **WHEN** the follow-ups due card lists a lead
- **THEN** the row shows an urgency indicator and a single quick action that navigates to the lead record for the next touchpoint

#### Scenario: Hot prospect rows show interest

- **WHEN** the hot prospects card lists a lead
- **THEN** the row shows an interest indicator and a quick action linking to the lead record

## REMOVED Requirements

### Requirement: Lifecycle pipeline summary

**Reason**: `dashboard_v2.json` defines no pipeline row and its interaction rules avoid charts and BI-style reporting. The compact funnel is removed from the dashboard; lifecycle/pipeline visibility remains available in the Deals and Leads workspaces.
