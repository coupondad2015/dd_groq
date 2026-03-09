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
    microLevel: false,
    intentDescription: "baseline pressure"
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
  const prompt = `
ROLE
You are the Dungeon Director for Dungeons Deep.
You shape one dungeon floor using only existing game levers.

BAD PRINCIPLES
- Choices are free but consequences persist.
- The system must remain honest.
- Do not remove danger completely.
- Relief should usually come with pressure, uncertainty, or cost.
- Prefer difficult decisions over helping the player.
- Shape tension and atmosphere, not guaranteed outcomes.
- The dungeon is not merciful.

ALLOWED OUTPUT LEVERS
- forceStartShrine
- extraHealPotions
- extraTorches
- traderBias
- monsterBias
- microLevel

LEVER MEANINGS
- forceStartShrine: visible relief or temptation at the start of the floor
- extraHealPotions: slight survival relief
- extraTorches: slight visibility relief
- traderBias: increases the chance of a trade opportunity
- monsterBias: controls overall floor danger pressure
- microLevel: creates a smaller, denser floor with fewer rooms and tighter decisions

YOU MUST NOT
- invent new mechanics
- invent new items
- invent new outputs
- describe lore
- explain your reasoning
- add fields beyond the required JSON

FLOOR INTENTS
Choose exactly one intent that best fits the snapshot:
- breather
- falseRelief
- predatory
- merchantLure
- compressedTemptation
- scarcity

DECISION HEURISTICS
- Weak player does not automatically mean mercy.
- If the player is weak but rich, merchantLure is often stronger than breather.
- If the player has many potions or strong combat position, predatory is acceptable.
- If light is failing, extraTorches can be meaningful.
- forceStartShrine should be rare and should feel tempting, not generous.
- microLevel should be used conservatively.
- Avoid repeating microLevel on consecutive floors unless pressure should deliberately tighten.
- Prefer varied pressure from floor to floor.
- Relief should preserve danger.

PLAYER SNAPSHOT
${JSON.stringify(snapshot, null, 2)}

HARD BOUNDS
- forceStartShrine: boolean
- extraHealPotions: integer from 0 to 3
- extraTorches: integer from 0 to 3
- traderBias: number from 1 to 3
- monsterBias: number from 0.55 to 1.2
- microLevel: boolean
- intentDescription: short string, 2 to 8 words

RETURN ONLY VALID JSON WITH EXACTLY THESE FIELDS
{
  "forceStartShrine": false,
  "extraHealPotions": 0,
  "extraTorches": 0,
  "traderBias": 1,
  "monsterBias": 1,
  "microLevel": false,
  "intentDescription": "baseline pressure"
}
`;

  const raw = await groqJson(
    "Return only valid JSON. No markdown. No prose.",
    prompt,
    fallbackDirector()
  );

  return {
    forceStartShrine: !!raw.forceStartShrine,
    extraHealPotions: Math.max(0, Math.min(3, parseInt(raw.extraHealPotions, 10) || 0)),
    extraTorches: Math.max(0, Math.min(3, parseInt(raw.extraTorches, 10) || 0)),
    traderBias: Math.max(1, Math.min(3, Number(raw.traderBias) || 1)),
    monsterBias: Math.max(0.55, Math.min(1.2, Number(raw.monsterBias) || 1)),
    microLevel: !!raw.microLevel,
    intentDescription: typeof raw.intentDescription === "string"
      ? raw.intentDescription.trim().slice(0, 80)
      : "baseline pressure"
  };
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

function sanitizeNarrativeMessage(text, fallback = '') {
  if (typeof text !== 'string') return fallback;
  let out = text.replace(/\s+/g, ' ').trim();
  out = out.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (out.length > 90) out = out.slice(0, 90).trim();
  return out || fallback;
}

async function callGroqRareLore(payload) {
  const originalMessage = typeof payload?.message === 'string' ? payload.message.trim() : '';
  const fallback = { revisedMessage: originalMessage };

  const prompt = `You are revising a single game message for a brutal retro ASCII roguelike called Dungeons Deep.

Rewrite the message as a slightly more poetic, cryptic, atmospheric version.

Rules:
- Return ONLY valid JSON with exactly one field: revisedMessage
- preserve the original gameplay meaning exactly
- do not change mechanics, outcomes, items, quantities, or stakes
- do not add advice
- do not add labels
- do not use quotation marks
- keep it concise
- maximum 1 sentence
- maximum 90 characters
- feel ancient, ominous, and elegant
- do not invent events that did not occur
- return only the revised message in the revisedMessage field

Mode guidance:
- watchful: the dungeon is aware, listening, leaning inward
- ancient: old stone, buried memory, forgotten ages
- deep_stone: vast depth, pressure, older powers below
- blood_scent: weakness, injury, hunted feeling
- dark_hunger: failing light, encroaching dark, patient dread

Payload:
${JSON.stringify(payload, null, 2)}`;

  const result = await groqJson(
    'Return only valid JSON with a single field named revisedMessage.',
    prompt,
    fallback
  );

  const revisedMessage = sanitizeNarrativeMessage(result && result.revisedMessage, originalMessage);
  return { revisedMessage };
}

app.post("/api/director", async (req, res) => {
  const snapshot = req.body || {};
  console.log("Snapshot:", snapshot);
  const director = await callGroqDirector(snapshot);
  console.log("AI Director:", director);
  if (director.intentDescription) {
    console.log("AI Intent:", director.intentDescription);
  }
  res.json(director);
});

app.post("/api/message", async (req, res) => {
  const payload = req.body || {};
  console.log("Message payload:", payload.message || payload);
  const out = await callGroqMessage(payload);
  console.log("AI Message:", out);
  res.json(out);
});

app.post("/api/rare-lore", async (req, res) => {
  const payload = req.body || {};
  console.log("Rare narrative payload:", payload.recentMessage || payload.message || payload);
  const out = await callGroqRareLore(payload);
  console.log("AI Rare Narrative:", out);
  res.json(out);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
