import type { MessageWithParts, SessionInfo } from "@/schema"
import { Id } from "@/util/id"
import { log } from "@/util/log"

import type { SessionRecord } from "./store"

const MODEL = { providerID: "anthropic", modelID: "claude-sonnet-4-5" }
const AGENT = "pi"
const CWD = "/home/user/project"

function textPart(sessionID: string, messageID: string, text: string) {
  return {
    id: Id.create("part"),
    sessionID,
    messageID,
    type: "text" as const,
    text,
  }
}

function thinkingPart(sessionID: string, messageID: string, thinking: string) {
  return {
    id: Id.create("part"),
    sessionID,
    messageID,
    type: "thinking" as const,
    thinking,
  }
}

function toolCallPart(
  sessionID: string,
  messageID: string,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
) {
  return {
    id: Id.create("part"),
    sessionID,
    messageID,
    type: "tool-call" as const,
    toolCallId,
    toolName,
    args,
  }
}

function toolResultPart(
  sessionID: string,
  messageID: string,
  toolCallId: string,
  toolName: string,
  content: string,
  error?: boolean,
) {
  return {
    id: Id.create("part"),
    sessionID,
    messageID,
    type: "tool-result" as const,
    toolCallId,
    toolName,
    content,
    error,
  }
}

function userMsg(sessionID: string, text: string): MessageWithParts {
  const messageID = Id.create("message")
  return {
    info: {
      id: messageID,
      sessionID,
      role: "user",
      time: { created: Date.now() },
      agent: AGENT,
      model: MODEL,
    },
    parts: [textPart(sessionID, messageID, text)],
  }
}

function assistantMsg(sessionID: string, parentID: string, parts: MessageWithParts["parts"]): MessageWithParts {
  const messageID = Id.create("message")
  return {
    info: {
      id: messageID,
      sessionID,
      role: "assistant",
      time: { created: Date.now(), completed: Date.now() },
      parentID,
      modelID: MODEL.modelID,
      providerID: MODEL.providerID,
      mode: "server",
      agent: AGENT,
      path: { cwd: CWD, root: CWD },
      cost: 0.0042,
      tokens: {
        total: 1250,
        input: 800,
        output: 350,
        reasoning: 100,
        cache: { read: 200, write: 50 },
      },
    },
    parts,
  }
}

/**
 * Build a fake conversation that exercises every part type the UI needs to render.
 * Returns a SessionRecord without a runtime (runtime is null).
 */
