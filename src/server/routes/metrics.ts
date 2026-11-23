import { Router } from "express";
import { requireAuth, requireBrokerConnection } from "../auth/middleware.js";
import { listBrokerConnections } from "../semp/connectionStore.js";
import { fetchConsumerFlows, fetchMetricsAcrossConnections } from "../semp/metrics.js";
import { SempError } from "../semp/client.js";
import { logError } from "../logger.js";
import { parseConsumersQuery } from "./consumersQuery.js";

export const metricsRouter = Router();

/** One live telemetry sample for every endpoint of every connected broker. */
metricsRouter.get("/metrics", requireAuth, requireBrokerConnection, async (req, res) => {
  const connections = listBrokerConnections(req.sessionID);
  try {
    const result = await fetchMetricsAcrossConnections(connections);
    // Same contract as /api/endpoints: partial results are a 200, only a
    // total failure is a 502.
    if (result.errors.length === connections.length) {
      res.status(502).json({ error: result.errors[0]!.message });
      return;
    }
    res.json(result);
  } catch (err) {
    logError("GET /api/metrics failed unexpectedly", err);
    res.status(502).json({ error: "Unexpected error" });
  }
});

/**
 * Consumer flows bound to ONE queue or topic endpoint - on demand, for the
 * selected endpoint only (one SEMP request per endpoint would be too
 * expensive to repeat for every endpoint on every poll).
 */
metricsRouter.get("/metrics/consumers", requireAuth, requireBrokerConnection, async (req, res) => {
  const parsed = parseConsumersQuery(req.query);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { brokerLabel, type, name } = parsed.value;
  const connection = listBrokerConnections(req.sessionID).find((c) => c.label === brokerLabel);
  if (!connection) {
    res.status(404).json({ error: `No connected Message VPN named "${brokerLabel}"` });
    return;
  }
  try {
    const flows = await fetchConsumerFlows(connection.client, connection.vpn, type, name);
    res.json({ flows });
  } catch (err) {
    logError(`GET /api/metrics/consumers failed (broker=${brokerLabel})`, err);
    res.status(502).json({ error: err instanceof SempError ? err.message : "Unexpected error" });
  }
});
