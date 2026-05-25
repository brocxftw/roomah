## 1. Repository and tooling bootstrap

- [x] 1.1 Create `ROOMAH/frontend/` Next.js 14+ app with TypeScript, TailwindCSS, and Shadcn UI initialized
- [x] 1.2 Create `ROOMAH/backend/` FastAPI project with Poetry or uv, lint (ruff) and format (black) configured
- [x] 1.3 Add root README in `ROOMAH/` documenting how to run frontend and backend locally and the env vars required
- [x] 1.4 Set up shared linting (eslint + prettier in frontend, ruff + black in backend) and a pre-commit hook running both
- [x] 1.5 Configure environment variable loading (`.env.local` for frontend, `.env` for backend) with example files committed
- [x] 1.6 Wire CI (GitHub Actions) to lint and type-check both apps on PR

## 2. Supabase data model (auth capability foundation)

- [x] 2.1 Create Supabase project and capture URL, anon key, and service role key in env files
- [x] 2.2 Write initial migration creating `teams` (id, name, created_at)
- [x] 2.3 Write migration creating `users` (id, auth_user_id unique fk to `auth.users`, team_id fk, email, role enum REN/MANAGER, commission_rate numeric, created_at)
- [x] 2.4 Write migration creating `team_config` (team_id pk/fk, default_agency_fee numeric, default_lawyer_fees numeric, updated_at)
- [x] 2.5 Write migration creating `leads` (id, team_id, ren_id, name, phone, email, budget_min, budget_max, preferred_location, preferred_property_type, status enum Active/Negotiating/Closed/Lost, created_at, updated_at)
- [x] 2.6 Write migration creating `properties` (id, team_id, ren_id, name, type, location, price, status enum Active/Pending/Inactive, bedrooms, bathrooms, sqft, parking, furnishing, description, created_at, updated_at)
- [x] 2.7 Write migration creating `property_images` (id, property_id, storage_path, is_cover bool, sort_order int) with partial unique index ensuring exactly one cover per property
- [x] 2.8 Write migration creating `lead_properties` (lead_id, property_id, status enum active/inactive, created_at, primary key (lead_id, property_id))
- [x] 2.9 Write migration creating `viewings` (id, team_id, lead_id, property_id, assigned_ren_id, scheduled_at, status enum scheduled/completed/cancelled, interest_level smallint nullable, notes text nullable, completed_at nullable, created_at)
- [x] 2.10 Write migration creating `deals` (id, team_id, lead_id, property_id, ren_id, sale_price, commission_rate snapshot, agency_fee snapshot, lawyer_fees snapshot, commission_total, commission_override nullable, closed_at, created_at)
- [x] 2.11 Write migration creating `timeline_events` (id, team_id, lead_id, event_type enum, source enum system/user, payload jsonb, created_by user id, created_at) with index on (lead_id, created_at desc)
- [x] 2.12 Seed exactly one row in `teams` representing the default team and one row in `team_config` with team-wide fee defaults
- [x] 2.13 Add Postgres trigger or generated column maintaining `leads.last_interaction_at` from `leads.created_at` plus the latest `timeline_events.created_at` and `viewings.completed_at` for the lead

## 3. Row-Level Security policies

- [x] 3.1 Enable RLS on `users`, `leads`, `properties`, `property_images`, `lead_properties`, `viewings`, `deals`, `timeline_events`, `team_config`
- [x] 3.2 Create RLS policy: every read/write on team-scoped tables filters by `team_id` from Supabase Auth JWT claims
- [x] 3.3 Create RLS policy: RENs may read/write their own owned `leads`, `properties`, `viewings`; MANAGERs may read/write all team rows
- [x] 3.4 Create RLS policy: `timeline_events` readable only by the lead's owning REN and any MANAGER on the same team
- [x] 3.5 Create RLS policy: `users.commission_rate` editable only by MANAGER; `users.role` editable only by MANAGER

## 4. Storage bucket configuration

- [x] 4.1 Create Supabase Storage bucket `property-images` with public read disabled and signed-URL access only
- [x] 4.2 Configure storage policy enforcing path prefix `team_id/property_id/...` for uploads
- [x] 4.3 Set hard size cap (e.g. 10 MB per image) at the storage policy level

