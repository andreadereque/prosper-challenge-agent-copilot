// The agent as stored in backend/agent.json. Mirrors backend/agent_builder/schema.py.

export type Message = { role: string; content: string };

export type Position = { x: number; y: number };

export type PropertySchema = {
  type: string;
  description?: string;
  enum?: string[];
};

export type AgentEdge = {
  function: string;
  description: string;
  target: string;
  properties?: Record<string, PropertySchema>;
  required?: string[];
};

export type AgentNode = {
  name: string;
  task_messages?: Message[];
  role_message?: string | null;
  edges?: AgentEdge[];
  pre_actions?: unknown[];
  post_actions?: unknown[];
  end?: boolean;
  // Editor-only: where the node sits on the canvas. The runtime ignores it.
  position?: Position;
};

export type Agent = {
  name: string;
  initial_node: string;
  nodes: AgentNode[];
  persona?: string;
  voice_id?: string;
  model?: string;
};
