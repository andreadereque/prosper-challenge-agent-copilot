import type { Call, Issue } from "../api";

/**
 * The message "Fix with Copilot" sends: the issue, the evidence and, for a
 * call, the transcript with the node of each turn. It goes through the normal
 * chat, so the user sees exactly what the Copilot was asked.
 */
export function buildFixRequest(issue: Issue, call: Call | null): string {
  const lines = [
    `Fix this issue with the smallest change, and explain why it fixes it.`,
    ``,
    `Issue: ${issue.title} (${issue.severity})`,
  ];
  if (issue.node) {
    lines.push(`Node to look at: ${issue.node}`);
  }
  if (issue.evidence) {
    lines.push(`Evidence: "${issue.evidence}"`);
  }
  if (issue.explanation) {
    lines.push(`What went wrong: ${issue.explanation}`);
  }
  if (issue.suggested_fix) {
    lines.push(`Suggested fix: ${issue.suggested_fix}`);
  }
  if (call) {
    lines.push(``, `Transcript:`);
    call.turns.forEach((turn, index) => {
      lines.push(`${index}. [${turn.node}] ${turn.role}: ${turn.text}`);
    });
  }
  return lines.join("\n");
}
