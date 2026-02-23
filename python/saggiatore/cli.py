"""Saggiatore CLI — Immigration AI Agent Evaluation Framework.

Click-based CLI providing commands for running evaluations, viewing
leaderboards, listing personas/scenarios, and exporting results.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

import click
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from . import __version__
from .config import get_available_models, get_data_dir, get_model_config, get_results_dir, get_settings
from .data import load_all
from .evaluation.callback import get_galileo_callback
from .evaluation.galileo_eval import evaluate_session, is_galileo_configured
from .evaluation.metrics import CATEGORIES, CATEGORY_DISPLAY
from .models import SessionResult
from .orchestrator.engine import ConversationEngine
from .reporting.conversation import display_session
from .reporting.convex_sync import ConvexSyncClient
from .reporting.export import export_results
from .reporting.leaderboard import Leaderboard

console = Console()

CATEGORY_CHOICES = list(CATEGORIES)


@click.group()
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose logging")
def cli(verbose: bool):
    """Saggiatore — Immigration AI Agent Evaluation Framework (Python/LangChain)

    Evaluate LLM agents on immigration legal assistance scenarios using
    simulated personas, tools, and Galileo scoring.
    """
    level = logging.DEBUG if verbose else logging.WARNING
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


# ---------------------------------------------------------------------------
# run — execute evaluation sessions
# ---------------------------------------------------------------------------


@cli.command()
@click.option(
    "--models",
    "-m",
    multiple=True,
    help="Model IDs to evaluate (repeatable). Defaults to all configured models.",
)
@click.option(
    "--scenarios",
    "-s",
    multiple=True,
    help="Scenario indices (0-based) or 'all'. Defaults to 'all'.",
)
@click.option(
    "--category",
    "-c",
    type=click.Choice(CATEGORY_CHOICES),
    help="Filter scenarios by category.",
)
@click.option(
    "--galileo/--no-galileo",
    default=True,
    help="Enable/disable Galileo evaluation scoring.",
)
@click.option(
    "--output",
    "-o",
    default=None,
    type=click.Path(),
    help="Output directory for results.",
)
@click.option(
    "--show-conversation",
    is_flag=True,
    help="Display conversation transcripts during evaluation.",
)
def run(
    models: tuple[str, ...],
    scenarios: tuple[str, ...],
    category: str | None,
    galileo: bool,
    output: str | None,
    show_conversation: bool,
):
    """Run evaluation sessions.

    \b
    Examples:
      saggiatore run --models gpt-4o --models claude-sonnet-4-5 --scenarios all
      saggiatore run -m gpt-4o -s 0 -s 1 -s 2
      saggiatore run -m gpt-4o --category humanitarian
      saggiatore run -m gpt-4o --no-galileo
    """
    asyncio.run(
        _run_async(models, scenarios, category, galileo, output, show_conversation)
    )


async def _run_async(
    models: tuple[str, ...],
    scenarios: tuple[str, ...],
    category: str | None,
    galileo_enabled: bool,
    output: str | None,
    show_conversation: bool,
):
    settings = get_settings()
    convex_sync = ConvexSyncClient(settings)
    run_started_at = datetime.now()
    run_id = run_started_at.strftime("%Y%m%d_%H%M%S")

    try:
        # Validate at least one API key
        if not settings.openai_api_key:
            console.print(
                "[red]Error: OPENAI_API_KEY is required (used for simulators).[/red]\n"
                "Set it in python/.env or as an environment variable."
            )
            sys.exit(1)

        # Load data
        data_dir = get_data_dir()
        personas, tools, all_scenarios = load_all(data_dir)
        console.print(
            f"Loaded [green]{len(personas)}[/green] personas, "
            f"[green]{len(tools)}[/green] tools, "
            f"[green]{len(all_scenarios)}[/green] scenarios"
        )

        # Resolve models
        if models:
            model_configs = []
            for mid in models:
                cfg = get_model_config(mid)
                if cfg is None:
                    console.print(f"[red]Unknown model: {mid}[/red]")
                    sys.exit(1)
                model_configs.append(cfg)
        else:
            model_configs = get_available_models(settings)

        if not model_configs:
            console.print("[red]No models available. Configure API keys in .env.[/red]")
            sys.exit(1)

        console.print(
            f"Models: {', '.join(f'[cyan]{m.model_id}[/cyan]' for m in model_configs)}"
        )

        # Resolve scenarios
        if not scenarios or "all" in scenarios:
            selected_scenarios = list(range(len(all_scenarios)))
        else:
            selected_scenarios = [int(s) for s in scenarios]

        # Filter by category
        if category:
            selected_scenarios = [
                i for i in selected_scenarios if all_scenarios[i].category == category
            ]
            console.print(f"Category filter: [yellow]{CATEGORY_DISPLAY[category]}[/yellow]")

        if not selected_scenarios:
            console.print("[red]No scenarios match the given filters.[/red]")
            sys.exit(1)

        console.print(f"Scenarios: [green]{len(selected_scenarios)}[/green]")
        total_sessions = len(model_configs) * len(selected_scenarios)
        console.print(f"Total sessions: [bold]{total_sessions}[/bold]")

        # Galileo status
        if galileo_enabled and is_galileo_configured():
            console.print(f"Galileo: [green]Enabled[/green] ({settings.galileo_project})")
        elif galileo_enabled:
            console.print("[yellow]Galileo: API key not configured — scoring disabled[/yellow]")
            galileo_enabled = False
        else:
            console.print("Galileo: [dim]Disabled[/dim]")

        if convex_sync.enabled:
            console.print(f"Convex Sync: [green]Enabled[/green] ({settings.convex_python_ingest_url})")
        elif settings.convex_python_ingest_url or settings.convex_python_ingest_token:
            console.print(
                "Convex Sync: [yellow]Disabled — set both CONVEX_PYTHON_INGEST_URL "
                "and CONVEX_PYTHON_INGEST_TOKEN[/yellow]"
            )
        else:
            console.print("Convex Sync: [dim]Disabled[/dim]")

        console.print()

        # Setup callbacks
        callbacks = []
        if galileo_enabled:
            cb = get_galileo_callback()
            if cb:
                callbacks.append(cb)

        # Create engine
        engine = ConversationEngine(tools=tools, callbacks=callbacks)

        # Run sessions
        all_results: list[SessionResult] = []
        completed = 0
        session_seq = 0

        def build_run_payload(
            status: str,
            completed_at: datetime | None = None,
            last_error: str | None = None,
        ) -> dict:
            completed_sessions = len([r for r in all_results if r.status == "completed"])
            failed_sessions = len(
                [r for r in all_results if r.status in ("failed", "timeout", "cancelled")]
            )
            return {
                "runId": run_id,
                "status": status,
                "models": [m.model_id for m in model_configs],
                "scenarioCount": len(selected_scenarios),
                "totalSessions": total_sessions,
                "completedSessions": completed_sessions,
                "failedSessions": failed_sessions,
                "galileoEnabled": galileo_enabled,
                "startedAt": int(run_started_at.timestamp() * 1000),
                "completedAt": int(completed_at.timestamp() * 1000) if completed_at else None,
                "lastError": last_error,
                "sourceVersion": __version__,
            }

        await convex_sync.sync_run(build_run_payload("running"))

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Running evaluations...", total=total_sessions)

            for model_config in model_configs:
                for scenario_idx in selected_scenarios:
                    scenario = all_scenarios[scenario_idx]
                    persona = personas[scenario.persona_index]

                    progress.update(
                        task,
                        description=(
                            f"[{completed + 1}/{total_sessions}] "
                            f"{model_config.model_id} | {scenario.title[:40]}..."
                        ),
                    )

                    result = await engine.run_session(
                        scenario=scenario,
                        persona=persona,
                        model_config=model_config,
                    )

                    # Evaluate with Galileo if enabled
                    if galileo_enabled and result.status == "completed":
                        result = await evaluate_session(result)
                    elif result.status == "completed":
                        # Without Galileo, score is 0
                        result.overall_score = 0

                    all_results.append(result)
                    session_seq += 1
                    completed += 1
                    progress.advance(task)

                    await convex_sync.sync_session(
                        run_payload=build_run_payload("running"),
                        result=result,
                        session_key=f"session-{session_seq:04d}",
                    )

                    # Show conversation if requested
                    if show_conversation:
                        display_session(result)

                    # Quick status line
                    status_icon = (
                        "[green]OK[/green]"
                        if result.status == "completed"
                        else "[red]FAIL[/red]"
                    )
                    score_str = f" | Score: {result.overall_score:.3f}" if result.metrics else ""
                    console.print(
                        f"  {status_icon} {model_config.model_id} | "
                        f"{scenario.title[:50]}{score_str}"
                    )

        # Display leaderboard
        console.print()
        leaderboard = Leaderboard()
        leaderboard.add_results(all_results)
        rankings = leaderboard.get_rankings()
        leaderboard.display()

        final_status = (
            "failed"
            if all_results and all(r.status != "completed" for r in all_results)
            else "completed"
        )
        final_payload = build_run_payload(
            status=final_status,
            completed_at=datetime.now(),
        )
        await convex_sync.sync_leaderboard(final_payload, rankings)
        await convex_sync.sync_run(final_payload)

        # Export results
        output_dir = Path(output) if output else get_results_dir()
        console.print()
        console.print("[bold]Exporting results...[/bold]")
        export_results(all_results, output_dir, run_id=run_id)
        console.print(f"\nRun ID: [bold]{run_id}[/bold]")
    except Exception as exc:
        await convex_sync.sync_run(
            {
                "runId": run_id,
                "status": "failed",
                "models": list(models),
                "scenarioCount": 0,
                "totalSessions": 0,
                "completedSessions": 0,
                "failedSessions": 1,
                "galileoEnabled": galileo_enabled,
                "startedAt": int(run_started_at.timestamp() * 1000),
                "completedAt": int(datetime.now().timestamp() * 1000),
                "lastError": str(exc),
                "sourceVersion": __version__,
            }
        )
        raise
    finally:
        await convex_sync.close()


# ---------------------------------------------------------------------------
# leaderboard — display results from saved files
# ---------------------------------------------------------------------------


@cli.command()
@click.argument("results_dir", default="results", type=click.Path(exists=True))
def leaderboard(results_dir: str):
    """Display the evaluation leaderboard from saved results."""
    results_path = Path(results_dir)

    # Find the most recent sessions file
    session_files = sorted(results_path.glob("*_sessions.json"), reverse=True)
    if not session_files:
        console.print(f"[red]No session files found in {results_dir}[/red]")
        sys.exit(1)

    latest = session_files[0]
    console.print(f"Loading results from: [cyan]{latest}[/cyan]")

    with open(latest, encoding="utf-8") as f:
        sessions_data = json.load(f)

    results = []
    for s in sessions_data:
        from .models import EvalMetrics

        metrics = EvalMetrics(**s["metrics"]) if s.get("metrics") else None
        results.append(
            SessionResult(
                scenario_title=s["scenario_title"],
                scenario_category=s["scenario_category"],
                model_id=s["model_id"],
                persona_name=s["persona_name"],
                status=s["status"],
                total_turns=s["total_turns"],
                overall_score=s.get("overall_score", 0),
                metrics=metrics,
                started_at=datetime.fromisoformat(s["started_at"]),
                completed_at=(
                    datetime.fromisoformat(s["completed_at"])
                    if s.get("completed_at")
                    else None
                ),
            )
        )

    lb = Leaderboard()
    lb.add_results(results)
    lb.display()


# ---------------------------------------------------------------------------
# list-personas — display available personas
# ---------------------------------------------------------------------------


@cli.command("list-personas")
def list_personas():
    """List all available immigration client personas."""
    data_dir = get_data_dir()
    from .data import load_personas

    personas = load_personas(data_dir)

    table = Table(title=f"Immigration Client Personas ({len(personas)})", show_lines=True)
    table.add_column("#", style="dim", width=3)
    table.add_column("Name", style="cyan", min_width=20)
    table.add_column("Nationality", min_width=12)
    table.add_column("Status", min_width=15)
    table.add_column("Visa Type", min_width=10)
    table.add_column("Complexity", justify="center")

    for i, p in enumerate(personas):
        complexity_color = {"low": "green", "medium": "yellow", "high": "red"}[
            p.complexity_level
        ]
        table.add_row(
            str(i),
            f"{p.country_flag} {p.name}",
            p.nationality,
            p.current_status,
            p.visa_type,
            f"[{complexity_color}]{p.complexity_level}[/{complexity_color}]",
        )

    console.print()
    console.print(table)


# ---------------------------------------------------------------------------
# list-scenarios — display available scenarios
# ---------------------------------------------------------------------------


@cli.command("list-scenarios")
@click.option(
    "--category",
    "-c",
    type=click.Choice(CATEGORY_CHOICES),
    help="Filter by category.",
)
def list_scenarios(category: str | None):
    """List all available evaluation scenarios."""
    data_dir = get_data_dir()
    from .data import load_all

    personas, _, scenarios = load_all(data_dir)

    if category:
        scenarios = [s for s in scenarios if s.category == category]

    table = Table(
        title=f"Evaluation Scenarios ({len(scenarios)})", show_lines=True
    )
    table.add_column("#", style="dim", width=3)
    table.add_column("Title", style="cyan", min_width=30)
    table.add_column("Category", min_width=15)
    table.add_column("Complexity", justify="center")
    table.add_column("Persona", min_width=15)
    table.add_column("Tools", justify="center", width=6)
    table.add_column("Turns", justify="center", width=6)

    for i, s in enumerate(scenarios):
        persona = personas[s.persona_index] if s.persona_index < len(personas) else None
        complexity_color = {"low": "green", "medium": "yellow", "high": "red"}[s.complexity]
        table.add_row(
            str(i),
            s.title,
            CATEGORY_DISPLAY.get(s.category, s.category),
            f"[{complexity_color}]{s.complexity}[/{complexity_color}]",
            persona.name if persona else "?",
            str(len(s.expected_tools)),
            str(s.max_turns),
        )

    console.print()
    console.print(table)


# ---------------------------------------------------------------------------
# list-models — display configured models
# ---------------------------------------------------------------------------


@cli.command("list-models")
def list_models():
    """List configured models and their availability status."""
    settings = get_settings()
    available = get_available_models(settings)
    available_ids = {m.model_id for m in available}

    from .config import DEFAULT_MODELS

    table = Table(title="Model Registry", show_lines=True)
    table.add_column("Model ID", style="cyan", min_width=25)
    table.add_column("Display Name", min_width=20)
    table.add_column("Provider", min_width=12)
    table.add_column("Tools", justify="center")
    table.add_column("Status", justify="center")

    for m in DEFAULT_MODELS:
        if m.model_id in available_ids:
            status = "[green]Ready[/green]"
        else:
            status = f"[red]Missing {m.env_key}[/red]"

        table.add_row(
            m.model_id,
            m.display_name,
            m.provider,
            "[green]Yes[/green]" if m.supports_tools else "[dim]No[/dim]",
            status,
        )

    console.print()
    console.print(table)

    if available:
        console.print(
            f"\n[green]{len(available)}[/green] of {len(DEFAULT_MODELS)} models ready"
        )
    else:
        console.print("\n[red]No models available. Set API keys in python/.env[/red]")


# ---------------------------------------------------------------------------
# show — display detailed results for a session
# ---------------------------------------------------------------------------


@cli.command()
@click.argument("results_file", type=click.Path(exists=True))
@click.option("--session", "-s", type=int, default=0, help="Session index to display.")
def show(results_file: str, session: int):
    """Show detailed results for a specific session from a results file."""
    with open(results_file, encoding="utf-8") as f:
        sessions_data = json.load(f)

    if session >= len(sessions_data):
        console.print(
            f"[red]Session index {session} out of range "
            f"(file has {len(sessions_data)} sessions)[/red]"
        )
        sys.exit(1)

    s = sessions_data[session]
    from .models import ConversationMessage, EvalMetrics

    metrics = EvalMetrics(**s["metrics"]) if s.get("metrics") else None
    messages = [ConversationMessage(**m) for m in s.get("messages", [])]

    result = SessionResult(
        scenario_title=s["scenario_title"],
        scenario_category=s["scenario_category"],
        model_id=s["model_id"],
        persona_name=s["persona_name"],
        status=s["status"],
        total_turns=s["total_turns"],
        overall_score=s.get("overall_score", 0),
        metrics=metrics,
        messages=messages,
        failure_analysis=s.get("failure_analysis", []),
        galileo_trace_id=s.get("galileo_trace_id"),
        galileo_console_url=s.get("galileo_console_url"),
        started_at=datetime.fromisoformat(s["started_at"]),
        completed_at=(
            datetime.fromisoformat(s["completed_at"]) if s.get("completed_at") else None
        ),
    )

    display_session(result)


if __name__ == "__main__":
    cli()
