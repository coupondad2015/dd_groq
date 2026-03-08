const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

function fallbackDirector() {
  return {
    forceStartShrine: false,
    extraHealPotions: 0,
    extraTorches: 0,
    traderBias: 1,
    monsterBias: 1,
    microLevel: false
  };
}

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
    console.error("Groq director call failed:", err);
    return fallback;
  }
}

async function callGroqDirector(snapshot) {
  const prompt = `You are the Dungeon Director for "Dungeons Deep", a hardcore ASCII roguelike guided by Burdened Agency Design (BAD).

BAD principles:
- Choices are free but consequences persist.
- The system must remain honest.
- Do not remove danger completely.
- Relief should usually come with pressure, uncertainty, or cost.
- Prefer difficult decisions over helping the player.
- Shape tension and atmosphere, not guaranteed outcomes.
- The dungeon is not merciful.

You may only influence the game using these existing levers:
- forceStartShrine
- extraHealPotions
- extraTorches
- traderBias
- monsterBias
- microLevel

Meaning of the levers:
- forceStartShrine: can create visible relief or temptation.
- extraHealPotions: slight survival relief.
- extraTorches: slight visibility and exploration relief.
- traderBias: increases the chance of a trade opportunity.
- monsterBias: controls overall floor danger pressure.
- microLevel: creates a smaller, denser floor with fewer rooms. This compresses monsters, traps, rewards, and decisions into tighter space, increasing pressure and making situations feel more deliberate.

Do NOT invent new mechanics, rules, items, abilities, hidden behaviors, or outputs.
Only create situations by combining the existing levers.

Player snapshot:
${JSON.stringify(snapshot, null, 2)}

Choose a floor intent such as:
- breather
- falseRelief
- predatory
- merchantLure
- compressedTemptation
- scarcity

Then express that intent only through the allowed levers.

Guidelines:
- Prefer subtle adjustments.
- Relief should still preserve danger, uncertainty, or cost.
- Do not make the floor a gift.
- Use microLevel when a compressed, high-pressure situation would create meaningful decisions.
- Be conservative with microLevel; it should feel deliberate, not constant.
- Prefer varied pressure across a run when the current snapshot allows flexibility.

Hard bounds:
- forceStartShrine must be true or false
- extraHealPotions must be an integer from 0 to 3
- extraTorches must be an integer from 0 to 3
- traderBias must be a number from 1 to 3
- monsterBias must be a number from 0.55 to 1.2
- microLevel must be true or false

Return ONLY valid JSON with exactly these fields:
{
  "forceStartShrine": boolean,
  "extraHealPotions": 0,
  "extraTorches": 0,
  "traderBias": 1,
  "monsterBias": 1,
  "microLevel": false,
  "intentDescription": "short explanation of the dungeon level's floor design"
}`;

  return await groqJson(
    "Return only valid JSON. No markdown. No prose.",
    prompt,
    fallbackDirector()
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const snapshot = req.body || {};
    const director = await callGroqDirector(snapshot);
    return res.status(200).json(director);
  } catch (err) {
    console.error("director handler failed:", err);
    return res.status(200).json(fallbackDirector());
  }
}
