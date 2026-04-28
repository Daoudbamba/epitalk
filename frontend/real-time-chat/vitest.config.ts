import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["__tests__/setup.ts"],
    include: [
      "lib/**/*.test.{ts,tsx}",
      "store/**/*.test.{ts,tsx}",
      "__tests__/**/*.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
