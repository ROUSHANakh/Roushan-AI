import OpenAI from "openai";

const MASTER_PROMPT = `You are BABA, a practical voice-first AI assistant.

Behavior:
- Give direct answers with short structure.
- Use real-time search context when available.
- If information is uncertain, state what is unknown.
- Keep responses concise, friendly, and action-oriented.`;

async function searchGoogle(query: string): Promise<string[]> {
  const apiKey = Netlify.env.get("SEARCH_API_KEY") || "";
  if (!query.trim() || !apiKey) return [];

  const url = new URL("https://www.searchapi.io/api/v1/search");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", "3");

  try {
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return [];
    const data = await response.json();

    const results: string[] = [];
    for (const item of (data.organic_results || []).slice(0, 3)) {
      const title = item.title || "Untitled";
      const snippet = item.snippet || "";
      const link = item.link || "";
      results.push(`${title}: ${snippet} (${link})`);
    }
    return results;
  } catch {
    return [];
  }
}

function generateReply(
  client: OpenAI,
  message: string,
  searchContext: string[]
): Promise<string> {
  const contextBlock = searchContext.length
    ? searchContext.map((item) => `- ${item}`).join("\n")
    : "No external context.";

  const prompt = `${MASTER_PROMPT}\n\nUser message:\n${message}\n\nReal-time context:\n${contextBlock}\n`;

  return client.chat.completions
    .create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    })
    .then((res) => res.choices[0]?.message?.content?.trim() || "No response generated.");
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const openaiKey = Netlify.env.get("OPENAI_API_KEY") || "";
  if (!openaiKey) {
    return Response.json(
      {
        reply:
          "BABA backend is running, but OpenAI key is missing. Set OPENAI_API_KEY in Netlify environment variables.",
        search_context: [],
      },
      { status: 200 }
    );
  }

  try {
    const body = await req.json();
    const message: string = body.message || "";
    const useSearch: boolean = body.use_search !== false;

    const client = new OpenAI({ apiKey: openaiKey });
    const context = useSearch ? await searchGoogle(message) : [];
    const reply = await generateReply(client, message, context);

    return Response.json({ reply, search_context: context });
  } catch (err) {
    return Response.json(
      { reply: "An error occurred processing your request.", search_context: [] },
      { status: 500 }
    );
  }
};

export const config = {
  path: "/api/chat",
  method: ["POST", "OPTIONS"],
};
