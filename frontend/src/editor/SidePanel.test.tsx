import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeAgent } from "../test/fixtures";
import type { Agent, Selection } from "../types";
import { SidePanel } from "./SidePanel";

function renderPanel(selection: Selection) {
  render(<SidePanel agent={makeAgent()} selection={selection} onChange={vi.fn()} onSelect={vi.fn()} />);
}

const user = userEvent.setup();

/** Renders the panel and applies its changes to a copy of the agent. */
function renderAndTrack(selection: Selection) {
  let agent = makeAgent();
  const onSelect = vi.fn();
  render(
    <SidePanel
      agent={agent}
      selection={selection}
      onChange={(update: (agent: Agent) => Agent) => {
        agent = update(agent);
      }}
      onSelect={onSelect}
    />,
  );
  return { onSelect, latestAgent: () => agent };
}

describe("SidePanel", () => {
  it("deletes a node with the transitions into it and clears the selection", async () => {
    const { onSelect, latestAgent } = renderAndTrack({ kind: "node", name: "collect_details" });

    await user.click(screen.getByRole("button", { name: "Delete node" }));

    expect(latestAgent().nodes.map((node) => node.name)).toEqual(["greeting", "confirm"]);
    expect(latestAgent().nodes[0].edges).toEqual([]);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("deletes a transition and goes back to its node", async () => {
    const { onSelect, latestAgent } = renderAndTrack({
      kind: "edge",
      node: "greeting",
      tool: "choose_intent",
    });

    await user.click(screen.getByRole("button", { name: "Delete transition" }));

    expect(latestAgent().nodes[0].edges).toEqual([]);
    expect(onSelect).toHaveBeenCalledWith({ kind: "node", name: "greeting" });
  });

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
