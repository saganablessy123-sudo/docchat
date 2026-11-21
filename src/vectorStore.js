import { ChromaClient } from "chromadb";

const client = new ChromaClient({
  host: process.env.CHROMA_HOST || "localhost",
  port: Number(process.env.CHROMA_PORT || 8000),
});

let collectionPromise;

async function getCollection() {
  try {
    // embeddingFunction: null -> we create embeddings ourselves with Gemini
    collectionPromise ??= client.getOrCreateCollection({
      name: "docchat",
      embeddingFunction: null,
    });
    return await collectionPromise;
  } catch (err) {
    collectionPromise = undefined;
    const e = new Error(
      "Cannot reach ChromaDB. Start it first with: chroma run --path ./chroma_data"
    );
    e.status = 503;
    throw e;
  }
}

export async function addChunks({ source, chunks, embeddings }) {
  const col = await getCollection();
  const BATCH = 100;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    await col.add({
      ids: slice.map((_, j) => `${source}::${i + j}`),
      embeddings: embeddings.slice(i, i + BATCH),
      documents: slice,
      metadatas: slice.map((_, j) => ({ source, chunk: i + j })),
    });
  }
}

export async function removeDocument(source) {
  const col = await getCollection();
  await col.delete({ where: { source } });
}

export async function search(queryEmbedding, k = 4, source) {
  const col = await getCollection();
  const res = await col.query({
    queryEmbeddings: [queryEmbedding],
    nResults: k,
    ...(source ? { where: { source } } : {}),
    include: ["documents", "metadatas", "distances"],
  });

  const docs = res.documents?.[0] || [];
  const metas = res.metadatas?.[0] || [];
  const dists = res.distances?.[0] || [];

  return docs.map((text, i) => ({
    text,
    source: metas[i]?.source,
    chunk: metas[i]?.chunk,
    distance: dists[i],
  }));
}

export async function listDocuments() {
  const col = await getCollection();
  const res = await col.get({ include: ["metadatas"] });

  const counts = {};
  for (const m of res.metadatas || []) {
    if (m?.source) counts[m.source] = (counts[m.source] || 0) + 1;
  }
  return Object.entries(counts).map(([name, chunks]) => ({ name, chunks }));
}
