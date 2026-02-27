import type { MessageWithParts, Part } from "@piclaw/sdk"
import { For, Show, Switch, Match } from "solid-js"

type ConversationProps = {
  messages: MessageWithParts[]
  thinking?: boolean
}

export function Conversation(props: ConversationProps) {
  return (
    <div class="space-y-6">
      <Show
        when={props.messages.length > 0}
        fallback={
          <div class="rounded-2xl border border-dashed border-gray-800/80 bg-gray-950/30 p-6 text-sm text-gray-500">
            No messages yet. Send a prompt to start the conversation.
          </div>
        }
      >
        <For each={props.messages}>
          {(message) => (
            <div class="mx-auto w-full max-w-3xl">
              <Show when={message.info.role === "user"} fallback={<AssistantBlock parts={message.parts} />}>
                <UserBlock parts={message.parts} />
              </Show>
            </div>
          )}
        </For>
      </Show>
      <Show when={props.thinking}>
        <div class="mx-auto w-full max-w-3xl">
          <div class="flex items-center gap-2 py-2 text-sm text-gray-500">
            <span class="inline-flex size-2 rounded-full bg-gray-500 animate-pulse" />
            <span>Thinking...</span>
          </div>
        </div>
      </Show>
    </div>
  )
}

function UserBlock(props: { parts: Part[] }) {
  const text = () =>
    props.parts
      .filter((p): p is Part & { type: "text" } => p.type === "text")
      .map((p) => p.text)
      .join("\n")

  return (
    <div class="rounded-2xl bg-gray-800/60 px-5 py-4 text-sm leading-relaxed text-gray-100">
      <div class="whitespace-pre-wrap">{text()}</div>
    </div>
  )
}

function AssistantBlock(props: { parts: Part[] }) {
  return (
    <div class="space-y-3">
      <For each={props.parts}>
        {(part) => (
          <Switch>
            <Match when={part.type === "text"}>
              <TextBlock text={(part as Part & { type: "text" }).text} />
            </Match>
            <Match when={part.type === "thinking"}>
              <ThinkingBlock thinking={(part as Part & { type: "thinking" }).thinking} />
            </Match>
            <Match when={part.type === "tool-call"}>
              <ToolCallBlock part={part as Part & { type: "tool-call" }} />
            </Match>
            <Match when={part.type === "tool-result"}>
              <ToolResultBlock part={part as Part & { type: "tool-result" }} />
            </Match>
          </Switch>
        )}
      </For>
    </div>
  )
}

function TextBlock(props: { text: string }) {
  return <div class="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">{props.text}</div>
}

function ThinkingBlock(props: { thinking: string }) {
  return (
    <div class="border-l-2 border-gray-700 pl-4 py-1">
      <div class="mb-1 text-[11px] uppercase tracking-[0.25em] text-gray-600">thinking</div>
      <div class="text-sm leading-relaxed text-gray-500 whitespace-pre-wrap italic">{props.thinking}</div>
    </div>
  )
}

function ToolCallBlock(props: { part: Part & { type: "tool-call" } }) {
  const argsStr = () => {
    const entries = Object.entries(props.part.args)
    if (entries.length === 0) return ""
    if (entries.length === 1) {
      const [key, val] = entries[0]!
      const str = typeof val === "string" ? val : JSON.stringify(val)
      // Truncate long single-arg values
      if (str.length > 120) return `${key}: ${str.slice(0, 120)}...`
      return `${key}: ${str}`
    }
    return JSON.stringify(props.part.args, null, 2)
  }

  return (
    <div class="rounded-lg border border-gray-800 bg-gray-900/80 text-sm">
      <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-800/60">
        <span class="text-[11px] uppercase tracking-[0.2em] text-blue-400/80">tool</span>
        <span class="font-mono text-xs text-gray-300">{props.part.toolName}</span>
      </div>
      <Show when={argsStr()}>
        <pre class="px-3 py-2 text-xs text-gray-500 overflow-x-auto font-mono whitespace-pre-wrap">{argsStr()}</pre>
      </Show>
    </div>
  )
}

function ToolResultBlock(props: { part: Part & { type: "tool-result" } }) {
  return (
    <div
      class="rounded-lg border text-sm"
      classList={{
        "border-red-900/60 bg-red-950/30": props.part.error === true,
        "border-gray-800 bg-gray-900/50": props.part.error !== true,
      }}
    >
      <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-800/60">
        <span
          class="text-[11px] uppercase tracking-[0.2em]"
          classList={{
            "text-red-400/80": props.part.error === true,
            "text-green-400/80": props.part.error !== true,
          }}
        >
          {props.part.error ? "error" : "result"}
        </span>
        <span class="font-mono text-xs text-gray-400">{props.part.toolName}</span>
      </div>
      <pre class="px-3 py-2 text-xs text-gray-400 overflow-x-auto font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
        {props.part.content}
      </pre>
    </div>
  )
}
