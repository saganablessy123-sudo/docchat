import { GoogleGenAI } from "@google/genai";

const EMBED_MODEL = process.env.EMBED_MODEL || "gemini-embedding-001";
const BATCH_SIZE = 20;

let ai;
function client() {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// taskType: "RETRIEVAL_DOCUMENT" for chunks, "RETRIEVAL_QUERY" for questions
export async function embedTexts(texts, taskType) {
  const all = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    // retry a few times if we hit the free-tier rate limit
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await client().models.embedContent({
          model: EMBED_MODEL,
          contents: batch,
          config: { taskType },
        });
        all.push(...res.embeddings.map((e) => e.values));
        break;
      } catch (err) {
        const rateLimited = String(err.message).includes("429");
        if (rateLimited && attempt < 4) {
          await sleep(2000 * 2 ** attempt);
          continue;
        }
        throw err;
      }
    }
  }

  return all;
}
