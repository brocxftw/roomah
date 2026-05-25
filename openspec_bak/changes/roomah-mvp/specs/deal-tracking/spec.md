## ADDED Requirements

### Requirement: Close a deal against a lead and property

The system SHALL provide a "Close Deal" action on a lead that requires the REN to select a property currently linked to that lead and enter a `sale_price`. On confirmation the system SHALL create a `deals` row, perform the cascade effects defined below, and emit the corresponding timeline events.

#### Scenario: Successful deal closure

- **WHEN** an REN closes a deal on a lead with a selected linked property and a confirmed sale price
- **THEN** the system creates a `deals` row with the lead id, property id, REN id, sale price, snapshotted commission inputs, and the computed commission total

#### Scenario: Sale price is REN-entered, pre-filled from property price

- **WHEN** the REN opens the Close Deal form
- **THEN** the system pre-fills `sale_price` with the property's list price but requires the REN to confirm or edit it before saving

#### Scenario: Cannot close on an unlinked property

- **WHEN** the REN selects a property not currently linked (active link) to the lead
- **THEN** the system rejects the submission and surfaces an error

### Requirement: Commission calculation with snapshotted inputs

The system SHALL compute `commission_total = sale_price * commission_rate − agency_fee − lawyer_fees`. At deal close the system SHALL snapshot `commission_rate` from the closing REN's `users.commission_rate`, and snapshot `agency_fee` and `lawyer_fees` from `team_config` (overridable by the REN on the form). All four values plus the computed `commission_total` SHALL be persisted on the `deals` row.

#### Scenario: Computed commission written to the deal

- **WHEN** an REN with `commission_rate = 0.02` closes a deal at `sale_price = 500000` with default `agency_fee = 1000` and `lawyer_fees = 2000`
- **THEN** the system writes `commission_total = 500000 * 0.02 − 1000 − 2000 = 7000` and persists all four input snapshots on the deal

#### Scenario: Per-deal fee override

- **WHEN** the REN overrides `agency_fee` or `lawyer_fees` on the form
- **THEN** the system persists the entered values on the deal and uses them in the commission calculation, leaving `team_config` defaults unchanged

#### Scenario: Manual commission override

- **WHEN** the REN enters a value in the optional `commission_override` field
- **THEN** the system persists `deals.commission_override` and reporting uses `COALESCE(commission_override, commission_total)`

### Requirement: Deal closure cascade

On successful deal creation the system SHALL:

1. Set the closing lead's `status = Closed`.
2. Set the sold property's `status = Inactive`.
3. For every other lead with an active link to that property, set the link's `status = inactive` and set the lead's `status = Lost`.
4. Emit timeline events: `deal_closed` on the closing lead, `lead_status_changed (to=Closed)` on the closing lead, and on each affected other lead a `property_unlinked` and a `lead_status_changed (to=Lost)` event.

#### Scenario: Property cascade marks other leads Lost

- **WHEN** a deal closes on Property X and Leads B and C had active links to X
- **THEN** Leads B and C transition to `Lost`, their `lead_properties` rows to X are set to `inactive`, and each receives the corresponding timeline events

#### Scenario: Closing lead transitions to Closed

- **WHEN** a deal closes on Lead A
- **THEN** Lead A transitions to `Closed`

#### Scenario: Sold property transitions to Inactive

- **WHEN** a deal closes on Property X
- **THEN** Property X transitions to `Inactive`

### Requirement: Cascade is reversible

The lead-management spec defines lead status as fully reversible. The deal-tracking cascade SHALL NOT prevent an REN from manually reviving a `Lost` lead to `Active` afterwards, nor from creating a new lead for a customer who is interested in a different property.

#### Scenario: REN revives a cascaded lead

- **WHEN** an REN sets a `Lost` lead (set Lost by cascade) back to `Active`
- **THEN** the system permits the change and emits a `lead_status_changed` event

### Requirement: Dashboard metric refresh on deal close

On deal closure the system SHALL ensure the closing REN's dashboard KPIs (`Deals Closed`, `Monthly Commission`, `Active Leads`) and the team manager dashboard reflect the new deal on next load without manual refresh.

#### Scenario: KPI count includes the new deal on next dashboard load

- **WHEN** a deal closes
- **THEN** the next dashboard request returns updated `Deals Closed` and `Monthly Commission` totals that include the new deal
