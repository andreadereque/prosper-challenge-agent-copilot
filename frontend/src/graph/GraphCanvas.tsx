import { Background, Controls, ReactFlow, type NodeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";

import type { AgentDiff } from "../diff/diffAgents";
import type { Agent, Position, Selection } from "../types";
import { AgentNodeCard } from "./AgentNodeCard";
import { agentToFlow, type AgentFlowNode } from "./toFlow";

// Defined outside the component so React Flow does not see a new object on every render.
const nodeTypes = { agentNode: AgentNodeCard };

type GraphCanvasProps = {
  agent: Agent;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onMoveNode: (name: string, position: Position) => void;
  onConnect: (source: string, target: string) => void;
  /** Marks what a Copilot proposal changes. */
  diff?: AgentDiff;
  /** While reviewing a proposal, the graph cannot be edited. */
  readOnly?: boolean;
};

export function GraphCanvas({
  agent,
  selection,
  onSelect,
  onMoveNode,
  onConnect,
  diff,
  readOnly = false,
}: GraphCanvasProps) {
  const { nodes, edges } = useMemo(() => agentToFlow(agent, selection, diff), [agent, selection, diff]);

  // The canvas never keeps its own copy of the nodes: a drag is turned into a
  // change on the agent, and the canvas is redrawn from it.
  function handleNodesChange(changes: NodeChange<AgentFlowNode>[]) {
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        onMoveNode(change.id, change.position);
      }
    }
  }

  return (
    <div className="graph-canvas">
      <ReactFlow
        // A new key when a proposal appears or goes remounts the canvas, so
        // fitView frames the new steps instead of leaving them off screen.
        key={String(Boolean(diff))}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeClick={(_, node) => onSelect({ kind: "node", name: node.id })}
        // Each edge is labelled with its tool name, which is unique within its node.
        onEdgeClick={(_, edge) => onSelect({ kind: "edge", node: edge.source, tool: String(edge.label) })}
        onPaneClick={() => onSelect(null)}
        onConnect={(connection) => onConnect(connection.source, connection.target)}
        // Deleting is done from the side panel, where it is explicit and can be explained.
        deleteKeyCode={null}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        fitView
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
