// jsdom cannot measure nodes, so React Flow never draws edges or drags there.
// This file swaps React Flow for a stand-in that fires the same callbacks, to
// check what GraphCanvas does with each event.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeAgent } from "../test/fixtures";
import { GraphCanvas } from "./GraphCanvas";

const user = userEvent.setup();

type FakeProps = {
  children: ReactNode;
  onNodesChange: (changes: unknown[]) => void;
  onNodeClick: (event: unknown, node: { id: string }) => void;
  onEdgeClick: (event: unknown, edge: { source: string; label: string }) => void;
  onPaneClick: () => void;
};

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  Controls: () => null,
  ReactFlow: ({ children, onNodesChange, onNodeClick, onEdgeClick, onPaneClick }: FakeProps) => (
    <div>
      <button onClick={() => onNodeClick({}, { id: "confirm" })}>click node</button>
      <button onClick={() => onEdgeClick({}, { source: "greeting", label: "choose_intent" })}>
        click edge
      </button>
      <button onClick={() => onPaneClick()}>click pane</button>
      <button
        onClick={() =>
          onNodesChange([
            { type: "position", id: "greeting", position: { x: 40, y: 80 } },
            { type: "position", id: "confirm" },
            { type: "select", id: "confirm", selected: true },
          ])
        }
      >
        drag
      </button>
      {children}
    </div>
  ),
}));

function renderCanvas() {
  const onSelect = vi.fn();
  const onMoveNode = vi.fn();
  render(<GraphCanvas agent={makeAgent()} selection={null} onSelect={onSelect} onMoveNode={onMoveNode} />);
  return { onSelect, onMoveNode };
}

describe("GraphCanvas events", () => {
  it("selects a clicked node", async () => {
    const { onSelect } = renderCanvas();

    await user.click(screen.getByText("click node"));

    expect(onSelect).toHaveBeenCalledWith({ kind: "node", name: "confirm" });
  });

  it("selects a clicked edge by its source node and tool", async () => {
    const { onSelect } = renderCanvas();

    await user.click(screen.getByText("click edge"));

    expect(onSelect).toHaveBeenCalledWith({ kind: "edge", node: "greeting", tool: "choose_intent" });
  });

  it("clears the selection when the empty canvas is clicked", async () => {
    const { onSelect } = renderCanvas();

    await user.click(screen.getByText("click pane"));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("turns only real moves into node moves", async () => {
    const { onMoveNode } = renderCanvas();

    await user.click(screen.getByText("drag"));

    expect(onMoveNode).toHaveBeenCalledOnce();
    expect(onMoveNode).toHaveBeenCalledWith("greeting", { x: 40, y: 80 });
  });
});
