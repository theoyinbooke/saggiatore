# Saggiatore

Interactive web platform for evaluating and comparing LLM performance on domain-specific tasks. Pre-configured for immigration assistance scenarios with 30 personas, 25 scenarios, and 32 tools, Saggiatore provides real-time leaderboards, metric-driven comparisons, and detailed conversation analysis. It also includes **My Saggiatore** -- describe any use case in natural language and the system auto-generates a complete evaluation framework (personas, tools, scenarios, and metrics) using Claude.


## Features

- **Real-time leaderboard** with metric filtering and donut chart visualizations
- **30 pre-built immigration personas**, 25 scenarios, 32 tools ready out of the box
- **Interactive scenario runner** with live conversation streaming
- **My Saggiatore**: custom evaluation builder for any domain -- describe your use case and get an auto-generated evaluation framework
- **Galileo integration** for production-grade LLM evaluation scoring (with simulated fallback)
- **Multi-model support**: GPT-4o, Claude Sonnet 4.5, Llama, Mixtral, and more
- **Shareable evaluation results** via unique share links
- **Clerk authentication** for user-scoped evaluations

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [React](https://react.dev) | 19 | UI framework |
| [Vite](https://vite.dev) | 7 | Build tool and dev server |
| [Tailwind CSS](https://tailwindcss.com) | v4 | Utility-first styling |
| [shadcn/ui](https://ui.shadcn.com) | latest | Component library (Nova theme) |
| [Convex](https://convex.dev) | 1.31+ | Real-time backend, database, and server functions |
| [Recharts](https://recharts.org) | 3 | Chart visualizations |
| [Clerk](https://clerk.com) | 5.x | Authentication |
| [Galileo TS SDK](https://docs.galileo.ai) | 1.32+ | LLM evaluation scoring |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/<your-username>/saggiatore.git
cd saggiatore
pnpm install

# 2. Create a Convex project
npx convex dev --configure=new

# 3. Set up environment variables
cp .env.example .env.local
# Fill in your API keys in .env.local

# 4. Set Convex environment variables (server-side keys)
npx convex env set OPENAI_API_KEY <your-key>
npx convex env set OPENROUTER_API_KEY <your-key>
npx convex env set GROQ_API_KEY <your-key>
npx convex env set GALILEO_API_KEY <your-key>

# 5. Seed the database with personas, tools, and scenarios
npx convex run seed:seedAll

# 6. (Optional) Pre-populate leaderboard with batch evaluations
npx convex run batchRunner:populateEvaluations

# 7. Start the dev server
pnpm dev
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_CONVEX_URL` | Yes | Convex deployment URL (auto-set by `npx convex dev`) |
| `OPENAI_API_KEY` | Yes | GPT-4o agent and GPT-4o-mini simulators |
| `OPENROUTER_API_KEY` | No | Claude Sonnet 4.5 via OpenRouter |
| `GROQ_API_KEY` | No | Llama, Mixtral via Groq |
| `GALILEO_API_KEY` | No | Real evaluation scoring (falls back to simulated) |
| `CLERK_JWT_ISSUER_DOMAIN` | No | Clerk JWT issuer domain (set as Convex env var) |
| `VITE_CLERK_PUBLISHABLE_KEY` | No | Clerk authentication |
| `VITE_MAX_ENABLED_MODELS` | No | Max models enabled simultaneously (default: 10) |

## Project Structure

```
saggiatore/
├── convex/              # Backend: schema, queries, mutations, actions
│   ├── schema.ts        # Database schema (14 tables)
│   ├── orchestrator.ts  # Main evaluation orchestrator
│   ├── seed.ts          # Data seeding functions
│   ├── batchRunner.ts   # Batch evaluation runner
│   ├── galileoEval.ts   # Galileo integration
│   └── ...              # 30 backend modules
├── data/                # Static seed data
│   ├── personas.json    # 30 immigration personas
│   ├── tools.json       # 32 available tools
│   └── scenarios.json   # 25 evaluation scenarios
├── src/
│   ├── pages/           # Route pages
│   │   ├── LeaderboardPage.tsx
│   │   ├── PersonaExplorerPage.tsx
│   │   ├── ScenarioRunnerPage.tsx
│   │   ├── ResultsDetailPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── my/          # My Saggiatore pages
│   ├── components/      # UI components + shadcn/ui
│   │   ├── my/          # My Saggiatore components
│   │   └── ui/          # shadcn/ui primitives
│   └── lib/             # Utilities, types, constants
├── scripts/             # Setup utilities
└── .env.example         # Environment variable template
```

## Forking & Customizing

- **Replace the immigration domain**: Modify `data/personas.json`, `data/tools.json`, and `data/scenarios.json` with your own domain-specific data. Run `npx convex run seed:seedAll` to reload.
- **My Saggiatore**: Alternatively, describe any use case in natural language and the system auto-generates personas, tools, scenarios, and evaluation metrics using Claude -- no JSON editing required.
- **Key files to modify**:
  - `convex/schema.ts` -- Data model and table definitions
  - `convex/orchestrator.ts` -- Evaluation orchestration logic
  - `src/lib/constants.ts` -- UI configuration, metrics, score colors

## Galileo Integration

Optional integration with [Galileo](https://docs.galileo.ai) for production-grade LLM evaluation scoring.

When `GALILEO_API_KEY` is not set, the system falls back to simulated scores -- no Galileo account needed to run the app.

To configure Galileo evaluation scorers:

```bash
npx tsx scripts/setup-galileo-scorers.ts
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite development server |
| `pnpm build` | TypeScript check + production build |
| `pnpm preview` | Preview production build locally |
| `npx convex dev` | Start Convex development server |
| `npx convex run seed:seedAll` | Seed personas, tools, and scenarios |
| `npx convex run batchRunner:populateEvaluations` | Run batch evaluations to populate leaderboard |
| `npx tsx scripts/setup-galileo-scorers.ts` | Configure Galileo evaluation scorers |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Set environment variables in the Vercel dashboard (same as `.env.example`)
4. Set the Convex production deployment URL as `VITE_CONVEX_URL`
5. Deploy

### Convex Production

```bash
npx convex deploy
```

## License

[Apache License 2.0](./LICENSE)
