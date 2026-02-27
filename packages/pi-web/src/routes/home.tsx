import { createClient } from "@piclaw/sdk"
import { useNavigate } from "@solidjs/router"
import { createSignal } from "solid-js"

import { PromptInput } from "@/components/ui/prompt-input"

export default function HomePage() {
  const client = createClient({
    baseUrl: window.location.origin,
  })
  const navigate = useNavigate()
  const [status, setStatus] = createSignal<"idle" | "sending">("idle")

  const handlePromptSubmit = async (value: string) => {
    if (status() === "sending") return
    setStatus("sending")

    const response = await client.session.create()
    if (!response.data) {
      setStatus("idle")
      return
    }

    navigate(`/session/${response.data.id}`, {
      state: { prompt: value },
    })
  }

  return (
    <main class="min-h-[calc(100vh-88px)] flex items-center justify-center px-4 md:px-10">
      <div class="w-full max-w-3xl" id="prompt">
        <PromptInput
          onSubmit={handlePromptSubmit}
          disabled={status() === "sending"}
          placeholder="Start a new conversation"
        />
      </div>
    </main>
  )
}
