#
# HTTP API for the editor.
#
# These routes are mounted on Pipecat's runner app (see bot.py), so the editor
# and the test call share one server on port 7860.
#

import asyncio
from dataclasses import asdict
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel

import agent_store
import call_recorder
import evaluator
import issues_store
from agent_builder import AgentValidationError
from copilot.service import run_copilot

router = APIRouter(prefix="/api")


@router.get("/agent")
def get_agent() -> dict:
    return agent_store.load_agent()


@router.put("/agent")
def put_agent(agent: dict):
    try:
        agent_store.save_agent(agent)
    except AgentValidationError as error:
        return JSONResponse(status_code=422, content={"errors": error.errors})
    return agent


@router.get("/calls")
def get_calls() -> list:
    return call_recorder.list_calls()


@router.get("/calls/{call_id}")
def get_call(call_id: str):
    call = call_recorder.load_call(call_id)
    if call is None:
        return JSONResponse(status_code=404, content={"error": f"No call with id '{call_id}'."})
    return call


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class CopilotRequest(BaseModel):
    # The server keeps no chat history: the editor sends it with every request.
    messages: list[ChatMessage]
    agent: dict


def get_openai_client() -> AsyncOpenAI:
    """Reads OPENAI_API_KEY from the environment. Tests replace it with a fake."""
    return AsyncOpenAI()


@router.post("/copilot")
async def ask_copilot(request: CopilotRequest, client=Depends(get_openai_client)):
    messages = [message.model_dump() for message in request.messages]
    try:
        result = await run_copilot(client, messages, request.agent)
    except OpenAIError as error:
        return JSONResponse(status_code=502, content={"error": f"The language model failed: {error}"})
    return asdict(result)


@router.post("/calls/evaluate")
async def evaluate_calls(client=Depends(get_openai_client)):
    """Reviews every call against the saved agent, in parallel, and replaces the
    previous evaluation. Issues a client reported are kept."""
    agent = agent_store.load_agent()
    calls = call_recorder.load_all_calls()
    try:
        found = await asyncio.gather(*(evaluator.evaluate_call(client, call, agent) for call in calls))
    except (OpenAIError, evaluator.EvaluationError) as error:
        return JSONResponse(status_code=502, content={"error": f"The evaluation failed: {error}"})
    return issues_store.replace_evaluator_issues([issue for issues in found for issue in issues])


@router.get("/issues")
def get_issues() -> list:
    return issues_store.load_issues()


class ClientIssue(BaseModel):
    title: str
    description: str
    node: Optional[str] = None


@router.post("/issues")
def report_issue(issue: ClientIssue) -> dict:
    return issues_store.add_client_issue(issue.title, issue.description, issue.node)
