// Connecting two nodes is a drag between handles, which jsdom cannot do with
// the real React Flow. This stand-in fires the same onConnect callback.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeAgent } from "../test/fixtures";
import { Editor } from "./Editor";

const user = userEvent.setup();

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  Controls: () => null,
  ReactFlow: ({ onConnect }: { onConnect: (connection: { source: string; target: string }) => void }) => (
    <button onClick={() => onConnect({ source: "confirm", target: "greeting" })}>connect</button>
  ),
}));

describe("Editor connecting nodes", () => {
  it("adds a transition and opens it", async () => {
    render(<Editor initialAgent={makeAgent()} />);

    await user.click(screen.getByText("connect"));

    expect(screen.getByRole("heading", { name: "Transition from confirm" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tool name")).toHaveValue("go_to_greeting");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });
});
