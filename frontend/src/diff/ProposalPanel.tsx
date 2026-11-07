import type { Agent } from "../types";
import { describeChanges, type AgentDiff } from "./diffAgents";
import { SimulationPanel } from "./SimulationPanel";

type ProposalPanelProps = {
  diff: AgentDiff;
  proposedAgent: Agent;
  /** Set when the proposal fixes an issue, so it can be tested before accepting. */
  scenario: string | null;
  errors: string[];
  onAccept: () => void;
  onReject: () => void;
};

export function ProposalPanel({ diff, proposedAgent, scenario, errors, onAccept, onReject }: ProposalPanelProps) {
  const changes = describeChanges(diff);
  return (
    <section className="panel" aria-label="Copilot proposal">
      <h2 className="panel__title">Copilot proposal</h2>
      <p className="panel__hint">
        The graph shows the proposal: new parts in blue, edited in amber, removed crossed out.
        Nothing is saved until you accept.
      </p>
      <ul className="proposal__changes">
        {changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
      {errors.length > 0 && (
        <div className="save-problems" role="alert">
          <p className="save-problems__title">This proposal would break the agent, so it cannot be accepted:</p>
          <ul className="save-problems__list">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {scenario && errors.length === 0 && <SimulationPanel agent={proposedAgent} scenario={scenario} />}
      <div className="proposal__actions">
        <button type="button" className="button button--primary" disabled={errors.length > 0} onClick={onAccept}>
          Accept and save
        </button>
        <button type="button" className="button" onClick={onReject}>
          Reject
        </button>
      </div>
    </section>
  );
}
