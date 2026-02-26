import { Input } from "@danielfrg/solid-ui/input"
import { cn } from "@danielfrg/solid-ui/utils"
import { Send } from "lucide-solid"
import { createSignal, splitProps } from "solid-js"
import type { ComponentProps } from "solid-js"

import { Button } from "@/components/ui/button"

type PromptInputProps = ComponentProps<typeof Input> & {
  onSubmit?: (value: string) => void
}

export function PromptInput(props: PromptInputProps) {
  const [local, rest] = splitProps(props, ["class", "onSubmit"])
  let textareaRef: HTMLTextAreaElement | undefined
  const [isFocused, setIsFocused] = createSignal(false)

  const handleSubmit = (event: Event) => {
    event.preventDefault()
    const value = textareaRef?.value?.trim() ?? ""
    if (!value) return
    local.onSubmit?.(value)
    if (textareaRef) textareaRef.value = ""
  }

  return (
    <form
      class={cn(
        "w-full rounded-xl border bg-gray-900/60",
        isFocused()
          ? "border-gray-400 ring-[3px] ring-gray-400/30 ring-offset-0 ring-offset-gray-900"
          : "border-gray-800/80",
        "shadow-[0_24px_70px_-50px_rgba(0,0,0,0.85)]",
        "transition-all duration-200",
        local.class,
      )}
      onSubmit={handleSubmit}
    >
      <Input {...rest} class="w-full gap-3">
        <Input.TextArea
          ref={textareaRef}
          placeholder="How can I help my lord"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          class={cn(
            "min-h-[160px] w-full p-4 resize-none border-none ring-0 text-gray-100",
            "placeholder:text-gray-500",
            "focus:border-none focus:ring-0 focus:outline-none",
            "focus-visible:border-none focus-visible:ring-0 focus-visible:outline-none",
          )}
        />
      </Input>
      <div class="m-4 flex items-center">
        <div class="ml-auto flex items-center gap-3">
          <Button type="submit" class="gap-2">
            <Send class="size-4" />
          </Button>
        </div>
      </div>
    </form>
  )
}
