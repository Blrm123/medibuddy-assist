import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ChatHeader() {
  return (
    <div className="border-b border-border bg-background/80 backdrop-blur-md shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-900/20 border border-emerald-700/30 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">MediBuddy Assistant</h1>
              <p className="text-sm text-muted-foreground">Your healthcare companion, 24/7</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-900/20 border-emerald-700/30 text-emerald-400">
            Online
          </Badge>
        </div>
      </div>
    </div>
  );
}
