# Saggiatore Python/LangChain Implementation Plan

## Overview

This is a comprehensive plan to port the Saggiatore immigration legal AI evaluation
framework from its current TypeScript/Convex/React implementation to a Python CLI
application using LangChain for orchestration and Galileo's Python SDK for evaluation.

Both implementations share the **same domain data** (personas, tools, scenarios) and
produce **comparable evaluation results**, proving the evaluation pattern is
framework-agnostic.

---

## 1. Architecture Comparison

### Current JS Implementation

```
React Frontend (Vite)
        |
   Convex Backend
        |
   +-----------+----------+-----------+
   |           |          |           |
Orchestrator  Galileo   Model     Batch
  (loop)     Eval SDK  Registry  Runner
```

- **Convex** handles DB, auth, scheduling, real-time subscriptions
- **Orchestrator** (`orchestrator.ts`) runs the three-actor conversation loop
- **LLM Client** (`llmClient.ts`) wraps OpenAI-compatible APIs via raw `fetch`
- **Galileo JS SDK** (`galileo` npm) logs traces + polls for scorer results
- **React Frontend** displays leaderboards, conversations, personas

### New Python Implementation

```
CLI (Click/Rich)
        |
   LangChain Framework
        |
   +-----------+----------+-----------+
   |           |          |           |
Orchestrator  Galileo   Model     Results
 (AgentExec) Callback  Config    Reporter
```

- **LangChain** provides `AgentExecutor`, `Tool`, `ChatOpenAI`, callbacks
- **Galileo Python SDK** (`galileo` pip) with `GalileoCallback` for automatic tracing
- **Click** for CLI interface, **Rich** for terminal UI
- **JSON files** for storage (no database needed)
- **Same `data/` directory** shared with the JS implementation

---

## 2. Directory Structure

```
python/
├── pyproject.toml              # Package config, dependencies, entry points
├── requirements.txt            # Pinned dependencies for pip install
├── .env.example                # Required environment variables
├── README.md                   # Setup and usage instructions
│
├── saggiatore/                 # Main package
│   ├── __init__.py
│   ├── cli.py                  # Click CLI entry point
│   ├── config.py               # Settings, env vars, model registry
│   ├── models.py               # Pydantic data models (Persona, Tool, Scenario, etc.)
│   │
│   ├── data/                   # Data loading
│   │   ├── __init__.py
│   │   └── loader.py           # Load personas.json, tools.json, scenarios.json
│   │
│   ├── orchestrator/           # Core conversation engine
│   │   ├── __init__.py
│   │   ├── engine.py           # Main conversation loop (LangChain AgentExecutor)
│   │   ├── persona.py          # Persona simulator (LLM-as-user)
│   │   ├── tool_simulator.py   # Tool response simulator (LLM-as-API)
│   │   └── prompts.py          # System prompt builders
│   │
│   ├── evaluation/             # Galileo integration + scoring
│   │   ├── __init__.py
│   │   ├── galileo_eval.py     # Galileo Python SDK trace logging + polling
│   │   ├── metrics.py          # Metric definitions, weights, score computation
│   │   └── callback.py         # Custom Galileo callback handler for LangChain
│   │
│   ├── reporting/              # Results output
│   │   ├── __init__.py
│   │   ├── leaderboard.py      # Model comparison table
│   │   ├── conversation.py     # Conversation transcript formatter
│   │   └── export.py           # JSON/CSV export
│   │
│   └── utils/                  # Shared utilities
│       ├── __init__.py
│       └── llm_client.py       # Multi-provider LLM wrapper (OpenAI, OpenRouter, Groq)
│
├── results/                    # Output directory (gitignored)
│   └── .gitkeep
│
└── tests/                      # Test suite
    ├── __init__.py
    ├── test_models.py
    ├── test_loader.py
    ├── test_prompts.py
    ├── test_metrics.py
    └── test_orchestrator.py
```

---

## 3. Shared Data Files

The Python implementation reads the **same JSON files** from the repo root `data/` directory:

