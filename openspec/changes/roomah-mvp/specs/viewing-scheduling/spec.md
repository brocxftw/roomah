## ADDED Requirements

### Requirement: Schedule a viewing against a lead and property

The system SHALL allow an REN to schedule a viewing by selecting a lead they own, an existing property, a date and time, and an assigned REN. On save the system SHALL persist a `viewings` row with `status = scheduled` and emit a `viewing_scheduled` timeline event on the lead.

#### Scenario: REN schedules a viewing for their own lead

- **WHEN** an REN completes the viewing scheduler with a valid lead, property, datetime, and assigned REN
- **THEN** the system creates a `viewings` row with `status = scheduled` and emits a `viewing_scheduled` timeline event on the lead

#### Scenario: Property must exist and be visible to the team

- **WHEN** the REN selects a property
- **THEN** the property list is scoped to the user's team and includes properties in `Active` or `Pending` status

#### Scenario: Manager can assign a viewing to any REN on the team

- **WHEN** a user with `role = MANAGER` schedules a viewing and selects a different team member as the assigned REN
- **THEN** the system persists the viewing with `assigned_ren_id` set to the chosen REN

### Requirement: Post-viewing interest rating

After a viewing's scheduled time has passed, the system SHALL prompt the assigned REN to complete the viewing with an interest rating and optional notes. The interest rating SHALL be one of `Not Interested` (1 star), `Interested` (2 stars), `Very Interested` (3 stars). On completion the system SHALL set `viewings.status = completed`, store `interest_level` and `notes`, emit a `viewing_completed` timeline event, and suggest a follow-up date equal to the completion time plus two days.

#### Scenario: REN completes a viewing with 3 stars

- **WHEN** the assigned REN submits the completion form with `Very Interested` and notes
- **THEN** the system updates `viewings.status = completed`, persists `interest_level = 3` and the notes, and emits a `viewing_completed` event capturing the rating

#### Scenario: Completion resets the follow-up timer for the linked lead

- **WHEN** a viewing is completed at time T
- **THEN** the lead's `last_interaction_at` becomes T (because `viewing_completed` is the latest interaction) and `follow_up_due_at` becomes T + 2 days

#### Scenario: Suggested follow-up date is shown in the UI

- **WHEN** a viewing is completed
- **THEN** the UI displays a suggested follow-up date computed as the completion time plus two days

### Requirement: Viewings list

The system SHALL provide a list view of upcoming viewings for the current user (or the entire team if the user is a `MANAGER`) ordered by scheduled datetime ascending. Past uncompleted viewings SHALL surface a "complete this viewing" prompt.

#### Scenario: REN sees their upcoming viewings

- **WHEN** an REN opens the viewings list
- **THEN** the system returns their viewings ordered by scheduled datetime ascending

#### Scenario: Past uncompleted viewing prompts completion

- **WHEN** a viewing's scheduled datetime is in the past and `status = scheduled`
- **THEN** the system surfaces the completion prompt in the viewings list and on the dashboard
