import pytest

import agent_store


@pytest.fixture(autouse=True)
def agent_file(tmp_path, monkeypatch):
    """Point the agent store at a temporary file, so no test touches the real
    backend/agent.json."""
    path = tmp_path / "agent.json"
    monkeypatch.setattr(agent_store, "AGENT_PATH", path)
    return path
