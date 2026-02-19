import { Agent, loadConfig, resolveModel, type AgentEvent } from "@piclaw/agent"

import { App } from "./app"
import type { StreamingAssistantMessage } from "./components/message"

// Bootstrap
const config = await loadConfig()
const models = Object.keys(config.models ?? {})
if (models.length === 0) {
  console.error("No models configured. Add models to data/config/config.json")
  process.exit(1)
}

let defaultModelIndex = 0
if (config.defaultModel && models.includes(config.defaultModel)) {
  defaultModelIndex = models.indexOf(config.defaultModel)
}

let currentAgent: Agent | null = null
let streaming: StreamingAssistantMessage | null = null

function subscribeToAgent(agent: Agent): void {
  agent.subscribe((event: AgentEvent) => {
    if (event.type === "message_start") {
      app.hideLoader()
      streaming = app.beginAssistantMessage()
      app.requestRender()
    }

    if (event.type === "message_update" && streaming) {
      streaming.updateContent(event.message)
      app.requestRender()
    }

    if (event.type === "agent_end") {
      streaming = null
      app.setProcessing(false)
    }
  })
}

const app = new App(models, defaultModelIndex, {
  onSubmit: (text) => {
    app.addUserMessage(text)
    app.setProcessing(true)
    app.showLoader()

    const run = async () => {
      try {
        if (!currentAgent) {
          currentAgent = await Agent.create({ modelId: app.currentModelId() })
          subscribeToAgent(currentAgent)
        }

        await currentAgent.prompt(text)
      } catch (err) {
        app.hideLoader()
        app.showError(err instanceof Error ? err.message : String(err))
        streaming = null
        app.setProcessing(false)
      }
    }

    run()
  },

  onAbort: () => {
    if (currentAgent) {
      currentAgent.abort()
      app.hideLoader()
      streaming = null
      app.setProcessing(false)
    }
  },

  onModelChange: async (modelId) => {
    const model = await resolveModel(modelId)
    if (currentAgent) {
      currentAgent.setModel(model)
    }
  },
})

app.start()
