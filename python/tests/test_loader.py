"""Tests for data loading from shared JSON files."""

from pathlib import Path

import pytest

from saggiatore.data.loader import load_all, load_personas, load_scenarios, load_tools

# Resolve the data directory relative to the test file
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


@pytest.fixture
def data_dir():
    if not DATA_DIR.exists():
        pytest.skip("data/ directory not found — run from repo root")
    return DATA_DIR


def test_load_personas(data_dir):
    personas = load_personas(data_dir)
    assert len(personas) == 30
    assert personas[0].name == "Raj Patel"
    assert personas[0].visa_type == "H-1B"


def test_load_tools(data_dir):
    tools = load_tools(data_dir)
    assert len(tools) == 32
    assert tools[0].name == "check_visa_eligibility"
    assert tools[0].category == "eligibility"


def test_load_scenarios(data_dir):
    scenarios = load_scenarios(data_dir)
    assert len(scenarios) == 25
    assert scenarios[0].category == "visa_application"


def test_load_all_validates_references(data_dir):
    personas, tools, scenarios = load_all(data_dir)
    # All references should be valid
    for scenario in scenarios:
        assert 0 <= scenario.persona_index < len(personas)
        tool_names = {t.name for t in tools}
        for expected_tool in scenario.expected_tools:
            assert expected_tool in tool_names
