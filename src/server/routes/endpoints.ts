import { Router } from "express";
import { requireAuth, requireBrokerConnection } from "../auth/middleware.js";
import { listBrokerConnections } from "../semp/connectionStore.js";
import { fetchEndpointsAcrossConnections } from "../semp/queries.js";
import { logError } from "../logger.js";

export const endpointsRouter = Router();

endpointsRouter.get(
  "/endpoints",
  requireAuth,
  requireBrokerConnection,
  async (req, res) => {
    // requireBrokerConnection has already verified at least one exists.
    const connections = listBrokerConnections(req.sessionID);

    try {
      const result = await fetchEndpointsAcrossConnections(connections);
      // Partial results are a valid answer (see EndpointsResponse); only when
      // EVERY broker failed is there nothing to show, so that is the 502.
      if (result.errors.length === connections.length) {
        res.status(502).json({ error: result.errors[0]!.message });
        return;
      }
      res.json(result);
    } catch (err) {
      logError("GET /api/endpoints failed unexpectedly", err);
      res.status(502).json({ error: "Unexpected error" });
    }
  },
);
