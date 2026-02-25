import { $ } from "bun"
import path from "path"
import { createClient } from "@hey-api/openapi-ts"

// Generate OpenAPI spec from the server
console.log("Generating OpenAPI spec...")
await $`bun run generate > ../sdk/openapi.json`.cwd("../pi-server")

// Generate SDK from OpenAPI spec
console.log("Generating SDK...")
await createClient({
  input: "./openapi.json",
  output: {
    path: "./src/gen",
    tsConfigPath: path.join("tsconfig.json"),
    clean: true,
  },
  plugins: [
    {
      name: "@hey-api/typescript",
      exportFromIndex: false,
    },
    {
      name: "@hey-api/sdk",
      instance: "PiClient",
      exportFromIndex: false,
      auth: false,
      paramsStructure: "flat",
    },
    {
      name: "@hey-api/client-fetch",
      exportFromIndex: false,
      baseUrl: "http://localhost:3000/api",
    },
  ],
})

// Format and compile
console.log("Formatting...")
await $`prettier --write src/gen`

console.log("SDK generated successfully!")
