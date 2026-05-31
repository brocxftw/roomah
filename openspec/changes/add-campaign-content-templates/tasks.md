## 1. Template Data Model

- [x] 1.1 Add a campaign content templates table with fields for name, channel affinity, format, body text, placeholders, starter flag, owner, and timestamps.
- [x] 1.2 Add database access rules so starter templates are read-only and private templates are visible and mutable only by their owner.
- [x] 1.3 Add seed data for a small starter template library across common formats and channels.
- [x] 1.4 Add backend model types and validation for template format, channel affinity, body text, and placeholder metadata.

## 2. Template API

- [x] 2.1 Add list and read endpoints that return starter templates plus templates owned by the current user.
- [x] 2.2 Add create endpoint for private user-owned templates.
- [x] 2.3 Add update endpoint that only allows the owner to modify private templates.
- [x] 2.4 Add delete endpoint that only allows the owner to delete private templates.
- [x] 2.5 Reject edit or delete attempts for starter templates.
- [x] 2.6 Add backend tests for owner-only visibility, manager non-override behavior, starter read-only behavior, and CRUD flows.

## 3. Template Library Page

- [x] 3.1 Add `/app/campaigns/templates` route with a template library layout.
- [x] 3.2 Render starter templates and owned private templates in searchable, filterable card groups.
- [x] 3.3 Add filters for search, format, channel affinity, and ownership/source.
- [x] 3.4 Add empty states for no private templates and no matching filter results.
- [x] 3.5 Keep styling aligned with ROOMAH white cards, soft badges, subtle borders, and generous spacing.

## 4. Template Create and Edit UI

- [x] 4.1 Add create-template flow with preset format selection and default starting text.
- [x] 4.2 Add plain text body editing with a placeholder palette.
- [x] 4.3 Add edit flow for owner-created private templates.
- [x] 4.4 Add delete flow for owner-created private templates with confirmation.
- [x] 4.5 Hide or disable edit/delete controls for starter templates.

## 5. Property Composition

- [x] 5.1 Add placeholder interpolation utilities for property fields such as property name, price, location, listing type, and property type.
- [x] 5.2 Add compose mode that accepts a selected property context and renders filled template content.
- [x] 5.3 Clearly display unresolved placeholders when source property data is missing.
- [x] 5.4 Add copy-to-clipboard action for generated content.
- [x] 5.5 Add frontend tests or focused component checks for placeholder interpolation behavior.

## 6. Campaign and Property Entry Points

- [x] 6.1 Add a Campaigns workspace empty-state CTA that opens `/app/campaigns/templates`.
- [x] 6.2 Add a Campaigns quick action to open the templates page.
- [x] 6.3 Add a campaign wizard entry point for using template content without storing campaign setup defaults.
- [x] 6.4 Update the Properties drawer Share/Promote action to open template composition with the selected property context.
- [x] 6.5 Ensure generated content remains copy-only and does not attempt external publishing.

## 7. Verification

- [x] 7.1 Run backend tests for campaign content template authorization and CRUD behavior.
- [x] 7.2 Run frontend lint and type checks for the template page and updated entry points.
- [ ] 7.3 Manually verify starter template usage, private template create/edit/delete, property placeholder composition, and copy-to-clipboard.
- [ ] 7.4 Manually verify that another user, including a manager, cannot view or modify a user's private templates.
