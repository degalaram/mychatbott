import { useState, useEffect, useRef, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import SessionSidebar from "@/components/SessionSidebar";
import { Loader2, Bot } from "lucide-react";
import {
  getSessions,
  createSession,
  getMessages,
  addMessage,
  deleteSession,
  type Session,
  type Message,
} from "@/lib/sessions";
import { getAssistantReply } from "@/lib/assistant";

const Index = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions on mount
  useEffect(() => {
    const stored = getSessions();
    if (stored.length === 0) {
      const s = createSession();
      setSessions([s]);
      setActiveSessionId(s.id);
    } else {
      setSessions(stored);
      setActiveSessionId(stored[0].id);
    }
  }, []);

  // Load messages when session changes
  useEffect(() => {
    if (activeSessionId) {
      setMessages(getMessages(activeSessionId));
    }
  }, [activeSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleNewChat = useCallback(() => {
    const s = createSession();
    setSessions(getSessions());
    setActiveSessionId(s.id);
    setMessages([]);
  }, []);

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSession(id);
      const updated = getSessions();
      setSessions(updated);
      if (activeSessionId === id) {
        if (updated.length > 0) {
          setActiveSessionId(updated[0].id);
          setMessages(getMessages(updated[0].id));
        } else {
          const s = createSession();
          setSessions(getSessions());
          setActiveSessionId(s.id);
          setMessages([]);
        }
      }
    },
    [activeSessionId]
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!activeSessionId) return;

      const userMsg = addMessage(activeSessionId, "user", text);
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const { reply } = await getAssistantReply(activeSessionId, text);
        const assistantMsg = addMessage(activeSessionId, "assistant", reply);
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errorMsg = addMessage(activeSessionId, "assistant", "Sorry, something went wrong. Please try again.");
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
        setSessions(getSessions());
      }
    },
    [activeSessionId]
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setMessages(getMessages(id));
        }}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">AI Support Assistant</h1>
            <p className="text-xs text-muted-foreground">Ask about our product</p>
          </div>
        </header>

        {/* Messages */}
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

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
};

export default Index;
