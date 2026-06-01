## Why

Campaign content often starts outside ROOMAH, but users still need repeatable copy patterns for property promotion, WhatsApp outreach, social captions, email text, and ad copy. A private campaign content template library gives each user reusable text snippets and starter formats without introducing platform publishing integrations.

## What Changes

- Add a new Campaign Templates page at `/app/campaigns/templates` for browsing, creating, editing, deleting, and using campaign content templates.
- Support a hybrid template library: universal read-only starter templates plus private user-created templates.
- Scope user-created templates per user. Only the owner can view, edit, or delete their saved templates; managers do not get override visibility for another user's private templates.
- Store campaign content only. Templates contain text bodies and format metadata such as Caption, WhatsApp, Email, Ad Copy, or SMS. They do not store campaign setup defaults such as budget, date range, or campaign status.
- Provide preset formats so users can start from consistent content structures and then save their own reusable template text.
- Add placeholder support for property handoff fields such as `{{property_name}}`, `{{price}}`, `{{location}}`, and `{{listing_type}}`.
- Add a compose mode that fills placeholders from a selected property and lets the user copy the generated content for use on external platforms.
- Add campaign template entry points from the Campaigns workspace empty state, the Campaigns quick action area, the New Campaign wizard, and the Properties drawer promote action.
- Rename or supplement the current property drawer "Share" affordance with a campaign-content-oriented action so property context can be carried into template composition.
- Keep output copy-only: users copy generated text and paste it into Facebook, TikTok, Instagram, Threads, WhatsApp, email, or other tools manually.

## Capabilities

### New Capabilities

- `campaign-content-templates`: Private and starter text-template management, template format presets, property placeholder composition, and copy-to-clipboard handoff for external campaign content.

### Modified Capabilities

<!-- None. Property and campaign workspace entry points are integration surfaces for the new capability rather than existing root specs under openspec/specs. -->

## Impact

- **Frontend**: Adds `frontend/src/app/app/campaigns/templates/page.tsx` and template creation/editing/composition UI. Updates Campaigns empty state/quick actions, the campaign wizard template entry point, and the Properties drawer promote/share action.
- **Backend**: Adds template CRUD/list/read endpoints with owner-only access for user templates and read-only access for starter templates.
- **Data model**: Adds a campaign content templates table with owner scoping, text body, format, channel, placeholder metadata, starter flag, and timestamps.
- **Security**: Enforces that private templates are visible and mutable only by their owner. Starter templates are read-only and visible to all authenticated users.
- **Out of scope**: Campaign setup defaults, external platform posting, rich text editing, scheduled publishing, approval workflows, and team-shared template libraries.
