import { useEffect, useState } from "react";

import {
  evaluateCalls,
  fetchCall,
  fetchCalls,
  fetchIssues,
  reportIssue,
  type Call,
  type CallSummary,
  type Issue,
} from "../api";
import { IssueCard } from "./IssueCard";
import { ReportIssueForm } from "./ReportIssueForm";
import { Transcript } from "./Transcript";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

/** Open issues first, then by severity. */
function byPriority(first: Issue, second: Issue): number {
  const resolved = Number(first.status === "resolved") - Number(second.status === "resolved");
  return resolved || SEVERITY_ORDER[first.severity] - SEVERITY_ORDER[second.severity];
}

type ReviewViewProps = {
  nodeNames: string[];
  canFix: boolean;
  onFix: (issue: Issue, call: Call | null) => void;
  onShowNode: (node: string) => void;
};

export function ReviewView({ nodeNames, canFix, onFix, onShowNode }: ReviewViewProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [openCall, setOpenCall] = useState<{ call: Call; turn: number | null } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    Promise.all([fetchIssues(), fetchCalls()])
      .then(([loadedIssues, loadedCalls]) => {
        setIssues(loadedIssues);
        setCalls(loadedCalls);
      })
      .catch((error: Error) => setFailure(error.message));
  }, []);

  // Each action reports its own failure, so one error never hides the page.
  async function attempt(action: () => Promise<void>) {
    setFailure("");
    try {
      await action();
    } catch (error) {
      setFailure((error as Error).message);
    }
  }

  async function analyze() {
    setIsAnalyzing(true);
    await attempt(async () => setIssues(await evaluateCalls()));
    setIsAnalyzing(false);
  }

  function showCall(callId: string, turn: number | null) {
    return attempt(async () => setOpenCall({ call: await fetchCall(callId), turn }));
  }

  function fix(issue: Issue) {
    return attempt(async () => {
      let call: Call | null = null;
      if (issue.call_id) {
        call = await fetchCall(issue.call_id);
      }
      onFix(issue, call);
    });
  }

  function report(title: string, description: string, node: string | null) {
    return attempt(async () => {
      const issue = await reportIssue(title, description, node);
      setIssues((current) => [...current, issue]);
    });
  }

  return (
    <div className="review">
      <section className="review__issues" aria-label="Issues">
        <div className="review__heading">
          <h2 className="panel__title">Issues</h2>
          <button type="button" className="button button--primary" disabled={isAnalyzing} onClick={analyze}>
            {isAnalyzing && "Analyzing calls…"}
            {!isAnalyzing && "Analyze calls"}
          </button>
        </div>
        {failure && (
          <p className="save-problems" role="alert">
            Something went wrong. {failure}
          </p>
        )}
        {issues.length === 0 && (
          <p className="panel__hint">No issues yet. Analyze the calls, or report what a client told you.</p>
        )}
        {[...issues].sort(byPriority).map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            canFix={canFix}
            onFix={() => fix(issue)}
            onShowCall={() => showCall(issue.call_id as string, issue.turn_index)}
            onShowNode={() => onShowNode(issue.node as string)}
          />
        ))}
        <ReportIssueForm nodeNames={nodeNames} onReport={report} />
      </section>
      <section className="review__calls" aria-label="Calls">
        <h2 className="panel__title">Calls</h2>
        <ul className="calls">
          {calls.map((call) => (
            <li key={call.id}>
              <button type="button" className="call-link" onClick={() => showCall(call.id, null)}>
                <span className="call-link__id">{call.id}</span>
                <span className="call-link__meta">
                  {call.source === "mock" && "Made-up · "}
                  {call.turn_count} turns · {call.started_at.replace("T", " ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {openCall && <Transcript call={openCall.call} highlightedTurn={openCall.turn} />}
      </section>
    </div>
  );
}
