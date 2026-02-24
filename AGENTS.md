# piclaw: Personal AI Agent System

A simple personal AI agent based on pi, inspired by OpenClaw anc OpenCode.

Packages:

- `packages/agent`: Core logic using Pi (pi-agent-core) for model resolution, tool handling, and skills.
- `packages/server`: Hono API uses Drizzle ORM with SQLite for session persistence.
- `packages/tui`: Terminal UI for direct interaction with the agent.
- `packages/web`: Solid.js SPA (proxied via server in dev).
- `packages/sdk`: Generated TypeScript client from the API.
- `tools/mdvector`: Python-based utility for syncing markdown notes to Qdrant.

Sources for the different libraries that this project uses or is based on:

- pi: ../pi-mono
- opencode: ../opencode
- openclaw: ../openclaw

## Coding Conventions

- **Runtime**: Use Bun instead of Node or npm for all tasks.
- **API Access**: NEVER make raw HTTP requests using `fetch` in the web app. ALWAYS use the generated client from `@piclaw/sdk`.
- **Naming**: Prefer single-word naming for variables and functions where possible.
- **Files**: Keep all filenames lowercase with words separated by dashes (kebab-case).
- **Tone**: Keep answers short and concise. No emojis in commits, issues, or code. Technical prose only.

## TypeScript

- **Strictness**: No `any`. Use specific types or Generics.
- **IDs**: Use the prefixed ID system (e.g., `ses_` for sessions). Logic is in `packages/server/src/util/id.ts`.
- **Imports**: NEVER use inline/dynamic imports for types. Use standard top-level imports. Use `@/` aliases where configured.

## Solid.js Best Practices

Follow these strictly for the `packages/web` application:

### 1. JSX Prop Passing

- **Call functions for Signals**: Pass values by calling the signal: `<Message text={content()} />`.
- **DO NOT pass the accessor**: `<Message text={content} />`. Components should receive values, not accessors.

### 2. Never Destructure Props

- Destructuring `const { title } = props` breaks reactivity.
- ALWAYS access props directly: `<h1>{props.title}</h1>`. Use `splitProps` if separation is required.

### 3. Reactive Scopes

- The component body runs **only once**.
- Wrap reactive logic in functions: `const status = () => isProcessing() ? "Busy" : "Idle"`.
- Read signals inside JSX, `createMemo`, or `createEffect`.

### 4. Control Flow

- Prefer `<Show when={...}>` over JS logical operators (`&&`).
- ALWAYS use `<For each={...}>` instead of `.map()` for lists to preserve DOM identity.

### 5. Derivation & Stores

- **Derive everything**: Use functions or `createMemo` for dependent values.
- **Stores**: Use `createStore` for nested objects or arrays to enable path-based reactivity. Prefer `createStore` over multiple signals for complex state.

## Agent & Tools

- **Agent Creation**: Use `Agent.create()` which handles config loading and model resolution.
- **Model Resolution**: Use `resolveModel` to handle provider/model mapping and overrides from `config.json`.
- **Skills**: Skills are loaded from `XDG_CONFIG/piclaw/skills`. Use `loadSkills` to discover and validate them.
- **Vector Search**: Semantic note search requires Qdrant. Configuration is handled via `PICLAW_QDRANT_URL` and `vectordb` in config.
- **Tool Calling**: ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.

## Data & Persistence

- **Database**: SQLite managed via Drizzle. Schema is co-located with modules (e.g., `packages/server/src/session/sql.ts`).
- **Migrations**: Managed via `drizzle-kit` in `packages/server`.
- **SSE**: The server is configured for Server-Sent Events (idleTimeout: 0) for streaming agent responses.

## Debugging & Quality

- **Processes**: NEVER try to restart the app or the server process.
- **Modifications**: NEVER remove or downgrade code to fix type errors; upgrade the dependency instead.
- **Formatting**: Run `bun run format` (Prettier) before committing. Only fix errors, not warnings.

# piclaw

Project structure:

- packages/agent: agent code
- packages/tui: terminal user interface that uses the agent
- packages/server: server code

Sources for the different libraries that this project uses or is based on:

- pi: ../pi-mono
- opencode: ../opencode
- openclaw: ../openclaw

## Code Quality

No any types unless absolutely necessary.
Check node_modules for external API type definitions instead of guessing
NEVER use inline imports - no await import("./foo.js"), no import("pkg").Type in type positions, no dynamic imports for types. Always use standard top-level imports.
NEVER remove or downgrade code to fix type errors from outdated dependencies; upgrade the dependency instead
Always ask before removing functionality or code that appears to be intentional

## Debugging

NEVER try to restart the app, or the server process, EVER.

## SolidJS

Always prefer createStore over multiple createSignal calls

## Tool Calling

ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.

## Style

Keep answers short and concise
No emojis in commits, issues, PR comments, or code
No fluff or cheerful filler text
Technical prose only, be kind but direct (e.g., "Thanks @user" not "Thanks so much @user!")
