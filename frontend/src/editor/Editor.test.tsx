import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { makeAgent } from "../test/fixtures";
import { Editor } from "./Editor";

// React Flow's drag handling does not support user-event's full pointer
// sequence in jsdom, so clicks on the canvas use fireEvent.
const user = userEvent.setup();

function renderEditor() {
  const view = render(<Editor initialAgent={makeAgent()} />);
  const canvas = view.container.querySelector(".graph-canvas") as HTMLElement;
  return { canvas };
}

describe("Editor", () => {
  it("starts on the agent's settings with no unsaved changes", () => {
    renderEditor();

    expect(screen.getByRole("region", { name: "Edit agent" })).toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("edits a node picked on the graph and redraws it", async () => {
    const { canvas } = renderEditor();

    fireEvent.click(within(canvas).getByText("collect_details"));
    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "Ask for the date of birth." },
    });

    expect(within(canvas).getByText("Ask for the date of birth.")).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("keeps the node selected after renaming it", async () => {
    const { canvas } = renderEditor();

    fireEvent.click(within(canvas).getByText("collect_details"));
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "ask_name{Enter}");

    expect(within(canvas).getByText("ask_name")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("ask_name");
  });

  it("edits a transition picked from its node and keeps it selected after a rename", async () => {
    const { canvas } = renderEditor();

    fireEvent.click(within(canvas).getByText("greeting"));
    await user.click(screen.getByRole("button", { name: "choose_intent → collect_details" }));
    const toolName = screen.getByLabelText("Tool name");
    await user.clear(toolName);
    await user.type(toolName, "record_intent{Enter}");

    expect(screen.getByLabelText("Tool name")).toHaveValue("record_intent");
    fireEvent.click(within(canvas).getByText("greeting"));
    expect(screen.getByRole("button", { name: "record_intent → collect_details" })).toBeInTheDocument();
  });

  it("edits when a transition should be taken", async () => {
    const { canvas } = renderEditor();

    fireEvent.click(within(canvas).getByText("greeting"));
    await user.click(screen.getByRole("button", { name: "choose_intent → collect_details" }));
    fireEvent.change(screen.getByLabelText("When to call it"), {
      target: { value: "Once the caller says what they want." },
    });

    expect(screen.getByLabelText("When to call it")).toHaveValue("Once the caller says what they want.");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("goes back to the agent's settings when you click the empty canvas", async () => {
    const { canvas } = renderEditor();

    fireEvent.click(within(canvas).getByText("confirm"));
    fireEvent.click(canvas.querySelector(".react-flow__pane") as HTMLElement);

    expect(screen.getByRole("region", { name: "Edit agent" })).toBeInTheDocument();
  });

  it("moves a node with the keyboard and marks the agent as changed", async () => {
    const { canvas } = renderEditor();
    const node = canvas.querySelector('[data-id="greeting"]') as HTMLElement;

    fireEvent.click(within(node).getByText("greeting"));
    fireEvent.keyDown(node, { key: "ArrowRight" });

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("adds a node and opens it", async () => {
    const { canvas } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Add node" }));

    expect(within(canvas).getByText("new_step")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("new_step");
  });

  it("starts a new agent straight away when nothing is unsaved", async () => {
    renderEditor();

    await user.click(screen.getByRole("button", { name: "New agent" }));

    expect(screen.getByRole("heading", { name: "New agent" })).toBeInTheDocument();
  });

  it("asks before discarding unsaved changes for a new agent", async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Front desk" } });

    await user.click(screen.getByRole("button", { name: "New agent" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("heading", { name: "Front desk" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New agent" }));
    await user.click(screen.getByRole("button", { name: "Discard and start over" }));
    expect(screen.getByRole("heading", { name: "New agent" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Discard changes" })).not.toBeInTheDocument();
  });

  it("changes the agent's name from its settings", () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Front desk" } });

    expect(screen.getByRole("heading", { name: "Front desk" })).toBeInTheDocument();
  });
});
