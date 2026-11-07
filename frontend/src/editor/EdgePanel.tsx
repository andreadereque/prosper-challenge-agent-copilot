import { uniqueName } from "../agent/agentOps";
import { edgeFieldsFromRows, rowsFromEdge, type PropertyRow } from "../agent/properties";
import type { AgentEdge } from "../types";
import { NameField } from "./NameField";
import { PropertyRowEditor } from "./PropertyRowEditor";

type EdgePanelProps = {
  edge: AgentEdge;
  sourceNode: string;
  nodeNames: string[];
  siblingTools: string[];
  onUpdate: (changes: Partial<AgentEdge>) => void;
  onRenameTool: (tool: string) => void;
  onDelete: () => void;
};

export function EdgePanel({
  edge,
  sourceNode,
  nodeNames,
  siblingTools,
  onUpdate,
  onRenameTool,
  onDelete,
}: EdgePanelProps) {
  const rows = rowsFromEdge(edge);
  const fieldNames = rows.map((row) => row.name);

  function saveRows(nextRows: PropertyRow[]) {
    onUpdate(edgeFieldsFromRows(nextRows));
  }

  function changeRow(index: number, changed: PropertyRow) {
    saveRows(
      rows.map((row, position) => {
        if (position !== index) {
          return row;
        }
        return changed;
      }),
    );
  }

  function addRow() {
    const name = uniqueName("field", fieldNames);
    saveRows([...rows, { name, type: "string", description: "", required: true, options: "" }]);
  }

  return (
    <section className="panel" aria-label="Edit edge">
      <h2 className="panel__title">Transition from {sourceNode}</h2>
      <p className="panel__hint">The LLM calls this tool to move on, passing the data below.</p>
      <NameField
        key={edge.function}
        label="Tool name"
        value={edge.function}
        isTaken={(tool) => siblingTools.includes(tool)}
        onCommit={onRenameTool}
      />
      <label className="field">
        <span className="field__label">When to call it</span>
        <textarea
          className="field__input"
          rows={3}
          value={edge.description}
          onChange={(event) => onUpdate({ description: event.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Goes to</span>
        <select
          className="field__input"
          value={edge.target}
          onChange={(event) => onUpdate({ target: event.target.value })}
        >
          {nodeNames.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <h3 className="panel__subtitle">Data it collects</h3>
      {rows.map((row, index) => (
        <PropertyRowEditor
          key={row.name}
          row={row}
          isTaken={(name) => fieldNames.includes(name)}
          onChange={(changed) => changeRow(index, changed)}
          onRemove={() => saveRows(rows.filter((_, position) => position !== index))}
        />
      ))}
      <button type="button" className="button" onClick={addRow}>
        Add field
      </button>
      <div className="panel__danger">
        <button type="button" className="button button--danger" onClick={onDelete}>
          Delete transition
        </button>
      </div>
    </section>
  );
}
