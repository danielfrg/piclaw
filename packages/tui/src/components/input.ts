/**
 * Single-line input component with cursor and horizontal scrolling.
 * Inspired by pi-tui's Input but minimal.
 */

import type { Component } from "../tui/component"
import { matchesKey, isPrintable } from "../tui/keys"
import { visibleWidth } from "../tui/utils"

export class Input implements Component {
  private value = ""
  private cursor = 0
  public prompt = "> "
  public onSubmit?: (value: string) => void
  public onEscape?: () => void

  getValue(): string {
    return this.value
  }

  setValue(value: string): void {
    this.value = value
    this.cursor = Math.min(this.cursor, value.length)
  }

  handleInput(data: string): void {
    // Submit
    if (matchesKey(data, "enter")) {
      if (this.onSubmit) this.onSubmit(this.value)
      return
    }

    // Escape
    if (matchesKey(data, "escape")) {
      if (this.onEscape) this.onEscape()
      return
    }

    // Backspace
    if (matchesKey(data, "backspace")) {
      if (this.cursor > 0) {
        this.value = this.value.slice(0, this.cursor - 1) + this.value.slice(this.cursor)
        this.cursor--
      }
      return
    }

    // Delete
    if (matchesKey(data, "delete")) {
      if (this.cursor < this.value.length) {
        this.value = this.value.slice(0, this.cursor) + this.value.slice(this.cursor + 1)
      }
      return
    }

    // Cursor movement
    if (matchesKey(data, "left")) {
      if (this.cursor > 0) this.cursor--
      return
    }
    if (matchesKey(data, "right")) {
      if (this.cursor < this.value.length) this.cursor++
      return
    }
    if (matchesKey(data, "home") || matchesKey(data, "ctrl+a")) {
      this.cursor = 0
      return
    }
    if (matchesKey(data, "end") || matchesKey(data, "ctrl+e")) {
      this.cursor = this.value.length
      return
    }

    // Ctrl+U: delete to start of line
    if (matchesKey(data, "ctrl+u")) {
      this.value = this.value.slice(this.cursor)
      this.cursor = 0
      return
    }

    // Ctrl+K: delete to end of line
    if (matchesKey(data, "ctrl+k")) {
      this.value = this.value.slice(0, this.cursor)
      return
    }

    // Ctrl+W: delete word backwards
    if (matchesKey(data, "ctrl+w")) {
      if (this.cursor > 0) {
        let pos = this.cursor - 1
        // Skip whitespace
        while (pos > 0 && this.value[pos] === " ") pos--
        // Skip word
        while (pos > 0 && this.value[pos - 1] !== " ") pos--
        this.value = this.value.slice(0, pos) + this.value.slice(this.cursor)
        this.cursor = pos
      }
      return
    }

    // Printable characters
    if (isPrintable(data)) {
      this.value = this.value.slice(0, this.cursor) + data + this.value.slice(this.cursor)
      this.cursor += data.length
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    const availableWidth = width - visibleWidth(this.prompt)
    if (availableWidth <= 0) return [this.prompt]

    let visibleText = ""
    let cursorDisplay = this.cursor

    if (this.value.length <= availableWidth) {
      visibleText = this.value
    } else {
      // Horizontal scrolling
      const halfWidth = Math.floor(availableWidth / 2)
      if (this.cursor < halfWidth) {
        visibleText = this.value.slice(0, availableWidth)
        cursorDisplay = this.cursor
      } else if (this.cursor > this.value.length - halfWidth) {
        const start = this.value.length - availableWidth
        visibleText = this.value.slice(start)
        cursorDisplay = this.cursor - start
      } else {
        const start = this.cursor - halfWidth
        visibleText = this.value.slice(start, start + availableWidth)
        cursorDisplay = halfWidth
      }
    }

    // Build line with inverse-video cursor
    const beforeCursor = visibleText.slice(0, cursorDisplay)
    const atCursor = visibleText[cursorDisplay] ?? " "
    const afterCursor = visibleText.slice(cursorDisplay + atCursor.length)
    const cursorChar = `\x1b[7m${atCursor}\x1b[27m`

    return [this.prompt + beforeCursor + cursorChar + afterCursor]
  }
}
