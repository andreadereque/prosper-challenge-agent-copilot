import { useState } from "react";

// Pipecat's prebuilt client, served by the backend. It reads the saved agent
// when you press Connect, which is why calling needs everything saved first.
export const TEST_CALL_URL = "http://localhost:7860/client/";

export type View = "graph" | "review";

type ToolbarProps = {
  agentName: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  /** A Copilot proposal is on screen: editing waits until it is accepted or rejected. */
  isReviewing: boolean;
  view: View;
  onViewChange: (view: View) => void;
  onAddNode: () => void;
  onNewAgent: () => void;
  onSave: () => void;
};

export function Toolbar({
  agentName,
  hasUnsavedChanges,
  isSaving,
  isReviewing,
  view,
  onViewChange,
  onAddNode,
  onNewAgent,
  onSave,
}: ToolbarProps) {
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
      <nav className="tabs" aria-label="Views">
        <button type="button" className="tab" aria-pressed={view === "graph"} onClick={() => onViewChange("graph")}>
          Graph
        </button>
        <button type="button" className="tab" aria-pressed={view === "review"} onClick={() => onViewChange("review")}>
          Calls & issues
        </button>
      </nav>
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
        <button type="button" className="button" disabled={isReviewing} onClick={onAddNode}>
          Add node
        </button>
        <button type="button" className="button" disabled={isReviewing} onClick={startNewAgent}>
          New agent
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={!hasUnsavedChanges || isSaving || isReviewing}
          onClick={onSave}
        >
          {isSaving && "Saving…"}
          {!isSaving && "Save"}
        </button>
        {hasUnsavedChanges && (
          <button type="button" className="button" disabled title="Save first: the call uses the saved agent.">
            Call
          </button>
        )}
        {!hasUnsavedChanges && (
          <a className="button button--primary" href={TEST_CALL_URL} target="_blank" rel="noreferrer">
            Call
          </a>
        )}
      </div>
    </header>
  );
}
