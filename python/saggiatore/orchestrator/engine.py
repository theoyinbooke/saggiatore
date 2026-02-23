"""Conversation engine — runs multi-turn evaluation sessions using LangChain agents.

Uses LangChain's `create_agent` graph API (v1.x) for the agent's turn while
keeping the outer persona-agent simulation loop.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from ..models import (
    ConversationMessage,
    ModelConfig,
    Persona,
    Scenario,
    SessionResult,
    ToolDefinition,
)
from ..utils.llm_client import get_agent_llm, get_simulator_llm
from .persona import PersonaSimulator
from .prompts import build_agent_system_prompt
from .tool_simulator import create_simulated_tools

logger = logging.getLogger(__name__)


def _stringify_content(content: Any) -> str:
    """Normalize LangChain message content into plain text for logging/output."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text") or item.get("content")
                parts.append(text if isinstance(text, str) else json.dumps(item, default=str))
            else:
                parts.append(str(item))
        return "\n".join(p for p in parts if p).strip()
    if content is None:
        return ""
    return str(content)


def _normalize_tool_calls(raw_tool_calls: list[dict] | None, turn_number: int) -> list[dict]:
    """Map LangChain tool calls to the SessionResult schema."""
    if not raw_tool_calls:
        return []

    normalized: list[dict] = []
    for idx, tc in enumerate(raw_tool_calls, start=1):
        call_id = tc.get("id") or f"call_{tc.get('name', 'tool')}_{turn_number}_{idx}"
        args = tc.get("args", tc.get("arguments", {}))
        if isinstance(args, str):
            args_json = args
        else:
            args_json = json.dumps(args, default=str)
        normalized.append(
            {
                "id": str(call_id),
                "name": tc.get("name", "unknown"),
                "arguments": args_json,
            }
        )
    return normalized