## 5. Supabase Auth integration

- [ ] 5.1 Configure Supabase Auth with email/password and Google OAuth enabled
- [ ] 5.2 Configure Supabase Auth redirect URLs for local development and production Netlify domains
- [x] 5.3 Add database trigger that creates a `public.users` row for each new `auth.users` row with default team and `role = REN`
- [x] 5.4 Add Supabase custom access token hook emitting `team_id`, `role`, and application `user_id` claims from `public.users`
- [x] 5.5 Implement frontend Supabase Auth provider/session handling in the Next.js app router and protected route group `/app/...`
- [x] 5.6 Implement backend FastAPI middleware that verifies Supabase Auth JWTs and exposes `user_id`, `team_id`, `role` to handlers

## 6. Backend FastAPI scaffolding

- [x] 6.1 Create the FastAPI app with health check, CORS configured for the frontend origin, and structured JSON logging
- [x] 6.2 Add a Supabase client factory exposing both a user-scoped client (RLS applies) and a service-role client (admin operations)
- [x] 6.3 Add Pydantic models for `User`, `Team`, `Lead`, `Property`, `PropertyImage`, `LeadProperty`, `Viewing`, `Deal`, `TimelineEvent`, `TeamConfig`
- [x] 6.4 Add a timeline event emitter helper used by all capability handlers

## 7. Lead management API and UI

- [x] 7.1 Implement `POST /leads` accepting wizard payload, creating the lead, and emitting `lead_created`
- [x] 7.2 Implement `GET /leads` with name/phone/email substring search and status filter, scoped to user or team for MANAGER
- [x] 7.3 Implement `GET /leads/{id}` returning lead detail with linked properties (active and inactive links) and recent timeline
- [x] 7.4 Implement `PATCH /leads/{id}` accepting allowed mutations (status change, customer info update); on status change emit `lead_status_changed`
- [x] 7.5 Implement `POST /leads/{id}/links` to add a property link (active) and emit `property_linked`
- [x] 7.6 Implement `DELETE /leads/{id}/links/{property_id}` to set link status to inactive and emit `property_unlinked`
- [x] 7.7 Implement the four-step Add Lead wizard UI (Customer Details → Budget → Preferences → Review)
- [x] 7.8 Implement the Lead list page with search box and status filter chips
- [x] 7.9 Implement the Lead detail page with status changer, linked-properties panel, and timeline panel
- [x] 7.10 Implement the manual interaction log dialog (`Called`, `Note`, `Callback requested`) that POSTs a manual timeline event

## 8. Property management API and UI

- [x] 8.1 Implement `POST /properties` for property creation
- [x] 8.2 Implement `GET /properties` with search and filters (type, status, price range)
- [x] 8.3 Implement `GET /properties/{id}` returning property + ordered images
- [x] 8.4 Implement `PATCH /properties/{id}` for field updates including status changes
- [x] 8.5 Implement `POST /properties/{id}/images` returning a signed upload URL, then on completion creating a `property_images` row
- [x] 8.6 Implement `PATCH /properties/{id}/images/{image_id}` for setting cover image, with server-side enforcement that flips the previous cover
- [x] 8.7 Implement `DELETE /properties/{id}/images/{image_id}` (forbidden if it is the only image or the current cover)
- [x] 8.8 Implement the four-step Add Property wizard UI (Basic → Additional → Images → Review)
- [x] 8.9 Implement the Property list page with search and filters
- [x] 8.10 Implement the Property detail page with gallery and cover-image selector

## 9. Viewing scheduling API and UI

- [x] 9.1 Implement `POST /viewings` creating a scheduled viewing and emitting `viewing_scheduled` on the lead
- [x] 9.2 Implement `GET /viewings` for current user (or team if MANAGER) ordered by scheduled time
- [x] 9.3 Implement `POST /viewings/{id}/complete` accepting `interest_level` and `notes`, setting `status = completed`, writing `completed_at`, and emitting `viewing_completed` payload `{ interest_level, notes }`
- [x] 9.4 Implement `PATCH /viewings/{id}` for reassignment (MANAGER only changes `assigned_ren_id`)
- [x] 9.5 Implement the Viewing scheduler UI (lead picker → property picker → datetime → assigned REN)
- [x] 9.6 Implement the post-viewing completion dialog with 1-3 star rating and notes field
- [x] 9.7 Implement the suggested follow-up date display on completion (`completed_at + 2 days`)

