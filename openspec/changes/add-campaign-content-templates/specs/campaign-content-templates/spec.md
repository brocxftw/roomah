## ADDED Requirements

### Requirement: Campaign content template library
The system SHALL provide a campaign content template page where users can browse starter templates and their own private saved templates.

#### Scenario: User opens template library
- **WHEN** an authenticated user opens `/app/campaigns/templates`
- **THEN** the system displays universal starter templates and templates created by that user

#### Scenario: User filters templates
- **WHEN** the user searches or filters templates by format or channel
- **THEN** the system updates the visible template list to matching starter and owned templates

### Requirement: Template content scope
The system SHALL store campaign content templates as text-copy artifacts only and MUST NOT store campaign setup defaults such as campaign budget, status, start date, or end date.

#### Scenario: User creates template
- **WHEN** the user saves a new template
- **THEN** the system stores template name, format, channel affinity, body text, placeholder metadata, ownership, and timestamps without campaign setup defaults

### Requirement: Starter templates
The system SHALL provide read-only starter campaign content templates that are visible to all authenticated users.

#### Scenario: User views starter template
- **WHEN** the template library contains starter templates
- **THEN** the user can view and use those templates regardless of who created them

#### Scenario: User attempts to modify starter template
- **WHEN** the user attempts to edit or delete a starter template
- **THEN** the system rejects the modification because starter templates are read-only

### Requirement: Private template ownership
The system SHALL enforce owner-only visibility and modification for user-created campaign content templates.

#### Scenario: Owner lists templates
- **WHEN** a user lists campaign content templates
- **THEN** the system returns starter templates and only private templates where `created_by` is that user

#### Scenario: Non-owner accesses private template
- **WHEN** a user requests a private template created by another user
- **THEN** the system denies access or behaves as if the template does not exist

#### Scenario: Manager accesses another user's private template
- **WHEN** a manager requests a private template created by another user
- **THEN** the system denies access because private template visibility does not include manager override

### Requirement: Template creation and maintenance
The system SHALL allow users to create, edit, and delete their own private campaign content templates.

#### Scenario: User creates private template from preset format
- **WHEN** the user selects a preset format and saves template content
- **THEN** the system creates a private template owned by that user

#### Scenario: User updates own template
- **WHEN** the owner edits a private template
- **THEN** the system saves the updated format, channel affinity, body text, and placeholder metadata

#### Scenario: User deletes own template
- **WHEN** the owner deletes a private template
- **THEN** the system removes that template from the owner's library

### Requirement: Template format presets
The system SHALL provide preset formats for campaign content such as Caption, WhatsApp, Email, Ad Copy, and SMS.

#### Scenario: User selects format preset
- **WHEN** the user chooses a template format preset
- **THEN** the system presents an appropriate starting structure for that format

### Requirement: Placeholder composition
The system SHALL support placeholder interpolation for selected property data when composing campaign content.

#### Scenario: User composes from property
- **WHEN** the user opens template composition with a selected property
- **THEN** the system fills supported placeholders such as `{{property_name}}`, `{{price}}`, `{{location}}`, `{{listing_type}}`, and `{{property_type}}` from that property

#### Scenario: Placeholder value is missing
- **WHEN** a template contains a placeholder whose property value is unavailable
- **THEN** the system clearly preserves or marks the unresolved placeholder before the user copies the generated content

### Requirement: Copy-only campaign content output
The system SHALL allow users to copy generated campaign content for manual use on external platforms and MUST NOT attempt to publish the content externally.

#### Scenario: User copies generated content
- **WHEN** the user composes content from a template and activates Copy
- **THEN** the system copies the rendered text to the clipboard and leaves external posting to the user

### Requirement: Template entry points
The system SHALL expose campaign content templates from Campaigns and Properties workflows without requiring external publishing integration.

#### Scenario: User opens templates from campaigns empty state
- **WHEN** the Campaigns workspace has no campaigns
- **THEN** the system displays an empty-state CTA that opens the campaign content templates page

#### Scenario: User opens templates from campaign wizard
- **WHEN** the user is creating a campaign and chooses to use template content
- **THEN** the system opens or embeds a template selection flow for copy generation

#### Scenario: User promotes property through templates
- **WHEN** the user activates the Properties drawer promote action
- **THEN** the system opens campaign content template composition with that property available for placeholder interpolation