| File | Records | Description |
|------|---------|-------------|
| `data/personas.json` | 30 personas | Immigration clients with diverse backgrounds |
| `data/tools.json` | 32 tools | Immigration-domain API tool definitions |
| `data/scenarios.json` | 25 scenarios | Evaluation scenarios across 5 categories |

These files are NOT duplicated. The Python `loader.py` reads from `../../data/` relative
to the package, or from an absolute path specified via CLI flag.

---

## 4. Detailed Component Specifications

### 4.1 Data Models (`models.py`)

Pydantic models mirroring the JSON data structure and the Convex schema:

```python
class Persona(BaseModel):
    name: str
    age: int
    nationality: str
    country_flag: str
    current_status: str
    visa_type: str
    complexity_level: Literal["low", "medium", "high"]
    backstory: str
    goals: list[str]
    challenges: list[str]
    family_info: str | None = None
    employment_info: str | None = None
    education_info: str | None = None
    tags: list[str]

class ToolParameter(BaseModel):
    name: str
    type: str
    description: str
    required: bool

class ToolDefinition(BaseModel):
    name: str
    description: str
    category: str
    parameters: list[ToolParameter]
    return_type: str
    return_description: str

class Scenario(BaseModel):
    title: str
    category: Literal["visa_application", "status_change",
                       "family_immigration", "deportation_defense",
                       "humanitarian"]
    complexity: Literal["low", "medium", "high"]
    description: str
    persona_index: int
    expected_tools: list[str]
    success_criteria: list[str]
    max_turns: int

class ModelConfig(BaseModel):
    model_id: str
    display_name: str
    provider: Literal["openai", "openrouter", "groq"]
    api_model: str
    env_key: str
    supports_tools: bool

class EvalMetrics(BaseModel):
    tool_accuracy: float
    empathy: float
    factual_correctness: float
    completeness: float
    safety_compliance: float

class SessionResult(BaseModel):
    scenario_title: str
    model_id: str
    persona_name: str
    status: Literal["completed", "failed", "timeout"]
    total_turns: int
    messages: list[dict]
    metrics: EvalMetrics | None
    overall_score: float
    galileo_trace_id: str | None
    galileo_console_url: str | None
    started_at: datetime
    completed_at: datetime

class LeaderboardEntry(BaseModel):
    model_id: str
    overall_score: float
    total_evaluations: int
    metrics: EvalMetrics
    category_scores: dict[str, float]
```

### 4.2 Configuration (`config.py`)

Environment variables and model registry, mirroring the JS `.env.example` and
`modelRegistry.ts`:

```python
class Settings(BaseSettings):
    # LLM Provider API Keys
    openai_api_key: str
    openrouter_api_key: str = ""
    groq_api_key: str = ""

    # Galileo
    galileo_api_key: str = ""
    galileo_project: str = "saggiatore-python"
    galileo_log_stream: str = "immigration-eval"

    # Simulator model (cheap, fast model for persona + tool simulation)
    simulator_model: str = "gpt-4o-mini"

    # Data directory
    data_dir: str = ""  # Auto-detected from repo root

    # Results directory
    results_dir: str = "results"

    class Config:
        env_file = ".env"

# Default model registry (mirrors modelRegistry.ts seedDefaults)
DEFAULT_MODELS = [
    ModelConfig(
        model_id="gpt-4o",
        display_name="GPT-4o",
        provider="openai",
        api_model="gpt-4o",
        env_key="OPENAI_API_KEY",
        supports_tools=True,
    ),
    ModelConfig(
        model_id="claude-sonnet-4-5",
        display_name="Claude Sonnet 4.5",
        provider="openrouter",
        api_model="anthropic/claude-sonnet-4.5",
        env_key="OPENROUTER_API_KEY",
        supports_tools=True,
    ),
    ModelConfig(
        model_id="llama-3.3-70b-versatile",
        display_name="Llama 3.3 70B",
        provider="groq",
        api_model="llama-3.3-70b-versatile",
        env_key="GROQ_API_KEY",
        supports_tools=True,
    ),
]
```

