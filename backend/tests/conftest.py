import pytest

import agent_store
import call_recorder


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
    return path
