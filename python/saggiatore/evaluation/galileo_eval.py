"""Galileo Python SDK integration for evaluation scoring.

Port of galileoEval.ts — logs conversation traces to Galileo and polls
for scorer results. Supports both automatic (via GalileoCallback) and
manual trace logging approaches.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time

from ..config import get_settings
from ..models import ConversationMessage, EvalMetrics, SessionResult
from .metrics import compute_overall_score, generate_failure_analysis, map_galileo_scores

logger = logging.getLogger(__name__)

# Polling configuration (mirrors galileoEval.ts)
MAX_POLL_ATTEMPTS = 12
POLL_INTERVAL_SECONDS = 15

# Expected Galileo metric keys
EXPECTED_METRIC_KEYS = [
    "toolSelectionQuality",
    "toolErrorRate",
    "toxicityGpt",
    "promptInjectionGpt",
    "factuality",
    "completenessGpt",
    "empathy",
]


def is_galileo_configured() -> bool:
    """Check if Galileo API key is available."""
    settings = get_settings()
    return bool(settings.galileo_api_key)


async def evaluate_session(result: SessionResult) -> SessionResult:
    """Evaluate a completed session using Galileo's Python SDK.

    Steps (mirrors evaluateWithGalileo in galileoEval.ts):
    1. Initialize Galileo project + log stream
    2. Start a session and trace
    3. Log LLM spans for each assistant message
    4. Log tool spans for each tool call
    5. Conclude trace with final output
    6. Flush to Galileo
    7. Poll for scorer results
    8. Map Galileo scores to EvalMetrics
    9. Compute weighted overall score
    """
    settings = get_settings()

    if not settings.galileo_api_key:
        logger.info("Galileo API key not configured — skipping evaluation")
        return result

    try:
        # Import Galileo SDK (optional dependency)
        from galileo import GalileoLogger, get_log_stream, get_project, get_traces, init

        # Set API key
        os.environ["GALILEO_API_KEY"] = settings.galileo_api_key

        # Initialize Galileo project
        await asyncio.to_thread(
            init,
            project_name=settings.galileo_project,
            log_stream=settings.galileo_log_stream,
        )

        # Create logger
        galileo_logger = GalileoLogger(
            project_name=settings.galileo_project,
            log_stream_name=settings.galileo_log_stream,
        )

        # Start session
        session_name = f"eval-{result.model_id}-{int(time.time())}"
        galileo_logger.start_session(name=session_name)

        # Find first user message for trace input
        user_messages = [m for m in result.messages if m.role == "user"]
        first_user_input = (
            user_messages[0].content if user_messages else "Immigration consultation"
        )

        # Generate unique trace name for retrieval
        trace_suffix = f"{int(time.time())}-{os.urandom(3).hex()}"
        trace_name = f"immigration-eval-{result.model_id}-{trace_suffix}"

        galileo_logger.start_trace(
            input=first_user_input,
            name=trace_name,
            tags=["saggiatore-python", result.model_id, "immigration"],
        )

        # Log conversation spans
        system_msg = next((m for m in result.messages if m.role == "system"), None)

        for msg in result.messages:
            if msg.role == "assistant" and msg.content:
                # Find preceding user input
                preceding = [
                    m
                    for m in result.messages
                    if m.turn_number < msg.turn_number and m.role == "user"
                ]
                preceding_input = (
                    preceding[-1].content
                    if preceding
                    else (system_msg.content if system_msg else "")
                )

                galileo_logger.add_llm_span(
                    input=preceding_input,
                    output=msg.content,
                    model=result.model_id,
                    tags=[f"turn-{msg.turn_number}"],
                )

            if msg.tool_calls:
                for tc in msg.tool_calls:
                    # Find the tool response
                    tool_result = next(
                        (
                            m
                            for m in result.messages
                            if m.role == "tool" and m.tool_call_id == tc.get("id")
                        ),
                        None,
                    )
                    galileo_logger.add_tool_span(
                        input=tc.get("arguments", ""),
                        output=tool_result.content if tool_result else "",
                        name=tc.get("name", "unknown"),
                        duration_ns=0,
                    )

        # Conclude trace
        last_assistant = next(
            (m for m in reversed(result.messages) if m.role == "assistant" and m.content),
            None,
        )
        galileo_logger.conclude(output=last_assistant.content if last_assistant else "")

        # Flush to Galileo
        await asyncio.to_thread(galileo_logger.flush)
        logger.info("Trace flushed to Galileo: %s", trace_name)

        # Retrieve project for polling
        project = await asyncio.to_thread(get_project, name=settings.galileo_project)
        if not project or not project.id:
            logger.warning("Galileo project not found — cannot poll for scores")
            return result

        log_stream = await asyncio.to_thread(
            get_log_stream,
            name=settings.galileo_log_stream,
            project_name=settings.galileo_project,
        )

        # Poll for scorer results
        scorer_results = await _poll_for_scores(
            get_traces_fn=get_traces,
            project_id=project.id,
            log_stream_id=log_stream.id if log_stream else None,
            trace_name=trace_name,
        )

        if scorer_results:
            metrics = map_galileo_scores(scorer_results)
            overall_score = compute_overall_score(metrics)
            failure_analysis = generate_failure_analysis(metrics)

            result.metrics = metrics
            result.overall_score = overall_score
            result.failure_analysis = failure_analysis
            result.galileo_trace_id = trace_name
            result.galileo_console_url = (
                f"https://console.galileo.ai/project/{settings.galileo_project}/traces/{trace_name}"
            )

            logger.info(
                "Galileo evaluation complete: %s | Score: %.3f",
                result.model_id,
                overall_score,
            )
        else:
            logger.warning(
                "Galileo scores not ready after polling for %s", result.model_id
            )
            result.galileo_trace_id = trace_name
            result.failure_analysis = [
                "Galileo scores not available after polling. Check Galileo Console."
            ]

    except ImportError:
        logger.warning(
            "Galileo SDK not installed. Install with: pip install galileo"
        )
    except Exception as e:
        logger.error("Galileo evaluation failed: %s", str(e))
        result.failure_analysis = [f"Galileo evaluation error: {str(e)}"]
    finally:
        # Clean up env var
        os.environ.pop("GALILEO_API_KEY", None)

    return result


async def _poll_for_scores(
    get_traces_fn,
    project_id: str,
    log_stream_id: str | None,
    trace_name: str,
) -> dict[str, float] | None:
    """Poll Galileo API for scorer results.

    Mirrors the polling loop in galileoEval.ts:
    - Up to 12 attempts, 15 seconds apart
    - Accept partial results after 4+ attempts
    """
    for attempt in range(MAX_POLL_ATTEMPTS):
        await asyncio.sleep(POLL_INTERVAL_SECONDS)

        try:
            trace_results = await asyncio.to_thread(
                get_traces_fn,
                project_id=project_id,
                log_stream_id=log_stream_id,
                filters=[
                    {
                        "columnId": "name",
                        "operator": "eq",
                        "value": trace_name,
                        "type": "text",
                    }
                ],
                limit=1,
            )

            records = getattr(trace_results, "records", None) or []
            trace = records[0] if records else None

            if trace and hasattr(trace, "metrics") and trace.metrics:
                numeric_metrics = {
                    k: v
                    for k, v in trace.metrics.items()
                    if isinstance(v, (int, float))
                }

                if not numeric_metrics:
                    continue

                found = [k for k in EXPECTED_METRIC_KEYS if k in numeric_metrics]
                missing = [k for k in EXPECTED_METRIC_KEYS if k not in numeric_metrics]

                logger.info(
                    "Galileo poll %d/%d: found [%s], missing [%s]",
                    attempt + 1,
                    MAX_POLL_ATTEMPTS,
                    ", ".join(found),
                    ", ".join(missing),
                )

                if not missing:
                    logger.info(
                        "All Galileo metrics retrieved on attempt %d", attempt + 1
                    )
                    return numeric_metrics

                if attempt >= 3:
                    logger.info(
                        "Accepting partial Galileo scores after %d attempts", attempt + 1
                    )
                    return numeric_metrics

        except Exception as e:
            logger.warning("Galileo polling attempt %d failed: %s", attempt + 1, str(e))

    return None