### 4.3 Data Loader (`data/loader.py`)

Loads and validates the shared JSON data files using Pydantic:

```python
def load_personas(data_dir: Path) -> list[Persona]:
    """Load personas from data/personas.json"""

def load_tools(data_dir: Path) -> list[ToolDefinition]:
    """Load tool definitions from data/tools.json"""

def load_scenarios(data_dir: Path) -> list[Scenario]:
    """Load scenarios from data/scenarios.json"""

def load_all(data_dir: Path) -> tuple[list[Persona], list[ToolDefinition], list[Scenario]]:
    """Load all data files, validate references between them"""
```

Key behavior:
- Validates that `scenario.persona_index` points to a valid persona
- Validates that `scenario.expected_tools` reference existing tool names
- Uses Pydantic's `model_validate` for strict type checking
- Handles `camelCase` JSON keys via Pydantic `alias` configuration

### 4.4 LLM Client (`utils/llm_client.py`)

Multi-provider wrapper mirroring `llmClient.ts`. Uses LangChain's `ChatOpenAI` for
OpenAI-compatible APIs:

```python
from langchain_openai import ChatOpenAI
from langchain_community.chat_models import ChatOpenAI as OpenRouterChat

def get_agent_llm(config: ModelConfig) -> BaseChatModel:
    """Get a LangChain chat model for the agent under test.

    Routes to the correct provider based on config:
    - openai: ChatOpenAI with OpenAI endpoint
    - openrouter: ChatOpenAI with OpenRouter base_url
    - groq: ChatOpenAI with Groq base_url
    """

def get_simulator_llm() -> BaseChatModel:
    """Get a cheap/fast LLM for persona and tool simulation (gpt-4o-mini)."""
```

Provider routing mirrors `llmClient.ts` PROVIDER_CONFIG:

| Provider | Endpoint | Header |
|----------|----------|--------|
| openai | `https://api.openai.com/v1` | `Authorization: Bearer $OPENAI_API_KEY` |
| openrouter | `https://openrouter.ai/api/v1` | `Authorization: Bearer $OPENROUTER_API_KEY`, `X-Title: Saggiatore` |
| groq | `https://api.groq.com/openai/v1` | `Authorization: Bearer $GROQ_API_KEY` |

All three use OpenAI-compatible chat completion APIs, so LangChain's `ChatOpenAI` with
a custom `base_url` handles all three.

### 4.5 Prompt Builders (`orchestrator/prompts.py`)

Direct port of the prompt-building functions from `orchestrator.ts`:

```python
def build_agent_system_prompt(tools: list[ToolDefinition]) -> str:
    """Build the system prompt for the immigration agent.

    Mirrors buildAgentSystemPrompt() in orchestrator.ts exactly:
    - Expert immigration legal assistant role
    - 8 behavioral guidelines
    - Available tools list
    """

def build_persona_system_prompt(persona: Persona, scenario: Scenario) -> str:
    """Build the system prompt for the persona simulator.

    Mirrors buildPersonaSystemPrompt() in orchestrator.ts exactly:
    - Roleplay instructions with persona background
    - Goals and challenges from persona
    - Scenario context
    - Behavioral instructions (stay in character, ask follow-ups, etc.)
    """
```

These prompts are ported **exactly** from the JS implementation to ensure identical
behavior. The agent system prompt includes all 8 guidelines and the tool list. The
persona prompt includes the full character sheet and scenario context.

### 4.6 Tool Simulator (`orchestrator/tool_simulator.py`)

LangChain `Tool` definitions that simulate API responses, mirroring `callToolSimulator()`
in `orchestrator.ts`:

```python
def create_simulated_tools(
    tool_definitions: list[ToolDefinition],
    simulator_llm: BaseChatModel,
) -> list[StructuredTool]:
    """Convert tool definitions to LangChain StructuredTool instances.

    Each tool, when called, invokes the simulator LLM to generate a
    realistic JSON response — identical to the JS callToolSimulator().

    The tool's function:
    1. Receives the arguments as a dict
    2. Builds a system prompt with tool metadata + return schema
    3. Calls gpt-4o-mini to generate realistic JSON
    4. Returns the simulated response string
    """
```

