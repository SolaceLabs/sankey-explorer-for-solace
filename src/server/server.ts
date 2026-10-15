import express from "express";
import session from "express-session";
import helmet from "helmet";
import { readFile } from "node:fs/promises";
import type { Server as HttpServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { connectionRouter } from "./routes/connection.js";
import { endpointsRouter } from "./routes/endpoints.js";
import { logError } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In production: dist/server/server.js (this file) next to dist/client/ (the
// Vite build output). In dev (run via tsx, uncompiled): src/server/server.ts
// next to src/client/ (Vite's own project root - see vite.config.ts). Same
// relative depth either way, so one path works for both - see createServer's
// dev-mode branch below, which reads src/client/index.html directly instead
// of a built dist/client/index.html.
const CLIENT_DIR = path.resolve(__dirname, "../client");

export interface CreateServerOptions {
  /**
   * Whether to also serve the client (static files in production, Vite's
   * own dev middleware - with HMR - otherwise). Defaults to true. Tests
   * that only exercise the /api/* routes pass false, so a fast
   * supertest-wrapped app is returned instead of one that boots a real
   * Vite dev server (or needs a real built dist/client).
   */
  serveClient?: boolean;
  /**
   * The real http.Server this app will be attached to (see index.ts) -
   * needed in dev mode so Vite's HMR websocket can attach to the SAME
   * server/port instead of opening its own. Not needed (and ignored) in
   * production, since there's no HMR there.
   */
  httpServer?: HttpServer;
}

export async function createServer({
  serveClient = true,
  httpServer,
}: CreateServerOptions = {}): Promise<express.Express> {
  const app = express();

  // Usually runs behind a reverse proxy/Cloud Run - needed so secure
  // cookies and rate limiting see the real client IP/protocol. Hop count is
  // configurable (TRUST_PROXY): with a bare `docker run` and no proxy, set 0,
  // otherwise clients could spoof X-Forwarded-For to dodge the rate limits.
  app.set("trust proxy", config.trustProxyHops);

  app.use(
    helmet({
      // Dev mode only: Vite's React Fast Refresh injects an inline
      // bootstrap <script> into index.html (sets up $RefreshReg$/
      // $RefreshSig$) - helmet's default `script-src 'self'` blocks
      // inline scripts, which silently breaks the whole page (components
      // throw on the injected refresh-registration call, so React never
      // mounts - just a blank page with the body's background color).
      // Production serves the pre-built bundle with no inline scripts at
      // all, so it keeps helmet's strict default CSP untouched.
      contentSecurityPolicy: config.isProduction
        ? undefined
        : {
            directives: {
              ...helmet.contentSecurityPolicy.getDefaultDirectives(),
              "script-src": ["'self'", "'unsafe-inline'"],
            },
          },
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(
    session({
      name: "sankey.sid",
      secret: config.app.sessionSecret,
      resave: false,
      // true: creates a session for every visitor (needed so the broker
      // connection can be reliably associated even before any login).
      // Switch to a MemoryStore TTL/Redis if needed (memory growth in
      // workshop mode without login) - see the deferred-work note in
      // connectionStore.ts.
      saveUninitialized: true,
      cookie: {
        httpOnly: true,
        // "auto": Secure is set based on the ACTUAL request (req.secure,
        // which honors "trust proxy" + X-Forwarded-Proto above) - not just
        // NODE_ENV. This app is meant to also just work with a plain
        // `docker run -p 4000:4000 ...` and no reverse proxy/TLS at all
        // (see README "Quickest way to run it") - a hardcoded `secure:
        // true` there would make the browser silently drop the session
        // cookie on every non-HTTPS, non-"localhost" origin, so the broker
        // connection would "work" (POST succeeds) but immediately vanish
        // ("Not connected to a broker" on the very next request). "auto"
        // still sets Secure correctly when a real reverse proxy/Cloud Run
        // terminates TLS in front of this.
        secure: "auto",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000, // 8h - one workshop/work session
      },
    }),
  );

  app.get("/healthz", (_req, res) => res.status(200).send("ok"));

  app.use("/api", authRouter);
  app.use("/api", connectionRouter);
  app.use("/api", endpointsRouter);

  if (serveClient) {
    if (config.isProduction) {
      app.use(express.static(CLIENT_DIR));
      // SPA fallback for client-side routing - everything except /api/* serves index.html
      app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(CLIENT_DIR, "index.html"));
      });
    } else {
      // One process/port for everything in dev too - Vite runs as Express
      // middleware instead of its own separate dev server on :5173. This
      // is Vite's own documented "server middleware mode" pattern for
      // backend integration. Dynamic import (not a static one): "vite" is
      // a devDependency only, never installed in the production image (see
      // Dockerfile's `npm ci --omit=dev`) - this branch never runs there
      // anyway (config.isProduction is true), so it must never be eagerly
      // resolved at module load time.
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: httpServer ? { server: httpServer } : true },
        appType: "custom",
      });
      app.use(vite.middlewares);
      // SPA fallback, Vite-dev-mode version: anything vite.middlewares
      // didn't already serve (an actual asset, the HMR client script,
      // etc.) falls through to here - serve src/client/index.html,
      // transformed by Vite (injects its HMR client, resolves /main.tsx).
      app.use((req, res, next) => {
        if (req.path.startsWith("/api")) {
          next();
          return;
        }
        readFile(path.join(CLIENT_DIR, "index.html"), "utf-8")
          .then((html) => vite.transformIndexHtml(req.originalUrl, html))
          .then((html) => {
            res.status(200).set({ "Content-Type": "text/html" }).end(html);
          })
          .catch(next);
      });
    }
  }

  // Central error handler: never leak stack traces/internals to the client.
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction,
    ) => {
      logError("Unhandled error", err);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}
