from pathlib import Path

import pytest

import agent_store
import call_recorder
import issues_store


@pytest.fixture(autouse=True)
def agent_file(tmp_path, monkeypatch):
    """Point the agent store at a temporary file, so no test touches the real
    backend/agent.json."""
    path = tmp_path / "agent.json"
    monkeypatch.setattr(agent_store, "AGENT_PATH", path)
    return path


@pytest.fixture(autouse=True)
def calls_dir(tmp_path, monkeypatch):
    """Recorded calls go to a temporary folder, never to the real backend/calls."""
    path = tmp_path / "calls"
    monkeypatch.setattr(call_recorder, "CALLS_DIR", path)
    # Tests that want the made-up calls ask for the `mock_calls` fixture.
    monkeypatch.setattr(call_recorder, "MOCK_CALLS_DIR", tmp_path / "no_mock_calls")
    return path


@pytest.fixture
def mock_calls(monkeypatch):
    """Uses the made-up calls committed in backend/mock_calls."""
    monkeypatch.setattr(call_recorder, "MOCK_CALLS_DIR", Path(__file__).parent.parent / "mock_calls")


@pytest.fixture(autouse=True)
def issues_file(tmp_path, monkeypatch):
    path = tmp_path / "issues.json"
    monkeypatch.setattr(issues_store, "ISSUES_PATH", path)
    return path
