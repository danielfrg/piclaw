import { marked } from "marked"
import markedKatex from "marked-katex-extension"
import markedShiki from "marked-shiki"
import { bundledLanguages, createHighlighter, type BundledLanguage } from "shiki"
import { createContext, useContext, type ParentProps } from "solid-js"

type MarkedContext = {
  parse(markdown: string): Promise<string>
}

const Ctx = createContext<MarkedContext>()

export function useMarked(): MarkedContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useMarked must be used within MarkedProvider")
  return ctx
}

let highlighterPromise: ReturnType<typeof createHighlighter> | undefined

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: [],
    })
  }
  return highlighterPromise
}

const parser = marked.use(
  {
    renderer: {
      link({ href, title, text }) {
        const titleAttr = title ? ` title="${title}"` : ""
        return `<a href="${href}"${titleAttr} class="external-link" target="_blank" rel="noopener noreferrer">${text}</a>`
      },
    },
  },
  markedKatex({
    throwOnError: false,
    nonStandard: true,
  }),
  markedShiki({
    async highlight(code, lang) {
      const highlighter = await getHighlighter()
      let language = lang || "text"
      if (!(language in bundledLanguages)) {
        language = "text"
      }
      if (!highlighter.getLoadedLanguages().includes(language)) {
        await highlighter.loadLanguage(language as BundledLanguage)
      }
      return highlighter.codeToHtml(code, {
        lang: language,
        theme: "github-dark",
        tabindex: false,
      })
    },
  }),
)

export function MarkedProvider(props: ParentProps) {
  const value: MarkedContext = {
    parse: async (markdown: string) => {
      const result = await parser.parse(markdown)
      return result
    },
  }

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>
}
