import json

import pytest

import agent_store
from agent_builder import AgentValidationError


def valid_agent(name="Saved agent") -> dict:
    return {
        "name": name,
        "initial_node": "start",
        "nodes": [{"name": "start", "end": True, "position": {"x": 10, "y": 20}}],
    }


def test_the_first_read_copies_the_example(agent_file):
    agent = agent_store.load_agent()

    assert agent["name"] == "Prosper Scheduler"
    assert agent_file.read_text() == agent_store.EXAMPLE_AGENT.read_text()


def test_an_existing_agent_is_not_overwritten(agent_file):
    agent_file.write_text(json.dumps(valid_agent()))

    assert agent_store.load_agent()["name"] == "Saved agent"


def test_saving_replaces_the_agent(agent_file):
    agent_store.save_agent(valid_agent("New version"))

    assert agent_store.load_agent()["name"] == "New version"
    assert not agent_file.with_suffix(".tmp").exists()


def test_saving_keeps_fields_the_runtime_ignores():
    agent_store.save_agent(valid_agent())

    assert agent_store.load_agent()["nodes"][0]["position"] == {"x": 10, "y": 20}


def test_an_invalid_agent_is_not_saved(agent_file):
    agent_store.save_agent(valid_agent("Good version"))
    broken = valid_agent("Broken version")
    broken["initial_node"] = "missing"

    with pytest.raises(AgentValidationError):
        agent_store.save_agent(broken)

    assert agent_store.load_agent()["name"] == "Good version"
