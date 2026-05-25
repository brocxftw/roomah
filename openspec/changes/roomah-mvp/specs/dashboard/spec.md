## ADDED Requirements

### Requirement: Today's Tasks section

The system SHALL display a Today's Tasks section on the REN dashboard with three task lists: follow-ups due, upcoming viewings, and deals closing soon. The lists SHALL be scoped to the current user and SHALL prioritise actionable items over analytics.

#### Scenario: Follow-ups due list

- **WHEN** an REN loads the dashboard
- **THEN** the Follow-ups Due list contains every lead they own where `status IN ('Active','Negotiating')` and `follow_up_due_at <= now()`, ordered by `follow_up_due_at` ascending

#### Scenario: Upcoming viewings list

- **WHEN** an REN loads the dashboard
- **THEN** the Upcoming Viewings list contains viewings assigned to them with `status = scheduled` and `scheduled_at` within the next 7 days, ordered ascending

#### Scenario: Deals closing soon list

- **WHEN** an REN loads the dashboard
- **THEN** the Deals Closing Soon list contains their leads with `status = Negotiating`, ordered by `last_interaction_at` descending

### Requirement: Quick Actions

The system SHALL display three Quick Action buttons on the dashboard: `Add Lead`, `Add Property`, `Schedule Viewing`. Each button SHALL open the corresponding wizard.

#### Scenario: Add Lead opens lead wizard

- **WHEN** an REN clicks `Add Lead`
- **THEN** the system opens the lead-creation wizard at Step 1

#### Scenario: Add Property opens property wizard

- **WHEN** an REN clicks `Add Property`
- **THEN** the system opens the property-creation wizard at Step 1

#### Scenario: Schedule Viewing opens viewing scheduler

- **WHEN** an REN clicks `Schedule Viewing`
- **THEN** the system opens the viewing scheduler

### Requirement: KPI Summary

The system SHALL display a personal KPI summary on the dashboard with the following metrics for the current user, scoped to the current month where applicable:

- `Active Leads`: count of leads owned by user with `status IN ('Active','Negotiating')`.
- `Properties Listed`: count of properties owned by user with `status = Active`.
- `Deals Closed`: count of deals with `ren_id = user` and `closed_at` in the current month.
- `Monthly Commission`: sum of `COALESCE(commission_override, commission_total)` for the same deals.
- `Follow-ups Due`: count of the user's leads with a follow-up due now.

#### Scenario: KPIs reflect current month

- **WHEN** an REN loads the dashboard
- **THEN** `Deals Closed` and `Monthly Commission` count only deals closed in the current calendar month

#### Scenario: Active Leads excludes Closed and Lost

- **WHEN** an REN loads the dashboard
- **THEN** `Active Leads` excludes any lead with `status` of `Closed` or `Lost`

### Requirement: Dashboard prioritises tasks over analytics

The system SHALL render Today's Tasks above the KPI Summary in the dashboard layout, reflecting the product principle that the dashboard is a task surface first.

#### Scenario: Layout order

- **WHEN** an REN loads the dashboard
- **THEN** Today's Tasks appears above Quick Actions, and Quick Actions appears above the KPI Summary
