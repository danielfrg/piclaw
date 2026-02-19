import { Container, Text, Markdown } from "@mariozechner/pi-tui"

import { bold, green, italic, dim, red, mdTheme } from "../theme"

export class StreamingAssistantMessage extends Container {
  private content: Container

  constructor() {
    super()
    this.content = new Container()
    this.addChild(new Text(bold(green("Assistant")), 1, 0))
    this.addChild(this.content)
  }

  updateContent(message: unknown): void {
    this.content.clear()
    const msg = message as { content?: unknown[]; stopReason?: string; errorMessage?: string }
    if (!msg?.content || !Array.isArray(msg.content)) return

    for (const block of msg.content) {
      const b = block as { type: string; text?: string; thinking?: string }
      if (b.type === "text" && b.text?.trim()) {
        this.content.addChild(new Markdown(b.text.trim(), 1, 0, mdTheme))
      } else if (b.type === "thinking" && b.thinking?.trim()) {
        this.content.addChild(new Text(italic(dim(b.thinking.trim())), 1, 0))
      }
    }

    if (msg.stopReason === "error" && msg.errorMessage) {
      this.content.addChild(new Text(red(`Error: ${msg.errorMessage}`), 1, 0))
    }
  }
}
