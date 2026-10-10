import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Used two ways: `vite build` for the production bundle (see package.json's
// "build" script), and loaded automatically by src/server/server.ts's
// createViteServer() in dev mode, where Vite runs as Express middleware
// instead of its own dev server - no proxy config needed here, since /api
// requests never reach Vite at all (Express's own routes handle them
// first - see server.ts).
// https://vite.dev/config/
export default defineConfig({
  root: "src/client",
  plugins: [react()],
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
});
