import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetricsControls } from "./MetricsControls";
import type { MetricsPolling } from "./useMetricsPolling";
import { initialMetricsPollingState, type MetricsPollingState } from "../lib/metricsPolling";

function polling(state: Partial<MetricsPollingState> = {}): MetricsPolling {
  return {
    state: { ...initialMetricsPollingState(), ...state },
    start: vi.fn(),
    pause: vi.fn(),
    refreshNow: vi.fn(),
    setIntervalMs: vi.fn(),
  };
}

describe("MetricsControls", () => {
  it("offers start while paused and pause while running", async () => {
    const user = userEvent.setup();
    const paused = polling();
    const { rerender } = render(<MetricsControls polling={paused} />);

    expect(screen.getByRole("status")).toHaveTextContent("Paused");
    await user.click(screen.getByRole("button", { name: "Start live metrics" }));
    expect(paused.start).toHaveBeenCalledOnce();

    const running = polling({ status: "running" });
    rerender(<MetricsControls polling={running} />);
    await user.click(screen.getByRole("button", { name: "Pause live metrics" }));
    expect(running.pause).toHaveBeenCalledOnce();
  });

  it("changes the interval and refreshes on demand", async () => {
    const user = userEvent.setup();
    const p = polling();
    render(<MetricsControls polling={p} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Live metrics interval" }), "15 s");
    await user.click(screen.getByRole("button", { name: "Refresh metrics now" }));

    expect(p.setIntervalMs).toHaveBeenCalledWith(15000);
    expect(p.refreshNow).toHaveBeenCalledOnce();
  });

  it("disables 'Refresh now' while a request is running", () => {
    render(<MetricsControls polling={polling({ isFetching: true })} />);
    expect(screen.getByRole("button", { name: "Refresh metrics now" })).toBeDisabled();
  });

  it("shows when the last good sample arrived and keeps showing it next to a poll error", () => {
    render(
      <MetricsControls
        polling={polling({
          status: "running",
          lastSuccessAt: new Date(2026, 10, 20, 9, 5, 7).getTime(),
          current: { sampledAt: 1, metrics: [], errors: [{ brokerLabel: "EU", message: "HTTP 503" }] },
          error: "broker unreachable",
        })}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Live · updated .*05.*07/);
    expect(screen.getByText(/Last poll failed: broker unreachable\. No metrics from EU \(HTTP 503\)/)).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
  });
});
