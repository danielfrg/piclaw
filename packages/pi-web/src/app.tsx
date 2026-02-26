import { PromptInput } from "@/components/ui/prompt-input"

function App() {
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
          <PromptInput />
        </div>
      </main>
    </div>
  )
}

export default App
