export interface DocEntry {
  title: string;
  content: string;
  keywords: string[];
}

export const productDocs: DocEntry[] = [
  {
    title: "Reset Password",
    content: "Users can reset password from Settings > Security.",
    keywords: ["reset", "password", "security", "settings", "change password", "forgot password"],
  },
  {
    title: "Refund Policy",
    content: "Refunds are allowed within 7 days of purchase.",
    keywords: ["refund", "return", "money back", "purchase", "cancel", "7 days"],
  },
  {
    title: "Account Settings",
    content: "You can manage your account settings by navigating to Settings > Account. From there you can update your profile, email, and notification preferences.",
    keywords: ["account", "settings", "profile", "email", "notifications", "preferences"],
  },
  {
    title: "Billing",
    content: "Billing information can be managed from Settings > Billing. You can update your payment method, view invoices, and change your subscription plan.",
    keywords: ["billing", "payment", "invoice", "subscription", "plan", "credit card"],
  },
  {
    title: "Contact Support",
    content: "You can contact our support team by emailing support@example.com or by using the in-app chat feature available 24/7.",
    keywords: ["contact", "support", "help", "email", "chat", "customer service"],
  },
];

export function findRelevantDocs(query: string): DocEntry[] {
  const lowerQuery = query.toLowerCase();
  const scored = productDocs.map((doc) => {
    let score = 0;
    for (const keyword of doc.keywords) {
      if (lowerQuery.includes(keyword)) {
        score += 2;
      }
    }
    if (lowerQuery.includes(doc.title.toLowerCase())) {
      score += 3;
    }
    return { doc, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.doc);
}
