import { layoutStateGraph } from "./stateConnectedLayout";
import type { Diagram } from "./model";
export type WiringIssue = { nodeId?: string; message: string };
export function inspectWiring(d: Diagram): WiringIssue[] {
  const out: WiringIssue[] = [];
  const inputs = d.nodes.filter((n) => n.kind === "input"),
    outputs = d.nodes.filter((n) => n.kind === "output");
  if (inputs.length !== 1) out.push({ message: "入力を1つ配置してください。" });
  if (outputs.length !== 1)
    out.push({ message: "出力を1つ配置してください。" });
  const reachable = new Set(inputs.map((n) => n.id)),
    toOutput = new Set(outputs.map((n) => n.id));
  for (let i = 0; i < d.nodes.length; i++)
    for (const e of d.edges) {
      if (reachable.has(e.from)) reachable.add(e.to);
      if (toOutput.has(e.to)) toOutput.add(e.from);
    }
  for (const n of d.nodes) {
    const incoming = d.edges.filter((e) => e.to === n.id),
      outgoing = d.edges.filter((e) => e.from === n.id);
    let message = "";
    if (n.kind !== "input" && !incoming.length) message = "入力が未接続です";
    else if (n.kind !== "sum" && n.kind !== "input" && incoming.length > 1)
      message = "入力が二重接続です。合流は加算点を使います";
    else if (n.kind === "input" && incoming.length)
      message = "外部入力に配線が入っています";
    else if (n.kind === "output" && outgoing.length)
      message = "出力から配線が出ています";
    else if (n.kind !== "output" && !outgoing.length)
      message = "出力側が未接続です";
    else if (inputs.length && !reachable.has(n.id))
      message = "外部入力から到達できません";
    else if (outputs.length && !toOutput.has(n.id))
      message = "出力につながっていません";
    else if (n.kind === "block" && !n.num.trim()) message = "分子が未入力です";
    if (message)
      out.push({ nodeId: n.id, message: `${n.label}：${message}。` });
  }
  return out;
}
export function shortestPath(d: Diagram, from: string, to: string): string[] {
  const queue = [from],
    previous = new Map<string, { node: string; edge: string }>(),
    visited = new Set([from]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current === to) {
      const edges: string[] = [];
      let n = to;
      while (n !== from) {
        const p = previous.get(n)!;
        edges.unshift(p.edge);
        n = p.node;
      }
      return edges;
    }
    for (const e of d.edges.filter((e) => e.from === current))
      if (!visited.has(e.to)) {
        visited.add(e.to);
        previous.set(e.to, { node: current, edge: e.id });
        queue.push(e.to);
      }
  }
  return [];
}
export function traceSignal(
  d: Diagram,
  selected?: string,
): { edges: Set<string>; nodes: Set<string>; label: string } {
  const edge = d.edges.find((e) => e.id === selected),
    node = d.nodes.find((n) => n.id === selected),
    input = d.nodes.find((n) => n.kind === "input"),
    output = d.nodes.find((n) => n.kind === "output");
  if (!edge && !node) return { edges: new Set(), nodes: new Set(), label: "" };
  const start = edge?.from ?? node!.id,
    end = edge?.to ?? node!.id;
  const ids = [
    ...(input ? shortestPath(d, input.id, start) : []),
    ...(edge ? [edge.id] : []),
    ...(output ? shortestPath(d, end, output.id) : []),
  ];
  const nodes = new Set([start, end]);
  for (const id of ids) {
    const e = d.edges.find((e) => e.id === id)!;
    nodes.add(e.from);
    nodes.add(e.to);
  }
  const source = d.nodes.find((n) => n.id === start)!,
    target = d.nodes.find((n) => n.id === end)!;
  return {
    edges: new Set(ids),
    nodes,
    label: edge
      ? `${source.label} → ${target.label}${target.kind === "sum" ? `（入力符号 ${edge.sign === 1 ? "＋" : "−"}）` : ""}`
      : `${source.label} を通る入力→出力の経路`,
  };
}
export const snap = (n: number) => Math.round(n / 20) * 20;
export function arrangeDiagram(d: Diagram): Diagram {
  const source = d.nodes.filter((n) => n.kind === "input"),
    target = d.nodes.filter((n) => n.kind === "output");
  if (
    source.length === 1 &&
    target.length === 1 &&
    shortestPath(d, source[0].id, target[0].id).length
  ) {
    const ids = new Map(
      d.nodes.map((n, i) => [
        n.id,
        n.kind === "input" ? "u" : n.kind === "output" ? "y" : `node-${i}`,
      ]),
    );
    try {
      const layout = layoutStateGraph({
        nodes: d.nodes.map((n) => ({
          id: ids.get(n.id)!,
          kind:
            n.kind === "block"
              ? n.num.trim() === "1" && n.den.trim() === "s"
                ? ("integrator" as const)
                : ("gain" as const)
              : n.kind,
          label: n.label,
          value: n.num,
        })),
        edges: d.edges.map((e) => ({
          id: e.id,
          from: ids.get(e.from)!,
          to: ids.get(e.to)!,
          signal: ids.get(e.from)!,
        })),
      });
      return {
        ...d,
        nodes: d.nodes.map((n) => {
          const p = layout.children.find((p) => p.id === ids.get(n.id))!;
          const ports = p.ports;
          const out = ports.find((port) => port.id === `${p.id}-out`);
          return {
            ...n,
            x: p.x + p.width / 2,
            y: p.y + p.height / 2,
            reversed: out ? out.x === 0 : false,
          };
        }),
      };
    } catch {
      /* Keep the bounded fallback for disconnected or unusually dense graphs. */
    }
  }

  const integrator = arrangeIntegrator(d);
  if (integrator) return integrator;
  const input = d.nodes.find((n) => n.kind === "input"),
    output = d.nodes.find((n) => n.kind === "output");
  const path = input && output ? shortestPath(d, input.id, output.id) : [];
  const main = path.length
    ? [input!.id, ...path.map((id) => d.edges.find((e) => e.id === id)!.to)]
    : [];
  const rest = d.nodes.filter((n) => !main.includes(n.id));
  const reversed = new Map<string, boolean>();
  const positions = new Map<string, { x: number; y: number }>();
  if (main.length >= 2 && main.length <= 6 && rest.length <= 10) {
    main.forEach((id, i) =>
      positions.set(id, {
        x: snap(80 + (i * 840) / (main.length - 1)),
        y: 280,
      }),
    );
    const slots = Array.from({ length: 10 }, (_, i) => ({
      x: 180 + (i % 5) * 170,
      y: i < 5 ? 80 : 520,
    }));
    // Locate each side path by its connections, independent of dragged coordinates.
    const anchor = (id: string, backward: boolean) => {
      const queue = [{ id, steps: 0 }],
        seen = new Set([id]);
      while (queue.length) {
        const current = queue.shift()!;
        if (positions.has(current.id) && main.includes(current.id))
          return { x: positions.get(current.id)!.x, steps: current.steps };
        for (const edge of d.edges) {
          const next = backward
            ? edge.to === current.id
              ? edge.from
              : undefined
            : edge.from === current.id
              ? edge.to
              : undefined;
          if (next && !seen.has(next)) {
            seen.add(next);
            queue.push({ id: next, steps: current.steps + 1 });
          }
        }
      }
      return undefined;
    };
    for (const id of main) reversed.set(id, false);
    for (const n of [...rest].sort((a, b) => a.id.localeCompare(b.id))) {
      const up = anchor(n.id, true),
        down = anchor(n.id, false);
      const feedback = !!up && !!down && up.x > down.x;
      const x =
        up && down
          ? (up.x * down.steps + down.x * up.steps) / (up.steps + down.steps)
          : (up?.x ?? down?.x ?? 500);
      const y = feedback ? 520 : 80;
      slots.sort(
        (a, b) =>
          Math.abs(a.x - x) +
          3 * Math.abs(a.y - y) -
          (Math.abs(b.x - x) + 3 * Math.abs(b.y - y)),
      );
      positions.set(n.id, slots.shift()!);
      reversed.set(n.id, feedback);
    }
  } else {
    const order = [...main, ...rest.map((n) => n.id)];
    if (!main.length)
      order.splice(0, order.length, ...d.nodes.map((n) => n.id));
    order.forEach((id, i) =>
      positions.set(id, {
        x: 100 + (i % 5) * 180,
        y: 80 + Math.floor(i / 5) * 150,
      }),
    );
  }
  return {
    ...d,
    nodes: d.nodes.map((n) => ({
      ...n,
      ...positions.get(n.id),
      reversed: reversed.get(n.id) ?? n.reversed,
    })),
  };
}

