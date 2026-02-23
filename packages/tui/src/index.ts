import {
  Agent,
  loadConfig,
  loadSkills,
  resolveModel,
  echoTool,
  bashTool,
  createNotesSearchTool,
  type AgentEvent,
} from "@piclaw/agent"

import { App } from "./app"
import type { ToolInfo, SkillInfo } from "./app"
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

// Load skills from config
const skillPaths = config.skills ?? []
const { skills } = loadSkills({ skillPaths })

// Build tools list, conditionally including notes search if vectordb is configured
const tools = config.vectordb?.url
  ? [
      bashTool,
      echoTool,
      createNotesSearchTool({ qdrantUrl: config.vectordb.url, collection: config.vectordb.collection ?? "notes" }),
    ]
  : [bashTool, echoTool]

// Build info for TUI display
const toolInfos: ToolInfo[] = tools.map((t) => ({ name: t.name, description: t.description }))
const skillInfos: SkillInfo[] = skills.map((s) => ({ name: s.name, description: s.description }))

let currentAgent: Agent | null = null
let streaming: StreamingAssistantMessage | null = null

const VISIBLE_EVENT_TYPES = new Set(["text_start", "text_delta", "thinking_start", "thinking_delta"])

function subscribeToAgent(agent: Agent): void {
  agent.subscribe((event: AgentEvent) => {
    // Create the streaming message lazily on first visible content
    if (event.type === "message_update") {
      if (!streaming && VISIBLE_EVENT_TYPES.has(event.assistantMessageEvent.type)) {
        app.hideLoader()
        streaming = app.beginAssistantMessage()
      }
      if (streaming) {
        streaming.updateContent(event.message)
        app.requestRender()
      }
    }

    if (event.type === "message_end") {
      streaming = null
    }

    if (event.type === "tool_execution_start") {
      app.showToolExecution(event.toolName)
      app.requestRender()
    }

    if (event.type === "tool_execution_end") {
      app.hideToolExecution()
      app.requestRender()
    }

    if (event.type === "agent_end") {
      streaming = null
      app.setProcessing(false)
    }
  })
}

const app = new App(
  models,
  defaultModelIndex,
  {
    onSubmit: (text) => {
      app.addUserMessage(text)
      app.setProcessing(true)
      app.showLoader()

      const run = async () => {
        try {
          if (!currentAgent) {
            currentAgent = await Agent.create({
              modelId: app.currentModelId(),
              tools,
              skills,
            })
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
  },
  { tools: toolInfos, skills: skillInfos },
)

app.start()