For each tool in `data/tools.json`, this creates a LangChain `StructuredTool` with:
- `name`: from tool definition
- `description`: from tool definition
- `args_schema`: dynamically built Pydantic model from tool parameters
- `func`: async function that calls the simulator LLM

The simulator system prompt mirrors the JS version:
```
You are a simulated immigration tool API. You return realistic, plausible
JSON responses for immigration-related tool calls.

Tool: {tool_name}
Description: {tool_description}
Expected return: {return_type} - {return_description}

Return a realistic JSON response based on the arguments provided.
Make the data plausible and detailed for an immigration context.
Return ONLY valid JSON, no explanation.
```

### 4.7 Persona Simulator (`orchestrator/persona.py`)

Simulates the user side of the conversation, mirroring `callPersonaSimulator()` in
`orchestrator.ts`:

```python
class PersonaSimulator:
    """Simulates a persona (immigration client) in conversation.

    Uses gpt-4o-mini to roleplay as the persona, generating realistic
    user messages based on the conversation history.

    Key behavior from JS implementation:
    - Flips message perspectives: user -> assistant, assistant -> user
    - System prompt contains full persona character sheet
    - Generates concise responses (2-4 sentences)
    """

    def __init__(self, persona: Persona, scenario: Scenario, llm: BaseChatModel):
        self.system_prompt = build_persona_system_prompt(persona, scenario)
        self.llm = llm

    async def generate_initial_message(self) -> str:
        """Generate the persona's opening message (introduces themselves)."""

    async def generate_response(self, conversation_history: list[BaseMessage]) -> str:
        """Generate persona's response given conversation so far.

        Mirrors the perspective-flipping from orchestrator.ts:
        - Messages the persona sent appear as 'assistant' (their own words)
        - Messages from the agent appear as 'user' (what they're responding to)
        """
```

### 4.8 Conversation Engine (`orchestrator/engine.py`)

The core orchestration loop, replacing `runConversation()` in `orchestrator.ts`.
This is where **LangChain's AgentExecutor** replaces the hand-rolled loop:

```python
class ConversationEngine:
    """Runs a simulated multi-turn conversation between:
    1. A persona (LLM simulating a user)
    2. An agent (the model under test)
    3. Simulated tools (LLM generating fake API responses)

    Uses LangChain AgentExecutor for the agent's turn, which handles:
    - Tool selection and calling
    - Multi-step reasoning
    - Error recovery
    - Response generation

    The outer loop (persona turn -> agent turn -> persona turn) is
    managed by this engine, not by LangChain.
    """

    async def run_session(
        self,
        scenario: Scenario,
        persona: Persona,
        model_config: ModelConfig,
        tools: list[ToolDefinition],
        callbacks: list | None = None,  # Galileo callbacks
    ) -> SessionResult:
        """Run a complete evaluation session.

        Flow (mirrors orchestrator.ts runConversation):
        1. Build agent system prompt with tool list
        2. Build persona system prompt with character sheet
        3. Create LangChain tools from tool definitions
        4. Create AgentExecutor with the model under test
        5. Generate initial persona message
        6. Loop:
           a. Agent responds (via AgentExecutor — handles tool calls internally)
           b. Persona responds (via persona simulator)
           c. Repeat until maxTurns
        7. Return SessionResult with full conversation log
        """
```

The key difference from the JS version: **LangChain's AgentExecutor handles the
tool-call sub-loop internally**. In the JS version, `orchestrator.ts` manually
checks for `tool_calls`, calls the simulator, feeds results back, and continues.
LangChain does all of this automatically.

The outer loop structure remains the same:
```
Turn 1: Persona introduces themselves
Turn 2: Agent responds (may call tools internally)
Turn 3: Persona asks follow-up
Turn 4: Agent responds again
... up to maxTurns
```

### 4.9 Galileo Evaluation (`evaluation/galileo_eval.py`)

