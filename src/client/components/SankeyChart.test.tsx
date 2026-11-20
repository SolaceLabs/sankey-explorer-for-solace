import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SankeyChart } from "./SankeyChart";
import type { SankeyEdge } from "../../shared/toSankeyEdges";

const basicEdges: SankeyEdge[] = [
  { source: "acme/sales", target: "Queue: orders-q", value: 1 },
];

const wildcardEdges: SankeyEdge[] = [
  { source: "acme/sales/>", target: "Queue: all-sales-q", value: 1 },
  { source: "acme/sales/orders", target: "Topic Endpoint: te-orders", value: 1 },
];

const panel = () => screen.getByRole("complementary", { name: "Selection details" });

describe("SankeyChart - empty state", () => {
  it("shows a helpful message instead of an empty diagram when there are no edges", () => {
    render(<SankeyChart edges={[]} />);
    expect(screen.getByText(/No topic subscriptions found/)).toBeInTheDocument();
  });
});

describe("SankeyChart - labels", () => {
  it("shows the last path segment for topic hierarchy nodes, not the full path", () => {
    render(<SankeyChart edges={basicEdges} />);
    expect(screen.getByText("sales")).toBeInTheDocument();
    expect(screen.queryByText("acme/sales")).not.toBeInTheDocument();
  });

  it("shows the bare endpoint name next to a Q badge named 'Queue'", () => {
    render(<SankeyChart edges={basicEdges} />);
    expect(screen.getByText("orders-q")).toBeInTheDocument();
    expect(screen.queryByText("Queue: orders-q")).not.toBeInTheDocument();
    expect(screen.getByText("Q")).toBeInTheDocument();
    expect(screen.getByText("Queue", { selector: "title" })).toBeInTheDocument();
  });

  it("gives topic endpoints and direct subscribers their own badges", () => {
    render(
      <SankeyChart
        edges={[
          { source: "acme/sales", target: "Topic Endpoint: te-orders", value: 1 },
          { source: "acme/sales", target: "Direct Subscriber: my-app-1", value: 1 },
        ]}
      />,
    );
    expect(screen.getByText("TE")).toBeInTheDocument();
    expect(screen.getByText("Topic Endpoint", { selector: "title" })).toBeInTheDocument();
    expect(screen.getByText("DS")).toBeInTheDocument();
    expect(screen.getByText("Direct Subscriber", { selector: "title" })).toBeInTheDocument();
  });

  it("colors each badge by type: queue green, topic endpoint light blue, direct subscriber outlined", () => {
    const { container } = render(
      <SankeyChart
        edges={[
          { source: "acme/sales", target: "Queue: orders-q", value: 1 },
          { source: "acme/sales", target: "Topic Endpoint: te-orders", value: 1 },
          { source: "acme/sales", target: "Direct Subscriber: my-app-1", value: 1 },
        ]}
      />,
    );
    const look = (code: string) => {
      const badge = Array.from(container.querySelectorAll("g.sankey-badge")).find(
        (g) => g.querySelector("text")?.textContent === code,
      )!;
      const rect = badge.querySelector("rect")!;
      return [rect.getAttribute("fill"), rect.getAttribute("stroke"), badge.querySelector("text")!.getAttribute("fill")];
    };
    expect(look("Q")).toEqual(["#00C895", "none", "#03213B"]);
    expect(look("TE")).toEqual(["#C2F7FF", "none", "#03213B"]);
    expect(look("DS")).toEqual(["none", "#FFFFFF", "#FFFFFF"]);
  });

  it("centers the badge vertically on the whole endpoint entry, not on the name line", () => {
    render(
      <SankeyChart
        edges={basicEdges}
        endpointOwners={new Map([["Queue: orders-q", "app-svc-orders"]])}
        endpointBrokerColors={{ colorByEndpointLabel: new Map(), brokerCount: 2 }}
        endpointVpnHost={new Map([["Queue: orders-q", "default at localhost:8080"]])}
      />,
    );
    const node = screen.getByText("orders-q").closest("g.sankey-node")!;
    const bar = node.querySelector("rect")!;
    const badge = node.querySelector("g.sankey-badge rect")!;
    const center = (el: Element) => Number(el.getAttribute("y")) + Number(el.getAttribute("height")) / 2;
    // Name + two sub-lines: the entry's middle is the bar's middle.
    expect(center(badge)).toBeCloseTo(center(bar), 5);
    expect(Number(screen.getByText("orders-q").getAttribute("y"))).toBeLessThan(center(badge));
  });

  it("shows the owner sub-label when provided", () => {
    render(
      <SankeyChart edges={basicEdges} endpointOwners={new Map([["Queue: orders-q", "app-svc-orders"]])} />,
    );
    expect(screen.getByText("app-svc-orders")).toBeInTheDocument();
  });

  it("does not show a vpn/host sub-label when only one message VPN is in play", () => {
    render(
      <SankeyChart
        edges={basicEdges}
        endpointBrokerColors={{ colorByEndpointLabel: new Map(), brokerCount: 1 }}
        endpointVpnHost={new Map([["Queue: orders-q", "default at localhost:8080"]])}
      />,
    );
    expect(screen.queryByText("default at localhost:8080")).not.toBeInTheDocument();
  });

  it("shows the vpn/host sub-label once multiple message VPNs are connected", () => {
    render(
      <SankeyChart
        edges={basicEdges}
        endpointBrokerColors={{ colorByEndpointLabel: new Map(), brokerCount: 2 }}
        endpointVpnHost={new Map([["Queue: orders-q", "default at localhost:8080"]])}
      />,
    );
    expect(screen.getByText("default at localhost:8080")).toBeInTheDocument();
  });

  it("labels the topic columns and the endpoint column", () => {
    render(<SankeyChart edges={basicEdges} />);
    expect(screen.getByText("Level 1")).toBeInTheDocument();
    expect(screen.getByText("Level 2")).toBeInTheDocument();
    expect(screen.getByText("Endpoints")).toBeInTheDocument();
  });
});

