import { describe, expect, it } from "vitest";

import { makeAgent } from "../test/fixtures";
import { agentToFlow } from "./toFlow";

describe("agentToFlow", () => {
  it("makes one canvas node per agent node and marks the initial one", () => {
    const { nodes } = agentToFlow(makeAgent());

    expect(nodes.map((node) => [node.id, node.data.isInitial])).toEqual([
      ["greeting", true],
      ["collect_details", false],
      ["confirm", false],
    ]);
    expect(nodes[1].position).toEqual({ x: 0, y: 170 });
  });

  it("makes one canvas edge per agent edge, labelled with its tool", () => {
    const { edges } = agentToFlow(makeAgent());

    expect(edges).toEqual([
      {
        id: "greeting:choose_intent",
        source: "greeting",
        target: "collect_details",
        label: "choose_intent",
      },
      {
        id: "collect_details:record_details",
        source: "collect_details",
        target: "confirm",
        label: "record_details",
      },
    ]);
  });
});
