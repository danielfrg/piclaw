import { A, Route } from "@solidjs/router"
import type { ParentProps } from "solid-js"

import HomePage from "@/routes/home"
import SessionPage from "@/routes/session"

function Layout(props: ParentProps) {
  return (
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
          </nav>
        </div>
      </header>
      {props.children}
    </div>
  )
}

function App() {
  return (
    <Route path="/" component={Layout}>
      <Route path="/" component={HomePage} />
      <Route path="/session/:sessionId" component={SessionPage} />
    </Route>
  )
}

export default App
