#
# The Copilot's loop: ask the LLM, apply the tools it calls to a copy of the
# agent, and repeat until it answers in words. The result is a proposal that a
# person accepts or rejects; nothing is saved here.
#

import copy
import json
from dataclasses import dataclass, field

from agent_builder import AgentBuilder, AgentValidationError

from .prompts import build_system_prompt
from .tools import DONE, TOOLS, apply_tool_call

# One place to try another model; see DEVLOG.md for why this one.
MODEL = "gpt-4o"
# Caps cost and stops a confused model from looping forever.
MAX_STEPS = 12
# How many times an invalid proposal is sent back to the LLM to fix.
MAX_REPAIRS = 2


@dataclass
class CopilotResult:
    reply: str
    proposed_agent: dict
    operations: list = field(default_factory=list)
    errors: list = field(default_factory=list)


async def run_copilot(client, messages: list, agent: dict) -> CopilotResult:
    proposal = copy.deepcopy(agent)
    operations = []
    conversation = [{"role": "system", "content": build_system_prompt(agent)}, *messages]
    repairs_left = MAX_REPAIRS

    for _ in range(MAX_STEPS):
        response = await client.chat.completions.create(
            model=MODEL, messages=conversation, tools=TOOLS
        )
        message = response.choices[0].message
        conversation.append(message.model_dump(exclude_none=True))

        if message.tool_calls:
            for call in message.tool_calls:
                result = apply_tool_call(proposal, call.function.name, call.function.arguments)
                if result == DONE:
                    operations.append(
                        {"tool": call.function.name, "arguments": json.loads(call.function.arguments)}
                    )
                conversation.append({"role": "tool", "tool_call_id": call.id, "content": result})
            continue

        errors = validation_errors(proposal)
        if errors and repairs_left > 0:
            repairs_left -= 1
            conversation.append({"role": "user", "content": _repair_request(errors)})
            continue
        return CopilotResult(message.content or "", proposal, operations, errors)

    return CopilotResult(
        "I stopped before finishing because the change needed too many steps. "
        "Try asking for a smaller change.",
        proposal,
        operations,
        validation_errors(proposal),
    )


def validation_errors(agent: dict) -> list:
    try:
        AgentBuilder.from_dict(agent)
    except AgentValidationError as error:
        return error.errors
    return []


def _repair_request(errors: list) -> str:
    listed = "\n".join(f"- {error}" for error in errors)
    return f"Your changes leave the agent invalid. Fix these with tools:\n{listed}"
