## Building a Reliable Immigration Consultation AI Agent with Galileo SDK

In this guide, we'll show you how to implement a Python Galileo SDK workflow in your own application, using Saggiatore as a working reference.

The goal is implementation clarity: you'll wire orchestration, tracing, scoring, sync, and UI visibility into one repeatable pipeline.

By the end, you'll have a runner that:

- orchestrates multi-turn immigration simulations with LangChain,
- evaluates sessions with Galileo traces and scorers,
- syncs run/session/leaderboard data into Convex,
- and surfaces results in the Saggiatore demo app.


## What You'll Build

Runtime flow:

```text
saggiatore run (CLI)
  -> ConversationEngine (LangChain create_agent)
  -> Persona + tool simulation
  -> SessionResult objects
  -> Galileo trace + scorer polling
  -> Convex ingest (POST /python-sdk/ingest)
  -> Leaderboard visualization in the app
```

Core modules:

- `python/saggiatore/cli.py`
- `python/saggiatore/orchestrator/engine.py`
- `python/saggiatore/evaluation/galileo_eval.py`
- `python/saggiatore/reporting/convex_sync.py`
- `convex/http.ts`
- `convex/pythonSdkIngest.ts`
- `src/pages/LeaderboardPage.tsx`


## Step 1: Bootstrap the Python Package

Install the package locally:

```bash
cd python
pip install -e .
```

For active development:

```bash
pip install -e ".[dev]"
```

Key dependencies in `python/pyproject.toml`:

- `langchain` + `langchain-openai` for orchestration,
- `galileo` for tracing and scoring,
- `click` + `rich` for CLI UX,
- `httpx` for Convex ingestion,
- `pydantic` for contracts.


## Step 2: Configure Environment Variables

Initialize env file:

```bash
cd python
cp .env.example .env
```

Minimum requirement:

- `OPENAI_API_KEY` (used by persona/tool simulators)

Recommended for full pipeline:

- `GALILEO_API_KEY`
- `CONVEX_PYTHON_INGEST_URL` (must end with `/python-sdk/ingest`)
- `CONVEX_PYTHON_INGEST_TOKEN`

Settings are loaded via `python/saggiatore/config.py`:

```python
class Settings(BaseSettings):
    openai_api_key: str = ""
    galileo_api_key: str = ""
    galileo_project: str = "saggiatore-python"
    galileo_log_stream: str = "immigration-eval"
    convex_python_ingest_url: str = ""
    convex_python_ingest_token: str = ""
```


## Step 3: Reuse Shared Domain Data

The Python runner reads the same dataset used by the web app:

- `data/personas.json`
- `data/tools.json`
- `data/scenarios.json`

`python/saggiatore/data/loader.py` validates cross-references:

- `scenario.personaIndex` must point to a valid persona,
- each `expectedTools` entry must exist in `tools.json`.

This keeps cross-surface comparisons valid.


## Step 4: Build the LangChain Orchestration Loop

`ConversationEngine` in `python/saggiatore/orchestrator/engine.py` is the runtime core.

### 4.1 Actors

Each session coordinates three actors:

- persona simulator,
- model under test,
- tool simulator.

### 4.2 Create the agent graph

The model under test runs through `create_agent(...)`:

```python
agent_graph = create_agent(
    model=agent_llm,
    tools=agent_tools,
    system_prompt=agent_system_prompt,
)
```

The outer loop manages persona<->agent turns, while LangChain manages internal tool-call subloops:

```python
result_state = await agent_graph.ainvoke(
    {"messages": agent_messages},
    config={"recursion_limit": 25, "callbacks": self.callbacks},
)
```

### 4.3 Normalize transcript output

Every turn is serialized into `SessionResult` messages (`system`, `user`, `assistant`, `tool`) with normalized tool-call IDs. This is the contract used by evaluation, export, and replay.


## Step 5: Simulate Tools with StructuredTool

`python/saggiatore/orchestrator/tool_simulator.py` converts tool definitions into LangChain `StructuredTool` instances.

Each tool call is fulfilled by a fast simulator model (`gpt-4o-mini`) returning realistic JSON.

Pattern:

