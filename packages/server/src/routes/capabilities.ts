import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import type { OpenAPIV3_1 } from "openapi-types"

import { CapabilitiesSchema } from "@/schema"
import { getGlobalCapabilities } from "@/session/runtime"

type OpenApiSchema = OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject

function asOpenApiSchema<T extends Parameters<typeof resolver>[0]>(schema: T): OpenApiSchema {
  return resolver(schema) as unknown as OpenApiSchema
}

export function CapabilitiesRoutes() {
  return new Hono().get(
    "/",
    describeRoute({
      summary: "Get global capabilities",
      description: "Get loaded skills and available tools for the agent.",
      operationId: "capabilities.list",
      responses: {
        200: {
          description: "Agent capabilities",
          content: {
            "application/json": {
              schema: asOpenApiSchema(CapabilitiesSchema),
            },
          },
        },
      },
    }),
    async (c) => {
      const capabilities = await getGlobalCapabilities()
      return c.json(capabilities)
    },
  )
}
