import type { Agent, Position } from "../types";

const COLUMN_WIDTH = 280;
const ROW_HEIGHT = 170;

/**
 * Where each node goes on the canvas. A saved `position` wins. Other nodes are
 * placed in rows by how many steps they are from the initial node, so a new
 * agent (or one written by the Copilot) reads top to bottom.
 */
export function layoutAgent(agent: Agent): Record<string, Position> {
  const levels = levelsFromInitialNode(agent);
  const lastLevel = Math.max(-1, ...levels.values());
  const nodesPerLevel = new Map<number, number>();
  const positions: Record<string, Position> = {};

  for (const node of agent.nodes) {
    if (node.position) {
      positions[node.name] = node.position;
      continue;
    }
    // Nodes the initial node never reaches go in a row below everything else.
    const level = levels.get(node.name) ?? lastLevel + 1;
    const column = nodesPerLevel.get(level) ?? 0;
    nodesPerLevel.set(level, column + 1);
    positions[node.name] = { x: column * COLUMN_WIDTH, y: level * ROW_HEIGHT };
  }
  return positions;
}

/** Steps from the initial node to every node it can reach. */
function levelsFromInitialNode(agent: Agent): Map<string, number> {
  const nodesByName = new Map(agent.nodes.map((node) => [node.name, node]));
  const levels = new Map<string, number>();
  if (!nodesByName.has(agent.initial_node)) {
    return levels;
  }

  levels.set(agent.initial_node, 0);
  const pending = [agent.initial_node];
  while (pending.length > 0) {
    const name = pending.shift() as string;
    const level = levels.get(name) as number;
    for (const edge of nodesByName.get(name)?.edges ?? []) {
      if (nodesByName.has(edge.target) && !levels.has(edge.target)) {
        levels.set(edge.target, level + 1);
        pending.push(edge.target);
      }
    }
  }
  return levels;
}
