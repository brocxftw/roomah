## ADDED Requirements

### Requirement: Property creation via wizard

The system SHALL provide a four-step wizard to create a property capturing basic information, additional details, images, and a review step. On creation the system SHALL assign a `property_id`, set `status = Active`, set ownership to the current REN, set `team_id` to the user's team, and require at least one image which is designated as the cover.

#### Scenario: Successful property creation

- **WHEN** an REN completes the four-step wizard and confirms the Review step
- **THEN** the system creates a `properties` row with `status = Active`, sets ownership to the current REN, sets `team_id`, persists all uploaded images in `property_images`, and ensures exactly one image has `is_cover = true`

#### Scenario: Cover image required

- **WHEN** the REN attempts to confirm the wizard without designating a cover image
- **THEN** the system blocks submission and surfaces a validation error

### Requirement: Required and optional fields

The system SHALL require the following fields to create a property: name, property type, location, price, status, and cover image. The system SHALL allow the following optional fields: bedrooms, bathrooms, sqft, parking, furnishing, and description.

#### Scenario: Submission blocked when a required field is missing

- **WHEN** the REN submits the wizard with any of name, type, location, price, status, or cover image missing
- **THEN** the system blocks submission and surfaces an inline error for the missing field

#### Scenario: Optional fields default to null

- **WHEN** the REN creates a property without entering bedrooms, bathrooms, sqft, parking, furnishing, or description
- **THEN** the system persists the property with those optional fields as null

### Requirement: Property status lifecycle

The system SHALL maintain property status as an enum with values `Active`, `Pending`, and `Inactive`. RENs MAY change status manually. The deal-close workflow SHALL set a sold property's status to `Inactive` automatically.

#### Scenario: REN manually sets property to Pending

- **WHEN** an REN updates a property's status to `Pending`
- **THEN** the system updates `properties.status` and the property no longer appears in default search results filtered to `Active`

#### Scenario: System sets property to Inactive on deal close

- **WHEN** a deal closes against a property
- **THEN** the system sets the property's status to `Inactive` automatically

### Requirement: Multi-image support with a single cover image

The system SHALL store property images in a `property_images` table with one row per image including `is_cover` and `sort_order`. Exactly one image per property SHALL have `is_cover = true`. Designating a new cover image SHALL clear `is_cover` on the previous cover.

#### Scenario: Upload additional gallery images

- **WHEN** an REN uploads a second and third image to an existing property
- **THEN** the system stores both rows in `property_images` with `is_cover = false` and a `sort_order` reflecting the upload order

#### Scenario: Change the cover image

- **WHEN** an REN designates a non-cover image as the new cover
- **THEN** the system sets `is_cover = true` on the chosen image and `is_cover = false` on the previously-cover image, preserving the invariant of exactly one cover per property

#### Scenario: Image upload uses Supabase Storage

- **WHEN** an image is uploaded
- **THEN** the binary is stored in the `property-images` Supabase Storage bucket and the storage path is recorded in `property_images.storage_path`

### Requirement: Property search and filter

The system SHALL allow users to search properties by name or location substring, and to filter by type, status, and price range. Results SHALL be scoped to the user's team.

#### Scenario: Filter by status and price

- **WHEN** an REN filters properties by `status = Active` and a price range
- **THEN** the system returns only team properties matching both filters
