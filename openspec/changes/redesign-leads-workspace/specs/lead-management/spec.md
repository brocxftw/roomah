## ADDED Requirements

### Requirement: Lead operational workspace
The system SHALL provide a CRM-style master-detail Leads workspace at `/app/leads` that combines a lead KPI summary, filter bar, searchable master grid, and persistent right-side context drawer in a single operational screen.

#### Scenario: Open Leads workspace
- **WHEN** a user navigates to `/app/leads`
- **THEN** the system displays a four-card KPI summary, lead filters, a searchable lead grid, and an empty or selected lead context drawer without requiring navigation to a separate detail page

#### Scenario: Select lead from grid
- **WHEN** a user selects a lead row from the master grid
- **THEN** the system highlights the selected row, updates the URL to include `lead=<id>`, and displays that lead in the right-side context drawer

#### Scenario: Preserve selected lead deep link
- **WHEN** a user opens `/app/leads?lead=<id>&tab=<tab>` for a lead they can access
- **THEN** the system loads the Leads workspace with that lead selected and the requested drawer tab active

### Requirement: Lead KPI summary
The system SHALL display a concise lead KPI summary with exactly four cards: Active Leads, New Leads, Overdue Follow-ups, and Conversion Rate.

#### Scenario: Review lead KPIs
- **WHEN** a user opens the Leads workspace
- **THEN** the system displays the four lead KPI cards above the filter bar without requiring the user to open analytics or charts

### Requirement: Structured lead preferred location
The system SHALL store lead preferred location using structured fields for state, city, and areas while retaining the existing free-text preferred location value for compatibility and notes.

#### Scenario: Create lead with structured location
- **WHEN** a user completes the lead wizard preference step with state, city, and one or more preferred areas
- **THEN** the system stores the selected structured location fields on the lead record

#### Scenario: Preserve free-text preferred location
- **WHEN** an existing lead has a free-text preferred location value that cannot be confidently mapped during migration
- **THEN** the system retains the original value and leaves the structured location fields editable for later cleanup

#### Scenario: Backfill high-confidence location values
- **WHEN** an existing lead's free-text preferred location contains a recognized Malaysian state or known area alias
- **THEN** the migration backfills the corresponding structured state, city, or area value without deleting the original free-text value

### Requirement: Lead drawer close deal modal
The system SHALL allow users to launch a focused Close Deal modal from the lead context drawer quick actions.

#### Scenario: Close deal from selected lead
- **WHEN** a user selects a lead, opens the Close Deal action, completes the modal, and submits it
- **THEN** the system creates the deal for the selected lead and preserves the user in the Leads workspace

#### Scenario: Close deal uses linked properties
- **WHEN** the Close Deal modal is opened from a selected lead
- **THEN** the property selector only offers active properties linked to that lead

## MODIFIED Requirements

### Requirement: Lead creation via wizard

The system SHALL provide a four-step wizard to create a lead capturing customer details, budget, structured property preferences, and a review step. On creation the system SHALL assign a `lead_id`, set `status = Active`, set ownership to the current REN, set `team_id` to the user's team, store structured preferred-location fields when provided, and emit a `lead_created` timeline event.

#### Scenario: Successful lead creation

- **WHEN** an REN completes the four-step wizard and confirms the Review step
- **THEN** the system creates a `leads` row with `status = Active`, sets `ren_id` to the current user, sets `team_id` to the user's team, stores the selected structured preferences, and emits a `lead_created` timeline event

#### Scenario: Required fields enforced

- **WHEN** the REN attempts to advance from Step 1 without entering customer name, phone, or email
- **THEN** the system blocks the transition and surfaces an inline validation error per missing field

#### Scenario: Budget validation

- **WHEN** the REN enters a minimum budget greater than the maximum budget
- **THEN** the system blocks the Step 2 transition and surfaces a validation error

#### Scenario: Structured location selection

- **WHEN** the REN reaches the Preferences step
- **THEN** the system provides structured controls for preferred state, city, and areas instead of relying only on a free-text preferred location input

### Requirement: Lead search and filter

The system SHALL allow RENs to search leads by name, phone, or email substring, and to filter by status, campaign source, structured preferred state, and structured preferred city. Results SHALL be scoped to leads owned by the current user unless the user is a `MANAGER`, in which case all team leads are returned and an owner filter SHALL be available.

#### Scenario: Search by name substring

- **WHEN** an REN searches their leads with a name substring
- **THEN** the system returns all of their leads whose customer name contains the substring (case-insensitive)

#### Scenario: Filter by status

- **WHEN** an REN filters leads by `status = Active`
- **THEN** the system returns only their leads with `status = Active`

#### Scenario: Filter by structured location

- **WHEN** a user filters leads by preferred state or preferred city
- **THEN** the system returns only accessible leads whose structured preferred-location fields match the selected filters

#### Scenario: Manager filters by owner

- **WHEN** a manager filters leads by owner
- **THEN** the system returns only team leads owned by the selected REN

#### Scenario: REN cannot filter other owners

- **WHEN** an REN opens the lead filter bar
- **THEN** the system does not display the owner filter and continues to scope results to that REN's leads

### Requirement: Lead detail view

The system SHALL provide lead detail review inside the `/app/leads` context drawer. The drawer SHALL display customer information, budget range, structured property preferences, current status, owning REN, campaign attribution, linked properties with their link status, upcoming lead work, and chronological timeline events. Existing `/app/leads/[leadId]` URLs SHALL redirect to `/app/leads?lead=<id>`.

#### Scenario: Open a lead detail drawer

- **WHEN** an REN selects a lead they own from the Leads workspace
- **THEN** the drawer displays customer info, budget, structured preferences, status, the owning REN, linked properties, campaign attribution, and timeline events in reverse chronological order

#### Scenario: Open existing lead detail URL

- **WHEN** a user navigates to `/app/leads/[leadId]` for a lead they can access
- **THEN** the system redirects to `/app/leads?lead=<leadId>` and opens the Leads workspace with that lead selected

#### Scenario: Log interaction from timeline tab

- **WHEN** a user writes a manual call, note, or callback from the drawer Timeline tab
- **THEN** the system creates the corresponding timeline event and refreshes the selected lead context without navigating away from the Leads workspace

#### Scenario: Manage linked properties from drawer

- **WHEN** a user links or reviews properties from the drawer Properties tab
- **THEN** the system updates or displays the selected lead's property links without navigating away from the Leads workspace
