from types import SimpleNamespace

import pytest

from agent_builder import AgentBuilder


def make_agent(**overrides) -> dict:
    """A minimal valid agent: `start` -> `done`, collecting the caller's name."""
    agent = {
        "name": "Test agent",
        "persona": "You are a scheduling assistant.",
        "initial_node": "start",
        "nodes": [
            {
                "name": "start",
                "task_messages": [{"role": "developer", "content": "Ask for the name."}],
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
    agent.update(overrides)
    return agent


def test_from_json_reads_the_file(tmp_path):
    path = tmp_path / "agent.json"
    path.write_text(
        '{"name": "A", "initial_node": "start", "nodes": [{"name": "start", "end": true}]}'
    )

    builder = AgentBuilder.from_json(path)

    assert builder.config.name == "A"


def test_rejects_an_agent_without_nodes():
    with pytest.raises(ValueError, match="no nodes"):
        AgentBuilder.from_dict(make_agent(nodes=[]))


def test_rejects_an_unknown_initial_node():
    with pytest.raises(ValueError, match="initial_node 'missing'"):
        AgentBuilder.from_dict(make_agent(initial_node="missing"))


def test_rejects_an_edge_to_an_unknown_node():
    agent = make_agent()
    agent["nodes"][0]["edges"][0]["target"] = "missing"

    with pytest.raises(ValueError, match="targets unknown node 'missing'"):
        AgentBuilder.from_dict(agent)


def test_initial_node_carries_instructions_and_persona():
    node = AgentBuilder.from_dict(make_agent()).build_initial_node()

    assert node["name"] == "start"
    assert node["role_message"] == "You are a scheduling assistant."
    assert node["task_messages"] == [{"role": "developer", "content": "Ask for the name."}]
    assert "pre_actions" not in node
    assert "post_actions" not in node


def test_role_message_replaces_the_persona():
    agent = make_agent()
    agent["nodes"][0]["role_message"] = "You are a triage nurse."

    node = AgentBuilder.from_dict(agent).build_initial_node()

    assert node["role_message"] == "You are a triage nurse."


def test_each_edge_becomes_a_tool():
    node = AgentBuilder.from_dict(make_agent()).build_initial_node()

    [tool] = node["functions"]
    assert tool.name == "record_name"
    assert tool.description == "Record the caller's name."
    assert tool.properties == {"name": {"type": "string"}}
    assert tool.required == ["name"]


def test_node_actions_are_passed_through():
    agent = make_agent()
    agent["nodes"][0]["pre_actions"] = [{"type": "tts_say", "text": "Hello"}]
    agent["nodes"][0]["post_actions"] = [{"type": "tts_say", "text": "Bye"}]

    node = AgentBuilder.from_dict(agent).build_initial_node()

    assert node["pre_actions"] == [{"type": "tts_say", "text": "Hello"}]
    assert node["post_actions"] == [{"type": "tts_say", "text": "Bye"}]


async def test_calling_a_tool_stores_the_data_and_moves_to_the_target():
    node = AgentBuilder.from_dict(make_agent()).build_initial_node()
    [tool] = node["functions"]
    flow_manager = SimpleNamespace(state={})

    result, next_node = await tool.handler({"name": "Ana"}, flow_manager)

    assert flow_manager.state == {"name": "Ana"}
    assert result == {"status": "success", "name": "Ana"}
    assert next_node["name"] == "done"


async def test_an_end_node_ends_the_call():
    node = AgentBuilder.from_dict(make_agent()).build_initial_node()
    [tool] = node["functions"]

    _, next_node = await tool.handler({"name": "Ana"}, SimpleNamespace(state={}))

    assert next_node["functions"] == []
    assert next_node["post_actions"] == [{"type": "end_conversation"}]


def test_an_end_node_with_its_own_post_actions_still_ends_the_call():
    agent = make_agent(initial_node="done")
    agent["nodes"] = [
        {"name": "done", "end": True, "post_actions": [{"type": "tts_say", "text": "Bye"}]}
    ]

    node = AgentBuilder.from_dict(agent).build_initial_node()

    assert node["post_actions"] == [
        {"type": "tts_say", "text": "Bye"},
        {"type": "end_conversation"},
    ]


def test_an_explicit_end_conversation_is_not_repeated():
    agent = make_agent(initial_node="done")
    agent["nodes"] = [
        {"name": "done", "end": True, "post_actions": [{"type": "end_conversation"}]}
    ]

    node = AgentBuilder.from_dict(agent).build_initial_node()

    assert node["post_actions"] == [{"type": "end_conversation"}]
