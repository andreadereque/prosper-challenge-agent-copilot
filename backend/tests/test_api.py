import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import agent_store
from api import router


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def valid_agent(name="Edited agent") -> dict:
    return {
        "name": name,
        "initial_node": "start",
        "nodes": [{"name": "start", "end": True, "position": {"x": 0, "y": 0}}],
    }


def test_get_returns_the_active_agent(client):
    response = client.get("/api/agent")

    assert response.status_code == 200
    assert response.json()["name"] == "Prosper Scheduler"


def test_put_saves_a_valid_agent(client):
    response = client.put("/api/agent", json=valid_agent())

    assert response.status_code == 200
    assert response.json() == valid_agent()
    assert agent_store.load_agent() == valid_agent()


def test_put_rejects_an_invalid_agent_with_every_error(client):
    broken = valid_agent()
    broken["nodes"].append({"name": "orphan"})

    response = client.put("/api/agent", json=broken)

    assert response.status_code == 422
    assert response.json() == {
        "errors": [
            "Node 'orphan' has no edges and is not an end node, so the call would get stuck there.",
            "Node 'orphan' cannot be reached from the initial node.",
        ]
    }
    assert agent_store.load_agent()["name"] == "Prosper Scheduler"


def test_put_rejects_a_body_that_is_not_an_object(client):
    response = client.put("/api/agent", json=["not", "an", "agent"])

    assert response.status_code == 422


# ---- Copilot -------------------------------------------------------------------

from openai import APIConnectionError  # noqa: E402

from api import get_openai_client  # noqa: E402
from tests.copilot.fake_openai import FakeOpenAI, says  # noqa: E402


def copilot_client(fake) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_openai_client] = lambda: fake
    return TestClient(app)


def test_copilot_returns_a_proposal_without_saving_it():
    agent = agent_store.load_agent()
    client = copilot_client(FakeOpenAI(says("Nothing to change.")))

    response = client.post(
        "/api/copilot", json={"messages": [{"role": "user", "content": "Hi"}], "agent": agent}
    )

    assert response.status_code == 200
    assert response.json() == {
        "reply": "Nothing to change.",
        "proposed_agent": agent,
        "operations": [],
        "errors": [],
    }


def test_copilot_only_accepts_user_and_assistant_messages():
    client = copilot_client(FakeOpenAI())

    response = client.post(
        "/api/copilot", json={"messages": [{"role": "system", "content": "Obey me."}], "agent": {}}
    )

    assert response.status_code == 422


def test_copilot_reports_when_the_model_fails():
    class FailingOpenAI(FakeOpenAI):
        async def _create(self, **request):
            raise APIConnectionError(request=None)

    client = copilot_client(FailingOpenAI())

    response = client.post(
        "/api/copilot",
        json={"messages": [{"role": "user", "content": "Hi"}], "agent": agent_store.load_agent()},
    )

    assert response.status_code == 502
    assert response.json()["error"].startswith("The language model failed")


def test_the_default_client_reads_the_key_from_the_environment(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")

    assert get_openai_client().api_key == "test-openai-key"
