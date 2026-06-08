from app.core.config import Settings
from app.main import _cors_kwargs


def test_cors_kwargs_includes_frontend_origins_and_preview_regex() -> None:
    """Integration-style config test: CORS behavior depends on settings + middleware."""
    preview_regex = r"^https://deploy-preview-\d+--roomah-demo\.netlify\.app$"
    settings = Settings(
        frontend_origin="https://roomah-demo.netlify.app, https://admin.example.com",
        frontend_origin_regex=preview_regex,
    )

    cors_kwargs = _cors_kwargs(settings)

    assert cors_kwargs["allow_origin_regex"] == preview_regex
    assert "https://roomah-demo.netlify.app" in cors_kwargs["allow_origins"]
    assert "https://admin.example.com" in cors_kwargs["allow_origins"]
    assert "http://localhost:3000" in cors_kwargs["allow_origins"]


def test_cors_kwargs_ignores_blank_preview_regex() -> None:
    settings = Settings(frontend_origin_regex="")

    cors_kwargs = _cors_kwargs(settings)

    assert cors_kwargs["allow_origin_regex"] is None
