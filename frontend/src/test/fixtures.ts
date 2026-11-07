import type { Agent } from "../types";

/** A small clinic agent: greeting -> collect_details -> confirm. */
export function makeAgent(): Agent {
  return {
    name: "Clinic scheduler",
    initial_node: "greeting",
    persona: "You are a scheduling assistant.",
    nodes: [
      {
        name: "greeting",
        task_messages: [{ role: "developer", content: "Greet the caller." }],
        edges: [
          { function: "choose_intent", description: "Record the intent.", target: "collect_details" },
        ],
      },
      {
        name: "collect_details",
        task_messages: [{ role: "developer", content: "Ask for the full name." }],
        edges: [
          { function: "record_details", description: "Record the name.", target: "confirm" },
        ],
      },
      {
        name: "confirm",
        task_messages: [{ role: "developer", content: "Confirm and say goodbye." }],
        end: true,
      },
    ],
  };
}
