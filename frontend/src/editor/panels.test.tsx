import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeAgent } from "../test/fixtures";
import type { AgentEdge } from "../types";
import { AgentPanel } from "./AgentPanel";
import { EdgePanel } from "./EdgePanel";
import { NodePanel } from "./NodePanel";

const user = userEvent.setup();

describe("NodePanel", () => {
  function renderPanel(node = makeAgent().nodes[0]) {
    const onUpdate = vi.fn();
    const onRename = vi.fn();
    const onSelectEdge = vi.fn();
    const onDelete = vi.fn();
    render(
      <NodePanel
        node={node}
        nodeNames={["greeting", "confirm"]}
        onUpdate={onUpdate}
        onRename={onRename}
        onSelectEdge={onSelectEdge}
        isInitial={node.name === "greeting"}
        onDelete={onDelete}
      />,
    );
    return { onUpdate, onRename, onSelectEdge, onDelete };
  }

  it("edits the instructions", () => {
    const { onUpdate } = renderPanel();

    fireEvent.change(screen.getByLabelText("Instructions"), { target: { value: "Say hello." } });

    expect(onUpdate).toHaveBeenCalledWith({
      task_messages: [{ role: "developer", content: "Say hello." }],
    });
  });

  it("shows one box per instruction when there are several", () => {
    renderPanel({
      name: "multi",
      task_messages: [
        { role: "developer", content: "One." },
        { role: "developer", content: "Two." },
      ],
    });

    expect(screen.getByLabelText("Instructions (2 of 2)")).toHaveValue("Two.");
  });

  it("offers an empty box for a node without instructions", () => {
    renderPanel({ name: "empty" });

    expect(screen.getByLabelText("Instructions")).toHaveValue("");
  });

  it("sets a role override", () => {
    const { onUpdate } = renderPanel();

    fireEvent.change(screen.getByLabelText("Role override"), { target: { value: "You are a nurse." } });

    expect(onUpdate).toHaveBeenCalledWith({ role_message: "You are a nurse." });
  });

  it("clears the role override back to the persona", () => {
    const { onUpdate } = renderPanel({ name: "triage", role_message: "You are a nurse." });

    fireEvent.change(screen.getByLabelText("Role override"), { target: { value: "" } });

    expect(onUpdate).toHaveBeenCalledWith({ role_message: null });
  });

  it("lists the node's transitions and selects one", async () => {
    const { onSelectEdge } = renderPanel();

    await user.click(screen.getByRole("button", { name: "choose_intent → collect_details" }));

    expect(onSelectEdge).toHaveBeenCalledWith("choose_intent");
  });

  it("deletes a node that is not the start", async () => {
    const { onDelete } = renderPanel({ name: "confirm", end: true });

    await user.click(screen.getByRole("button", { name: "Delete node" }));

    expect(onDelete).toHaveBeenCalled();
    expect(screen.getByText("Transitions into this node are deleted too.")).toBeInTheDocument();
  });

  it("does not let you delete the start node", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "Delete node" })).toBeDisabled();
    expect(screen.getByText(/Calls start here/)).toBeInTheDocument();
  });

  it("says when a node has no transitions", () => {
    renderPanel({ name: "confirm", end: true });

    expect(screen.getByText("No transitions out of this node.")).toBeInTheDocument();
  });

  it("warns that a role override replaces the persona", () => {
    renderPanel({ name: "triage", role_message: "You are a nurse." });

    expect(screen.getByText(/replaces the whole persona/)).toBeInTheDocument();
  });

  it("marks the node as the end of the call", async () => {
    const { onUpdate } = renderPanel();

    await user.click(screen.getByLabelText("End the call after this node"));

    expect(onUpdate).toHaveBeenCalledWith({ end: true });
  });

  it("renames the node, refusing names that exist", async () => {
    const { onRename } = renderPanel();
    const name = screen.getByLabelText("Name");

    await user.clear(name);
    await user.type(name, "confirm{Enter}");
    expect(onRename).not.toHaveBeenCalled();

    await user.clear(name);
    await user.type(name, "welcome{Enter}");
    expect(onRename).toHaveBeenCalledWith("welcome");
  });
});

