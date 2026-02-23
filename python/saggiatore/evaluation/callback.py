"""Galileo callback for automatic LangChain tracing.

When Galileo is configured, this provides a GalileoCallback that auto-captures
LLM invocations, tool calls, and traces during AgentExecutor runs.
"""

from __future__ import annotations

import logging
import os

from ..config import get_settings

logger = logging.getLogger(__name__)


def get_galileo_callback():
    """Get a Galileo LangChain callback if configured, otherwise None.

    Returns the GalileoCallback from galileo.handlers.langchain, which
    automatically traces agent behavior in Galileo.
    """
    settings = get_settings()

    if not settings.galileo_api_key:
        return None

    try:
        os.environ["GALILEO_API_KEY"] = settings.galileo_api_key

        from galileo import galileo_context
        from galileo.handlers.langchain import GalileoCallback

        # The callback auto-traces within a galileo_context
        callback = GalileoCallback()
        logger.info("Galileo callback initialized for automatic tracing")
        return callback

    except ImportError:
        logger.warning(
            "Galileo LangChain handler not available. "
            "Install with: pip install 'galileo[langchain]'"
        )
        return None
    except Exception as e:
        logger.warning("Failed to initialize Galileo callback: %s", str(e))
        return None


def get_galileo_context():
    """Get a galileo_context manager for wrapping evaluation runs.

    Usage:
        ctx = get_galileo_context()
        if ctx:
            with ctx:
                # run evaluation
        else:
            # run without Galileo
    """
    settings = get_settings()

    if not settings.galileo_api_key:
        return None

    try:
        os.environ["GALILEO_API_KEY"] = settings.galileo_api_key

        from galileo import galileo_context

        return galileo_context(
            project=settings.galileo_project,
            log_stream=settings.galileo_log_stream,
        )
    except ImportError:
        return None
    except Exception as e:
        logger.warning("Failed to create Galileo context: %s", str(e))
        return None