describe("SankeyChart - toolbar", () => {
  it("offers all five sort modes, 'Fewest crossings' first and selected", () => {
    render(<SankeyChart edges={basicEdges} />);
    const select = screen.getByLabelText("Sort") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "Fewest crossings",
      "Topic name",
      "Endpoint",
      "Owner",
      "Message VPN",
    ]);
    expect(select.value).toBe("crossing");
  });

  it("switching sort mode keeps the diagram rendered", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={basicEdges} />);
    await user.selectOptions(screen.getByLabelText("Sort"), "Topic name");
    expect(screen.getByText("orders-q")).toBeInTheDocument();
  });

  it("counts topics, endpoints and endpoints without subscriptions", () => {
    render(<SankeyChart edges={basicEdges} unsubscribedEndpoints={["legacy-q"]} />);
    expect(screen.getByText("2 topics, 1 endpoint")).toBeInTheDocument();
    expect(screen.getByText("1 without subscriptions")).toHaveAttribute("title", "legacy-q");
  });

  it("hides the 'without subscriptions' count when every endpoint has one", () => {
    render(<SankeyChart edges={basicEdges} />);
    expect(screen.queryByText(/without subscriptions/)).not.toBeInTheDocument();
  });
});

describe("SankeyChart - selecting a node", () => {
  it("opens the detail panel without filtering the diagram", async () => {
    const edges: SankeyEdge[] = [
      { source: "acme/sales", target: "Queue: orders-q", value: 1 },
      { source: "acme/support", target: "Queue: tickets-q", value: 1 },
    ];
    const user = userEvent.setup();
    render(<SankeyChart edges={edges} />);

    await user.click(screen.getByText("orders-q"));

    expect(within(panel()).getByText("Selected endpoint")).toBeInTheDocument();
    expect(within(panel()).getByText("acme/sales")).toBeInTheDocument();
    // Selection highlights, it does not filter: the unrelated queue stays.
    expect(screen.getByText("tickets-q")).toBeInTheDocument();
  });

  it("'Show only this' filters to the selected flow, 'Back to overview' restores it", async () => {
    const edges: SankeyEdge[] = [
      { source: "acme/sales", target: "Queue: orders-q", value: 1 },
      { source: "acme/support", target: "Queue: tickets-q", value: 1 },
    ];
    const user = userEvent.setup();
    render(<SankeyChart edges={edges} />);

    await user.click(screen.getByText("orders-q"));
    await user.click(within(panel()).getByRole("button", { name: "Show only this" }));
    expect(screen.queryByText("tickets-q")).not.toBeInTheDocument();
    expect(within(panel()).getByRole("button", { name: "Show all flows" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to overview" }));
    expect(screen.getByText("tickets-q")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to overview" })).not.toBeInTheDocument();
  });

  it("closing the panel clears the selection", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={basicEdges} />);

    await user.click(screen.getByText("orders-q"));
    await user.click(screen.getByRole("button", { name: "Close details" }));

    expect(screen.queryByRole("complementary", { name: "Selection details" })).not.toBeInTheDocument();
  });

  it("says 'receive topics from this branch' for a topic level with more levels below", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);

    await user.click(screen.getByText("sales"));

    expect(within(panel()).getByText(/receive topics from this branch/)).toHaveTextContent(
      "2 endpoints receive topics from this branch",
    );
  });

  it("uses the singular for one endpoint on a branch", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={basicEdges} />);

    await user.click(screen.getByText("acme"));

    expect(within(panel()).getByText(/from this branch/)).toHaveTextContent(
      "1 endpoint receives topics from this branch",
    );
  });

  it("keeps 'Messages published here reach' for a full topic with nothing below", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);

    await user.click(screen.getByText("orders"));

    expect(within(panel()).getByText(/Messages published here reach/)).toHaveTextContent(
      "Messages published here reach 2 endpoints.",
    );
  });

  it("marks an endpoint reached only through a wider wildcard as 'Wildcard'", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);

    await user.click(screen.getByText("orders"));

    const items = within(panel()).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("te-orders")).toBeInTheDocument();
    expect(within(items[0]!).queryByText("Wildcard")).not.toBeInTheDocument();
    expect(within(items[1]!).getByText("all-sales-q")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Wildcard")).toBeInTheDocument();
    expect(within(items[1]!).getByText("acme/sales/>")).toBeInTheDocument();
  });

  it("copies the selected topic to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<SankeyChart edges={wildcardEdges} />);

    await user.click(screen.getByText("orders"));
    await user.click(within(panel()).getByRole("button", { name: "Copy topic" }));

    expect(writeText).toHaveBeenCalledWith("acme/sales/orders");
    expect(within(panel()).getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});

