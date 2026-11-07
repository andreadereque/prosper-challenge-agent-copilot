#
# The edits the Copilot can make, one per tool. Each works on the proposal (a
# private copy of the agent) and raises OperationError with a message the LLM
# can read and act on. The real agent is only replaced when a person accepts.
#

from typing import Optional


class OperationError(Exception):
    """An edit that cannot be applied. The message goes back to the LLM."""


def add_node(agent: dict, name: str, instructions: str, end: bool = False) -> None:
    if _find_node(agent, name):
        raise OperationError(f"A node named '{name}' already exists.")
    node = {"name": name, "task_messages": _instructions(instructions)}
    if end:
        node["end"] = True
    agent["nodes"].append(node)


def edit_node(
    agent: dict,
    name: str,
    instructions: Optional[str] = None,
    role_message: Optional[str] = None,
    end: Optional[bool] = None,
    new_name: Optional[str] = None,
) -> None:
    node = _require_node(agent, name)
    if instructions is not None:
        node["task_messages"] = _instructions(instructions)
    if role_message is not None:
        # An empty string removes the override, so the node uses the persona again.
        node["role_message"] = role_message or None
    if end is not None:
        node["end"] = end
    if new_name is not None and new_name != name:
        _rename_node(agent, node, new_name)


def delete_node(agent: dict, name: str) -> None:
    node = _require_node(agent, name)
    if agent["initial_node"] == name:
        raise OperationError(
            f"'{name}' is the initial node. Set another initial_node before deleting it."
        )
    agent["nodes"].remove(node)
    for other in agent["nodes"]:
        other["edges"] = [edge for edge in other.get("edges", []) if edge["target"] != name]


def add_edge(
    agent: dict,
    from_node: str,
    tool: str,
    description: str,
    to_node: str,
    fields: Optional[list] = None,
) -> None:
    node = _require_node(agent, from_node)
    if _find_edge(node, tool):
        raise OperationError(f"Node '{from_node}' already has an edge named '{tool}'.")
    _require_node(agent, to_node)
    edge = {"function": tool, "description": description, "target": to_node}
    edge.update(_schema_from_fields(fields or []))
    node.setdefault("edges", []).append(edge)


def edit_edge(
    agent: dict,
    from_node: str,
    tool: str,
    description: Optional[str] = None,
    to_node: Optional[str] = None,
    fields: Optional[list] = None,
    new_tool: Optional[str] = None,
) -> None:
    node = _require_node(agent, from_node)
    edge = _find_edge(node, tool)
    if edge is None:
        raise OperationError(f"Node '{from_node}' has no edge named '{tool}'.")
    if description is not None:
        edge["description"] = description
    if to_node is not None:
        _require_node(agent, to_node)
        edge["target"] = to_node
    if fields is not None:
        edge.update(_schema_from_fields(fields))
    if new_tool is not None and new_tool != tool:
        if _find_edge(node, new_tool):
            raise OperationError(f"Node '{from_node}' already has an edge named '{new_tool}'.")
        edge["function"] = new_tool


def delete_edge(agent: dict, from_node: str, tool: str) -> None:
    node = _require_node(agent, from_node)
    edge = _find_edge(node, tool)
    if edge is None:
        raise OperationError(f"Node '{from_node}' has no edge named '{tool}'.")
    node["edges"].remove(edge)


def set_agent_fields(
    agent: dict,
    name: Optional[str] = None,
    persona: Optional[str] = None,
    initial_node: Optional[str] = None,
) -> None:
    if name is not None:
        agent["name"] = name
    if persona is not None:
        agent["persona"] = persona
    if initial_node is not None:
        _require_node(agent, initial_node)
        agent["initial_node"] = initial_node


# ---- helpers -----------------------------------------------------------------


def _instructions(text: str) -> list:
    return [{"role": "developer", "content": text}]


def _find_node(agent: dict, name: str) -> Optional[dict]:
    return next((node for node in agent["nodes"] if node["name"] == name), None)


def _require_node(agent: dict, name: str) -> dict:
    node = _find_node(agent, name)
    if node is None:
        names = ", ".join(node["name"] for node in agent["nodes"])
        raise OperationError(f"There is no node named '{name}'. Nodes: {names}.")
    return node


def _find_edge(node: dict, tool: str) -> Optional[dict]:
    return next((edge for edge in node.get("edges", []) if edge["function"] == tool), None)


def _rename_node(agent: dict, node: dict, new_name: str) -> None:
    if _find_node(agent, new_name):
        raise OperationError(f"A node named '{new_name}' already exists.")
    old_name = node["name"]
    node["name"] = new_name
    if agent["initial_node"] == old_name:
        agent["initial_node"] = new_name
    for other in agent["nodes"]:
        for edge in other.get("edges", []):
            if edge["target"] == old_name:
                edge["target"] = new_name


def _schema_from_fields(fields: list) -> dict:
    """The LLM describes collected data as a simple list; the agent stores JSON schema."""
    properties = {}
    for field in fields:
        schema = {"type": field.get("type", "string")}
        if field.get("description"):
            schema["description"] = field["description"]
        if field.get("allowed_values"):
            schema["enum"] = field["allowed_values"]
        properties[field["name"]] = schema
    required = [field["name"] for field in fields if field.get("required", True)]
    return {"properties": properties, "required": required}
