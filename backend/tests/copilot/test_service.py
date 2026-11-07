import json
from pathlib import Path

import pytest

from copilot import service
from copilot.prompts import build_system_prompt
from copilot.tools import NO_CHANGE, TOOLS, apply_tool_call
from tests.copilot.fake_openai import FakeOpenAI, calls, says, tool

EXAMPLE_FLOW = Path(__file__).parent.parent.parent / "example_flow.json"


@pytest.fixture
def agent() -> dict:
    agent = json.loads(EXAMPLE_FLOW.read_text())
    agent["nodes"][0]["position"] = {"x": 0, "y": 0}
    return agent


def ask(text: str) -> list:
    return [{"role": "user", "content": text}]


async def test_applies_tool_calls_and_returns_a_proposal(agent):
    client = FakeOpenAI(
        calls(tool("edit_node", name="confirm", instructions="Confirm, then say goodbye.")),
        says("I made the goodbye explicit."),
    )

    result = await service.run_copilot(client, ask("Say goodbye at the end."), agent)

    assert result.reply == "I made the goodbye explicit."
    assert result.errors == []
    assert result.operations == [
        {"tool": "edit_node", "arguments": {"name": "confirm", "instructions": "Confirm, then say goodbye."}}
    ]
    assert result.proposed_agent["nodes"][3]["task_messages"][0]["content"] == "Confirm, then say goodbye."


async def test_never_changes_the_agent_it_receives(agent):
    before = json.dumps(agent)
    client = FakeOpenAI(
        calls(tool("edit_edge", from_node="greeting", tool="choose_intent", description="Changed.")),
        says("Done."),
    )

    await service.run_copilot(client, ask("Remove it."), agent)

    assert json.dumps(agent) == before


async def test_sends_the_agent_tools_and_chat_to_the_model(agent):
    client = FakeOpenAI(says("Nothing to change."))

    await service.run_copilot(client, ask("Hello"), agent)

    [request] = client.requests
    assert request["model"] == service.MODEL
    assert request["temperature"] == service.TEMPERATURE
    assert request["tools"] == TOOLS
    assert request["messages"][0] == {"role": "system", "content": build_system_prompt(agent)}
    assert request["messages"][1] == {"role": "user", "content": "Hello"}


async def test_returns_tool_errors_to_the_model_and_skips_them(agent):
    client = FakeOpenAI(
        calls(tool("delete_node", name="missing", call_id="call_7")),
        says("That node does not exist."),
    )

    result = await service.run_copilot(client, ask("Delete it."), agent)

    tool_result = client.requests[1]["messages"][-1]
    assert tool_result["role"] == "tool"
    assert tool_result["tool_call_id"] == "call_7"
    assert tool_result["content"].startswith("Error: There is no node named 'missing'")
    assert result.operations == []


async def test_asks_the_model_to_fix_an_invalid_proposal(agent):
    client = FakeOpenAI(
        calls(tool("add_node", name="orphan", instructions="Lost.", end=True)),
        says("Added it."),
        calls(tool("delete_node", name="orphan")),
        says("Removed the unreachable node."),
    )

    result = await service.run_copilot(client, ask("Add a step."), agent)

    repair_request = client.requests[2]["messages"][-1]
    assert repair_request["role"] == "user"
    assert "- Node 'orphan' cannot be reached from the initial node." in repair_request["content"]
    assert result.errors == []
    assert result.reply == "Removed the unreachable node."


async def test_gives_up_repairing_and_reports_the_errors(agent, monkeypatch):
    monkeypatch.setattr(service, "MAX_REPAIRS", 1)
    client = FakeOpenAI(
        calls(tool("add_node", name="orphan", instructions="Lost.", end=True)),
        says("Added it."),
        says("I could not fix it."),
    )

    result = await service.run_copilot(client, ask("Add a step."), agent)

    assert result.reply == "I could not fix it."
    assert result.errors == ["Node 'orphan' cannot be reached from the initial node."]


async def test_stops_after_too_many_steps(agent, monkeypatch):
    monkeypatch.setattr(service, "MAX_STEPS", 2)
    client = FakeOpenAI(
        calls(tool("set_agent_fields", name="One")),
        calls(tool("set_agent_fields", name="Two")),
    )

    result = await service.run_copilot(client, ask("Rename it."), agent)

    assert result.reply.startswith("I stopped before finishing")
    assert result.proposed_agent["name"] == "Two"
    assert len(result.operations) == 2


async def test_an_empty_reply_becomes_an_empty_string(agent):
    result = await service.run_copilot(FakeOpenAI(says(None)), ask("Hi"), agent)

    assert result.reply == ""


def test_the_prompt_leaves_out_canvas_positions(agent):
    prompt = build_system_prompt(agent)

    assert "Healthcare safety" in prompt
    assert '"initial_node": "greeting"' in prompt
    assert "position" not in prompt


@pytest.mark.parametrize(
    ("name", "arguments", "expected"),
    [
        ("unknown_tool", "{}", "Error: unknown tool 'unknown_tool'."),
        ("add_node", "not json", "Error: the arguments were not valid JSON."),
        ("add_node", '{"surprise": 1}', "Error: wrong arguments for add_node:"),
    ],
)
def test_bad_tool_calls_become_messages_for_the_model(agent, name, arguments, expected):
    assert apply_tool_call(agent, name, arguments).startswith(expected)


async def test_questions_end_the_turn_without_changing_the_agent(agent):
    client = FakeOpenAI(
        calls(
            tool("set_agent_fields", name="Half done", call_id="call_1"),
            tool(
                "ask_clarifying_questions",
                call_id="call_2",
                questions=["Where should callers be transferred?", "Which slots can be offered?"],
            ),
        )
    )

    result = await service.run_copilot(client, ask("Build the agent from these guidelines."), agent)

    assert result.questions == ["Where should callers be transferred?", "Which slots can be offered?"]
    assert result.proposed_agent == agent
    assert result.operations == []
    assert len(client.requests) == 1


async def test_an_empty_question_list_is_not_a_question(agent):
    client = FakeOpenAI(
        calls(tool("ask_clarifying_questions")),
        says("Never mind."),
    )

    result = await service.run_copilot(client, ask("Hi"), agent)

    assert result.questions == []
    assert result.reply == "Never mind."


def test_the_prompt_explains_how_to_build_from_guidelines(agent):
    prompt = build_system_prompt(agent)

    assert "client's guidelines" in prompt
    assert "ask_clarifying_questions" in prompt


async def test_after_each_step_the_model_sees_what_is_still_broken(agent):
    client = FakeOpenAI(
        calls(tool("add_node", name="orphan", instructions="Lost.", end=True)),
        calls(tool("add_edge", from_node="greeting", tool="lost", description="Lost.", to_node="orphan")),
        says("Added and connected."),
    )

    result = await service.run_copilot(client, ask("Add a step."), agent)

    after_first_step = client.requests[1]["messages"][-1]["content"]
    after_second_step = client.requests[2]["messages"][-1]["content"]
    assert "still has these problems" in after_first_step
    assert "- Node 'orphan' cannot be reached from the initial node." in after_first_step
    assert after_second_step == "Done."
    assert result.errors == []


def test_an_edit_that_changes_nothing_says_so(agent):
    unchanged = json.dumps({"from_node": "greeting", "tool": "choose_intent", "new_tool": "choose_intent"})

    assert apply_tool_call(agent, "edit_edge", unchanged) == NO_CHANGE
