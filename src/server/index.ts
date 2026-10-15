import { createServer as createHttpServer } from "node:http";
import { assertValidConfig, config } from "./config.js";
import { createServer } from "./server.js";
import { startConnectionSweeper } from "./semp/connectionStore.js";
import { logInfo } from "./logger.js";

assertValidConfig(config);

// Created before the Express app so dev-mode Vite middleware (see
// server.ts) can attach its HMR websocket to this SAME server/port -
// one process, one port, in dev and in production alike.
const httpServer = createHttpServer();
const app = await createServer({ httpServer });
httpServer.on("request", app);
startConnectionSweeper();

httpServer.listen(config.port, () => {
  const mode = config.loginRequired ? "login required" : "workshop mode (no login)";
  logInfo(`Listening on :${config.port} (${mode})`);
});
