import { useState } from "react";

import { addEdge, addNode, createBlankAgent, moveNode } from "../agent/agentOps";
import { AgentValidationFailed, saveAgent } from "../api";
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
  async function handleSave() {
    setIsSaving(true);
    setValidationErrors([]);
    setSaveFailure("");
    try {
      await saveAgent(agent);
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

  return (
    <div className="app">
      <Toolbar
        agentName={agent.name}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        onAddNode={handleAddNode}
        onNewAgent={handleNewAgent}
        onSave={handleSave}
      />
      <SaveProblems validationErrors={validationErrors} failure={saveFailure} />
      <div className="workspace">
        <GraphCanvas
          agent={agent}
          selection={selection}
          onSelect={setSelection}
          onMoveNode={(name, position) => change((current) => moveNode(current, name, position))}
          onConnect={handleConnect}
        />
        <aside className="side-panel">
          <SidePanel agent={agent} selection={selection} onChange={change} onSelect={setSelection} />
        </aside>
      </div>
    </div>
  );
}
