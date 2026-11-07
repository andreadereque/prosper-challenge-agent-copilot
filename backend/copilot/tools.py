#
# The tools the Copilot's LLM can call: one per operation in operations.py.
#

import json

from . import operations

# What the LLM sees when an operation worked.
DONE = "Done."

# Not an edit: the service stops and hands these questions to the user.
ASK_QUESTIONS = "ask_clarifying_questions"

_FIELDS = {
    "type": "array",
    "description": "Data the agent must collect before taking this edge.",
    "items": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "snake_case field name."},
            "type": {"type": "string", "enum": ["string", "number", "integer", "boolean"]},
            "description": {"type": "string"},
            "required": {"type": "boolean", "description": "Defaults to true."},
            "allowed_values": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["name"],
    },
}

_NAME = {"type": "string", "description": "Letters, numbers, - and _ only."}


def _tool(name: str, description: str, properties: dict, required: list) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required},
        },
    }


_EDGE = {
    "type": "object",
    "properties": {
        "tool": _NAME,
        "description": {"type": "string", "description": "When the voice agent should call it."},
        "to_node": _NAME,
        "fields": _FIELDS,
    },
    "required": ["tool", "description", "to_node"],
}

_NODE = {
    "type": "object",
    "properties": {
        "name": _NAME,
        "instructions": {"type": "string"},
        "end": {"type": "boolean"},
        "edges": {"type": "array", "items": _EDGE},
    },
    "required": ["name", "instructions"],
}

TOOLS = [
    _tool(
        "build_agent",
        "Replace the whole agent at once. Use it only to build an agent from a client's "
        "guidelines; use the smaller tools for changes.",
        {
            "name": {"type": "string"},
            "persona": {"type": "string"},
            "initial_node": _NAME,
            "nodes": {"type": "array", "items": _NODE},
        },
        ["name", "persona", "initial_node", "nodes"],
    ),
    _tool(
        "add_node",
        "Add a conversation step. Connect it with add_edge, or mark it end=true.",
        {
            "name": _NAME,
            "instructions": {"type": "string", "description": "What the agent does in this step."},
            "end": {"type": "boolean", "description": "True if the call ends after this step."},
        },
        ["name", "instructions"],
    ),
    _tool(
        "edit_node",
        "Change a step. Only the arguments you pass change.",
        {
            "name": _NAME,
            "instructions": {"type": "string"},
            "role_message": {"type": "string", "description": "Replaces the persona here. Empty removes it."},
            "end": {"type": "boolean"},
            "new_name": _NAME,
        },
        ["name"],
    ),
    _tool(
        "delete_node",
        "Delete a step and every edge into it.",
        {"name": _NAME},
        ["name"],
    ),
    _tool(
        "add_edge",
        "Add a transition: a tool the voice agent calls to move from one step to another.",
        {
            "from_node": _NAME,
            "tool": {**_NAME, "description": "snake_case name the voice agent will call."},
            "description": {"type": "string", "description": "When the voice agent should call it."},
            "to_node": _NAME,
            "fields": _FIELDS,
        },
        ["from_node", "tool", "description", "to_node"],
    ),
    _tool(
        "edit_edge",
        "Change a transition. Only the arguments you pass change. `fields` replaces all fields.",
        {
            "from_node": _NAME,
            "tool": _NAME,
            "description": {"type": "string"},
            "to_node": _NAME,
            "fields": _FIELDS,
            "new_tool": _NAME,
        },
        ["from_node", "tool"],
    ),
    _tool(
        "delete_edge",
        "Delete a transition.",
        {"from_node": _NAME, "tool": _NAME},
        ["from_node", "tool"],
    ),
    _tool(
        "ask_clarifying_questions",
        "Ask the user before changing anything, only when a missing detail blocks building "
        "the agent. Ends your turn; the user answers in the chat.",
        {
            "questions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "One to four short, specific questions.",
            }
        },
        ["questions"],
    ),
    _tool(
        "set_agent_fields",
        "Change the agent's name, persona (applies to every step) or initial step.",
        {"name": {"type": "string"}, "persona": {"type": "string"}, "initial_node": _NAME},
        [],
    ),
]

_OPERATIONS = {
    "build_agent": operations.build_agent,
    "add_node": operations.add_node,
    "edit_node": operations.edit_node,
    "delete_node": operations.delete_node,
    "add_edge": operations.add_edge,
    "edit_edge": operations.edit_edge,
    "delete_edge": operations.delete_edge,
    "set_agent_fields": operations.set_agent_fields,
}


def apply_tool_call(agent: dict, name: str, arguments_json: str) -> str:
    """Apply one tool call to the proposal. Returns the text the LLM sees as the
    result; errors are returned, not raised, so the LLM can correct itself."""
    operation = _OPERATIONS.get(name)
    if operation is None:
        return f"Error: unknown tool '{name}'."
    try:
        arguments = json.loads(arguments_json)
        operation(agent, **arguments)
    except json.JSONDecodeError:
        return "Error: the arguments were not valid JSON."
    except TypeError as error:
        return f"Error: wrong arguments for {name}: {error}."
    except operations.OperationError as error:
        return f"Error: {error}"
    return DONE
