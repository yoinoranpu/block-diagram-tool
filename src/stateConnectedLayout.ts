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
/** Our own content-sized signal-path layout: a straight forward path with side lanes. */
export function layoutStateGraph(model: StateGraph): StateLayout {
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const zeroGains = new Set(model.nodes
    .filter((n) => n.kind === "gain" && n.value === "0").map((n) => n.id));
  function preferredPath(start: string, target: string, allowed?: Set<string>, allowZero = false) {
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
          !seen.has(e.to) && (allowZero || !zeroGains.has(e.to)) &&
          (!allowed || allowed.has(e.to) || e.to === target)
        )
          visit(e.to, [...path, e.to], new Set([...seen, e.to]));
    };
    visit(start, [start], new Set([start]));
    return best;
  }
  const nonzeroMain = preferredPath("u", "y");
  const main = nonzeroMain.length ? nonzeroMain : preferredPath("u", "y", undefined, true);
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
  // Reserve space for side chains before placing them. Drawing coordinates are
  // independent of the viewport; fitting belongs to the renderer.
  const offMain = new Set(
    model.nodes.filter((n) => !positions.has(n.id)).map((n) => n.id),
  );
  for (let end = 1; end < main.length; end++) {
    for (let start = 0; start < end; start++) {
      const a = main[start], b = main[end];
      const forward = preferredPath(a, b, offMain).slice(1, -1);
      const backward = preferredPath(b, a, offMain).slice(1, -1);
      const required = Math.max(...[forward, backward].map((path) =>
        path.length
          ? path.reduce((total, id) => total + size(byId.get(id)!).width, 0)
            + (path.length + 1) * 100
            + size(byId.get(a)!).width / 2 + size(byId.get(b)!).width / 2
          : 0,
      ));
      const extra = required - (positions.get(b)!.x - positions.get(a)!.x);
      if (extra > 0)
        for (let i = start + 1; i < main.length; i++)
          positions.get(main[i])!.x +=
            extra * Math.min(1, (i - start) / (end - start));
    }
  }
  // Peel local state feedback out of parallel chains. Otherwise an undirected
  // component incorrectly treats Aii as one more forward-path block.
  const localLoops = model.nodes.filter((n) => {
    if (n.kind !== "gain" || positions.has(n.id)) return false;
    const incoming = model.edges.filter((e) => e.to === n.id);
    const outgoing = model.edges.filter((e) => e.from === n.id);
    return incoming.length === 1 && outgoing.length === 1 &&
      byId.get(incoming[0].from)?.kind === "integrator" &&
      byId.get(outgoing[0].to)?.kind === "sum" &&
      model.edges.some((e) => e.from === outgoing[0].to && e.to === incoming[0].from);
  });
  const pendingLoops = new Set(localLoops.map((n) => n.id));
  const remaining = new Set(
    model.nodes
      .filter((n) => !positions.has(n.id) && !pendingLoops.has(n.id) && !zeroGains.has(n.id))
      .map((n) => n.id),
  );
  const lanes: { side: number; row: number; left: number; right: number }[] =
    [];
  function lane(side: number, left: number, right: number, below = 0) {
    let row = Math.max(1, Math.ceil(below / 180) + 1);
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
  function placeLocalLoops() {
    for (const id of pendingLoops) {
      const from = model.edges.find((e) => e.to === id)!.from;
      const to = model.edges.find((e) => e.from === id)!.to;
      const a = positions.get(from), b = positions.get(to);
      if (!a || !b) continue;
      positions.set(id, {
        x: a.x,
        y: lane(
          1, Math.min(a.x, b.x) - 50, Math.max(a.x, b.x) + 50, Math.max(a.y, b.y),
        ),
        reversed: b.x <= a.x,
      });
      pendingLoops.delete(id);
    }
  }
  while (remaining.size) {
    placeLocalLoops();
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
    // Keep the forward signal path on the top row; all auxiliary paths
    // use aligned lanes underneath it, including parallel/feedforward paths.
    const side = 1;
    const left = Math.min(a.x, b.x),
      right = Math.max(a.x, b.x);
    const y = lane(side, left - 50, right + 50);
    const path =
      from && to
        ? preferredPath(from, to, component).filter((id) => component.has(id))
        : [];
    const ordered = [
      ...path,
      ...[...component].filter((id) => !path.includes(id)),
    ];
    const isBlock = (id: string) =>
      byId.get(id)?.kind === "gain" || byId.get(id)?.kind === "integrator";
    const startIndex = main.indexOf(from ?? ""),
      endIndex = main.indexOf(to ?? "");
    const reference = startIndex >= 0 && endIndex >= 0
      ? main.slice(
          Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1,
        ).filter(isBlock)
      : [];
    const referencePath = startIndex >= 0 && endIndex > startIndex
      ? main.slice(startIndex + 1, endIndex) : [];
    if (path.length === component.size && incoming.length === 1 && outgoing.length === 1 &&
        referencePath.length === path.length && path.every((id, i) =>
          byId.get(id)!.kind === byId.get(referencePath[i])!.kind)) {
      path.forEach((id, i) => positions.set(id, {
        x: positions.get(referencePath[i])!.x, y,
      }));
      continue;
    }
    const blocks = ordered.filter(isBlock);
    const simpleChain = ordered.length === blocks.length &&
      component.size === path.length &&
      incoming.length === 1 && outgoing.length === 1;
    if (simpleChain && reference.length) {
      const columns = reference.map((id) => positions.get(id)!.x);
      // Match columns by visual order, even when the signal travels backwards.
      const reverse = b.x < a.x;
      const center = (columns[0] + columns.at(-1)!) / 2;
      const aligned = blocks.map((_, i) => blocks.length === columns.length
        ? columns[reverse ? columns.length - 1 - i : i]
        : center + (reverse ? -1 : 1) * (i - (blocks.length - 1) / 2) * 228);
      // A connection into the middle of a block cannot always be centered
      // without reversing the wire. Keep the spacious path in that case.
      if (Math.min(...aligned) >= left && Math.max(...aligned) <= right) {
        blocks.forEach((id, i) => positions.set(id, {
          x: aligned[i], y, reversed: reverse,
        }));
        continue;
      }
    }
    if (component.size === 1) {
      positions.set(seed, { x: (a.x + b.x) / 2, y, reversed: b.x < a.x });
      continue;
    }
    const span = Math.max(
      Math.abs(b.x - a.x) - 228,
      (ordered.length - 1) * 228,
    );
    ordered.forEach((id, i) =>
      positions.set(id, {
        x:
          (b.x < a.x ? right - 114 : left + 114) +
          (b.x < a.x ? -1 : 1) *
          (ordered.length === 1 ? 0 : (i * span) / (ordered.length - 1)),
        y,
        reversed: b.x < a.x,
      }),
    );
  }
  placeLocalLoops();
  // Zero gains remain visible and wired, without displacing nonzero forward
  // paths or merging otherwise independent state rows.
  for (const id of zeroGains) {
    if (positions.has(id)) continue;
    const incoming = model.edges.find((e) => e.to === id);
    const outgoing = model.edges.find((e) => e.from === id);
    const a = incoming && positions.get(incoming.from);
    const b = outgoing && positions.get(outgoing.to);
    if (!a || !b) continue;
    positions.set(id, {
      x: (a.x + b.x) / 2,
      y: lane(1, Math.min(a.x, b.x) - 50, Math.max(a.x, b.x) + 50, Math.max(a.y, b.y)),
      reversed: b.x < a.x,
    });
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
    edges: [...model.edges]
      .sort((a, b) => Number(zeroGains.has(a.from) || zeroGains.has(a.to))
        - Number(zeroGains.has(b.from) || zeroGains.has(b.to)))
      .map((e) => ({ ...e, sign: 1 as const })),
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
