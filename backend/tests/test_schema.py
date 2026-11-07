from agent_builder import AgentConfig, Edge, Node
from agent_builder.schema import DEFAULT_MODEL, DEFAULT_VOICE_ID


def test_agent_config_uses_defaults_for_optional_fields():
    config = AgentConfig.from_dict(
        {"name": "Agent", "initial_node": "start", "nodes": [{"name": "start"}]}
    )

    assert config.persona == ""
    assert config.voice_id == DEFAULT_VOICE_ID
    assert config.model == DEFAULT_MODEL


def test_node_uses_defaults_for_optional_fields():
    node = Node.from_dict({"name": "start"})

    assert node.task_messages == []
    assert node.role_message is None
    assert node.edges == []
    assert node.pre_actions == []
    assert node.post_actions == []
    assert node.end is False


def test_node_parses_its_edges():
    node = Node.from_dict(
        {
            "name": "start",
            "edges": [{"function": "go", "description": "Move on.", "target": "end"}],
        }
    )

    assert node.edges == [Edge(function="go", description="Move on.", target="end")]


def test_edge_keeps_collected_fields():
    edge = Edge.from_dict(
        {
            "function": "record_name",
            "description": "Record the name.",
            "target": "next",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
        }
    )

    assert edge.properties == {"name": {"type": "string"}}
    assert edge.required == ["name"]
