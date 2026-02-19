import { Type } from "@sinclair/typebox"
import type { AgentTool } from "@mariozechner/pi-agent-core"

const EchoParams = Type.Object({
  text: Type.String({ description: "Text to echo back" }),
})

export const echoTool: AgentTool<typeof EchoParams> = {
  name: "echo",
  label: "Echo",
  description: "Echoes back the input text. For testing.",
  parameters: EchoParams,
  async execute(_toolCallId, params) {
    return {
      content: [{ type: "text", text: params.text }],
      details: {},
    }
  },
}
