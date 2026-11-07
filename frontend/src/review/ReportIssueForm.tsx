import { useState, type FormEvent } from "react";

type ReportIssueFormProps = {
  nodeNames: string[];
  onReport: (title: string, description: string, node: string | null) => Promise<void>;
};

/** For problems a client tells us about, which no call shows. */
export function ReportIssueForm({ nodeNames, onReport }: ReportIssueFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [node, setNode] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onReport(title.trim(), description.trim(), node || null);
    setTitle("");
    setDescription("");
    setNode("");
  }

  return (
    <form className="report" onSubmit={submit} aria-label="Report an issue">
      <h3 className="panel__subtitle">Report a client issue</h3>
      <label className="field">
        <span className="field__label">What the client reported</span>
        <input className="field__input" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field">
        <span className="field__label">Details</span>
        <textarea
          className="field__input"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Step it is about (optional)</span>
        <select className="field__input" value={node} onChange={(event) => setNode(event.target.value)}>
          <option value="">Not sure</option>
          {nodeNames.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="button" disabled={!title.trim() || !description.trim()}>
        Add issue
      </button>
    </form>
  );
}
