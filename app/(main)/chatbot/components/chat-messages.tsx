import { Loader2, MessageCircle } from "lucide-react";
import { Message } from "../hooks/use-chat";
import { MarkdownMessage } from "@/components/markdown-message";

interface ChatMessagesProps {
  messages: Message[];
  loading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatMessages({ messages, loading, messagesEndRef }: ChatMessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <MessageCircle className="w-16 h-16 text-emerald-400/50 mb-4" />
            <p className="text-foreground text-lg font-medium">Welcome to MediBuddy Assistant</p>
            <p className="text-muted-foreground text-sm mt-2">Ask me about appointments, credits, doctors, and more!</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-md sm:max-w-xl lg:max-w-2xl px-4 py-3 rounded-lg shadow-sm ${
                msg.sender === "user"
                  ? "bg-emerald-600 text-white rounded-br-none"
                  : "bg-muted text-foreground rounded-bl-none border border-border"
              }`}
            >
              {msg.sender === "user" ? (
                <p className="text-sm sm:text-base">{msg.text}</p>
              ) : (
                <MarkdownMessage content={msg.text} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted text-foreground px-4 py-3 rounded-lg shadow-sm border border-border rounded-bl-none flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
