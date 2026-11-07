// Pure edits on the agent. Each one returns a new agent and leaves the input
// untouched, so React sees every change and nothing is edited by accident.

import type { Agent, AgentEdge, AgentNode, Message, Position } from "../types";

export type AgentFields = Pick<Agent, "name" | "persona" | "initial_node" | "voice_id" | "model">;

export function updateAgentFields(agent: Agent, changes: Partial<AgentFields>): Agent {
  return { ...agent, ...changes };
}

export function updateNode(agent: Agent, name: string, changes: Partial<AgentNode>): Agent {
  return {
    ...agent,
    nodes: agent.nodes.map((node) => {
      if (node.name !== name) {
        return node;
      }
      return { ...node, ...changes };
    }),
  };
}

export function moveNode(agent: Agent, name: string, position: Position): Agent {
  return updateNode(agent, name, { position });
}

/** Renames a node and everything that points at it: initial_node and edge targets. */
export function renameNode(agent: Agent, oldName: string, newName: string): Agent {
  let initialNode = agent.initial_node;
  if (initialNode === oldName) {
    initialNode = newName;
  }
  return {
    ...agent,
    initial_node: initialNode,
    nodes: agent.nodes.map((node) => renameInNode(node, oldName, newName)),
  };
}

function renameInNode(node: AgentNode, oldName: string, newName: string): AgentNode {
  let renamed = node;
  if (node.name === oldName) {
    renamed = { ...renamed, name: newName };
  }
  if (node.edges) {
    renamed = { ...renamed, edges: node.edges.map((edge) => retarget(edge, oldName, newName)) };
  }
  return renamed;
}

function retarget(edge: AgentEdge, oldName: string, newName: string): AgentEdge {
  if (edge.target !== oldName) {
    return edge;
  }
  return { ...edge, target: newName };
}

export function updateEdge(
  agent: Agent,
  nodeName: string,
  tool: string,
  changes: Partial<AgentEdge>,
): Agent {
  const node = findNode(agent, nodeName);
  const edges = (node?.edges ?? []).map((edge) => {
    if (edge.function !== tool) {
      return edge;
    }
    return { ...edge, ...changes };
  });
  return updateNode(agent, nodeName, { edges });
}

/** Sets one instruction, adding it when the index is past the end. */
export function setInstruction(messages: Message[], index: number, content: string): Message[] {
  if (index >= messages.length) {
    return [...messages, { role: "developer", content }];
  }
  return messages.map((message, position) => {
    if (position !== index) {
      return message;
    }
    return { ...message, content };
  });
}

export function findNode(agent: Agent, name: string): AgentNode | undefined {
  return agent.nodes.find((node) => node.name === name);
}

export function findEdge(agent: Agent, nodeName: string, tool: string): AgentEdge | undefined {
  return findNode(agent, nodeName)?.edges?.find((edge) => edge.function === tool);
}

/** `base` if it is free, otherwise `base_2`, `base_3`… */
export function uniqueName(base: string, taken: string[]): string {
  let name = base;
  let suffix = 2;
  while (taken.includes(name)) {
    name = `${base}_${suffix}`;
    suffix += 1;
  }
  return name;
}

export function addNode(agent: Agent): { agent: Agent; name: string } {
  const name = uniqueName("new_step", agent.nodes.map((node) => node.name));
  return { agent: { ...agent, nodes: [...agent.nodes, { name, task_messages: [] }] }, name };
}

/** Removes a node and every transition into it. The caller keeps the initial node. */
export function deleteNode(agent: Agent, name: string): Agent {
  const nodes = agent.nodes
    .filter((node) => node.name !== name)
    .map((node) => {
      if (!node.edges) {
        return node;
      }
      return { ...node, edges: node.edges.filter((edge) => edge.target !== name) };
    });
  return { ...agent, nodes };
}

export function addEdge(agent: Agent, source: string, target: string): { agent: Agent; tool: string } {
  const siblings = findNode(agent, source)?.edges ?? [];
  const tool = uniqueName(`go_to_${target}`, siblings.map((edge) => edge.function));
  const edge: AgentEdge = { function: tool, description: `Move on to ${target}.`, target };
  return { agent: updateNode(agent, source, { edges: [...siblings, edge] }), tool };
}

export function deleteEdge(agent: Agent, nodeName: string, tool: string): Agent {
  const siblings = findNode(agent, nodeName)?.edges ?? [];
  return updateNode(agent, nodeName, { edges: siblings.filter((edge) => edge.function !== tool) });
}

/** The smallest agent that can take a call: one step that greets and hangs up. */
export function createBlankAgent(): Agent {
  return {
    name: "New agent",
    persona:
      "You are a warm, efficient assistant for a healthcare clinic. Your replies are spoken " +
      "aloud, so avoid lists, emojis or anything that cannot be read out. Keep replies to one " +
      "or two short sentences.",
    initial_node: "greeting",
    nodes: [
      {
        name: "greeting",
        task_messages: [{ role: "developer", content: "Greet the caller and ask how you can help." }],
        end: true,
      },
    ],
  };
}
