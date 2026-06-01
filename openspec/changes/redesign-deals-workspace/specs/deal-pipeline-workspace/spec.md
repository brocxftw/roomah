## ADDED Requirements

### Requirement: Deal lifecycle records
The system SHALL represent deals as lifecycle records that can progress from open negotiation stages to terminal won or lost stages.

#### Scenario: Existing deals are treated as Closed Won
- **WHEN** existing deal records are migrated
- **THEN** the system preserves their financial values and `closed_at` timestamps while assigning them to the `closed_won` stage

#### Scenario: New open deal starts in negotiation
- **WHEN** an eligible user creates a non-terminal deal without specifying a stage
- **THEN** the system stores the deal with stage `negotiation`

#### Scenario: Deal stage values are constrained
- **WHEN** a deal is created or moved
- **THEN** the system accepts only `negotiation`, `offer_made`, `pending_contract`, `final_approval`, `closed_won`, or `closed_lost` as stage values

### Requirement: Revenue KPI cards
The system SHALL display revenue-focused deal KPI cards for Pipeline Value, Weighted Pipeline, Closed Won (MTD), Commission MTD, and Win Rate.

#### Scenario: Pipeline value is calculated
- **WHEN** open deals are loaded
- **THEN** the Pipeline Value KPI displays the sum of current deal values for non-terminal pipeline stages

#### Scenario: Weighted pipeline is calculated
- **WHEN** open deals have stage defaults or probability overrides
- **THEN** the Weighted Pipeline KPI displays the sum of each open deal value multiplied by its effective probability

#### Scenario: Closed won month-to-date is calculated
- **WHEN** closed won deals exist in the current month
- **THEN** the Closed Won (MTD) KPI displays the count and revenue value for deals won during the current month

#### Scenario: Commission month-to-date is calculated
- **WHEN** closed won deals exist in the current month
- **THEN** the Commission MTD KPI displays the sum of commission override values when present, otherwise commission totals

#### Scenario: Win rate is calculated
- **WHEN** closed won and closed lost deals exist in the win-rate period
- **THEN** the Win Rate KPI displays won deals divided by won plus lost deals for that period

### Requirement: Kanban pipeline workspace
The system SHALL make the Kanban sales pipeline the primary Deals workspace.

#### Scenario: Pipeline columns render
- **WHEN** an authenticated user opens `/app/deals` without a list-view query
- **THEN** the system displays the deal pipeline with columns for Negotiation, Offer Made, Pending Contract, Final Approval, Closed Won, and Closed Lost

#### Scenario: Pipeline follows access scope
- **WHEN** a non-manager opens the Deals workspace
- **THEN** the system shows only deals owned by that user

#### Scenario: Manager sees team pipeline
- **WHEN** a manager opens the Deals workspace
- **THEN** the system shows team deals and supports filtering by owner

#### Scenario: Column headers summarize stage health
- **WHEN** deals are grouped into pipeline columns
- **THEN** each column header displays the stage name, deal count, and total stage value

#### Scenario: Deal card opens command drawer
- **WHEN** the user selects a deal card
- **THEN** the system updates the selected deal route state and opens the persistent deal command drawer

### Requirement: Drag-and-drop stage movement
The system SHALL support accessible drag-and-drop movement between non-terminal deal pipeline stages and SHALL keep drawer stage controls available as a non-drag fallback.

#### Scenario: User drags deal to open stage
- **WHEN** a user drops an accessible deal card onto another open pipeline stage
- **THEN** the system updates the deal stage, refreshes the pipeline and list views, and emits a deal stage changed timeline event

#### Scenario: User moves stage without dragging
- **WHEN** a user changes a deal stage from the drawer controls
- **THEN** the system updates the deal stage using the same validation and refresh behavior as drag-and-drop

#### Scenario: Terminal stages require explicit actions
- **WHEN** a user attempts to move a deal to Closed Won or Closed Lost
- **THEN** the system requires the explicit win or loss workflow instead of a silent open-stage movement

### Requirement: Pipeline and list view toggle
The system SHALL provide synchronized Pipeline and List views controlled by a segmented view toggle.

#### Scenario: List is default
- **WHEN** the user opens `/app/deals` without a `view` query value
- **THEN** the system displays the list view by default

#### Scenario: Pipeline view is deep-linked
- **WHEN** the route contains `/app/deals?view=pipeline`
- **THEN** the system displays the Kanban pipeline view using the same filtered deal set

#### Scenario: View toggle preserves selection
- **WHEN** the user switches between Pipeline and List while a deal is selected
- **THEN** the selected deal remains open in the drawer when it is still accessible

### Requirement: Deal filtering and discovery
The system SHALL provide advanced filtering across pipeline and list views.

#### Scenario: User applies deal filters
- **WHEN** the user filters by search, owner, stage, property type, expected closing date, or deal type
- **THEN** the pipeline, list view, KPI cards, and drawer selection state update to reflect matching accessible deals

#### Scenario: User resets deal filters
- **WHEN** the user activates Reset filters
- **THEN** the system clears all deal filters and restores the unfiltered workspace

#### Scenario: Selected deal is removed by filter
- **WHEN** active filters exclude the currently selected deal
- **THEN** the system closes or clears the selected drawer state so inaccessible filtered details are not shown

