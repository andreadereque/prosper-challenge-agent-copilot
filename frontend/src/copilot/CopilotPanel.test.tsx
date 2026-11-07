import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeAgent } from "../test/fixtures";
import { CopilotPanel } from "./CopilotPanel";
import { SAMPLE_GUIDELINES } from "./sampleGuidelines";

const user = userEvent.setup();

const result = {
  reply: "I added an emergency step.",
  proposed_agent: makeAgent(),
  operations: [],
  errors: [],
  questions: [],
};

function renderPanel(isReviewing = false) {
  const onResult = vi.fn();
  render(<CopilotPanel agent={makeAgent()} isReviewing={isReviewing} onResult={onResult} />);
  return { onResult, box: screen.getByLabelText("Message for the Copilot") };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CopilotPanel", () => {
  it("sends the chat and the agent, then shows the reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => result });
    vi.stubGlobal("fetch", fetchMock);
    const { onResult, box } = renderPanel();

    await user.type(box, "Handle emergencies.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("I added an emergency step.")).toBeInTheDocument();
    expect(screen.getByText("Handle emergencies.")).toBeInTheDocument();
    expect(onResult).toHaveBeenCalledWith(result);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      messages: [{ role: "user", content: "Handle emergencies." }],
      agent: makeAgent(),
    });
    expect(box).toHaveValue("");
  });

  it("offers example requests", async () => {
    const { box } = renderPanel();

    await user.click(screen.getByRole("button", { name: /medical emergency/ }));

    expect(box).toHaveValue(
      "If the caller describes a medical emergency, tell them to call 911 and end the call.",
    );
  });

  it("fills in the sample client guidelines", async () => {
    const { box } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Use sample client guidelines" }));

    expect(box).toHaveValue(SAMPLE_GUIDELINES);
  });

  it.each([
    ["with its own words", "A couple of things first:", "A couple of things first:"],
    ["without words", "", "Before I build it, I need to know:"],
  ])("shows the Copilot's questions %s and keeps them in the chat", async (_, reply, intro) => {
    const answer = { ...result, reply, questions: ["Where do billing calls go?", "Which slots exist?"] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => answer });
    vi.stubGlobal("fetch", fetchMock);
    const { box } = renderPanel();

    await user.type(box, "Build it.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(/Where do billing calls go/);
    await user.type(box, "Front desk.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const sent = JSON.parse(fetchMock.mock.calls[1][1].body).messages;
    expect(sent[1]).toEqual({
      role: "assistant",
      content: `${intro}\n1. Where do billing calls go?\n2. Which slots exist?`,
    });
  });

  it("keeps the message and explains when the Copilot fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: "The language model failed: timeout" }) }),
    );
    const { onResult, box } = renderPanel();

    await user.type(box, "Do something.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The Copilot could not answer. The language model failed: timeout",
    );
    expect(screen.getByText("Do something.")).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("explains a failure without details from the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => Promise.reject(new Error("not json")) }),
    );
    const { box } = renderPanel();

    await user.type(box, "Hi");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The server responded with 500.");
  });

  it("does not send an empty message", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { box } = renderPanel();

    fireEvent.change(box, { target: { value: "   " } });
    fireEvent.submit(box.closest("form") as HTMLFormElement);

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits while a proposal is being reviewed", () => {
    renderPanel(true);

    expect(screen.getByText("Accept or reject the proposal before asking for more.")).toBeInTheDocument();
  });
});
