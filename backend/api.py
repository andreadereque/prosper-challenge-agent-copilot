#
# HTTP API for the editor.
#
# These routes are mounted on Pipecat's runner app (see bot.py), so the editor
# and the test call share one server on port 7860.
#

from fastapi import APIRouter
from fastapi.responses import JSONResponse

import agent_store
from agent_builder import AgentValidationError

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
