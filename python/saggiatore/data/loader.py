"""Load and validate the shared JSON data files (personas, tools, scenarios)."""

from __future__ import annotations

import json
from pathlib import Path

from ..models import Persona, Scenario, ToolDefinition


def load_personas(data_dir: Path) -> list[Persona]:
    """Load personas from data/personas.json."""
    path = data_dir / "personas.json"
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return [Persona.model_validate(p) for p in raw]


def load_tools(data_dir: Path) -> list[ToolDefinition]:
    """Load tool definitions from data/tools.json."""
    path = data_dir / "tools.json"
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return [ToolDefinition.model_validate(t) for t in raw]


def load_scenarios(data_dir: Path) -> list[Scenario]:
    """Load scenarios from data/scenarios.json."""
    path = data_dir / "scenarios.json"
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return [Scenario.model_validate(s) for s in raw]


def load_all(
    data_dir: Path,
) -> tuple[list[Persona], list[ToolDefinition], list[Scenario]]:
    """Load all data files and validate cross-references.

    Validates:
    - Each scenario's personaIndex points to a valid persona
    - Each scenario's expectedTools reference existing tool names
    """
    personas = load_personas(data_dir)
    tools = load_tools(data_dir)
    scenarios = load_scenarios(data_dir)

    tool_names = {t.name for t in tools}

    for i, scenario in enumerate(scenarios):
        if scenario.persona_index < 0 or scenario.persona_index >= len(personas):
            raise ValueError(
                f"Scenario {i} ({scenario.title!r}) references personaIndex "
                f"{scenario.persona_index}, but only {len(personas)} personas exist."
            )
        for tool_name in scenario.expected_tools:
            if tool_name not in tool_names:
                raise ValueError(
                    f"Scenario {i} ({scenario.title!r}) references tool "
                    f"{tool_name!r} which doesn't exist in tools.json."
                )

    return personas, tools, scenarios
