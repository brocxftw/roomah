## ADDED Requirements

### Requirement: Viewing-origin deal creation
The system SHALL allow users to create a deal pipeline record directly from a completed viewing with strong customer interest.

#### Scenario: Start negotiating from completed viewing
- **WHEN** an eligible user selects Start Negotiating from a completed accessible viewing
- **THEN** the system creates an open deal in stage `negotiation` linked to the viewing, lead, property, and assigned agent context

#### Scenario: Viewing context is carried forward
- **WHEN** a deal is created from a viewing
- **THEN** the deal stores or hydrates the originating viewing ID, lead summary, property summary, assigned owner, interest rating, viewing notes, and relevant timeline context for display in the Deals workspace

#### Scenario: Ineligible viewing cannot start deal
- **WHEN** a viewing is not completed or lacks required lead/property context
- **THEN** the system does not expose or does not complete the Start Negotiating action

### Requirement: Close now from viewing
The system SHALL allow users to immediately close a deal as won from a completed viewing when the transaction is finalized during or immediately after the viewing.

#### Scenario: Close now from completed viewing
- **WHEN** an eligible user selects Close Now from a completed accessible viewing and submits required final financial values
- **THEN** the system creates or updates the deal as `closed_won`, links it to the originating viewing, runs the terminal win cascade, emits timeline events, and refreshes the Viewings and Deals workspace state

#### Scenario: Close now validates property relationship
- **WHEN** the user attempts to close now for a property that is not actively linked to the viewing's lead
- **THEN** the system rejects the close-now request and does not create a won deal

### Requirement: Conversion actions in Viewings drawer
The system SHALL expose both pipeline and immediate-win conversion actions in the Viewings drawer for eligible completed viewings.

#### Scenario: Drawer shows conversion choices
- **WHEN** a completed accessible viewing with lead and property context is selected
- **THEN** the drawer exposes Start Negotiating and Close Now actions without requiring navigation to a separate page

#### Scenario: Existing converted viewing is recognized
- **WHEN** the selected viewing already has a linked deal
- **THEN** the drawer indicates the conversion state and avoids creating duplicate active deals for the same viewing

#### Scenario: Conversion refreshes selected viewing
- **WHEN** a viewing is converted to a deal or closed now
- **THEN** the Viewings workspace refreshes the selected viewing and conversion progress indicators

### Requirement: Shared deal modal split
The system SHALL separate open deal creation from terminal win capture so pipeline creation does not automatically close a deal.

#### Scenario: Create deal modal starts pipeline
- **WHEN** the Create Deal or Start Negotiating modal is submitted
- **THEN** the system creates an open deal without marking the lead Won or the property Inactive

#### Scenario: Win deal modal closes transaction
- **WHEN** the Win Deal or Close Now modal is submitted
- **THEN** the system captures final financial values and runs the Closed Won workflow

### Requirement: Conversion continuity in Deals workspace
The system SHALL make viewing-origin context visible when the resulting deal is opened in the Deals workspace.

#### Scenario: Deal drawer shows viewing origin
- **WHEN** the user opens a deal that originated from a viewing
- **THEN** the deal drawer displays the originating viewing date, interest rating, viewing notes, and a link or action back to the viewing context when accessible

#### Scenario: Deal timeline includes viewing context
- **WHEN** the user opens the deal drawer Timeline tab for a viewing-origin deal
- **THEN** the system includes relevant viewing scheduled and viewing completed events alongside deal lifecycle events

#### Scenario: Pipeline card highlights high-interest origin
- **WHEN** a pipeline deal originated from a high-interest viewing
- **THEN** the pipeline card or drawer summary surfaces the interest rating as a visible revenue signal
