"""Tests for metric computation — ensures parity with JS implementation."""

from saggiatore.evaluation.metrics import (
    compute_overall_score,
    generate_failure_analysis,
    map_galileo_scores,
)
from saggiatore.models import EvalMetrics


def test_compute_overall_score_weights():
    """Test that overall score uses correct weights matching JS."""
    metrics = EvalMetrics(
        tool_accuracy=0.8,
        empathy=0.7,
        factual_correctness=0.9,
        completeness=0.85,
        safety_compliance=0.95,
    )
    # Expected: 0.8*0.25 + 0.9*0.25 + 0.85*0.20 + 0.7*0.15 + 0.95*0.15
    # = 0.20 + 0.225 + 0.17 + 0.105 + 0.1425 = 0.8425
    expected = round(0.8 * 0.25 + 0.9 * 0.25 + 0.85 * 0.20 + 0.7 * 0.15 + 0.95 * 0.15, 3)
    assert compute_overall_score(metrics) == expected


def test_map_galileo_scores_full():
    """Test mapping with all Galileo scorers present."""
    raw = {
        "toolSelectionQuality": 0.85,
        "toolErrorRate": 0.1,
        "correctness": 0.9,
        "empathy": 0.75,
        "completenessGpt": 0.8,
        "toxicityGpt": 0.05,
        "outputPiiGpt": 0.0,
        "promptInjectionGpt": 0.02,
    }
    metrics = map_galileo_scores(raw)

    # Tool accuracy = (0.85 + (1 - 0.1)) / 2 = (0.85 + 0.9) / 2 = 0.875
    assert abs(metrics.tool_accuracy - 0.875) < 0.001
    assert abs(metrics.factual_correctness - 0.9) < 0.001
    assert abs(metrics.empathy - 0.75) < 0.001
    assert abs(metrics.completeness - 0.8) < 0.001
    # Safety = 1 - (0.05 + 0.0 + 0.02) / 3 = 1 - 0.0233... ≈ 0.9767
    assert metrics.safety_compliance > 0.97


def test_map_galileo_scores_fallbacks():
    """Test that missing scores use sensible fallbacks."""
    metrics = map_galileo_scores({})
    # Defaults from the JS implementation
    assert abs(metrics.tool_accuracy - 0.825) < 0.001  # (0.75 + 0.9) / 2
    assert abs(metrics.factual_correctness - 0.7) < 0.001
    assert metrics.safety_compliance > 0.95


def test_failure_analysis_low_scores():
    """Test that scores below 0.5 generate failure analysis."""
    metrics = EvalMetrics(
        tool_accuracy=0.3,
        empathy=0.8,
        factual_correctness=0.4,
        completeness=0.6,
        safety_compliance=0.2,
    )
    analysis = generate_failure_analysis(metrics)
    assert len(analysis) == 3  # tool_accuracy, factual_correctness, safety_compliance
    assert any("tool accuracy" in a.lower() for a in analysis)
    assert any("factual" in a.lower() for a in analysis)
    assert any("safety" in a.lower() for a in analysis)


def test_failure_analysis_good_scores():
    """Test that good scores produce no failure analysis."""
    metrics = EvalMetrics(
        tool_accuracy=0.8,
        empathy=0.7,
        factual_correctness=0.9,
        completeness=0.85,
        safety_compliance=0.95,
    )
    analysis = generate_failure_analysis(metrics)
    assert len(analysis) == 0
