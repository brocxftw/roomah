## Context

ROOMAH is a greenfield Malaysian real estate CRM. There is no existing application to migrate. The team currently relies on Google Sheets, and the MVP must replace that workflow without recreating its complexity. The product philosophy ("do not make REN think") is the single most important design constraint: screens must show what needs action and the system must automate cascades that today are manual.

The stack is locked at the PRD level: Next.js + TypeScript + TailwindCSS + Shadcn UI on Netlify; FastAPI backend; Supabase Postgres + Supabase Storage + Supabase Auth; Power BI / Databricks for analytics downstream of the operational store. This design lives entirely inside the `ROOMAH/` workspace; the existing `databricks_beta_ren_ETL/` work is downstream and out of scope here.

This change is large because it is the entire MVP. To keep specs reviewable, we split the work into eight capability specs (`auth`, `lead-management`, `property-management`, `viewing-scheduling`, `timeline`, `deal-tracking`, `dashboard`, `team-management`) bound together by a shared data model documented here.

## Goals / Non-Goals

**Goals:**

- Replace the spreadsheet workflow end-to-end for an REN's daily cycle: lead in → property linked → viewing → follow-up → deal closed → commission.
- Make follow-ups impossible to miss by computing them automatically from interaction history (no manual snooze fields, no separate reminders table).
- Keep the lead lifecycle reversible so RENs can fix mistakes without escaping into a spreadsheet workaround.
- Scaffold multi-tenancy (`team_id` on all team-scoped tables, `teams` table) so the future SaaS expansion is a feature flag, not a rewrite.
- Surface manager oversight without a separate admin app: the same Next.js application gates UI by role.
- Snapshot all financial inputs (commission rate, fees, sale price) on the deal so historical reports remain stable when configuration changes.

**Non-Goals:**

- Multi-tenant onboarding flows (sign-up creates rows in the existing single team).
- AI assistant, WhatsApp messaging, mobile app, predictive analytics, CSV imports, SaaS billing — all explicitly out of MVP.
- Real-time push notifications. The dashboard is the notification surface; if you load it, you see what needs action.
- Public-facing property listings. ROOMAH is an internal CRM, not a marketplace.
- Reporting beyond the dashboard KPIs and the manager view. Deep analytics flow through Power BI on top of Supabase.

## Decisions

### Decision: One change covers the whole MVP, sliced into eight capability specs

We considered splitting the MVP into multiple OpenSpec changes (one per capability). Rejected because greenfield capabilities are tightly coupled — a lead's spec depends on properties, viewings, timeline, and deals all existing. A single change keeps the contract internally consistent. Eight capability spec files preserve reviewability without fragmenting the proposal.

### Decision: Single team in MVP, but `team_id` columns scaffolded everywhere

Alternative considered: omit `team_id` until SaaS phase, migrate later. Rejected because backfilling tenancy is the single most expensive migration to defer. Cost today is one column on each of `users`, `leads`, `properties`, `viewings`, `deals`, `timeline_events`, `team_config`. A `teams` table exists with exactly one row (`default-team`) seeded at bootstrap. Row-Level Security policies in Supabase are written from day one to filter by the authenticated user's `team_id`. This makes adding a second team a config change, not a refactor.

### Decision: Roles modeled as `users.role` ∈ {`REN`, `MANAGER`}, not as permission tables

A `MANAGER` is a superset of an `REN`: they can own leads and close their own deals, and additionally see all team data and reassign leads/viewings. We do not introduce an RBAC matrix because there are only two roles and the manager's extra powers are a small, fixed set. If a third role appears we revisit.

### Decision: Lead status is a single enum column, fully reversible

`leads.status` ∈ {`Active`, `Negotiating`, `Closed`, `Lost`}. All transitions in both directions are allowed except automatic ones written by the system (deal closure, property cascade). Every status change writes a timeline event. We considered a workflow engine; rejected as overkill for four states.

### Decision: Follow-up is a derived value, not a stored task

We do not store a `follow_ups` table. Instead, every lead has a derived `follow_up_due_at = last_interaction_at + interval '2 days'` where `last_interaction_at` is `GREATEST(lead.created_at, latest viewing.completed_at on this lead, latest timeline_event.created_at on this lead)`. The dashboard query filters `status IN ('Active','Negotiating') AND follow_up_due_at <= now()`. Alternatives considered: an explicit task table with a cron job creating rows. Rejected because the derived approach is impossible to get out of sync with reality — logging any interaction immediately makes the follow-up disappear, with no background job involved.

### Decision: Lead-to-property linking is many-to-many via `lead_properties`

A lead can be linked to many properties; a property can be linked to many leads (multiple prospective buyers/renters). `lead_properties` carries `(lead_id, property_id, status, created_at)` where `status` is `active` or `inactive`. On deal closure the link for the winning lead is preserved as the winning record; other leads' links to that property are flipped to `inactive` and those leads transition to `Lost`.

### Decision: Closing a deal cascades aggressively, but the cascade is reversible

When `(lead, property)` closes:
1. `deals` row created with snapshotted commission inputs.
2. The closing lead → `Closed`, the property → `Inactive`.
3. Every other lead with an active link to that property → `Lost`; their link row → `inactive`.
4. Timeline events written on every affected lead.

Alternative considered: leave other leads in `Active` and show a banner. Rejected because the PRD explicitly chose the more aggressive cascade, and lead status reversibility plus the "create a new lead for another property" flow makes the cascade safe to undo. The cascade reduces clutter on the dashboard immediately.

### Decision: Commission inputs are snapshotted on the deal

