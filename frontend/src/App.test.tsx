import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { makeAgent } from "./test/fixtures";

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("shows a loading message, then the agent's graph", async () => {
    respondWith(200, makeAgent());

    const { container } = render(<App />);

    expect(screen.getByText("Loading agent…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Clinic scheduler" })).toBeInTheDocument();
    const canvas = container.querySelector(".graph-canvas") as HTMLElement;
    expect(within(canvas).getByText("collect_details")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/agent");
  });

  it("explains when the agent cannot be loaded", async () => {
    respondWith(500, {});

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load the agent. The server responded with 500.",
    );
  });
});
