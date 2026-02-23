"""Export evaluation results to JSON and CSV files."""

from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path

from rich.console import Console

from ..evaluation.metrics import CATEGORIES, METRIC_WEIGHTS
from ..models import SessionResult
from .leaderboard import Leaderboard

console = Console()


def export_results(
    results: list[SessionResult],
    output_dir: Path,
    run_id: str | None = None,
):
    """Export all evaluation results to JSON and CSV files.

    Creates:
    - {output_dir}/{run_id}_sessions.json — Full session data
    - {output_dir}/{run_id}_leaderboard.json — Leaderboard rankings
    - {output_dir}/{run_id}_leaderboard.csv — Leaderboard as CSV
    - {output_dir}/{run_id}_summary.json — Run summary metadata
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if run_id is None:
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Build leaderboard
    leaderboard = Leaderboard()
    leaderboard.add_results(results)
    rankings = leaderboard.get_rankings()

    # 1. Export sessions JSON
    sessions_path = output_dir / f"{run_id}_sessions.json"
    sessions_data = []
    for r in results:
        session_dict = {
            "scenario_title": r.scenario_title,
            "scenario_category": r.scenario_category,
            "model_id": r.model_id,
            "persona_name": r.persona_name,
            "status": r.status,
            "total_turns": r.total_turns,
            "overall_score": r.overall_score,
            "metrics": r.metrics.model_dump() if r.metrics else None,
            "failure_analysis": r.failure_analysis,
            "galileo_trace_id": r.galileo_trace_id,
            "galileo_console_url": r.galileo_console_url,
            "started_at": r.started_at.isoformat(),
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "messages": [
                {
                    "role": m.role,
                    "content": m.content[:500] if m.role != "system" else "[system prompt]",
                    "turn_number": m.turn_number,
                    "tool_calls": m.tool_calls,
                    "tool_call_id": m.tool_call_id,
                }
                for m in r.messages
            ],
        }
        sessions_data.append(session_dict)

    with open(sessions_path, "w", encoding="utf-8") as f:
        json.dump(sessions_data, f, indent=2, default=str)

    console.print(f"  Sessions: [green]{sessions_path}[/green]")

    # 2. Export leaderboard JSON
    leaderboard_path = output_dir / f"{run_id}_leaderboard.json"
    leaderboard_data = [
        {
            "rank": i + 1,
            "model_id": e.model_id,
            "overall_score": e.overall_score,
            "total_evaluations": e.total_evaluations,
            "metrics": e.metrics.model_dump(),
            "category_scores": e.category_scores,
        }
        for i, e in enumerate(rankings)
    ]

    with open(leaderboard_path, "w", encoding="utf-8") as f:
        json.dump(leaderboard_data, f, indent=2)

    console.print(f"  Leaderboard: [green]{leaderboard_path}[/green]")

    # 3. Export leaderboard CSV
    csv_path = output_dir / f"{run_id}_leaderboard.csv"
    if rankings:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            header = [
                "rank",
                "model_id",
                "overall_score",
                "total_evaluations",
                "tool_accuracy",
                "factual_correctness",
                "completeness",
                "empathy",
                "safety_compliance",
            ] + [f"cat_{cat}" for cat in CATEGORIES]
            writer.writerow(header)

            for i, e in enumerate(rankings):
                row = [
                    i + 1,
                    e.model_id,
                    f"{e.overall_score:.3f}",
                    e.total_evaluations,
                    f"{e.metrics.tool_accuracy:.3f}",
                    f"{e.metrics.factual_correctness:.3f}",
                    f"{e.metrics.completeness:.3f}",
                    f"{e.metrics.empathy:.3f}",
                    f"{e.metrics.safety_compliance:.3f}",
                ] + [f"{e.category_scores.get(cat, 0):.3f}" for cat in CATEGORIES]
                writer.writerow(row)

        console.print(f"  CSV: [green]{csv_path}[/green]")

    # 4. Export summary JSON
    summary_path = output_dir / f"{run_id}_summary.json"
    summary = {
        "run_id": run_id,
        "timestamp": datetime.now().isoformat(),
        "total_sessions": len(results),
        "completed": len([r for r in results if r.status == "completed"]),
        "failed": len([r for r in results if r.status == "failed"]),
        "models_evaluated": list({r.model_id for r in results}),
        "scenarios_run": list({r.scenario_title for r in results}),
        "categories_covered": list({r.scenario_category for r in results}),
        "metric_weights": METRIC_WEIGHTS,
        "top_model": rankings[0].model_id if rankings else None,
        "top_score": rankings[0].overall_score if rankings else 0,
    }

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    console.print(f"  Summary: [green]{summary_path}[/green]")

    return run_id
