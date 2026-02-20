import { ProcessTerminal, TUI, Container, Input, Text, Spacer, Loader, matchesKey } from "@mariozechner/pi-tui"
import type { Component } from "@mariozechner/pi-tui"

import { dim, blue, yellow, purple, bold, red, green } from "./theme"
import { StreamingAssistantMessage } from "./components/message"

export type ToolInfo = {
  name: string
  description: string
}

export type SkillInfo = {
  name: string
  description: string
}

export type AppCallbacks = {
  onSubmit: (text: string) => void
  onAbort: () => void
  onModelChange: (modelId: string) => void
}

export class App {
  private ui: TUI
  private chatContainer: Container
  private statusBar: Text
  private input: Input

  private models: string[]
  private modelIndex: number
  private isProcessing = false
  private activeLoader: Loader | null = null
  private activeToolLoader: Loader | null = null
  private callbacks: AppCallbacks

  constructor(
    models: string[],
    defaultModelIndex: number,
    callbacks: AppCallbacks,
    options?: { tools?: ToolInfo[]; skills?: SkillInfo[] },
  ) {
    this.models = models
    this.modelIndex = defaultModelIndex
    this.callbacks = callbacks

    const terminal = new ProcessTerminal()
    this.ui = new TUI(terminal)
    this.chatContainer = new Container()
    this.statusBar = new Text("", 0, 0)
    this.input = new Input()

    this.ui.addChild(this.chatContainer)
    this.ui.addChild(this.statusBar)
    this.ui.addChild(this.input)

    this.input.onSubmit = (value: string) => {
      if (!value.trim() || this.isProcessing) return
      this.input.setValue("")
      this.callbacks.onSubmit(value.trim())
    }

    this.ui.setFocus(new KeyHandler(this))
    this.updateStatusBar()

    this.showStartupInfo(options?.tools ?? [], options?.skills ?? [])
  }

  private showStartupInfo(tools: ToolInfo[], skills: SkillInfo[]): void {
    this.chatContainer.addChild(new Text(bold(blue("piclaw")), 1, 0))
    this.chatContainer.addChild(new Text(dim(`model: ${this.currentModelId()}`), 1, 0))

    if (tools.length > 0) {
      const toolNames = tools.map((t) => t.name).join(", ")
      this.chatContainer.addChild(new Text(dim(`tools: ${toolNames}`), 1, 0))
    } else {
      this.chatContainer.addChild(new Text(dim("tools: none"), 1, 0))
    }

    if (skills.length > 0) {
      const skillNames = skills.map((s) => s.name).join(", ")
      this.chatContainer.addChild(new Text(dim(`skills: ${skillNames}`), 1, 0))
    }

    this.chatContainer.addChild(new Spacer(1))
  }

  start(): void {
    this.ui.start()
  }

  // Model

  currentModelId(): string {
    return this.models[this.modelIndex]!
  }

  cycleModel(): string {
    this.modelIndex = (this.modelIndex + 1) % this.models.length
    this.updateStatusBar()
    this.requestRender()
    const id = this.currentModelId()
    this.callbacks.onModelChange(id)
    return id
  }

  // Processing state

  setProcessing(processing: boolean): void {
    this.isProcessing = processing
    this.updateStatusBar()
    this.requestRender()
  }

  // Chat

  addUserMessage(text: string): void {
    this.chatContainer.addChild(new Spacer(1))
    this.chatContainer.addChild(new Text(bold(blue("You")), 1, 0))
    this.chatContainer.addChild(new Text(text, 1, 0))
    this.requestRender()
  }

  showLoader(): void {
    this.activeLoader = new Loader(
      this.ui,
      (s) => purple(s),
      (m) => dim(m),
      "Thinking...",
    )
    this.chatContainer.addChild(this.activeLoader)
    this.requestRender()
  }

  hideLoader(): void {
    if (this.activeLoader) {
      this.activeLoader.stop()
      this.chatContainer.removeChild(this.activeLoader)
      this.activeLoader = null
      this.requestRender()
    }
  }

  beginAssistantMessage(): StreamingAssistantMessage {
    const msg = new StreamingAssistantMessage()
    this.chatContainer.addChild(new Spacer(1))
    this.chatContainer.addChild(msg)
    this.requestRender()
    return msg
  }

  showToolExecution(toolName: string): void {
    this.hideToolExecution()
    this.activeToolLoader = new Loader(
      this.ui,
      (s) => yellow(s),
      (m) => dim(m),
      `Running ${toolName}...`,
    )
    this.chatContainer.addChild(this.activeToolLoader)
    this.requestRender()
  }

  hideToolExecution(): void {
    if (this.activeToolLoader) {
      this.activeToolLoader.stop()
      this.chatContainer.removeChild(this.activeToolLoader)
      this.activeToolLoader = null
    }
  }

  showError(message: string): void {
    this.chatContainer.addChild(new Spacer(1))
    this.chatContainer.addChild(new Text(red(`Error: ${message}`), 1, 0))
    this.requestRender()
  }

  requestRender(): void {
    this.ui.requestRender()
  }

  // Key handling

  handleKey(data: string): void {
    if (matchesKey(data, "ctrl+c")) {
      if (this.isProcessing) {
        this.callbacks.onAbort()
      } else {
        this.ui.stop()
        process.exit(0)
      }
      return
    }

    if (matchesKey(data, "ctrl+l")) {
      this.cycleModel()
      return
    }

    if (matchesKey(data, "escape")) {
      this.ui.stop()
      process.exit(0)
    }

    this.input.handleInput(data)
  }

  // Status bar

  private modelDisplayName(): string {
    const full = this.models[this.modelIndex]!
    const lastSlash = full.lastIndexOf("/")
    return lastSlash >= 0 ? full.slice(lastSlash + 1) : full
  }

  private updateStatusBar(): void {
    const status = this.isProcessing ? yellow("processing") : dim("ready")
    const hints = dim(`${this.modelDisplayName()} | ctrl+l:cycle esc:quit`)
    this.statusBar.setText(`${status}  ${hints}`)
  }
}

class KeyHandler implements Component {
  constructor(private app: App) {}

  handleInput(data: string): void {
    this.app.handleKey(data)
  }

  invalidate(): void {}
  render(): string[] {
    return []
  }
}
