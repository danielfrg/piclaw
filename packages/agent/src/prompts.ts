export type SystemPromptOptions = {
  appName?: string
  tone?: "neutral" | "concise"
}

export function buildSystemPrompt(options: SystemPromptOptions = {}) {
  const appName = options.appName ?? "PiClaw"
  const tone = options.tone ?? "concise"

  return [
    `${appName} assistant objective: help the user complete tasks accurately and safely.`,
    "Be direct and practical. Ask clarifying questions only when required to proceed.",
    tone === "concise" ? "Keep replies short and focused." : "Use a clear, neutral tone.",
  ].join("\n")
}
