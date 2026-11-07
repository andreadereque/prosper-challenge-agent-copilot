import type { Agent } from "./types";

/** The server refused the agent; `errors` lists every problem it found. */
export class AgentValidationFailed extends Error {
  errors: string[];

  constructor(errors: string[]) {
    super("The agent has errors.");
    this.errors = errors;
  }
}

export async function fetchAgent(): Promise<Agent> {
  const response = await fetch("/api/agent");
  if (!response.ok) {
    throw new Error(`The server responded with ${response.status}.`);
  }
  return response.json();
}

export async function saveAgent(agent: Agent): Promise<void> {
  const response = await fetch("/api/agent", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(agent),
  });
  if (response.status === 422) {
    const body = await response.json();
    throw new AgentValidationFailed(body.errors);
  }
  if (!response.ok) {
    throw new Error(`The server responded with ${response.status}.`);
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type CopilotResult = {
  reply: string;
  proposed_agent: Agent;
  operations: { tool: string; arguments: Record<string, unknown> }[];
  errors: string[];
  /** Asked before changing anything; the user answers in the chat. */
  questions: string[];
};

export async function askCopilot(messages: ChatMessage[], agent: Agent): Promise<CopilotResult> {
  const response = await fetch("/api/copilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, agent }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `The server responded with ${response.status}.`);
  }
  return response.json();
}

export type Severity = "high" | "medium" | "low";

export type Issue = {
  id: string;
  status: "open" | "resolved";
  call_id: string | null;
  source: "evaluator" | "client";
  title: string;
  severity: Severity;
  node: string | null;
  turn_index: number | null;
  evidence: string;
  explanation: string;
  suggested_fix: string;
};

export type CallTurn = { role: "user" | "assistant"; text: string; node: string | null };

export type CallSummary = {
  id: string;
  source: "real" | "mock";
  agent_name: string;
  started_at: string;
  turn_count: number;
};

export type Call = Omit<CallSummary, "turn_count"> & { turns: CallTurn[] };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `The server responded with ${response.status}.`);
  }
  return response.json();
}

function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export function fetchIssues(): Promise<Issue[]> {
  return request("/api/issues");
}

export function fetchCalls(): Promise<CallSummary[]> {
  return request("/api/calls");
}

export function fetchCall(id: string): Promise<Call> {
  return request(`/api/calls/${id}`);
}

export function evaluateCalls(): Promise<Issue[]> {
  return request("/api/calls/evaluate", { method: "POST" });
}

export function reportIssue(title: string, description: string, node: string | null): Promise<Issue> {
  return request("/api/issues", jsonBody("POST", { title, description, node }));
}

export function setIssueStatus(id: string, status: Issue["status"]): Promise<Issue> {
  return request(`/api/issues/${id}`, jsonBody("PATCH", { status }));
}

export type SimulationResult = {
  turns: CallTurn[];
  path: string[];
  ended_by: "agent" | "patient" | "turn_limit";
  issues: Issue[];
  passed: boolean;
};

export function simulateCall(agent: Agent, scenario: string): Promise<SimulationResult> {
  return request("/api/simulate", jsonBody("POST", { agent, scenario }));
}
