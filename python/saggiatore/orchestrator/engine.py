"""Conversation engine — runs multi-turn evaluation sessions using LangChain AgentExecutor.

Replaces the hand-rolled conversation loop in orchestrator.ts with LangChain's
AgentExecutor for the agent's turn, while keeping the outer persona-agent loop.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime

from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from ..models import (
    ConversationMessage,
    EvalMetrics,
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


class ConversationEngine:
    """Runs simulated multi-turn conversations for agent evaluation.

    Three actors (same as JS implementation):
    1. Persona simulator (gpt-4o-mini) — plays the immigration client
    2. Agent under test (the model being evaluated) — via LangChain AgentExecutor
    3. Tool simulator (gpt-4o-mini) — generates fake API responses

    The outer loop (persona turn -> agent turn -> persona turn) is managed here.
    LangChain's AgentExecutor handles the agent's internal tool-call sub-loop.
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
        3. Create AgentExecutor with the model under test
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

            # Create LangChain agent with tool support
            prompt = ChatPromptTemplate.from_messages([
                ("system", agent_system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ])

            if model_config.supports_tools and simulated_tools:
                agent = create_openai_tools_agent(
                    llm=agent_llm,
                    tools=simulated_tools,
                    prompt=prompt,
                )
                executor = AgentExecutor(
                    agent=agent,
                    tools=simulated_tools,
                    verbose=False,
                    max_iterations=5,
                    handle_parsing_errors=True,
                    return_intermediate_steps=True,
                    callbacks=self.callbacks,
                )
            else:
                # For models without tool support, use a simple chain
                agent = create_openai_tools_agent(
                    llm=agent_llm,
                    tools=[],
                    prompt=prompt,
                )
                executor = AgentExecutor(
                    agent=agent,
                    tools=[],
                    verbose=False,
                    max_iterations=1,
                    handle_parsing_errors=True,
                    return_intermediate_steps=True,
                    callbacks=self.callbacks,
                )

            # Create persona simulator
            persona_sim = PersonaSimulator(persona, scenario, simulator_llm)

            # Conversation state
            chat_history: list[BaseMessage] = []
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
                result = await executor.ainvoke(
                    {
                        "input": current_input,
                        "chat_history": chat_history,
                    },
                )

                agent_response = result.get("output", "")

                # Log any intermediate tool calls
                for step in result.get("intermediate_steps", []):
                    action, observation = step
                    messages_log.append(
                        ConversationMessage(
                            role="assistant",
                            content="",
                            turn_number=turn_number,
                            tool_calls=[{
                                "id": f"call_{action.tool}_{turn_number}",
                                "name": action.tool,
                                "arguments": json.dumps(action.tool_input, default=str),
                            }],
                        )
                    )
                    messages_log.append(
                        ConversationMessage(
                            role="tool",
                            content=str(observation),
                            turn_number=turn_number,
                            tool_call_id=f"call_{action.tool}_{turn_number}",
                        )
                    )

                # Log agent's final text response
                messages_log.append(
                    ConversationMessage(
                        role="assistant", content=agent_response, turn_number=turn_number
                    )
                )

                # Update chat history
                chat_history.append(HumanMessage(content=current_input))
                chat_history.append(AIMessage(content=agent_response))
                turn_number += 1

                if turn_number > max_turns:
                    break

                # Persona responds
                persona_msg = await persona_sim.generate_response(
                    # Build flat message list for persona
                    [
                        msg
                        for pair in zip(
                            [HumanMessage(content=m.content) for m in messages_log if m.role == "user"],
                            [AIMessage(content=m.content) for m in messages_log if m.role == "assistant" and m.content],
                        )
                        for msg in pair
                    ]
                )

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
