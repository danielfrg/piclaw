import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import type { OpenAPIV3_1 } from "openapi-types"

import { ModelInfoSchema, type ModelInfo } from "@/schema"
import { getGlobalModelRegistry } from "@/session/runtime"

type OpenApiSchema = OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject

function asOpenApiSchema<T extends Parameters<typeof resolver>[0]>(schema: T): OpenApiSchema {
  return resolver(schema) as unknown as OpenApiSchema
}

export function ModelRoutes() {
  return new Hono().get(
    "/",
    describeRoute({
      summary: "List available models",
      description: "List all models with configured authentication.",
      operationId: "model.list",
      responses: {
        200: {
          description: "List of available models",
          content: {
            "application/json": {
              schema: asOpenApiSchema(ModelInfoSchema.array()),
            },
          },
        },
      },
    }),
    async (c) => {
      const registry = getGlobalModelRegistry()
      const available = registry.getAvailable()
      const models: ModelInfo[] = available.map((m) => ({
        provider: m.provider,
        id: m.id,
        name: m.name,
        api: m.api,
        reasoning: m.reasoning,
        input: m.input,
        cost: m.cost,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
      }))

      return c.json(models)
    },
  )
}
