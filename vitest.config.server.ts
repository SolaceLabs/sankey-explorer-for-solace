import { defineConfig } from "vitest/config";

// Server + shared tests run under plain Node (no DOM needed) - see
// vitest.config.client.ts for the jsdom-environment React test run.
export default defineConfig({
  test: {
    include: ["src/server/**/*.test.ts", "src/shared/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    setupFiles: ["./src/server/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts", "src/shared/**/*.ts"],
      exclude: [
        "src/server/__tests__/**",
        "src/server/index.ts", // thin entrypoint, exercised via E2E smoke tests not unit tests
        "src/shared/types.ts", // type-only declarations, no executable code
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
