import { useState } from "react";

import { askCopilot, type ChatMessage, type CopilotResult } from "../api";
import type { Agent } from "../types";

/**
 * The Copilot conversation. It lives in the editor, not in the chat panel, so
 * other parts of the page (such as "Fix with Copilot") can send messages too.
 */
export function useCopilotChat(agent: Agent, onResult: (result: CopilotResult) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [failure, setFailure] = useState("");

  async function send(text: string) {
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setFailure("");
    setIsThinking(true);
    try {
      // The Copilot sees the agent as it is on screen, including unsaved edits.
      const result = await askCopilot(history, agent);
      setMessages([...history, { role: "assistant", content: replyText(result) }]);
      onResult(result);
    } catch (error) {
      setFailure((error as Error).message);
    } finally {
      setIsThinking(false);
    }
  }

  return { messages, isThinking, failure, send };
}

export type CopilotChat = ReturnType<typeof useCopilotChat>;

/** The reply as it is shown and kept in the history, questions included, so
 * the Copilot sees what it asked when the user answers. */
function replyText(result: CopilotResult): string {
  if (result.questions.length === 0) {
    return result.reply;
  }
  const questions = result.questions.map((question, index) => `${index + 1}. ${question}`);
  return [result.reply || "Before I build it, I need to know:", ...questions].join("\n");
}