## 10. Timeline rendering

- [x] 10.1 Implement `GET /leads/{id}/timeline` returning events in reverse chronological order
- [x] 10.2 Implement timeline UI component rendering each `event_type` with capability-specific copy (lead created, property linked/unlinked, viewing scheduled/completed with stars, deal closed, status changed, reassigned, manual call/note/callback)
- [x] 10.3 Confirm via integration test that manual events advance `last_interaction_at` and clear the lead from the Follow-ups Due list

## 11. Deal tracking and commission

- [x] 11.1 Implement `POST /deals` accepting `lead_id`, `property_id`, `sale_price`, optional `agency_fee` override, optional `lawyer_fees` override, optional `commission_override`
- [x] 11.2 Implement server-side validation that the property is currently actively linked to the lead
- [x] 11.3 Implement the cascade transaction: create deal, set lead `Closed`, set property `Inactive`, set every other active link on this property to `inactive` and those leads to `Lost`, emit all required timeline events
- [x] 11.4 Implement commission snapshotting (rate from `users`, fees from `team_config` or per-deal overrides) and persistence of `commission_total`
- [x] 11.5 Implement the Close Deal UI on the lead page with property picker (limited to active links), sale price (pre-filled from property price), fee overrides toggle, and commission preview
- [x] 11.6 Implement the Deals list page (REN sees their own deals, MANAGER sees team)

## 12. Follow-up engine and dashboard

- [x] 12.1 Implement `GET /dashboard` returning Today's Tasks (follow-ups due, upcoming viewings within 7 days, deals closing soon = leads in `Negotiating`) and KPI Summary
- [x] 12.2 Implement the follow-ups-due query using `leads.last_interaction_at + interval '2 days' <= now()` filtered by status in `(Active, Negotiating)`
- [x] 12.3 Implement Quick Actions on the dashboard wired to the three wizards
- [x] 12.4 Implement KPI Summary cards (`Active Leads`, `Properties Listed`, `Deals Closed (month)`, `Monthly Commission`, `Follow-ups Due`)
- [x] 12.5 Enforce layout order: Today's Tasks above Quick Actions above KPI Summary

## 13. Team manager dashboard and admin

- [x] 13.1 Implement `GET /manager/dashboard` returning per-REN aggregates (active leads, pipeline counts by status, monthly viewings, monthly commission, monthly trend) — MANAGER only
- [x] 13.2 Implement `PATCH /leads/{id}/reassign` (MANAGER only) updating `ren_id` and emitting `lead_reassigned`
- [x] 13.3 Implement `PATCH /viewings/{id}/reassign` (MANAGER only) updating `assigned_ren_id`
- [x] 13.4 Implement Team Manager dashboard UI with the columns defined in the team-management spec
- [x] 13.5 Implement REN-row drill-down to that REN's leads and viewings (MANAGER read access)
- [x] 13.6 Add a one-off admin script that promotes a designated email to `MANAGER` on the default team

## 14. Cross-cutting verification

- [x] 14.1 Add integration test: full happy path (sign in → add lead → add property → link → schedule viewing → complete viewing → close deal → verify cascade and timeline)
- [x] 14.2 Add integration test: follow-up timer resets when a manual event is logged
- [x] 14.3 Add integration test: property cascade marks other leads `Lost` and reversing one back to `Active` is allowed
- [x] 14.4 Add integration test: MANAGER can reassign a lead; REN cannot
- [x] 14.5 Add integration test: RLS prevents reading data with a JWT for a different `team_id`
- [x] 14.6 Run `openspec validate roomah-mvp --strict` and confirm zero errors
- [ ] 14.7 Smoke-test on Netlify preview build with the FastAPI deployed and Supabase configured