Direct port of `galileoEval.ts` and `customGalileoEval.ts`, using Galileo's Python SDK:

```python
from galileo import GalileoLogger
from galileo.handlers.langchain import GalileoCallback
from galileo import galileo_context

class GalileoEvaluator:
    """Evaluates completed sessions using Galileo's Python SDK.

    Two integration approaches:

    1. Automatic (via LangChain callback):
       - GalileoCallback is passed to AgentExecutor
       - Automatically captures LLM spans, tool spans, and traces
       - No manual span logging needed

    2. Manual (for post-hoc evaluation):
       - Uses GalileoLogger to manually log conversation spans
       - Mirrors the JS approach in galileoEval.ts
       - Used when reviewing existing conversations
    """

    GALILEO_PROJECT = "saggiatore-python"
    GALILEO_LOG_STREAM = "immigration-eval"

    # Metric weights (mirrors galileoEval.ts computeOverallScore)
    METRIC_WEIGHTS = {
        "tool_accuracy": 0.25,
        "empathy": 0.15,
        "factual_correctness": 0.25,
        "completeness": 0.20,
        "safety_compliance": 0.15,
    }

    # Galileo scorer mapping (mirrors mapGalileoScoresToEvalMetrics)
    GALILEO_METRIC_MAP = {
        "tool_accuracy": {
            "galileo_keys": ["toolSelectionQuality", "tool_selection_quality"],
            "error_keys": ["toolErrorRate", "tool_error_rate"],
            "combine": "avg_with_inverted_error",
        },
        "factual_correctness": {
            "galileo_keys": ["correctness", "factuality"],
        },
        "empathy": {
            "galileo_keys": ["empathy", "conversationQuality"],
        },
        "completeness": {
            "galileo_keys": ["completeness", "completenessGpt"],
        },
        "safety_compliance": {
            "galileo_keys": ["toxicityGpt", "output_toxicity"],
            "invert": True,
            "combine_with": ["outputPiiGpt", "promptInjectionGpt"],
        },
    }

    def get_callback(self) -> GalileoCallback:
        """Get a LangChain callback that auto-logs to Galileo."""

    async def evaluate_session(self, result: SessionResult) -> EvalMetrics:
        """Evaluate a completed session by logging traces and polling for scores.

        Steps (mirrors evaluateWithGalileo in galileoEval.ts):
        1. Initialize Galileo project + log stream
        2. Start a session and trace
        3. Log LLM spans for each assistant message
        4. Log tool spans for each tool call
        5. Conclude trace with final output
        6. Flush to Galileo
        7. Poll for scorer results (up to 12 attempts, 15s apart)
        8. Map Galileo scores to EvalMetrics
        9. Compute weighted overall score
        """

    async def poll_for_scores(self, trace_name: str) -> dict[str, float] | None:
        """Poll Galileo API for scorer results.

        Mirrors the polling loop in galileoEval.ts:
        - MAX_ATTEMPTS = 12
        - POLL_INTERVAL = 15 seconds
        - Accept partial results after 4+ attempts
        - Expected keys: toolSelectionQuality, toolErrorRate, toxicityGpt,
          promptInjectionGpt, factuality, completenessGpt, empathy
        """

    def map_scores(self, raw_scores: dict[str, float]) -> EvalMetrics:
        """Map Galileo raw scores to EvalMetrics.

        Direct port of mapGalileoScoresToEvalMetrics from galileoEval.ts:
        - toolAccuracy = avg(selectionQuality, 1 - errorRate)
        - factualCorrectness = correctness or factuality
        - empathy = empathy or conversationQuality or factualCorrectness
        - completeness = completeness or completenessGpt
        - safetyCompliance = 1 - avg(toxicity, pii, injection)
        """

    def compute_overall_score(self, metrics: EvalMetrics) -> float:
        """Weighted average using METRIC_WEIGHTS.

        Mirrors computeOverallScore in galileoEval.ts:
        - toolAccuracy * 0.25
        - factualCorrectness * 0.25
        - completeness * 0.20
        - empathy * 0.15
        - safetyCompliance * 0.15
        """
```

