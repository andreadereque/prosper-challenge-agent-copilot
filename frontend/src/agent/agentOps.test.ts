import { describe, expect, it } from "vitest";

import { makeAgent } from "../test/fixtures";
import {
  addEdge,
  addNode,
  createBlankAgent,
  deleteEdge,
  deleteNode,
  findEdge,
  moveNode,
  renameNode,
  setInstruction,
  uniqueName,
  updateAgentFields,
  updateEdge,
  updateNode,
} from "./agentOps";

describe("agent edits", () => {
  it("never change the agent they receive", () => {
    const agent = makeAgent();
    const before = structuredClone(agent);

    updateAgentFields(agent, { name: "Other" });
    updateNode(agent, "greeting", { end: true });
    renameNode(agent, "confirm", "wrap_up");
    updateEdge(agent, "greeting", "choose_intent", { description: "Changed." });
    moveNode(agent, "greeting", { x: 1, y: 2 });

    expect(agent).toEqual(before);
  });

  it("update the agent's own fields", () => {
    expect(updateAgentFields(makeAgent(), { persona: "Be brief." }).persona).toBe("Be brief.");
  });

  it("update only the named node", () => {
    const agent = updateNode(makeAgent(), "confirm", { end: false });

    expect(agent.nodes.map((node) => node.end)).toEqual([undefined, undefined, false]);
  });

  it("store a node's position", () => {
    expect(moveNode(makeAgent(), "greeting", { x: 5, y: 9 }).nodes[0].position).toEqual({ x: 5, y: 9 });
  });

  it("update only the named edge", () => {
    const agent = makeAgent();
    agent.nodes[0].edges?.push({ function: "other", description: "Other.", target: "confirm" });

    const updated = updateEdge(agent, "greeting", "choose_intent", { target: "confirm" });

    expect(updated.nodes[0].edges?.map((edge) => edge.target)).toEqual(["confirm", "confirm"]);
  });

  it("leave the agent alone when the edge's node does not exist", () => {
    const agent = makeAgent();

    expect(updateEdge(agent, "missing", "choose_intent", { target: "confirm" })).toEqual(agent);
  });
});

describe("renameNode", () => {
  it("updates edge targets that point at the node", () => {
    const agent = renameNode(makeAgent(), "collect_details", "ask_name");

    expect(agent.nodes[1].name).toBe("ask_name");
    expect(findEdge(agent, "greeting", "choose_intent")?.target).toBe("ask_name");
  });

  it("updates the initial node", () => {
    const agent = renameNode(makeAgent(), "greeting", "welcome");

    expect(agent.initial_node).toBe("welcome");
    expect(agent.nodes[0].name).toBe("welcome");
  });
});

describe("setInstruction", () => {
  it("changes an existing instruction", () => {
    const messages = [{ role: "developer", content: "Old." }];

    expect(setInstruction(messages, 0, "New.")).toEqual([{ role: "developer", content: "New." }]);
  });

  it("adds the first instruction to an empty node", () => {
    expect(setInstruction([], 0, "Greet.")).toEqual([{ role: "developer", content: "Greet." }]);
  });

  it("keeps the other instructions", () => {
    const messages = [
      { role: "developer", content: "One." },
      { role: "developer", content: "Two." },
    ];

    expect(setInstruction(messages, 1, "Second.")[0].content).toBe("One.");
  });
});

describe("uniqueName", () => {
  it("returns the base name when it is free", () => {
    expect(uniqueName("field", [])).toBe("field");
  });

  it("adds the first free number", () => {
    expect(uniqueName("field", ["field", "field_2"])).toBe("field_3");
  });
});

describe("adding and deleting", () => {
  it("adds an empty node with a free name", () => {
    const first = addNode(makeAgent());
    const second = addNode(first.agent);

    expect(first.name).toBe("new_step");
    expect(second.name).toBe("new_step_2");
    expect(second.agent.nodes.at(-1)).toEqual({ name: "new_step_2", task_messages: [] });
  });

  it("deletes a node and every transition into it", () => {
    const agent = deleteNode(makeAgent(), "confirm");

    expect(agent.nodes.map((node) => node.name)).toEqual(["greeting", "collect_details"]);
    expect(agent.nodes[1].edges).toEqual([]);
  });

  it("connects two nodes with a tool named after the target", () => {
    const first = addEdge(makeAgent(), "confirm", "greeting");
    const second = addEdge(first.agent, "confirm", "greeting");

    expect(first.tool).toBe("go_to_greeting");
    expect(second.tool).toBe("go_to_greeting_2");
    expect(findEdge(first.agent, "confirm", "go_to_greeting")).toEqual({
      function: "go_to_greeting",
      description: "Move on to greeting.",
      target: "greeting",
    });
  });

  it("deletes one transition", () => {
    const agent = deleteEdge(makeAgent(), "greeting", "choose_intent");

    expect(agent.nodes[0].edges).toEqual([]);
  });

  it("does nothing when deleting a transition of a node that does not exist", () => {
    const agent = makeAgent();

    expect(deleteEdge(agent, "missing", "choose_intent").nodes).toEqual(agent.nodes);
  });

  it("creates a blank agent that starts and ends at its greeting", () => {
    const agent = createBlankAgent();

    expect(agent.initial_node).toBe("greeting");
    expect(agent.nodes).toEqual([
      {
        name: "greeting",
        task_messages: [{ role: "developer", content: "Greet the caller and ask how you can help." }],
        end: true,
      },
    ]);
  });
});
