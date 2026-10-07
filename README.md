# Sankey Explorer for Solace

See which topics flow into which queues, topic-endpoints, and direct
subscribers on a Solace broker - live, as a Sankey diagram.

![Sankey Explorer preview](./img/preview.png)

## Quick start

```bash
docker pull ghcr.io/pascalre/sankey-explorer-for-solace:latest
docker run -p 4000:4000 --add-host=host.docker.internal:host-gateway \
  ghcr.io/pascalre/sankey-explorer-for-solace:latest
```

Open **http://localhost:4000**, then connect it to your broker on the
"Connect to Message VPN" screen: the SEMP management host (e.g.
`http://broker-host:8080`), the VPN name, and a read-only user. No config,
no env vars, no login required by default.

Broker credentials are entered in the browser and live only in memory for
that session - never written to disk, never sent anywhere but your broker.

## Features

- **Live, zero setup** - reads straight from the broker's SEMP v2 API,
  nothing to provision or configure beforehand
- **Wildcard-aware** - a `topic/>` subscription is shown covering every
  more specific topic it actually receives, not just its own literal
  string (the "View" toggle switches to literal mode)
- **Multiple brokers/VPNs at once**, combined into one diagram, color-coded
- **Click any node or link** to filter down to just that subscription chain
- **Export** the diagram as SVG, or a broker connection as YAML (saved as
  plaintext locally - handle it like a password file)
- Flags queues/topic-endpoints with zero subscriptions instead of quietly
  dropping them
- `GET /api/sankey-edges` exposes the same data as flat rows, for building
  a Grafana panel (Infinity/JSON datasource + the Sankey panel plugin)

## How it works

```
Browser (React)  →  Express backend  →  Solace broker (SEMP v2, read-only)
```

One instance per customer/workshop, not a shared multi-tenant service. App
login is optional (`APP_USERNAME` + `APP_PASSWORD_HASH` env vars) - leave
both unset to run with no login at all. See `backend/.env.example` for
every available env var (all optional).

## Local development

```bash
cd backend && npm install && npm run dev    # http://localhost:4000
cd frontend && npm install && npm run dev   # http://localhost:5173
```

No broker handy? `scripts/seed-demo-broker.sh` seeds a small demo setup
(queues, subscriptions, a wildcard) on a local broker.

## Troubleshooting

- **Broker running on the same machine (bare metal or its own
  container)?** The Connect screen pre-fills `host.docker.internal` for
  exactly this - `localhost` inside the app's container is the container
  itself, not your host.
- **"Not connected to a broker" right after a successful connect?** Pull
  `latest` - older images had a session-cookie bug.
- Connection errors are logged server-side (never the password) -
  `docker logs <container>` to see why.

## Build it yourself

```bash
docker build -t sankey-explorer .
docker run -p 4000:4000 sankey-explorer
```
