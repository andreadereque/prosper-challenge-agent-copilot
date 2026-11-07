import { describe, expect, it } from "vitest";

import { makeAgent } from "../test/fixtures";
import type { Agent } from "../types";
import { describeChanges, diffAgents, hasChanges, mergeForDiff } from "./diffAgents";

function proposalWith(edit: (agent: Agent) => void): Agent {
  const agent = structuredClone(makeAgent());
  edit(agent);
  return agent;
}

describe("diffAgents", () => {
  it("finds nothing when the agents are equal", () => {
    const diff = diffAgents(makeAgent(), makeAgent());

    expect(hasChanges(diff)).toBe(false);
  });

  it("ignores moved nodes", () => {
    const proposed = proposalWith((agent) => {
      agent.nodes[0].position = { x: 300, y: 10 };
    });

    expect(hasChanges(diffAgents(makeAgent(), proposed))).toBe(false);
  });

  it("finds added, edited and removed nodes", () => {
    const proposed = proposalWith((agent) => {
      agent.nodes[0].task_messages = [{ role: "developer", content: "Say hi." }];
      agent.nodes.push({ name: "emergency", end: true });
      agent.nodes = agent.nodes.filter((node) => node.name !== "confirm");
    });

    const diff = diffAgents(makeAgent(), proposed);

    expect([...diff.nodes]).toEqual([
      ["greeting", "edited"],
      ["emergency", "added"],
      ["confirm", "removed"],
    ]);
  });

  it("tracks edges separately from their node", () => {
    const proposed = proposalWith((agent) => {
      agent.nodes[0].edges?.push({ function: "transfer", description: "Transfer.", target: "confirm" });
      agent.nodes[1].edges = [];
    });

    const diff = diffAgents(makeAgent(), proposed);

    expect(diff.nodes.size).toBe(0);
    expect([...diff.edges]).toEqual([
      ["greeting:transfer", "added"],
      ["collect_details:record_details", "removed"],
    ]);
  });

  it("finds changed agent settings", () => {
    const proposed = proposalWith((agent) => {
      agent.persona = "Be brief.";
      agent.initial_node = "confirm";
    });

    expect(diffAgents(makeAgent(), proposed).fields).toEqual(["persona", "initial_node"]);
  });
});

describe("mergeForDiff", () => {
  it("keeps removed nodes and edges so they can be drawn", () => {
    const proposed = proposalWith((agent) => {
      agent.nodes = agent.nodes.filter((node) => node.name !== "confirm");
      agent.nodes[1].edges = [];
      agent.nodes[0].edges?.push({ function: "transfer", description: "Transfer.", target: "collect_details" });
    });

    const merged = mergeForDiff(makeAgent(), proposed);

    expect(merged.nodes.map((node) => node.name)).toEqual(["greeting", "collect_details", "confirm"]);
    expect(merged.nodes[0].edges?.map((edge) => edge.function)).toEqual(["choose_intent", "transfer"]);
    expect(merged.nodes[1].edges?.map((edge) => edge.function)).toEqual(["record_details"]);
  });

  it("keeps edges of a node whose edge list was dropped", () => {
    const proposed = proposalWith((agent) => {
      delete agent.nodes[1].edges;
      agent.nodes[1].end = true;
    });

    const merged = mergeForDiff(makeAgent(), proposed);

    expect(merged.nodes[1].edges?.map((edge) => edge.function)).toEqual(["record_details"]);
  });

  it("keeps a new node as it is", () => {
    const proposed = proposalWith((agent) => {
      agent.nodes.push({ name: "emergency", end: true });
    });

    expect(mergeForDiff(makeAgent(), proposed).nodes[3]).toEqual({ name: "emergency", end: true });
  });
});

describe("describeChanges", () => {
  it("lists settings, steps and transitions in plain words", () => {
    const proposed = proposalWith((agent) => {
      agent.initial_node = "collect_details";
      agent.nodes.push({ name: "emergency", end: true });
      agent.nodes[1].edges?.push({ function: "escalate", description: "Escalate.", target: "emergency" });
      agent.nodes[2].task_messages = [];
      agent.nodes[0].edges = [];
    });

    expect(describeChanges(diffAgents(makeAgent(), proposed))).toEqual([
      "Changed agent initial node",
      "Edited step confirm",
      "Added step emergency",
      "Added transition escalate from collect_details",
      "Removed transition choose_intent from greeting",
    ]);
  });
});
