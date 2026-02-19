import { describe, test, expect } from "bun:test"

import { Agent, loadConfig } from "@piclaw/agent"

describe("Agent", () => {
  test("prompts with configured model (integration)", async () => {
    const config = await loadConfig()
    if (!config.defaultModel && !config.models?.["litellm/claude-sonnet-4-5"]) return
    if (!process.env.ANTHROPIC_API_KEY) return

    const agent = await Agent.create({
      modelId: "litellm/claude-sonnet-4-5",
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
    }
    expect(agent.state.messages.length).toBeGreaterThan(0)
  })
})
