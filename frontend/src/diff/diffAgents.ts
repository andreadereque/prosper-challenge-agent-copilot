// Compares the current agent with a Copilot proposal, so the graph can show
// what would be added, edited or removed before anyone accepts it.

import { findNode } from "../agent/agentOps";
import type { Agent, AgentEdge, AgentNode } from "../types";

export type Change = "added" | "edited" | "removed";

export type AgentDiff = {
  nodes: Map<string, Change>;
  /** Keyed by `edgeKey(node, tool)`. */
  edges: Map<string, Change>;
  /** Agent settings that changed, e.g. "persona". */
  fields: string[];
};

const AGENT_FIELDS = ["name", "persona", "initial_node", "voice_id", "model"] as const;

export function edgeKey(node: string, tool: string): string {
  return `${node}:${tool}`;
}

export function diffAgents(current: Agent, proposed: Agent): AgentDiff {
  return {
    nodes: compare(nodeContents(current), nodeContents(proposed)),
    edges: compare(edgesByKey(current), edgesByKey(proposed)),
    fields: AGENT_FIELDS.filter((field) => current[field] !== proposed[field]),
  };
}

export function hasChanges(diff: AgentDiff): boolean {
  return diff.nodes.size > 0 || diff.edges.size > 0 || diff.fields.length > 0;
}

/**
 * The proposal plus what it removes, so removed nodes and edges can still be
 * drawn (crossed out) on the graph.
 */
export function mergeForDiff(current: Agent, proposed: Agent): Agent {
  const proposedNames = new Set(proposed.nodes.map((node) => node.name));
  const nodes = proposed.nodes.map((node) => withRemovedEdges(node, findNode(current, node.name)));
  const removedNodes = current.nodes.filter((node) => !proposedNames.has(node.name));
  return { ...proposed, nodes: [...nodes, ...removedNodes] };
}

function withRemovedEdges(node: AgentNode, before: AgentNode | undefined): AgentNode {
  const kept = new Set((node.edges ?? []).map((edge) => edge.function));
  const removed = (before?.edges ?? []).filter((edge) => !kept.has(edge.function));
  if (removed.length === 0) {
    return node;
  }
  return { ...node, edges: [...(node.edges ?? []), ...removed] };
}

/** A node's own content: edges are compared separately and positions are layout. */
function nodeContents(agent: Agent): Map<string, unknown> {
  return new Map(
    agent.nodes.map((node) => {
      const content: AgentNode = { ...node };
      delete content.edges;
      delete content.position;
      return [node.name, content];
    }),
  );
}

function edgesByKey(agent: Agent): Map<string, AgentEdge> {
  const edges = new Map<string, AgentEdge>();
  for (const node of agent.nodes) {
    for (const edge of node.edges ?? []) {
      edges.set(edgeKey(node.name, edge.function), edge);
    }
  }
  return edges;
}

function compare(before: Map<string, unknown>, after: Map<string, unknown>): Map<string, Change> {
  const changes = new Map<string, Change>();
  for (const [key, value] of after) {
    if (!before.has(key)) {
      changes.set(key, "added");
    } else if (JSON.stringify(before.get(key)) !== JSON.stringify(value)) {
      changes.set(key, "edited");
    }
  }
  for (const key of before.keys()) {
    if (!after.has(key)) {
      changes.set(key, "removed");
    }
  }
  return changes;
}

const CHANGE_LABELS: Record<Change, string> = { added: "Added", edited: "Edited", removed: "Removed" };

/** Plain-language list of the changes, for the proposal summary. */
export function describeChanges(diff: AgentDiff): string[] {
  const nodes = [...diff.nodes].map(([name, change]) => `${CHANGE_LABELS[change]} step ${name}`);
  const edges = [...diff.edges].map(([key, change]) => {
    const [node, tool] = key.split(":");
    return `${CHANGE_LABELS[change]} transition ${tool} from ${node}`;
  });
  const fields = diff.fields.map((field) => `Changed agent ${field.replace("_", " ")}`);
  return [...fields, ...nodes, ...edges];
}
