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
