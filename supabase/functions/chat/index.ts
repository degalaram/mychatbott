import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Product documentation - the assistant can ONLY answer from these docs
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Ensure session exists
    await supabase.from("sessions").upsert({ id: sessionId }, { onConflict: "id" });

    // Store user message
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: message,
    });

    // Fetch last 5 pairs of messages for context
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(10);

    const contextMessages = (history || []).reverse();

    // Find relevant docs
    const relevantDocs = findRelevantDocs(message);
    const docsContext =
      relevantDocs.length > 0
        ? relevantDocs.map((d) => `**${d.title}**: ${d.content}`).join("\n\n")
        : "";

    // Build LLM prompt
    const systemPrompt = `You are a product support assistant. You MUST ONLY answer questions using the provided product documentation below. 

${docsContext ? `## Product Documentation:\n${docsContext}` : "No relevant documentation found."}

## STRICT RULES:
1. If the user's question can be answered using the product documentation above, provide a helpful answer based ONLY on that documentation.
2. If the user sends a greeting (hi, hello, hey, etc.), respond with a friendly greeting and briefly list what you can help with (password reset, refund policy, billing, account settings, contact support).
3. If the question CANNOT be answered from the documentation above, you MUST respond EXACTLY with: "Sorry, I don't have information about that."
4. Do NOT make up information, guess, or provide answers outside the documentation.
5. Keep responses concise and helpful.`;

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...contextMessages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Call LLM via Lovable AI Gateway
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
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "Sorry, I don't have information about that.";
    const tokensUsed = aiData.usage?.total_tokens || 0;

    // Store assistant reply
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: reply,
    });

    return new Response(
      JSON.stringify({ reply, tokensUsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
