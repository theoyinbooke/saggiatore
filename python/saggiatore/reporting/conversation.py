"""Conversation transcript formatting for terminal display."""

from __future__ import annotations

import json

from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from ..models import SessionResult

console = Console()


def display_session(result: SessionResult):
    """Display a full session transcript with color-coded messages."""
    # Header
    console.print()
    status_color = "green" if result.status == "completed" else "red"
    console.print(
        Panel(
            f"[bold]{result.scenario_title}[/bold]\n"
            f"Model: [cyan]{result.model_id}[/cyan] | "
            f"Persona: [magenta]{result.persona_name}[/magenta] | "
            f"Status: [{status_color}]{result.status}[/{status_color}] | "
            f"Turns: {result.total_turns}",
            title="Session Details",
        )
    )

    # Messages
    for msg in result.messages:
        if msg.role == "system":
            continue  # Skip system prompt in display

        if msg.role == "user":
            _print_persona_message(msg.content, msg.turn_number, result.persona_name)
        elif msg.role == "assistant":
            if msg.tool_calls:
                _print_tool_calls(msg.tool_calls, msg.turn_number)
            if msg.content:
                _print_agent_message(msg.content, msg.turn_number, result.model_id)
        elif msg.role == "tool":
            _print_tool_response(msg.content, msg.turn_number)

    # Scores
    if result.metrics:
        console.print()
        m = result.metrics
        console.print(
            Panel(
                f"Overall: [bold green]{result.overall_score:.3f}[/bold green]\n"
                f"Tool Accuracy:       {m.tool_accuracy:.3f}\n"
                f"Factual Correctness: {m.factual_correctness:.3f}\n"
                f"Completeness:        {m.completeness:.3f}\n"
                f"Empathy:             {m.empathy:.3f}\n"
                f"Safety Compliance:   {m.safety_compliance:.3f}",
                title="Evaluation Scores",
            )
        )

    if result.failure_analysis:
        console.print()
        for analysis in result.failure_analysis:
            console.print(f"  [yellow]! {analysis}[/yellow]")

    if result.galileo_console_url:
        console.print()
        console.print(f"  [dim]Galileo Console: {result.galileo_console_url}[/dim]")


def _print_persona_message(content: str, turn: int, name: str):
    """Print a persona (user) message."""
    console.print()
    console.print(f"  [bold magenta]{name}[/bold magenta] [dim](turn {turn})[/dim]")
    for line in content.split("\n"):
        console.print(f"  [magenta]{line}[/magenta]")


def _print_agent_message(content: str, turn: int, model: str):
    """Print an agent (assistant) message."""
    console.print()
    console.print(f"  [bold cyan]{model}[/bold cyan] [dim](turn {turn})[/dim]")
    for line in content.split("\n"):
        console.print(f"  [cyan]{line}[/cyan]")


def _print_tool_calls(tool_calls: list[dict], turn: int):
    """Print tool call details."""
    for tc in tool_calls:
        name = tc.get("name", "unknown")
        args_str = tc.get("arguments", "{}")
        try:
            args = json.loads(args_str)
            formatted_args = json.dumps(args, indent=2)
        except (json.JSONDecodeError, TypeError):
            formatted_args = args_str

        console.print()
        console.print(f"  [bold yellow]Tool Call: {name}[/bold yellow] [dim](turn {turn})[/dim]")
        for line in formatted_args.split("\n"):
            console.print(f"    [yellow]{line}[/yellow]")


def _print_tool_response(content: str, turn: int):
    """Print a tool response."""
    try:
        parsed = json.loads(content)
        formatted = json.dumps(parsed, indent=2)
    except (json.JSONDecodeError, TypeError):
        formatted = content

    # Truncate long responses
    lines = formatted.split("\n")
    if len(lines) > 10:
        display_lines = lines[:8] + [f"  ... ({len(lines) - 8} more lines)"]
    else:
        display_lines = lines

    console.print(f"  [dim]Tool Response (turn {turn}):[/dim]")
    for line in display_lines:
        console.print(f"    [dim]{line}[/dim]")
