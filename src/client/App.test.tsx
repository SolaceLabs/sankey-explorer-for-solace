import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { api, ApiRequestError } from "./api/client";
import type { EndpointsResponse, SessionInfo } from "./types";

vi.mock("./api/client", async () => {
  const actual = await vi.importActual<typeof import("./api/client")>("./api/client");
  return {
    ...actual,
    api: {
      ...actual.api,
      getSession: vi.fn(),
      getEndpoints: vi.fn(),
      getMetrics: vi.fn(),
      logout: vi.fn(),
      disconnectAll: vi.fn(),
    },
  };
});

function session(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return { authRequired: false, authenticated: true, brokers: [], ...overrides };
}

const oneEndpoint: EndpointsResponse = { errors: [], endpoints: [
  {
    type: "queue",
    name: "orders-q",
    vpn: "default",
    subscriptions: ["orders/created"],
    brokerLabel: "default",
    brokerHost: "localhost:8080",
  },
] };

const connectedBroker = {
  id: "1",
  label: "default",
  vpn: "default",
  baseUrl: "http://localhost:8080/SEMP",
  connectedAt: 0,
};

describe("App - initial routing based on session", () => {
  it("shows the login screen when auth is required and not yet authenticated", async () => {
    vi.mocked(api.getSession).mockResolvedValue(
      session({ authRequired: true, authenticated: false }),
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("shows the connect screen when no message VPN is connected", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [] }));

    render(<App />);

    expect(await screen.findByText("Connect to Message VPN")).toBeInTheDocument();
  });

  it("loads endpoints and shows the diagram when a broker is already connected", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints).mockResolvedValue(oneEndpoint);

    render(<App />);

    expect(await screen.findByText("orders-q")).toBeInTheDocument();
  });

  it("shows an error screen with a retry button when the session request fails", async () => {
    vi.mocked(api.getSession).mockRejectedValue(new ApiRequestError("network down"));

    render(<App />);

    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("App - partial broker failures", () => {
  it("still draws the reachable brokers and warns about the failed one", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints).mockResolvedValue({
      ...oneEndpoint,
      errors: [{ brokerLabel: "EU-Broker", message: "HTTP 503" }],
    });

    render(<App />);

    expect(await screen.findByText("orders-q")).toBeInTheDocument();
    expect(screen.getByText(/EU-Broker/)).toBeInTheDocument();
    expect(screen.getByText(/HTTP 503/)).toBeInTheDocument();
  });
});

describe("App - topbar actions once connected", () => {
  it("summarizes the connected brokers in one chip and lists each one when opened", async () => {
    vi.mocked(api.getSession).mockResolvedValue(
      session({ brokers: [connectedBroker, { ...connectedBroker, id: "2", label: "second" }] }),
    );
    vi.mocked(api.getEndpoints).mockResolvedValue(oneEndpoint);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText("orders-q");

    const chip = screen.getByRole("button", { name: "Message VPNs: 2 Message VPNs" });
    expect(chip).toHaveAttribute("aria-expanded", "false");
    await user.click(chip);

    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("default")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("closes the Message VPN panel on Escape and returns focus to the chip", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints).mockResolvedValue(oneEndpoint);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText("orders-q");

    const chip = screen.getByRole("button", { name: "Message VPNs: default" });
    await user.click(chip);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Manage Message VPNs" })).not.toBeInTheDocument();
    expect(chip).toHaveFocus();
  });

  it("'Manage Message VPNs' switches back to the connect screen", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints).mockResolvedValue(oneEndpoint);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText("orders-q");

    await user.click(screen.getByRole("button", { name: "Message VPNs: default" }));
    await user.click(screen.getByRole("button", { name: "Manage Message VPNs" }));

    expect(await screen.findByText("Manage Message VPN connections")).toBeInTheDocument();
  });

  it("'Disconnect all Message VPNs' clears brokers and returns to the connect screen", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints).mockResolvedValue(oneEndpoint);
    vi.mocked(api.disconnectAll).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText("orders-q");

    await user.click(screen.getByRole("button", { name: "Message VPNs: default" }));
    await user.click(screen.getByRole("button", { name: "Disconnect all Message VPNs" }));

    expect(await screen.findByText("Connect to Message VPN")).toBeInTheDocument();
    expect(api.disconnectAll).toHaveBeenCalledOnce();
  });

  it("puts the diagram search into the top bar", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints).mockResolvedValue(oneEndpoint);

    render(<App />);
    await screen.findByText("orders-q");

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("combobox", { name: "Find topic or endpoint" })).toBeInTheDocument();
    expect(within(header).getByRole("heading", { name: /^Sankey Explorer/ })).toBeInTheDocument();
    // Export sits in the top bar, to the right of Refresh.
    const refresh = within(header).getByRole("button", { name: "Refresh" });
    const exportButton = within(header).getByRole("button", { name: "Export SVG" });
    expect(refresh.compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("'Refresh' reloads endpoints and shows a banner if it fails", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints)
      .mockResolvedValueOnce(oneEndpoint)
      .mockRejectedValueOnce(new ApiRequestError("broker unreachable"));
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText("orders-q");

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("broker unreachable")).toBeInTheDocument();
    // The previously loaded diagram must still be visible - a failed
    // refresh shouldn't blank out data the user already had.
    expect(screen.getByText("orders-q")).toBeInTheDocument();
  });

  it("shows a 'Logout' button only when login is required, and calls api.logout", async () => {
    vi.mocked(api.getSession)
      .mockResolvedValueOnce(
        session({ authRequired: true, authenticated: true, brokers: [connectedBroker] }),
      )
      .mockResolvedValueOnce(session({ authRequired: true, authenticated: false }));
    vi.mocked(api.getEndpoints).mockResolvedValue(oneEndpoint);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText("orders-q");

    const logoutButton = screen.getByRole("button", { name: "Logout" });
    await user.click(logoutButton);

    expect(api.logout).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument(),
    );
  });
});