### Requirement: Deal command drawer
The system SHALL provide a persistent right-side deal command drawer with overview, commission, timeline, and documents tabs.

#### Scenario: Drawer displays deal context
- **WHEN** a deal is selected from the pipeline or list view
- **THEN** the drawer displays the deal header, stage badge, lead summary, property summary, owner, current value, expected close date, effective probability, recent activity, and notes

#### Scenario: Drawer is deep-linked
- **WHEN** the route contains `/app/deals?deal=<id>&tab=<tab>`
- **THEN** the system loads the selected accessible deal and opens the requested drawer tab

#### Scenario: Invalid drawer selection is rejected
- **WHEN** the route contains an invalid or inaccessible deal ID
- **THEN** the system removes or ignores the invalid selection and does not expose deal details

#### Scenario: Drawer footer exposes actions
- **WHEN** a deal is selected
- **THEN** the drawer footer exposes available actions for editing, moving stage, marking won, marking lost, managing documents, and closing the drawer without navigating away

### Requirement: Probability and weighted pipeline
The system SHALL derive each deal's effective probability from its stage default unless a valid per-deal override exists.

#### Scenario: Effective probability uses stage default
- **WHEN** a deal has no probability override
- **THEN** the system uses the configured stage default probability for pipeline weighting and drawer visualization

#### Scenario: Effective probability uses override
- **WHEN** a deal has a probability override between 0 and 100
- **THEN** the system uses that override for weighted pipeline calculations and the drawer probability indicator

#### Scenario: Invalid probability override is rejected
- **WHEN** a user submits a probability override outside the inclusive range 0 through 100
- **THEN** the system rejects the request and leaves the stored probability unchanged

### Requirement: Current value and commission projection
The system SHALL treat `sale_price` as the current deal value for open stages and SHALL surface projected commission throughout the workspace.

#### Scenario: Open deal value updates projection
- **WHEN** an open deal's sale price, agency fee, lawyer fees, commission rate, or commission override changes
- **THEN** the system refreshes projected commission values in KPI cards, pipeline cards, table rows, and the drawer

#### Scenario: Commission tab shows breakdown
- **WHEN** the user opens the drawer Commission tab
- **THEN** the system displays deal value, commission rate, agency fee, lawyer fees, commission total, commission override when present, and the effective projected or final commission

### Requirement: Win deal workflow
The system SHALL provide an explicit workflow for marking a deal Closed Won and running the terminal win cascade.

#### Scenario: User marks deal won
- **WHEN** an eligible user marks an accessible open deal as Closed Won with required final financial values
- **THEN** the system sets stage `closed_won`, stamps `closed_at`, preserves final commission values, marks the lead Won, marks the property Inactive, deactivates competing active links, increments campaign conversion counters when applicable, emits deal won timeline events, and refreshes workspace state

#### Scenario: Won deal appears in revenue metrics
- **WHEN** a deal is marked Closed Won
- **THEN** the system includes it in Closed Won, Commission MTD, Win Rate, table, drawer, and Closed Won pipeline column calculations

### Requirement: Lose deal workflow
The system SHALL provide an explicit workflow for marking a deal Closed Lost with a structured lost reason.

#### Scenario: User marks deal lost
- **WHEN** an eligible user marks an accessible open deal as Closed Lost with a valid lost reason
- **THEN** the system sets stage `closed_lost`, stores lost reason and optional notes, stamps `lost_at`, emits deal lost timeline events, and refreshes workspace state

#### Scenario: Lost deal requires reason
- **WHEN** a user attempts to mark a deal Closed Lost without a valid lost reason
- **THEN** the system rejects the request and leaves the deal stage unchanged

#### Scenario: Lost deal releases property when safe
- **WHEN** a deal is marked Closed Lost and no other won deal exists for the same property
- **THEN** the system keeps or returns the property to an available active state according to existing property availability rules

#### Scenario: Lost lead status is conservative
- **WHEN** a deal is marked Closed Lost while the lead still has other active opportunities
- **THEN** the system does not automatically mark the lead Lost

### Requirement: Deal timeline
The system SHALL reuse lead timeline events to display deal-specific history and relevant prior viewing context in the deal drawer.

#### Scenario: Deal stage change is recorded
- **WHEN** a deal stage changes
- **THEN** the system emits a lead timeline event containing the deal ID, previous stage, and next stage

#### Scenario: Deal timeline tab loads history
- **WHEN** the user opens the drawer Timeline tab
- **THEN** the system displays deal-related lead timeline events and relevant originating viewing context in chronological order

### Requirement: Deal documents
The system SHALL support URL-only document tracking for deals.

#### Scenario: User adds document link
- **WHEN** an eligible user adds a document label, URL, and optional kind for an accessible deal
- **THEN** the system stores a team-scoped document link associated with that deal and emits a deal document timeline event

#### Scenario: Drawer shows document summary
- **WHEN** a deal has document links
- **THEN** the drawer Documents tab displays the links and the overview/insight areas surface the document count or missing-document cue

#### Scenario: User deletes document link
- **WHEN** an eligible user deletes a document link from an accessible deal
- **THEN** the system removes the link and refreshes the drawer document state
