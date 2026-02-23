"""Leaderboard aggregation and display.

Mirrors the leaderboard logic from leaderboard.ts and galileoEval.ts —
aggregates per-session results into per-model rankings with category breakdowns.
"""

from __future__ import annotations

from rich.console import Console
from rich.table import Table

from ..evaluation.metrics import CATEGORIES, CATEGORY_DISPLAY, METRIC_WEIGHTS, compute_overall_score
from ..models import EvalMetrics, LeaderboardEntry, SessionResult

console = Console()


class Leaderboard:
    """Aggregates session results into model rankings."""

    def __init__(self):
        self._results: list[SessionResult] = []

    def add_result(self, result: SessionResult):
        """Add a session result to the leaderboard."""
        self._results.append(result)

    def add_results(self, results: list[SessionResult]):
        """Add multiple session results."""
        self._results.extend(results)

    def get_rankings(self) -> list[LeaderboardEntry]:
        """Compute per-model aggregated rankings.

        Mirrors the aggregation logic in galileoEval.ts updateLeaderboard:
        - Average metrics across all sessions for each model
        - Per-category score breakdown
        - Ranked by overall score descending
        """
        # Group results by model
        by_model: dict[str, list[SessionResult]] = {}
        for result in self._results:
            if result.model_id not in by_model:
                by_model[result.model_id] = []
            by_model[result.model_id].append(result)

        entries: list[LeaderboardEntry] = []

        for model_id, results in by_model.items():
            scored = [r for r in results if r.metrics is not None]
            if not scored:
                continue

            n = len(scored)

            # Average metrics
            avg_metrics = EvalMetrics(
                tool_accuracy=sum(r.metrics.tool_accuracy for r in scored) / n,
                empathy=sum(r.metrics.empathy for r in scored) / n,
                factual_correctness=sum(r.metrics.factual_correctness for r in scored) / n,
                completeness=sum(r.metrics.completeness for r in scored) / n,
                safety_compliance=sum(r.metrics.safety_compliance for r in scored) / n,
            )

            # Average overall score
            avg_overall = sum(r.overall_score for r in scored) / n

            # Per-category scores
            category_scores: dict[str, float] = {}
            for cat in CATEGORIES:
                cat_results = [r for r in scored if r.scenario_category == cat]
                if cat_results:
                    category_scores[cat] = (
                        sum(r.overall_score for r in cat_results) / len(cat_results)
                    )
                else:
                    category_scores[cat] = 0.0

            entries.append(
                LeaderboardEntry(
                    model_id=model_id,
                    display_name=model_id,  # Will be enriched by CLI
                    overall_score=round(avg_overall, 3),
                    total_evaluations=n,
                    metrics=avg_metrics,
                    category_scores=category_scores,
                )
            )

        # Sort by overall score descending
        entries.sort(key=lambda e: e.overall_score, reverse=True)
        return entries

    def display(self):
        """Display the leaderboard as a Rich table in the terminal."""
        rankings = self.get_rankings()

        if not rankings:
            console.print("[yellow]No evaluation results to display.[/yellow]")
            return

        # Main leaderboard table
        table = Table(title="Saggiatore Leaderboard", show_lines=True)
        table.add_column("Rank", style="bold", width=5)
        table.add_column("Model", style="cyan", min_width=20)
        table.add_column("Overall", style="bold green", justify="center")
        table.add_column("Tool Acc.", justify="center")
        table.add_column("Factual", justify="center")
        table.add_column("Complete", justify="center")
        table.add_column("Empathy", justify="center")
        table.add_column("Safety", justify="center")
        table.add_column("Sessions", justify="center")

        for i, entry in enumerate(rankings, 1):
            m = entry.metrics
            table.add_row(
                f"#{i}",
                entry.model_id,
                f"{entry.overall_score:.3f}",
                _score_cell(m.tool_accuracy),
                _score_cell(m.factual_correctness),
                _score_cell(m.completeness),
                _score_cell(m.empathy),
                _score_cell(m.safety_compliance),
                str(entry.total_evaluations),
            )

        console.print()
        console.print(table)

        # Category breakdown table
        if any(any(v > 0 for v in e.category_scores.values()) for e in rankings):
            cat_table = Table(title="Category Breakdown", show_lines=True)
            cat_table.add_column("Model", style="cyan", min_width=20)
            for cat in CATEGORIES:
                cat_table.add_column(CATEGORY_DISPLAY[cat], justify="center")

            for entry in rankings:
                cat_table.add_row(
                    entry.model_id,
                    *[_score_cell(entry.category_scores.get(cat, 0)) for cat in CATEGORIES],
                )

            console.print()
            console.print(cat_table)

        # Metric weights reference
        console.print()
        weights_str = " | ".join(
            f"{k.replace('_', ' ').title()}: {v:.0%}" for k, v in METRIC_WEIGHTS.items()
        )
        console.print(f"[dim]Weights: {weights_str}[/dim]")


def _score_cell(score: float) -> str:
    """Format a score with color coding."""
    if score >= 0.8:
        return f"[green]{score:.3f}[/green]"
    elif score >= 0.6:
        return f"[yellow]{score:.3f}[/yellow]"
    elif score > 0:
        return f"[red]{score:.3f}[/red]"
    else:
        return "[dim]—[/dim]"
