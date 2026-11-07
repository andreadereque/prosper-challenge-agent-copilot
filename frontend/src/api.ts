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
