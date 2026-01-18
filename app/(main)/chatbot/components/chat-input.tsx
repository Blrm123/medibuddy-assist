import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface ChatInputProps {
  prompt: string;
  setPrompt: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
}

export function ChatInput({ prompt, setPrompt, onSubmit, disabled }: ChatInputProps) {
  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-md shadow-md">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={disabled}
            placeholder="Ask me anything about your healthcare..."
            className="flex-1 text-sm sm:text-base bg-background border-border focus:ring-emerald-600/50 focus:border-emerald-600"
          />
          <Button
            type="submit"
            disabled={disabled || !prompt.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
