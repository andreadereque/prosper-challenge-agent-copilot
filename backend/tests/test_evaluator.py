import json

import pytest

import agent_store
import call_recorder
import evaluator
import issues_store
from tests.copilot.fake_openai import FakeOpenAI, says

ISSUE = {
    "title": "Cancellation offered new times",
    "severity": "high",
    "node": "collect_details",
    "turn_index": 5,
    "evidence": "I don't want a new time",
    "explanation": "The caller wanted to cancel.",
    "suggested_fix": "Add a cancellation path.",
}


@pytest.fixture
def cancel_call(mock_calls) -> dict:
    return call_recorder.load_call("mock-01-cancel-offered-times")


def answer(issues) -> FakeOpenAI:
    return FakeOpenAI(says(json.dumps({"issues": issues})))


def test_the_mock_calls_are_complete(mock_calls):
    calls = call_recorder.load_all_calls()

    assert len(calls) == 5
    node_names = {node["name"] for node in agent_store.load_agent()["nodes"]}
    for call in calls:
        assert call["source"] == "mock"
        assert {turn["node"] for turn in call["turns"]} <= node_names


async def test_returns_grounded_issues_linked_to_the_call(cancel_call):
    issues = await evaluator.evaluate_call(answer([ISSUE]), cancel_call, agent_store.load_agent())

    assert issues == [{"call_id": "mock-01-cancel-offered-times", "source": "evaluator", **ISSUE}]


async def test_sends_the_agent_and_a_numbered_transcript_with_nodes(cancel_call):
    client = answer([])

    await evaluator.evaluate_call(client, cancel_call, agent_store.load_agent())

    [request] = client.requests
    assert request["model"] == evaluator.EVALUATOR_MODEL
    assert request["temperature"] == 0
    assert request["response_format"] == {"type": "json_object"}
    review = request["messages"][1]["content"]
    assert "5. [offer_times] user: No, I don't want a new time. I want to cancel." in review
    assert '"initial_node": "greeting"' in review


@pytest.mark.parametrize(
    "made_up",
    [
        {**ISSUE, "node": "missing_node"},
        {**ISSUE, "evidence": "words nobody said"},
        {**ISSUE, "evidence": "   "},
    ],
    ids=["unknown node", "quote not in the call", "empty quote"],
)
async def test_drops_issues_it_cannot_ground(cancel_call, made_up):
    issues = await evaluator.evaluate_call(answer([made_up]), cancel_call, agent_store.load_agent())

    assert issues == []


async def test_fills_in_missing_optional_fields(cancel_call):
    bare = {"node": "offer_times", "evidence": "I want to cancel"}

    [issue] = await evaluator.evaluate_call(answer([bare]), cancel_call, agent_store.load_agent())

    assert issue["title"] == "Untitled issue"
    assert issue["severity"] == "medium"
    assert issue["turn_index"] is None


@pytest.mark.parametrize("content", ["not json", "null", "[]"])
async def test_an_unreadable_answer_is_an_error(cancel_call, content):
    with pytest.raises(evaluator.EvaluationError):
        await evaluator.evaluate_call(FakeOpenAI(says(content)), cancel_call, agent_store.load_agent())


def test_a_new_evaluation_replaces_the_old_one_but_keeps_client_issues():
    issues_store.replace_evaluator_issues([{"source": "evaluator", "title": "Old"}])
    client_issue = issues_store.add_client_issue("Caller was cut off", "It hung up.", None)

    issues = issues_store.replace_evaluator_issues([{"source": "evaluator", "title": "New"}])

    assert [issue["title"] for issue in issues] == ["Caller was cut off", "New"]
    assert issues[0] == client_issue
    assert issues[1]["status"] == "open"
    assert issues_store.load_issues() == issues


def test_there_are_no_issues_before_the_first_evaluation():
    assert issues_store.load_issues() == []


async def test_an_empty_object_means_no_issues(cancel_call):
    issues = await evaluator.evaluate_call(FakeOpenAI(says("{}")), cancel_call, agent_store.load_agent())

    assert issues == []


async def test_a_speaker_label_in_the_quote_is_removed(cancel_call):
    labelled = {**ISSUE, "evidence": "user: No, I don't want a new time."}

    [issue] = await evaluator.evaluate_call(answer([labelled]), cancel_call, agent_store.load_agent())

    assert issue["evidence"] == "No, I don't want a new time."
