import { useState } from "react";

import { addEdge, addNode, createBlankAgent, moveNode } from "../agent/agentOps";
import { AgentValidationFailed, saveAgent, type CopilotResult } from "../api";
import { CopilotPanel } from "../copilot/CopilotPanel";
import { diffAgents, hasChanges, mergeForDiff, type AgentDiff } from "../diff/diffAgents";
import { ProposalPanel } from "../diff/ProposalPanel";
import { GraphCanvas } from "../graph/GraphCanvas";
import type { Agent, Selection } from "../types";
import { SaveProblems } from "./SaveProblems";
import { SidePanel } from "./SidePanel";
import { Toolbar } from "./Toolbar";

export function Editor({ initialAgent }: { initialAgent: Agent }) {
  const [agent, setAgent] = useState(initialAgent);
  const [selection, setSelection] = useState<Selection>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveFailure, setSaveFailure] = useState("");
  const [proposal, setProposal] = useState<CopilotResult | null>(null);

  // Updates receive the latest agent, so several changes in one event
  // (for example while dragging) never overwrite each other.
  function change(update: (agent: Agent) => Agent) {
    setAgent((current) => update(current));
    setHasUnsavedChanges(true);
  }

  function handleAddNode() {
    const added = addNode(agent);
    change(() => added.agent);
    setSelection({ kind: "node", name: added.name });
  }

  function handleConnect(source: string, target: string) {
    const added = addEdge(agent, source, target);
    change(() => added.agent);
    setSelection({ kind: "edge", node: source, tool: added.tool });
  }

  function handleNewAgent() {
    change(() => createBlankAgent());
    setSelection(null);
  }

  // The server validates; the editor only shows what it says, so the rules
  // live in one place (AgentBuilder).
  async function save(agentToSave: Agent) {
    setIsSaving(true);
    setValidationErrors([]);
    setSaveFailure("");
    try {
      await saveAgent(agentToSave);
      setHasUnsavedChanges(false);
    } catch (error) {
      if (error instanceof AgentValidationFailed) {
        setValidationErrors(error.errors);
      } else {
        setSaveFailure((error as Error).message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleCopilotResult(result: CopilotResult) {
    // Questions come before any change: there is nothing to review yet.
    if (result.questions.length > 0) {
      return;
    }
    if (hasChanges(diffAgents(agent, result.proposed_agent))) {
      setProposal(result);
      setSelection(null);
    }
  }

  // Accepting uses the same save as a manual edit, with the same validation.
  async function acceptProposal(accepted: Agent) {
    setAgent(accepted);
    setProposal(null);
    setHasUnsavedChanges(true);
    await save(accepted);
  }

  let canvasAgent = agent;
  let diff: AgentDiff | undefined;
  if (proposal) {
    diff = diffAgents(agent, proposal.proposed_agent);
    canvasAgent = mergeForDiff(agent, proposal.proposed_agent);
  }

  return (
    <div className="app">
      <Toolbar
        agentName={agent.name}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        isReviewing={Boolean(proposal)}
        onAddNode={handleAddNode}
        onNewAgent={handleNewAgent}
        onSave={() => save(agent)}
      />
      <SaveProblems validationErrors={validationErrors} failure={saveFailure} />
      <div className="workspace">
        <GraphCanvas
          agent={canvasAgent}
          selection={selection}
          onSelect={setSelection}
          onMoveNode={(name, position) => change((current) => moveNode(current, name, position))}
          onConnect={handleConnect}
          diff={diff}
          readOnly={Boolean(proposal)}
        />
        <aside className="side-panel">
          {proposal && (
            <ProposalPanel
              diff={diff as AgentDiff}
              errors={proposal.errors}
              onAccept={() => acceptProposal(proposal.proposed_agent)}
              onReject={() => setProposal(null)}
            />
          )}
          {!proposal && (
            <SidePanel agent={agent} selection={selection} onChange={change} onSelect={setSelection} />
          )}
        </aside>
        <aside className="copilot-panel">
          <CopilotPanel agent={agent} isReviewing={Boolean(proposal)} onResult={handleCopilotResult} />
        </aside>
      </div>
    </div>
  );
}
