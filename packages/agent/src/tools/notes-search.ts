import { Type } from "@sinclair/typebox"
import type { AgentTool } from "@mariozechner/pi-agent-core"
import { AutoModel, AutoTokenizer, type PreTrainedModel, type PreTrainedTokenizer } from "@huggingface/transformers"
import { QdrantClient } from "@qdrant/js-client-rest"

const MODEL_ID = "onnx-community/embeddinggemma-300m-ONNX"

export interface NotesSearchConfig {
  qdrantUrl: string
  collection: string
}

let cachedTokenizer: PreTrainedTokenizer | null = null
let cachedModel: PreTrainedModel | null = null
let loadingPromise: Promise<void> | null = null

async function ensureModel(): Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }> {
  if (cachedTokenizer && cachedModel) {
    return { tokenizer: cachedTokenizer, model: cachedModel }
  }

  if (!loadingPromise) {
    loadingPromise = (async () => {
      const [tokenizer, model] = await Promise.all([
        AutoTokenizer.from_pretrained(MODEL_ID),
        AutoModel.from_pretrained(MODEL_ID, { dtype: "fp32" as const }),
      ])
      cachedTokenizer = tokenizer
      cachedModel = model
    })()
  }

  await loadingPromise
  return { tokenizer: cachedTokenizer!, model: cachedModel! }
}

async function embedQuery(text: string): Promise<number[]> {
  const { tokenizer, model } = await ensureModel()
  const inputs = await tokenizer([text], { padding: true })
  const output = await model(inputs)
  const embedding = output.sentence_embedding
  const dim = embedding.dims[1] as number
  const data = embedding.data as Float32Array
  return Array.from(data.slice(0, dim))
}

function createQdrantClient(url: string): QdrantClient {
  const parsed = new URL(url.includes("://") ? url : `https://${url}`)
  const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 6333

  return new QdrantClient({ url: parsed.origin, port })
}

interface SearchResult {
  path: string
  title: string
  score: number
  content: string
}

async function searchNotes(config: NotesSearchConfig, query: string, limit: number): Promise<SearchResult[]> {
  const vector = await embedQuery(query)
  const client = createQdrantClient(config.qdrantUrl)

  const results = await client.query(config.collection, {
    query: vector,
    limit,
    with_payload: ["path", "title", "content"],
  })

  return results.points.map((point) => {
    const payload = point.payload as Record<string, string> | null
    return {
      path: payload?.path ?? "unknown",
      title: payload?.title ?? payload?.path ?? String(point.id),
      score: point.score ?? 0,
      content: payload?.content ?? "",
    }
  })
}

function formatResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No matching notes found."
  }

  return results
    .map((r, i) => {
      const preview = r.content.slice(0, 500).replace(/\n/g, " ")
      const truncated = r.content.length > 500 ? preview + "..." : preview
      return [`${i + 1}. ${r.title} (score: ${r.score.toFixed(4)})`, `   path: ${r.path}`, `   ${truncated}`].join("\n")
    })
    .join("\n\n")
}

const NotesSearchParams = Type.Object({
  query: Type.String({ description: "Search query to find relevant notes" }),
  limit: Type.Optional(Type.Number({ description: "Max results to return (default: 5)", minimum: 1, maximum: 20 })),
})

export function createNotesSearchTool(config: NotesSearchConfig): AgentTool<typeof NotesSearchParams> {
  return {
    name: "notes_search",
    label: "Notes Search",
    description:
      "Search the user's personal notes using semantic similarity. " +
      "Use this tool to find relevant notes about topics the user asks about. " +
      "Returns matching notes with their content ranked by relevance.",
    parameters: NotesSearchParams,
    async execute(_toolCallId, params) {
      const limit = params.limit ?? 5
      const results = await searchNotes(config, params.query, limit)
      const text = formatResults(results)

      return {
        content: [{ type: "text", text }],
        details: {},
      }
    },
  }
}
