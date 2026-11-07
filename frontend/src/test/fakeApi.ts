import { vi } from "vitest";

import type { Call, Issue } from "../api";

type Handler = (body: unknown) => { status?: number; body: unknown };

/**
 * Replaces fetch with a tiny fake server. Routes are "METHOD /path"; anything
 * else answers 404. Returns the mock so tests can check what was sent.
 */
export function stubApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const handler = routes[`${method} ${url}`];
    if (!handler) {
      return { ok: false, status: 404, json: async () => ({ error: `No route for ${method} ${url}.` }) };
    }
    const sent = init?.body && JSON.parse(init.body as string);
    const { status = 200, body } = handler(sent);
    return { ok: status < 400, status, json: async () => body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    status: "open",
    call_id: "mock-03",
    source: "evaluator",
    title: "Emergency not escalated",
    severity: "high",
    node: "collect_details",
    turn_index: 1,
    evidence: "strong pain in my chest",
    explanation: "Chest pain must be escalated.",
    suggested_fix: "Add an emergency path.",
    ...overrides,
  };
}

export function makeCall(): Call {
  return {
    id: "mock-03",
    source: "mock",
    agent_name: "Clinic scheduler",
    started_at: "2026-11-04T08:47:03",
    turns: [
      { role: "assistant", text: "What is your name?", node: "collect_details" },
      { role: "user", text: "Robert. I have a strong pain in my chest.", node: "collect_details" },
    ],
  };
}
