## ADDED Requirements

### Requirement: Persisted viewing follow-up recommendation
The system SHALL persist a recommended follow-up date and follow-up status for completed viewings.

#### Scenario: Completing a viewing creates follow-up recommendation
- **WHEN** a user completes a scheduled viewing
- **THEN** the system stores `follow_up_at` equal to completion time plus two days and `follow_up_status = pending` unless an explicit supported follow-up value is provided

#### Scenario: Existing completed viewings are backfilled
- **WHEN** the follow-up persistence migration runs
- **THEN** completed viewings without `follow_up_at` receive `follow_up_at = completed_at + 2 days` and `follow_up_status = pending`

#### Scenario: Incomplete viewings do not receive follow-up recommendations
- **WHEN** a viewing has not been completed
- **THEN** the system does not require `follow_up_at` or `follow_up_status`

### Requirement: Viewing follow-up visibility
The system SHALL make viewing follow-up recommendations visible across the Viewings workspace.

#### Scenario: Follow-up appears in agenda
- **WHEN** a viewing has a pending follow-up due on the selected agenda date
- **THEN** the agenda displays that follow-up as operational work for the day

#### Scenario: Follow-up appears in table
- **WHEN** a viewing has follow-up information
- **THEN** the viewings table displays the follow-up date and pending/done/cancelled state

#### Scenario: Follow-up appears in drawer
- **WHEN** a viewing has a follow-up recommendation
- **THEN** the drawer displays a highlighted follow-up recommendation card with recommended action and recommended date

### Requirement: Viewing follow-up status management
The system SHALL allow eligible users to update the follow-up status for an accessible viewing.

#### Scenario: User marks follow-up as done
- **WHEN** a user marks an accessible viewing follow-up as done
- **THEN** the system stores `follow_up_status = done` and removes that follow-up from pending due work

#### Scenario: User cancels follow-up
- **WHEN** a user cancels an accessible viewing follow-up
- **THEN** the system stores `follow_up_status = cancelled` and removes that follow-up from pending due work

#### Scenario: User reopens follow-up
- **WHEN** a user reopens a done or cancelled viewing follow-up
- **THEN** the system stores `follow_up_status = pending` and includes the follow-up in due work based on `follow_up_at`

### Requirement: Viewing follow-up rescheduling
The system SHALL allow eligible users to reschedule a pending viewing follow-up date.

#### Scenario: User reschedules follow-up
- **WHEN** a user saves a new follow-up date for an accessible viewing
- **THEN** the system updates `follow_up_at`, keeps or sets `follow_up_status = pending`, and refreshes the agenda, table, drawer, and KPI state

#### Scenario: Follow-up date is required for pending state
- **WHEN** a viewing follow-up is set to `pending`
- **THEN** the system requires a valid `follow_up_at` value

### Requirement: Due and overdue follow-up behavior
The system SHALL classify pending viewing follow-ups as due or overdue based on the current local date and `follow_up_at`.

#### Scenario: Follow-up due today
- **WHEN** a pending follow-up's `follow_up_at` falls on the current local calendar day
- **THEN** the system displays it as due today in the workspace

#### Scenario: Follow-up is overdue
- **WHEN** a pending follow-up's `follow_up_at` is before the current local calendar day
- **THEN** the system displays it as overdue with elevated visual priority

#### Scenario: Completed follow-up is not overdue
- **WHEN** a follow-up status is `done` or `cancelled`
- **THEN** the system does not classify it as due or overdue even if `follow_up_at` is in the past
