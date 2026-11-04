"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";

export function AgentChat() {
  const [input, setInput] = useState("");

  const { messages, error, sendMessage } = useChat();

  const handleSubmit = (message: PromptInputMessage) => {
    sendMessage({ text: input });
    setInput("");
  };

  if (error) return <div>{error.message}</div>;

  return (
      <div className="flex h-full min-h-0 flex-col">
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.map((m) =>
                m.parts.map((p, i) => {
                  switch (p.type) {
                    case "text":
                      return (
                          <Message key={`${m.id}-${i}`} from={m.role}>
                            <MessageContent>
                              <MessageResponse>{p.text}</MessageResponse>
                            </MessageContent>
                          </Message>
                      );
                    default:
                      return null;
                  }
                }),
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t p-3">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                  value={input}
                  onChange={(e) => setInput(e.currentTarget.value)}
                  placeholder="Ask the agent"
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
              <PromptInputSubmit status="ready" disabled={!input.trim()} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
  );
}