/** Split a signal edge, preserving its downstream summing sign. */
export function insertOnEdge(
  d: Diagram,
  edgeId: string,
  kind: "block" | "branch" | "sum",
  position?: { x: number; y: number },
): Diagram {
  const edge = d.edges.find((e) => e.id === edgeId);
  if (!edge || d.nodes.length >= 16 || d.edges.length >= 32) return d;
  const from = d.nodes.find((n) => n.id === edge.from)!,
    to = d.nodes.find((n) => n.id === edge.to)!;
  const node = {
    id: crypto.randomUUID(),
    kind,
    label: kind === "block" ? "G" : kind === "branch" ? "分岐点" : "加算点",
    num: "1",
    den: "1",
    x: snap(position?.x ?? (from.x + to.x) / 2),
    y: snap(position?.y ?? (from.y + to.y) / 2),
    reversed: from.x > to.x,
  };
  // Find a nearby empty slot so insertion never hides another element.
  const width = kind === "block" ? 64 : 34,
    height = kind === "block" ? 43 : 23;
  const candidates = Array.from({ length: 45 * 26 }, (_, i) => ({
    x: Math.max(60, Math.min(9940, node.x + ((i % 45) - 22) * 20)),
    y: Math.max(50, Math.min(9950, node.y + (Math.floor(i / 45) - 13) * 20)),
  }));
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - node.x, a.y - node.y) -
      Math.hypot(b.x - node.x, b.y - node.y),
  );
  const free = candidates.find((p) =>
    d.nodes.every(
      (n) =>
        Math.abs(p.x - n.x) >= width + (n.kind === "block" ? 64 : 34) + 16 ||
        Math.abs(p.y - n.y) >= height + (n.kind === "block" ? 43 : 24) + 16,
    ),
  );
  if (free) Object.assign(node, free);
  const result: Diagram = {
    ...d,
    nodes: [...d.nodes, node],
    edges: d.edges.flatMap((e) =>
      e.id === edgeId
        ? [
            {
              id: crypto.randomUUID(),
              from: e.from,
              to: node.id,
              sign: 1 as const,
            },
            { ...e, from: node.id },
          ]
        : [e],
    ),
  };
  return free ? result : arrangeDiagram(result);
}