```python
tool = StructuredTool(
    name=tool_def.name,
    description=tool_def.description,
    func=_make_tool_fn(),
    args_schema=args_schema,
)
```

Why this matters:

- you get real tool-calling behavior,
- you avoid coupling evaluation to production APIs.


## Step 6: Add Galileo Tracing and Scoring

Galileo integration has two layers.

### 6.1 LangChain callback tracing

`python/saggiatore/evaluation/callback.py` provides `GalileoCallback` when `GALILEO_API_KEY` is configured.

### 6.2 Session-level evaluation flow

`python/saggiatore/evaluation/galileo_eval.py`:

1. starts Galileo session and trace,
2. logs LLM spans and tool spans,
3. flushes trace,
4. polls for scorer outputs,
5. maps raw metrics into benchmark metrics.

Polling defaults:

- max attempts: 12
- interval: 15 seconds

Weighted scoring rubric:

- Tool Accuracy: 25%
- Factual Correctness: 25%
- Completeness: 20%
- Empathy: 15%
- Safety Compliance: 15%

Metric mapping logic is in `python/saggiatore/evaluation/metrics.py`.


## Step 7: Sync Python Runs into Convex

`python/saggiatore/reporting/convex_sync.py` bridges script execution to app UI.

It posts ingestion payloads with bearer auth:

```python
resp = await self._client.post(
    self.url,
    headers={
        "Authorization": f"Bearer {self.token}",
        "Content-Type": "application/json",
    },
    json=payload,
)
```

Synced payloads include:

- run lifecycle (`running` -> `completed`/`failed`),
- session transcript + status,
- metrics + failure analysis,
- Galileo trace ID and console URL,
- leaderboard rows.

Backend endpoints/storage:

- `POST /python-sdk/ingest` in `convex/http.ts`
- upserts handled in `convex/pythonSdkIngest.ts`
- tables: `pythonRuns`, `pythonSessions`, `pythonMessages`, `pythonEvaluations`, `pythonLeaderboard`


## Step 8: Visualize Results in the App

`src/pages/LeaderboardPage.tsx` can query and render Python-run data from Convex, so each CLI run is visible without manual JSON inspection.

This turns script-based evaluation into a shareable UI artifact.


## Step 9: Run the End-to-End Pipeline

### 9.1 Quick smoke test (no Galileo)

```bash
cd python
saggiatore run -m gpt-4o -s 0 --no-galileo
```

### 9.2 Galileo-enabled run

```bash
saggiatore run -m gpt-4o -s 0
```

### 9.3 Local artifacts

- `python/results/<run_id>_sessions.json`
- `python/results/<run_id>_leaderboard.json`
- `python/results/<run_id>_summary.json`
- CSV output when scoring is available

### 9.4 Convex server token requirement

Set once on the Convex side:

```bash
npx convex env set PYTHON_INGEST_TOKEN "<same value as CONVEX_PYTHON_INGEST_TOKEN>"
```

If this key is missing, ingestion returns `503`.


## Step 10: Extension Patterns

### Add a new scenario category

1. Extend `data/scenarios.json`.
2. Update constants in `python/saggiatore/evaluation/metrics.py` and Convex ingestion normalization.
3. Update category labels in UI views.

### Add a new model provider

1. Add provider config in `python/saggiatore/utils/llm_client.py`.
2. Add model metadata in `python/saggiatore/config.py`.
3. Validate env key handling in CLI model resolution.

### Add richer scoring dimensions

1. Extend Galileo key mapping in `python/saggiatore/evaluation/metrics.py`.
2. Extend `EvalMetrics` schema.
3. Update Convex schema and leaderboard renderers.


## Production Checklist

- Keep simulator and evaluated model separate.
- Preserve run IDs and Galileo trace IDs for reproducibility.
- Treat Convex sync as best-effort; local JSON exports remain durable output.
- Keep metric definitions stable when comparing across releases.


## TL;DR

This Python pattern gives you a practical Galileo-powered evaluation pipeline:

- LangChain for orchestration,
- Galileo for trace-based scoring,
- Convex for sync and app-level visibility,
- local artifacts for reproducible offline analysis.

Start with this reference flow, then adapt the same structure to your own domain.
