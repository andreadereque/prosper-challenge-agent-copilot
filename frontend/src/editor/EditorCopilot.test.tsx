import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeAgent } from "../test/fixtures";
import type { Agent } from "../types";
import { Editor } from "./Editor";

const user = userEvent.setup();

function withEmergencyStep(): Agent {
  const agent = makeAgent();
  agent.nodes.push({ name: "emergency", task_messages: [{ role: "developer", content: "Call 911." }], end: true });
  agent.nodes[1].edges?.push({ function: "escalate", description: "Emergency.", target: "emergency" });
  return agent;
}

/** Answers the Copilot with `proposed` and accepts any save. */
function serve(proposed: Agent, errors: string[] = [], questions: string[] = []) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/copilot") {
      return { ok: true, status: 200, json: async () => ({ reply: "Done.", proposed_agent: proposed, operations: [], errors, questions }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function askCopilot() {
  const view = render(<Editor initialAgent={makeAgent()} />);
  await user.type(screen.getByLabelText("Message for the Copilot"), "Add an emergency step.");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText(/^Done\./);
  return view.container.querySelector(".graph-canvas") as HTMLElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Editor with the Copilot", () => {
  it("shows a proposal on the graph and pauses editing", async () => {
    serve(withEmergencyStep());

    const canvas = await askCopilot();

    expect(within(canvas).getByText("New")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Copilot proposal" })).toHaveTextContent("Added step emergency");
    expect(screen.getByRole("button", { name: "Add node" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    // Only fixes for an issue have a caller to replay.
    expect(screen.queryByRole("button", { name: "Test with simulated patient" })).not.toBeInTheDocument();
  });

  it("rejecting leaves the agent as it was", async () => {
    const fetchMock = serve(withEmergencyStep());
    const canvas = await askCopilot();

    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(within(canvas).queryByText("emergency")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Edit agent" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepting saves the proposal through the normal save", async () => {
    const proposed = withEmergencyStep();
    const fetchMock = serve(proposed);
    const canvas = await askCopilot();

    await user.click(screen.getByRole("button", { name: "Accept and save" }));

    expect(await screen.findByRole("link", { name: "Call" })).toBeInTheDocument();
    expect(within(canvas).getByText("emergency")).toBeInTheDocument();
    expect(within(canvas).queryByText("New")).not.toBeInTheDocument();
    const [url, request] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("/api/agent");
    expect(JSON.parse(request.body as string)).toEqual(proposed);
  });

  it("cannot accept a proposal that would break the agent", async () => {
    serve(withEmergencyStep(), ["Node 'emergency' cannot be reached from the initial node."]);

    await askCopilot();

    expect(screen.getByRole("button", { name: "Accept and save" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("cannot be accepted");
  });

  it("shows no proposal when the Copilot changes nothing", async () => {
    serve(makeAgent());

    await askCopilot();

    expect(screen.queryByRole("region", { name: "Copilot proposal" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Edit agent" })).toBeInTheDocument();
  });

  it("shows no proposal while the Copilot is asking questions", async () => {
    serve(withEmergencyStep(), [], ["Where should billing calls go?"]);

    await askCopilot();

    expect(screen.queryByRole("region", { name: "Copilot proposal" })).not.toBeInTheDocument();
  });

  it("marks edited and removed steps", async () => {
    const proposed = makeAgent();
    proposed.nodes[0].task_messages = [{ role: "developer", content: "Say hi." }];
    proposed.nodes = proposed.nodes.filter((node) => node.name !== "confirm");
    proposed.nodes[1].edges = [];
    proposed.nodes[1].end = true;
    serve(proposed);

    const canvas = await askCopilot();

    expect(within(canvas).getAllByText("Edited")).toHaveLength(2);
    expect(within(canvas).getByText("Removed")).toBeInTheDocument();
  });
});
