## Context

ROOMAH currently tracks campaigns but does not help users create or reuse the text content that they paste into external marketing tools. The user wants a separate campaign template page for campaign content only: captions, WhatsApp messages, email bodies, ad copy, SMS text, and similar copy formats.

This change is intentionally separate from `redesign-campaigns-workspace`. It adds a new template capability that can be reached from Campaigns and Properties, but it does not publish campaigns or store campaign setup defaults.

## Goals / Non-Goals

**Goals:**

- Add a campaign content template library at `/app/campaigns/templates`.
- Provide universal read-only starter templates and private user-created templates.
- Enforce owner-only visibility and modification for private templates.
- Let users create templates from preset formats and save reusable text.
- Let users compose content from a selected property by filling placeholders, then copy the generated text for manual use elsewhere.
- Add entry points from the Campaigns workspace, the campaign wizard, and the Properties drawer promote action.

**Non-Goals:**

- Campaign setup presets such as budget, date range, status, or metrics.
- External platform posting, scheduling, or analytics.
- Team-shared user templates or manager visibility into private templates.
- Rich text editing or asset management.
- Replacing the campaign wizard.

## Decisions

### Decision: Model templates as content-only records

Templates will store text body, format, channel affinity, placeholders, ownership, and starter status. They will not store campaign fields such as budget, start date, end date, or campaign status.

Alternative considered: combine content and campaign setup presets. Rejected because the user's intent is copy generation and copy reuse, not campaign configuration.

### Decision: Private templates are owner-only

User-created templates are visible only to their creator. Only the creator can update or delete them. Managers do not have override visibility. Starter templates are read-only system defaults visible to all authenticated users.

Alternative considered: team-scoped templates visible to all team members. Rejected because the user explicitly chose per-user ownership and privacy.

### Decision: Use system starter templates instead of per-user starter clones

Starter templates will be seeded as read-only defaults and returned alongside each user's private templates. They are not cloned per user until the user explicitly saves a copy or creates a new template.

Alternative considered: clone starter templates into every user's private library. Rejected because starter updates would become hard to maintain and users would see duplicate seed content.

### Decision: Use preset formats with plain text editing

Formats such as Caption, WhatsApp, Email, Ad Copy, and SMS provide default structure and validation hints. The editor remains a plain textarea with a placeholder palette. Email templates can include a subject field if implementation needs it, but the core artifact remains copy text.

Alternative considered: rich text editing. Rejected because the copy is meant to be pasted into external platforms and rich formatting would be unreliable across destinations.

### Decision: Use placeholder interpolation for property handoff

The Properties drawer promote action opens template composition with the selected property context. Supported placeholders include `{{property_name}}`, `{{price}}`, `{{location}}`, `{{listing_type}}`, `{{property_type}}`, and other fields already available in the property summary. The compose screen shows the rendered text and lets the user copy it.

Alternative considered: create a new campaign automatically from a property and template. Rejected because the user wants copy-to-clipboard output and no external platform integration.

### Decision: Keep template page as a launchpad, not a drawer workspace

The templates page will use cards, filters, and compose/edit panels. It does not need the Campaigns master-detail drawer pattern because templates are smaller, copy-focused records rather than operational campaign entities.

Alternative considered: create a template drawer mirroring Campaigns. Rejected because it would add layout weight without improving the copy generation workflow.

## Risks / Trade-offs

- Owner-only visibility can surprise managers who expect team-wide campaign assets -> label templates as private and keep starter templates available to everyone.
- Starter templates need seed data and update discipline -> keep starter definitions small, versioned, and read-only.
- Placeholder interpolation can produce awkward copy when fields are missing -> show unresolved placeholders or fallback text clearly before copying.
- Copy-only output may feel incomplete for users expecting publishing -> use explicit labels such as "Copy content" and avoid wording that implies posting.

## Migration Plan

1. Add a campaign content templates table with owner and starter fields.
2. Seed a small starter template library for common property marketing formats.
3. Add backend list/create/read/update/delete endpoints with owner-only private-template access.
4. Build the templates page with starter and private template sections, filters, create/edit forms, and compose mode.
5. Add Campaigns workspace/template quick actions and the Properties drawer promote entry point.
6. Verify users can only see their own private templates plus starter templates.

Rollback strategy: remove template entry points from Campaigns and Properties. The templates table is isolated from campaign records and can remain unused without affecting core CRM workflows.

## Open Questions

None. Format names and exact starter-copy text can be finalized during implementation.
