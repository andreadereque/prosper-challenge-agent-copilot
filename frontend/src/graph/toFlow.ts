import type { Edge, Node } from "@xyflow/react";

import { edgeKey, type AgentDiff, type Change } from "../diff/diffAgents";
import type { Agent, AgentNode, Selection } from "../types";
import { layoutAgent } from "./layout";

export type AgentNodeData = { node: AgentNode; isInitial: boolean; change?: Change };
export type AgentFlowNode = Node<AgentNodeData, "agentNode">;

/**
 * The React Flow view of an agent. The agent JSON stays the single source of
 * truth: this is recomputed from it and never edited directly. With a diff,
 * each node and edge is marked with how a Copilot proposal changes it.
 */
export function agentToFlow(
  agent: Agent,
  selection: Selection = null,
  diff?: AgentDiff,
): { nodes: AgentFlowNode[]; edges: Edge[] } {
  const positions = layoutAgent(agent);
  const nodes = agent.nodes.map((node) => ({
    id: node.name,
    type: "agentNode" as const,
    position: positions[node.name],
    selected: selection?.kind === "node" && selection.name === node.name,
    data: { node, isInitial: node.name === agent.initial_node, change: diff?.nodes.get(node.name) },
  }));
  const edges = agent.nodes.flatMap((node) =>
    (node.edges ?? []).map((edge) => {
      const change = diff?.edges.get(edgeKey(node.name, edge.function));
      return {
        id: `${node.name}:${edge.function}`,
        source: node.name,
        target: edge.target,
        label: edge.function,
        selected:
          selection?.kind === "edge" &&
          selection.node === node.name &&
          selection.tool === edge.function,
        className: change && `edge--${change}`,
      };
    }),
  );
  return { nodes, edges };
}
