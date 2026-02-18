/**
 * Utility functions for visible width calculation and text truncation.
 */

// Strip ANSI escape sequences to measure visible width
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b_[^\x07]*\x07/g

/** Calculate the visible width of a string (ignoring ANSI escape sequences) */
export function visibleWidth(str: string): number {
  const stripped = str.replace(ANSI_RE, "")
  let width = 0
  for (const ch of stripped) {
    const code = ch.codePointAt(0)!
    // CJK wide characters (rough heuristic)
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe6f) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x2fffd) ||
      (code >= 0x30000 && code <= 0x3fffd)
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

/** Truncate a string to a given visible width, preserving ANSI codes */
export function truncateToWidth(str: string, maxWidth: number): string {
  let width = 0
  let result = ""
  let i = 0

  while (i < str.length) {
    // Check for ANSI escape sequence
    const remaining = str.slice(i)
    const ansiMatch = remaining.match(/^(\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b_[^\x07]*\x07)/)
    if (ansiMatch) {
      result += ansiMatch[0]
      i += ansiMatch[0].length
      continue
    }

    const ch = str[i]!
    const code = ch.codePointAt(0)!
    const charWidth =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe6f) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x2fffd) ||
      (code >= 0x30000 && code <= 0x3fffd)
        ? 2
        : 1

    if (width + charWidth > maxWidth) break
    result += ch
    width += charWidth
    i += ch.length
  }

  return result
}

/** Wrap text to a given width (simple word wrap, preserves explicit newlines) */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("")
      continue
    }
    let current = ""
    let currentWidth = 0
    for (const word of paragraph.split(" ")) {
      const wordWidth = visibleWidth(word)
      if (currentWidth > 0 && currentWidth + 1 + wordWidth > width) {
        lines.push(current)
        current = word
        currentWidth = wordWidth
      } else {
        current = currentWidth > 0 ? current + " " + word : word
        currentWidth = currentWidth > 0 ? currentWidth + 1 + wordWidth : wordWidth
      }
    }
    if (current) lines.push(current)
  }
  return lines.length > 0 ? lines : [""]
}
