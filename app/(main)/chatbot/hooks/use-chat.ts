import { useState, FormEvent, useRef, useEffect } from "react";

export interface Message {
  text: string;
  sender: "user" | "bot";
  id: string;
}

export function useChat() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const messageId = Date.now().toString();
    const userMessage = { text: prompt, sender: "user" as const, id: messageId };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Network response was not OK (${response.status}): ${errorData.message || response.statusText}`
        );
      }

      const data = await response.json();
      const botMessage = {
        text: data.text,
        sender: "bot" as const,
        id: (Date.now() + 1).toString(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Fetch error:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: "Sorry, something went wrong. Please try again.",
          sender: "bot" as const,
          id: (Date.now() + 1).toString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return {
    prompt,
    setPrompt,
    messages,
    loading,
    handleSubmit,
    messagesEndRef,
  } as const;
}
