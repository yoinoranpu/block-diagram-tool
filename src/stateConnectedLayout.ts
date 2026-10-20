import type { StateGraph, StateLayout, StateNode } from "./StateConnectedGraph";
import {
  routeEdges,
  diagramBounds,
  signalJunctions,
  halfWidth,
  halfHeight,
  portPoint,
  outputSide,
} from "./routing";
import type { Diagram, DiagramNode } from "./model";
/** Our own bounded signal-path layout: a straight forward path with side lanes. */
export function layoutStateGraph(model: StateGraph): StateLayout {
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  function preferredPath(start: string, target: string, allowed?: Set<string>) {
    let best: string[] = [],
      bestScore = -Infinity,
      visits = 0;
    const visit = (id: string, path: string[], seen: Set<string>) => {
      if (++visits > 10000) return;
      if (id === target) {
        const score =
          path.filter((id) => byId.get(id)?.kind === "integrator").length *
            1000 -
          path.length;
        if (score > bestScore) {
          best = path;
          bestScore = score;
        }
        return;
      }
      for (const e of model.edges.filter((e) => e.from === id))
        if (
          !seen.has(e.to) &&
          (!allowed || allowed.has(e.to) || e.to === target)
        )
          visit(e.to, [...path, e.to], new Set([...seen, e.to]));
    };
    visit(start, [start], new Set([start]));
    return best;
  }
  const main = preferredPath("u", "y");
  const size = (n: StateNode) =>
    n.kind === "branch"
      ? { width: 68, height: 16 }
      : n.kind === "sum"
        ? { width: 46, height: 46 }
        : n.kind === "input" || n.kind === "output"
          ? { width: 66, height: 48 }
          : { width: 128, height: 86 };
  const positions = new Map<
    string,
    { x: number; y: number; reversed?: boolean }
  >();
  let x = 80;
  for (const id of main) {
    const w = size(byId.get(id)!).width;
    positions.set(id, { x: x + w / 2, y: 0 });
    x += w + 100;
  }
  if (!main.length) {
    positions.set("u", { x: 80, y: 0 });
    positions.set("y", { x: 1100, y: 0 });
    positions.set("out", { x: 950, y: 0 });
  }
  const remaining = new Set(
    model.nodes.filter((n) => !positions.has(n.id)).map((n) => n.id),
  );
  const lanes: { side: number; row: number; left: number; right: number }[] =
    [];
  function lane(side: number, left: number, right: number) {
    let row = 1;
    while (
      lanes.some(
        (l) =>
          l.side === side &&
          l.row === row &&
          Math.max(left, l.left) < Math.min(right, l.right) + 48,
      )
    )
      row++;
    lanes.push({ side, row, left, right });
    return side * (row * 180);
  }
  while (remaining.size) {
    const seed = remaining.values().next().value!;
    const component = new Set([seed]),
      queue = [seed];
    remaining.delete(seed);
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of model.edges) {
        const other = e.from === id ? e.to : e.to === id ? e.from : undefined;
        if (other && remaining.has(other)) {
          remaining.delete(other);
          component.add(other);
          queue.push(other);
        }
      }
    }
    const incoming = model.edges.filter(
        (e) => component.has(e.to) && positions.has(e.from),
      ),
      outgoing = model.edges.filter(
        (e) => component.has(e.from) && positions.has(e.to),
      );
    const from = incoming[0]?.from,
      to = outgoing[0]?.to;
    const a = from ? positions.get(from)! : { x: 80, y: 0 },
      b = to ? positions.get(to)! : { x: Math.max(1100, x - 180), y: 0 };
    const side = b.x <= a.x ? 1 : -1;
    const left = Math.min(a.x, b.x),
      right = Math.max(a.x, b.x);
    const y = lane(side, left - 50, right + 50);
    if (component.size === 1) {
      positions.set(seed, { x: (a.x + b.x) / 2, y, reversed: b.x < a.x });
      continue;
    }
    const path =
      from && to
        ? preferredPath(from, to, component).filter((id) => component.has(id))
        : [];
    const ordered = [
      ...path,
      ...[...component].filter((id) => !path.includes(id)),
    ];
    const span = Math.max(
      Math.abs(b.x - a.x) - 180,
      (ordered.length - 1) * 210,
    );
    ordered.forEach((id, i) =>
      positions.set(id, {
        x:
          left +
          90 +
          (ordered.length === 1 ? 0 : (i * span) / (ordered.length - 1)),
        y,
        reversed: false,
      }),
    );
  }
  const diagram: Diagram = {
    nodes: model.nodes.map((n) => {
      const p = positions.get(n.id)!;
      return {
        id: n.id,
        kind: n.kind === "gain" || n.kind === "integrator" ? "block" : n.kind,
        label: n.label,
        num: n.value ?? "1",
        den: n.kind === "integrator" ? "s" : "1",
        ...p,
      } as DiagramNode;
    }),
    edges: model.edges.map((e) => ({ ...e, sign: 1 as const })),
  };
  const routes = routeEdges(diagram);
  if (routes.some((r) => r.obstructed))
    throw new Error(
      "一部の配線を整理できませんでした。ラベル接続表示をご利用ください。",
    );
  const bounds = diagramBounds(diagram, routes),
    shift = (p: { x: number; y: number }) => ({
      x: p.x - bounds.x,
      y: p.y - bounds.y,
    });
  const children = model.nodes.map((n) => {
    const p = diagram.nodes.find((v) => v.id === n.id)!,
      width = halfWidth(p) * 2,
      height = halfHeight(p) * 2;
    const corner = shift({ x: p.x - width / 2, y: p.y - height / 2 });
    const ports = routes
      .filter((r) => r.edge.to === n.id)
      .map((r) => ({
        id: `${r.edge.id}-in`,
        signX: r.sign.x - (p.x - width / 2),
        signY: r.sign.y - (p.y - height / 2) + 5,
        x: r.points.at(-1)!.x - (p.x - width / 2),
        y: r.points.at(-1)!.y - (p.y - height / 2),
      }));
    const out = portPoint(p, outputSide(p));
    ports.push({
      id: `${n.id}-out`,
      signX: 0,
      signY: 0,
      x: out.x - (p.x - width / 2),
      y: out.y - (p.y - height / 2),
    });
    return { id: n.id, ...corner, width, height, ports };
  });
  const junctions = signalJunctions(routes, diagram.nodes);
  return {
    width: bounds.width,
    height: bounds.height,
    main,
    children,
    edges: routes.map((r, i) => ({
      id: r.edge.id,
      sections: [
        {
          startPoint: shift(r.points[0]),
          bendPoints: r.points.slice(1, -1).map(shift),
          endPoint: shift(r.points.at(-1)!),
        },
      ],
      junctionPoints: i === 0 ? junctions.map(shift) : [],
    })),
  };
}
