import { createClient, type Capabilities, type ModelInfo, type SessionConfig } from "@piclaw/sdk"
import { useNavigate } from "@solidjs/router"
import { createSignal, onMount } from "solid-js"

import { SessionConfigBar } from "@/components/session-config"
import { PromptInput } from "@/components/ui/prompt-input"

export default function HomePage() {
  const client = createClient({
    baseUrl: window.location.origin,
  })
  const navigate = useNavigate()
  const [status, setStatus] = createSignal<"idle" | "sending">("idle")
  const [models, setModels] = createSignal<ModelInfo[]>([])
  const [capabilities, setCapabilities] = createSignal<Capabilities | undefined>()
  const [selectedModel, setSelectedModel] = createSignal<{ provider: string; id: string } | null>(null)
  const [thinkingLevel, setThinkingLevel] = createSignal<SessionConfig["thinkingLevel"]>("medium")

  onMount(async () => {
    const [modelsRes, capabilitiesRes] = await Promise.all([client.model.list(), client.capabilities.list()])

    if (modelsRes.data) setModels(modelsRes.data as ModelInfo[])
    if (capabilitiesRes.data) setCapabilities(capabilitiesRes.data as Capabilities)
  })

  // Build a synthetic SessionConfig from local selections so the config bar works.
  const localConfig = (): SessionConfig | undefined => {
    const list = models()
    if (!list.length) return undefined

    const sel = selectedModel()
    const model = sel ? list.find((m) => m.provider === sel.provider && m.id === sel.id) : list[0]
    if (!model) return undefined

    return {
      model: { provider: model.provider, id: model.id, name: model.name, reasoning: model.reasoning },
      thinkingLevel: thinkingLevel(),
      availableThinkingLevels: model.reasoning ? ["off", "minimal", "low", "medium", "high", "xhigh"] : ["off"],
      supportsThinking: model.reasoning,
    }
  }

  const handleModelChange = (provider: string, modelId: string) => {
    setSelectedModel({ provider, id: modelId })
    // If new model doesn't support thinking, reset to off
    const model = models().find((m) => m.provider === provider && m.id === modelId)
    if (model && !model.reasoning) {
      setThinkingLevel("off")
    }
  }

  const handleThinkingChange = (level: SessionConfig["thinkingLevel"]) => {
    setThinkingLevel(level)
  }

  const handlePromptSubmit = async (value: string) => {
    if (status() === "sending") return
    setStatus("sending")

    const response = await client.session.create()
    if (!response.data) {
      setStatus("idle")
      return
    }

    navigate(`/session/${response.data.id}`, {
      state: {
        prompt: value,
        model: selectedModel(),
        thinkingLevel: thinkingLevel(),
      },
    })
  }

  return (
    <main class="min-h-[calc(100vh-88px)] flex items-center justify-center px-4 md:px-10">
      <div class="w-full max-w-3xl" id="prompt">
        <PromptInput
          onSubmit={handlePromptSubmit}
          disabled={status() === "sending"}
          placeholder="Start a new conversation"
          toolbar={
            <SessionConfigBar
              config={localConfig()}
              models={models()}
              capabilities={capabilities()}
              onModelChange={handleModelChange}
              onThinkingChange={handleThinkingChange}
            />
          }
        />
      </div>
    </main>
  )
}
