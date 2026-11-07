import type { AgentFields } from "../agent/agentOps";
import type { Agent } from "../types";

type AgentPanelProps = {
  agent: Agent;
  onUpdate: (changes: Partial<AgentFields>) => void;
};

export function AgentPanel({ agent, onUpdate }: AgentPanelProps) {
  return (
    <section className="panel" aria-label="Edit agent">
      <h2 className="panel__title">Agent</h2>
      <p className="panel__hint">Select a node or a transition on the graph to edit it.</p>
      <label className="field">
        <span className="field__label">Name</span>
        <input
          className="field__input"
          value={agent.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Persona (applies to every node)</span>
        <textarea
          className="field__input"
          rows={8}
          value={agent.persona ?? ""}
          onChange={(event) => onUpdate({ persona: event.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Starts at</span>
        <select
          className="field__input"
          value={agent.initial_node}
          onChange={(event) => onUpdate({ initial_node: event.target.value })}
        >
          {agent.nodes.map((node) => (
            <option key={node.name}>{node.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">ElevenLabs voice ID</span>
        <input
          className="field__input field__input--mono"
          value={agent.voice_id ?? ""}
          onChange={(event) => onUpdate({ voice_id: event.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">OpenAI model</span>
        <input
          className="field__input field__input--mono"
          value={agent.model ?? ""}
          onChange={(event) => onUpdate({ model: event.target.value })}
        />
      </label>
    </section>
  );
}
