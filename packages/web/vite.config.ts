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
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    origin: "http://localhost:3000",
    hmr: {
      host: "localhost",
      port: 5173,
      protocol: "ws",
    },
  },
})
