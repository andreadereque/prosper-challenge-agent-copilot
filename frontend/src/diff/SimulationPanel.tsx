import { useState } from "react";

import { simulateCall, type SimulationResult } from "../api";
import type { Agent } from "../types";

const ENDINGS = {
  agent: "The agent ended the call.",
  patient: "The patient hung up.",
  turn_limit: "Stopped after the turn limit.",
};

type SimulationPanelProps = {
  agent: Agent;
  scenario: string;
};

/** Replays the issue's caller against the proposed agent before accepting it. */
export function SimulationPanel({ agent, scenario }: SimulationPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [failure, setFailure] = useState("");

  async function run() {
    setIsRunning(true);
    setFailure("");
    try {
      setResult(await simulateCall(agent, scenario));
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="simulation">
      <button type="button" className="button" disabled={isRunning} onClick={run}>
        {isRunning && "Simulating the call…"}
        {!isRunning && "Test with simulated patient"}
      </button>
      <p className="panel__hint">An AI patient replays the issue against the proposal, then the evaluator reviews the call.</p>
      {failure && (
        <p className="save-problems" role="alert">
          The simulation failed. {failure}
        </p>
      )}
      {result && (
        <section className="simulation__result" aria-label="Simulation result">
          {result.passed && <p className="simulation__verdict simulation__verdict--passed">Passed: no issues found.</p>}
          {!result.passed && (
            <p className="simulation__verdict simulation__verdict--failed">
              Failed: {result.issues.map((issue) => issue.title).join("; ")}
            </p>
          )}
          <p className="panel__hint">
            Path: {result.path.join(" → ")}. {ENDINGS[result.ended_by]}
          </p>
          <details>
            <summary>Conversation</summary>
            <ol className="transcript">
              {result.turns.map((turn, index) => (
                <li key={index} className={`transcript__turn transcript__turn--${turn.role}`}>
                  <span className="transcript__meta">
                    {turn.role} · <code>{turn.node}</code>
                  </span>
                  {turn.text}
                </li>
              ))}
            </ol>
          </details>
        </section>
      )}
    </div>
  );
}
