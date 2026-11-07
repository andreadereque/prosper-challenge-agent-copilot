import { describe, expect, it } from "vitest";

import { makeAgent } from "../test/fixtures";
import { layoutAgent } from "./layout";

describe("layoutAgent", () => {
  it("places nodes in rows by their distance from the initial node", () => {
    expect(layoutAgent(makeAgent())).toEqual({
      greeting: { x: 0, y: 0 },
      collect_details: { x: 0, y: 170 },
      confirm: { x: 0, y: 340 },
    });
  });

  it("puts nodes at the same distance side by side", () => {
    const agent = makeAgent();
    agent.nodes[0].edges?.push({ function: "skip", description: "Skip.", target: "confirm" });

    const positions = layoutAgent(agent);

    expect(positions.collect_details).toEqual({ x: 0, y: 170 });
    expect(positions.confirm).toEqual({ x: 280, y: 170 });
  });

  it("keeps a saved position", () => {
    const agent = makeAgent();
    agent.nodes[1].position = { x: 500, y: 40 };

    expect(layoutAgent(agent).collect_details).toEqual({ x: 500, y: 40 });
  });

  it("puts unreachable nodes in a row below the others", () => {
    const agent = makeAgent();
    agent.nodes.push({ name: "orphan", end: true });

    expect(layoutAgent(agent).orphan).toEqual({ x: 0, y: 510 });
  });

  it("does not loop forever on a cycle", () => {
    const agent = makeAgent();
    agent.nodes[2].edges = [{ function: "restart", description: "Restart.", target: "greeting" }];

    expect(layoutAgent(agent).greeting).toEqual({ x: 0, y: 0 });
  });

  it("ignores edges to nodes that do not exist", () => {
    const agent = makeAgent();
    agent.nodes[2].edges = [{ function: "broken", description: "Broken.", target: "missing" }];

    expect(Object.keys(layoutAgent(agent))).toEqual(["greeting", "collect_details", "confirm"]);
  });

  it("still lays out every node when the initial node is missing", () => {
    const agent = makeAgent();
    agent.initial_node = "missing";

    expect(layoutAgent(agent)).toEqual({
      greeting: { x: 0, y: 0 },
      collect_details: { x: 280, y: 0 },
      confirm: { x: 560, y: 0 },
    });
  });
});
