#
# HTTP API for the editor.
#
# These routes are mounted on Pipecat's runner app (see bot.py), so the editor
# and the test call share one server on port 7860.
#

from dataclasses import asdict
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel

import agent_store
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
