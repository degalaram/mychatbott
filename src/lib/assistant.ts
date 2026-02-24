import { findRelevantDocs } from "@/data/docs";
import { getLastNPairs, type Message } from "@/lib/sessions";

const FALLBACK = "Sorry, I don't have information about that.";

export async function getAssistantReply(sessionId: string, userMessage: string): Promise<{ reply: string; tokensUsed: number }> {
  // Simulate LLM processing delay
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));

  const relevantDocs = findRelevantDocs(userMessage);
  const context = getLastNPairs(sessionId, 5);

  if (relevantDocs.length === 0) {
    return { reply: FALLBACK, tokensUsed: 0 };
  }

  // Build a response from matching docs
  const docContents = relevantDocs.map((d) => d.content);
  const reply = docContents.join(" ");

  // Estimate tokens (rough: 1 token ≈ 4 chars)
  const contextText = context.map((m) => m.content).join(" ");
  const tokensUsed = Math.ceil((reply.length + userMessage.length + contextText.length) / 4);

  return { reply, tokensUsed };
}
