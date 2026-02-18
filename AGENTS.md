# piclaw

Sources for the different libraries used in the project.

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