class ConversationEngine:
    """Runs simulated multi-turn conversations for agent evaluation.

    Three actors (same as JS implementation):
    1. Persona simulator (gpt-4o-mini) — plays the immigration client
    2. Agent under test (the model being evaluated) — via LangChain create_agent
    3. Tool simulator (gpt-4o-mini) — generates fake API responses

    The outer loop (persona turn -> agent turn -> persona turn) is managed here.
    LangChain's agent graph handles the internal tool-call sub-loop.
    """

    def __init__(self, tools: list[ToolDefinition], callbacks: list | None = None):
        self.tool_definitions = tools
        self.callbacks = callbacks or []

    async def run_session(
        self,
        scenario: Scenario,
        persona: Persona,
        model_config: ModelConfig,
    ) -> SessionResult:
        """Run a complete evaluation session.

        Flow (mirrors orchestrator.ts runConversation):
        1. Build agent system prompt with tool list
        2. Create LangChain tools from tool definitions
        3. Create LangChain agent graph with the model under test
        4. Create persona simulator
        5. Generate initial persona message
        6. Loop: agent responds -> persona responds -> repeat
        7. Return SessionResult with full conversation log
        """
        started_at = datetime.now()
        messages_log: list[ConversationMessage] = []

        try:
            # Build components
            agent_system_prompt = build_agent_system_prompt(self.tool_definitions)
            simulator_llm = get_simulator_llm()
            agent_llm = get_agent_llm(model_config)

            # Create simulated tools
            simulated_tools = create_simulated_tools(self.tool_definitions, simulator_llm)

            # Store system message
            messages_log.append(
                ConversationMessage(
                    role="system",
                    content=agent_system_prompt,
                    turn_number=0,
                )
            )

            # Create LangChain agent graph (v1.x API)
            agent_tools = simulated_tools if model_config.supports_tools else []
            agent_graph = create_agent(
                model=agent_llm,
                tools=agent_tools,
                system_prompt=agent_system_prompt,
            )

            # Create persona simulator
            persona_sim = PersonaSimulator(persona, scenario, simulator_llm)

            # Conversation state
            chat_history: list = []
            agent_messages: list = []
            turn_number = 1
            max_turns = scenario.max_turns

            # Initial persona message
            logger.info(
                "Session start: %s | Model: %s | Persona: %s",
                scenario.title,
                model_config.model_id,
                persona.name,
            )

            initial_msg = await persona_sim.generate_initial_message()
            messages_log.append(
                ConversationMessage(role="user", content=initial_msg, turn_number=turn_number)
            )
            turn_number += 1

            # Main conversation loop
            current_input = initial_msg

            while turn_number <= max_turns:
                # Agent responds (LangChain handles tool calls internally)
                agent_messages.append(HumanMessage(content=current_input))
                submitted_len = len(agent_messages)

                invoke_config: dict[str, Any] = {"recursion_limit": 25}
                if self.callbacks:
                    invoke_config["callbacks"] = self.callbacks

                result_state = await agent_graph.ainvoke(
                    {"messages": agent_messages},
                    config=invoke_config,
                )
                result_messages = result_state.get("messages", [])
                if not isinstance(result_messages, list):
                    raise ValueError("LangChain agent returned invalid messages payload.")

                # Keep full agent state for the next turn
                agent_messages = list(result_messages)

                # Capture only new agent/tool messages from this turn
                new_messages = result_messages[submitted_len:]
                agent_response = ""

                for msg in new_messages:
                    if isinstance(msg, AIMessage):
                        content = _stringify_content(msg.content)
                        normalized_calls = _normalize_tool_calls(
                            getattr(msg, "tool_calls", None),
                            turn_number=turn_number,
                        )
                        if content or normalized_calls:
                            messages_log.append(
                                ConversationMessage(
                                    role="assistant",
                                    content=content,
                                    turn_number=turn_number,
                                    tool_calls=normalized_calls or None,
                                )
                            )
                        if content:
                            agent_response = content
                    elif isinstance(msg, ToolMessage):
                        messages_log.append(
                            ConversationMessage(
                                role="tool",
                                content=_stringify_content(msg.content),
                                turn_number=turn_number,
                                tool_call_id=getattr(msg, "tool_call_id", None),
                            )
                        )

                if not agent_response:
                    # Fallback to latest AI message content if this turn had only tool calls
                    for msg in reversed(result_messages):
                        if isinstance(msg, AIMessage):
                            agent_response = _stringify_content(msg.content)
                            if agent_response:
                                break

                if not agent_response:
                    agent_response = "I need a moment to process that."
                    messages_log.append(
                        ConversationMessage(
                            role="assistant",
                            content=agent_response,
                            turn_number=turn_number,
                        )
                    )

                # Update chat history
                chat_history.append(HumanMessage(content=current_input))
                chat_history.append(AIMessage(content=agent_response))
                turn_number += 1

                if turn_number > max_turns:
                    break

                # Persona responds
                persona_msg = await persona_sim.generate_response(chat_history)

                messages_log.append(
                    ConversationMessage(
                        role="user", content=persona_msg, turn_number=turn_number
                    )
                )
                current_input = persona_msg
                turn_number += 1

            logger.info(
                "Session complete: %s | Model: %s | Turns: %d",
                scenario.title,
                model_config.model_id,
                turn_number - 1,
            )

            return SessionResult(
                scenario_title=scenario.title,
                scenario_category=scenario.category,
                model_id=model_config.model_id,
                persona_name=persona.name,
                status="completed",
                total_turns=turn_number - 1,
                messages=messages_log,
                started_at=started_at,
                completed_at=datetime.now(),
            )

        except Exception as e:
            logger.error(
                "Session failed: %s | Model: %s | Error: %s",
                scenario.title,
                model_config.model_id,
                str(e),
            )
            return SessionResult(
                scenario_title=scenario.title,
                scenario_category=scenario.category,
                model_id=model_config.model_id,
                persona_name=persona.name,
                status="failed",
                total_turns=len([m for m in messages_log if m.role in ("user", "assistant")]),
                messages=messages_log,
                failure_analysis=[f"Session error: {str(e)}"],
                started_at=started_at,
                completed_at=datetime.now(),
            )
