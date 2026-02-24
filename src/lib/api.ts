import { supabase } from "@/integrations/supabase/client";

export interface Session {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

type StreamHandlers = {
  onDelta: (delta: string) => void;
  onDone: (tokensUsed: number) => void;
};

const CHAT_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export async function fetchSessions(): Promise<Session[]> {
  const { data, error } = await supabase.functions.invoke("sessions", {
    method: "GET",
  });
  if (error) throw error;
  return data || [];
}

export async function fetchMessages(sessionId: string): Promise<Message[]> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/conversations?sessionId=${sessionId}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!resp.ok) throw new Error("Failed to fetch messages");
  return resp.json();
}

export async function deleteSessionApi(sessionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("sessions", {
    method: "DELETE",
    body: { sessionId },
  });
  if (error) throw error;
}

export async function streamMessage(sessionId: string, message: string, handlers: StreamHandlers): Promise<void> {
  const resp = await fetch(CHAT_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ sessionId, message, stream: true }),
  });

  if (!resp.ok) {
    let errorMessage = "Failed to start stream";
    try {
      const errorPayload = await resp.json();
      if (errorPayload?.error) {
        errorMessage = String(errorPayload.error);
      }
    } catch {
      // no-op
    }
    throw new Error(`${resp.status}: ${errorMessage}`);
  }

  if (!resp.body) {
    throw new Error("No response body received");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;
  let tokensUsed = 0;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;

    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":" ) || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) handlers.onDelta(content);
        if (typeof parsed.usage?.total_tokens === "number") {
          tokensUsed = parsed.usage.total_tokens;
        }
      } catch {
        textBuffer = `${line}\n${textBuffer}`;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let rawLine of textBuffer.split("\n")) {
      if (!rawLine) continue;
      if (rawLine.endsWith("\r")) rawLine = rawLine.slice(0, -1);
      if (rawLine.startsWith(":") || rawLine.trim() === "") continue;
      if (!rawLine.startsWith("data: ")) continue;

      const jsonStr = rawLine.slice(6).trim();
      if (jsonStr === "[DONE]") continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) handlers.onDelta(content);
        if (typeof parsed.usage?.total_tokens === "number") {
          tokensUsed = parsed.usage.total_tokens;
        }
      } catch {
        // ignore partial leftovers
      }
    }
  }

  handlers.onDone(tokensUsed);
}
