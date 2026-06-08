## ADDED Requirements

### Requirement: Frontend hosting on Netlify
The system SHALL host the Next.js frontend on Netlify, built from the `frontend/` base directory using the Netlify Next.js (OpenNext) adapter, with SSR, middleware, and redirects functioning in production.

#### Scenario: Production build and deploy
- **WHEN** a commit is merged to `main`
- **THEN** Netlify builds the site from the `frontend/` base directory using `npm run build`
- **AND** the deployed site serves SSR routes, middleware-protected routes, and configured redirects correctly

#### Scenario: Frontend reads runtime configuration from environment
- **WHEN** Netlify builds the frontend
- **THEN** the build uses `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Netlify environment variables
- **AND** no localhost fallback values are used in the production build

### Requirement: Backend hosting on Render
The system SHALL host the FastAPI backend on Render as a single web service running uvicorn, reachable at a stable public URL.

#### Scenario: Backend serves requests publicly
- **WHEN** a client requests `GET /health` on the Render service URL
- **THEN** the service responds with HTTP 200 and `{"status": "ok"}`

#### Scenario: Backend configured via environment variables
- **WHEN** the Render service starts
- **THEN** it reads Supabase connection settings and `FRONTEND_ORIGIN` from environment variables
- **AND** no secrets are committed to the repository

### Requirement: Single-environment topology
The system SHALL use one Supabase project and one backend service for both production and deploy previews during the demo stage.

#### Scenario: Previews and production share backend and database
- **WHEN** a deploy preview and the production site are both live
- **THEN** both call the same backend service and the same Supabase project

### Requirement: Deploy-preview CORS access
The backend SHALL accept cross-origin requests from the Netlify production origin and from Netlify deploy-preview subdomains for the site, while rejecting unrelated origins.

#### Scenario: Production origin is allowed
- **WHEN** the production Netlify site calls the backend with its origin header
- **THEN** the backend returns the appropriate `Access-Control-Allow-Origin` header and the request succeeds

#### Scenario: Deploy-preview origin is allowed
- **WHEN** a Netlify deploy-preview subdomain for the site calls the backend
- **THEN** the request is allowed via the configured preview-origin regex

#### Scenario: Unrelated origin is rejected
- **WHEN** an origin that is neither the production site nor a matching preview subdomain calls the backend
- **THEN** the backend does not return an allow-origin header for that origin

### Requirement: CI quality gates
The system SHALL run automated quality gates on pull requests and on pushes to `main`, and merging to `main` SHALL require these gates to pass.

#### Scenario: Gates run on a pull request
- **WHEN** a pull request is opened or updated
- **THEN** CI runs lint, typecheck, and the frontend and backend test suites
- **AND** a failing gate reports a failing status check on the pull request

#### Scenario: Branch protection blocks failing merges
- **WHEN** a pull request has a failing required check
- **THEN** the pull request cannot be merged into `main`

### Requirement: Database migrations in CI
The system SHALL apply Supabase migrations as a CI step before the application is deployed, and migrations applied during the demo stage SHALL be additive and backward-compatible.

#### Scenario: Migrations applied before deploy
- **WHEN** changes are merged to `main`
- **THEN** CI runs the Supabase migration step (`supabase db push`) against the Supabase project before the backend and frontend deploys complete

#### Scenario: Additive-only constraint
- **WHEN** a migration is authored during the demo stage
- **THEN** it MUST NOT remove or rename existing columns/tables without a backward-compatible window, so a rolled-back frontend still functions against the current schema

### Requirement: Frontend revision rollback
The system SHALL allow a previously published frontend deploy to be restored without a new build.

#### Scenario: One-click rollback
- **WHEN** a maintainer selects a previous successful Netlify deploy and publishes it
- **THEN** that prior deploy immediately becomes the live production site

### Requirement: Repository readiness for first push
The repository SHALL be free of clutter and misplaced assets before the first push to `main`, and SHALL document required backend environment variables.

#### Scenario: Clutter removed
- **WHEN** the cleanup is complete
- **THEN** `openspec_bak/` is removed, the design-only `resources/` folder is untracked and added to `.gitignore`, the tracked `unsplash-smart-mcp-server/` nested project is removed or relocated, and the misplaced logo asset is resolved

#### Scenario: Backend environment documented
- **WHEN** a developer sets up the backend for deployment
- **THEN** a `backend/.env.example` file documents all required variables (Supabase settings and `FRONTEND_ORIGIN`) without containing real secrets
