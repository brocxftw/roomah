## Context

ROOMAH is a monorepo with three runtime pieces:
- `frontend/` — Next.js 16 (App Router, SSR via `middleware.ts`, `redirects()`, Supabase SSR). Talks to the backend through `NEXT_PUBLIC_API_BASE_URL` and to Supabase via `NEXT_PUBLIC_SUPABASE_*`.
- `backend/` — FastAPI (Python 3.11+, uvicorn). CORS is origin-allow-listed in `app/main.py` and currently only permits configured origins plus localhost.
- `supabase/` — managed DB + Auth, with SQL migrations in `supabase/migrations/`.

The repo already has a root `package.json` that aggregates quality gates (`lint`, `typecheck`, `test`, `precommit`) across both sub-projects. Work currently lives on branch `Dashboard`; the remote is `github.com/brocxftw/roomah`. The goal is a **minimal** public demo deployment with an automated pipeline and easy frontend rollback — not a full production release process.

This design implements **option B (single environment)**: one Supabase project and one Render backend serve both production and Netlify deploy previews, with CORS widened to make previews safe.

## Goals / Non-Goals

**Goals:**
- Frontend publicly hosted on Netlify with zero-config Next.js 16 support and automatic deploys per push/PR.
- Backend publicly hosted on Render as a single uvicorn web service.
- CI gates (lint, typecheck, tests) block bad merges to `main`.
- Supabase migrations applied automatically in CI before the app deploys.
- One-click frontend rollback via Netlify deploy history.
- Deploy previews can call the single backend without CORS errors.
- Repo cleaned of clutter before the first push to `main`.

**Non-Goals:**
- Separate prod/staging Supabase projects or backends (deferred until real users).
- Release tags, changelogs, or coordinated multi-tier release tooling.
- Automated/instant database rollback (only additive migrations are allowed for now).
- Notification delivery, custom domains, or CDN tuning beyond Netlify defaults.

## Decisions

### Decision: Netlify for the frontend (not static export)
The app uses SSR features, so a static export is not viable. Netlify's OpenNext adapter supports Next.js 16 with zero config and is auto-provisioned. We add a root `netlify.toml` with `base = "frontend"` and the `@netlify/plugin-nextjs` plugin (unpinned, per Netlify's recommendation to receive compatibility updates).
- *Alternative considered:* Vercel — equally turnkey for Next.js, but Netlify was the explicit requirement.

### Decision: Render for the backend (not Netlify Functions)
FastAPI is a long-running ASGI app with auth middleware; it does not fit Netlify's function model. Render runs it natively as a uvicorn web service with a simple start command and env vars.
- *Alternative considered:* Railway (trial-credit billing), Fly.io (more setup). Render chosen for simplest "just works" free-tier fit for a demo.

### Decision: Single Supabase + single backend, CORS regex for previews (option B)
Standing up duplicate staging infra is overkill for a demo whose purpose is to validate the pipeline. Instead, one backend serves prod and previews. To keep previews working, backend CORS adds `allow_origin_regex` matching Netlify preview subdomains (e.g. `https://.*--<site>\.netlify\.app`) plus the explicit production origin.
- *Alternative considered:* Full prod/staging split (option A) — safer data isolation but ~2x infra; deferred to the real-users phase.

### Decision: GitHub Actions for CI gates, Netlify/Render for CD
CI (GitHub Actions) runs the existing root scripts on PRs and `main`. CD is handled by the platforms' native Git integration (Netlify auto-deploys, Render auto-deploys). Branch protection on `main` requires the CI checks to pass before merge, so broken code never promotes.

### Decision: Migrations run in CI before deploy, additive-only
A CI job runs `supabase db push` against the single Supabase project before the application deploys, so new code never meets an old schema. While frontend rollback is the only safety net, migrations MUST be additive/backward-compatible so a rolled-back frontend still works against the current schema.

### Decision: Frontend rollback via Netlify deploy history
Netlify keeps every deploy immutable; "Publish deploy" on a prior build is an instant revert. This satisfies the "manage revisions" requirement with zero custom tooling.

## Risks / Trade-offs

- **Single Supabase serves previews and prod** → Preview deploys read/write production data. Mitigation: accepted for demo stage; documented; upgrade to option A before real users.
- **CORS regex too broad** → A loose regex could allow unintended origins. Mitigation: anchor the regex to the exact site slug (`--<site>\.netlify\.app$`), not all of `netlify.app`.
- **Non-additive migration ships** → A frontend rollback could break against a changed schema. Mitigation: enforce additive-only migrations by convention/review during this phase; no destructive `DROP`/rename without a compatibility window.
- **Render free tier cold starts** → First request after idle is slow. Mitigation: acceptable for a demo; revisit paid tier if needed.
- **Supabase Auth redirect URLs not updated** → Login fails in production. Mitigation: explicit task to add the Netlify domain to Supabase Auth allowed URLs.
- **Secrets committed during cleanup** → Mitigation: only `.env*.example` files are tracked; verify no real `.env` is added.

## Migration Plan

1. Clean the repo (remove `openspec_bak/`, resolve `unsplash-smart-mcp-server/`, fix logo asset placement) on a branch.
2. Add config files: `netlify.toml`, `backend/.env.example`, `render.yaml`, `.github/workflows/ci.yml`; widen backend CORS.
3. Open a PR → verify CI gates run and a Netlify deploy preview builds against the backend.
4. Merge to `main` → Supabase migrations apply, backend deploys to Render, frontend deploys to Netlify production.
5. Configure Supabase Auth allowed URLs and platform env vars.

**Rollback:** Frontend — re-publish the previous Netlify deploy. Backend — redeploy the previous Render commit. Database — none automatic; rely on additive-only migrations.

## Open Questions

- Final Netlify site slug (determines the CORS preview regex) — resolved at site creation.
- Whether `supabase db push` runs via the Supabase CLI with a project ref + access token stored as GitHub secrets (assumed yes).
