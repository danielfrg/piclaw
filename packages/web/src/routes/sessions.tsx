import { createClient, type Session } from "@piclaw/sdk"
import { A } from "@solidjs/router"
import { For, Show, createResource } from "solid-js"

export default function SessionsPage() {
  const client = createClient({
    baseUrl: window.location.origin,
  })

  const [sessions] = createResource(async () => {
    const response = await client.session.list()
    return (response.data ?? []) as Session[]
  })

  return (
    <main class="mx-auto max-w-3xl px-4 md:px-10 pt-10">
      <h1 class="mb-6 text-lg font-medium text-gray-100">Sessions</h1>
      <Show when={!sessions.loading} fallback={<div class="text-sm text-gray-500">Loading...</div>}>
        <Show when={sessions()?.length} fallback={<div class="text-sm text-gray-500">No sessions yet.</div>}>
          <div class="space-y-2">
            <For each={sessions()}>
              {(session) => (
                <A
                  href={`/session/${session.id}`}
                  class="block rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 text-sm hover:border-gray-700 transition-colors"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-gray-200">{session.title}</span>
                    <span class="font-mono text-xs text-gray-600">{session.id.slice(0, 12)}...</span>
                  </div>
                  <div class="mt-1 text-xs text-gray-500">{new Date(session.time.created).toLocaleString()}</div>
                </A>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </main>
  )
}
