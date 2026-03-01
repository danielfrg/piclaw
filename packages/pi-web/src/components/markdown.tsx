import DOMPurify from "dompurify"
import morphdom from "morphdom"
import { createEffect, createResource, createSignal, onCleanup, splitProps } from "solid-js"
import type { ComponentProps } from "solid-js"

import { useMarked } from "@/context/marked"

// ---------------------------------------------------------------------------
// HTML cache (keyed by raw markdown text)
// ---------------------------------------------------------------------------

type CacheEntry = { hash: string; html: string }
const MAX_CACHE = 200
const cache = new Map<string, CacheEntry>()

function touch(key: string, entry: CacheEntry) {
  cache.delete(key)
  cache.set(key, entry)
  if (cache.size > MAX_CACHE) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
}

function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

// ---------------------------------------------------------------------------
// DOMPurify config
// ---------------------------------------------------------------------------

const purifyConfig = {
  USE_PROFILES: { html: true, mathMl: true },
  SANITIZE_NAMED_PROPS: true,
  FORBID_TAGS: ["style"],
  FORBID_CONTENTS: ["style", "script"],
}

if (DOMPurify.isSupported) {
  DOMPurify.addHook("afterSanitizeAttributes", (node: Element) => {
    if (!(node instanceof HTMLAnchorElement)) return
    if (node.target !== "_blank") return
    const rel = node.getAttribute("rel") ?? ""
    const parts = new Set(rel.split(/\s+/).filter(Boolean))
    parts.add("noopener")
    parts.add("noreferrer")
    node.setAttribute("rel", Array.from(parts).join(" "))
  })
}

function sanitize(html: string): string {
  if (!DOMPurify.isSupported) return ""
  return DOMPurify.sanitize(html, purifyConfig)
}

// ---------------------------------------------------------------------------
// Code block copy buttons
// ---------------------------------------------------------------------------

function createCopyButton(): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className =
    "md-copy-btn absolute top-2 right-2 rounded px-2 py-1 text-[11px] bg-gray-700/80 text-gray-300 opacity-0 group-hover/code:opacity-100 transition-opacity cursor-pointer hover:bg-gray-600"
  btn.textContent = "Copy"
  btn.setAttribute("aria-label", "Copy code")
  return btn
}

function ensureCodeWrappers(root: HTMLDivElement) {
  const blocks = root.querySelectorAll("pre")
  for (const block of blocks) {
    const parent = block.parentElement
    if (!parent) continue
    if (parent.getAttribute("data-code-wrapper") === "true") continue

    const wrapper = document.createElement("div")
    wrapper.setAttribute("data-code-wrapper", "true")
    wrapper.className = "group/code relative"
    parent.replaceChild(wrapper, block)
    wrapper.appendChild(block)
    wrapper.appendChild(createCopyButton())
  }
}

function setupCopyHandlers(root: HTMLDivElement) {
  const timeouts = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>()

  const handleClick = async (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const btn = target.closest(".md-copy-btn")
    if (!(btn instanceof HTMLButtonElement)) return

    const wrapper = btn.closest("[data-code-wrapper]")
    const code = wrapper?.querySelector("code")
    const content = code?.textContent ?? ""
    if (!content) return

    await navigator.clipboard?.writeText(content)
    btn.textContent = "Copied"
    const existing = timeouts.get(btn)
    if (existing) clearTimeout(existing)
    timeouts.set(
      btn,
      setTimeout(() => {
        btn.textContent = "Copy"
      }, 2000),
    )
  }

  root.addEventListener("click", handleClick)

  return () => {
    root.removeEventListener("click", handleClick)
    for (const t of timeouts.values()) clearTimeout(t)
  }
}

function decorate(root: HTMLDivElement) {
  ensureCodeWrappers(root)
}

// ---------------------------------------------------------------------------
// Markdown component
// ---------------------------------------------------------------------------

export function Markdown(
  props: ComponentProps<"div"> & {
    text: string
    class?: string
  },
) {
  const [local, others] = splitProps(props, ["text", "class"])
  const marked = useMarked()
  const [root, setRoot] = createSignal<HTMLDivElement>()

  const [html] = createResource(
    () => local.text,
    async (markdown) => {
      const hash = simpleHash(markdown)
      const cached = cache.get(hash)
      if (cached && cached.hash === hash) {
        touch(hash, cached)
        return cached.html
      }

      const raw = await marked.parse(markdown)
      const safe = sanitize(raw)
      touch(hash, { hash, html: safe })
      return safe
    },
    { initialValue: "" },
  )

  let copyCleanup: (() => void) | undefined
  let decorateTimer: ReturnType<typeof setTimeout> | undefined

  createEffect(() => {
    const container = root()
    const content = html()
    if (!container) return

    if (!content) {
      container.innerHTML = ""
      return
    }

    const temp = document.createElement("div")
    temp.innerHTML = content
    decorate(temp)

    morphdom(container, temp, {
      childrenOnly: true,
      onBeforeElUpdated: (fromEl: Element, toEl: Element) => {
        if (fromEl.isEqualNode(toEl)) return false
        return true
      },
    })

    if (decorateTimer) clearTimeout(decorateTimer)
    decorateTimer = setTimeout(() => {
      if (copyCleanup) copyCleanup()
      decorate(container)
      copyCleanup = setupCopyHandlers(container)
    }, 50)
  })

  onCleanup(() => {
    if (decorateTimer) clearTimeout(decorateTimer)
    if (copyCleanup) copyCleanup()
  })

  return <div data-component="markdown" class={`markdown ${local.class ?? ""}`} ref={setRoot} {...others} />
}
