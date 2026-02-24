export interface DocEntry {
  title: string;
  content: string;
  keywords: string[];
}

export const productDocs: DocEntry[] = [
  {
    title: "Reset Password",
    content: "Users can reset password from Settings > Security. Click 'Forgot Password' on the login page, enter your email, and follow the link sent to your inbox to create a new password.",
    keywords: ["reset", "password", "security", "settings", "change password", "forgot password"],
  },
  {
    title: "Refund Policy",
    content: "Refunds are allowed within 7 days of purchase. To request a refund, go to Orders > Select Order > Request Refund. Refunds are processed within 3-5 business days.",
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
  {
    title: "Artificial Intelligence",
    content: "Artificial Intelligence (AI) is the simulation of human intelligence by machines. It includes machine learning, natural language processing, computer vision, and robotics. AI systems can learn from data, recognize patterns, and make decisions with minimal human intervention.",
    keywords: ["ai", "artificial intelligence", "machine learning", "ml", "what is ai", "deep learning"],
  },
  {
    title: "Chief Minister of Andhra Pradesh",
    content: "The current Chief Minister (CM) of Andhra Pradesh is N. Chandrababu Naidu, who took office in June 2024. He is the leader of the Telugu Desam Party (TDP).",
    keywords: ["ap cm", "andhra pradesh", "chief minister", "cm", "chandrababu", "tdp", "who ap cm"],
  },
  {
    title: "Prime Minister of India",
    content: "The current Prime Minister of India is Narendra Modi. He has been serving as the PM since May 2014 and is a member of the Bharatiya Janata Party (BJP).",
    keywords: ["pm", "prime minister", "india pm", "modi", "narendra modi", "who is pm"],
  },
  {
    title: "Weather Information",
    content: "I can provide general weather tips. For current weather, please check a weather service like weather.com. Generally, dress in layers, carry an umbrella during monsoon season, and stay hydrated in summer.",
    keywords: ["weather", "temperature", "rain", "sunny", "forecast", "climate"],
  },
  {
    title: "Programming Languages",
    content: "Popular programming languages include Python (great for AI/ML and beginners), JavaScript (web development), Java (enterprise applications), C++ (systems programming), TypeScript (typed JavaScript), and Rust (performance and safety).",
    keywords: ["programming", "language", "python", "javascript", "java", "coding", "code", "developer"],
  },
  {
    title: "What is Machine Learning",
    content: "Machine Learning (ML) is a subset of AI that enables systems to learn and improve from experience without being explicitly programmed. Types include supervised learning, unsupervised learning, and reinforcement learning.",
    keywords: ["machine learning", "ml", "supervised", "unsupervised", "neural network", "model training"],
  },
  {
    title: "Internet and Web",
    content: "The Internet is a global network of interconnected computers. The World Wide Web (WWW) is a system of interlinked hypertext documents accessed via the Internet using browsers like Chrome, Firefox, and Safari.",
    keywords: ["internet", "web", "www", "browser", "online", "website", "network"],
  },
  {
    title: "Mathematics Basics",
    content: "Mathematics is the study of numbers, quantities, shapes, and patterns. Key branches include algebra, geometry, calculus, statistics, and trigonometry. Math is fundamental to science, engineering, and technology.",
    keywords: ["math", "mathematics", "algebra", "geometry", "calculus", "statistics", "numbers"],
  },
  {
    title: "Science Overview",
    content: "Science is the systematic study of the natural world through observation and experimentation. Major branches include Physics (study of matter and energy), Chemistry (study of substances), and Biology (study of living organisms).",
    keywords: ["science", "physics", "chemistry", "biology", "experiment", "research", "scientific"],
  },
  {
    title: "History Overview",
    content: "History is the study of past events. Key periods include Ancient civilizations (Egypt, Rome, Greece), the Medieval period, the Renaissance, the Industrial Revolution, and Modern history including World Wars and the Digital Age.",
    keywords: ["history", "ancient", "medieval", "war", "civilization", "historical", "past"],
  },
  {
    title: "Health and Wellness",
    content: "Good health involves balanced nutrition, regular exercise (at least 30 minutes daily), adequate sleep (7-9 hours), stress management, and regular medical check-ups. Drink at least 8 glasses of water daily.",
    keywords: ["health", "wellness", "exercise", "nutrition", "sleep", "fitness", "diet", "medical"],
  },
  {
    title: "Geography",
    content: "Earth has 7 continents (Asia, Africa, North America, South America, Antarctica, Europe, Australia) and 5 oceans (Pacific, Atlantic, Indian, Southern, Arctic). The world has 195 recognized countries.",
    keywords: ["geography", "continent", "ocean", "country", "earth", "world", "map", "capital"],
  },
  {
    title: "Space and Astronomy",
    content: "Our solar system has 8 planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune. The Sun is a star at the center. The universe is approximately 13.8 billion years old.",
    keywords: ["space", "planet", "solar system", "sun", "moon", "star", "universe", "astronomy", "nasa"],
  },
];

export function findRelevantDocs(query: string): DocEntry[] {
  const lowerQuery = query.toLowerCase().trim();
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 1);

  const scored = productDocs.map((doc) => {
    let score = 0;

    // Exact keyword match in query
    for (const keyword of doc.keywords) {
      if (lowerQuery.includes(keyword)) {
        score += 3;
      }
    }

    // Individual word matching against keywords
    for (const word of queryWords) {
      for (const keyword of doc.keywords) {
        if (keyword.includes(word) || word.includes(keyword)) {
          score += 1;
        }
      }
    }

    // Title match
    if (lowerQuery.includes(doc.title.toLowerCase())) {
      score += 4;
    }

    // Title words match query words
    const titleWords = doc.title.toLowerCase().split(/\s+/);
    for (const tw of titleWords) {
      if (queryWords.includes(tw)) {
        score += 2;
      }
    }

    return { doc, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((s) => s.doc);
}
