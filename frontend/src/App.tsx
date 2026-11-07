import { useEffect, useState } from "react";

import { fetchAgent } from "./api";
import { Editor } from "./editor/Editor";
import type { Agent } from "./types";

type LoadState =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; agent: Agent };

export function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    fetchAgent()
      .then((agent) => setState({ status: "ready", agent }))
      .catch((error: Error) => setState({ status: "failed", message: error.message }));
  }, []);

  if (state.status === "loading") {
    return <p className="page-message">Loading agent…</p>;
  }
  if (state.status === "failed") {
    return (
      <p className="page-message" role="alert">
        Could not load the agent. {state.message} Is the backend running with `make run`?
      </p>
    );
  }
  return <Editor initialAgent={state.agent} />;
}
