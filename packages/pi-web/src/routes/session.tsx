import { createClient, type MessageWithParts } from "@piclaw/sdk"
import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { createEffect, createSignal } from "solid-js"
import { createStore } from "solid-js/store"

import { Conversation } from "@/components/conversation"
import { PromptInput } from "@/components/ui/prompt-input"

type LocationState = {
  prompt?: string
}

export default function SessionPage() {
  const client = createClient({
    baseUrl: window.location.origin,
  })
  const params = useParams()
  const location = useLocation<LocationState>()
  const navigate = useNavigate()
  const sessionId = () => params.sessionId ?? ""

  const [state, setState] = createStore({
    messages: [] as MessageWithParts[],
    status: "idle" as "idle" | "sending",
  })
  // Capture the nav state prompt once at mount time, then discard it.
  // This prevents re-sending on refresh (location.state can persist across reloads).
  const navPrompt = location.state?.prompt ?? ""
  const [initialPrompt, setInitialPrompt] = createSignal(navPrompt)
  const [loaded, setLoaded] = createSignal(false)

  createEffect(() => {
    const currentSessionId = sessionId()
    if (!currentSessionId) return
    setLoaded(false)
    setState("messages", [])
    setState("status", "idle")
  })

  const loadMessages = async () => {
    const currentSessionId = sessionId()
    if (!currentSessionId) return

    const response = await client.session.messages({ sessionID: currentSessionId })
    if (!response.data) return

    setState("messages", response.data as MessageWithParts[])
  }

  const sendPrompt = async (value: string) => {
    if (state.status === "sending") return
    setState("status", "sending")

    // Optimistic user message
    const tempUserMsg: MessageWithParts = {
      info: {
        id: crypto.randomUUID(),
        sessionID: sessionId(),
        role: "user",
        time: { created: Date.now() },
        agent: "pi",
        model: { providerID: "unknown", modelID: "unknown" },
      },
      parts: [
        {
          id: crypto.randomUUID(),
          sessionID: sessionId(),
          messageID: crypto.randomUUID(),
          type: "text",
          text: value,
        },
      ],
    }
    setState("messages", (messages) => [...messages, tempUserMsg])

    const currentSessionId = sessionId()
    if (!currentSessionId) {
      setState("status", "idle")
      return
    }

    const response = await client.session.prompt({
      sessionID: currentSessionId,
      parts: [{ type: "text", text: value }],
    })

    if (response.error || !response.data) {
      const errorMsg: MessageWithParts = {
        info: {
          id: crypto.randomUUID(),
          sessionID: currentSessionId,
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
        parts: [
          {
            id: crypto.randomUUID(),
            sessionID: currentSessionId,
            messageID: crypto.randomUUID(),
            type: "text",
            text: "Failed to get a response from the assistant.",
          },
        ],
      }
      setState("messages", (messages) => [...messages, errorMsg])
      setState("status", "idle")
      return
    }

    const newMessages = response.data as MessageWithParts[]
    setState("messages", (messages) => [...messages, ...newMessages])
    setState("status", "idle")
  }

  createEffect(() => {
    const currentSessionId = sessionId()
    if (!currentSessionId) return
    if (loaded()) return

    setLoaded(true)

    const run = async () => {
      await loadMessages()
      const prompt = initialPrompt()
      if (!prompt) return
      setInitialPrompt("")
      // Clear location state so refresh doesn't re-send the prompt.
      navigate(`/session/${currentSessionId}`, { replace: true })
      await sendPrompt(prompt)
    }

    void run()
  })

  return (
    <div class="relative">
      <div class="px-4 md:px-10 pt-[40px] pb-[250px]">
        <Conversation messages={state.messages} thinking={state.status === "sending"} />
      </div>

      <div class="fixed inset-x-0 bottom-0 pointer-events-none">
        <div class="mx-auto w-full max-w-3xl px-4 md:px-10 pointer-events-auto">
          <PromptInput
            variant="session"
            onSubmit={sendPrompt}
            disabled={state.status === "sending"}
            placeholder="Send a message"
            compact
          />
        </div>
      </div>
    </div>
  )
}
