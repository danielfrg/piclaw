import type { Capabilities, ModelInfo, SessionConfig } from "@piclaw/sdk"
import { Popover } from "@danielfrg/solid-ui/popover"
import { ToggleGroup } from "@danielfrg/solid-ui/toggle-group"
import { Blocks, Puzzle, Sparkles, Wrench } from "lucide-solid"
import { For, Show, createSignal } from "solid-js"

type SessionConfigBarProps = {
  config: SessionConfig | undefined
  models: ModelInfo[]
  capabilities: Capabilities | undefined
  onModelChange: (provider: string, modelId: string) => void
  onThinkingChange: (level: SessionConfig["thinkingLevel"]) => void
}

export function SessionConfigBar(props: SessionConfigBarProps) {
  const [filter, setFilter] = createSignal("")

  const currentLabel = () => {
    const m = props.config?.model
    if (!m) return "No model"
    return m.name || `${m.provider}/${m.id}`
  }

  const filtered = () => {
    const q = filter().toLowerCase()
    if (!q) return props.models
    return props.models.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
    )
  }

  const skillCount = () => props.capabilities?.skills.length ?? 0
  const toolCount = () => props.capabilities?.tools.length ?? 0
  const extensionCount = () => props.capabilities?.extensions.length ?? 0
  const totalCount = () => skillCount() + toolCount() + extensionCount()

  return (
    <div class="flex items-center gap-3 text-xs text-gray-500">
      {/* Model selector */}
      <Popover
        placement="top-start"
        gutter={8}
        onOpenChange={(open: boolean) => {
          if (open) setFilter("")
        }}
      >
        <Popover.Trigger class="flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-800 hover:text-gray-300 transition-colors cursor-pointer">
          <span class="font-mono">{currentLabel()}</span>
          <svg class="size-3" viewBox="0 0 12 12" fill="none">
            <path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content class="flex w-72 max-h-80 flex-col rounded-lg border border-gray-800 bg-gray-900 shadow-xl z-50 outline-none">
            <div class="sticky top-0 border-b border-gray-800 px-2 py-1.5">
              <input
                type="text"
                placeholder="Filter models..."
                value={filter()}
                onInput={(e) => setFilter(e.currentTarget.value)}
                class="w-full bg-transparent text-xs text-gray-200 placeholder:text-gray-600 outline-none"
              />
            </div>
            <div class="overflow-y-auto py-1">
              <For each={filtered()}>
                {(model) => {
                  const isActive = () =>
                    props.config?.model?.provider === model.provider && props.config?.model?.id === model.id

                  return (
                    <Popover.CloseButton
                      class="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-gray-800 transition-colors cursor-pointer"
                      classList={{
                        "text-blue-400": isActive(),
                        "text-gray-400": !isActive(),
                      }}
                      onClick={() => props.onModelChange(model.provider, model.id)}
                    >
                      <div>
                        <div class="font-mono text-gray-200">{model.name || model.id}</div>
                        <div class="text-gray-600">{model.provider}</div>
                      </div>
                      <Show when={model.reasoning}>
                        <span class="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">thinking</span>
                      </Show>
                    </Popover.CloseButton>
                  )
                }}
              </For>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover>

      {/* Thinking level selector */}
      <Show when={props.config?.supportsThinking}>
        <span class="text-gray-700">|</span>
        <ToggleGroup
          value={props.config?.thinkingLevel}
          onChange={(value: string | null) => {
            if (value) props.onThinkingChange(value as SessionConfig["thinkingLevel"])
          }}
          class="flex items-center gap-0.5"
        >
          <For each={props.config?.availableThinkingLevels ?? []}>
            {(level) => (
              <ToggleGroup.Item
                value={level}
                class="rounded px-1.5 py-0.5 transition-colors text-xs cursor-pointer data-[pressed]:bg-blue-500/20 data-[pressed]:text-blue-400 text-gray-600 hover:text-gray-400 hover:bg-gray-800"
              >
                {level}
              </ToggleGroup.Item>
            )}
          </For>
        </ToggleGroup>
      </Show>

      {/* Capabilities popover */}
      <Show when={props.capabilities && totalCount() > 0}>
        <span class="text-gray-700">|</span>
        <Popover placement="top-start" gutter={8}>
          <Popover.Trigger class="flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-800 hover:text-gray-300 transition-colors cursor-pointer">
            <Blocks class="size-3" />
            <span>
              {toolCount()} tools
              {skillCount() > 0 ? `, ${skillCount()} skills` : ""}
              {extensionCount() > 0 ? `, ${extensionCount()} ext` : ""}
            </span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content class="flex w-80 max-h-96 flex-col rounded-lg border border-gray-800 bg-gray-900 shadow-xl z-50 outline-none overflow-y-auto">
              {/* Skills section */}
              <Show when={skillCount() > 0}>
                <div class="border-b border-gray-800 px-3 py-2">
                  <div class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">
                    <Sparkles class="size-3" />
                    Skills ({skillCount()})
                  </div>
                  <For each={props.capabilities!.skills}>
                    {(skill) => (
                      <div class="py-1.5">
                        <div class="text-xs text-gray-200">{skill.name}</div>
                        <Show when={skill.description}>
                          <div class="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{skill.description}</div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              {/* Tools section */}
              <Show when={toolCount() > 0}>
                <div class="px-3 py-2">
                  <div class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">
                    <Wrench class="size-3" />
                    Tools ({toolCount()})
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <For each={props.capabilities!.tools}>
                      {(tool) => (
                        <span class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300" title={tool.description}>
                          {tool.name}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Extensions section */}
              <Show when={extensionCount() > 0}>
                <div class="border-t border-gray-800 px-3 py-2">
                  <div class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">
                    <Puzzle class="size-3" />
                    Extensions ({extensionCount()})
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <For each={props.capabilities!.extensions}>
                      {(ext) => (
                        <span class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300" title={ext.path}>
                          {ext.name}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </Popover.Content>
          </Popover.Portal>
        </Popover>
      </Show>
    </div>
  )
}
