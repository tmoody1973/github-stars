const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export function hasEmbeddingProvider() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function createEmbedding(input) {
  const embeddings = await createEmbeddings([input]);
  return embeddings[0] || null;
}

export async function createEmbeddings(inputs) {
  if (!hasEmbeddingProvider()) return inputs.map(() => null);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
      input: inputs,
      encoding_format: "float"
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings request failed: ${response.status} ${body.slice(0, 240)}`);
  }

  const json = await response.json();
  return inputs.map((_, index) => json.data?.find((item) => item.index === index)?.embedding || null);
}
