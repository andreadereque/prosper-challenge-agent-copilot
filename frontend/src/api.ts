import type { Agent } from "./types";

export async function fetchAgent(): Promise<Agent> {
  const response = await fetch("/api/agent");
  if (!response.ok) {
    throw new Error(`The server responded with ${response.status}.`);
  }
  return response.json();
}
