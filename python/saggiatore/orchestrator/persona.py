"""Persona simulator — LLM roleplaying as an immigration client.

Mirrors callPersonaSimulator() from orchestrator.ts. Uses gpt-4o-mini
to generate realistic client messages based on the persona's background
and the ongoing conversation.
"""

from __future__ import annotations

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from ..models import Persona, Scenario
from .prompts import build_persona_system_prompt


class PersonaSimulator:
    """Simulates a persona (immigration client) in a multi-turn conversation.

    Key behavior ported from orchestrator.ts:
    - System prompt contains the full persona character sheet + scenario
    - Perspective flipping: persona's own messages are 'assistant',
      and the agent's messages become 'user' from the persona's perspective
    """

    def __init__(self, persona: Persona, scenario: Scenario, llm: ChatOpenAI):
        self.persona = persona
        self.scenario = scenario
        self.llm = llm
        self.system_prompt = build_persona_system_prompt(persona, scenario)

    async def generate_initial_message(self) -> str:
        """Generate the persona's opening message (introduces themselves).

        Called with an empty conversation history, so the persona starts
        by describing their situation based on the system prompt.
        """
        messages = [SystemMessage(content=self.system_prompt)]
        response = await self.llm.ainvoke(messages)
        return response.content or "I'm not sure what to say."

    async def generate_response(self, conversation_history: list[BaseMessage]) -> str:
        """Generate the persona's next response given the conversation so far.

        Mirrors the perspective-flipping from orchestrator.ts:
        - Messages the persona previously sent (role=user in main history)
          appear as 'assistant' messages from the persona's perspective
        - Messages from the agent (role=assistant in main history)
          appear as 'user' messages from the persona's perspective
        """
        # Build messages from the persona's perspective
        perspective_messages: list[BaseMessage] = [
            SystemMessage(content=self.system_prompt)
        ]

        for msg in conversation_history:
            if isinstance(msg, HumanMessage):
                # Persona's own previous messages
                perspective_messages.append(AIMessage(content=msg.content))
            elif isinstance(msg, AIMessage) and msg.content:
                # Agent's messages appear as user to the persona
                perspective_messages.append(HumanMessage(content=msg.content))
            # Skip system and tool messages

        response = await self.llm.ainvoke(perspective_messages)
        return response.content or "I'm not sure what to say."
