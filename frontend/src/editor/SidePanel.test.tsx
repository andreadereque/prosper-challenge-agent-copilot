import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeAgent } from "../test/fixtures";
import type { Selection } from "../types";
import { SidePanel } from "./SidePanel";

function renderPanel(selection: Selection) {
  render(<SidePanel agent={makeAgent()} selection={selection} onChange={vi.fn()} onSelect={vi.fn()} />);
}

describe("SidePanel", () => {
  it("shows the node editor for a selected node", () => {
    renderPanel({ kind: "node", name: "greeting" });

    expect(screen.getByRole("region", { name: "Edit node" })).toBeInTheDocument();
  });

  it("shows the edge editor for a selected edge", () => {
    renderPanel({ kind: "edge", node: "greeting", tool: "choose_intent" });

    expect(screen.getByRole("region", { name: "Edit edge" })).toBeInTheDocument();
  });

  it.each<Selection>([
    { kind: "node", name: "missing" },
    { kind: "edge", node: "greeting", tool: "missing" },
    { kind: "edge", node: "missing", tool: "choose_intent" },
    { kind: "edge", node: "confirm", tool: "choose_intent" },
  ])("falls back to the agent settings when the selection no longer exists: %j", (selection) => {
    renderPanel(selection);

    expect(screen.getByRole("region", { name: "Edit agent" })).toBeInTheDocument();
  });
});
