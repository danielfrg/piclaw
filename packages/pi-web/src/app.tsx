import { createSignal } from "solid-js"
import { createClient } from "@piclaw/sdk"

import { PromptInput } from "@/components/ui/prompt-input"

function App() {
  const client = createClient({
    baseUrl: window.location.origin,
  })
  const [sessionId, setSessionId] = createSignal<string | null>(null)

  const handlePromptSubmit = async (value: string) => {
    let activeSessionId = sessionId()

    if (!activeSessionId) {
      const response = await client.session.create()
      if (!response.data) return
      activeSessionId = response.data.id
      setSessionId(activeSessionId)
    }

    await client.session.prompt({
      sessionID: activeSessionId,
      parts: [{ type: "text", text: value }],
    })
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
          <PromptInput onSubmit={handlePromptSubmit} />
        </div>
      </main>
    </div>
  )
}

export default App
