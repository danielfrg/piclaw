/**
 * Terminal abstraction - raw mode, cursor movement, writing.
 * Inspired by pi-tui's ProcessTerminal but minimal.
 */

export interface Terminal {
  start(onInput: (data: string) => void, onResize: () => void): void
  stop(): void
  write(data: string): void
  get columns(): number
  get rows(): number
  hideCursor(): void
  showCursor(): void
}

export class ProcessTerminal implements Terminal {
  private wasRaw = false
  private inputHandler?: (data: string) => void
  private resizeHandler?: () => void

  start(onInput: (data: string) => void, onResize: () => void): void {
    this.inputHandler = onInput
    this.resizeHandler = onResize

    this.wasRaw = process.stdin.isRaw || false
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true)
    }
    process.stdin.setEncoding("utf8")
    process.stdin.resume()

    // Enable bracketed paste mode
    process.stdout.write("\x1b[?2004h")

    process.stdin.on("data", (data: string) => {
      if (this.inputHandler) this.inputHandler(data)
    })
    process.stdout.on("resize", () => {
      if (this.resizeHandler) this.resizeHandler()
    })
  }

  stop(): void {
    // Disable bracketed paste mode
    process.stdout.write("\x1b[?2004l")

    process.stdin.pause()
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(this.wasRaw)
    }
  }

  write(data: string): void {
    process.stdout.write(data)
  }

  get columns(): number {
    return process.stdout.columns || 80
  }

  get rows(): number {
    return process.stdout.rows || 24
  }

  hideCursor(): void {
    process.stdout.write("\x1b[?25l")
  }

  showCursor(): void {
    process.stdout.write("\x1b[?25h")
  }
}
