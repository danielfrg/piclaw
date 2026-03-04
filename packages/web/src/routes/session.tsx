import {
  createClient,
  type Capabilities,
  type MessageWithParts,
  type ModelInfo,
  type Part,
  type SessionConfig,
  type StreamEvent,
} from "@piclaw/sdk"
import { Puzzle, Sparkles, Wrench } from "lucide-solid"
import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { createEffect, createSignal, For, Show } from "solid-js"
import { createStore } from "solid-js/store"

import { Conversation } from "@/components/conversation"
import { SessionConfigBar } from "@/components/session-config"
import { PromptInput } from "@/components/ui/prompt-input"

type LocationState = {
  prompt?: string
  model?: { provider: string; id: string } | null
  thinkingLevel?: SessionConfig["thinkingLevel"]
}

export default function SessionPage() {
  const client = createClient({
    baseUrl: window.location.origin,
  })
  const params = useParams()
  const location = useLocation<LocationState>()
  const navigate = useNavigate()

  // sessionId is empty string on the home route ("/"), present on "/session/:sessionId"
  const sessionId = () => params.sessionId ?? ""
  const hasSession = () => sessionId() !== ""

  const [state, setState] = createStore({
    messages: [] as MessageWithParts[],
    status: "idle" as "idle" | "sending",
  })
  const [config, setConfig] = createSignal<SessionConfig | undefined>()
  const [models, setModels] = createSignal<ModelInfo[]>([])
  const [capabilities, setCapabilities] = createSignal<Capabilities | undefined>()

  // Local model/thinking selection for pre-session state
  const [selectedModel, setSelectedModel] = createSignal<{ provider: string; id: string } | null>(null)
  const [thinkingLevel, setThinkingLevel] = createSignal<SessionConfig["thinkingLevel"]>("medium")

  // Capture nav state once at mount time, then discard it.
  const navPrompt = location.state?.prompt ?? ""
  const navModel = location.state?.model ?? null
  const navThinkingLevel = location.state?.thinkingLevel ?? null
  const [initialPrompt, setInitialPrompt] = createSignal(navPrompt)
  const [loaded, setLoaded] = createSignal(false)

  // Build a synthetic SessionConfig from local selections (pre-session)
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

  // Use server config when session exists, local config otherwise
  const activeConfig = () => (hasSession() ? config() : localConfig())

  // --- Data loading ---

  const loadGlobalData = async () => {
    const [modelsRes, capabilitiesRes] = await Promise.all([client.model.list(), client.capabilities.list()])

    if (modelsRes.data) setModels(modelsRes.data as ModelInfo[])
    if (capabilitiesRes.data) setCapabilities(capabilitiesRes.data as Capabilities)
  }

  const loadSessionData = async () => {
    const sid = sessionId()
    if (!sid) return

    const [configRes, modelsRes, capabilitiesRes, messagesRes] = await Promise.all([
      client.session.config({ sessionID: sid }),
      client.model.list(),
      client.session.capabilities({ sessionID: sid }),
      client.session.messages({ sessionID: sid }),
    ])

    if (configRes.data) setConfig(configRes.data as SessionConfig)
    if (modelsRes.data) setModels(modelsRes.data as ModelInfo[])
    if (capabilitiesRes.data) setCapabilities(capabilitiesRes.data as Capabilities)
    if (messagesRes.data) setState("messages", messagesRes.data as MessageWithParts[])
  }

  // --- Model/thinking handlers ---

  const handleModelChange = async (provider: string, modelId: string) => {
    if (hasSession()) {
      const res = await client.session.updateConfig({
        sessionID: sessionId(),
        provider,
        modelId,
      })
      if (res.data) setConfig(res.data as SessionConfig)
    } else {
      setSelectedModel({ provider, id: modelId })
      const model = models().find((m) => m.provider === provider && m.id === modelId)
      if (model && !model.reasoning) {
        setThinkingLevel("off")
      }
    }
  }

  const handleThinkingChange = async (level: SessionConfig["thinkingLevel"]) => {
    if (hasSession()) {
      const res = await client.session.updateConfig({
        sessionID: sessionId(),
        thinkingLevel: level,
      })
      if (res.data) setConfig(res.data as SessionConfig)
    } else {
      setThinkingLevel(level)
    }
  }

  // --- Prompt submission ---

  const sendPrompt = async (value: string) => {
    if (state.status === "sending") return
    setState("status", "sending")

    // If no session yet, create one and navigate
    if (!hasSession()) {
      const response = await client.session.create()
      if (!response.data) {
        setState("status", "idle")
        return
      }

      navigate(`/session/${response.data.id}`, {
        state: {
          prompt: value,
          model: selectedModel(),
          thinkingLevel: thinkingLevel(),
        },
      })
      return
    }

    // Existing session: send prompt via streaming SSE
    const sid = sessionId()
    const tempUserMsg: MessageWithParts = {
      info: {
        id: crypto.randomUUID(),
        sessionID: sid,
        role: "user",
        time: { created: Date.now() },
        agent: "pi",
        model: { providerID: "unknown", modelID: "unknown" },
      },
      parts: [
        {
          id: crypto.randomUUID(),
          sessionID: sid,
          messageID: crypto.randomUUID(),
          type: "text",
          text: value,
        },
      ],
    }
    setState("messages", (messages) => [...messages, tempUserMsg])

    // Create a streaming assistant message placeholder
    const streamMsgId = crypto.randomUUID()
    const streamMsg: MessageWithParts = {
      info: {
        id: streamMsgId,
        sessionID: sid,
        role: "assistant",
        time: { created: Date.now() },
        parentID: tempUserMsg.info.id,
        modelID: "unknown",
        providerID: "unknown",
        mode: "server",
        agent: "pi",
        path: { cwd: ".", root: "." },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      },
      parts: [],
    }
    setState("messages", (messages) => [...messages, streamMsg])

    // Index of the streaming message in the store
    const streamIdx = () => state.messages.length - 1

    try {
      const result = await client.session.promptStream(
        {
          sessionID: sid,
          parts: [{ type: "text", text: value }],
        },
        { sseMaxRetryAttempts: 1 },
      )

      for await (const event of result.stream) {
        const evt = event as StreamEvent
        processStreamEvent(evt, sid, streamMsgId, streamIdx())
      }
    } catch (error) {
      // If streaming fails entirely, append an error text part
      const idx = streamIdx()
      setState("messages", idx, "parts", (parts) => [
        ...parts,
        makePart(sid, streamMsgId, { type: "text", text: "Failed to get a response from the assistant." }),
      ])
    }

    setState("status", "idle")
  }

  const abortSession = async () => {
    const sid = sessionId()
    if (!sid || state.status !== "sending") return
    await client.session.abort({ sessionID: sid }).catch(() => {})
  }

  /** Process a single SSE stream event and update the streaming message in-place */
  const processStreamEvent = (evt: StreamEvent, sid: string, msgId: string, idx: number) => {
    switch (evt.type) {
      case "text-delta": {
        setState("messages", idx, "parts", (parts) => {
          // Match on both messageID and contentIndex so a new agent turn
          // (which resets contentIndex to 0) creates a fresh text part
          // instead of appending to the previous turn's text.
          const existing = parts.find(
            (p): p is Part & { type: "text" } =>
              p.type === "text" &&
              (p.metadata?.messageID as string | undefined) === evt.messageID &&
              (p.metadata?.contentIndex as number | undefined) === evt.contentIndex,
          )
          if (existing) {
            return parts.map((p) => (p === existing ? { ...existing, text: existing.text + evt.delta } : p))
          }
          return [
            ...parts,
            makePart(sid, msgId, {
              type: "text",
              text: evt.delta,
              metadata: { messageID: evt.messageID, contentIndex: evt.contentIndex },
            }),
          ]
        })
        break
      }
      case "thinking-delta": {
        setState("messages", idx, "parts", (parts) => {
          const existing = parts.find(
            (p): p is Part & { type: "thinking" } =>
              p.type === "thinking" &&
              (p.metadata?.messageID as string | undefined) === evt.messageID &&
              (p.metadata?.contentIndex as number | undefined) === evt.contentIndex,
          )
          if (existing) {
            return parts.map((p) => (p === existing ? { ...existing, thinking: existing.thinking + evt.delta } : p))
          }
          return [
            ...parts,
            makePart(sid, msgId, {
              type: "thinking",
              thinking: evt.delta,
              metadata: { messageID: evt.messageID, contentIndex: evt.contentIndex },
            }),
          ]
        })
        break
      }
      case "tool-call-end": {
        setState("messages", idx, "parts", (parts) => [
          ...parts,
          makePart(sid, msgId, { type: "tool-call", toolCallId: evt.toolCallId, toolName: evt.toolName, args: {} }),
        ])
        break
      }
      case "tool-exec-end": {
        const content = typeof evt.result === "string" ? evt.result : JSON.stringify(evt.result ?? "", null, 2)
        setState("messages", idx, "parts", (parts) => [
          ...parts,
          makePart(sid, msgId, {
            type: "tool-result",
            toolCallId: evt.toolCallId,
            toolName: evt.toolName,
            content,
            error: evt.error,
          }),
        ])
        break
      }
      case "final": {
        // Replace the streaming message with the real converted messages
        const finalMessages = evt.messages as MessageWithParts[]
        setState("messages", (messages) => {
          const without = messages.filter((m) => m.info.id !== msgId)
          return [...without, ...finalMessages]
        })
        break
      }
      case "aborted": {
        break
      }
      case "error": {
        setState("messages", idx, "parts", (parts) => [
          ...parts,
          makePart(sid, msgId, {
            type: "tool-result",
            toolCallId: crypto.randomUUID(),
            toolName: "system",
            content: evt.error,
            error: true,
          }),
        ])
        break
      }
    }
  }

  /** Create a Part with auto-generated IDs */
  const makePart = (sid: string, msgId: string, fields: Record<string, unknown>): Part =>
    ({
      id: crypto.randomUUID(),
      sessionID: sid,
      messageID: msgId,
      ...fields,
    }) as Part

  // --- Effects ---

  // Load global data on mount (for home state, before a session exists)
  createEffect(() => {
    if (!hasSession()) {
      void loadGlobalData()
    }
  })

  // Load session data when sessionId changes
  createEffect(() => {
    const currentSessionId = sessionId()
    if (!currentSessionId) return
    setLoaded(false)
    setState("messages", [])
    setState("status", "idle")
  })

  createEffect(() => {
    const currentSessionId = sessionId()
    if (!currentSessionId) return
    if (loaded()) return

    setLoaded(true)

    const run = async () => {
      await loadSessionData()
      const prompt = initialPrompt()
      if (!prompt) return
      setInitialPrompt("")
      navigate(`/session/${currentSessionId}`, { replace: true })

      // Apply model/thinking selections from pre-session state
      if (navModel || navThinkingLevel) {
        const res = await client.session.updateConfig({
          sessionID: currentSessionId,
          provider: navModel?.provider,
          modelId: navModel?.id,
          thinkingLevel: navThinkingLevel ?? undefined,
        })
        if (res.data) setConfig(res.data as SessionConfig)
      }

      await sendPrompt(prompt)
    }

    void run()
  })

  // --- Auto-scroll on new messages ---

  let prevMessageCount = 0

  createEffect(() => {
    const count = state.messages.length
    const sending = state.status
    if (count === 0 && sending === "idle") return

    // Instant scroll for bulk loads (session hydration), smooth for incremental messages
    const isBulkLoad = prevMessageCount === 0 && count > 1
    const behavior = isBulkLoad ? "instant" : "smooth"
    prevMessageCount = count

    requestAnimationFrame(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior })
    })
  })

  // --- Derived state ---

  const skills = () => capabilities()?.skills ?? []
  const tools = () => capabilities()?.tools ?? []
  const extensions = () => capabilities()?.extensions ?? []
  const showEmptyState = () => !hasSession() || state.messages.length === 0

  return (
    <div class="relative">
      <div class="px-4 md:px-10 pt-[40px] pb-[250px]">
        <Show
          when={!showEmptyState()}
          fallback={
            <div class="mx-auto w-full max-w-3xl">
              <div class="flex flex-col items-center justify-center min-h-[50vh] gap-8">
                <Show when={skills().length > 0}>
                  <div class="w-full">
                    <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-600 mb-3">
                      <Sparkles class="size-3.5" />
                      Skills
                    </div>
                    <div class="flex flex-col gap-2">
                      <For each={skills()}>
                        {(skill) => (
                          <div class="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
                            <div class="text-sm text-gray-200">{skill.name}</div>
                            <Show when={skill.description}>
                              <div class="text-xs text-gray-500 mt-1 line-clamp-2">{skill.description}</div>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={tools().length > 0}>
                  <div class="w-full">
                    <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-600 mb-3">
                      <Wrench class="size-3.5" />
                      Tools
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <For each={tools()}>
                        {(tool) => (
                          <span
                            class="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-1.5 text-xs text-gray-400"
                            title={tool.description}
                          >
                            {tool.name}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={extensions().length > 0}>
                  <div class="w-full">
                    <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-600 mb-3">
                      <Puzzle class="size-3.5" />
                      Extensions
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <For each={extensions()}>
                        {(ext) => (
                          <span
                            class="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-1.5 text-xs text-gray-400"
                            title={ext.path}
                          >
                            {ext.name}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          }
        >
          <Conversation messages={state.messages} thinking={state.status === "sending"} />
        </Show>
      </div>

      <div class="fixed inset-x-0 bottom-0 pointer-events-none">
        <div class="mx-auto w-full max-w-3xl pointer-events-auto">
          <PromptInput
            variant="session"
            status={state.status}
            onSubmit={sendPrompt}
            onAbort={abortSession}
            placeholder={hasSession() ? "Send a message" : "Start a new conversation"}
            compact
            toolbar={
              <SessionConfigBar
                config={activeConfig()}
                models={models()}
                capabilities={capabilities()}
                onModelChange={handleModelChange}
                onThinkingChange={handleThinkingChange}
              />
            }
          />
        </div>
      </div>
    </div>
  )
}
