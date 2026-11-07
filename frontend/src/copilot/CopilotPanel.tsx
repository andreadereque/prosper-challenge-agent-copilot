import { useState, type FormEvent } from "react";

import { askCopilot, type ChatMessage, type CopilotResult } from "../api";
import type { Agent } from "../types";

const SUGGESTIONS = [
  "If the caller describes a medical emergency, tell them to call 911 and end the call.",
  "Let callers who want to cancel do it without being offered new times.",
];

type CopilotPanelProps = {
  agent: Agent;
  isReviewing: boolean;
  onResult: (result: CopilotResult) => void;
};

export function CopilotPanel({ agent, isReviewing, onResult }: CopilotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [failure, setFailure] = useState("");

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      return;
    }
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setDraft("");
    setFailure("");
    setIsThinking(true);
    try {
      // The Copilot sees the agent as it is on screen, including unsaved edits.
      const result = await askCopilot(history, agent);
      setMessages([...history, { role: "assistant", content: result.reply }]);
      onResult(result);
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setIsThinking(false);
    }
  }

  return (
    <section className="copilot" aria-label="Copilot">
      <h2 className="copilot__title">Copilot</h2>
      <div className="copilot__messages">
        {messages.length === 0 && (
          <div className="copilot__empty">
            <p className="panel__hint">Describe a change and the Copilot proposes it on the graph for you to review.</p>
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className="button button--quiet suggestion" onClick={() => setDraft(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {messages.map((message, index) => (
          <p key={index} className={`message message--${message.role}`}>
            {message.content}
          </p>
        ))}
        {isThinking && <p className="message message--assistant message--pending">Working on it…</p>}
        {failure && (
          <p className="message message--failure" role="alert">
            The Copilot could not answer. {failure} Your message is kept; send again to retry.
          </p>
        )}
      </div>
      <form className="copilot__composer" onSubmit={send}>
        <label className="visually-hidden" htmlFor="copilot-message">
          Message for the Copilot
        </label>
        <textarea
          id="copilot-message"
          className="field__input"
          rows={3}
          placeholder="Ask for a change or paste a client's instructions"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="button button--primary" disabled={isThinking || isReviewing || !draft.trim()}>
          Send
        </button>
        {isReviewing && <p className="panel__hint">Accept or reject the proposal before asking for more.</p>}
      </form>
    </section>
  );
}
