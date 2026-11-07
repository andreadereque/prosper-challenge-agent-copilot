import { useState } from "react";

import { moveNode } from "../agent/agentOps";
import { GraphCanvas } from "../graph/GraphCanvas";
import type { Agent, Selection } from "../types";
import { SidePanel } from "./SidePanel";

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

  return (
    <div className="app">
      <header className="toolbar">
        <h1 className="toolbar__title">{agent.name}</h1>
        {hasUnsavedChanges && <span className="toolbar__status">Unsaved changes</span>}
      </header>
      <div className="workspace">
        <GraphCanvas
          agent={agent}
          selection={selection}
          onSelect={setSelection}
          onMoveNode={(name, position) => change((current) => moveNode(current, name, position))}
        />
        <aside className="side-panel">
          <SidePanel agent={agent} selection={selection} onChange={change} onSelect={setSelection} />
        </aside>
      </div>
    </div>
  );
}