describe("EdgePanel", () => {
  const edge: AgentEdge = {
    function: "choose_intent",
    description: "Record the intent.",
    target: "collect_details",
    properties: { intent: { type: "string", enum: ["book", "cancel"] } },
    required: ["intent"],
  };

  function renderPanel() {
    const onUpdate = vi.fn();
    const onRenameTool = vi.fn();
    const onDelete = vi.fn();
    render(
      <EdgePanel
        edge={edge}
        sourceNode="greeting"
        nodeNames={["greeting", "collect_details", "confirm"]}
        siblingTools={["choose_intent", "transfer"]}
        onUpdate={onUpdate}
        onRenameTool={onRenameTool}
        onDelete={onDelete}
      />,
    );
    return { onUpdate, onRenameTool, onDelete };
  }

  it("shows where the transition starts and the data it collects", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Transition from greeting" })).toBeInTheDocument();
    expect(screen.getByLabelText("Allowed values, comma-separated")).toHaveValue("book, cancel");
  });

  it("edits when to call it and where it goes", async () => {
    const { onUpdate } = renderPanel();

    fireEvent.change(screen.getByLabelText("When to call it"), { target: { value: "Call it now." } });
    await user.selectOptions(screen.getByLabelText("Goes to"), "confirm");

    expect(onUpdate).toHaveBeenCalledWith({ description: "Call it now." });
    expect(onUpdate).toHaveBeenCalledWith({ target: "confirm" });
  });

  it("renames the tool, refusing a sibling's name", async () => {
    const { onRenameTool } = renderPanel();
    const name = screen.getByLabelText("Tool name");

    await user.clear(name);
    await user.type(name, "transfer{Enter}");
    expect(onRenameTool).not.toHaveBeenCalled();

    await user.clear(name);
    await user.type(name, "record_intent{Enter}");
    expect(onRenameTool).toHaveBeenCalledWith("record_intent");
  });

  it("adds a required text field", async () => {
    const { onUpdate } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Add field" }));

    expect(onUpdate).toHaveBeenCalledWith({
      properties: { intent: { type: "string", enum: ["book", "cancel"] }, field: { type: "string" } },
      required: ["intent", "field"],
    });
  });

  it("edits a field's type, description, values and whether it is required", async () => {
    const { onUpdate } = renderPanel();

    await user.selectOptions(screen.getByLabelText("Type"), "integer");
    fireEvent.change(screen.getByLabelText("What it is"), { target: { value: "The intent." } });
    fireEvent.change(screen.getByLabelText("Allowed values, comma-separated"), {
      target: { value: "book" },
    });
    await user.click(screen.getByLabelText("Required before moving on"));

    expect(onUpdate).toHaveBeenNthCalledWith(1, {
      properties: { intent: { type: "integer", enum: ["book", "cancel"] } },
      required: ["intent"],
    });
    expect(onUpdate).toHaveBeenNthCalledWith(2, {
      properties: { intent: { type: "string", description: "The intent.", enum: ["book", "cancel"] } },
      required: ["intent"],
    });
    expect(onUpdate).toHaveBeenNthCalledWith(3, {
      properties: { intent: { type: "string", enum: ["book"] } },
      required: ["intent"],
    });
    expect(onUpdate).toHaveBeenNthCalledWith(4, {
      properties: { intent: { type: "string", enum: ["book", "cancel"] } },
      required: [],
    });
  });

  it("renames a field", async () => {
    const { onUpdate } = renderPanel();
    const fieldName = screen.getByLabelText("Field name");

    await user.clear(fieldName);
    await user.type(fieldName, "goal{Enter}");

    expect(onUpdate).toHaveBeenCalledWith({
      properties: { goal: { type: "string", enum: ["book", "cancel"] } },
      required: ["goal"],
    });
  });

  it("edits one field and keeps the others", () => {
    const onUpdate = vi.fn();
    render(
      <EdgePanel
        edge={{
          ...edge,
          properties: { name: { type: "string" }, reason: { type: "string" } },
          required: ["name"],
        }}
        sourceNode="greeting"
        nodeNames={["greeting"]}
        siblingTools={[]}
        onUpdate={onUpdate}
        onRenameTool={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getAllByLabelText("What it is")[1], { target: { value: "Why they call." } });

    expect(onUpdate).toHaveBeenCalledWith({
      properties: { name: { type: "string" }, reason: { type: "string", description: "Why they call." } },
      required: ["name"],
    });
  });

  it("deletes the transition", async () => {
    const { onDelete } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete transition" }));

    expect(onDelete).toHaveBeenCalled();
  });

  it("removes a field", async () => {
    const { onUpdate } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Remove field" }));

    expect(onUpdate).toHaveBeenCalledWith({ properties: {}, required: [] });
  });
});

describe("AgentPanel", () => {
  it("edits the agent's settings", async () => {
    const onUpdate = vi.fn();
    render(<AgentPanel agent={makeAgent()} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Front desk" } });
    fireEvent.change(screen.getByLabelText("Persona (applies to every node)"), {
      target: { value: "Be brief." },
    });
    await user.selectOptions(screen.getByLabelText("Starts at"), "confirm");
    fireEvent.change(screen.getByLabelText("ElevenLabs voice ID"), { target: { value: "voice-1" } });
    fireEvent.change(screen.getByLabelText("OpenAI model"), { target: { value: "gpt-4o-mini" } });

    expect(onUpdate.mock.calls.map(([changes]) => changes)).toEqual([
      { name: "Front desk" },
      { persona: "Be brief." },
      { initial_node: "confirm" },
      { voice_id: "voice-1" },
      { model: "gpt-4o-mini" },
    ]);
  });

  it("shows empty settings as empty fields", () => {
    const agent = makeAgent();
    delete agent.persona;
    render(<AgentPanel agent={agent} onUpdate={vi.fn()} />);

    expect(screen.getByLabelText("Persona (applies to every node)")).toHaveValue("");
    expect(screen.getByLabelText("OpenAI model")).toHaveValue("");
  });
});
