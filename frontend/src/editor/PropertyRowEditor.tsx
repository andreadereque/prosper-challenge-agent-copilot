import { PROPERTY_TYPES, type PropertyRow } from "../agent/properties";
import { NameField } from "./NameField";

type PropertyRowEditorProps = {
  row: PropertyRow;
  isTaken: (name: string) => boolean;
  onChange: (row: PropertyRow) => void;
  onRemove: () => void;
};

export function PropertyRowEditor({ row, isTaken, onChange, onRemove }: PropertyRowEditorProps) {
  return (
    <fieldset className="property">
      <legend className="property__legend">{row.name}</legend>
      <NameField
        key={row.name}
        label="Field name"
        value={row.name}
        isTaken={isTaken}
        onCommit={(name) => onChange({ ...row, name })}
      />
      <label className="field">
        <span className="field__label">Type</span>
        <select
          className="field__input"
          value={row.type}
          onChange={(event) => onChange({ ...row, type: event.target.value })}
        >
          {PROPERTY_TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">What it is</span>
        <input
          className="field__input"
          value={row.description}
          onChange={(event) => onChange({ ...row, description: event.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Allowed values, comma-separated</span>
        <input
          className="field__input"
          placeholder="Empty: any value"
          value={row.options}
          onChange={(event) => onChange({ ...row, options: event.target.value })}
        />
      </label>
      <div className="property__footer">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={row.required}
            onChange={(event) => onChange({ ...row, required: event.target.checked })}
          />
          Required before moving on
        </label>
        <button type="button" className="button button--quiet" onClick={onRemove}>
          Remove field
        </button>
      </div>
    </fieldset>
  );
}
