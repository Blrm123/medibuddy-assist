"use client";

import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { useChat } from "../hooks/use-chat";

export function ChatContainer() {
  const { prompt, setPrompt, messages, loading, handleSubmit, messagesEndRef } = useChat();

  return (
    <div className="flex flex-col h-screen bg-background pt-16">
      <ChatHeader />
      <ChatMessages messages={messages} loading={loading} messagesEndRef={messagesEndRef} />
      <ChatInput prompt={prompt} setPrompt={setPrompt} onSubmit={handleSubmit} disabled={loading} />
    </div>
  );
}
