import { describe, test, expect } from "bun:test"

import { Agent } from "@/agent/agent"
import { resolveModel } from "@/agent/model"
import { Config } from "@/config/config"

describe("Agent", () => {
  test("prompts with configured model (integration)", async () => {
    const config = await Config.load()
    if (!config.defaultModel && !config.models?.["litellm/claude-sonnet-4-5"]) return
    if (!process.env.ANTHROPIC_API_KEY) return

    const model = await resolveModel("litellm/claude-sonnet-4-5")

    const agent = Agent.create({
      model,
      systemPrompt: "You are a helpful assistant.",
    })

    await agent.prompt("Hello from a test prompt.")
    const lastMessage = agent.state.messages[agent.state.messages.length - 1]
    expect(lastMessage?.role).toBe("assistant")
    if (lastMessage?.role === "assistant") {
      if (lastMessage.stopReason === "error") {
        console.log(`\nassistant error: ${lastMessage.errorMessage}`)
      }
      expect(lastMessage.stopReason).not.toBe("error")
      // const text = lastMessage.content
      //   ?.filter((block: any) => block.type === "text")
      //   .map((block: any) => block.text)
      //   .join("")
      // console.log(`\nassistant: ${text}`)
    }
    expect(agent.state.messages.length).toBeGreaterThan(0)
  })
})
