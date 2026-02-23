"""Sync Python SDK evaluation outputs to Convex for web UI visualization."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

from ..config import Settings
from ..evaluation.metrics import CATEGORIES
from ..models import LeaderboardEntry, SessionResult

logger = logging.getLogger(__name__)


def _to_ms(ts: datetime | None) -> int | None:
    if ts is None:
        return None
    return int(ts.timestamp() * 1000)


def _metrics_to_camel(metrics: Any) -> dict[str, float] | None:
    if metrics is None:
        return None
    return {
        "toolAccuracy": float(metrics.tool_accuracy),
        "empathy": float(metrics.empathy),
        "factualCorrectness": float(metrics.factual_correctness),
        "completeness": float(metrics.completeness),
        "safetyCompliance": float(metrics.safety_compliance),
    }


class ConvexSyncClient:
    """Best-effort uploader for Python run data into Convex HTTP ingestion API."""

    def __init__(self, settings: Settings):
        self.url = settings.convex_python_ingest_url.strip()
        self.token = settings.convex_python_ingest_token.strip()
        self.enabled = bool(self.url and self.token)
        self._client = httpx.AsyncClient(timeout=20.0) if self.enabled else None
        if not self.enabled:
            logger.info(
                "Convex sync disabled (set CONVEX_PYTHON_INGEST_URL and CONVEX_PYTHON_INGEST_TOKEN)."
            )

    async def close(self):
        if self._client is not None:
            await self._client.aclose()

    async def _post(self, payload: dict[str, Any]) -> bool:
        if not self.enabled or self._client is None:
            return False

        try:
            resp = await self._client.post(
                self.url,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if resp.status_code >= 400:
                logger.warning(
                    "Convex sync failed: HTTP %s %s",
                    resp.status_code,
                    resp.text[:300],
                )
                return False
            return True
        except Exception as exc:
            logger.warning("Convex sync request error: %s", str(exc))
            return False

    async def sync_session(
        self,
        run_payload: dict[str, Any],
        result: SessionResult,
        session_key: str,
    ) -> bool:
        """Upsert one session (+messages/evaluation) to Convex."""
        metrics = _metrics_to_camel(result.metrics)

        # Python messages don't carry timestamps, so we synthesize stable ordering timestamps.
        base_ts = _to_ms(result.started_at) or int(datetime.now().timestamp() * 1000)
        messages = []
        for idx, msg in enumerate(result.messages):
            messages.append(
                {
                    "role": msg.role,
                    "content": msg.content[:500] if msg.role != "system" else "[system prompt]",
                    "turnNumber": int(msg.turn_number),
                    "toolCalls": msg.tool_calls,
                    "toolCallId": msg.tool_call_id,
                    "timestamp": base_ts + idx * 1000,
                }
            )

        session_payload = {
            "sessionKey": session_key,
            "scenarioTitle": result.scenario_title,
            "scenarioCategory": result.scenario_category,
            "modelId": result.model_id,
            "personaName": result.persona_name,
            "status": result.status,
            "totalTurns": int(result.total_turns),
            "overallScore": float(result.overall_score),
            "metrics": metrics,
            "failureAnalysis": result.failure_analysis,
            "galileoTraceId": result.galileo_trace_id,
            "galileoConsoleUrl": result.galileo_console_url,
            "startedAt": _to_ms(result.started_at),
            "completedAt": _to_ms(result.completed_at),
            "messages": messages,
        }

        if metrics:
            category_scores = {cat: 0.0 for cat in CATEGORIES}
            if result.scenario_category in category_scores:
                category_scores[result.scenario_category] = float(result.overall_score)
            session_payload["evaluation"] = {
                "overallScore": float(result.overall_score),
                "metrics": metrics,
                "categoryScores": category_scores,
                "failureAnalysis": result.failure_analysis,
                "galileoTraceId": result.galileo_trace_id,
                "galileoConsoleUrl": result.galileo_console_url,
                "evaluatedAt": _to_ms(result.completed_at) or int(datetime.now().timestamp() * 1000),
            }

        payload = {
            "run": run_payload,
            "session": session_payload,
        }
        return await self._post(payload)

    async def sync_run(self, run_payload: dict[str, Any]) -> bool:
        """Upsert run-level progress/status only."""
        return await self._post({"run": run_payload})

    async def sync_leaderboard(
        self,
        run_payload: dict[str, Any],
        rankings: list[LeaderboardEntry],
    ) -> bool:
        """Replace leaderboard rows for a run in Convex."""
        leaderboard_payload = []
        for i, entry in enumerate(rankings, start=1):
            leaderboard_payload.append(
                {
                    "rank": i,
                    "modelId": entry.model_id,
                    "overallScore": float(entry.overall_score),
                    "totalEvaluations": int(entry.total_evaluations),
                    "metrics": {
                        "toolAccuracy": float(entry.metrics.tool_accuracy),
                        "empathy": float(entry.metrics.empathy),
                        "factualCorrectness": float(entry.metrics.factual_correctness),
                        "completeness": float(entry.metrics.completeness),
                        "safetyCompliance": float(entry.metrics.safety_compliance),
                    },
                    "categoryScores": {
                        cat: float(entry.category_scores.get(cat, 0.0)) for cat in CATEGORIES
                    },
                }
            )

        payload = {
            "run": run_payload,
            "leaderboard": leaderboard_payload,
        }
        return await self._post(payload)
