import { Button } from "./components/ui/button"

function App() {
  return (
    <div class="min-h-screen bg-gray-900 text-gray-100">
      <header class="px-4 md:px-10 py-6 border-b border-gray-800">
        <div class="max-w-6xl mx-auto flex items-center justify-between">
          <a class="text-xl font-medium text-gray-100" href="/">
            piclaw<span class="text-blue-400">.</span>
          </a>
          <nav class="flex items-center gap-6 text-sm text-gray-400">
            <a class="hover:text-gray-100 transition-colors" href="#sessions">
              Sessions
            </a>
          </nav>
        </div>
      </header>

      <main class="px-4 md:px-10 py-20">
        <div class="max-w-6xl mx-auto grid gap-16 lg:grid-cols-[1.2fr_0.8fr]">
          <section class="space-y-6">
            <p class="text-sm uppercase tracking-[0.3em] text-gray-500">Embedded agent runtime</p>
            <h1 class="text-4xl md:text-5xl font-medium leading-tight">
              A focused control room for pi sessions and tool-driven builds.
            </h1>
            <p class="text-base md:text-lg text-gray-400 max-w-xl">
              Manage sessions, prompt runs, and responses in a dark, distraction-free workspace. Build faster workflows
              with a clean UI that stays out of your way.
            </p>
            <div class="flex flex-wrap items-center gap-4">
              <Button>Start a session</Button>
              <Button variant="ghost" disabled>
                Read the docs
              </Button>
            </div>
          </section>

          <aside class="space-y-4">
            <div class="rounded-lg border border-gray-800 bg-gray-800 p-6">
              <h2 class="text-sm font-medium text-gray-200 mb-3">Active session</h2>
              <div class="space-y-3 text-sm text-gray-400">
                <div class="flex items-center justify-between">
                  <span>Model</span>
                  <span class="text-gray-200">openai/gpt-4.1</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Status</span>
                  <span class="text-blue-400">Ready</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Tools</span>
                  <span class="text-gray-200">bash, read, write</span>
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-gray-800 bg-gray-800 p-6">
              <h2 class="text-sm font-medium text-gray-200 mb-3">Recent prompts</h2>
              <ul class="space-y-3 text-sm text-gray-400">
                <li class="flex items-center justify-between">
                  <span>Summarize logs</span>
                  <span class="text-gray-500">2m ago</span>
                </li>
                <li class="flex items-center justify-between">
                  <span>Draft release notes</span>
                  <span class="text-gray-500">12m ago</span>
                </li>
                <li class="flex items-center justify-between">
                  <span>Refactor API routes</span>
                  <span class="text-gray-500">30m ago</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default App
