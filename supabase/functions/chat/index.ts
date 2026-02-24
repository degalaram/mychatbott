import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const productDocs = [
  {
    title: "Reset Password",
    content:
      "Users can reset password from Settings > Security. Click 'Forgot Password' on the login page, enter your email, and follow the link sent to your inbox to create a new password.",
    keywords: ["reset", "password", "security", "settings", "change password", "forgot password"],
  },
  {
    title: "Refund Policy",
    content:
      "Refunds are allowed within 7 days of purchase. To request a refund, go to Orders > Select Order > Request Refund. Refunds are processed within 3-5 business days.",
    keywords: ["refund", "return", "money back", "purchase", "cancel", "7 days"],
  },
  {
    title: "Account Settings",
    content:
      "You can manage your account settings by navigating to Settings > Account. From there you can update your profile, email, and notification preferences.",
    keywords: ["account", "settings", "profile", "email", "notifications", "preferences"],
  },
  {
    title: "Billing",
    content:
      "Billing information can be managed from Settings > Billing. You can update your payment method, view invoices, and change your subscription plan.",
    keywords: ["billing", "payment", "invoice", "subscription", "plan", "credit card"],
  },
  {
    title: "Contact Support",
    content:
      "You can contact our support team by emailing support@example.com or by using the in-app chat feature available 24/7.",
    keywords: ["contact", "support", "help", "email", "chat", "customer service"],
  },
];

function findRelevantDocs(query: string) {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length > 1);

  const scored = productDocs.map((doc) => {
    let score = 0;
    for (const kw of doc.keywords) {
      if (lower.includes(kw)) score += 3;
    }
    for (const word of words) {
      for (const kw of doc.keywords) {
        if (kw.includes(word) || word.includes(kw)) score += 1;
      }
    }
    if (lower.includes(doc.title.toLowerCase())) score += 4;
    return { doc, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.doc);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId, message, stream } = await req.json();

    if (!sessionId || !message) {
      return jsonResponse({ error: "Missing sessionId or message" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: sessionError } = await supabase.from("sessions").upsert({ id: sessionId }, { onConflict: "id" });
    if (sessionError) throw sessionError;

    const { error: userMessageError } = await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: message,
    });
    if (userMessageError) throw userMessageError;

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (historyError) throw historyError;

    const contextMessages = (history || []).reverse();

    const relevantDocs = findRelevantDocs(message);
    const docsContext =
      relevantDocs.length > 0
        ? relevantDocs.map((d) => `**${d.title}**: ${d.content}`).join("\n\n")
        : "No product-document match for this query.";

    const systemPrompt = `You are an accurate and helpful AI chat assistant.
Use the product documentation below whenever it is relevant.
If the question is outside the product docs, still answer normally with your best knowledge.
If you are not fully sure, say so briefly instead of inventing facts.
Keep responses clear and concise.

## Product Documentation:
${docsContext}`;

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...contextMessages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: llmMessages,
        max_tokens: 700,
        temperature: 0.2,
        stream: Boolean(stream),
        ...(stream ? { stream_options: { include_usage: true } } : {}),
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded. Please try again later." }, 429);
      }
      if (aiResponse.status === 402) {
        return jsonResponse({ error: "AI credits exhausted. Please add credits." }, 402);
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    if (stream) {
      if (!aiResponse.body) throw new Error("AI gateway returned no stream body");

      const reader = aiResponse.body.getReader();
      const decoder = new TextDecoder();
      let rawSse = "";

      const passthrough = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                rawSse += decoder.decode(value, { stream: true });
                controller.enqueue(value);
              }
            }
            rawSse += decoder.decode();
          } catch (streamError) {
            console.error("Streaming error:", streamError);
            controller.error(streamError);
            return;
          } finally {
            reader.releaseLock();
          }

          let replyText = "";
          let tokensUsed = 0;

          for (let rawLine of rawSse.split("\n")) {
            if (rawLine.endsWith("\r")) rawLine = rawLine.slice(0, -1);
            if (!rawLine.startsWith("data: ")) continue;

            const payload = rawLine.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === "string") replyText += delta;
              const usage = parsed.usage?.total_tokens;
              if (typeof usage === "number") tokensUsed = usage;
            } catch {
              // Ignore non-JSON/partial lines.
            }
          }

          const finalReply = replyText.trim() || "Sorry, I couldn't generate a response right now.";

          const { error: assistantInsertError } = await supabase.from("messages").insert({
            session_id: sessionId,
            role: "assistant",
            content: finalReply,
          });
          if (assistantInsertError) {
            console.error("Failed to store streamed assistant reply:", assistantInsertError);
          }

          console.log(`Tokens used: ${tokensUsed}`);
          controller.close();
        },
      });

      return new Response(passthrough, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response right now.";
    const tokensUsed = aiData.usage?.total_tokens || 0;

    const { error: assistantMessageError } = await supabase.from("messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: reply,
    });
    if (assistantMessageError) throw assistantMessageError;

    return jsonResponse({ reply, tokensUsed });
  } catch (e) {
    console.error("Chat error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
