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
        selected: false,
      },
      {
        id: "collect_details:record_details",
        source: "collect_details",
        target: "confirm",
        label: "record_details",
        selected: false,
      },
    ]);
  });

  it("marks the selected node", () => {
    const { nodes } = agentToFlow(makeAgent(), { kind: "node", name: "confirm" });

    expect(nodes.map((node) => node.selected)).toEqual([false, false, true]);
  });

  it("marks the selected edge", () => {
    const { edges } = agentToFlow(makeAgent(), {
      kind: "edge",
      node: "collect_details",
      tool: "record_details",
    });

    expect(edges.map((edge) => edge.selected)).toEqual([false, true]);
  });

  it("marks what a proposal changes", () => {
    const diff = {
      nodes: new Map([["confirm", "edited" as const]]),
      edges: new Map([["greeting:choose_intent", "removed" as const]]),
      fields: [],
    };

    const { nodes, edges } = agentToFlow(makeAgent(), null, diff);

    expect(nodes.map((node) => node.data.change)).toEqual([undefined, undefined, "edited"]);
    expect(edges.map((edge) => edge.className)).toEqual(["edge--removed", undefined]);
  });
});
