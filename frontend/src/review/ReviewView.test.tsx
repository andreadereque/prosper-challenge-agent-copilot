import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeCall, makeIssue, stubApi } from "../test/fakeApi";
import { ReviewView } from "./ReviewView";

const user = userEvent.setup();

const CALLS = [
  { id: "mock-03", source: "mock", agent_name: "Clinic", started_at: "2026-11-04T08:47:03", turn_count: 2 },
  { id: "20261107-163005", source: "real", agent_name: "Clinic", started_at: "2026-11-07T16:30:05", turn_count: 4 },
];

function renderView(routes = {}, canFix = true) {
  const fetchMock = stubApi({
    "GET /api/issues": () => ({ body: [] }),
    "GET /api/calls": () => ({ body: CALLS }),
    "GET /api/calls/mock-03": () => ({ body: makeCall() }),
    ...routes,
  });
  const onFix = vi.fn();
  const onShowNode = vi.fn();
  render(<ReviewView nodeNames={["greeting", "collect_details"]} canFix={canFix} onFix={onFix} onShowNode={onShowNode} />);
  return { fetchMock, onFix, onShowNode };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReviewView", () => {
  it("lists calls and opens a transcript with the node of each turn", async () => {
    renderView();

    await user.click(await screen.findByRole("button", { name: /mock-03/ }));

    const transcript = screen.getByRole("list", { name: "Transcript of mock-03" });
    expect(within(transcript).getByText("Robert. I have a strong pain in my chest.")).toBeInTheDocument();
    expect(within(transcript).getAllByText("collect_details")).toHaveLength(2);
    expect(screen.getByText(/Made-up · 2 turns/)).toBeInTheDocument();
    expect(screen.getByText(/4 turns · 2026-11-07 16:30:05/)).toBeInTheDocument();
  });

  it("says there are no issues yet", async () => {
    renderView();

    expect(await screen.findByText(/No issues yet/)).toBeInTheDocument();
  });

  it("analyzes the calls and lists issues open first, then by severity", async () => {
    renderView({
      "POST /api/calls/evaluate": () => ({
        body: [
          makeIssue({ id: "a", title: "Low one", severity: "low" }),
          makeIssue({ id: "b", title: "Fixed one", severity: "high", status: "resolved" }),
          makeIssue({ id: "c", title: "High one", severity: "high" }),
          makeIssue({ id: "d", title: "Medium one", severity: "medium" }),
        ],
      }),
    });

    await user.click(await screen.findByRole("button", { name: "Analyze calls" }));

    const titles = (await screen.findAllByRole("article")).map((card) => card.getAttribute("aria-label"));
    expect(titles).toEqual(["High one", "Medium one", "Low one", "Fixed one"]);
    expect(within(screen.getByRole("article", { name: "Fixed one" })).getByRole("button", { name: "Fix with Copilot" })).toBeDisabled();
  });

  it("shows that it is analyzing", async () => {
    let finish = () => {};
    renderView({
      "POST /api/calls/evaluate": () => ({ body: [] }),
    });
    const fetchMock = vi.mocked(fetch);
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementationOnce(
      (url, init) => new Promise((resolve) => (finish = () => resolve(original?.(url as string, init) as never))),
    );

    await user.click(await screen.findByRole("button", { name: "Analyze calls" }));

    expect(screen.getByRole("button", { name: "Analyzing calls…" })).toBeDisabled();
    finish();
    expect(await screen.findByRole("button", { name: "Analyze calls" })).toBeEnabled();
  });

  it("shows the evidence, explanation and suggested fix of an issue", async () => {
    renderView({ "GET /api/issues": () => ({ body: [makeIssue()] }) });

    const card = await screen.findByRole("article", { name: "Emergency not escalated" });

    expect(card).toHaveTextContent("Found in call mock-03 · node collect_details");
    expect(card).toHaveTextContent("“strong pain in my chest”");
    expect(card).toHaveTextContent("Suggested fix: Add an emergency path.");
  });

  it("opens the call of an issue at the turn it quotes", async () => {
    renderView({ "GET /api/issues": () => ({ body: [makeIssue()] }) });

    await user.click(await screen.findByRole("button", { name: "Show in call" }));

    const turns = within(screen.getByRole("list", { name: "Transcript of mock-03" })).getAllByRole("listitem");
    expect(turns[1]).toHaveClass("transcript__turn--highlighted");
    expect(turns[0]).not.toHaveClass("transcript__turn--highlighted");
  });

  it("fixes an issue with its call and shows its node", async () => {
    const { onFix, onShowNode } = renderView({ "GET /api/issues": () => ({ body: [makeIssue()] }) });

    await user.click(await screen.findByRole("button", { name: "Fix with Copilot" }));
    await user.click(screen.getByRole("button", { name: "Show node" }));

    expect(onFix).toHaveBeenCalledWith(makeIssue(), makeCall());
    expect(onShowNode).toHaveBeenCalledWith("collect_details");
  });

  it("fixes a client issue without a call", async () => {
    const report = makeIssue({ source: "client", call_id: null, node: null, evidence: "", explanation: "", suggested_fix: "" });
    const { onFix } = renderView({ "GET /api/issues": () => ({ body: [report] }) });

    const card = await screen.findByRole("article", { name: "Emergency not escalated" });
    await user.click(within(card).getByRole("button", { name: "Fix with Copilot" }));

    expect(card).toHaveTextContent("Reported by the client");
    expect(within(card).queryByRole("button", { name: "Show in call" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Show node" })).not.toBeInTheDocument();
    expect(onFix).toHaveBeenCalledWith(report, null);
  });

  it("does not offer fixes while the Copilot is busy", async () => {
    renderView({ "GET /api/issues": () => ({ body: [makeIssue()] }) }, false);

    expect(await screen.findByRole("button", { name: "Fix with Copilot" })).toBeDisabled();
  });

  it("records an issue a client reported", async () => {
    const reported = makeIssue({ id: "new", source: "client", call_id: null, title: "Wrong clinic name" });
    const { fetchMock } = renderView({ "POST /api/issues": () => ({ body: reported }) });

    await user.type(await screen.findByLabelText("What the client reported"), "Wrong clinic name");
    await user.type(screen.getByLabelText("Details"), "It used the old name.");
    await user.selectOptions(screen.getByLabelText("Step it is about (optional)"), "greeting");
    await user.click(screen.getByRole("button", { name: "Add issue" }));

    expect(await screen.findByRole("article", { name: "Wrong clinic name" })).toBeInTheDocument();
    const [, request] = fetchMock.mock.calls.find(([url, init]) => url === "/api/issues" && init?.method === "POST") as [string, RequestInit];
    expect(JSON.parse(request.body as string)).toEqual({ title: "Wrong clinic name", description: "It used the old name.", node: "greeting" });
    expect(screen.getByLabelText("What the client reported")).toHaveValue("");
  });

  it("reports a client issue without a step", async () => {
    const { fetchMock } = renderView({ "POST /api/issues": () => ({ body: makeIssue({ id: "new" }) }) });

    await user.type(await screen.findByLabelText("What the client reported"), "Too slow");
    await user.type(screen.getByLabelText("Details"), "Long pauses.");
    await user.click(screen.getByRole("button", { name: "Add issue" }));

    await screen.findByRole("article");
    const [, request] = fetchMock.mock.calls.find(([url, init]) => url === "/api/issues" && init?.method === "POST") as [string, RequestInit];
    expect(JSON.parse(request.body as string).node).toBeNull();
  });

  it("explains when loading fails", async () => {
    renderView({ "GET /api/issues": () => ({ status: 500, body: {} }) });

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. The server responded with 500.");
  });

  it("explains when an analysis fails", async () => {
    renderView({ "POST /api/calls/evaluate": () => ({ status: 502, body: { error: "The evaluation failed: timeout" } }) });

    await user.click(await screen.findByRole("button", { name: "Analyze calls" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The evaluation failed: timeout");
  });
});
