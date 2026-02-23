"""Pydantic data models mirroring the shared JSON data structures and Convex schema."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Data file models (loaded from data/*.json)
# ---------------------------------------------------------------------------


class Persona(BaseModel):
    """An immigration client persona used in evaluation scenarios."""

    name: str
    age: int
    nationality: str
    country_flag: str = Field(alias="countryFlag")
    current_status: str = Field(alias="currentStatus")
    visa_type: str = Field(alias="visaType")
    complexity_level: Literal["low", "medium", "high"] = Field(alias="complexityLevel")
    backstory: str
    goals: list[str]
    challenges: list[str]
    family_info: str | None = Field(default=None, alias="familyInfo")
    employment_info: str | None = Field(default=None, alias="employmentInfo")
    education_info: str | None = Field(default=None, alias="educationInfo")
    tags: list[str]

    model_config = {"populate_by_name": True}


class ToolParameter(BaseModel):
    """A parameter definition for a simulated tool."""

    name: str
    type: str
    description: str
    required: bool


class ToolDefinition(BaseModel):
    """A simulated immigration tool (API endpoint)."""

    name: str
    description: str
    category: str
    parameters: list[ToolParameter]
    return_type: str = Field(alias="returnType")
    return_description: str = Field(alias="returnDescription")

    model_config = {"populate_by_name": True}


class Scenario(BaseModel):
    """An evaluation scenario combining a persona with a specific situation."""

    title: str
    category: Literal[
        "visa_application",
        "status_change",
        "family_immigration",
        "deportation_defense",
        "humanitarian",
    ]
    complexity: Literal["low", "medium", "high"]
    description: str
    persona_index: int = Field(alias="personaIndex")
    expected_tools: list[str] = Field(alias="expectedTools")
    success_criteria: list[str] = Field(alias="successCriteria")
    max_turns: int = Field(alias="maxTurns")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Runtime models
# ---------------------------------------------------------------------------

CATEGORY_DISPLAY = {
    "visa_application": "Visa Application",
    "status_change": "Status Change",
    "family_immigration": "Family Immigration",
    "deportation_defense": "Deportation Defense",
    "humanitarian": "Humanitarian",
}


class ModelConfig(BaseModel):
    """Configuration for a model to evaluate."""

    model_id: str
    display_name: str
    provider: Literal["openai", "openrouter", "groq"]
    api_model: str
    env_key: str
    supports_tools: bool = True


class EvalMetrics(BaseModel):
    """Evaluation metrics for a single session (mirrors JS EvalMetrics)."""

    tool_accuracy: float = 0.0
    empathy: float = 0.0
    factual_correctness: float = 0.0
    completeness: float = 0.0
    safety_compliance: float = 0.0


class ConversationMessage(BaseModel):
    """A single message in a conversation log."""

    role: Literal["system", "user", "assistant", "tool"]
    content: str
    turn_number: int
    tool_calls: list[dict] | None = None
    tool_call_id: str | None = None


class SessionResult(BaseModel):
    """Complete result of a single evaluation session."""

    scenario_title: str
    scenario_category: str
    model_id: str
    persona_name: str
    status: Literal["completed", "failed", "timeout"] = "completed"
    total_turns: int = 0
    messages: list[ConversationMessage] = []
    metrics: EvalMetrics | None = None
    overall_score: float = 0.0
    failure_analysis: list[str] = []
    galileo_trace_id: str | None = None
    galileo_console_url: str | None = None
    started_at: datetime = Field(default_factory=datetime.now)
    completed_at: datetime | None = None


class LeaderboardEntry(BaseModel):
    """Aggregated scores for a model across all evaluated scenarios."""

    model_id: str
    display_name: str
    overall_score: float
    total_evaluations: int
    metrics: EvalMetrics
    category_scores: dict[str, float]
