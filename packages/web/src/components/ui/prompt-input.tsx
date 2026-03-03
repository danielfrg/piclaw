import { Input } from "@danielfrg/solid-ui/input"
import { cn } from "@danielfrg/solid-ui/utils"
import { Send, Square } from "lucide-solid"
import { createSignal, Show, splitProps } from "solid-js"
import type { ComponentProps, JSXElement } from "solid-js"

import { Button } from "@/components/ui/button"

type PromptInputProps = ComponentProps<typeof Input> & {
  variant?: "session" | "full"
  status?: "idle" | "sending"
  onSubmit?: (value: string) => void
  onAbort?: () => void
  placeholder?: string
  compact?: boolean
  toolbar?: JSXElement
}

export function PromptInput(props: PromptInputProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "status",
    "onSubmit",
    "onAbort",
    "placeholder",
    "compact",
    "variant",
    "toolbar",
  ])
  let textareaRef: HTMLTextAreaElement | undefined
  const [_, setIsFocused] = createSignal(false)

  const sending = () => local.status === "sending"

  const handleSubmit = (event: Event) => {
    event.preventDefault()
    if (sending()) {
      local.onAbort?.()
      return
    }
    const value = textareaRef?.value?.trim() ?? ""
    if (!value) return
    local.onSubmit?.(value)
    if (textareaRef) {
      textareaRef.value = ""
      textareaRef.style.height = "auto"
    }
  }

  return (
    <div
      class={cn(
        "pointer-events-none overflow-hidden p-2 pb-0 backdrop-blur-lg",
        local.compact ? "rounded-t-[20px]" : "rounded-[20px]",
        local.class,
      )}
    >
      <form
        class={cn(
          "pointer-events-auto relative flex w-full min-w-0 flex-col items-stretch gap-2",
          "border border-white/10 bg-gray-900/95 px-3 pt-3 pb-3",
          "text-gray-100 outline-8 outline-gray-800/50 outline-solid",
          local.compact ? "rounded-t-xl border-b-0" : "rounded-xl",
        )}
        style={{
          "box-shadow":
            "rgba(0,0,0,0.1) 0px 80px 50px 0px, rgba(0,0,0,0.07) 0px 50px 30px 0px, rgba(0,0,0,0.06) 0px 30px 15px 0px, rgba(0,0,0,0.04) 0px 15px 8px, rgba(0,0,0,0.04) 0px 6px 4px, rgba(0,0,0,0.02) 0px 2px 2px",
        }}
        onSubmit={handleSubmit}
      >
        <div class="flex min-w-0 grow flex-row items-start">
          <Input {...rest} class="w-full gap-3">
            <Input.TextArea
              ref={textareaRef}
              autoResize
              submitOnEnter
              placeholder={local.placeholder ?? "How can I help my lord"}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              class={cn(
                "min-h-[48px] max-h-[240px] overflow-y-auto",
                "w-full resize-none border-none ring-0 bg-transparent text-base leading-6 text-gray-100",
                "placeholder:text-gray-500/60",
                "focus:border-none focus:ring-0 focus:outline-none",
                "focus-visible:border-none focus-visible:ring-0 focus-visible:outline-none",
              )}
            />
          </Input>
        </div>
        <div class="flex w-full min-w-0 items-center justify-between">
          <div class="min-w-0 flex-1">{local.toolbar}</div>
          <div class="flex shrink-0 items-center justify-center gap-2">
            <Button type="submit" class="relative size-9 rounded-lg p-2">
              <Show when={sending()} fallback={<Send class="size-5" />}>
                <Square class="size-4" fill="currentColor" />
              </Show>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
