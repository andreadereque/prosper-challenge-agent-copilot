import { describe, expect, it } from "vitest";

import { makeCall, makeIssue } from "../test/fakeApi";
import { buildScenario } from "./scenario";

describe("buildScenario", () => {
  it("replays what the real caller said, in order", () => {
    expect(buildScenario(makeIssue(), makeCall())).toBe(
      [
        "Play the caller from this reported problem: Emergency not escalated.",
        "What happened: Chest pain must be escalated.",
        "Say these things in this order, one per turn, adapting the wording naturally to what the agent asks:",
        "1. Robert. I have a strong pain in my chest.",
      ].join("\n"),
    );
  });

  it("without a call, uses the quote", () => {
    expect(buildScenario(makeIssue(), null)).toBe(
      [
        "Play the caller from this reported problem: Emergency not escalated.",
        "What happened: Chest pain must be escalated.",
        'At some point you say something like: "strong pain in my chest"',
      ].join("\n"),
    );
  });

  it("works with only a title", () => {
    expect(buildScenario(makeIssue({ explanation: "", evidence: "" }), null)).toBe(
      "Play the caller from this reported problem: Emergency not escalated.",
    );
  });
});
