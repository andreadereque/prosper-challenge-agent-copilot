import { useState, type FormEvent } from "react";

import { SAMPLE_GUIDELINES } from "./sampleGuidelines";
import type { CopilotChat } from "./useCopilotChat";

const SUGGESTIONS = [
  "If the caller describes a medical emergency, tell them to call 911 and end the call.",
  "Let callers who want to cancel do it without being offered new times.",
];

type CopilotPanelProps = {
  chat: CopilotChat;
  isReviewing: boolean;
};

export function CopilotPanel({ chat, isReviewing }: CopilotPanelProps) {
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      return;
    }
    setDraft("");
    chat.send(text);
  }

  return (
    <section className="copilot" aria-label="Copilot">
      <h2 className="copilot__title">Copilot</h2>
      <div className="copilot__messages">
        {chat.messages.length === 0 && (
          <div className="copilot__empty">
            <p className="panel__hint">Describe a change and the Copilot proposes it on the graph for you to review.</p>
            <button type="button" className="button suggestion" onClick={() => setDraft(SAMPLE_GUIDELINES)}>
              Use sample client guidelines
            </button>
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className="button button--quiet suggestion" onClick={() => setDraft(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {chat.messages.map((message, index) => (
          <p key={index} className={`message message--${message.role}`}>
            {message.content}
          </p>
        ))}
        {chat.isThinking && <p className="message message--assistant message--pending">Working on it…</p>}
        {chat.failure && (
          <p className="message message--failure" role="alert">
            The Copilot could not answer. {chat.failure} Your message is kept; send again to retry.
          </p>
        )}
      </div>
      <form className="copilot__composer" onSubmit={submit}>
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
        <button type="submit" className="button button--primary" disabled={chat.isThinking || isReviewing || !draft.trim()}>
          Send
        </button>
        {isReviewing && <p className="panel__hint">Accept or reject the proposal before asking for more.</p>}
      </form>
    </section>
  );
}
