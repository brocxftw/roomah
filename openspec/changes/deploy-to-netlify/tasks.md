## 1. Repository cleanup (before first push to main)

- [x] 1.1 Confirm nothing imports `frontend/src/app/app/roomah-logo.png`; move it to `frontend/public/` if used, otherwise delete it
- [x] 1.2 Remove `openspec_bak/` from the repository (done manually)
- [x] 1.3 Resolve the tracked `unsplash-smart-mcp-server/` nested project (remove from repo or relocate outside it)
- [x] 1.4 Untrack the `resources/` folder from the repo: add `resources/` to `.gitignore` and `git rm -r --cached resources/` (design-source only; verified not referenced by app code)
- [ ] 1.5 Verify working tree is clean and no real `.env` files are tracked (only `.env*.example`)

## 2. Backend configuration for deployment

- [x] 2.1 Add `backend/.env.example` documenting Supabase settings and `FRONTEND_ORIGIN` (no real secrets)
- [x] 2.2 Update CORS in `backend/app/main.py` to allow the Netlify production origin and add `allow_origin_regex` for `*--<site>.netlify.app` preview subdomains
- [x] 2.3 Add any needed settings to `backend/app/core/config.py` to drive the allowed origin / preview regex
- [x] 2.4 Add `render.yaml` defining the FastAPI web service (Python 3.11, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, working dir `backend/`)

## 3. Frontend configuration for Netlify

- [x] 3.1 Add root `netlify.toml` with `base = "frontend"`, build command `npm run build`, and the `@netlify/plugin-nextjs` plugin
- [x] 3.2 Confirm `frontend/.env.local.example` lists all required `NEXT_PUBLIC_*` variables

## 4. CI pipeline (GitHub Actions)

- [x] 4.1 Add `.github/workflows/ci.yml` running on pull_request and push to `main`
- [x] 4.2 Add a frontend job: setup Node 20, `npm ci`, then `npm run lint`, `npm run typecheck`, `npm run test`
- [x] 4.3 Add a backend job: setup Python 3.11, install dev deps, then `ruff check .` and `pytest`
- [x] 4.4 Add a migration step that runs `supabase db push` against the Supabase project before deploy (using project ref + access token from GitHub secrets)

## 5. Backend deploy on Render

- [ ] 5.1 Create the Render web service connected to the GitHub repo
- [ ] 5.2 Set backend environment variables (Supabase settings, `FRONTEND_ORIGIN` = Netlify production URL)
- [ ] 5.3 Verify `GET /health` returns 200 on the public Render URL

## 6. Frontend deploy on Netlify

- [ ] 6.1 Create the Netlify site from the GitHub repo with base directory `frontend/`
- [ ] 6.2 Set Netlify environment variables (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- [ ] 6.3 Record the final Netlify site slug and update the backend CORS preview regex to match

## 7. Supabase / auth wiring

- [ ] 7.1 Add the Netlify production domain to Supabase Auth allowed redirect/site URLs
- [ ] 7.2 Configure GitHub secrets for the migration step (Supabase project ref + access token)

## 8. End-to-end verification

- [ ] 8.1 Open a PR and confirm CI gates run and a Netlify deploy preview builds and reaches the backend (no CORS errors)
- [ ] 8.2 Configure branch protection on `main` to require the CI checks
- [ ] 8.3 Merge to `main` and confirm migration → backend deploy → frontend production deploy succeed
- [ ] 8.4 Verify login works end-to-end against the deployed stack
- [ ] 8.5 Test a frontend rollback by re-publishing a previous Netlify deploy
