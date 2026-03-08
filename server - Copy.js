const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function fallbackDirector() {
  return {
    forceStartShrine: false,
    extraHealPotions: 0,
    extraTorches: 0,
    traderBias: 1,
    monsterBias: 1,
    microLevel: false //added
  };
}

async function groqJson(system, user, fallback) {
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
    console.error("Groq call failed:", err);
    return fallback;
  }
}

async function callGroqDirector(snapshot) {
  const prompt = `You are a dungeon director for a hardcore ASCII roguelike.

Player snapshot:
${JSON.stringify(snapshot, null, 2)}

Return ONLY valid JSON with exactly these fields:
- forceStartShrine (boolean)
- extraHealPotions (integer 0 to 3)
- extraTorches (integer 0 to 3)
- traderBias (number 1 to 3)
- monsterBias (number 0.55 to 1.2)
- microLevel (boolean)

Rules for microLevel:
- microLevel should usually be false
- microLevel can be true when a short, unusual floor would improve pacing
- be conservative; do not overuse microLevel
- avoid triggering microLevel twice in a row
- on depth 1, prefer false unless the snapshot strongly suggests novelty would help

Be bold. Encourage interesting runs without making the game easy.`;

  return await groqJson(
    "Return only valid JSON. No markdown. No prose.",
    prompt,
    fallbackDirector()
  );
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

app.post("/api/director", async (req, res) => {
  const snapshot = req.body || {};
  console.log("Snapshot:", snapshot);
  const director = await callGroqDirector(snapshot);
  console.log("AI Director:", director);
  res.json(director);
});

app.post("/api/message", async (req, res) => {
  const payload = req.body || {};
  console.log("Message payload:", payload.message || payload);
  const out = await callGroqMessage(payload);
  console.log("AI Message:", out);
  res.json(out);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
