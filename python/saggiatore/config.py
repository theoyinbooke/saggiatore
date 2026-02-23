"""Settings and model registry configuration."""

from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings

from .models import ModelConfig


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # LLM Provider API Keys
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    groq_api_key: str = ""

    # Galileo
    galileo_api_key: str = ""
    galileo_project: str = "saggiatore-python"
    galileo_log_stream: str = "immigration-eval"

    # Simulator model (cheap, fast model for persona + tool simulation)
    simulator_model: str = "gpt-4o-mini"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


def get_settings() -> Settings:
    """Load settings, searching for .env in the python/ directory."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        os.environ.setdefault("ENV_FILE", str(env_path))
    return Settings(_env_file=str(env_path) if env_path.exists() else None)


def get_data_dir() -> Path:
    """Resolve the shared data/ directory at the repo root."""
    # python/saggiatore/config.py -> python/ -> repo root -> data/
    repo_root = Path(__file__).resolve().parent.parent.parent
    data_dir = repo_root / "data"
    if not data_dir.exists():
        raise FileNotFoundError(
            f"Data directory not found at {data_dir}. "
            "Ensure you're running from within the saggiatore repository."
        )
    return data_dir


def get_results_dir() -> Path:
    """Resolve the results output directory."""
    results_dir = Path(__file__).resolve().parent.parent / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    return results_dir


# ---------------------------------------------------------------------------
# Default model registry (mirrors modelRegistry.ts seedDefaults)
# ---------------------------------------------------------------------------

DEFAULT_MODELS: list[ModelConfig] = [
    ModelConfig(
        model_id="gpt-4o",
        display_name="GPT-4o",
        provider="openai",
        api_model="gpt-4o",
        env_key="OPENAI_API_KEY",
        supports_tools=True,
    ),
    ModelConfig(
        model_id="claude-sonnet-4-5",
        display_name="Claude Sonnet 4.5",
        provider="openrouter",
        api_model="anthropic/claude-sonnet-4.5",
        env_key="OPENROUTER_API_KEY",
        supports_tools=True,
    ),
    ModelConfig(
        model_id="llama-3.3-70b-versatile",
        display_name="Llama 3.3 70B",
        provider="groq",
        api_model="llama-3.3-70b-versatile",
        env_key="GROQ_API_KEY",
        supports_tools=True,
    ),
]


def get_available_models(settings: Settings) -> list[ModelConfig]:
    """Return models whose API keys are configured."""
    available = []
    key_map = {
        "OPENAI_API_KEY": settings.openai_api_key,
        "OPENROUTER_API_KEY": settings.openrouter_api_key,
        "GROQ_API_KEY": settings.groq_api_key,
    }
    for model in DEFAULT_MODELS:
        if key_map.get(model.env_key, ""):
            available.append(model)
    return available


def get_model_config(model_id: str) -> ModelConfig | None:
    """Look up a model by its ID."""
    for model in DEFAULT_MODELS:
        if model.model_id == model_id:
            return model
    return None
