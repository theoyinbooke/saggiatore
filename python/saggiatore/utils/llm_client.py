"""Multi-provider LLM wrapper using LangChain's ChatOpenAI.

Mirrors llmClient.ts — all three providers (OpenAI, OpenRouter, Groq) use
OpenAI-compatible APIs, so ChatOpenAI with a custom base_url handles all.
"""

from __future__ import annotations

from langchain_openai import ChatOpenAI

from ..config import get_settings
from ..models import ModelConfig

# Provider endpoint configuration (mirrors PROVIDER_CONFIG in llmClient.ts)
PROVIDER_CONFIG = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "env_key": "OPENAI_API_KEY",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "env_key": "OPENROUTER_API_KEY",
        "default_headers": {
            "X-Title": "Saggiatore Immigration Agent Eval",
        },
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "env_key": "GROQ_API_KEY",
    },
}


def get_agent_llm(config: ModelConfig, temperature: float = 0.7) -> ChatOpenAI:
    """Get a LangChain chat model for the agent under test.

    Routes to the correct provider based on config. All providers use
    OpenAI-compatible APIs, so ChatOpenAI with base_url works for all.
    """
    settings = get_settings()
    provider_cfg = PROVIDER_CONFIG[config.provider]

    key_map = {
        "OPENAI_API_KEY": settings.openai_api_key,
        "OPENROUTER_API_KEY": settings.openrouter_api_key,
        "GROQ_API_KEY": settings.groq_api_key,
    }
    api_key = key_map.get(config.env_key, "")
    if not api_key:
        raise ValueError(
            f"{config.env_key} not configured. Set it in your .env file "
            f"to use {config.display_name}."
        )

    kwargs: dict = {
        "model": config.api_model,
        "api_key": api_key,
        "temperature": temperature,
    }

    # Only set base_url for non-OpenAI providers
    if config.provider != "openai":
        kwargs["base_url"] = provider_cfg["base_url"]

    if "default_headers" in provider_cfg:
        kwargs["default_headers"] = provider_cfg["default_headers"]

    return ChatOpenAI(**kwargs)


def get_simulator_llm(temperature: float = 0.7, max_tokens: int = 500) -> ChatOpenAI:
    """Get a cheap/fast LLM for persona and tool simulation (gpt-4o-mini).

    Mirrors the JS implementation which uses OpenAI gpt-4o-mini for both
    the persona simulator and tool response simulator.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        raise ValueError(
            "OPENAI_API_KEY is required for the persona/tool simulator (gpt-4o-mini)."
        )

    return ChatOpenAI(
        model=settings.simulator_model,
        api_key=settings.openai_api_key,
        temperature=temperature,
        max_tokens=max_tokens,
    )
