import { A, Route } from "@solidjs/router"
import type { ParentProps } from "solid-js"

import { MarkedProvider } from "@/context/marked"
import HomePage from "@/routes/home"
import SessionPage from "@/routes/session"
import SessionsPage from "@/routes/sessions"

function Layout(props: ParentProps) {
  return (
    <MarkedProvider>
      <div class="min-h-screen bg-gray-900 text-gray-100">
        <header class="px-4 md:px-10 py-6 border-b border-gray-800">
          <div class="max-w-6xl mx-auto flex items-center justify-between">
            <A class="text-xl font-medium text-gray-100" href="/">
              piclaw<span class="text-blue-400">.</span>
            </A>
            <nav class="flex items-center gap-6 text-sm text-gray-400">
              <A class="hover:text-gray-100 transition-colors" href="/">
                Home
              </A>
              <A class="hover:text-gray-100 transition-colors" href="/sessions">
                Sessions
              </A>
            </nav>
          </div>
        </header>
        {props.children}
      </div>
    </MarkedProvider>
  )
}

function App() {
  return (
    <Route path="/" component={Layout}>
      <Route path="/" component={HomePage} />
      <Route path="/sessions" component={SessionsPage} />
      <Route path="/session/:sessionId" component={SessionPage} />
    </Route>
  )
}

export default App
