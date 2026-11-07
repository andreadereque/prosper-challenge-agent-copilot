import type { Edge, Node } from "@xyflow/react";

import type { Agent, AgentNode } from "../types";
import { layoutAgent } from "./layout";

export type AgentNodeData = { node: AgentNode; isInitial: boolean };
export type AgentFlowNode = Node<AgentNodeData, "agentNode">;

/**
 * The React Flow view of an agent. The agent JSON stays the single source of
 * truth: this is recomputed from it and never edited directly.
 */
export function agentToFlow(agent: Agent): { nodes: AgentFlowNode[]; edges: Edge[] } {
  const positions = layoutAgent(agent);
  const nodes = agent.nodes.map((node) => ({
    id: node.name,
    type: "agentNode" as const,
    position: positions[node.name],
    data: { node, isInitial: node.name === agent.initial_node },
  }));
  const edges = agent.nodes.flatMap((node) =>
    (node.edges ?? []).map((edge) => ({
      id: `${node.name}:${edge.function}`,
      source: node.name,
      target: edge.target,
      label: edge.function,
    })),
  );
  return { nodes, edges };
}
