## ADDED Requirements

### Requirement: Lead operational workspace
The system SHALL provide a CRM-style master-detail Leads workspace at `/app/leads` that combines a lead KPI summary, filter bar, searchable master grid, and a right-side context drawer in a single operational screen. The context drawer SHALL only be visible when a lead is selected and SHALL dismiss when the user clicks anywhere outside the drawer or selects a different row.

#### Scenario: Open Leads workspace
- **WHEN** a user navigates to `/app/leads`
- **THEN** the system displays the lead KPI summary, lead filters, and a searchable lead grid without an open context drawer until a lead is selected

#### Scenario: Select lead from grid
- **WHEN** a user selects a lead row from the master grid
- **THEN** the system highlights the selected row, updates the URL to include `lead=<id>`, and opens the right-side context drawer for that lead

#### Scenario: Dismiss drawer on outside click
- **WHEN** a user clicks anywhere outside the open context drawer that is not another lead row
- **THEN** the system closes the drawer and clears the selected lead from the URL

#### Scenario: Preserve selected lead deep link
- **WHEN** a user opens `/app/leads?lead=<id>&tab=<tab>` for a lead they can access
- **THEN** the system loads the Leads workspace with that lead selected and the requested drawer tab active

### Requirement: Lead KPI summary
The system SHALL display a concise lead KPI summary with exactly five cards: Total Leads, New, Active, Closed, and Lost. Each card SHALL display the current count, a representative bucket icon on the left, and a month-over-month percentage change indicator that compares leads created in the current calendar month against leads created in the previous calendar month within the same status bucket. Positive changes SHALL render with an upward arrow in a positive color; negative changes SHALL render with a downward arrow in a negative color; cards with no prior-month data SHALL render a neutral indicator.

#### Scenario: Review lead KPIs
- **WHEN** a user opens the Leads workspace
- **THEN** the system displays the five lead KPI cards above the filter bar with current counts and month-over-month change indicators

#### Scenario: KPI shows positive month-over-month change
- **WHEN** more leads in a status bucket were created in the current calendar month than in the previous calendar month
- **THEN** the corresponding KPI card displays the percentage change with an upward arrow in a positive color

#### Scenario: KPI shows negative month-over-month change
- **WHEN** fewer leads in a status bucket were created in the current calendar month than in the previous calendar month
- **THEN** the corresponding KPI card displays the percentage change with a downward arrow in a negative color

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

### Requirement: Lead drawer quick actions
The system SHALL surface, from the lead context drawer, quick actions that include WhatsApp messaging, email, schedule viewing, edit lead, close deal, and delete lead. Each action button SHALL display an icon on its leading edge to communicate the action's intent.

#### Scenario: WhatsApp action launches wa.me deep link
- **WHEN** a user activates the WhatsApp quick action on a lead with a stored phone number
- **THEN** the system opens a `https://wa.me/<phone>` deep link with the digits-only phone number for that lead

#### Scenario: Edit lead reuses the wizard
- **WHEN** a user activates the Edit Lead quick action
- **THEN** the system opens the lead wizard prefilled with the selected lead's data and submits subsequent changes via `PATCH /leads/{lead_id}`

#### Scenario: Delete lead removes record and attributions
- **WHEN** an REN owns a lead and activates the Delete quick action without any associated deals
- **THEN** the system deletes the lead, its property links, timeline events, scheduled viewings, and decrements campaign attribution counters before closing the drawer

#### Scenario: Delete lead with deals is rejected
- **WHEN** a user activates the Delete quick action for a lead that has at least one closed deal
- **THEN** the system rejects the request and surfaces an error explaining that leads with deals cannot be deleted

### Requirement: Lead linked property inline controls
The system SHALL allow users to unlink or change a linked property inline from the drawer Properties tab.

#### Scenario: Unlink linked property inline
- **WHEN** a user activates Unlink on a linked property
- **THEN** the system marks that lead-property link inactive and refreshes the linked properties list without leaving the workspace

#### Scenario: Change linked property inline
- **WHEN** a user activates Change on a linked property and selects a different available property
- **THEN** the system marks the original link inactive and creates a new active link to the selected property

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

The system SHALL allow RENs to search leads by name, phone, or email substring, and to filter by status, campaign source, creation date range, and structured preferred state. Results SHALL be scoped to leads owned by the current user unless the user is a `MANAGER`, in which case all team leads are returned and an agent filter SHALL be available. The filter bar SHALL render as a single horizontal row and SHALL include a Reset control that clears all active filters.

#### Scenario: Search by name substring

- **WHEN** an REN searches their leads with a name substring
- **THEN** the system returns all of their leads whose customer name contains the substring (case-insensitive)

#### Scenario: Filter by status

- **WHEN** an REN filters leads by `status = Active`
- **THEN** the system returns only their leads with `status = Active`

#### Scenario: Filter by structured location

- **WHEN** a user filters leads by preferred state
- **THEN** the system returns only accessible leads whose structured preferred-location field matches the selected state

#### Scenario: Manager filters by agent

- **WHEN** a manager filters leads by agent
- **THEN** the system returns only team leads owned by the selected REN

#### Scenario: REN cannot filter other agents

- **WHEN** an REN opens the lead filter bar
- **THEN** the system does not display the agent filter and continues to scope results to that REN's leads

#### Scenario: Filter by creation date range

- **WHEN** a user selects a date range filter
- **THEN** the system displays only leads whose creation date falls within the selected range while preserving other active filters

#### Scenario: Reset filters

- **WHEN** a user activates the Reset control
- **THEN** the system clears all filter selections and the URL filter parameters

### Requirement: Lead detail view

The system SHALL provide lead detail review inside the `/app/leads` context drawer. The drawer SHALL display customer information, budget range, structured property preferences, current status, owning REN, campaign attribution, linked properties with their link status and inline unlink/change controls, upcoming lead work, chronological timeline events, and quick actions for WhatsApp, email, schedule viewing, edit, close deal, and delete. The lead master grid SHALL display creation and last-updated timestamps for each row, paginate at 20 rows per page by default, and allow the user to display all rows. Existing `/app/leads/[leadId]` URLs SHALL redirect to `/app/leads?lead=<id>`.

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

#### Scenario: Paginate lead master grid

- **WHEN** the Leads workspace renders more than 20 leads matching the current filters
- **THEN** the system shows the first 20 leads, exposes pagination controls to navigate through pages, and offers an option to show all matching leads on a single page

#### Scenario: Lead master grid shows timestamps

- **WHEN** the Leads workspace renders the master grid
- **THEN** each row displays the lead's creation date and last updated timestamp instead of a derived next-action label
