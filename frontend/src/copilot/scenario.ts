import type { Call, Issue } from "../api";

/**
 * The caller the simulated patient plays, rebuilt from an issue. With the
 * original call, the patient repeats what the real caller said, in order, so
 * the replay goes down the same path and tests the step that was fixed.
 */
export function buildScenario(issue: Issue, call: Call | null): string {
  const lines = [`Play the caller from this reported problem: ${issue.title}.`];
  if (issue.explanation) {
    lines.push(`What happened: ${issue.explanation}`);
  }
  const callerLines = (call?.turns ?? []).filter((turn) => turn.role === "user");
  if (callerLines.length > 0) {
    lines.push(
      "Say these things in this order, one per turn, adapting the wording naturally to what the agent asks:",
      ...callerLines.map((turn, index) => `${index + 1}. ${turn.text}`),
    );
  } else if (issue.evidence) {
    lines.push(`At some point you say something like: "${issue.evidence}"`);
  }
  return lines.join("\n");
}
