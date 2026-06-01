## ADDED Requirements

### Requirement: Viewing operations workspace
The system SHALL provide a calendar-first viewing operations workspace at `/app/viewings` that combines KPI cards, a calendar and agenda workspace, a filter bar, a viewings table, and a persistent viewing detail drawer.

#### Scenario: User opens the viewings workspace
- **WHEN** an authenticated user opens `/app/viewings`
- **THEN** the system displays the viewing KPI row, calendar and agenda workspace, filter controls, table records, and right-side viewing drawer surface without requiring navigation to a separate detail page

#### Scenario: Workspace follows access scope
- **WHEN** a non-manager user opens the viewings workspace
- **THEN** the system shows only viewings assigned to that user

#### Scenario: Manager opens the workspace
- **WHEN** a manager opens the viewings workspace
- **THEN** the system shows team viewings and supports filtering by assigned agent

### Requirement: Viewing KPI cards
The system SHALL display five viewing KPI cards: Today's Viewings, Average Interest, Cancelled / No-show, Completed This Month, and Conversion Rate.

#### Scenario: Today's viewings card is shown
- **WHEN** viewings are loaded for the current user scope
- **THEN** the Today's Viewings KPI counts viewings scheduled for the current local calendar day

#### Scenario: Average interest card is shown
- **WHEN** completed viewings with interest ratings are loaded
- **THEN** the Average Interest KPI displays the average interest rating using the 1-5 scale

#### Scenario: Cancelled and no-show card is shown
- **WHEN** cancelled viewings are loaded
- **THEN** the Cancelled / No-show KPI counts cancelled viewings and surfaces no-show cancellation reasons as part of the card context

#### Scenario: Completed this month card is shown
- **WHEN** completed viewings are loaded
- **THEN** the Completed This Month KPI counts viewings completed during the current local calendar month

#### Scenario: Conversion rate card is shown
- **WHEN** viewing records can be associated with converted deals
- **THEN** the Conversion Rate KPI displays the percentage of completed viewings that resulted in conversion

### Requirement: Calendar and agenda workspace
The system SHALL make the calendar and agenda the primary operational surface for viewing scheduling and daily execution.

#### Scenario: Calendar renders supported views
- **WHEN** the user changes the calendar mode
- **THEN** the system supports month, week, and day views

#### Scenario: Calendar shows status and density
- **WHEN** scheduled, completed, cancelled, and follow-up due viewings exist on calendar dates
- **THEN** the calendar displays status markers and event density indicators for those dates or time slots

#### Scenario: Agenda follows selected date
- **WHEN** the user selects a date in the calendar
- **THEN** the agenda panel updates to show the selected day's time-ordered viewings and follow-up work

#### Scenario: Empty calendar slot starts scheduling
- **WHEN** the user selects an empty time slot in week or day view
- **THEN** the system opens the viewing scheduler with the selected date and time prefilled

#### Scenario: Month date starts scheduling
- **WHEN** the user starts scheduling from a month-view date
- **THEN** the system opens the viewing scheduler with the selected date prefilled

### Requirement: Viewing filters and table
The system SHALL provide advanced viewing discovery through a single-row filter bar and an operational table of viewing records.

#### Scenario: User filters viewings
- **WHEN** the user applies search, status, agent, property type, or date range filters
- **THEN** the table and operational counts update to reflect matching viewings within the user's access scope

#### Scenario: User resets filters
- **WHEN** the user activates Reset filters
- **THEN** the system clears viewing filters and restores the unfiltered workspace state

#### Scenario: Table shows operational columns
- **WHEN** viewing records are displayed in the table
- **THEN** each row shows schedule, lead summary, property summary, assigned agent, status badge, interest rating, follow-up visibility, and quick actions

#### Scenario: Table row selection opens drawer
- **WHEN** the user selects a table row
- **THEN** the system updates the selected viewing route state and opens the viewing detail drawer for that viewing

### Requirement: Viewing detail drawer
The system SHALL provide a persistent right-side viewing detail drawer that acts as the viewing command centre.

#### Scenario: Selecting a viewing opens the drawer
- **WHEN** the user selects a viewing from the calendar, agenda, or table
- **THEN** the drawer displays that viewing's schedule, status, lead information, property context, assigned agent, customer interest, notes, follow-up recommendation, workflow progression, and actions

#### Scenario: Drawer selection is deep-linked
- **WHEN** the route contains `/app/viewings?viewing=<id>&tab=<tab>`
- **THEN** the system loads the selected viewing and opens the requested drawer tab when the viewing is accessible

