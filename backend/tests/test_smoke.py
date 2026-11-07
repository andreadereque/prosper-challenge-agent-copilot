from pathlib import Path

from agent_builder import AgentBuilder

EXAMPLE_FLOW = Path(__file__).parent.parent / "example_flow.json"


def test_example_flow_loads():
    builder = AgentBuilder.from_json(EXAMPLE_FLOW)

    assert builder.config.name == "Prosper Scheduler"
    assert builder.config.initial_node == "greeting"
    assert [node.name for node in builder.config.nodes] == [
        "greeting",
        "collect_details",
        "offer_times",
        "confirm",
    ]
