import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentValidationFailed, saveAgent } from "./api";
import { makeAgent } from "./test/fixtures";

function respondWith(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveAgent", () => {
  it("sends the agent as JSON", async () => {
    const fetchMock = respondWith(200);

    await saveAgent(makeAgent());

    expect(fetchMock).toHaveBeenCalledWith("/api/agent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeAgent()),
    });
  });

  it("reports every validation error", async () => {
    respondWith(422, { errors: ["First problem.", "Second problem."] });

    const failure = await saveAgent(makeAgent()).catch((error) => error);

    expect(failure).toBeInstanceOf(AgentValidationFailed);
    expect(failure.errors).toEqual(["First problem.", "Second problem."]);
  });

  it("reports any other server failure", async () => {
    respondWith(500);

    await expect(saveAgent(makeAgent())).rejects.toThrow("The server responded with 500.");
  });
});
