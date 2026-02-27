import { For, Show } from "solid-js"

export type ConversationMessage = {
  id: string
  role: "user" | "assistant" | "error"
  text: string
}

type ConversationProps = {
  messages: ConversationMessage[]
  thinking?: boolean
}

export function Conversation(props: ConversationProps) {
  return (
    <div class="space-y-4">
      <Show
        when={props.messages.length > 0}
        fallback={
          <div class="rounded-2xl border border-dashed border-gray-800/80 bg-gray-950/30 p-6 text-sm text-gray-500">
            No messages yet. Your next prompt will create a session and start the conversation.
          </div>
        }
      >
        <For each={props.messages}>
          {(message) => (
            <div class="mx-auto w-full max-w-3xl">
              <Show
                when={message.role === "user"}
                fallback={
                  <div
                    class={`text-sm leading-relaxed ${message.role === "assistant" ? "text-gray-200" : "text-rose-200"}`}
                  >
                    <div class="mb-2 text-xs uppercase tracking-[0.25em] text-gray-500">{message.role}</div>
                    <div class="whitespace-pre-wrap">{message.text}</div>
                  </div>
                }
              >
                <div class="rounded-2xl bg-gray-800/60 px-5 py-4 text-sm leading-relaxed text-gray-100">
                  <div class="mb-2 text-xs uppercase tracking-[0.25em] text-gray-500">{message.role}</div>
                  <div class="whitespace-pre-wrap">{message.text}</div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </Show>
      <Show when={props.thinking}>
        <div class="rounded-2xl border border-amber-900/60 bg-amber-950/40 px-5 py-4 text-sm text-amber-100">
          <div class="mb-2 text-xs uppercase tracking-[0.25em] text-amber-300">assistant</div>
          <div class="flex items-center gap-2">
            <span class="inline-flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Thinking...</span>
          </div>
        </div>
      </Show>
    </div>
  )
}
