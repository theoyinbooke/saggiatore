"""Tests for prompt builders — ensures prompts match JS implementation patterns."""

from saggiatore.models import Persona, Scenario, ToolDefinition, ToolParameter
from saggiatore.orchestrator.prompts import build_agent_system_prompt, build_persona_system_prompt


def _make_test_tool():
    return ToolDefinition(
        name="check_visa_eligibility",
        description="Check if someone is eligible for a specific visa type",
        category="eligibility",
        parameters=[
            ToolParameter(name="visa_type", type="string", description="Visa type", required=True)
        ],
        return_type="object",
        return_description="Eligibility result with recommendations",
    )


def _make_test_persona():
    return Persona(
        name="Raj Patel",
        age=32,
        nationality="Indian",
        country_flag="🇮🇳",
        current_status="H-1B holder",
        visa_type="H-1B",
        complexity_level="medium",
        backstory="Software engineer seeking green card.",
        goals=["Obtain EB-2 green card"],
        challenges=["Long India backlog"],
        family_info="Married with one child",
        employment_info="Senior engineer at tech company",
        education_info="MS in Computer Science",
        tags=["employment-based"],
    )


def _make_test_scenario():
    return Scenario(
        title="H-1B to Green Card Transition",
        category="visa_application",
        complexity="medium",
        description="Raj wants to transition from H-1B to EB-2 green card.",
        persona_index=0,
        expected_tools=["check_visa_eligibility"],
        success_criteria=["Explains EB-2 process"],
        max_turns=8,
    )


def test_agent_system_prompt_contains_guidelines():
    tools = [_make_test_tool()]
    prompt = build_agent_system_prompt(tools)

    assert "expert immigration legal assistant" in prompt.lower()
    assert "empathetic" in prompt.lower()
    assert "check_visa_eligibility" in prompt
    assert "guidelines" in prompt.lower() or "GUIDELINES" in prompt


def test_agent_system_prompt_lists_all_tools():
    tools = [
        _make_test_tool(),
        ToolDefinition(
            name="get_processing_times",
            description="Look up current processing times",
            category="processing",
            parameters=[],
            return_type="object",
            return_description="Processing time estimates",
        ),
    ]
    prompt = build_agent_system_prompt(tools)
    assert "check_visa_eligibility" in prompt
    assert "get_processing_times" in prompt


def test_persona_prompt_includes_character():
    persona = _make_test_persona()
    scenario = _make_test_scenario()
    prompt = build_persona_system_prompt(persona, scenario)

    assert "Raj Patel" in prompt
    assert "32-year-old" in prompt
    assert "Indian" in prompt
    assert "H-1B holder" in prompt
    assert "Obtain EB-2 green card" in prompt
    assert "Long India backlog" in prompt
    assert "Married with one child" in prompt
    assert "Stay in character" in prompt


def test_persona_prompt_includes_scenario():
    persona = _make_test_persona()
    scenario = _make_test_scenario()
    prompt = build_persona_system_prompt(persona, scenario)

    assert "H-1B to Green Card Transition" in prompt
    assert "transition from H-1B to EB-2" in prompt
