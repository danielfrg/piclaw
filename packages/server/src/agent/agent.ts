import { Agent as PiAgent } from "@mariozechner/pi-agent-core"
import type { Api, Model } from "@mariozechner/pi-ai"
import z from "zod"

import { buildSystemPrompt, type SystemPromptOptions } from "@/agent/system-prompt"

export namespace Agent {
  export const Info = z
    .object({
      name: z.string(),
      description: z.string(),
      model: z.object({
        modelID: z.string(),
        providerID: z.string(),
      }),
    })
    .meta({
      ref: "Agent",
    })

  export type Info = z.infer<typeof Info>

  export type CreateAgentOptions = {
    model: Model<Api>
    systemPrompt?: string
    systemPromptOptions?: SystemPromptOptions
  }

  export function create(options: CreateAgentOptions) {
    const systemPrompt = options.systemPrompt ?? buildSystemPrompt(options.systemPromptOptions)
    return new PiAgent({
      initialState: {
        systemPrompt,
        model: options.model,
      },
    })
  }
}
