import type { MarkdownTheme } from "@mariozechner/pi-tui"

// ANSI helpers
export const dim = (s: string) => `\x1b[2m${s}\x1b[22m`
export const blue = (s: string) => `\x1b[38;2;122;162;247m${s}\x1b[39m`
export const green = (s: string) => `\x1b[38;2;158;206;106m${s}\x1b[39m`
export const yellow = (s: string) => `\x1b[38;2;224;175;104m${s}\x1b[39m`
export const purple = (s: string) => `\x1b[38;2;106;90;205m${s}\x1b[39m`
export const bold = (s: string) => `\x1b[1m${s}\x1b[22m`
export const italic = (s: string) => `\x1b[3m${s}\x1b[23m`
export const red = (s: string) => `\x1b[31m${s}\x1b[39m`

// Markdown theme
export const mdTheme: MarkdownTheme = {
  heading: (t) => bold(blue(t)),
  link: (t) => blue(t),
  linkUrl: (t) => dim(t),
  code: (t) => yellow(t),
  codeBlock: (t) => t,
  codeBlockBorder: (t) => dim(t),
  quote: (t) => dim(t),
  quoteBorder: (t) => dim(t),
  hr: (t) => dim(t),
  listBullet: (t) => blue(t),
  bold: (t) => bold(t),
  italic: (t) => italic(t),
  strikethrough: (t) => `\x1b[9m${t}\x1b[29m`,
  underline: (t) => `\x1b[4m${t}\x1b[24m`,
}
