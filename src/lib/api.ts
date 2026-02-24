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

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<{ reply: string; tokensUsed: number }> {
  const { data, error } = await supabase.functions.invoke("chat", {
    body: { sessionId, message },
  });
  if (error) throw error;
  return data;
}
