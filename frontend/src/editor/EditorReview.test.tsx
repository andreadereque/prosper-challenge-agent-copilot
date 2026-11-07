import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeCall, makeIssue, stubApi } from "../test/fakeApi";
import { makeAgent } from "../test/fixtures";
import type { Agent } from "../types";
import { Editor } from "./Editor";

const user = userEvent.setup();

function withEmergencyStep(): Agent {
  const agent = makeAgent();
  agent.nodes.push({ name: "emergency", end: true });
  agent.nodes[1].edges?.push({ function: "escalate", description: "Emergency.", target: "emergency" });
  return agent;
}

function serve(proposed: Agent) {
  return stubApi({
    "GET /api/issues": () => ({ body: [makeIssue()] }),
    "GET /api/calls": () => ({ body: [] }),
    "GET /api/calls/mock-03": () => ({ body: makeCall() }),
    "POST /api/copilot": () => ({
      body: { reply: "Added an emergency step.", proposed_agent: proposed, operations: [], errors: [], questions: [] },
    }),
    "PUT /api/agent": () => ({ body: {} }),
    "PATCH /api/issues/issue-1": () => ({ body: makeIssue({ status: "resolved" }) }),
  });
}

async function fixTheIssue() {
  const view = render(<Editor initialAgent={makeAgent()} />);
  await user.click(screen.getByRole("button", { name: "Calls & issues" }));
  await user.click(await screen.findByRole("button", { name: "Fix with Copilot" }));
  await screen.findByText("Added an emergency step.");
  return view;
}

function patchCalls(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Editor fixing an issue", () => {
  it("sends the issue to the Copilot and shows the proposal on the graph", async () => {
    serve(withEmergencyStep());

    await fixTheIssue();

    expect(screen.getByText(/Issue: Emergency not escalated \(high\)/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Copilot proposal" })).toHaveTextContent("Added step emergency");
    expect(screen.getByRole("button", { name: "Test with simulated patient" })).toBeInTheDocument();
  });

  it("marks the issue resolved when the fix is accepted", async () => {
    const fetchMock = serve(withEmergencyStep());
    await fixTheIssue();

    await user.click(screen.getByRole("button", { name: "Accept and save" }));

    await vi.waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    expect(JSON.parse(patchCalls(fetchMock)[0][1]?.body as string)).toEqual({ status: "resolved" });
  });

  it("keeps the issue open when the fix is rejected", async () => {
    const fetchMock = serve(withEmergencyStep());
    await fixTheIssue();

    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(patchCalls(fetchMock)).toHaveLength(0);
  });

  it("forgets the issue when the Copilot changes nothing", async () => {
    const fetchMock = serve(makeAgent());
    await fixTheIssue();

    // A later, unrelated proposal must not resolve the issue.
    vi.mocked(fetch).mockClear();
    stubApi({
      "POST /api/copilot": () => ({
        body: { reply: "Done.", proposed_agent: withEmergencyStep(), operations: [], errors: [], questions: [] },
      }),
      "PUT /api/agent": () => ({ body: {} }),
    });
    await user.type(screen.getByLabelText("Message for the Copilot"), "Add a step.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(await screen.findByRole("button", { name: "Accept and save" }));

    expect(patchCalls(fetchMock)).toHaveLength(0);
    expect(patchCalls(vi.mocked(fetch) as ReturnType<typeof stubApi>)).toHaveLength(0);
  });

  it("switches between the graph and the calls", async () => {
    serve(makeAgent());
    const view = render(<Editor initialAgent={makeAgent()} />);

    await user.click(screen.getByRole("button", { name: "Calls & issues" }));
    expect(await screen.findByRole("region", { name: "Issues" })).toBeInTheDocument();
    expect(view.container.querySelector(".graph-canvas")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Graph" }));
    expect(screen.getByRole("button", { name: "Graph" })).toHaveAttribute("aria-pressed", "true");
    expect(view.container.querySelector(".graph-canvas")).not.toBeNull();
  });

  it("shows an issue's node on the graph", async () => {
    serve(makeAgent());
    const view = render(<Editor initialAgent={makeAgent()} />);

    await user.click(screen.getByRole("button", { name: "Calls & issues" }));
    await user.click(await screen.findByRole("button", { name: "Show node" }));

    const canvas = view.container.querySelector(".graph-canvas") as HTMLElement;
    expect(within(canvas).getByText("collect_details")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Edit node" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("collect_details");
  });
});
