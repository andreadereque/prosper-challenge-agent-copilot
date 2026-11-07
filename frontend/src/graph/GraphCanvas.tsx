import { Background, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";

import type { Agent } from "../types";
import { AgentNodeCard } from "./AgentNodeCard";
import { agentToFlow } from "./toFlow";

// Defined outside the component so React Flow does not see a new object on every render.
const nodeTypes = { agentNode: AgentNodeCard };

export function GraphCanvas({ agent }: { agent: Agent }) {
  const { nodes, edges } = useMemo(() => agentToFlow(agent), [agent]);
  return (
    <div className="graph-canvas">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} fitView>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
