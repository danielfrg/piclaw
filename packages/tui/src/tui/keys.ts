/**
 * Key matching utilities for raw terminal input.
 */

/** Check if raw input matches a specific key */
export function matchesKey(data: string, key: string): boolean {
  switch (key) {
    case "enter":
      return data === "\r" || data === "\n"
    case "escape":
      return data === "\x1b"
    case "backspace":
      return data === "\x7f" || data === "\b"
    case "delete":
      return data === "\x1b[3~"
    case "tab":
      return data === "\t"
    case "up":
      return data === "\x1b[A"
    case "down":
      return data === "\x1b[B"
    case "right":
      return data === "\x1b[C"
    case "left":
      return data === "\x1b[D"
    case "home":
      return data === "\x1b[H" || data === "\x01" // Ctrl+A
    case "end":
      return data === "\x1b[F" || data === "\x05" // Ctrl+E
    case "ctrl+c":
      return data === "\x03"
    case "ctrl+d":
      return data === "\x04"
    case "ctrl+l":
      return data === "\x0c"
    case "ctrl+p":
      return data === "\x10"
    case "ctrl+u":
      return data === "\x15"
    case "ctrl+k":
      return data === "\x0b"
    case "ctrl+w":
      return data === "\x17"
    case "ctrl+a":
      return data === "\x01"
    case "ctrl+e":
      return data === "\x05"
    default:
      return false
  }
}

/** Check if input is a printable character (not a control sequence) */
export function isPrintable(data: string): boolean {
  if (data.length === 0) return false
  // Reject control characters and escape sequences
  const code = data.charCodeAt(0)
  if (code < 32 || code === 0x7f) return false
  if (data.startsWith("\x1b")) return false
  return true
}
