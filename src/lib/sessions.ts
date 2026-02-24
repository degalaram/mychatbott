// Session and message persistence using localStorage

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const SESSIONS_KEY = "support_sessions";
const MESSAGES_KEY = "support_messages";

function generateId(): string {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function getSessions(): Session[] {
  const data = localStorage.getItem(SESSIONS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveSessions(sessions: Session[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function createSession(): Session {
  const now = new Date().toISOString();
  const session: Session = { id: generateId(), createdAt: now, updatedAt: now };
  const sessions = getSessions();
  sessions.unshift(session);
  saveSessions(sessions);
  return session;
}

export function getMessages(sessionId: string): Message[] {
  const data = localStorage.getItem(MESSAGES_KEY);
  const all: Message[] = data ? JSON.parse(data) : [];
  return all.filter((m) => m.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getLastNPairs(sessionId: string, n: number = 5): Message[] {
  const messages = getMessages(sessionId);
  // Get last n pairs (2n messages)
  return messages.slice(-(n * 2));
}

export function addMessage(sessionId: string, role: "user" | "assistant", content: string): Message {
  const msg: Message = {
    id: generateId(),
    sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  const data = localStorage.getItem(MESSAGES_KEY);
  const all: Message[] = data ? JSON.parse(data) : [];
  all.push(msg);
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(all));

  // Update session timestamp
  const sessions = getSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (session) {
    session.updatedAt = msg.createdAt;
    saveSessions(sessions);
  }

  return msg;
}

export function deleteSession(sessionId: string) {
  const sessions = getSessions().filter((s) => s.id !== sessionId);
  saveSessions(sessions);
  const data = localStorage.getItem(MESSAGES_KEY);
  const all: Message[] = data ? JSON.parse(data) : [];
  const filtered = all.filter((m) => m.sessionId !== sessionId);
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(filtered));
}
