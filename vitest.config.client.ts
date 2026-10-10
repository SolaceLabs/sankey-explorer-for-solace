import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// React/DOM tests - jsdom environment. Shared/server tests run separately
// under plain Node - see vitest.config.server.ts.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/client/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**"],
    environment: "jsdom",
    setupFiles: ["./src/client/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/client/**/*.{ts,tsx}"],
      exclude: [
        "src/client/main.tsx", // thin entrypoint, no logic
        "src/client/vite-env.d.ts",
        "src/client/test-setup.ts",
        "src/client/types.ts", // type-only declarations, no executable code
      ],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
});
