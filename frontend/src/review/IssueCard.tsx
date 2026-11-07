import type { Issue } from "../api";

type IssueCardProps = {
  issue: Issue;
  onFix: () => void;
  onShowCall: () => void;
  onShowNode: () => void;
  canFix: boolean;
};

export function IssueCard({ issue, onFix, onShowCall, onShowNode, canFix }: IssueCardProps) {
  const isResolved = issue.status === "resolved";
  return (
    <article className={`issue issue--${issue.severity}`} aria-label={issue.title}>
      <header className="issue__header">
        <span className={`severity severity--${issue.severity}`}>{issue.severity}</span>
        <h3 className="issue__title">{issue.title}</h3>
        {isResolved && <span className="badge">Resolved</span>}
      </header>
      <p className="issue__meta">
        {issue.source === "client" && "Reported by the client"}
        {issue.source === "evaluator" && `Found in call ${issue.call_id}`}
        {issue.node && (
          <>
            {" · node "}
            <code>{issue.node}</code>
          </>
        )}
      </p>
      {issue.evidence && <blockquote className="issue__quote">“{issue.evidence}”</blockquote>}
      {issue.explanation && <p className="issue__text">{issue.explanation}</p>}
      {issue.suggested_fix && (
        <p className="issue__text">
          <strong>Suggested fix:</strong> {issue.suggested_fix}
        </p>
      )}
      <div className="issue__actions">
        <button type="button" className="button button--primary" disabled={isResolved || !canFix} onClick={onFix}>
          Fix with Copilot
        </button>
        {issue.call_id && (
          <button type="button" className="button" onClick={onShowCall}>
            Show in call
          </button>
        )}
        {issue.node && (
          <button type="button" className="button button--quiet" onClick={onShowNode}>
            Show node
          </button>
        )}
      </div>
    </article>
  );
}
