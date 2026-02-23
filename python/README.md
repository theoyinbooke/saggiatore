# Saggiatore Python/LangChain Edition

A Python CLI implementation of the [Saggiatore](../) immigration AI agent evaluation
framework, using **LangChain** for orchestration and **Galileo's Python SDK** for
evaluation scoring.

This implementation shares the same domain data (personas, tools, scenarios) and
scoring methodology as the TypeScript/Convex version, proving the evaluation pattern
is framework-agnostic.

## Architecture

```
CLI (Click + Rich)
        |
   LangChain AgentExecutor
        |
   +-----------+----------+-----------+
   |           |          |           |
  Agent      Tools     Persona    Galileo
 (model    (simulated  (simulated  (Python SDK
  under     via LLM)    client)    callback)
  test)
```

### Three-Actor Simulation

Each evaluation session runs a simulated conversation between:

1. **Persona** (gpt-4o-mini) — Roleplays as an immigration client with a specific
   background, goals, and challenges
2. **Agent** (model under test) — The AI being evaluated, with access to immigration tools
3. **Tool Simulator** (gpt-4o-mini) — Generates realistic API responses when the agent
   makes tool calls

### Shared Data

Both implementations read from the same `data/` directory at the repo root:

| File | Records | Description |
|------|---------|-------------|
| `data/personas.json` | 30 | Immigration clients with diverse backgrounds |
| `data/tools.json` | 30 | Simulated immigration API tools |
| `data/scenarios.json` | 25 | Evaluation scenarios across 5 categories |

## Setup

### 1. Prerequisites

- Python 3.11+
- At least an OpenAI API key (required for simulators)

### 2. Install

```bash
cd python
pip install -e .

# Or with dev dependencies:
pip install -e ".[dev]"
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required:
- `OPENAI_API_KEY` — For GPT-4o agent and gpt-4o-mini simulators

Optional:
- `OPENROUTER_API_KEY` — For Claude Sonnet 4.5 via OpenRouter
- `GROQ_API_KEY` — For Llama 3.3 via Groq
- `GALILEO_API_KEY` — For Galileo evaluation scoring

## Usage

### Run Evaluations

```bash
# All scenarios with all configured models
saggiatore run --models gpt-4o --models claude-sonnet-4-5 --scenarios all

# Specific scenarios with one model
saggiatore run -m gpt-4o -s 0 -s 5 -s 10

# Filter by category
saggiatore run -m gpt-4o --category humanitarian

# Without Galileo scoring
saggiatore run -m gpt-4o --scenarios all --no-galileo

# Show conversation transcripts during evaluation
saggiatore run -m gpt-4o -s 0 --show-conversation
```

### View Results

```bash
# Leaderboard from latest results
saggiatore leaderboard results/

# Detailed session view
saggiatore show results/20250101_120000_sessions.json --session 0
```

### List Available Resources

```bash
saggiatore list-personas
saggiatore list-scenarios
saggiatore list-scenarios --category visa_application
saggiatore list-models
```

## Evaluation Metrics

Five metrics with weighted scoring (identical to the JS implementation):

| Metric | Weight | Description |
|--------|--------|-------------|
| Tool Accuracy | 25% | Correct tool selection and usage |
| Factual Correctness | 25% | Accuracy of immigration information |
| Completeness | 20% | Thoroughness of responses |
| Empathy | 15% | Sensitivity to client's situation |
| Safety Compliance | 15% | No unauthorized legal advice |

### Scenario Categories

1. **Visa Application** — H-1B, O-1, E-2, EB-5, NIW filings
2. **Status Change** — OPT-to-H-1B, J-1 waiver, B-2 overstay
3. **Family Immigration** — K-1, I-130, DACA, TPS adjustment
4. **Deportation Defense** — Cancellation, bond, asylum defense
5. **Humanitarian** — Asylum, U visa, VAWA, SIJS, TPS

## Galileo Integration

When `GALILEO_API_KEY` is configured, the evaluation:

1. Logs conversation traces to Galileo via the Python SDK
2. Uses `GalileoCallback` for automatic LangChain tracing
3. Polls Galileo for scorer results (correctness, toxicity, tool quality, etc.)
4. Maps Galileo scores to the five evaluation metrics

Without Galileo, evaluations run but produce zero scores.

## Comparison with TypeScript Version

| Aspect | TypeScript | Python |
|--------|-----------|--------|
| Framework | Raw fetch + manual loop | LangChain AgentExecutor |
| Backend | Convex (cloud DB) | JSON files (local) |
| Frontend | React + Vite | CLI + Rich terminal |
| Tool handling | Manual parsing | LangChain automatic |
| Galileo | JS SDK, manual spans | Python SDK, GalileoCallback |
| Scoring | Same weights/metrics | Same weights/metrics |
| Data | Same JSON files | Same JSON files |

## Running Tests

```bash
cd python
pytest
```
