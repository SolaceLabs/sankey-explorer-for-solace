import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveTrafficMenu } from "./LiveTrafficMenu";
import type { MetricsPolling } from "./useMetricsPolling";
import { initialMetricsPollingState, type MetricsPollingState } from "../lib/metricsPolling";

function polling(state: Partial<MetricsPollingState> = {}): MetricsPolling {
  return {
    state: { ...initialMetricsPollingState(), ...state },
    start: vi.fn(),
    pause: vi.fn(),
    refreshNow: vi.fn(),
    setIntervalMs: vi.fn(),
    choose: vi.fn(),
  };
}

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /^Live traffic:/ }));
  return screen.getByRole("group", { name: "Live traffic settings" });
};

describe("LiveTrafficMenu", () => {
  it("says on the button what is going on: off, or how often it updates", () => {
    const { rerender } = render(<LiveTrafficMenu polling={polling()} />);
    expect(screen.getByRole("button", { name: "Live traffic: off" })).toBeInTheDocument();

    rerender(<LiveTrafficMenu polling={polling({ status: "running", intervalMs: 15000 })} />);
    expect(screen.getByRole("button", { name: "Live traffic: every 15 s" })).toBeInTheDocument();
  });

  it("offers ONE choice for automatic updates - Off or an interval - with the current one checked", async () => {
    const user = userEvent.setup();
    const p = polling({ status: "running", intervalMs: 15000 });
    render(<LiveTrafficMenu polling={p} />);
    const menu = await open(user);

    const choices = within(menu).getAllByRole("radio");
    expect(choices.map((c) => c.closest("label")?.textContent)).toEqual(["Off", "5 s", "15 s", "30 s"]);
    expect(within(menu).getByRole("radio", { name: "15 s" })).toBeChecked();

    await user.click(within(menu).getByRole("radio", { name: "5 s" }));
    await user.click(within(menu).getByRole("radio", { name: "Off" }));

    expect(p.choose).toHaveBeenNthCalledWith(1, 5000);
    expect(p.choose).toHaveBeenNthCalledWith(2, "off");
  });

  it("checks 'Off' while paused, even with an interval remembered", async () => {
    const user = userEvent.setup();
    render(<LiveTrafficMenu polling={polling({ intervalMs: 30000 })} />);
    const menu = await open(user);
    expect(within(menu).getByRole("radio", { name: "Off" })).toBeChecked();
  });

  it("shows the update timing, refreshes on demand and is disabled while a request runs", async () => {
    const user = userEvent.setup();
    const p = polling({ status: "running", lastSuccessAt: Date.now(), nextPollAt: Date.now() + 9000 });
    const { rerender } = render(<LiveTrafficMenu polling={p} />);
    const menu = await open(user);

    expect(within(menu).getByText(/Last update .* · next in 9 s/)).toBeInTheDocument();
    await user.click(within(menu).getByRole("button", { name: "Update now" }));
    expect(p.refreshNow).toHaveBeenCalledOnce();

    rerender(<LiveTrafficMenu polling={{ ...p, state: { ...p.state, isFetching: true } }} />);
    expect(within(menu).getByRole("button", { name: "Update now" })).toBeDisabled();
  });

  it("explains Flowing, Piling up and Idle in the menu", async () => {
    const user = userEvent.setup();
    render(<LiveTrafficMenu polling={polling()} />);
    const menu = await open(user);

    const legend = within(menu).getByRole("list", { name: "What the labels mean" });
    expect(within(legend).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Flowing: messages are arriving or being delivered right now.",
      "Piling up: messages wait in the queue and are not being drained.",
      "Idle: nothing in, nothing out.",
    ]);
  });

  it("keeps the last update time and a poll problem visible next to the closed button", () => {
    render(
      <LiveTrafficMenu
        polling={polling({
          status: "running",
          lastSuccessAt: new Date(2026, 10, 20, 9, 5, 7).getTime(),
          current: { sampledAt: 1, metrics: [], errors: [] },
          error: "broker unreachable",
        })}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Updated .*05.*07/);
    expect(screen.getByText("Last poll failed: broker unreachable")).toBeInTheDocument();
  });
});
