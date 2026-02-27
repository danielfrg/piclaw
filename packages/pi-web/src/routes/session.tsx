import { createClient } from "@piclaw/sdk"
import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { Show, createEffect, createSignal } from "solid-js"
import { createStore } from "solid-js/store"

import type { ConversationMessage } from "@/components/conversation"
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
    messages: [] as ConversationMessage[],
    status: "idle" as "idle" | "sending",
  })
  // Capture the nav state prompt once at mount time, then discard it.
  // This prevents re-sending on refresh (location.state can persist across reloads).
  const navPrompt = location.state?.prompt ?? ""
  const [initialPrompt, setInitialPrompt] = createSignal(navPrompt)
  const [loaded, setLoaded] = createSignal(false)

  const createMessageId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  const extractPartsText = (parts?: Array<{ text: string }>) =>
    parts
      ?.map((part) => part.text)
      .join("\n")
      .trim() ?? ""

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

    const items = response.data
      .map((message) => {
        const text = extractPartsText(message.parts)
        if (!text) return null
        return {
          id: message.info.id,
          role: message.info.role,
          text,
        } as ConversationMessage
      })
      .filter((item): item is ConversationMessage => item !== null)

    setState("messages", items)
  }

  const sendPrompt = async (value: string) => {
    if (state.status === "sending") return
    setState("status", "sending")
    setState("messages", (messages) => [...messages, { id: createMessageId(), role: "user", text: value }])

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
      setState("messages", (messages) => [
        ...messages,
        { id: createMessageId(), role: "error", text: "Assistant response failed." },
      ])
      setState("status", "idle")
      return
    }

    const assistantText = extractPartsText(response.data.parts)
    if (assistantText) {
      setState("messages", (messages) => [
        ...messages,
        { id: createMessageId(), role: "assistant", text: assistantText },
      ])
    }
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
