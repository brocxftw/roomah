## Why

Malaysian Real Estate Negotiators (RENs) currently coordinate leads, properties, viewings, and deals across many disconnected Google Sheets. Updates are manual, repetitive, and error-prone, follow-ups slip, and managers have no consolidated view of pipeline health.

ROOMAH replaces that fragmented spreadsheet workflow with a single operational CRM where the daily workflow is task-driven ("show what needs action") rather than data-entry-driven. This change establishes the entire v1.0 MVP scope so RENs can run their day inside one system and managers can supervise their team's activity.

## What Changes

- Establish authentication for RENs and Team Managers (email + Google OAuth via Supabase Auth) with session persistence.
- Introduce a team-scoped data model. All core records carry a `team_id`. MVP runs as a single team, but the schema is forward-compatible with multi-tenancy.
- Introduce two user roles: `REN` (default) and `MANAGER`. A `MANAGER` can also act as an `REN` on their own records and can additionally reassign leads and viewings across the team.
- Introduce lead management with a four-state lifecycle: `Active`, `Negotiating`, `Closed`, `Lost`. All states are reversible to `Active`. Leads are owned by exactly one REN and can be linked to multiple properties.
- Introduce property management with statuses `Active`, `Pending`, `Inactive`, required and optional fields, multi-image upload with a designated cover image (Supabase Storage).
- Introduce a viewing scheduler that links a lead to a property at a date/time with an assigned REN, and captures a post-viewing interest rating (1-3 stars) and notes.
- Introduce a unified timeline per lead capturing automatic system events (lead created, property linked, viewing scheduled/completed, deal closed, lead reassigned) and manual REN events (call, note, callback request).
- Introduce a follow-up engine: a follow-up is due `2 days` after the most recent interaction on the lead. Any logged timeline event resets the timer. Only `Active` and `Negotiating` leads generate follow-ups.
- Introduce deal tracking. Closing a deal creates a transaction, snapshots commission inputs, moves the lead to `Closed`, sets the sold property to `Inactive`, sets every other lead linked to that property to `Lost` (REN may revive any of them manually or create new leads), and writes timeline events.
- Introduce commission calculation: `commission = sale_price * commission_rate − agency_fee − lawyer_fees`. `commission_rate` is stored per REN. Sale price is entered manually by the REN at close. Agency fee and lawyer fees default from team config but are editable per deal. A manual `commission_total` override is allowed.
- Introduce an REN dashboard prioritising tasks over analytics: Today's Tasks (follow-ups due, upcoming viewings, deals closing soon), Quick Actions (Add Lead / Add Property / Schedule Viewing), and a KPI summary (active leads, properties listed, deals closed, monthly commission, follow-ups due).
- Introduce a Team Manager dashboard showing each REN's name, active leads, lead pipeline, viewing count, commission, and monthly trend, with the ability to reassign leads and viewings.

## Capabilities

### New Capabilities

- `auth`: User authentication via Supabase Auth (email + Google OAuth), session persistence, role enforcement (`REN`, `MANAGER`), and the team scaffolding (`teams` and user-to-team relationship) used by every other capability.
- `lead-management`: Lead CRUD, four-state lifecycle with reversibility, lead-to-property linking (many-to-many), search and filter, and the follow-up due calculation derived from the latest interaction timestamp.
- `property-management`: Property CRUD, status lifecycle (`Active` / `Pending` / `Inactive`), required vs optional fields, multi-image upload with cover image selection (Supabase Storage), and search and filter.
- `viewing-scheduling`: Scheduling viewings against a lead and property with an assigned REN, the post-viewing interest rating workflow (1-3 stars + notes), and automatic follow-up date suggestion on completion.
- `timeline`: Per-lead chronological event stream covering automatic system events and manually logged REN events; defines which events are emitted by other capabilities.
- `deal-tracking`: Deal closure workflow, commission calculation with per-REN rate snapshot and per-deal fee overrides, manual commission override, and the cascade effects on the sold property, the winning lead, and every other lead linked to that property.
- `dashboard`: REN-facing daily workspace surfacing Today's Tasks (follow-ups due, upcoming viewings, deals closing soon), Quick Actions, and the personal KPI summary.
- `team-management`: Manager-facing oversight: per-REN pipeline view, performance KPIs and monthly trend, and the authority to reassign leads and viewings across team members.

### Modified Capabilities

<!-- None - this is a greenfield product. No existing specs to modify. -->

## Impact

- **Repository structure**: introduces the `ROOMAH/` application (frontend + backend) alongside existing assets such as `databricks_beta_ren_ETL/`. ETL into a downstream warehouse (Databricks / Power BI) is out of scope for this change but must not be blocked by schema choices.
- **Frontend**: new Next.js (TypeScript) app using TailwindCSS and Shadcn UI, hosted on Netlify.
- **Backend**: new FastAPI service exposing REST endpoints consumed by the frontend.
- **Database**: new Supabase Postgres schema covering `teams`, `users`, `leads`, `lead_properties`, `properties`, `property_images`, `viewings`, `timeline_events`, `deals`, and `team_config`.
- **Storage**: Supabase Storage buckets for property images (cover + gallery).
- **Auth**: Supabase Auth integration for email + Google OAuth.
- **Out of scope for this change** (excluded from MVP per PRD): AI assistant, WhatsApp integration, multi-tenancy beyond `team_id` scaffolding, SaaS subscriptions, predictive analytics, mobile app, CSV imports.
