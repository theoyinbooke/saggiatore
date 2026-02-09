# Saggiatore — Convex Backend

Real-time backend powering the Saggiatore evaluation platform. All server functions, database schema, and integrations live here.

## Database Schema (14 tables)

### Core Evaluation

| Table | Purpose |
|-------|---------|
| `personas` | 30 immigration client profiles with backstory, goals, and challenges |
| `tools` | 32 simulated immigration tools (eligibility checks, form lookups, etc.) |
| `scenarios` | 25 evaluation scenarios pairing personas with immigration challenges |
| `sessions` | Evaluation session state (model, scenario, status, timing) |
| `messages` | Normalized conversation messages — each insert triggers real-time UI |
| `evaluations` | Scored evaluation results with per-metric breakdowns |
| `leaderboard` | Aggregated model rankings across scenarios |
| `modelRegistry` | Available models with display names, colors, and enabled state |

### My Saggiatore (Custom Evaluations)

| Table | Purpose |
|-------|---------|
| `customEvaluations` | User-created evaluation frameworks (use case, generated config) |
| `customSessions` | Sessions for custom evaluation runs |
| `customMessages` | Messages for custom evaluation conversations |
| `customSessionEvaluations` | Scored results for custom sessions |
| `customLeaderboard` | Rankings for custom evaluation frameworks |

## Key Modules

| Module | Type | Purpose |
|--------|------|---------|
| `orchestrator.ts` | action | Main evaluation loop: agent + persona simulator + tool simulator |
| `galileoEval.ts` | action | Galileo SDK integration for production-grade scoring |
| `seed.ts` | action | Seeds personas, tools, and scenarios from `data/*.json` |
| `batchRunner.ts` | action | Runs batch evaluations across models and scenarios |
| `llmClient.ts` | utility | Unified LLM client (OpenAI, OpenRouter, Groq) |
| `customOrchestrator.ts` | action | Orchestration for My Saggiatore custom evaluations |
| `customGenerator.ts` | action | Claude-powered generation of personas, tools, scenarios, metrics |
| `customGalileoEval.ts` | action | Galileo evaluation for custom sessions |

## Development Commands

```bash
# Start Convex dev server (watches for changes)
npx convex dev

# Seed the database
npx convex run seed:seedAll

# Run batch evaluations
npx convex run batchRunner:populateEvaluations

# Deploy to production
npx convex deploy
```

## Environment Variables (server-side)

Set via `npx convex env set <KEY> <VALUE>`:

- `OPENAI_API_KEY` — GPT-4o agent and GPT-4o-mini simulators
- `OPENROUTER_API_KEY` — Claude Sonnet 4.5 via OpenRouter
- `GROQ_API_KEY` — Llama, Mixtral via Groq
- `GALILEO_API_KEY` — Production evaluation scoring (optional)
- `CLERK_JWT_ISSUER_DOMAIN` — Clerk JWT issuer for authentication
