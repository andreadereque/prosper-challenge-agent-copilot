#
# Simulated patient — before a fix is accepted, an LLM plays the caller from
# the issue and talks to the proposed agent, in text. It follows the same
# rules as a real call: the agent sees its persona, the current node's
# instructions and the conversation so far, and can only move by calling one
# of the node's edges. No audio and no Pipecat, so it is fast and cheap, but
# it can differ a little from a real call.
#

from agent_builder import AgentBuilder

SIMULATOR_MODEL = "gpt-4o"
# Caps cost; a scheduling call rarely needs more.
MAX_TURNS = 10
# A node can be left straight away, so one agent turn may cross a few nodes.
MAX_HOPS_PER_TURN = 3
HANG_UP = "[END]"

PATIENT_PROMPT = """\
You are a patient calling a healthcare clinic. Play this caller:
{scenario}

Speak like a real caller on the phone: one or two short sentences per turn. Stay in \
character and pursue your goal. When the call is over (you got what you needed, or you \
give up), say goodbye and add {hang_up} at the end of your last message."""


async def simulate(client, agent: dict, scenario: str) -> dict:
    AgentBuilder.from_dict(agent)  # Only valid agents can be simulated.
    nodes = {node["name"]: node for node in agent["nodes"]}
    state = {"node": agent["initial_node"], "path": [agent["initial_node"]], "turns": []}

    for _ in range(MAX_TURNS):
        ended = await _agent_turn(client, agent, nodes, state)
        if ended:
            return _result(state, ended_by="agent")
        patient_text = await _patient_turn(client, scenario, state["turns"])
        hung_up = HANG_UP in patient_text
        state["turns"].append(
            {"role": "user", "text": patient_text.replace(HANG_UP, "").strip(), "node": state["node"]}
        )
        if hung_up:
            return _result(state, ended_by="patient")
    return _result(state, ended_by="turn_limit")


async def _agent_turn(client, agent: dict, nodes: dict, state: dict) -> bool:
    """The agent speaks, moving through nodes as it calls edges. Returns True
    when it reached an end node, which finishes the call."""
    for _ in range(MAX_HOPS_PER_TURN):
        node = nodes[state["node"]]
        message = await _agent_reply(client, agent, node, state["turns"])
        target = _chosen_target(node, message)
        if target:
            state["node"] = target
            state["path"].append(target)
            continue
        state["turns"].append({"role": "assistant", "text": message.content or "", "node": state["node"]})
        return bool(node.get("end"))
    return False


async def _agent_reply(client, agent: dict, node: dict, turns: list):
    persona = node.get("role_message") or agent.get("persona", "")
    instructions = "\n".join(message["content"] for message in node.get("task_messages", []))
    messages = [
        {"role": "system", "content": persona},
        {"role": "system", "content": f"Current step: {node['name']}. {instructions}"},
        *({"role": turn["role"], "content": turn["text"]} for turn in turns),
    ]
    request = {"model": SIMULATOR_MODEL, "temperature": 0.2, "messages": messages}
    tools = [_edge_tool(edge) for edge in node.get("edges", [])]
    if tools:
        request["tools"] = tools
    response = await client.chat.completions.create(**request)
    return response.choices[0].message


async def _patient_turn(client, scenario: str, turns: list) -> str:
    # The patient sees the call from its side: the agent's lines are the "user".
    flipped = {"assistant": "user", "user": "assistant"}
    messages = [
        {"role": "system", "content": PATIENT_PROMPT.format(scenario=scenario, hang_up=HANG_UP)},
        *({"role": flipped[turn["role"]], "content": turn["text"]} for turn in turns),
    ]
    response = await client.chat.completions.create(
        model=SIMULATOR_MODEL, temperature=0.7, messages=messages
    )
    return response.choices[0].message.content or ""


def _edge_tool(edge: dict) -> dict:
    return {
        "type": "function",
        "function": {
            "name": edge["function"],
            "description": edge["description"],
            "parameters": {
                "type": "object",
                "properties": edge.get("properties", {}),
                "required": edge.get("required", []),
            },
        },
    }


def _chosen_target(node: dict, message):
    """The node the agent moves to, if it called one of this node's edges."""
    for call in message.tool_calls or []:
        for edge in node.get("edges", []):
            if edge["function"] == call.function.name:
                return edge["target"]
    return None


def _result(state: dict, ended_by: str) -> dict:
    return {
        "id": "simulation",
        "source": "simulation",
        "turns": state["turns"],
        "path": state["path"],
        "ended_by": ended_by,
    }
