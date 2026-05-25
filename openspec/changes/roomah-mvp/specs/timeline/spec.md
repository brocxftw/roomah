## ADDED Requirements

### Requirement: Unified timeline per lead

The system SHALL persist a single `timeline_events` table that records all events tied to a lead. Each row SHALL include `team_id`, `lead_id`, `event_type`, `source` (`system` or `user`), `payload` (jsonb), `created_by`, and `created_at`.

#### Scenario: Single lead timeline aggregates events from multiple capabilities

- **WHEN** events of any supported `event_type` are emitted against a lead
- **THEN** all of them appear in that lead's timeline ordered by `created_at`

### Requirement: Automatic system events

The system SHALL automatically emit the following events with `source = system`:

- `lead_created` when a lead is created.
- `property_linked` when a lead-property link is set to `active`.
- `property_unlinked` when a lead-property link is set to `inactive`.
- `viewing_scheduled` when a viewing is created.
- `viewing_completed` when a viewing is completed (payload includes `interest_level` and `notes`).
- `deal_closed` when a deal is created for the lead (payload includes `deal_id`, `sale_price`, `commission_total`).
- `lead_status_changed` when a lead's status changes (payload includes `from`, `to`).
- `lead_reassigned` when a lead's owning REN changes (payload includes `from_ren_id`, `to_ren_id`).

#### Scenario: Deal closure emits both deal_closed and lead_status_changed

- **WHEN** a deal closes against a lead
- **THEN** the system emits a `deal_closed` event and a `lead_status_changed` event with `to = Closed` on the same lead

#### Scenario: Property cascade emits events on every affected lead

- **WHEN** a deal closes and other leads were actively linked to the sold property
- **THEN** each affected lead receives a `lead_status_changed` event with `to = Lost` and a `property_unlinked` event for that property

### Requirement: Manual REN events

The system SHALL allow an REN to manually log timeline events on any lead they own with `event_type` in {`manual_call`, `manual_note`, `manual_callback`} and `source = user`. The payload SHALL store any free-text note the REN provides.

#### Scenario: Log a manual call

- **WHEN** an REN logs a "called customer" event on a lead they own
- **THEN** the system emits a `manual_call` event with `source = user` and the lead's `last_interaction_at` advances to the event timestamp

#### Scenario: Manual events reset follow-up timer

- **WHEN** an REN logs any manual event on a lead with a due follow-up
- **THEN** the follow-up is no longer due and the next due date is the event timestamp + 2 days

### Requirement: Timeline read access

The system SHALL allow the owning REN and any `MANAGER` on the same team to read the timeline of a lead. Other RENs SHALL NOT read it.

#### Scenario: Owning REN reads the timeline

- **WHEN** the owning REN opens the lead detail page
- **THEN** the system returns the full timeline in reverse chronological order

#### Scenario: Other REN cannot read the timeline

- **WHEN** an REN who does not own the lead requests the timeline
- **THEN** the system returns a forbidden response

#### Scenario: Manager reads any team timeline

- **WHEN** a `MANAGER` opens any lead detail page on their team
- **THEN** the system returns the full timeline
