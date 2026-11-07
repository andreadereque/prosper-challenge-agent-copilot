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
