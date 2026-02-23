"""Tests for Pydantic data models."""

from saggiatore.models import (
    EvalMetrics,
    ModelConfig,
    Persona,
    Scenario,
    ToolDefinition,
    ToolParameter,
)


def test_persona_from_json():
    """Test loading a persona from JSON-like dict with camelCase keys."""
    data = {
        "name": "Test User",
        "age": 30,
        "nationality": "Indian",
        "countryFlag": "🇮🇳",
        "currentStatus": "H-1B holder",
        "visaType": "H-1B",
        "complexityLevel": "medium",
        "backstory": "A test persona.",
        "goals": ["Get green card"],
        "challenges": ["Long backlog"],
        "tags": ["test"],
    }
    persona = Persona.model_validate(data)
    assert persona.name == "Test User"
    assert persona.country_flag == "🇮🇳"
    assert persona.current_status == "H-1B holder"
    assert persona.complexity_level == "medium"


def test_tool_definition_from_json():
    """Test loading a tool definition with camelCase keys."""
    data = {
        "name": "check_visa",
        "description": "Check visa eligibility",
        "category": "eligibility",
        "parameters": [
            {
                "name": "visa_type",
                "type": "string",
                "description": "Visa category",
                "required": True,
            }
        ],
        "returnType": "object",
        "returnDescription": "Eligibility result",
    }
    tool = ToolDefinition.model_validate(data)
    assert tool.name == "check_visa"
    assert tool.return_type == "object"
    assert len(tool.parameters) == 1


def test_scenario_from_json():
    """Test loading a scenario with camelCase keys."""
    data = {
        "title": "H-1B Filing",
        "category": "visa_application",
        "complexity": "medium",
        "description": "Test scenario",
        "personaIndex": 0,
        "expectedTools": ["check_visa"],
        "successCriteria": ["Explains H-1B"],
        "maxTurns": 10,
    }
    scenario = Scenario.model_validate(data)
    assert scenario.persona_index == 0
    assert scenario.max_turns == 10
    assert scenario.expected_tools == ["check_visa"]


def test_eval_metrics_defaults():
    """Test that EvalMetrics has zero defaults."""
    metrics = EvalMetrics()
    assert metrics.tool_accuracy == 0.0
    assert metrics.safety_compliance == 0.0


def test_model_config():
    """Test ModelConfig creation."""
    config = ModelConfig(
        model_id="gpt-4o",
        display_name="GPT-4o",
        provider="openai",
        api_model="gpt-4o",
        env_key="OPENAI_API_KEY",
    )
    assert config.supports_tools is True
