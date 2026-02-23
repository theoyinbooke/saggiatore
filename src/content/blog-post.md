## Integrating Galileo SDK in a Real-Time Web Evaluation App

In this guide, we'll show you how to integrate Galileo SDK into a real-time web application, using Saggiatore as the working example.

This is a build guide, not a product tour. We'll focus on implementation details you can reuse directly: orchestration, scoring, persistence, and observability.

By the end, you'll have a web evaluation flow that:

- starts sessions from a live UI,
- runs multi-turn orchestration in Convex actions,
- evaluates sessions with Galileo traces and scorers,
- updates leaderboard and replay views in real time,
- supports deterministic simulation runs for demos and CI.


## What You'll Build

Execution path:

```text
ScenarioRunnerPage (React)
  -> orchestrator.startSession (Convex action)
  -> scheduler.runAfter -> orchestrator.runConversation (internal action)
  -> messages + session status persisted in Convex
  -> galileoEval.evaluateSession (Convex action)
  -> evaluations + leaderboard updates
  -> live UI updates via Convex subscriptions
```

Core modules:

- `src/pages/ScenarioRunnerPage.tsx`
- `convex/orchestrator.ts`
- `convex/galileoEval.ts`
- `convex/leaderboard.ts`
- `src/pages/LeaderboardPage.tsx`
- `src/pages/ResultsDetailPage.tsx`


## Step 1: Boot the Project

Install dependencies and configure Convex:

```bash
pnpm install
npx convex dev --configure=new
```

Create local frontend env:

```bash
cp .env.example .env.local
```

Set server-side keys in Convex:

```bash
npx convex env set OPENAI_API_KEY <key>
npx convex env set OPENROUTER_API_KEY <key>
npx convex env set GROQ_API_KEY <key>
npx convex env set GALILEO_API_KEY <key>
```

Start the app:

```bash
pnpm dev
```


## Step 2: Seed Domain Data

The web flow expects personas, tools, and scenarios in Convex tables. Seed from shared JSON:

```bash
npx convex run seed:seedAll
```

Source-of-truth data files:

- `data/personas.json`
- `data/tools.json`
- `data/scenarios.json`

`convex/seed.ts`:

- inserts personas,
- inserts tool definitions,
- resolves `scenario.personaIndex` to `personaId`,
- seeds default model registry entries.

Using the same data files across web and Python keeps evaluation parity.


## Step 3: Configure Models for the Runner

Models are managed through `modelRegistry` and surfaced in Settings + Runner.

Runtime lookup pattern in `convex/orchestrator.ts`:

```ts
const registryEntry = await ctx.runQuery(
  internal.modelRegistry.internalGetByModelId,
  { modelId }
)
```

If registry lookup fails, orchestration falls back to legacy model config to keep runs resilient.

Practical pattern for demos: keep a small default set enabled (`gpt-4o`, `claude-sonnet-4-5`) and treat additional models as opt-in.


## Step 4: Start Sessions from the UI

`ScenarioRunnerPage` starts one backend session per selected model:

```ts
const sessionId = await startSession({
  scenarioId,
  modelId,
})
```

`startSession` in `convex/orchestrator.ts`:

1. validates scenario + persona,
2. creates the session row,
3. schedules async execution with `ctx.scheduler.runAfter(0, internal.orchestrator.runConversation, ...)`.

Why this design works: the UI gets session IDs immediately and can subscribe to progress while long-running conversation logic executes in the background.


## Step 5: Implement the Conversation Loop

`runConversation` in `convex/orchestrator.ts` is the core runtime loop.

### 5.1 Actors

Each session coordinates three actors:

- the model under test,
- persona simulator (`gpt-4o-mini`),
- tool simulator (`gpt-4o-mini`).

### 5.2 Prompt contracts

- `buildAgentSystemPrompt(...)` injects domain and safety constraints.
- `buildPersonaSystemPrompt(...)` injects persona backstory and scenario context.

### 5.3 Tool-call handling

When the model emits `tool_calls`, the loop:

- stores the assistant message with tool-call payload,
- simulates each tool response,
- stores `tool` messages,
- appends results back into agent history.

When no tool calls are present, it stores the assistant response and advances the persona turn.

### 5.4 Session lifecycle

The loop manages `pending -> running -> completed` (or `failed`), checks cancellation during execution, and always schedules evaluation so failed sessions still produce consistent leaderboard accounting.


## Step 6: Evaluate Sessions with Galileo

`convex/galileoEval.ts` handles production scoring.

### 6.1 Trace lifecycle

For each session:

- start Galileo session and trace,
- log LLM spans and tool spans,
- flush trace to Galileo,
- poll for scorer results.

### 6.2 Polling strategy

Current defaults:

- max attempts: 12,
- interval: 15 seconds,
- partial metric acceptance after early attempts.

This balances responsiveness and scorer latency for real demos.

### 6.3 Metric mapping

Raw Galileo outputs are mapped into platform metrics:

- `toolAccuracy`
- `factualCorrectness`
- `completeness`
- `empathy`
- `safetyCompliance`

Weighted score:

- Tool Accuracy: 25%
- Factual Correctness: 25%
- Completeness: 20%
- Empathy: 15%
- Safety Compliance: 15%

If `GALILEO_API_KEY` is missing, the app still runs and returns zeroed metrics by design.


## Step 7: Real-Time Leaderboard and Replay

The UI is subscription-driven end to end.

- `LeaderboardPage` renders ranking and metric pivots from Convex queries.
- `ResultsDetailPage` replays normalized conversation transcripts from `messages`.

Because data is persisted incrementally, users can inspect progress while sessions are still in flight.


## Step 8: Add Deterministic Simulation Mode

For demos and CI smoke tests, populate simulated evaluations:

```bash
npx convex run batchRunner:populateEvaluations
```

`convex/batchRunner.ts` uses deterministic hash-seeded scoring to write:

- session rows,
- synthetic messages,
- evaluation rows,
- leaderboard aggregates.

Use this mode when you need stable screenshots and repeatable storylines without depending on live Galileo timing.


## Step 9: End-to-End Smoke Flow

1. Seed data:

```bash
npx convex run seed:seedAll
```

2. Start the app:

```bash
pnpm dev
```

3. In `Scenario Runner`:

- choose one scenario,
- choose one model,
- click `Run Evaluation`.

4. Verify:

- session reaches `completed`,
- leaderboard row updates,
- `Results` page shows transcript and metrics,
- Galileo console link appears when key is configured.


## Step 10: Extension Patterns

### Add a new domain

1. Replace `data/personas.json`, `data/tools.json`, `data/scenarios.json`.
2. Run `npx convex run seed:clearAndReseed`.
3. Keep metric definitions stable across comparisons.

### Add a new model provider

1. Extend provider routing in `convex/llmClient.ts`.
2. Add registry metadata in `modelRegistry`.
3. Expose model controls in Settings.

### Keep web and Python aligned

Use shared data contracts and shared metric semantics so web and Python tell the same evaluation story.


## Production Checklist

- Protect run-start and seed actions with admin/auth checks.
- Keep long execution paths in scheduled/background actions.
- Persist normalized messages for replay and audit.
- Keep Galileo optional at runtime (degrade gracefully).
- Use deterministic simulation for demos and CI stability.


## TL;DR

This pattern gives you a practical Galileo-powered evaluation control plane:

- React for orchestration and analysis,
- Convex for real-time backend execution,
- Galileo for trace-based scoring,
- deterministic simulation for repeatable demos.

Use Saggiatore as the reference, then adapt this structure to your own domain.
