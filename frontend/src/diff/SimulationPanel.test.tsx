import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeIssue, stubApi } from "../test/fakeApi";
import { makeAgent } from "../test/fixtures";
import { SimulationPanel } from "./SimulationPanel";

const user = userEvent.setup();

const turns = [
  { role: "assistant", text: "How can I help?", node: "greeting" },
  { role: "user", text: "Chest pain.", node: "greeting" },
];

function simulateWith(body: unknown, status = 200) {
  return stubApi({ "POST /api/simulate": () => ({ status, body }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SimulationPanel", () => {
  it("sends the proposed agent and the scenario, then shows a pass", async () => {
    const fetchMock = simulateWith({ turns, path: ["greeting", "emergency"], ended_by: "agent", issues: [], passed: true });
    render(<SimulationPanel agent={makeAgent()} scenario="Play a caller with chest pain." />);

    await user.click(screen.getByRole("button", { name: "Test with simulated patient" }));

    expect(await screen.findByText("Passed: no issues found.")).toBeInTheDocument();
    expect(screen.getByText("Path: greeting → emergency. The agent ended the call.")).toBeInTheDocument();
    expect(screen.getByText("Chest pain.")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      agent: makeAgent(),
      scenario: "Play a caller with chest pain.",
    });
  });

  it.each([
    ["patient", "The patient hung up."],
    ["turn_limit", "Stopped after the turn limit."],
  ])("shows a failure with the issues found and how the call ended (%s)", async (endedBy, ending) => {
    simulateWith({
      turns,
      path: ["greeting"],
      ended_by: endedBy,
      issues: [makeIssue(), makeIssue({ id: "2", title: "Too slow" })],
      passed: false,
    });
    render(<SimulationPanel agent={makeAgent()} scenario="Anything." />);

    await user.click(screen.getByRole("button", { name: "Test with simulated patient" }));

    expect(await screen.findByText("Failed: Emergency not escalated; Too slow")).toBeInTheDocument();
    expect(screen.getByText(`Path: greeting. ${ending}`)).toBeInTheDocument();
  });

  it("shows that it is running", async () => {
    let finish = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            finish = () =>
              resolve({ ok: true, status: 200, json: async () => ({ turns: [], path: ["greeting"], ended_by: "agent", issues: [], passed: true }) });
          }),
      ),
    );
    render(<SimulationPanel agent={makeAgent()} scenario="Anything." />);

    await user.click(screen.getByRole("button", { name: "Test with simulated patient" }));

    expect(screen.getByRole("button", { name: "Simulating the call…" })).toBeDisabled();
    finish();
    expect(await screen.findByText("Passed: no issues found.")).toBeInTheDocument();
  });

  it("explains a failed simulation", async () => {
    simulateWith({ error: "The simulation failed: timeout" }, 502);
    render(<SimulationPanel agent={makeAgent()} scenario="Anything." />);

    await user.click(screen.getByRole("button", { name: "Test with simulated patient" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The simulation failed. The simulation failed: timeout");
  });
});
