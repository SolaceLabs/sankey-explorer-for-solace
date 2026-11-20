import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SankeyChart } from "./SankeyChart";
import { ConsumerFlowsSection, type FetchConsumers } from "./ConsumerFlowsSection";
import { buildLiveMetricsView } from "../lib/liveMetricsView";
import { clientMetrics, endpointInfo, queueMetrics } from "../lib/metricsFixtures";
import { ApiRequestError } from "../api/client";
import type { SankeyEdge } from "../../shared/toSankeyEdges";

const MB = 1024 * 1024;
const edges: SankeyEdge[] = [
  { source: "orders", target: "Queue: orders-q", value: 1 },
  { source: "orders", target: "Direct Subscriber: app-1", value: 1 },
];
const endpoints = [endpointInfo(), endpointInfo({ type: "direct-subscriber", name: "app-1", subscriptions: ["orders"] })];

const liveView = () =>
  buildLiveMetricsView(
    endpoints,
    {
      sampledAt: 1,
      errors: [],
      metrics: [
        queueMetrics({
          inbound: { current: 12, oneMinuteAverage: 10 },
          outbound: { current: 0, oneMinuteAverage: 0 },
          spool: { usageBytes: 3 * MB, quotaBytes: 10 * MB, unackedMsgCount: 4 },
        }),
        clientMetrics(),
      ],
    },
    null,
  );

describe("SankeyChart - live metrics overlay", () => {
  it("adds a metrics line, a status dot and link styling per endpoint", () => {
    const { container } = render(<SankeyChart edges={edges} liveMetrics={liveView()} />);

    expect(screen.getByText("in 12/s · out 0/s · 3.0 MB 30%")).toBeInTheDocument();
    expect(screen.getByText("in 0/s")).toBeInTheDocument();
    // Spool holds messages and nothing goes out: a backlog, not just "active".
    expect(container.querySelector(".sankey-activity--backlog")).not.toBeNull();
    expect(container.querySelector(".sankey-activity--idle")).not.toBeNull();
    expect(container.querySelectorAll(".sankey-link--active")).toHaveLength(1);
    expect(container.querySelectorAll(".sankey-link--idle")).toHaveLength(1);
  });

  it("lets the selected flow outshine active links that are not part of it", async () => {
    const user = userEvent.setup();
    const { container } = render(<SankeyChart edges={edges} liveMetrics={liveView()} />);
    const activeLink = () => container.querySelector(".sankey-link--active")!;
    expect(activeLink()).toHaveAttribute("stroke-opacity", "0.5");

    await user.click(screen.getByText("app-1"));

    expect(activeLink()).toHaveAttribute("stroke-opacity", "0.2");
  });

  it("puts the status into the node tooltip, so it is not carried by color alone", () => {
    render(<SankeyChart edges={edges} liveMetrics={liveView()} />);
    expect(screen.getByText(/Live: Backlog/, { selector: "title" })).toBeInTheDocument();
  });

  it("draws nothing extra before the first sample", () => {
    const { container } = render(<SankeyChart edges={edges} liveMetrics={null} />);
    expect(container.querySelector(".sankey-activity")).toBeNull();
    expect(container.querySelector(".sankey-link--active, .sankey-link--idle")).toBeNull();
  });

  it("shows the endpoint's live metrics in the detail panel", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={edges} liveMetrics={liveView()} />);

    await user.click(screen.getByText("orders-q"));

    const panel = screen.getByRole("complementary", { name: "Selection details" });
    const section = within(panel).getByRole("region", { name: "Live metrics" });
    expect(within(section).getByText("Backlog")).toBeInTheDocument();
    expect(within(section).getByText("12 msg/s (1 min avg 10)")).toBeInTheDocument();
    expect(within(section).getByText("10.0 MB (30% used)")).toBeInTheDocument();
  });

  it("asks the user to start polling when the overlay has no sample yet", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={edges} liveMetrics={null} />);

    await user.click(screen.getByText("orders-q"));

    expect(screen.getByText(/Start live metrics in the toolbar/)).toBeInTheDocument();
  });
});

describe("ConsumerFlowsSection", () => {
  const lookup = { brokerLabel: "default", type: "queue" as const, name: "orders-q" };

  it("loads the consumer flows only when asked", async () => {
    const fetchConsumers = vi.fn<FetchConsumers>().mockResolvedValue({
      flows: [{ clientName: "consumer-1", flowId: 1, activityState: "active-consumer", bindTime: null, unackedMsgCount: 2 }],
    });
    const user = userEvent.setup();
    render(<ConsumerFlowsSection lookup={lookup} fetchConsumers={fetchConsumers} />);

    expect(fetchConsumers).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Load consumers" }));

    expect(await screen.findByText("consumer-1")).toBeInTheDocument();
    expect(screen.getByText("active-consumer, 2 unacked")).toBeInTheDocument();
    expect(screen.getByText("1 flow")).toBeInTheDocument();
    expect(fetchConsumers.mock.calls[0]![0]).toEqual(lookup);
  });

  it("says so when no consumer is bound, and shows the server's error on failure", async () => {
    const fetchConsumers = vi
      .fn<FetchConsumers>()
      .mockResolvedValueOnce({ flows: [] })
      .mockRejectedValueOnce(new ApiRequestError("HTTP 400"));
    const user = userEvent.setup();
    render(<ConsumerFlowsSection lookup={lookup} fetchConsumers={fetchConsumers} />);

    await user.click(screen.getByRole("button", { name: "Load consumers" }));
    expect(await screen.findByText("No consumer is bound.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(await screen.findByText("HTTP 400")).toBeInTheDocument();
  });

  it("aborts a pending request when it unmounts", async () => {
    let signal: AbortSignal | undefined;
    const fetchConsumers = vi.fn<FetchConsumers>((_lookup, s) => {
      signal = s;
      return new Promise(() => {});
    });
    const user = userEvent.setup();
    const { unmount } = render(<ConsumerFlowsSection lookup={lookup} fetchConsumers={fetchConsumers} />);

    await user.click(screen.getByRole("button", { name: "Load consumers" }));
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
