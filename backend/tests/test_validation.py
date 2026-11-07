from pathlib import Path

import pytest

from agent_builder import AgentBuilder, AgentValidationError

EXAMPLE_FLOW = Path(__file__).parent.parent / "example_flow.json"


def make_agent() -> dict:
    """A valid agent: `start` -> `done`, collecting the caller's name."""
    return {
        "name": "Test agent",
        "initial_node": "start",
        "nodes": [
            {
                "name": "start",
                "edges": [
                    {
                        "function": "record_name",
                        "description": "Record the caller's name.",
                        "target": "done",
                        "properties": {"name": {"type": "string"}},
                        "required": ["name"],
                    }
                ],
            },
            {"name": "done", "end": True},
        ],
    }


def errors_for(agent: dict) -> list[str]:
    with pytest.raises(AgentValidationError) as raised:
        AgentBuilder.from_dict(agent)
    return raised.value.errors


def test_a_valid_agent_has_no_errors():
    AgentBuilder.from_dict(make_agent())


def test_the_example_agent_is_valid():
    AgentBuilder.from_json(EXAMPLE_FLOW)


def test_a_graph_with_a_loop_is_valid():
    agent = make_agent()
    agent["nodes"][1]["edges"] = [
        {"function": "start_over", "description": "Start again.", "target": "start"}
    ]

    AgentBuilder.from_dict(agent)


def test_rejects_duplicate_node_names():
    agent = make_agent()
    agent["nodes"].append({"name": "done", "end": True})

    assert "Node name 'done' is used more than once." in errors_for(agent)


def test_rejects_duplicate_tools_in_a_node():
    agent = make_agent()
    edges = agent["nodes"][0]["edges"]
    edges.append(dict(edges[0]))

    assert "Node 'start' has more than one edge named 'record_name'." in errors_for(agent)


def test_rejects_a_dead_end_that_is_not_an_end_node():
    agent = make_agent()
    agent["nodes"][1]["end"] = False

    assert errors_for(agent) == [
        "Node 'done' has no edges and is not an end node, so the call would get stuck there."
    ]


def test_rejects_an_unreachable_node():
    agent = make_agent()
    agent["nodes"].append({"name": "orphan", "end": True})

    assert errors_for(agent) == ["Node 'orphan' cannot be reached from the initial node."]


def test_rejects_a_required_field_that_is_not_a_property():
    agent = make_agent()
    agent["nodes"][0]["edges"][0]["required"] = ["name", "birth_date"]

    assert errors_for(agent) == [
        "Edge 'record_name' in node 'start' requires 'birth_date', "
        "which is not one of its properties."
    ]


def test_an_unknown_initial_node_skips_the_reachability_check():
    agent = make_agent()
    agent["initial_node"] = "missing"

    assert errors_for(agent) == ["initial_node 'missing' is not a defined node."]


def test_reports_every_problem_at_once():
    agent = make_agent()
    agent["nodes"][0]["edges"][0]["target"] = "missing"
    agent["nodes"].append({"name": "orphan"})

    assert errors_for(agent) == [
        "Edge 'record_name' in node 'start' targets unknown node 'missing'.",
        "Node 'orphan' has no edges and is not an end node, so the call would get stuck there.",
        "Node 'done' cannot be reached from the initial node.",
        "Node 'orphan' cannot be reached from the initial node.",
    ]


def test_the_error_message_joins_every_problem():
    agent = make_agent()
    agent["nodes"].append({"name": "orphan", "end": True})

    with pytest.raises(AgentValidationError, match="'orphan' cannot be reached"):
        AgentBuilder.from_dict(agent)


def test_a_missing_field_is_a_validation_error():
    agent = make_agent()
    del agent["initial_node"]

    assert errors_for(agent) == ["Missing required field 'initial_node'."]


@pytest.mark.parametrize(
    "agent",
    [
        {"name": "A", "initial_node": "start", "nodes": 5},
        {"name": "A", "initial_node": "start", "nodes": [["not", "a", "node"]]},
    ],
    ids=["nodes is not a list", "node is not an object"],
)
def test_a_malformed_agent_is_a_validation_error(agent):
    [error] = errors_for(agent)

    assert error.startswith("Malformed agent:")