describe("SankeyChart - flow highlighting", () => {
  const strokes = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('path[style*="pointer-events: none"]')).map((p) => [
      p.getAttribute("stroke"),
      p.getAttribute("stroke-opacity"),
    ]);

  it("draws every flow flat, without gradient, while nothing is hovered or selected", () => {
    const { container } = render(<SankeyChart edges={wildcardEdges} />);
    for (const [stroke, opacity] of strokes(container)) {
      expect(stroke).toBe("#C2F7FF");
      expect(opacity).toBe("0.2");
    }
  });

  it("puts the one diagram-wide gradient on the selected flow and leaves the others unchanged", async () => {
    const edges: SankeyEdge[] = [
      { source: "acme/sales", target: "Queue: orders-q", value: 1 },
      { source: "acme/support", target: "Queue: tickets-q", value: 1 },
    ];
    const user = userEvent.setup();
    const { container } = render(<SankeyChart edges={edges} />);

    await user.click(screen.getByText("orders-q"));

    const result = strokes(container);
    expect(result).toContainEqual(["url(#sankey-flow-gradient)", "0.75"]);
    expect(result).toContainEqual(["#C2F7FF", "0.2"]);
    const gradient = container.querySelector("#sankey-flow-gradient");
    expect(gradient).toHaveAttribute("gradientUnits", "userSpaceOnUse");
    expect(Array.from(gradient!.querySelectorAll("stop")).map((s) => s.getAttribute("stop-color"))).toEqual([
      "#009193",
      "#093B5F",
    ]);
  });

  it("dims nodes outside a clicked selection once the pointer has left it", async () => {
    const edges: SankeyEdge[] = [
      { source: "acme/sales", target: "Queue: orders-q", value: 1 },
      { source: "acme/support", target: "Queue: tickets-q", value: 1 },
    ];
    const user = userEvent.setup();
    render(<SankeyChart edges={edges} />);
    const svg = screen.getByRole("img", { name: "Topic to endpoint Sankey diagram" });

    await user.click(within(svg).getByText("orders-q"));
    // Still hovered right after the click - hovering never dims.
    expect(svg.querySelectorAll("g.sankey-node[opacity]")).toHaveLength(0);
    await user.unhover(within(svg).getByText("orders-q"));

    expect(within(svg).getByText("tickets-q").closest("g.sankey-node")).toHaveAttribute("opacity", "0.35");
    expect(within(svg).getByText("orders-q").closest("g.sankey-node")).not.toHaveAttribute("opacity");
  });
});

