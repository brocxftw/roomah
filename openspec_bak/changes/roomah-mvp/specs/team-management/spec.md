## ADDED Requirements

### Requirement: Team Manager dashboard

The system SHALL provide a Team Manager dashboard accessible only to users with `role = MANAGER`. The dashboard SHALL list every REN on the manager's team with the following columns:

- REN name.
- Active leads (`status IN ('Active','Negotiating')`).
- Lead pipeline counts by status (`Active`, `Negotiating`, `Closed`, `Lost`).
- Viewing count for the current month.
- Commission for the current month (sum of `COALESCE(commission_override, commission_total)` on their deals).
- Monthly trend comparing current month vs previous month commission.

#### Scenario: Manager opens the manager dashboard

- **WHEN** a user with `role = MANAGER` navigates to the manager dashboard
- **THEN** the system returns one row per REN on their team with the columns listed above

#### Scenario: REN denied access

- **WHEN** a user with `role = REN` attempts to access the manager dashboard route
- **THEN** the system returns a forbidden response

### Requirement: Manager can reassign leads

The system SHALL allow a `MANAGER` to change `leads.ren_id` to any other user with the same `team_id`. The reassignment SHALL emit a `lead_reassigned` timeline event on the lead capturing both the previous and new `ren_id`.

#### Scenario: Manager reassigns a lead

- **WHEN** a `MANAGER` changes the owner of a lead from REN A to REN B (both on their team)
- **THEN** the system updates `ren_id` and emits a `lead_reassigned` event with `from = A, to = B`

#### Scenario: Cannot reassign to a user from another team

- **WHEN** a `MANAGER` attempts to reassign a lead to a user outside their team
- **THEN** the system rejects the request

### Requirement: Manager can reassign viewings

The system SHALL allow a `MANAGER` to change `viewings.assigned_ren_id` to any other user with the same `team_id`. The reassignment SHALL emit a system-source timeline event on the linked lead noting the viewing reassignment.

#### Scenario: Manager reassigns a viewing

- **WHEN** a `MANAGER` changes the assigned REN on a scheduled viewing to a different team member
- **THEN** the system updates `assigned_ren_id` and emits a timeline event on the lead reflecting the reassignment

### Requirement: Manager can also act as REN

A user with `role = MANAGER` SHALL retain all `REN` capabilities. They MAY own leads and properties, schedule and complete viewings, log timeline events, and close deals on their own records.

#### Scenario: Manager creates their own lead

- **WHEN** a `MANAGER` completes the Add Lead wizard
- **THEN** the system creates a lead with `ren_id = manager.id` and `team_id = manager.team_id`

#### Scenario: Manager closes their own deal

- **WHEN** a `MANAGER` closes a deal on a lead they own
- **THEN** the deal is created with their `commission_rate` snapshot, the same as any other REN