export function seedSession(): SessionRecord {
  const sessionID = Id.create("session")
  const now = Date.now()
  const messages: MessageWithParts[] = []

  // --- Turn 1: simple text exchange ---
  const u1 = userMsg(sessionID, "What files are in this project?")
  messages.push(u1)

  const a1 = assistantMsg(sessionID, u1.info.id, [
    thinkingPart(
      sessionID,
      "",
      "The user wants to see the project files. I should use the bash tool to list the directory contents. Let me check what's in the current working directory first.",
    ),
    textPart(sessionID, "", "Let me check the project structure for you."),
    toolCallPart(sessionID, "", "call_001", "bash", {
      command: "find . -type f -maxdepth 3 | head -30",
    }),
  ])
  // fix messageID refs in parts
  for (const part of a1.parts) part.messageID = a1.info.id
  messages.push(a1)

  // --- Turn 2: tool result + follow-up ---
  const a1tool = assistantMsg(sessionID, a1.info.id, [
    toolResultPart(
      sessionID,
      "",
      "call_001",
      "bash",
      `./README.md
./package.json
./tsconfig.json
./src/index.ts
./src/app.ts
./src/routes/session.ts
./src/schema.ts
./src/session/store.ts
./src/session/runtime.ts
./src/session/persist.ts
./src/util/id.ts
./src/util/log.ts
./test/session.test.ts`,
    ),
  ])
  for (const part of a1tool.parts) part.messageID = a1tool.info.id
  // override role to assistant since tool results come from assistant context
  messages.push(a1tool)

  const a1reply = assistantMsg(sessionID, a1tool.info.id, [
    textPart(
      sessionID,
      "",
      `Here's the project structure:

\`\`\`
.
├── README.md
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Server entry point
│   ├── app.ts            # Hono application setup
│   ├── schema.ts         # Zod schemas for the API
│   ├── routes/
│   │   └── session.ts    # Session CRUD + prompt endpoints
│   ├── session/
│   │   ├── store.ts      # In-memory session store
│   │   ├── runtime.ts    # Agent session factory
│   │   └── persist.ts    # JSONL persistence helper
│   └── util/
│       ├── id.ts         # Prefixed ID generation
│       └── log.ts        # Pino logger setup
└── test/
    └── session.test.ts   # Session creation tests
\`\`\`

The project is a Hono-based API server with session management and an agent runtime backed by pi-coding-agent.`,
    ),
  ])
  for (const part of a1reply.parts) part.messageID = a1reply.info.id
  messages.push(a1reply)

  // --- Turn 3: user asks to read a file, assistant uses tool ---
  const u2 = userMsg(sessionID, "Can you read the README.md and summarize it?")
  messages.push(u2)

  const a2 = assistantMsg(sessionID, u2.info.id, [
    thinkingPart(
      sessionID,
      "",
      "I need to read the README file. I'll use the read tool to get its contents, then provide a summary.",
    ),
    toolCallPart(sessionID, "", "call_002", "read", {
      path: "README.md",
    }),
  ])
  for (const part of a2.parts) part.messageID = a2.info.id
  messages.push(a2)

  const a2tool = assistantMsg(sessionID, a2.info.id, [
    toolResultPart(
      sessionID,
      "",
      "call_002",
      "read",
      `# piclaw

A personal AI agent system inspired by OpenClaw and OpenCode.

## Packages

- \`packages/agent\`: Core agent logic using Pi for model resolution and tool handling.
- \`packages/server\`: Hono API with Drizzle ORM and SQLite for persistence.
- \`packages/tui\`: Terminal UI for direct agent interaction.
- \`packages/web\`: Solid.js SPA frontend.
- \`packages/sdk\`: Auto-generated TypeScript client.

## Getting Started

\`\`\`bash
bun install
bun run dev
\`\`\``,
    ),
  ])
  for (const part of a2tool.parts) part.messageID = a2tool.info.id
  messages.push(a2tool)

  const a2reply = assistantMsg(sessionID, a2tool.info.id, [
    textPart(
      sessionID,
      "",
      `The README describes **piclaw** as a personal AI agent system with five packages:

1. **agent** -- core logic with model resolution and tool handling
2. **server** -- Hono API with persistence
3. **tui** -- terminal interface
4. **web** -- Solid.js frontend
5. **sdk** -- auto-generated TypeScript client

To get started: \`bun install && bun run dev\`.`,
    ),
  ])
  for (const part of a2reply.parts) part.messageID = a2reply.info.id
  messages.push(a2reply)

  // --- Turn 4: tool call that errors ---
  const u3 = userMsg(sessionID, "Try to read a file that doesn't exist")
  messages.push(u3)

  const a3 = assistantMsg(sessionID, u3.info.id, [
    toolCallPart(sessionID, "", "call_003", "read", {
      path: "nonexistent.txt",
    }),
  ])
  for (const part of a3.parts) part.messageID = a3.info.id
  messages.push(a3)

  const a3tool = assistantMsg(sessionID, a3.info.id, [
    toolResultPart(
      sessionID,
      "",
      "call_003",
      "read",
      "Error: ENOENT: no such file or directory, open 'nonexistent.txt'",
      true,
    ),
  ])
  for (const part of a3tool.parts) part.messageID = a3tool.info.id
  messages.push(a3tool)

  const a3reply = assistantMsg(sessionID, a3tool.info.id, [
    textPart(
      sessionID,
      "",
      "The file `nonexistent.txt` doesn't exist in the project. Would you like me to create it, or did you mean a different file?",
    ),
  ])
  for (const part of a3reply.parts) part.messageID = a3reply.info.id
  messages.push(a3reply)

  // --- Turn 5: multi-tool call (parallel tools) ---
  const u4 = userMsg(sessionID, "Show me both the package.json and tsconfig.json")
  messages.push(u4)

  const a4 = assistantMsg(sessionID, u4.info.id, [
    thinkingPart(sessionID, "", "The user wants to see two files. I can read both in parallel using two tool calls."),
    textPart(sessionID, "", "Reading both files for you."),
    toolCallPart(sessionID, "", "call_004a", "read", { path: "package.json" }),
    toolCallPart(sessionID, "", "call_004b", "read", { path: "tsconfig.json" }),
  ])
  for (const part of a4.parts) part.messageID = a4.info.id
  messages.push(a4)

  const a4tools = assistantMsg(sessionID, a4.info.id, [
    toolResultPart(
      sessionID,
      "",
      "call_004a",
      "read",
      `{
  "name": "@piclaw/server",
  "version": "0.1.0",
  "dependencies": {
    "hono": "^4.7.0",
    "pino": "^9.6.0",
    "@mariozechner/pi-coding-agent": "^0.1.0"
  }
}`,
    ),
    toolResultPart(
      sessionID,
      "",
      "call_004b",
      "read",
      `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}`,
    ),
  ])
  for (const part of a4tools.parts) part.messageID = a4tools.info.id
  messages.push(a4tools)

  const a4reply = assistantMsg(sessionID, a4tools.info.id, [
    textPart(
      sessionID,
      "",
      `Here are both files:

**package.json** -- The server depends on Hono, Pino, and pi-coding-agent.

**tsconfig.json** -- Uses ESNext target/module with bundler resolution and strict mode enabled. The \`@/*\` alias maps to \`./src/*\`.`,
    ),
  ])
  for (const part of a4reply.parts) part.messageID = a4reply.info.id
  messages.push(a4reply)

  // --- Turn 6: long assistant response with code ---
  const u5 = userMsg(sessionID, "Write me a simple Express health check endpoint")
  messages.push(u5)

  const a5 = assistantMsg(sessionID, u5.info.id, [
    thinkingPart(
      sessionID,
      "",
      "The user wants an Express health check. This project uses Hono, not Express, but I'll write what they asked for. I should mention the difference.",
    ),
    textPart(
      sessionID,
      "",
      `Here's a simple Express health check endpoint:

\`\`\`typescript
import express from "express"

const app = express()

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.listen(3000, () => {
  console.log("Server running on port 3000")
})
\`\`\`

Note that this project uses **Hono**, not Express. If you want the equivalent Hono route:

\`\`\`typescript
import { Hono } from "hono"

const app = new Hono()

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

export default app
\`\`\`

The Hono version is lighter and runs natively on Bun without an adapter.`,
    ),
  ])
  for (const part of a5.parts) part.messageID = a5.info.id
  messages.push(a5)

  const info: SessionInfo = {
    id: sessionID,
    slug: sessionID,
    projectID: "local",
    directory: CWD,
    title: "Dev seed session",
    version: "0.1.0",
    time: {
      created: now,
      updated: now,
    },
  }

  log.info({ sessionID }, "seed.session.created")

  return {
    info,
    // The seed session has no runtime -- it is read-only for UI development.
    runtime: null as unknown as SessionRecord["runtime"],
    messages,
    status: "idle",
  }
}
