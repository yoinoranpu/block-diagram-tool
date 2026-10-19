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
  const input = d.nodes.find((n) => n.kind === "input"),
    output = d.nodes.find((n) => n.kind === "output");
  const path = input && output ? shortestPath(d, input.id, output.id) : [];
  const main = path.length
    ? [input!.id, ...path.map((id) => d.edges.find((e) => e.id === id)!.to)]
    : [];
  const rest = d.nodes.filter((n) => !main.includes(n.id));
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
    for (const n of rest) {
      slots.sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x));
      positions.set(n.id, slots.shift()!);
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
    nodes: d.nodes.map((n) => ({ ...n, ...positions.get(n.id) })),
  };
}
