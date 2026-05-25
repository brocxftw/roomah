# ROOMAH

ROOMAH is an operational CRM for Malaysian Real Estate Negotiators (RENs). The MVP replaces spreadsheet workflows for leads, properties, viewings, follow-ups, deals, commissions, and manager oversight.

## Project Structure

```text
ROOMAH/
  frontend/   Next.js + TypeScript + TailwindCSS + Shadcn UI
  backend/    FastAPI backend
  openspec/   Product specs and implementation tasks
```

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

### Frontend Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload
```

If `uv` is installed:

```powershell
cd backend
uv sync --dev
uv run uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`.

### Transitional Property Price Field

`properties.price` is a deprecated transitional column kept for compatibility while ROOMAH moves to listing-aware pricing. New code should read and write `properties.listing_price` for sale listings and `properties.expected_rental` for rental listings. During the transition, the backend keeps `price` synchronized with the canonical listing value; a follow-on cleanup change will remove `price`.

### Marketing Campaigns

ROOMAH supports operational marketing attribution through `/app/campaigns` and the backend `/campaigns` API. Campaigns are team-scoped and track channel, lifecycle status (`Draft`, `Active`, `Paused`, `Completed`), ad spend, impressions, clicks, generated leads, conversions, cost-per-lead, and conversion rate.

Leads can optionally store `campaign_id`; campaign counters update when leads are attributed or deals close. The schema mirrors the downstream silver `marketing_campaigns` table so Databricks/Power BI can source campaign performance from the operational store.

### Backend Environment

Create `backend/.env`:

```env
APP_ENV=local
FRONTEND_ORIGIN=http://localhost:3000
CLERK_SECRET_KEY=
CLERK_JWKS_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEFAULT_TEAM_ID=
```

## Quality Checks

Frontend:

```powershell
cd frontend
npm run lint
npm run typecheck
npm run test
```

Backend:

```powershell
cd backend
ruff check .
black --check .
pytest
```

The frontend test suite is [Vitest](https://vitest.dev) + `@testing-library/react` (jsdom environment); see `frontend/vitest.config.ts` and `frontend/vitest.setup.ts`. The root `npm run test` script runs both suites and is invoked by the pre-commit hook (`.githooks/pre-commit`).

## Database Migrations

Migrations live in `supabase/migrations/` and are applied via the [Supabase CLI](https://supabase.com/docs/guides/cli). The CLI bundles a local Postgres + Auth stack via Docker, so a working **Docker Desktop** install is required for `supabase db reset` and `supabase start`.

First-time setup:

```powershell
npx supabase init     # creates supabase/config.toml if missing (already committed)
npx supabase start    # boots local Postgres + Auth + Storage in Docker
```

Apply all migrations to a fresh local database:

```powershell
npx supabase db reset
```

`supabase db reset` drops the local schema, replays every file in `supabase/migrations/` in lexicographic order, and runs any seed SQL. It is the canonical way to verify a migration applies cleanly from zero.

After reset, smoke-check the `add-property-domain-fields` migration via the local Studio at <http://localhost:54323> or with `psql`:

```sql
-- listing_type enum exists with the three expected values
select enumlabel from pg_enum where enumtypid = 'public.listing_type'::regtype order by enumsortorder;
-- expected: Sale, Rental, Both

-- properties has the new columns
\d+ public.properties
-- expected: listing_type, market_value, listing_price, expected_rental, year_built, maintenance_fee

-- users has the new columns
\d+ public.users
-- expected: full_name (not null), phone_number, active_status (not null, default true)

-- backfills produced no nulls
select count(*) from public.properties where listing_price is null and price is not null; -- expected: 0
select count(*) from public.users where full_name is null;                                 -- expected: 0
```

To apply migrations to a remote (staging / production) Supabase project:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push
```

## OpenSpec

The active MVP change lives at `openspec/changes/roomah-mvp/`.

```powershell
openspec status --change roomah-mvp
openspec validate roomah-mvp --strict
```