### 4.10 Leaderboard & Reporting (`reporting/`)

Terminal-based results display using Rich:

```python
# leaderboard.py
class Leaderboard:
    """Aggregates session results into a model comparison table.

    Mirrors leaderboard.ts logic:
    - Per-model average scores across all scenarios
    - Per-category breakdown (5 categories)
    - Per-metric breakdown (5 metrics)
    - Ranked by overall score descending
    """

    def add_result(self, result: SessionResult): ...
    def get_rankings(self) -> list[LeaderboardEntry]: ...
    def display(self): ...  # Rich table output
    def export_json(self, path: Path): ...
    def export_csv(self, path: Path): ...

# conversation.py
class ConversationFormatter:
    """Formats conversation transcripts for terminal display.

    Shows:
    - Persona messages (colored)
    - Agent messages (colored)
    - Tool calls with arguments and responses
    - Turn numbers
    """

# export.py
def export_results(results: list[SessionResult], output_dir: Path):
    """Export all results to JSON and CSV files."""
```

### 4.11 CLI Interface (`cli.py`)

Click-based CLI mirroring the JS app's functionality:

```python
@click.group()
def cli():
    """Saggiatore - Immigration AI Agent Evaluation Framework (Python/LangChain)"""

@cli.command()
@click.option("--models", "-m", multiple=True, help="Model IDs to evaluate")
@click.option("--scenarios", "-s", multiple=True, help="Scenario indices or 'all'")
@click.option("--category", "-c", type=click.Choice([...]), help="Filter by category")
@click.option("--galileo/--no-galileo", default=True, help="Enable Galileo evaluation")
@click.option("--output", "-o", default="results", help="Output directory")
def run(models, scenarios, category, galileo, output):
    """Run evaluation sessions.

    Examples:
      saggiatore run --models gpt-4o --models claude-sonnet-4-5 --scenarios all
      saggiatore run -m gpt-4o -s 0 -s 1 -s 2
      saggiatore run -m gpt-4o --category humanitarian
    """

@cli.command()
@click.argument("results_dir", default="results")
def leaderboard(results_dir):
    """Display the evaluation leaderboard from saved results."""

@cli.command()
def list_personas():
    """List all available personas."""

@cli.command()
def list_scenarios():
    """List all available scenarios."""

@cli.command()
def list_models():
    """List configured models and their status."""

@cli.command()
@click.argument("results_file")
def show(results_file):
    """Show detailed results for a specific session."""
```

---

## 5. LangChain Integration Details

### 5.1 Agent Creation

For each model under test, we create a LangChain agent:

```python
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# Build the prompt template
prompt = ChatPromptTemplate.from_messages([
    ("system", agent_system_prompt),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# Create the agent
agent = create_openai_tools_agent(
    llm=get_agent_llm(model_config),
    tools=simulated_tools,
    prompt=prompt,
)

# Create the executor
executor = AgentExecutor(
    agent=agent,
    tools=simulated_tools,
    verbose=True,
    max_iterations=5,
    handle_parsing_errors=True,
    callbacks=[galileo_callback] if galileo_enabled else [],
)
```

### 5.2 Conversation Loop

The outer loop manages persona <-> agent turns:

```python
chat_history = []
messages_log = []

# Initial persona message
persona_msg = await persona_simulator.generate_initial_message()
chat_history.append(HumanMessage(content=persona_msg))
messages_log.append({"role": "user", "content": persona_msg, "turn": 1})

turn = 2
while turn <= max_turns:
    # Agent responds (LangChain handles tool calls internally)
    result = await executor.ainvoke({
        "input": persona_msg,
        "chat_history": chat_history[:-1],  # Exclude current input
    })
    agent_response = result["output"]

    chat_history.append(AIMessage(content=agent_response))
    messages_log.append({"role": "assistant", "content": agent_response, "turn": turn})
    turn += 1

    if turn > max_turns:
        break

    # Persona responds
    persona_msg = await persona_simulator.generate_response(chat_history)
    chat_history.append(HumanMessage(content=persona_msg))
    messages_log.append({"role": "user", "content": persona_msg, "turn": turn})
    turn += 1
```

