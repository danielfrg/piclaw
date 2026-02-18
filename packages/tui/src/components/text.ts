/**
 * Text component - renders styled text with word wrapping.
 */

import type { Component } from "../tui/component"
import { visibleWidth, wrapText } from "../tui/utils"

export class TextLine implements Component {
  private text: string
  private padToWidth: boolean

  constructor(text = "", padToWidth = true) {
    this.text = text
    this.padToWidth = padToWidth
  }

  setText(text: string): void {
    this.text = text
  }

  invalidate(): void {}

  render(width: number): string[] {
    if (!this.text) return [""]
    const lines = wrapText(this.text, width)
    if (this.padToWidth) {
      return lines.map((line) => {
        const pad = Math.max(0, width - visibleWidth(line))
        return line + " ".repeat(pad)
      })
    }
    return lines
  }
}

/** A simple empty line spacer */
export class Spacer implements Component {
  private lines: number

  constructor(lines = 1) {
    this.lines = lines
  }

  invalidate(): void {}

  render(): string[] {
    return Array.from({ length: this.lines }, () => "")
  }
}
