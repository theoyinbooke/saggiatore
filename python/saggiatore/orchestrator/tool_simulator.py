"""Tool simulation via LLM — converts tool definitions to LangChain tools.

Each tool, when called, invokes gpt-4o-mini to generate a realistic JSON
response. This mirrors callToolSimulator() in orchestrator.ts.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import StructuredTool
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, create_model

from ..models import ToolDefinition

# Map JSON schema types to Python types for dynamic Pydantic model creation
_TYPE_MAP: dict[str, type] = {
    "string": str,
    "number": float,
    "integer": int,
    "boolean": bool,
    "array": list,
    "object": dict,
}


def _build_args_schema(tool_def: ToolDefinition) -> type[BaseModel]:
    """Dynamically create a Pydantic model from tool parameter definitions."""
    fields: dict[str, Any] = {}
    for param in tool_def.parameters:
        py_type = _TYPE_MAP.get(param.type, str)
        if param.required:
            fields[param.name] = (py_type, ...)
        else:
            fields[param.name] = (py_type | None, None)

    return create_model(f"{tool_def.name}_Args", **fields)


def _build_simulator_prompt(tool_def: ToolDefinition) -> str:
    """Build the system prompt for the tool simulator.

    Mirrors the system prompt in callToolSimulator() from orchestrator.ts.
    """
    return (
        "You are a simulated immigration tool API. You return realistic, "
        "plausible JSON responses for immigration-related tool calls.\n\n"
        f"Tool: {tool_def.name}\n"
        f"Description: {tool_def.description}\n"
        f"Expected return: {tool_def.return_type} — {tool_def.return_description}\n\n"
        "Return a realistic JSON response based on the arguments provided. "
        "Make the data plausible and detailed for an immigration context. "
        "Return ONLY valid JSON, no explanation."
    )


def create_simulated_tools(
    tool_definitions: list[ToolDefinition],
    simulator_llm: ChatOpenAI,
) -> list[StructuredTool]:
    """Convert tool definitions to LangChain StructuredTool instances.

    Each tool calls the simulator LLM to generate realistic JSON responses,
    identical to how callToolSimulator() works in the JS implementation.
    """
    tools = []

    for tool_def in tool_definitions:
        args_schema = _build_args_schema(tool_def)
        sys_prompt = _build_simulator_prompt(tool_def)

        # Capture tool_def in closure via default arg
        def _make_tool_fn(prompt: str = sys_prompt):
            def tool_fn(**kwargs: Any) -> str:
                arguments_str = json.dumps(kwargs, default=str)
                messages = [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"Arguments: {arguments_str}"},
                ]
                try:
                    response = simulator_llm.invoke(messages)
                    return response.content or json.dumps({"error": "Tool simulation failed"})
                except Exception as e:
                    return json.dumps({"error": f"Tool simulation error: {str(e)}"})

            return tool_fn

        tool = StructuredTool(
            name=tool_def.name,
            description=tool_def.description,
            func=_make_tool_fn(),
            args_schema=args_schema,
        )
        tools.append(tool)

    return tools