### 5.3 Tool Call Capture

LangChain's AgentExecutor captures tool calls in its intermediate steps. We extract
these for logging to Galileo:

```python
# After executor.ainvoke(), intermediate_steps contains tool calls
result = await executor.ainvoke(...)
for step in result.get("intermediate_steps", []):
    action, observation = step
    messages_log.append({
        "role": "assistant",
        "content": "",
        "turn": turn,
        "tool_calls": [{
            "name": action.tool,
            "arguments": json.dumps(action.tool_input),
        }],
    })
    messages_log.append({
        "role": "tool",
        "content": observation,
        "turn": turn,
        "tool_call_id": action.tool,
    })
```

### 5.4 Galileo Callback Integration

The GalileoCallback from Galileo's Python SDK auto-captures:
- LLM invocations (input, output, model, tokens)
- Tool calls (name, input, output, duration)
- Trace start/end

This replaces the manual `logger.addLlmSpan()` and `logger.addToolSpan()` calls
in the JS implementation.

```python
from galileo import galileo_context
from galileo.handlers.langchain import GalileoCallback

with galileo_context(project=GALILEO_PROJECT, log_stream=GALILEO_LOG_STREAM):
    callback = GalileoCallback()
    result = await executor.ainvoke(
        {"input": persona_msg, "chat_history": history},
        config={"callbacks": [callback]},
    )
```

---

## 6. Evaluation Scoring (Exact Port)

### 6.1 Five Metrics (Same as JS)

| Metric | Weight | Galileo Scorers Used |
|--------|--------|---------------------|
| Tool Accuracy | 0.25 | toolSelectionQuality, toolErrorRate (inverted) |
| Factual Correctness | 0.25 | correctness / factuality |
| Completeness | 0.20 | completeness / completenessGpt |
| Empathy | 0.15 | empathy / conversationQuality |
| Safety Compliance | 0.15 | toxicityGpt (inverted), outputPiiGpt (inverted), promptInjectionGpt (inverted) |

### 6.2 Score Computation (Same as JS)

```python
overall_score = (
    metrics.tool_accuracy * 0.25 +
    metrics.factual_correctness * 0.25 +
    metrics.completeness * 0.20 +
    metrics.empathy * 0.15 +
    metrics.safety_compliance * 0.15
)
```

### 6.3 Five Categories (Same as JS)

1. `visa_application` - Visa applications (H-1B, O-1, E-2, EB-5, NIW)
2. `status_change` - Status changes (OPT->H-1B, J-1 waiver, B-2 overstay)
3. `family_immigration` - Family-based (K-1, I-130, DACA, TPS adjustment)
4. `deportation_defense` - Deportation defense (cancellation, bond, asylum)
5. `humanitarian` - Humanitarian (asylum, U visa, VAWA, SIJS, TPS)

### 6.4 Failure Analysis (Same as JS)

Any metric below 0.5 generates a failure analysis message:
- "Low tool accuracy - agent may have called wrong tools or missed required tools."
- "Low empathy - responses may lack sensitivity to the client's situation."
- etc.

---

## 7. Dependencies

### Core
```
langchain>=0.3.0
langchain-openai>=0.3.0
langchain-community>=0.3.0
galileo>=1.0.0
pydantic>=2.0
pydantic-settings>=2.0
```

### CLI & Display
```
click>=8.0
rich>=13.0
```

### Utilities
```
python-dotenv>=1.0
httpx>=0.27
```

### Dev/Test
```
pytest>=8.0
pytest-asyncio>=0.23
```

---

## 8. Environment Variables

```bash
# Required: At least one LLM provider key
OPENAI_API_KEY=sk-...              # For GPT-4o agent + GPT-4o-mini simulators

# Optional: Additional providers
OPENROUTER_API_KEY=sk-or-...       # For Claude Sonnet 4.5 via OpenRouter
GROQ_API_KEY=gsk_...               # For Llama 3.3 via Groq

# Optional: Galileo evaluation
GALILEO_API_KEY=...                # For Galileo scoring
GALILEO_PROJECT=saggiatore-python  # Galileo project name
GALILEO_LOG_STREAM=immigration-eval # Galileo log stream name
```

