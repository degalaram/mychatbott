import { MessageSquarePlus, Trash2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Session } from "@/lib/sessions";
import { format } from "date-fns";

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
}

const SessionSidebar = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: SessionSidebarProps) => {
  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-sidebar-background">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-sm font-semibold text-sidebar-foreground">Chats</h2>
        <Button variant="ghost" size="icon" onClick={onNewChat} className="h-8 w-8">
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No conversations yet</p>
        )}
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={`group mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              activeSessionId === session.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <div className="flex-1 truncate">
              <div className="truncate text-xs font-medium">Session</div>
              <div className="text-[10px] text-muted-foreground">
                {format(new Date(session.updatedAt), "MMM d, h:mm a")}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(session.id);
              }}
              className="hidden rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SessionSidebar;
