# ROOMAH Backend

FastAPI backend for the ROOMAH CRM MVP.

## Local Development

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload
```

If `uv` is installed:

```powershell
uv sync --dev
uv run uvicorn app.main:app --reload
```

## Quality Checks

```powershell
ruff check .
black --check .
pytest
```
