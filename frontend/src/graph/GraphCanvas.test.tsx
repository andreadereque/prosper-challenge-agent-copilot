import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeAgent } from "../test/fixtures";
import { summarize } from "./AgentNodeCard";
import { GraphCanvas } from "./GraphCanvas";

describe("GraphCanvas", () => {
  it("draws every node with its first instruction", () => {
    render(<GraphCanvas agent={makeAgent()} selection={null} onSelect={vi.fn()} onMoveNode={vi.fn()} />);

    expect(screen.getByText("greeting")).toBeInTheDocument();
    expect(screen.getByText("Ask for the full name.")).toBeInTheDocument();
    expect(screen.getByText("confirm")).toBeInTheDocument();
  });

  it("marks the start and end nodes", () => {
    render(<GraphCanvas agent={makeAgent()} selection={null} onSelect={vi.fn()} onMoveNode={vi.fn()} />);

    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
  });
});

describe("summarize", () => {
  it("says when a node has no instructions", () => {
    expect(summarize({ name: "empty" })).toBe("No instructions yet.");
  });
});
