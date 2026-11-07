import { describe, expect, it } from "vitest";

import { makeCall, makeIssue } from "../test/fakeApi";
import { buildFixRequest } from "./fixRequest";

describe("buildFixRequest", () => {
  it("includes the issue, its evidence and the transcript with nodes", () => {
    expect(buildFixRequest(makeIssue(), makeCall())).toBe(
      [
        "Fix this issue with the smallest change, and explain why it fixes it.",
        "",
        "Issue: Emergency not escalated (high)",
        "Node to look at: collect_details",
        'Evidence: "strong pain in my chest"',
        "What went wrong: Chest pain must be escalated.",
        "Suggested fix: Add an emergency path.",
        "",
        "Transcript:",
        "0. [collect_details] assistant: What is your name?",
        "1. [collect_details] user: Robert. I have a strong pain in my chest.",
      ].join("\n"),
    );
  });

  it("leaves out what a client report does not have", () => {
    const report = makeIssue({
      source: "client",
      call_id: null,
      node: null,
      evidence: "",
      suggested_fix: "",
      title: "The agent sounds rushed",
      severity: "medium",
      explanation: "",
    });

    expect(buildFixRequest(report, null)).toBe(
      [
        "Fix this issue with the smallest change, and explain why it fixes it.",
        "",
        "Issue: The agent sounds rushed (medium)",
      ].join("\n"),
    );
  });
});
