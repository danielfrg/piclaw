import { Button as SolidButton } from "@danielfrg/solid-ui/button"
import { cn } from "@danielfrg/solid-ui/utils"
import { splitProps } from "solid-js"
import type { ComponentProps } from "solid-js"

type ButtonProps = ComponentProps<typeof SolidButton> & {
  variant?: "primary" | "ghost"
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["class", "variant"])
  const className = () =>
    cn(
      "inline-flex items-center justify-center rounded-sm px-4 py-2 text-sm font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900",
      "disabled:cursor-not-allowed disabled:opacity-50",
      local.variant === "ghost"
        ? "border border-gray-800 bg-transparent text-gray-200 hover:border-blue-600 hover:text-gray-100"
        : "bg-blue-600 text-white hover:bg-blue-500",
      local.class,
    )

  return <SolidButton {...rest} class={className()} />
}
