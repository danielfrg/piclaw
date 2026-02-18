import { ProcessTerminal, TUI, Container, matchesKey, visibleWidth, truncateToWidth } from "./tui"
import { Input } from "./components/input"
import { TextLine, Spacer } from "./components/text"
import type { Component } from "./tui"

// -- ANSI helpers --
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`
const blue = (s: string) => `\x1b[38;2;122;162;247m${s}\x1b[39m`
const green = (s: string) => `\x1b[38;2;158;206;106m${s}\x1b[39m`
const yellow = (s: string) => `\x1b[38;2;224;175;104m${s}\x1b[39m`
const purple = (s: string) => `\x1b[38;2;106;90;205m${s}\x1b[39m`
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`

// -- State --
const MODELS = ["claude-sonnet-4", "claude-opus-4", "gpt-4o", "gemini-2.5-pro"]
let modelIndex = 0
let isProcessing = false

// -- Components --
const terminal = new ProcessTerminal()
const tui = new TUI(terminal)

const chatContainer = new Container()
const statusBar = new TextLine()
const input = new Input()
input.prompt = purple("> ")

// Layout: chatContainer -> statusBar -> input
tui.addChild(chatContainer)
tui.addChild(statusBar)
tui.addChild(input)

// -- Status bar --
function updateStatusBar(): void {
  const model = MODELS[modelIndex]!
  const status = isProcessing ? yellow("processing") : dim("ready")
  const hints = dim(`${model} | ctrl+l:cycle ctrl+p:select esc:quit`)
  statusBar.setText(`${status}  ${hints}`)
}
updateStatusBar()

// -- Message rendering --
function addMessage(role: "user" | "assistant", content: string): void {
  const label = role === "user" ? bold(blue("You")) : bold(green("Assistant"))
  chatContainer.addChild(new TextLine(label, false))
  chatContainer.addChild(new TextLine(content, false))
  chatContainer.addChild(new Spacer())
}

// -- Input handling --
// Override TUI's default Ctrl+C behavior -- we handle it in input.handleInput
// The TUI renderer has a hardcoded Ctrl+C -> exit. We need to intercept input
// before it reaches the renderer. We'll do this by making a wrapper component
// that handles global keys before falling through to the input.

class AppController implements Component {
  handleInput(data: string): void {
    // Ctrl+C: cancel or exit
    if (matchesKey(data, "ctrl+c")) {
      if (isProcessing) {
        isProcessing = false
        updateStatusBar()
        tui.requestRender()
      } else {
        tui.stop()
        process.exit(0)
      }
      return
    }

    // Ctrl+L: cycle model
    if (matchesKey(data, "ctrl+l")) {
      modelIndex = (modelIndex + 1) % MODELS.length
      updateStatusBar()
      return
    }

    // Escape: exit
    if (matchesKey(data, "escape")) {
      tui.stop()
      process.exit(0)
    }

    // Pass to input
    input.handleInput(data)
  }

  invalidate(): void {}
  render(): string[] {
    return [] // Not a visual component
  }
}

const controller = new AppController()

input.onSubmit = (value: string) => {
  if (!value.trim() || isProcessing) return

  addMessage("user", value.trim())
  input.setValue("")
  isProcessing = true
  updateStatusBar()
  tui.requestRender()

  // Placeholder: simulate agent response
  setTimeout(() => {
    const model = MODELS[modelIndex]!
    addMessage("assistant", `[${model}] Echo: ${value.trim()}`)
    isProcessing = false
    updateStatusBar()
    tui.requestRender()
  }, 500)
}

// Set focus to the controller (which delegates to input)
tui.setFocus(controller)

// -- Start --
tui.start()
