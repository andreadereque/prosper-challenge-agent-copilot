import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { Change } from "../diff/diffAgents";
import type { AgentNode } from "../types";
import type { AgentFlowNode } from "./toFlow";

const CHANGE_LABELS: Record<Change, string> = { added: "New", edited: "Edited", removed: "Removed" };

export function AgentNodeCard({ data }: NodeProps<AgentFlowNode>) {
  const { node, isInitial, change } = data;
  let className = "agent-node";
  if (change) {
    className += ` agent-node--${change}`;
  }
  return (
    <div className={className}>
      <Handle type="target" position={Position.Top} />
      <div className="agent-node__badges">
        {isInitial && <span className="badge">Start</span>}
        {node.end && <span className="badge">End</span>}
        {change && <span className={`badge badge--${change}`}>{CHANGE_LABELS[change]}</span>}
      </div>
      <strong className="agent-node__name">{node.name}</strong>
      <p className="agent-node__summary">{summarize(node)}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function summarize(node: AgentNode): string {
  const instructions = node.task_messages?.[0]?.content;
  if (!instructions) {
    return "No instructions yet.";
  }
  return instructions;
}
