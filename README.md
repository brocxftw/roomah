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
```

Backend:

```powershell
cd backend
ruff check .
black --check .
pytest
```

## OpenSpec

The active MVP change lives at `openspec/changes/roomah-mvp/`.

```powershell
openspec status --change roomah-mvp
openspec validate roomah-mvp --strict
```
