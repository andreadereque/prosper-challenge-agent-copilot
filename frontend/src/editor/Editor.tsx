import { useState } from "react";

import { addEdge, addNode, createBlankAgent, moveNode } from "../agent/agentOps";
import { GraphCanvas } from "../graph/GraphCanvas";
import type { Agent, Selection } from "../types";
import { SidePanel } from "./SidePanel";
import { Toolbar } from "./Toolbar";

export function Editor({ initialAgent }: { initialAgent: Agent }) {
  const [agent, setAgent] = useState(initialAgent);
  const [selection, setSelection] = useState<Selection>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  return (
    <div className="app">
      <Toolbar
        agentName={agent.name}
        hasUnsavedChanges={hasUnsavedChanges}
        onAddNode={handleAddNode}
        onNewAgent={handleNewAgent}
      />
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
