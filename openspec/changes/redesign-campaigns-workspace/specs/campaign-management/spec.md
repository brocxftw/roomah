## ADDED Requirements

### Requirement: Campaigns workspace layout
The system SHALL present `/app/campaigns` as a master-detail campaign workspace with operational KPI cards, a single-row filter bar, a campaign performance table, and a right-side campaign insight drawer.

#### Scenario: User opens campaigns workspace
- **WHEN** an authenticated user opens `/app/campaigns`
- **THEN** the system displays campaign KPI summaries, campaign filters, the campaign table, and no drawer until a campaign is selected

#### Scenario: Campaign row selection opens drawer
- **WHEN** the user selects a campaign row
- **THEN** the system highlights the selected row and opens the insight drawer for that campaign without navigating away from the workspace

### Requirement: Campaign operational KPI cards
The system SHALL display campaign KPI cards for Active Campaigns, Total Spend, Leads Generated, Conversions, Average Cost per Lead, and Conversion Rate.

#### Scenario: KPI cards summarize campaign portfolio
- **WHEN** campaigns are loaded
- **THEN** the system computes and displays the six operational KPI cards from the campaign records available to the user

#### Scenario: KPI card has no prior trend data
- **WHEN** a KPI card cannot calculate a reliable prior-period comparison
- **THEN** the system displays a neutral trend state rather than a misleading positive or negative trend

### Requirement: Campaign filters
The system SHALL allow users to filter campaigns by search text, status, channel, and date range, and SHALL provide a reset control.

#### Scenario: User filters campaigns by channel
- **WHEN** the user selects a campaign channel filter
- **THEN** the campaign table updates to show only campaigns matching that channel

#### Scenario: User resets campaign filters
- **WHEN** the user activates Reset
- **THEN** the system clears campaign search, status, channel, and date range filters and returns pagination to the first page

### Requirement: Campaign performance table
The system SHALL render a campaign table that prioritizes campaign identity, channel, status, period, spend, leads, conversions, cost per lead, external-link affordance, and campaign actions.

#### Scenario: Campaign table shows performance metrics
- **WHEN** campaigns are available
- **THEN** each row displays campaign name, channel identity, status, period, spend, leads, conversions, and cost per lead where data exists

#### Scenario: Campaign table paginates
- **WHEN** the number of visible campaigns exceeds the page size
- **THEN** the system paginates the table and offers a Show All control

### Requirement: Campaign drawer deep links
The system SHALL encode selected campaign and drawer tab state in the URL using `/app/campaigns?campaign=<campaign_id>&tab=<tab>`.

#### Scenario: User selects a campaign
- **WHEN** the user selects a campaign from the table
- **THEN** the browser URL includes the selected campaign id and the current drawer tab

#### Scenario: User opens deep-linked campaign
- **WHEN** the user opens `/app/campaigns?campaign=<campaign_id>&tab=performance`
- **THEN** the system loads the workspace with that campaign selected and the Performance tab active

### Requirement: Campaign insight drawer
The system SHALL provide a campaign insight drawer with Overview, Performance, Leads, and Timeline tabs.

#### Scenario: Overview tab displays campaign context
- **WHEN** the drawer Overview tab is active
- **THEN** the system displays campaign name, channel, status, campaign period, budget/spend summary, and external-link action when an external URL exists

#### Scenario: Performance tab displays actionable summaries
- **WHEN** the drawer Performance tab is active
- **THEN** the system displays compact cards for Spend, Lead Generation, Conversion, and Efficiency using available campaign metrics

#### Scenario: Leads tab displays attributed leads
- **WHEN** the drawer Leads tab is active
- **THEN** the system displays leads attributed to the selected campaign and exposes a control to open the Leads workspace filtered to that campaign

#### Scenario: Timeline tab displays synthetic history
- **WHEN** the drawer Timeline tab is active
- **THEN** the system displays a read-only timeline derived from available campaign facts such as creation, status, lead attribution, conversions, and metrics updates

### Requirement: Campaign quick actions
The system SHALL expose drawer quick actions for Edit Campaign, View Leads, Pause Campaign, Duplicate Campaign, and Open External Link when available.

#### Scenario: User edits campaign
- **WHEN** the user activates Edit Campaign from the drawer
- **THEN** the system opens the campaign wizard in edit mode for the selected campaign

#### Scenario: User duplicates campaign
- **WHEN** the user activates Duplicate Campaign from the drawer
- **THEN** the system opens the campaign wizard with source campaign values prefilled for a new draft campaign

#### Scenario: User opens related leads
- **WHEN** the user activates View Leads from the drawer
- **THEN** the system opens the Leads workspace filtered to leads attributed to the selected campaign

### Requirement: External campaign links
The system SHALL allow users to save an optional HTTPS external URL for a campaign and SHALL render a platform-aware "View on ..." action when a URL exists.

#### Scenario: User saves external campaign URL
- **WHEN** the user creates or edits a campaign with an HTTPS external URL
- **THEN** the system stores the URL with the campaign and returns it in campaign list and detail responses

#### Scenario: User views platform link in row
- **WHEN** a campaign row has an external URL
- **THEN** the system displays an external-link action labelled for the parsed platform when recognized or "View campaign" when unrecognized

#### Scenario: User pastes Threads URL
- **WHEN** a campaign external URL host is recognized as Threads
- **THEN** the system renders the external-link action as "View on Threads" even if the campaign channel is Other

### Requirement: Campaign wizard edit and duplicate modes
The system SHALL support campaign wizard modes for creating, editing, and duplicating campaigns.

#### Scenario: User opens edit mode
- **WHEN** the user opens `/app/campaigns/new?edit=<campaign_id>`
- **THEN** the system loads the existing campaign, pre-fills editable fields, and saves changes through the campaign update flow

#### Scenario: User opens duplicate mode
- **WHEN** the user opens `/app/campaigns/new?duplicate=<campaign_id>`
- **THEN** the system pre-fills a new campaign form from the source campaign while treating the submission as a new campaign

### Requirement: Campaign-scoped leads navigation
The system SHALL support opening the Leads workspace filtered by a campaign id.

#### Scenario: User opens leads from campaign drawer
- **WHEN** the user opens related leads for a campaign
- **THEN** the Leads workspace shows only leads attributed to that campaign and keeps the campaign filter represented in the URL state
