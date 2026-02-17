import type { Api, Model } from "@mariozechner/pi-ai"
import { getModel } from "@mariozechner/pi-ai"

import { Config } from "@/config/config"

const DEFAULT_CONTEXT_WINDOW = 200_000
const DEFAULT_MAX_TOKENS = 4096

function parseModelId(value: string) {
  const [provider, ...rest] = value.split("/")
  const modelId = rest.join("/")
  if (!provider || !modelId) {
    throw new Error(`Invalid model id: ${value}. Use provider/model.`)
  }
  return { provider, modelId }
}

function buildCustomModel(params: {
  id: string
  provider: string
  api: Api
  baseUrl: string
  headers?: Record<string, string>
  contextWindow?: number
  maxTokens?: number
  reasoning?: boolean
  input?: ("text" | "image")[]
  cost?: {
    input?: number
    output?: number
    cacheRead?: number
    cacheWrite?: number
  }
}): Model<Api> {
  return {
    id: params.id,
    name: params.id,
    api: params.api,
    provider: params.provider,
    baseUrl: params.baseUrl,
    reasoning: params.reasoning ?? false,
    input: params.input ?? ["text"],
    cost: {
      input: params.cost?.input ?? 0,
      output: params.cost?.output ?? 0,
      cacheRead: params.cost?.cacheRead ?? 0,
      cacheWrite: params.cost?.cacheWrite ?? 0,
    },
    contextWindow: params.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
    maxTokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    headers: params.headers,
  }
}

export async function resolveModel(modelId?: string): Promise<Model<Api>> {
  const config = await Config.load()
  const selected = modelId ?? config.defaultModel
  if (!selected) {
    throw new Error("No model specified. Set defaultModel in config or provide a model id.")
  }

  const { provider: idProvider, modelId: idModel } = parseModelId(selected)
  const override = config.models?.[selected]
  const provider = override?.provider ?? idProvider
  const resolvedModelId = override?.id ?? idModel

  let baseModel: Model<Api> | null = null

  // Try to load the model from a default provider
  try {
    baseModel = getModel(provider as any, resolvedModelId as any) as Model<Api>
  } catch {
    baseModel = null
  }

  // Create a custom model
  if (override || baseModel) {
    const api = (override?.api as Api | undefined) ?? baseModel?.api
    const baseUrl = override?.baseUrl ?? baseModel?.baseUrl
    if (!api || !baseUrl) {
      throw new Error(`Model ${selected} is missing api/baseUrl configuration.`)
    }
    return {
      ...(baseModel ??
        buildCustomModel({
          id: resolvedModelId,
          provider,
          api,
          baseUrl,
          cost: override?.cost,
        })),
      api,
      provider,
      baseUrl,
      headers: override?.headers ?? baseModel?.headers,
      contextWindow: override?.contextWindow ?? baseModel?.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      maxTokens: override?.maxTokens ?? baseModel?.maxTokens ?? DEFAULT_MAX_TOKENS,
      reasoning: override?.reasoning ?? baseModel?.reasoning ?? false,
      input: override?.input ?? baseModel?.input ?? ["text"],
      cost: {
        input: override?.cost?.input ?? baseModel?.cost.input ?? 0,
        output: override?.cost?.output ?? baseModel?.cost.output ?? 0,
        cacheRead: override?.cost?.cacheRead ?? baseModel?.cost.cacheRead ?? 0,
        cacheWrite: override?.cost?.cacheWrite ?? baseModel?.cost.cacheWrite ?? 0,
      },
    }
  }

  return getModel(provider as any, resolvedModelId as any) as Model<Api>
}
