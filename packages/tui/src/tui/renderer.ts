/**
 * TUI renderer with differential rendering.
 * Extends Container - the root of the component tree.
 * Compares previous vs current lines and only repaints what changed.
 */

import { Container, type Component } from "./component"
import type { Terminal } from "./terminal"
import { visibleWidth } from "./utils"

export class TUI extends Container {
  terminal: Terminal
  private previousLines: string[] = []
  private previousWidth = 0
  private focusedComponent: Component | null = null
  private renderRequested = false
  private cursorRow = 0
  private maxLinesRendered = 0
  private stopped = false

  constructor(terminal: Terminal) {
    super()
    this.terminal = terminal
  }

  setFocus(component: Component | null): void {
    this.focusedComponent = component
  }

  start(): void {
    this.stopped = false
    this.terminal.start(
      (data) => this.handleInput(data),
      () => this.requestRender(),
    )
    this.terminal.hideCursor()
    this.requestRender()
  }

  stop(): void {
    this.stopped = true
    // Move cursor to end of content
    if (this.previousLines.length > 0) {
      const targetRow = this.previousLines.length
      const diff = targetRow - this.cursorRow
      if (diff > 0) this.terminal.write(`\x1b[${diff}B`)
      else if (diff < 0) this.terminal.write(`\x1b[${-diff}A`)
      this.terminal.write("\r\n")
    }
    this.terminal.showCursor()
    this.terminal.stop()
  }

  requestRender(force = false): void {
    if (force) {
      this.previousLines = []
      this.previousWidth = -1
      this.cursorRow = 0
      this.maxLinesRendered = 0
    }
    if (this.renderRequested) return
    this.renderRequested = true
    process.nextTick(() => {
      this.renderRequested = false
      this.doRender()
    })
  }

  private handleInput(data: string): void {
    if (this.focusedComponent?.handleInput) {
      this.focusedComponent.handleInput(data)
      this.requestRender()
    }
  }

  private doRender(): void {
    if (this.stopped) return
    const width = this.terminal.columns
    const height = this.terminal.rows

    // Render all components
    let newLines = this.render(width)

    // Append reset to each line
    const reset = "\x1b[0m"
    newLines = newLines.map((l) => l + reset)

    const widthChanged = this.previousWidth !== 0 && this.previousWidth !== width

    // Full render helper
    const fullRender = (clear: boolean): void => {
      let buffer = "\x1b[?2026h" // begin sync
      if (clear) buffer += "\x1b[2J\x1b[H" // clear screen + home
      for (let i = 0; i < newLines.length; i++) {
        if (i > 0) buffer += "\r\n"
        buffer += newLines[i]
      }
      buffer += "\x1b[?2026l" // end sync
      this.terminal.write(buffer)
      this.cursorRow = Math.max(0, newLines.length - 1)
      this.maxLinesRendered = clear ? newLines.length : Math.max(this.maxLinesRendered, newLines.length)
      this.previousLines = newLines
      this.previousWidth = width
    }

    // First render
    if (this.previousLines.length === 0 && !widthChanged) {
      fullRender(false)
      return
    }

    // Width changed
    if (widthChanged) {
      fullRender(true)
      return
    }

    // Find changed range
    let firstChanged = -1
    let lastChanged = -1
    const maxLines = Math.max(newLines.length, this.previousLines.length)
    for (let i = 0; i < maxLines; i++) {
      const oldLine = i < this.previousLines.length ? this.previousLines[i] : ""
      const newLine = i < newLines.length ? newLines[i] : ""
      if (oldLine !== newLine) {
        if (firstChanged === -1) firstChanged = i
        lastChanged = i
      }
    }

    // No changes
    if (firstChanged === -1) return

    // Differential render
    const viewportTop = Math.max(0, this.maxLinesRendered - height)
    const computeLineDiff = (targetRow: number): number => {
      const currentScreen = this.cursorRow - viewportTop
      const targetScreen = targetRow - viewportTop
      return targetScreen - currentScreen
    }

    let buffer = "\x1b[?2026h" // begin sync

    // Move to first changed line
    const lineDiff = computeLineDiff(firstChanged)
    if (lineDiff > 0) buffer += `\x1b[${lineDiff}B`
    else if (lineDiff < 0) buffer += `\x1b[${-lineDiff}A`
    buffer += "\r"

    // Render changed lines
    const renderEnd = Math.min(lastChanged, newLines.length - 1)
    for (let i = firstChanged; i <= renderEnd; i++) {
      if (i > firstChanged) buffer += "\r\n"
      buffer += "\x1b[2K" // clear line
      buffer += newLines[i]
    }

    this.cursorRow = renderEnd

    // Clear extra lines if content shrunk
    if (this.previousLines.length > newLines.length) {
      const extra = this.previousLines.length - newLines.length
      for (let i = 0; i < extra; i++) {
        buffer += "\r\n\x1b[2K"
      }
      buffer += `\x1b[${extra}A`
    }

    this.maxLinesRendered = Math.max(this.maxLinesRendered, newLines.length)

    buffer += "\x1b[?2026l" // end sync
    this.terminal.write(buffer)
    this.previousLines = newLines
    this.previousWidth = width
  }
}
