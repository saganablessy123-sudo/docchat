import { GoogleGenAI } from "@google/genai";

const PRIMARY = process.env.CHAT_MODEL || "gemini-3.5-flash";

// If the main model is busy or unavailable, the next ones are tried automatically
const MODELS = [PRIMARY, "gemini-3.7-flash", "gemini-3.5-flash"].filter(
  (m, i, all) => all.indexOf(m) === i
);

let ai;
function client() {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isBusy(err) {
  const msg = String(err?.message || err);
  return (
    err?.status === 503 ||
    err?.status === 429 ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("RESOURCE_EXHAUSTED")
  );
}

function isAuthError(err) {
  const msg = String(err?.message || err);
  return err?.status === 401 || err?.status === 403 || msg.includes("UNAUTHENTICATED");
}

async function generate(prompt) {
  let lastError;

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await client().models.generateContent({
          model,
          contents: prompt,
          config: { temperature: 0.2 },
        });
        return res.text;
      } catch (err) {
        lastError = err;
        if (isAuthError(err)) throw err; // wrong key: no point trying other models
        if (isBusy(err) && attempt === 0) {
          await sleep(2000); // busy: wait 2 seconds and try the same model once more
          continue;
        }
        break; // otherwise move on to the next model
      }
    }
  }

  if (isBusy(lastError)) {
    throw new Error("Gemini is busy right now. Please wait a minute and try again.");
  }
  throw lastError;
}

export async function answerQuestion(question, hits, history = []) {
  const context = hits
    .map((h, i) => `[Source ${i + 1}: ${h.source}]\n${h.text}`)
    .join("\n\n---\n\n");

  const chat = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");

  const prompt = `You are a helpful assistant that answers questions using ONLY the context below.
Rules:
- If the answer is not in the context, reply exactly: "I couldn't find this in the document."
- Do not use outside knowledge.
- Keep the answer clear and short. Use bullet points when listing things.

${chat ? `Conversation so far:\n${chat}\n\n` : ""}Context:
${context}

Question: ${question}

Answer:`;

  return generate(prompt);
}