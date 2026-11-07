import {
  findNode,
  renameNode,
  updateAgentFields,
  updateEdge,
  updateNode,
} from "../agent/agentOps";
import type { Agent, Selection } from "../types";
import { AgentPanel } from "./AgentPanel";
import { EdgePanel } from "./EdgePanel";
import { NodePanel } from "./NodePanel";

type SidePanelProps = {
  agent: Agent;
  selection: Selection;
  onChange: (update: (agent: Agent) => Agent) => void;
  onSelect: (selection: Selection) => void;
};

/** Shows the editor for whatever is selected on the graph. */
export function SidePanel({ agent, selection, onChange, onSelect }: SidePanelProps) {
  const nodeNames = agent.nodes.map((node) => node.name);

  if (selection?.kind === "node") {
    const node = findNode(agent, selection.name);
    if (node) {
      return (
        <NodePanel
          node={node}
          nodeNames={nodeNames}
          onUpdate={(changes) => onChange((current) => updateNode(current, node.name, changes))}
          onRename={(name) => {
            onChange((current) => renameNode(current, node.name, name));
            onSelect({ kind: "node", name });
          }}
          onSelectEdge={(tool) => onSelect({ kind: "edge", node: node.name, tool })}
        />
      );
    }
  }

  if (selection?.kind === "edge") {
    const source = selection.node;
    const siblings = findNode(agent, source)?.edges ?? [];
    const edge = siblings.find((sibling) => sibling.function === selection.tool);
    if (edge) {
      const siblingTools = siblings.map((sibling) => sibling.function);
      return (
        <EdgePanel
          edge={edge}
          sourceNode={source}
          nodeNames={nodeNames}
          siblingTools={siblingTools}
          onUpdate={(changes) =>
            onChange((current) => updateEdge(current, source, edge.function, changes))
          }
          onRenameTool={(tool) => {
            onChange((current) => updateEdge(current, source, edge.function, { function: tool }));
            onSelect({ kind: "edge", node: source, tool });
          }}
        />
      );
    }
  }

  return (
    <AgentPanel
      agent={agent}
      onUpdate={(changes) => onChange((current) => updateAgentFields(current, changes))}
    />
  );
}
