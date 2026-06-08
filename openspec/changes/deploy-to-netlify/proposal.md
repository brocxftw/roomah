## Why

ROOMAH currently only runs locally. To validate the product as a demo and establish a repeatable release process, we need the app hosted publicly with an automated CI/CD pipeline that gates merges and supports easy frontend rollbacks. This change stands up that hosting and pipeline at minimal footprint, deferring a full multi-environment release process until there are real users.

## What Changes

- Host the Next.js 16 frontend on **Netlify** using the zero-config OpenNext adapter, building from the `frontend/` base directory.
- Host the FastAPI backend on **Render** as a single web service running uvicorn.
- Use a **single Supabase project** and a **single backend** for now (minimal footprint, option B). Backend CORS is widened with a regex so Netlify deploy-preview subdomains can call the API safely.
- Add a **GitHub Actions CI workflow** that runs the existing root `package.json` quality gates (lint, typecheck, frontend + backend tests) on PRs and pushes to `main`.
- Apply **Supabase migrations as a CI step** (`supabase db push`) before the application deploys, restricted to additive/backward-compatible migrations while frontend rollback is the safety net.
- Manage revisions via **Netlify's built-in deploy history and one-click rollback** for the frontend; no custom release tooling in this change.
- Add deployment configuration files: root `netlify.toml`, a backend `.env.example`, and a Render service definition.
- **Repo cleanup before first push to `main`**: remove `openspec_bak/` (done), untrack the design-only `resources/` folder via `.gitignore` (verified not referenced by app code), resolve the tracked `unsplash-smart-mcp-server/` nested project, and relocate/remove the misplaced `frontend/src/app/app/roomah-logo.png`.

## Capabilities

### New Capabilities
- `deployment-pipeline`: Defines how the frontend, backend, and database are hosted and deployed, the CI quality gates and migration step, the preview/CORS behavior, the frontend rollback mechanism, and the repository hygiene preconditions for the first production push.

### Modified Capabilities
- None.

## Impact

- Hosting / Infra:
  - Netlify site connected to the GitHub repo (`brocxftw/roomah`), base directory `frontend/`.
  - Render web service for the FastAPI backend.
  - Single Supabase project providing DB + Auth.
- Configuration / new files:
  - Root `netlify.toml` (base dir + `@netlify/plugin-nextjs`).
  - `.github/workflows/ci.yml` running root `lint`, `typecheck`, `test` plus the migration step.
  - `backend/.env.example` documenting `SUPABASE_*`, `FRONTEND_ORIGIN`, and related settings.
  - Render service config (e.g. `render.yaml`).
- Backend code:
  - `backend/app/main.py` CORS updated to allow the Netlify production origin and a regex for `*--<site>.netlify.app` preview URLs (via `allow_origin_regex`).
  - `backend/app/core/config.py` may gain settings to drive the allowed origins / regex.
- Frontend:
  - Reads `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Netlify environment variables at build time.
- External setup (Supabase / Netlify dashboards):
  - Supabase Auth allowed redirect/site URLs must include the Netlify domain.
  - Netlify and Render environment variables configured to point at the single Supabase project and at each other.
- Repository:
  - Removal of `openspec_bak/`, untracking of `resources/` (added to `.gitignore`), and cleanup items listed above; merge of current `Dashboard` branch to `main` via PR.