`users.commission_rate`, `team_config.default_agency_fee`, `team_config.default_lawyer_fees` are inputs. At deal close we write `deals.commission_rate`, `deals.agency_fee`, `deals.lawyer_fees`, `deals.sale_price`, and computed `deals.commission_total`. A `deals.commission_override` column captures a manual override; reports use `COALESCE(commission_override, commission_total)`. Snapshotting prevents historical reports from drifting when rates change.

### Decision: Sale price is REN-entered, not auto-filled from the property

Property prices are list prices. Real deals negotiate. The deal-close form pre-fills `sale_price` with `property.price` but requires explicit confirmation by the REN.

### Decision: Timeline is one table for all events, polymorphic by `event_type`

`timeline_events(id, team_id, lead_id, event_type, source, payload jsonb, created_by, created_at)`. `event_type` is an enum (`lead_created`, `property_linked`, `property_unlinked`, `viewing_scheduled`, `viewing_completed`, `deal_closed`, `lead_status_changed`, `lead_reassigned`, `manual_call`, `manual_note`, `manual_callback`). `source` is `system` or `user`. The `payload` jsonb stores event-specific data (e.g. `{ "property_id": "...", "rating": 2 }`). Alternative: typed tables per event. Rejected because the timeline is read-mostly and the query pattern is identical across event types.

### Decision: Image storage uses Supabase Storage with a `property_images` index table

Supabase Storage paths are stored as references in `property_images(id, property_id, storage_path, is_cover, sort_order)`. Exactly one row per property has `is_cover = true`, enforced via a partial unique index. Uploads go directly from the browser to Supabase Storage via signed URLs.

### Decision: Supabase Auth owns identity and authorization claims

Supabase Auth handles email + Google OAuth and session management. On first login an `auth.users` insert trigger creates a row in `users(auth_user_id, team_id, role, email, commission_rate)` with `team_id` = the default team and `role` = `REN`. A manager promotes other users by updating `role` in `public.users`. A Supabase custom access token hook injects `team_id`, `role`, and the application `user_id` into JWT claims derived from `public.users`, so Supabase RLS policies can scope every query to the authenticated user's team and role without a separate identity provider bridge.

### Decision: FastAPI is the only client of Supabase from the server side

The Next.js app talks to FastAPI for application data mutations. FastAPI uses a service-role Supabase client for writes and a user-scoped client for reads, so RLS still applies on read paths even when the backend mediates them. The browser calls Supabase directly only for Auth session management and Storage uploads.

## Risks / Trade-offs

- [Derived follow-ups become slow at scale on a single team] → Add a composite index on `(team_id, status, last_interaction_at)` plus a materialized `lead_follow_up_view`. Materialized view is refreshed on each interaction write via a Postgres trigger.
- [Aggressive Lost cascade frustrates RENs whose other leads were genuinely independent] → Cascade is reversible: any `Lost` lead can be moved back to `Active`, and the UI surfaces the cascade in the timeline so the REN knows what happened. Acceptable for MVP; revisit if RENs report friction.
- [Single-team assumption leaks into UI copy and routes] → All UI copy avoids tenant-specific words ("your team," not "ROOMAH"). Routes nest under `/app/...` with no team segment so introducing `/t/<team>/...` later is additive.
- [Commission snapshotting hides current rate changes from in-flight deals] → Rate is only snapshotted at the moment of deal close. While a deal is being prepared (not yet closed) the live rate is shown.
- [Supabase Auth access token claims can drift from `public.users`] → Keep claims derived from `public.users` through a version-controlled custom access token hook. Add an integration test that verifies a Supabase-issued token resolves to the expected `team_id`, `role`, and application `user_id` claims inside Postgres.
- [Image upload bypassing FastAPI means the backend has no opportunity to virus-scan or compress] → MVP accepts raw uploads with a hard size cap enforced by Supabase Storage policy. Defer scanning/compression to a later change.
- [No real-time updates means stale dashboards if multiple devices act on the same lead] → MVP refreshes on navigation and after any mutation. Real-time can be added later via Supabase Realtime without schema changes.

## Migration Plan

Greenfield product, so this is a bootstrap rather than a migration.

1. Provision Supabase project; run initial migration creating all tables, enums, indexes, RLS policies, and the default team row.
2. Configure Supabase Storage buckets (`property-images`) with the agreed access policy.
3. Configure Supabase Auth with email/password, Google OAuth, the production Netlify redirect URL, and local development redirect URLs.
4. Deploy FastAPI to its hosting target with environment variables for Supabase URL, anon key, service role key, and JWT verification settings.
5. Deploy Next.js to Netlify pointing at the FastAPI base URL and Supabase public URL/anon key.
6. Seed the default team and create the first user as `MANAGER` via a one-off admin script.
7. Smoke-test the full flow: log in → add lead → add property → link → schedule viewing → complete viewing → close deal → verify commission and cascade.

Rollback: this is the first deploy, so rollback means tearing down infrastructure. No data to preserve.

## Open Questions

- Is there a target SLA on follow-up timer accuracy (e.g. "follow-ups due today appear by 8am local time")? Currently the timer is exact-to-the-second; we may need a "due today" UX bucket.
- Should the manager dashboard let a manager *delete* records, or only reassign? PRD does not specify. Default in this design: reassignment only; deletion is not in MVP.
- Currency: all monetary fields are assumed to be MYR. Should the schema store currency explicitly to future-proof multi-country expansion?
- How is the very first `MANAGER` created? This design assumes a one-off seed script. A future change can introduce an in-app admin promote flow.
