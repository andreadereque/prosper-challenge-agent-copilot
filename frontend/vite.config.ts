import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    // The API lives on Pipecat's runner (bot.py). Proxying keeps the frontend
    // on relative URLs, so there is no CORS setup.
    proxy: { "/api": "http://localhost:7860" },
    // Test runs write coverage reports; they should not reload the editor.
    watch: { ignored: ["**/coverage/**"] },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // main.tsx only mounts <App /> into the page; types.ts has no runtime code.
      exclude: ["src/main.tsx", "src/types.ts", "src/test/**", "src/**/*.test.{ts,tsx}"],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
