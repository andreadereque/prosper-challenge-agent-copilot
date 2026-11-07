import { useState } from "react";

type NameFieldProps = {
  label: string;
  value: string;
  isTaken: (name: string) => boolean;
  onCommit: (name: string) => void;
};

/**
 * A name that other parts of the agent point at (a node, a tool, a field).
 * It only changes when you leave the field or press Enter, and only to a valid
 * name, so half-typed names never break the graph. Give it a `key` with the
 * current name so it resets when the selection changes.
 */
export function NameField({ label, value, isTaken, onCommit }: NameFieldProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");

  function commit() {
    const name = draft.trim();
    const problem = nameProblem(name, value, isTaken);
    setError(problem);
    if (!problem && name !== value) {
      onCommit(name);
    }
  }

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className="field__input field__input--mono"
        value={draft}
        aria-invalid={Boolean(error)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
          }
        }}
      />
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

function nameProblem(name: string, current: string, isTaken: (name: string) => boolean): string {
  if (name === current) {
    return "";
  }
  if (!name) {
    return "Name cannot be empty.";
  }
  // OpenAI tool names allow only these characters, so every name follows them.
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    return "Use only letters, numbers, - and _.";
  }
  if (isTaken(name)) {
    return `"${name}" is already used.`;
  }
  return "";
}