describe("SankeyChart - hover", () => {
  it("does not dim anything while only hovering", async () => {
    const edges: SankeyEdge[] = [
      { source: "acme/sales", target: "Queue: orders-q", value: 1 },
      { source: "acme/support", target: "Queue: tickets-q", value: 1 },
    ];
    const user = userEvent.setup();
    const { container } = render(<SankeyChart edges={edges} />);
    const svg = screen.getByRole("img", { name: "Topic to endpoint Sankey diagram" });

    await user.hover(within(svg).getByText("orders-q"));

    expect(container.querySelectorAll('path[stroke="url(#sankey-flow-gradient)"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll("g.sankey-node[opacity]")).toHaveLength(0);
  });

  it("in data flow mode, hovering a wildcard queue highlights every topic it receives, covered ones included", async () => {
    const user = userEvent.setup();
    const { container } = render(<SankeyChart edges={wildcardEdges} />);
    const svg = screen.getByRole("img", { name: "Topic to endpoint Sankey diagram" });

    await user.hover(within(svg).getByText("all-sales-q"));

    // acme -> acme/sales -> acme/sales/> -> queue (declared) plus
    // acme/sales -> acme/sales/orders -> queue (covered by the wildcard);
    // only the topic endpoint's own link stays unhighlighted.
    const gradientLinks = container.querySelectorAll('path[stroke="url(#sankey-flow-gradient)"]');
    expect(gradientLinks).toHaveLength(5);
  });

  it("in literal mode, hovering the same queue highlights only its declared subscription", async () => {
    const user = userEvent.setup();
    const { container } = render(<SankeyChart edges={wildcardEdges} />);
    await user.click(screen.getByRole("button", { name: "Literal subscriptions" }));
    const svg = screen.getByRole("img", { name: "Topic to endpoint Sankey diagram" });

    await user.hover(within(svg).getByText("all-sales-q"));

    expect(container.querySelectorAll('path[stroke="url(#sankey-flow-gradient)"]')).toHaveLength(3);
  });
});

describe("SankeyChart - search", () => {
  it("selects the matching node on Enter", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);

    await user.type(screen.getByRole("combobox", { name: "Find topic or endpoint" }), "acme/sales/orders{Enter}");

    expect(within(panel()).getByText("Selected topic")).toBeInTheDocument();
    expect(within(panel()).getByText("acme/sales/orders", { selector: ".selection-panel-id" })).toBeInTheDocument();
    // The panel now shows the selection; the search is cleared and let go.
    const input = screen.getByRole("combobox", { name: "Find topic or endpoint" });
    expect(input).toHaveValue("");
    expect(input).not.toHaveFocus();
  });

  it("shows matching suggestions in a list below the field", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);
    const input = screen.getByRole("combobox", { name: "Find topic or endpoint" });

    await user.type(input, "sales");

    const list = screen.getByRole("listbox", { name: "Suggestions" });
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toContain("acme/sales/orders");
  });

  it("selects a suggestion with the arrow keys and Enter", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);
    const input = screen.getByRole("combobox", { name: "Find topic or endpoint" });

    await user.type(input, "te-ord");
    await user.keyboard("{ArrowDown}");
    const option = screen.getByRole("option", { name: /te-orders/ });
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", option.id);
    await user.keyboard("{Enter}");

    expect(within(panel()).getByText("Selected endpoint")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selects a suggestion by clicking it", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);

    await user.type(screen.getByRole("combobox", { name: "Find topic or endpoint" }), "all-sales");
    await user.click(screen.getByRole("option", { name: /all-sales-q/ }));

    expect(within(panel()).getByText("Selected endpoint")).toBeInTheDocument();
    const input = screen.getByRole("combobox", { name: "Find topic or endpoint" });
    expect(input).toHaveValue("");
    expect(input).not.toHaveFocus();
  });

  it("closes the suggestions on Escape", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);
    const input = screen.getByRole("combobox", { name: "Find topic or endpoint" });

    await user.type(input, "sales");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the typed text after a miss and tells only screen readers", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);
    const input = screen.getByRole("combobox", { name: "Find topic or endpoint" });

    await user.type(input, "billing{Enter}");

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent('No topic or endpoint matches "billing"');
    expect(status).toHaveClass("visually-hidden");
    expect(input).toHaveValue("billing");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("focuses on Ctrl+K (non-Mac test environment)", () => {
    render(<SankeyChart edges={basicEdges} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("combobox", { name: "Find topic or endpoint" })).toHaveFocus();
  });

  it("renders the export button into the given header slot instead of the toolbar", () => {
    const slot = document.createElement("div");
    document.body.appendChild(slot);
    render(<SankeyChart edges={basicEdges} exportSlot={slot} />);
    expect(within(slot).getByRole("button", { name: "Export SVG" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Export SVG" })).toHaveLength(1);
    slot.remove();
  });

  it("renders into the given header slot instead of the toolbar", () => {
    const slot = document.createElement("div");
    document.body.appendChild(slot);
    render(<SankeyChart edges={basicEdges} searchSlot={slot} />);
    expect(within(slot).getByRole("combobox")).toBeInTheDocument();
    slot.remove();
  });
});

describe("SankeyChart - view mode toggle", () => {
  it("offers both view modes, defaulting to 'Data flow'", () => {
    render(<SankeyChart edges={wildcardEdges} />);
    const group = screen.getByRole("group", { name: "View" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Data flow", "Literal subscriptions"]);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("'Data flow' mode (default) shows the implied wildcard-covered endpoint", () => {
    render(<SankeyChart edges={wildcardEdges} />);
    expect(screen.getByText("all-sales-q")).toBeInTheDocument();
    expect(screen.getByText("te-orders")).toBeInTheDocument();
  });

  it("'Literal subscriptions' mode drops implied wildcard coverage", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);

    await user.click(screen.getByRole("button", { name: "Literal subscriptions" }));
    expect(screen.getByRole("button", { name: "Literal subscriptions" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByText("orders"));
    expect(within(panel()).queryByText("all-sales-q")).not.toBeInTheDocument();
    expect(within(panel()).getByText("te-orders")).toBeInTheDocument();
  });

  it("switching view mode resets any active node selection", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={wildcardEdges} />);

    await user.click(screen.getByText("orders"));
    expect(panel()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Literal subscriptions" }));
    expect(screen.queryByRole("complementary", { name: "Selection details" })).not.toBeInTheDocument();
  });
});

describe("SankeyChart - direct subscribers toggle", () => {
  const mixedEdges: SankeyEdge[] = [
    { source: "acme/sales", target: "Queue: orders-q", value: 1 },
    { source: "acme/sales", target: "Direct Subscriber: my-app-1", value: 1 },
  ];

  it("is on by default, showing direct subscribers alongside other endpoints", () => {
    render(<SankeyChart edges={mixedEdges} />);
    expect(screen.getByLabelText("Direct subscribers")).toBeChecked();
    expect(screen.getByText("orders-q")).toBeInTheDocument();
    expect(screen.getByText("my-app-1")).toBeInTheDocument();
  });

  it("switching it off hides direct subscribers, switching it on brings them back", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={mixedEdges} />);
    const toggle = screen.getByLabelText("Direct subscribers");

    await user.click(toggle);
    expect(screen.getByText("orders-q")).toBeInTheDocument();
    expect(screen.queryByText("my-app-1")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText("my-app-1")).toBeInTheDocument();
  });

  it("toggling it resets any active node selection", async () => {
    const user = userEvent.setup();
    render(<SankeyChart edges={mixedEdges} />);

    await user.click(screen.getByText("orders-q"));
    expect(panel()).toBeInTheDocument();

    await user.click(screen.getByLabelText("Direct subscribers"));
    expect(screen.queryByRole("complementary", { name: "Selection details" })).not.toBeInTheDocument();
  });
});

describe("SankeyChart - svg structure", () => {
  it("renders an accessible svg with the expected aria-label", () => {
    render(<SankeyChart edges={basicEdges} />);
    const svg = screen.getByRole("img", { name: "Topic to endpoint Sankey diagram" });
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(within(svg).getAllByText("orders-q").length).toBeGreaterThan(0);
  });
});

describe("SankeyChart - SVG export", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads a standalone, background-filled copy of the live diagram, badges included", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<SankeyChart edges={basicEdges} />);
    await user.click(screen.getByRole("button", { name: "Export SVG" }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe("image/svg+xml");
    const text = await blob.text();
    expect(text).toContain("<svg");
    expect(text).toContain('fill="#093B5F"'); // the added standalone background
    expect(text).toContain("orders-q");
    // Badge colors are inline attributes, so the export (no stylesheet) keeps them.
    expect(text).toContain('fill="#00C895"');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
  });
});
