import path from "path"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import solid from "vite-plugin-solid"

export default defineConfig({
  plugins: [tailwindcss(), solid()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    conditions: ["solid"],
  },
  esbuild: {
    jsx: "preserve",
    jsxImportSource: "solid-js",
  },
  optimizeDeps: {
    esbuildOptions: {
      jsx: "preserve",
      jsxImportSource: "solid-js",
      loader: {
        ".ts": "ts",
        ".tsx": "tsx",
      },
    },
  },
})
