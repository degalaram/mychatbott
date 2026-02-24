import { useState, useEffect, useRef, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import SessionSidebar from "@/components/SessionSidebar";
import { Loader2, Bot } from "lucide-react";
import { toast } from "sonner";
import {
  generateSessionId,
  fetchSessions,
  fetchMessages,
  deleteSessionApi,
  sendMessage,
  type Session,
  type Message,
} from "@/lib/api";

const SESSION_KEY = "support_session_id";

const Index = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions on mount
  useEffect(() => {
    const init = async () => {
      try {
        const stored = await fetchSessions();
        if (stored.length > 0) {
          setSessions(stored);
          // Check localStorage for last active session
          const lastId = localStorage.getItem(SESSION_KEY);
          const activeId = lastId && stored.find((s) => s.id === lastId) ? lastId : stored[0].id;
          setActiveSessionId(activeId);
        } else {
          const newId = generateSessionId();
          localStorage.setItem(SESSION_KEY, newId);
          setActiveSessionId(newId);
        }
      } catch (e) {
        console.error("Failed to load sessions:", e);
        const newId = generateSessionId();
        localStorage.setItem(SESSION_KEY, newId);
        setActiveSessionId(newId);
      }
    };
    init();
  }, []);

  // Load messages when session changes
  useEffect(() => {
    if (!activeSessionId) return;
    localStorage.setItem(SESSION_KEY, activeSessionId);
    const load = async () => {
      try {
        const msgs = await fetchMessages(activeSessionId);
        setMessages(msgs);
      } catch {
        setMessages([]);
      }
    };
    load();
  }, [activeSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleNewChat = useCallback(() => {
    const newId = generateSessionId();
    localStorage.setItem(SESSION_KEY, newId);
    setActiveSessionId(newId);
    setMessages([]);
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteSessionApi(id);
        const updated = await fetchSessions();
        setSessions(updated);
        if (activeSessionId === id) {
          if (updated.length > 0) {
            setActiveSessionId(updated[0].id);
          } else {
            handleNewChat();
          }
        }
      } catch (e) {
        console.error("Delete failed:", e);
        toast.error("Failed to delete session");
      }
    },
    [activeSessionId, handleNewChat]
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!activeSessionId) return;

      // Optimistic user message
      const tempUserMsg: Message = {
        id: Date.now(),
        session_id: activeSessionId,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);
      setLoading(true);

      try {
        const { reply, tokensUsed } = await sendMessage(activeSessionId, text);
        const assistantMsg: Message = {
          id: Date.now() + 1,
          session_id: activeSessionId,
          role: "assistant",
          content: reply,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        console.log(`Tokens used: ${tokensUsed}`);
      } catch (e: any) {
        const errorContent = e?.message?.includes("429")
          ? "Rate limit exceeded. Please wait a moment and try again."
          : e?.message?.includes("402")
          ? "AI credits exhausted. Please try again later."
          : "Sorry, something went wrong. Please try again.";

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            session_id: activeSessionId,
            role: "assistant",
            content: errorContent,
            created_at: new Date().toISOString(),
          },
        ]);
        toast.error("Failed to get response");
      } finally {
        setLoading(false);
        // Refresh sessions list
        try {
          const updated = await fetchSessions();
          setSessions(updated);
        } catch {}
      }
    },
    [activeSessionId]
  );

  return (
    <div className="flex h-screen bg-background">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
        }}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
      />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">AI Support Assistant</h1>
            <p className="text-xs text-muted-foreground">Ask about our product</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <Bot className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">How can I help you?</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ask me about password reset, refund policy, billing, account settings, or contacting support.
              </p>
            </div>
          )}
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
};

export default Index;