#### Scenario: Invalid drawer selection is rejected
- **WHEN** the route contains an invalid or inaccessible viewing ID
- **THEN** the system removes or ignores the invalid selection and does not expose viewing details

#### Scenario: Drawer shows highlighted interest
- **WHEN** a viewing has an interest rating
- **THEN** the drawer displays a highlighted interest card with a 1-5 star indicator and label

#### Scenario: Drawer interest is editable
- **WHEN** the user clicks a star in the drawer's customer interest card
- **THEN** the system persists the new interest rating (1-5) for the selected viewing and refreshes the interest display across the agenda, table, and drawer

#### Scenario: Drawer actions remain visible
- **WHEN** a viewing is selected
- **THEN** the drawer footer exposes available actions for editing, rescheduling, calling, emailing, quick-cancelling, marking no-show, scheduling follow-up, completing the viewing when eligible, and converting to a deal

#### Scenario: Drawer footer exposes Cancel and No-show quick actions
- **WHEN** the user opens the drawer for a viewing whose status is not already `cancelled`
- **THEN** the drawer footer surfaces Cancel and No-show buttons, each confirming before submission, that respectively cancel the viewing with `cancellation_reason = lead_cancelled` and `cancellation_reason = no_show`

#### Scenario: Drawer quick actions disabled after cancellation
- **WHEN** the selected viewing's status is `cancelled`
- **THEN** the drawer's Cancel and No-show quick actions are disabled

### Requirement: Viewing completion and interest capture
The system SHALL allow eligible users to complete past scheduled viewings with customer interest and notes while keeping interest visible throughout the workspace, and SHALL allow the captured interest to be edited after completion.

#### Scenario: Past scheduled viewing can be completed
- **WHEN** an accessible viewing's scheduled time has passed and its status is `scheduled`
- **THEN** the system allows completion with an interest rating from 1 to 5 and optional notes

#### Scenario: Completed viewing updates workspace
- **WHEN** a user completes a viewing
- **THEN** the system stores completion data, emits the viewing completed timeline behavior, refreshes the selected workspace record, and displays interest across the agenda, table, and drawer

#### Scenario: Interest rating can be edited after completion
- **WHEN** an eligible user changes the interest rating for an accessible viewing through the drawer
- **THEN** the system persists the new `interest_level` (1-5) without requiring re-completion and updates downstream KPI, agenda, table, and drawer displays

#### Scenario: Interest rating values outside 1-5 are rejected
- **WHEN** the system receives an interest update or completion with an interest value outside the inclusive range 1 through 5
- **THEN** the request is rejected and the stored interest level is unchanged

### Requirement: Viewing rescheduling
The system SHALL allow eligible users to reschedule existing viewings without creating duplicate viewing records.

#### Scenario: User reschedules a viewing
- **WHEN** the user saves a new scheduled date and time for an accessible viewing
- **THEN** the system updates the existing viewing's `scheduled_at` value and refreshes calendar, agenda, table, and drawer state

#### Scenario: Reschedule keeps context
- **WHEN** a viewing is rescheduled
- **THEN** the system keeps the same lead, property, assigned agent, notes, and follow-up context unless the user explicitly changes supported fields

### Requirement: Viewing cancellation with reason
The system SHALL allow eligible users to cancel a viewing and capture a structured cancellation reason while keeping `status = cancelled`.

#### Scenario: User cancels a viewing as no-show
- **WHEN** the user cancels an accessible viewing with cancellation reason `no_show`
- **THEN** the system marks the viewing status as `cancelled`, stores the cancellation reason, and includes it in Cancelled / No-show KPI context

#### Scenario: User cancels with another reason
- **WHEN** the user cancels an accessible viewing with reason `lead_cancelled`, `agent_cancelled`, or `other`
- **THEN** the system marks the viewing status as `cancelled` and stores the selected reason

### Requirement: In-place viewing conversion
The system SHALL allow users to convert a viewing opportunity into a deal from within the viewing drawer without leaving the Viewings workspace.

#### Scenario: User opens conversion from drawer
- **WHEN** the user selects Convert to Deal from an accessible viewing drawer
- **THEN** the system opens an in-place conversion modal prefilled with the viewing's lead and property context

#### Scenario: Conversion completes from viewings workspace
- **WHEN** the user successfully closes a deal from the conversion modal
- **THEN** the system keeps the user in the Viewings workspace and refreshes conversion progress for the selected viewing
