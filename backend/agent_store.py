#
# Agent store — where the active agent lives on disk.
#
# bot.py reads the agent from here on every call, and the editor writes it
# through the API. The example stays untouched: the first read copies it.
#

import json
import os
from pathlib import Path

from agent_builder import AgentBuilder

BACKEND_DIR = Path(__file__).parent
EXAMPLE_AGENT = BACKEND_DIR / "example_flow.json"
AGENT_PATH = BACKEND_DIR / "agent.json"


def agent_path() -> Path:
    """The active agent's file, created from the example the first time."""
    if not AGENT_PATH.exists():
        AGENT_PATH.write_text(EXAMPLE_AGENT.read_text())
    return AGENT_PATH


def load_agent() -> dict:
    return json.loads(agent_path().read_text())


def save_agent(agent: dict) -> None:
    """Validate the agent, then replace the file. Raises AgentValidationError."""
    AgentBuilder.from_dict(agent)
    # Write a temporary file and swap it in, so a call that starts mid-save
    # never reads half a JSON.
    temporary = AGENT_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(agent, indent=2) + "\n")
    os.replace(temporary, AGENT_PATH)
