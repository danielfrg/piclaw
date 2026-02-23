/**
 * Standalone test script: embed a query with embeddinggemma-300m (ONNX)
 * and search the Qdrant mdvector collection.
 *
 * Usage:
 *   bun run scripts/search-notes.ts "your search query"
 *   bun run scripts/search-notes.ts "kubernetes" --limit 3
 */

import { AutoModel, AutoTokenizer } from "@huggingface/transformers"
import { QdrantClient } from "@qdrant/js-client-rest"

const MODEL_ID = "onnx-community/embeddinggemma-300m-ONNX"
const QDRANT_URL = process.env.PICLAW_QDRANT_URL
const COLLECTION = process.env.PICLAW_QDRANT_COLLECTION ?? "notes"

if (!QDRANT_URL) {
  console.error("PICLAW_QDRANT_URL env var is required")
  process.exit(1)
}

// Parse CLI args
const args = process.argv.slice(2)
let limit = 5
const queryParts: string[] = []

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  const next = args[i + 1]
  if (arg === "--limit" && next) {
    limit = parseInt(next, 10)
    i++
  } else if (arg) {
    queryParts.push(arg)
  }
}

const query = queryParts.join(" ")
if (!query) {
  console.error("Usage: bun run scripts/search-notes.ts <query> [--limit N]")
  process.exit(1)
}

console.log(`Query: "${query}"`)
console.log(`Qdrant: ${QDRANT_URL} / collection: ${COLLECTION}`)
console.log(`Model: ${MODEL_ID}`)
console.log()

// 1. Load model and tokenizer
console.time("model-load")
const [tokenizer, model] = await Promise.all([
  AutoTokenizer.from_pretrained(MODEL_ID),
  AutoModel.from_pretrained(MODEL_ID, {
    dtype: "fp32", // embeddinggemma does NOT support fp16
  }),
])
console.timeEnd("model-load")

// 2. Embed the query
// No prefix -- matches how Python mdvector indexes (raw text, no prompt prefix)
console.time("embed")
const inputs = await tokenizer([query], { padding: true })
const output = await model(inputs)

// Extract the sentence_embedding tensor and convert to plain number[]
const embedding = output.sentence_embedding
const dim = embedding.dims[1]
const data = embedding.data as Float32Array
const vector = Array.from(data.slice(0, dim))
console.timeEnd("embed")
console.log(`Embedding dimension: ${dim}`)
console.log()

// 3. Search Qdrant
console.time("search")
// The JS client appends :6333 by default. For HTTPS behind a reverse proxy
// on port 443, we need to set the port explicitly.
const qdrantUrl = new URL(QDRANT_URL.includes("://") ? QDRANT_URL : `https://${QDRANT_URL}`)
const client = new QdrantClient({
  url: qdrantUrl.origin,
  port: qdrantUrl.port ? parseInt(qdrantUrl.port, 10) : qdrantUrl.protocol === "https:" ? 443 : 6333,
})
const results = await client.query(COLLECTION, {
  query: vector,
  limit,
  with_payload: ["path", "title", "content"],
})
console.timeEnd("search")

// 4. Display results
if (results.points.length === 0) {
  console.log("No results found.")
} else {
  for (const [i, point] of results.points.entries()) {
    const payload = point.payload as Record<string, string> | null
    const title = payload?.title || payload?.path || String(point.id)
    const score = point.score ?? 0
    const content = payload?.content ?? ""
    const preview = content.slice(0, 200).replace(/\n/g, " ") + (content.length > 200 ? "..." : "")

    console.log(`\n--- ${i + 1}. ${title} (score: ${score.toFixed(4)}) ---`)
    console.log(`    path: ${payload?.path ?? "unknown"}`)
    console.log(`    ${preview}`)
  }
}
