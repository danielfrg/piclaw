import { For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { createClient } from "@piclaw/sdk"

import { PromptInput } from "@/components/ui/prompt-input"

type UiMessage = {
  id: string
  role: "user" | "assistant" | "error"
  text: string
}

function App() {
  const client = createClient({
    baseUrl: window.location.origin,
  })
  const [state, setState] = createStore({
    sessionId: null as string | null,
    messages: [] as UiMessage[],
    status: "idle" as "idle" | "sending",
  })

  const createMessageId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  const extractPartsText = (parts?: Array<{ text: string }>) =>
    parts
      ?.map((part) => part.text)
      .join("\n")
      .trim() ?? ""

  const handlePromptSubmit = async (value: string) => {
    if (state.status === "sending") return
    setState("status", "sending")

    setState("messages", (messages) => [...messages, { id: createMessageId(), role: "user", text: value }])

    let activeSessionId = state.sessionId

    if (!activeSessionId) {
      const response = await client.session.create()
      if (!response.data) {
        setState("messages", (messages) => [
          ...messages,
          { id: createMessageId(), role: "error", text: "Could not create session." },
        ])
        setState("status", "idle")
        return
      }
      activeSessionId = response.data.id
      setState("sessionId", activeSessionId)
    }

    const response = await client.session.prompt({
      sessionID: activeSessionId,
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
      setState("status", "idle")
    }
  }

  return (
    <div class="min-h-screen bg-gray-900 text-gray-100">
      <header class="px-4 md:px-10 py-6 border-b border-gray-800">
        <div class="max-w-6xl mx-auto flex items-center justify-between">
          <a class="text-xl font-medium text-gray-100" href="/">
            piclaw<span class="text-blue-400">.</span>
          </a>
          <nav class="flex items-center gap-6 text-sm text-gray-400">
            <a class="hover:text-gray-100 transition-colors" href="#prompt">
              Sessions
            </a>
          </nav>
        </div>
      </header>

      <main class="min-h-[calc(100vh-88px)] flex items-center justify-center px-4 md:px-10">
        <div class="w-full max-w-3xl" id="prompt">
          <div class="mb-6 rounded-2xl border border-gray-800/80 bg-gray-950/40 p-6 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.8)]">
            <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Session</div>
            <div class="mt-2 text-sm text-gray-300">
              <Show when={state.sessionId} fallback="Start by sending a prompt.">
                {`Active: ${state.sessionId}`}
              </Show>
            </div>
          </div>

          <div class="mb-6 space-y-4">
            <Show
              when={state.messages.length > 0}
              fallback={
                <div class="rounded-2xl border border-dashed border-gray-800/80 bg-gray-950/30 p-6 text-sm text-gray-500">
                  No messages yet. Your next prompt will create a session and start the conversation.
                </div>
              }
            >
              <For each={state.messages}>
                {(message) => (
                  <div
                    class={`rounded-2xl border px-5 py-4 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "border-gray-700 bg-gray-950/70 text-gray-100"
                        : message.role === "assistant"
                          ? "border-blue-900/60 bg-blue-950/40 text-blue-100"
                          : "border-rose-900/60 bg-rose-950/40 text-rose-100"
                    }`}
                  >
                    <div class="mb-2 text-xs uppercase tracking-[0.25em] text-gray-500">{message.role}</div>
                    <div class="whitespace-pre-wrap">{message.text}</div>
                  </div>
                )}
              </For>
            </Show>
          </div>

          <PromptInput onSubmit={handlePromptSubmit} disabled={state.status === "sending"} />
        </div>
      </main>
    </div>
  )
}

export default App
