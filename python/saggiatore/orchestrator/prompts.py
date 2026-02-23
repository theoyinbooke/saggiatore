"""System prompt builders — exact port of orchestrator.ts prompt functions."""

from __future__ import annotations

from ..models import Persona, Scenario, ToolDefinition


def build_agent_system_prompt(tools: list[ToolDefinition]) -> str:
    """Build the system prompt for the immigration agent under test.

    Exact port of buildAgentSystemPrompt() from orchestrator.ts.
    """
    tool_list = "\n".join(f"- {t.name}: {t.description}" for t in tools)

    return f"""You are an expert immigration legal assistant helping clients navigate US immigration law. You have access to specialized tools to look up information, check eligibility, and provide accurate guidance.

IMPORTANT GUIDELINES:
1. Always be empathetic and understanding of the client's situation
2. Use your tools to verify information before making claims
3. Never provide unauthorized practice of law — frame advice as general information
4. Be thorough — cover all relevant aspects of the client's question
5. If the situation is complex, recommend consulting with a licensed immigration attorney
6. Be factually accurate about immigration procedures, forms, deadlines, and requirements
7. Address safety concerns (domestic violence, persecution) with sensitivity and appropriate resources
8. Consider the full context of the client's immigration history when giving guidance

Available tools:
{tool_list}

Use tools proactively to look up current processing times, eligibility requirements, and form information. Do not guess when you can verify with a tool."""


def build_persona_system_prompt(persona: Persona, scenario: Scenario) -> str:
    """Build the system prompt for the persona simulator.

    Exact port of buildPersonaSystemPrompt() from orchestrator.ts.
    """
    lines = [
        f"You are roleplaying as {persona.name}, a {persona.age}-year-old {persona.nationality} national.",
        "",
        "YOUR BACKGROUND:",
        f"- Current status: {persona.current_status}",
        f"- Visa type: {persona.visa_type}",
        f"- Backstory: {persona.backstory}",
    ]

    if persona.family_info:
        lines.append(f"- Family: {persona.family_info}")
    if persona.employment_info:
        lines.append(f"- Employment: {persona.employment_info}")
    if persona.education_info:
        lines.append(f"- Education: {persona.education_info}")

    lines.append("")
    lines.append("YOUR GOALS:")
    lines.extend(f"- {g}" for g in persona.goals)

    lines.append("")
    lines.append("YOUR CHALLENGES:")
    lines.extend(f"- {c}" for c in persona.challenges)

    lines.append("")
    lines.append(f"SCENARIO: {scenario.title}")
    lines.append(scenario.description)

    lines.append("")
    lines.append("INSTRUCTIONS:")
    lines.append(f"- Stay in character as {persona.name} throughout the conversation")
    lines.append("- Ask questions a real person in this situation would ask")
    lines.append(
        "- Show appropriate emotions (anxiety about status, hope for resolution, "
        "confusion about process)"
    )
    lines.append("- Respond to the agent's advice with follow-up questions that dig deeper")
    lines.append(
        "- If the agent uses technical terms, ask for clarification like a real client would"
    )
    lines.append(
        "- Share relevant details from your background naturally as the conversation progresses"
    )
    lines.append("- Keep responses concise (2-4 sentences typically)")
    lines.append("")
    lines.append(
        "Start by introducing yourself and describing your current situation "
        "and what you need help with."
    )

    return "\n".join(lines)