---

## 9. Usage Examples

### Run all scenarios with all configured models
```bash
cd python
saggiatore run --models gpt-4o --models claude-sonnet-4-5 --scenarios all
```

### Run specific scenarios with one model
```bash
saggiatore run -m gpt-4o -s 0 -s 5 -s 10
```

### Run only humanitarian scenarios
```bash
saggiatore run -m gpt-4o --category humanitarian
```

### Run without Galileo (local scoring only)
```bash
saggiatore run -m gpt-4o --scenarios all --no-galileo
```

### View leaderboard from saved results
```bash
saggiatore leaderboard results/
```

### List available personas and scenarios
```bash
saggiatore list-personas
saggiatore list-scenarios
```

---

## 10. Implementation Order

### Phase 1: Foundation (Files 1-5)
1. `pyproject.toml` + `requirements.txt` - Package setup
2. `saggiatore/models.py` - Pydantic data models
3. `saggiatore/config.py` - Settings and model registry
4. `saggiatore/data/loader.py` - JSON data loading
5. `saggiatore/utils/llm_client.py` - Multi-provider LLM wrapper

### Phase 2: Orchestration (Files 6-9)
6. `saggiatore/orchestrator/prompts.py` - System prompt builders
7. `saggiatore/orchestrator/tool_simulator.py` - LangChain tool wrappers
8. `saggiatore/orchestrator/persona.py` - Persona simulator
9. `saggiatore/orchestrator/engine.py` - Conversation engine with AgentExecutor

### Phase 3: Evaluation (Files 10-11)
10. `saggiatore/evaluation/metrics.py` - Metric definitions and scoring
11. `saggiatore/evaluation/galileo_eval.py` - Galileo SDK integration

### Phase 4: Output (Files 12-14)
12. `saggiatore/reporting/leaderboard.py` - Leaderboard computation and display
13. `saggiatore/reporting/conversation.py` - Conversation transcript formatting
14. `saggiatore/reporting/export.py` - JSON/CSV export

### Phase 5: CLI (File 15)
15. `saggiatore/cli.py` - Click CLI with all commands

### Phase 6: Documentation & Tests
16. `.env.example` - Environment variable template
17. `README.md` - Setup and usage guide
18. `tests/` - Test suite

---

## 11. Key Differences from JS Implementation

| Aspect | JS (Current) | Python (New) |
|--------|-------------|-------------|
| **Framework** | Raw fetch + manual loop | LangChain AgentExecutor |
| **Database** | Convex (real-time, cloud) | JSON files (local) |
| **Frontend** | React + Vite | CLI + Rich terminal UI |
| **Auth** | Clerk | None (local tool) |
| **Scheduling** | Convex scheduler | asyncio.gather for parallelism |
| **Tool handling** | Manual tool_calls parsing | LangChain automatic |
| **Galileo** | Manual span logging | GalileoCallback auto-capture |
| **Scoring** | Identical weights and metrics | Identical weights and metrics |
| **Data** | Same JSON files | Same JSON files |
| **Prompts** | Same prompts | Same prompts |

---

## 12. Success Criteria

The Python implementation is considered complete when:

1. Same 30 personas, 32 tools, 25 scenarios loaded from shared `data/` files
2. Same agent system prompt and persona prompts as JS version
3. Same 3 LLM providers supported (OpenAI, OpenRouter, Groq)
4. LangChain AgentExecutor handles agent reasoning + tool calling
5. Galileo Python SDK logs traces and retrieves scorer results
6. Same 5 metrics with same weights produce comparable scores
7. Same 5 categories with per-category breakdown
8. CLI provides run, leaderboard, list-personas, list-scenarios, show commands
9. Results exportable as JSON and CSV
10. Leaderboard displays model rankings in terminal
