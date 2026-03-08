const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

async function groqJson(system, user, fallback) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return fallback;

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || "{}";
    return JSON.parse(text);
  } catch (err) {
    console.error("Groq message call failed:", err);
    return fallback;
  }
}

async function callGroqMessage(payload) {
  const fallback = { commentary: "" };

  const prompt = `You are the mythic undertone of an ancient dungeon crawler.

Take the original game message and return ONE short atmospheric commentary line.

Rules:
- Return ONLY valid JSON with exactly one field: commentary
- commentary must be 4 to 12 words
- do not repeat the original message facts
- do not explain mechanics
- no quotes
- no markdown
- tone: restrained, eerie, mythic
- write as a natural lore line, not a label or aside

Payload:
${JSON.stringify(payload, null, 2)}`;

  const result = await groqJson(
    "Return only valid JSON with a single field named commentary.",
    prompt,
    fallback
  );

  if (!result || typeof result.commentary !== "string") return fallback;
  return { commentary: result.commentary.trim() };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body || {};
    const out = await callGroqMessage(payload);
    return res.status(200).json(out);
  } catch (err) {
    console.error("message handler failed:", err);
    return res.status(200).json({ commentary: "" });
  }
}