describe("App - diagram selection", () => {
  it("keeps the selected node when a refresh fails, since the data did not change", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints)
      .mockResolvedValueOnce(oneEndpoint)
      .mockRejectedValueOnce(new ApiRequestError("broker unreachable"));
    const user = userEvent.setup();

    render(<App />);
    await user.click(await screen.findByText("orders-q"));
    const details = () => screen.queryByRole("complementary", { name: "Selection details" });
    expect(details()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("broker unreachable")).toBeInTheDocument();
    expect(details()).toBeInTheDocument();
  });
});

describe("App - live metrics", () => {
  const metricsSample = {
    sampledAt: 1,
    errors: [],
    metrics: [
      {
        type: "queue" as const,
        name: "orders-q",
        brokerLabel: "default",
        inbound: { current: 12, oneMinuteAverage: 12 },
        outbound: { current: 12, oneMinuteAverage: 12 },
        spool: { usageBytes: 0, quotaBytes: null, unackedMsgCount: 0 },
        ingressEnabled: true,
        egressEnabled: true,
      },
    ],
  };

  it("draws live metrics once started, and pauses and clears them when the configuration is reloaded", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints).mockResolvedValue(oneEndpoint);
    vi.mocked(api.getMetrics).mockResolvedValue(metricsSample);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText("orders-q");
    expect(api.getMetrics).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Live traffic: off" }));
    await user.click(screen.getByRole("radio", { name: "15 s" }));
    expect(await screen.findByText("12/s in · 12/s out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live traffic: every 15 s" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/^Updated/);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(screen.queryByText("12/s in · 12/s out")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Live traffic: off" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});

describe("App - back to the overview", () => {
  it("clicking the logo closes the selection and 'Show only this' but keeps the view settings", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints).mockResolvedValue(oneEndpoint);
    const user = userEvent.setup();

    render(<App />);
    await user.click(await screen.findByText("orders-q"));
    await user.click(screen.getByRole("button", { name: "Show only this" }));
    await user.click(screen.getByRole("button", { name: /^View settings/ }));
    await user.click(screen.getByRole("radio", { name: /Literal subscriptions/ }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByText("orders-q"));
    expect(screen.getByRole("complementary", { name: "Selection details" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to the overview/ }));

    expect(screen.queryByRole("complementary", { name: "Selection details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to overview" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View settings: Literal subscriptions" })).toBeInTheDocument();
    expect(api.getEndpoints).toHaveBeenCalledOnce();
  });

  it("empties the diagram search", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [connectedBroker] }));
    vi.mocked(api.getEndpoints).mockResolvedValue(oneEndpoint);
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText("orders-q");
    await user.type(screen.getByRole("combobox", { name: "Find topic or endpoint" }), "nothing-like-this");

    await user.click(screen.getByRole("button", { name: /back to the overview/ }));

    expect(screen.getByRole("combobox", { name: "Find topic or endpoint" })).toHaveValue("");
  });

  it("is only a button once there is a diagram to go back to", async () => {
    vi.mocked(api.getSession).mockResolvedValue(session({ brokers: [] }));

    render(<App />);
    await screen.findByText("Connect to Message VPN");

    expect(screen.queryByRole("button", { name: /back to the overview/ })).not.toBeInTheDocument();
  });
});
