## ADDED Requirements

### Requirement: Lead creation via wizard

The system SHALL provide a four-step wizard to create a lead capturing customer details, budget, property preferences, and a review step. On creation the system SHALL assign a `lead_id`, set `status = Active`, set ownership to the current REN, set `team_id` to the user's team, and emit a `lead_created` timeline event.

#### Scenario: Successful lead creation

- **WHEN** an REN completes the four-step wizard and confirms the Review step
- **THEN** the system creates a `leads` row with `status = Active`, sets `ren_id` to the current user, sets `team_id` to the user's team, and emits a `lead_created` timeline event

#### Scenario: Required fields enforced

- **WHEN** the REN attempts to advance from Step 1 without entering customer name, phone, or email
- **THEN** the system blocks the transition and surfaces an inline validation error per missing field

#### Scenario: Budget validation

- **WHEN** the REN enters a minimum budget greater than the maximum budget
- **THEN** the system blocks the Step 2 transition and surfaces a validation error

### Requirement: Lead lifecycle with reversible transitions

The system SHALL maintain lead status as an enum with values `Active`, `Negotiating`, `Closed`, and `Lost`. Manual transitions between any two statuses SHALL be permitted. Every status change MUST emit a `lead_status_changed` timeline event capturing the from-status, to-status, actor, and timestamp.

#### Scenario: REN promotes lead to Negotiating

- **WHEN** an REN moves a lead from `Active` to `Negotiating`
- **THEN** the system updates `leads.status` and emits a `lead_status_changed` event with `from = Active, to = Negotiating`

#### Scenario: REN revives a Lost lead

- **WHEN** an REN moves a lead from `Lost` back to `Active`
- **THEN** the system updates `leads.status` and emits a `lead_status_changed` event with `from = Lost, to = Active`

#### Scenario: System-set Closed status from deal closure

- **WHEN** a deal is closed against a lead
- **THEN** the system sets `leads.status = Closed` and the change is recorded as a `lead_status_changed` event with `source = system`

### Requirement: Single REN ownership

Each lead SHALL be owned by exactly one REN at any time, identified by `leads.ren_id`. Reassignment is permitted only by a user with `role = MANAGER` and MUST emit a `lead_reassigned` timeline event capturing the previous and new REN.

#### Scenario: REN cannot reassign

- **WHEN** a user with `role = REN` attempts to change `ren_id` on a lead
- **THEN** the system rejects the request with a forbidden response

#### Scenario: Manager reassigns lead

- **WHEN** a user with `role = MANAGER` changes `ren_id` on a lead to a different team member
- **THEN** the system updates the lead and emits a `lead_reassigned` event with previous and new `ren_id`

### Requirement: Lead-to-property linking (many-to-many)

The system SHALL allow a lead to be linked to multiple properties and a property to be linked to multiple leads through a `lead_properties` join table. Each link SHALL have a `status` of `active` or `inactive`. Creating an active link SHALL emit a `property_linked` timeline event on the lead.

#### Scenario: Link a property to a lead

- **WHEN** an REN links a property to one of their leads
- **THEN** the system creates a `lead_properties` row with `status = active` and emits a `property_linked` timeline event

#### Scenario: Property may be linked to multiple leads simultaneously

- **WHEN** two RENs link the same property to two different leads
- **THEN** both `lead_properties` rows exist with `status = active` and both leads carry the property in their detail view

#### Scenario: Unlink a property from a lead

- **WHEN** an REN removes a property link from their lead
- **THEN** the system sets `lead_properties.status = inactive` and emits a `property_unlinked` timeline event

### Requirement: Lead search and filter

The system SHALL allow RENs to search leads by name, phone, or email substring, and to filter by status. Results SHALL be scoped to leads owned by the current user unless the user is a `MANAGER`, in which case all team leads are returned.

#### Scenario: Search by name substring

- **WHEN** an REN searches their leads with a name substring
- **THEN** the system returns all of their leads whose customer name contains the substring (case-insensitive)

#### Scenario: Filter by status

- **WHEN** an REN filters leads by `status = Active`
- **THEN** the system returns only their leads with `status = Active`

### Requirement: Follow-up due derived from latest interaction

The system SHALL compute, for every lead, a derived `follow_up_due_at = last_interaction_at + 2 days` where `last_interaction_at = GREATEST(leads.created_at, latest viewings.completed_at on this lead, latest timeline_events.created_at on this lead)`. A follow-up SHALL be considered due when `follow_up_due_at <= now()` AND `leads.status IN ('Active','Negotiating')`. Logging any new timeline event on the lead SHALL reset the follow-up because it updates `last_interaction_at`.

#### Scenario: New lead generates a follow-up two days after creation

- **WHEN** a lead is created at time T and no interactions occur
- **THEN** at time T + 2 days the lead appears as a due follow-up on the dashboard, provided its status is `Active` or `Negotiating`

#### Scenario: Logging an interaction resets the timer

- **WHEN** an REN logs a `manual_call` timeline event on a lead with a due follow-up
- **THEN** the follow-up is no longer due and the next due date is the event timestamp + 2 days

#### Scenario: Closed and Lost leads do not generate follow-ups

- **WHEN** a lead's status is `Closed` or `Lost`
- **THEN** the lead never appears as a due follow-up regardless of `follow_up_due_at`

### Requirement: Lead detail view

The system SHALL provide a lead detail page that displays customer information, budget range, property preferences, current status, the owning REN, the linked properties with their link status, and the chronological timeline of events.

#### Scenario: Open a lead detail page

- **WHEN** an REN navigates to a lead they own
- **THEN** the page displays customer info, budget, preferences, status, the linked properties, and the timeline events in reverse chronological order
