import json
from pathlib import Path

import pytest

import simulator
from agent_builder import AgentValidationError
from tests.copilot.fake_openai import FakeOpenAI, calls, says, tool

EXAMPLE_FLOW = Path(__file__).parent.parent / "example_flow.json"


@pytest.fixture
def agent() -> dict:
    return json.loads(EXAMPLE_FLOW.read_text())


async def test_the_agent_moves_through_nodes_by_calling_edges(agent):
    client = FakeOpenAI(
        says("Hi, would you like to book, reschedule or cancel?"),  # agent, greeting
        says("I want to cancel."),  # patient
        calls(tool("choose_intent", intent="cancel")),  # agent leaves greeting
        says("Sure, what is your full name?"),  # agent, collect_details
        says("Maria Lopez. Bye. [END]"),  # patient hangs up
    )

    call = await simulator.simulate(client, agent, "You want to cancel.")

    assert call["path"] == ["greeting", "collect_details"]
    assert call["ended_by"] == "patient"
    assert call["turns"] == [
        {"role": "assistant", "text": "Hi, would you like to book, reschedule or cancel?", "node": "greeting"},
        {"role": "user", "text": "I want to cancel.", "node": "greeting"},
        {"role": "assistant", "text": "Sure, what is your full name?", "node": "collect_details"},
        {"role": "user", "text": "Maria Lopez. Bye.", "node": "collect_details"},
    ]


async def test_the_agent_sees_its_persona_its_step_and_only_its_edges(agent):
    client = FakeOpenAI(says("Hello."), says("Bye [END]"))

    await simulator.simulate(client, agent, "You just say hello.")

    agent_request, patient_request = client.requests
    assert agent_request["messages"][0] == {"role": "system", "content": agent["persona"]}
    assert agent_request["messages"][1]["content"].startswith("Current step: greeting. Greet the caller")
    assert [t["function"]["name"] for t in agent_request["tools"]] == ["choose_intent"]
    assert "You just say hello." in patient_request["messages"][0]["content"]
    assert patient_request["messages"][1] == {"role": "user", "content": "Hello."}


async def test_a_role_message_replaces_the_persona(agent):
    agent["nodes"][0]["role_message"] = "You are a triage nurse."
    client = FakeOpenAI(says("Hello."), says("Bye [END]"))

    await simulator.simulate(client, agent, "Say hello.")

    assert client.requests[0]["messages"][0]["content"] == "You are a triage nurse."


async def test_reaching_an_end_node_finishes_the_call(agent):
    agent["initial_node"] = "confirm"
    agent["nodes"] = [node for node in agent["nodes"] if node["name"] == "confirm"]
    client = FakeOpenAI(says("You are booked. Goodbye."))

    call = await simulator.simulate(client, agent, "Anything.")

    assert call["ended_by"] == "agent"
    assert "tools" not in client.requests[0]


async def test_stops_after_the_turn_limit(agent, monkeypatch):
    monkeypatch.setattr(simulator, "MAX_TURNS", 1)
    client = FakeOpenAI(says("Hello."), says("Hmm, let me think."))

    call = await simulator.simulate(client, agent, "You never decide.")

    assert call["ended_by"] == "turn_limit"
    assert len(call["turns"]) == 2


async def test_an_agent_that_keeps_moving_gives_the_turn_to_the_patient(agent, monkeypatch):
    monkeypatch.setattr(simulator, "MAX_HOPS_PER_TURN", 1)
    client = FakeOpenAI(calls(tool("choose_intent", intent="book")), says("Hello? [END]"))

    call = await simulator.simulate(client, agent, "Wait for the agent.")

    assert call["path"] == ["greeting", "collect_details"]
    assert call["turns"] == [{"role": "user", "text": "Hello?", "node": "collect_details"}]


async def test_a_call_to_a_tool_the_node_does_not_have_is_ignored(agent):
    client = FakeOpenAI(calls(tool("made_up_tool")), says("Bye [END]"))

    call = await simulator.simulate(client, agent, "Anything.")

    assert call["path"] == ["greeting"]
    assert call["turns"][0] == {"role": "assistant", "text": "", "node": "greeting"}


async def test_an_empty_patient_reply_is_kept_as_empty_text(agent, monkeypatch):
    monkeypatch.setattr(simulator, "MAX_TURNS", 1)
    client = FakeOpenAI(says("Hello."), says(None))

    call = await simulator.simulate(client, agent, "Silent caller.")

    assert call["turns"][1]["text"] == ""


async def test_an_invalid_agent_is_not_simulated(agent):
    agent["initial_node"] = "missing"

    with pytest.raises(AgentValidationError):
        await simulator.simulate(FakeOpenAI(), agent, "Anything.")
