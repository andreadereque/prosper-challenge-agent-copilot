import { setInstruction } from "../agent/agentOps";
import type { AgentNode } from "../types";
import { NameField } from "./NameField";

type NodePanelProps = {
  node: AgentNode;
  nodeNames: string[];
  onUpdate: (changes: Partial<AgentNode>) => void;
  onRename: (name: string) => void;
  onSelectEdge: (tool: string) => void;
};

export function NodePanel({ node, nodeNames, onUpdate, onRename, onSelectEdge }: NodePanelProps) {
  const messages = node.task_messages ?? [];
  // Always show at least one box, so a new node can get its first instruction.
  const boxCount = Math.max(1, messages.length);

  return (
    <section className="panel" aria-label="Edit node">
      <h2 className="panel__title">Node</h2>
      <NameField
        key={node.name}
        label="Name"
        value={node.name}
        isTaken={(name) => nodeNames.includes(name)}
        onCommit={onRename}
      />
      {Array.from({ length: boxCount }, (_, index) => (
        <label className="field" key={index}>
          <span className="field__label">{instructionLabel(index, boxCount)}</span>
          <textarea
            className="field__input"
            rows={7}
            value={messages[index]?.content ?? ""}
            onChange={(event) =>
              onUpdate({ task_messages: setInstruction(messages, index, event.target.value) })
            }
          />
        </label>
      ))}
      <label className="field">
        <span className="field__label">Role override</span>
        <textarea
          className="field__input"
          rows={3}
          placeholder="Empty: this node uses the agent persona."
          value={node.role_message ?? ""}
          onChange={(event) => onUpdate({ role_message: event.target.value || null })}
        />
      </label>
      {node.role_message && (
        <p className="field__hint">
          This replaces the whole persona in this node, including its rules for speaking.
        </p>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={Boolean(node.end)}
          onChange={(event) => onUpdate({ end: event.target.checked })}
        />
        End the call after this node
      </label>
      <h3 className="panel__subtitle">Transitions</h3>
      {(node.edges ?? []).length === 0 && <p className="panel__hint">No transitions out of this node.</p>}
      {(node.edges ?? []).map((edge) => (
        <button
          key={edge.function}
          type="button"
          className="button button--quiet transition-link"
          onClick={() => onSelectEdge(edge.function)}
        >
          {edge.function} → {edge.target}
        </button>
      ))}
    </section>
  );
}

function instructionLabel(index: number, count: number): string {
  if (count === 1) {
    return "Instructions";
  }
  return `Instructions (${index + 1} of ${count})`;
}
