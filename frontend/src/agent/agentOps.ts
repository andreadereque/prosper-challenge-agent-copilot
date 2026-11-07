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