/** Recognize the integrator chain by connections, rather than node names. */
export function arrangeIntegrator(d: Diagram): Diagram | undefined {
  const input = d.nodes.find((n) => n.kind === "input"),
    output = d.nodes.find((n) => n.kind === "output");
  if (!input || !output) return;
  const q = d.nodes.find(
    (n) =>
      n.kind === "sum" &&
      d.edges.some((e) => e.from === input.id && e.to === n.id),
  );
  const z = d.nodes.find(
    (n) =>
      n.kind === "sum" &&
      n.id !== q?.id &&
      d.edges.some((e) => e.from === n.id && e.to === output.id),
  );
  if (!q || !z) return;
  const states: string[] = [];
  let previous = q.id;
  while (states.length < 4) {
    const next = d.nodes.filter(
      (n) =>
        n.kind === "block" &&
        n.num.trim() === "1" &&
        n.den.trim() === "s" &&
        !states.includes(n.id) &&
        d.edges.some((e) => e.from === previous && e.to === n.id),
    );
    if (next.length !== 1) break;
    states.push(next[0].id);
    previous = next[0].id;
  }
  if (!states.length || states.length > 3) return;
  const positions = new Map<
    string,
    { x: number; y: number; reversed: boolean }
  >([
    [input.id, { x: 40, y: 280, reversed: false }],
    [q.id, { x: 160, y: 280, reversed: false }],
    [z.id, { x: 900, y: 80, reversed: false }],
    [output.id, { x: 980, y: 80, reversed: false }],
  ]);
  const allowed = new Set([
    `${input.id}:${q.id}`,
    `${z.id}:${output.id}`,
    ...states.map((id, i) => `${i ? states[i - 1] : q.id}:${id}`),
  ]);
  states.forEach((id, i) =>
    positions.set(id, { x: 350 + i * 200, y: 280, reversed: false }),
  );
  for (const n of d.nodes.filter((n) => !positions.has(n.id))) {
    if (n.kind !== "block") return;
    const incoming = d.edges.filter((e) => e.to === n.id),
      outgoing = d.edges.filter((e) => e.from === n.id);
    if (incoming.length !== 1 || outgoing.length !== 1) return;
    const i = states.indexOf(incoming[0].from);
    if (i >= 0 && outgoing[0].to === q.id)
      positions.set(n.id, {
        x: 350 + i * 200,
        y: 420 + i * 60,
        reversed: true,
      });
    else if (i >= 0 && outgoing[0].to === z.id)
      positions.set(n.id, {
        x: 490 + i * 200,
        y: 70 + i * 55,
        reversed: false,
      });
    else if (incoming[0].from === input.id && outgoing[0].to === z.id)
      positions.set(n.id, { x: 140, y: 70, reversed: false });
    else return;
    allowed.add(`${incoming[0].from}:${n.id}`);
    allowed.add(`${n.id}:${outgoing[0].to}`);
  }
  if (d.edges.some((e) => !allowed.has(`${e.from}:${e.to}`))) return;
  if (
    new Set([...positions.values()].map((p) => `${p.x}:${p.y}`)).size !==
    positions.size
  )
    return;
  // Reject unfamiliar extra connections instead of misclassifying a user graph.
  if (new Set(d.edges.map((e) => `${e.from}:${e.to}`)).size !== d.edges.length)
    return;
  return {
    ...d,
    nodes: d.nodes.map((n) => ({ ...n, ...positions.get(n.id) })),
  };
}
