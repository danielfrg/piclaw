import { createClient, type Session } from "@piclaw/sdk"
import { Drawer } from "@danielfrg/solid-ui/drawer"
import { PanelLeft, Plus } from "lucide-solid"
import { A, Route, useNavigate } from "@solidjs/router"
import { createResource, createSignal, For, Show } from "solid-js"
import type { ParentProps } from "solid-js"

import { MarkedProvider } from "@/context/marked"
import SessionPage from "@/routes/session"
import SessionsPage from "@/routes/sessions"

function Layout(props: ParentProps) {
  const client = createClient({ baseUrl: window.location.origin })
  const navigate = useNavigate()
  const [open, setOpen] = createSignal(false)

  const [sessions, { refetch }] = createResource(async () => {
    const response = await client.session.list()
    return (response.data ?? []) as Session[]
  })

  const handleNewChat = () => {
    setOpen(false)
    navigate("/")
  }

  const handleSessionClick = (id: string) => {
    setOpen(false)
    navigate(`/session/${id}`)
  }

  return (
    <MarkedProvider>
      <div class="min-h-screen bg-gray-900 text-gray-100">
        {/* Toggle button -- fixed top-left, always visible */}
        <button
          onClick={() => {
            if (!open()) void refetch()
            setOpen(!open())
          }}
          class="fixed top-4 left-4 z-50 flex size-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors cursor-pointer"
          aria-label={open() ? "Close sidebar" : "Open sidebar"}
        >
          <PanelLeft class="size-5" />
        </button>

        {/* Drawer sidebar */}
        <Drawer side="left" open={open()} onOpenChange={() => {}} modal={false}>
          <Drawer.Portal>
            <Drawer.Popup class="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-gray-800 bg-gray-950 outline-none">
              {/* Logo */}
              <div class="px-5 pt-5 pb-4 text-center">
                <A href="/" class="text-lg font-medium text-gray-100" onClick={() => setOpen(false)}>
                  piclaw<span class="text-blue-400">.</span>
                </A>
              </div>

              {/* New chat */}
              <div class="px-3">
                <button
                  onClick={handleNewChat}
                  class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <Plus class="size-4" />
                  New chat
                </button>
              </div>

              {/* Sessions list */}
              <div class="mt-4 flex-1 overflow-y-auto px-3 pb-4">
                <div class="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-gray-600">Sessions</div>
                <Show when={!sessions.loading} fallback={<div class="px-3 text-xs text-gray-600">Loading...</div>}>
                  <Show
                    when={sessions()?.length}
                    fallback={<div class="px-3 text-xs text-gray-600">No sessions yet.</div>}
                  >
                    <div class="flex flex-col gap-0.5">
                      <For each={sessions()}>
                        {(session) => (
                          <button
                            onClick={() => handleSessionClick(session.id)}
                            class="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors cursor-pointer truncate"
                          >
                            {session.title}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </Show>
              </div>
            </Drawer.Popup>
          </Drawer.Portal>
        </Drawer>

        {props.children}
      </div>
    </MarkedProvider>
  )
}

function App() {
  return (
    <Route path="/" component={Layout}>
      <Route path="/" component={SessionPage} />
      <Route path="/sessions" component={SessionsPage} />
      <Route path="/session/:sessionId" component={SessionPage} />
    </Route>
  )
}

export default App
