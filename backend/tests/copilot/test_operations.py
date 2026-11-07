import json
from pathlib import Path

import pytest

from copilot import operations
from copilot.operations import OperationError

EXAMPLE_FLOW = Path(__file__).parent.parent.parent / "example_flow.json"


@pytest.fixture
def agent() -> dict:
    return json.loads(EXAMPLE_FLOW.read_text())


def node(agent: dict, name: str) -> dict:
    return next(node for node in agent["nodes"] if node["name"] == name)


def test_add_node(agent):
    operations.add_node(agent, "transfer", "Tell the caller you are transferring them.", end=True)

    assert node(agent, "transfer") == {
        "name": "transfer",
        "task_messages": [{"role": "developer", "content": "Tell the caller you are transferring them."}],
        "end": True,
    }


def test_add_node_without_end(agent):
    operations.add_node(agent, "triage", "Ask about symptoms.")

    assert "end" not in node(agent, "triage")


def test_add_node_rejects_a_duplicate(agent):
    with pytest.raises(OperationError, match="already exists"):
        operations.add_node(agent, "greeting", "Hello.")


def test_edit_node_changes_only_what_is_passed(agent):
    operations.edit_node(agent, "confirm", instructions="Confirm and say goodbye.", end=False)

    edited = node(agent, "confirm")
    assert edited["task_messages"] == [{"role": "developer", "content": "Confirm and say goodbye."}]
    assert edited["end"] is False


def test_edit_node_sets_and_removes_a_role_message(agent):
    operations.edit_node(agent, "greeting", role_message="You are a nurse.")
    assert node(agent, "greeting")["role_message"] == "You are a nurse."

    operations.edit_node(agent, "greeting", role_message="")
    assert node(agent, "greeting")["role_message"] is None


def test_edit_node_renames_and_updates_references(agent):
    operations.edit_node(agent, "greeting", new_name="welcome")
    operations.edit_node(agent, "offer_times", new_name="offer_slots")

    assert agent["initial_node"] == "welcome"
    assert node(agent, "collect_details")["edges"][0]["target"] == "offer_slots"


def test_edit_node_keeping_the_same_name_is_fine(agent):
    operations.edit_node(agent, "greeting", new_name="greeting")

    assert agent["initial_node"] == "greeting"


def test_edit_node_rejects_a_taken_name(agent):
    with pytest.raises(OperationError, match="'confirm' already exists"):
        operations.edit_node(agent, "greeting", new_name="confirm")


def test_edit_node_rejects_an_unknown_node(agent):
    with pytest.raises(OperationError, match="no node named 'missing'. Nodes: greeting"):
        operations.edit_node(agent, "missing", instructions="Hi.")


def test_delete_node_removes_edges_into_it(agent):
    operations.delete_node(agent, "offer_times")

    assert [n["name"] for n in agent["nodes"]] == ["greeting", "collect_details", "confirm"]
    assert node(agent, "collect_details")["edges"] == []


def test_delete_node_refuses_the_initial_node(agent):
    with pytest.raises(OperationError, match="initial node"):
        operations.delete_node(agent, "greeting")


def test_add_edge_with_collected_fields(agent):
    operations.add_edge(
        agent,
        "collect_details",
        "report_emergency",
        "Call if the caller describes an emergency.",
        "confirm",
        fields=[
            {"name": "symptom", "description": "What they describe."},
            {"name": "severity", "type": "string", "allowed_values": ["high", "low"], "required": False},
        ],
    )

    edge = node(agent, "collect_details")["edges"][-1]
    assert edge == {
        "function": "report_emergency",
        "description": "Call if the caller describes an emergency.",
        "target": "confirm",
        "properties": {
            "symptom": {"type": "string", "description": "What they describe."},
            "severity": {"type": "string", "enum": ["high", "low"]},
        },
        "required": ["symptom"],
    }


def test_add_edge_to_a_node_without_edges(agent):
    operations.add_edge(agent, "confirm", "start_over", "Call to start again.", "greeting")

    assert node(agent, "confirm")["edges"][0]["properties"] == {}


def test_add_edge_rejects_a_duplicate_tool(agent):
    with pytest.raises(OperationError, match="already has an edge named 'choose_intent'"):
        operations.add_edge(agent, "greeting", "choose_intent", "Again.", "confirm")


def test_add_edge_rejects_an_unknown_target(agent):
    with pytest.raises(OperationError, match="no node named 'missing'"):
        operations.add_edge(agent, "greeting", "go", "Go.", "missing")


def test_edit_edge(agent):
    operations.edit_edge(
        agent,
        "greeting",
        "choose_intent",
        description="Call once the intent is clear.",
        to_node="confirm",
        fields=[{"name": "intent"}],
        new_tool="record_intent",
    )

    assert node(agent, "greeting")["edges"][0] == {
        "function": "record_intent",
        "description": "Call once the intent is clear.",
        "target": "confirm",
        "properties": {"intent": {"type": "string"}},
        "required": ["intent"],
    }


def test_edit_edge_with_nothing_to_change(agent):
    before = json.dumps(agent)

    operations.edit_edge(agent, "greeting", "choose_intent", new_tool="choose_intent")

    assert json.dumps(agent) == before


def test_edit_edge_rejects_an_unknown_edge(agent):
    with pytest.raises(OperationError, match="no edge named 'missing'"):
        operations.edit_edge(agent, "greeting", "missing", description="x")


def test_edit_edge_rejects_a_taken_tool_name(agent):
    operations.add_edge(agent, "greeting", "transfer", "Transfer.", "confirm")

    with pytest.raises(OperationError, match="already has an edge named 'transfer'"):
        operations.edit_edge(agent, "greeting", "choose_intent", new_tool="transfer")


def test_delete_edge(agent):
    operations.delete_edge(agent, "greeting", "choose_intent")

    assert node(agent, "greeting")["edges"] == []


def test_delete_edge_rejects_an_unknown_edge(agent):
    with pytest.raises(OperationError, match="no edge named 'missing'"):
        operations.delete_edge(agent, "greeting", "missing")


def test_set_agent_fields(agent):
    operations.set_agent_fields(agent, name="Front desk", persona="Be brief.", initial_node="confirm")

    assert (agent["name"], agent["persona"], agent["initial_node"]) == ("Front desk", "Be brief.", "confirm")


def test_set_agent_fields_with_nothing_to_change(agent):
    operations.set_agent_fields(agent)

    assert agent["name"] == "Prosper Scheduler"


def test_build_agent_replaces_the_whole_graph(agent):
    operations.build_agent(
        agent,
        name="Northside",
        persona="Be warm.",
        initial_node="hello",
        nodes=[
            {
                "name": "hello",
                "instructions": "Greet the caller.",
                "edges": [
                    {"tool": "done", "description": "When finished.", "to_node": "bye", "fields": [{"name": "reason"}]}
                ],
            },
            {"name": "bye", "instructions": "Say goodbye.", "end": True},
        ],
    )

    assert agent == {
        **agent,
        "name": "Northside",
        "persona": "Be warm.",
        "initial_node": "hello",
        "nodes": [
            {
                "name": "hello",
                "task_messages": [{"role": "developer", "content": "Greet the caller."}],
                "edges": [
                    {
                        "function": "done",
                        "description": "When finished.",
                        "target": "bye",
                        "properties": {"reason": {"type": "string"}},
                        "required": ["reason"],
                    }
                ],
            },
            {
                "name": "bye",
                "task_messages": [{"role": "developer", "content": "Say goodbye."}],
                "end": True,
                "edges": [],
            },
        ],
    }
