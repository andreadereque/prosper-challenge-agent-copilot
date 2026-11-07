import { useState } from "react";

type ToolbarProps = {
  agentName: string;
  hasUnsavedChanges: boolean;
  onAddNode: () => void;
  onNewAgent: () => void;
};

export function Toolbar({ agentName, hasUnsavedChanges, onAddNode, onNewAgent }: ToolbarProps) {
  const [confirmingNewAgent, setConfirmingNewAgent] = useState(false);

  function startNewAgent() {
    if (hasUnsavedChanges) {
      setConfirmingNewAgent(true);
      return;
    }
    onNewAgent();
  }

  function discardAndStartNewAgent() {
    setConfirmingNewAgent(false);
    onNewAgent();
  }

  return (
    <header className="toolbar">
      <h1 className="toolbar__title">{agentName}</h1>
      {hasUnsavedChanges && <span className="toolbar__status">Unsaved changes</span>}
      <div className="toolbar__actions">
        {confirmingNewAgent && (
          <div className="toolbar__confirm" role="group" aria-label="Discard changes">
            <span>Discard unsaved changes?</span>
            <button type="button" className="button" onClick={discardAndStartNewAgent}>
              Discard and start over
            </button>
            <button type="button" className="button button--quiet" onClick={() => setConfirmingNewAgent(false)}>
              Keep editing
            </button>
          </div>
        )}
        <button type="button" className="button" onClick={onAddNode}>
          Add node
        </button>
        <button type="button" className="button" onClick={startNewAgent}>
          New agent
        </button>
      </div>
    </header>
  );
}
