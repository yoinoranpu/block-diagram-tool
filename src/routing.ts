import type { Diagram, DiagramNode, Edge } from "./model";
export type Point = { x: number; y: number };
export type Side = "left" | "right" | "top" | "bottom";
export const halfWidth = (n: DiagramNode) =>
  n.kind === "block"
    ? 64
    : n.kind === "sum"
      ? 23
      : n.kind === "branch"
        ? 34
        : 33;
export const halfHeight = (n: DiagramNode) =>
  n.kind === "block"
    ? 43
    : n.kind === "sum"
      ? 23
      : n.kind === "branch"
        ? 8
        : 24;
export const inputSide = (n: DiagramNode): Side =>
  n.reversed ? "right" : "left";
export const outputSide = (n: DiagramNode): Side =>
  n.reversed ? "left" : "right";
export function portPoint(n: DiagramNode, side: Side): Point {
  return {
    x:
      n.x +
      (side === "left" ? -halfWidth(n) : side === "right" ? halfWidth(n) : 0),
    y:
      n.y +
      (side === "top" ? -halfHeight(n) : side === "bottom" ? halfHeight(n) : 0),
  };
}
const vector = (s: Side): Point =>
  ({
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 },
  })[s];
function sumSides(d: Diagram): Map<string, Side> {
  const out = new Map<string, Side>();
  for (const n of d.nodes.filter((n) => n.kind === "sum")) {
    const incoming = d.edges.filter((e) => e.to === n.id);
    for (const e of incoming) {
      const source = d.nodes.find((v) => v.id === e.from)!;
      // Inputs on the same side get distinct nearby ports. Do not force a
      // return arriving from above to travel under the entire diagram.
      const side: Side =
        source.x < n.x - 50 && Math.abs(source.y - n.y) < 90
          ? "left"
          : source.y < n.y
            ? "top"
            : source.y > n.y || source.x > n.x + 50
              ? "bottom"
              : "left";
      out.set(e.id, side);
    }
  }
  return out;
}
function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    if (out.length && out.at(-1)!.x === p.x && out.at(-1)!.y === p.y) continue;
    while (out.length > 1) {
      const a = out.at(-2)!,
        b = out.at(-1)!;
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))
        out.pop();
      else break;
    }
    out.push(p);
  }
  return out;
}
// A* on a rectilinear visibility grid. Nodes are obstacles; turns, crossings and
// shared segments have costs. Edges only connect at their declared endpoints.
function findPath(
  start: Point,
  end: Point,
  obstacles: { x1: number; y1: number; x2: number; y2: number }[],
  used: Point[][],
  lead?: Point,
  tail?: Point,
): Point[] | undefined {
  const extentX = [start.x, end.x, ...obstacles.flatMap((r) => [r.x1, r.x2])];
  const extentY = [start.y, end.y, ...obstacles.flatMap((r) => [r.y1, r.y2])];
  const xs = [
    ...new Set([
      start.x,
      end.x,
      Math.min(...extentX) - 48,
      Math.max(...extentX) + 48,
      ...obstacles.flatMap((r) => [r.x1 - 6, r.x2 + 6]),
    ]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([
      start.y,
      end.y,
      Math.min(...extentY) - 48,
      Math.max(...extentY) + 48,
      ...obstacles.flatMap((r) => [r.y1 - 6, r.y2 + 6]),
      ...used.flatMap((path) => path.flatMap((p) => [p.y - 24, p.y + 24])),
    ]),
  ].sort((a, b) => a - b);
  const w = xs.length,
    h = ys.length;
  const blocked = (x: number, y: number) =>
    obstacles.some((r) => x > r.x1 && x < r.x2 && y > r.y1 && y < r.y2);
  const clear = (a: Point, b: Point) =>
    !obstacles.some((r) =>
      a.x === b.x
        ? a.x > r.x1 &&
          a.x < r.x2 &&
          Math.max(a.y, b.y) > r.y1 &&
          Math.min(a.y, b.y) < r.y2
        : a.y > r.y1 &&
          a.y < r.y2 &&
          Math.max(a.x, b.x) > r.x1 &&
          Math.min(a.x, b.x) < r.x2,
    );
  const congestion = (a: Point, b: Point) => {
    let cost = 0;
    for (const path of used)
      for (let i = 1; i < path.length; i++) {
        const c = path[i - 1],
          d = path[i];
        if (
          a.x === b.x &&
          c.x === d.x &&
          a.x === c.x &&
          Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) >
            Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))
        )
          cost +=
            8 *
            (Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
              Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)));
        else if (
          a.y === b.y &&
          c.y === d.y &&
          a.y === c.y &&
          Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) >
            Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))
        )
          cost +=
            8 *
            (Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
              Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)));
        else if (
          a.x === b.x &&
          c.y === d.y &&
          a.x > Math.min(c.x, d.x) &&
          a.x < Math.max(c.x, d.x) &&
          c.y > Math.min(a.y, b.y) &&
          c.y < Math.max(a.y, b.y)
        )
          cost += 50;
        else if (
          a.y === b.y &&
          c.x === d.x &&
          a.y > Math.min(c.y, d.y) &&
          a.y < Math.max(c.y, d.y) &&
          c.x > Math.min(a.x, b.x) &&
          c.x < Math.max(a.x, b.x)
        )
          cost += 50;
      }
    return cost;
  };
  // Prefer unobstructed straight/L paths. Grid density must not add bends.
  const options: Point[][] = [];
  if (start.x === end.x || start.y === end.y) options.push([start, end]);
  options.push(
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end],
  );
  const simple = options
    .map(simplify)
    .filter((path) =>
      path
        .slice(1)
        .every((p, i) => clear(path[i], p) && congestion(path[i], p) === 0),
    )
    .sort(
      (a, b) =>
        simplify([lead ?? start, ...a, tail ?? end]).length -
        simplify([lead ?? start, ...b, tail ?? end]).length,
    );
  if (simple.length) return simple[0];
  type State = {
    id: number;
    x: number;
    y: number;
    dir: number;
    g: number;
    f: number;
  };
  const heap: State[] = [];
  function push(v: State) {
    heap.push(v);
    let i = heap.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= v.f) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = v;
  }
  function pop(): State {
    const first = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let c = i * 2 + 1;
        if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++;
        if (heap[c].f >= last.f) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = last;
    }
    return first;
  }
  const id = (x: number, y: number, dir: number) => (y * w + x) * 3 + dir;
  const sx = xs.indexOf(start.x),
    sy = ys.indexOf(start.y),
    tx = xs.indexOf(end.x),
    ty = ys.indexOf(end.y);
  const distance = new Map<number, number>(),
    parents = new Map<number, number>();
  const initial = id(sx, sy, 0);
  distance.set(initial, 0);
  push({ id: initial, x: sx, y: sy, dir: 0, g: 0, f: 0 });
  let visits = 0;
  while (heap.length) {
    if (++visits > 12000) return undefined;
    const cur = pop();
    if (cur.g !== distance.get(cur.id)) continue;
    if (cur.x === tx && cur.y === ty) {
      const path: Point[] = [];
      let k: number | undefined = cur.id;
      while (k !== undefined) {
        const cell = Math.floor(k / 3);
        path.push({ x: xs[cell % w], y: ys[Math.floor(cell / w)] });
        k = parents.get(k);
      }
      return simplify(path.reverse());
    }
    for (const [dx, dy, dir] of [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 2],
      [0, -1, 2],
    ]) {
      const x = cur.x + dx,
        y = cur.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= h || blocked(xs[x], ys[y])) continue;
      const a = { x: xs[cur.x], y: ys[cur.y] },
        b = { x: xs[x], y: ys[y] };
      if (!clear(a, b)) continue;
      const g =
          cur.g +
          Math.abs(a.x - b.x) +
          Math.abs(a.y - b.y) +
          (cur.dir && cur.dir !== dir ? 65 : 0) +
          congestion(a, b),
        next = id(x, y, dir);
      if (g >= (distance.get(next) ?? Infinity)) continue;
      distance.set(next, g);
      parents.set(next, cur.id);
      push({
        id: next,
        x,
        y,
        dir,
        g,
        f: g + Math.abs(xs[x] - end.x) + Math.abs(ys[y] - end.y),
      });
    }
  }
  return undefined;
}
export type RoutedEdge = {
  edge: Edge;
  points: Point[];
  path: string;
  sign: Point;
  toSide: Side;
  obstructed: boolean;
};
export function routeEdges(diagram: Diagram): RoutedEdge[] {
  const sides = sumSides(diagram),
    used: Point[][] = [];
  const obstacles = diagram.nodes.map((n) => ({
    x1: n.x - halfWidth(n) - 10,
    x2: n.x + halfWidth(n) + 10,
    y1: n.y - halfHeight(n) - 10,
    y2: n.y + halfHeight(n) + 10,
  }));
  return diagram.edges.map((edge) => {
    const a = diagram.nodes.find((n) => n.id === edge.from)!,
      b = diagram.nodes.find((n) => n.id === edge.to)!;
    const fromSide =
        a.kind === "branch"
          ? b.x < a.x && Math.abs(b.y - a.y) <= 40
            ? "bottom"
            : Math.abs(b.y - a.y) > 40
              ? b.y < a.y
                ? "top"
                : "bottom"
              : outputSide(a)
          : outputSide(a),
      toSide = sides.get(edge.id) ?? inputSide(b);
    const start =
        a.kind === "branch" ? { x: a.x, y: a.y } : portPoint(a, fromSide),
      end = portPoint(b, toSide),
      u = vector(fromSide),
      v = vector(toSide);
    if (b.kind === "sum") {
      const peers = diagram.edges.filter(
        (e) => e.to === b.id && sides.get(e.id) === toSide,
      );
      if (peers.length > 1) {
        const offset =
          (peers.indexOf(edge) - (peers.length - 1) / 2) *
          Math.min(24, 28 / (peers.length - 1));
        const radius = Math.sqrt(23 * 23 - offset * offset);
        if (toSide === "top" || toSide === "bottom") {
          end.x = b.x + offset;
          end.y = b.y + (toSide === "top" ? -radius : radius);
        } else {
          end.y = b.y + offset;
          end.x = b.x - radius;
        }
      }
    }
    const inputIndex =
      b.kind === "sum"
        ? diagram.edges
            .filter((e) => e.to === b.id && sides.get(e.id) === toSide)
            .indexOf(edge)
        : 0;
    const terminalLength = 24 + inputIndex * 24;
    const stubA = {
        x: portPoint(a, fromSide).x + u.x * 24,
        y: start.y + u.y * 24,
      },
      stubB = {
        x: end.x + v.x * terminalLength,
        y: end.y + v.y * terminalLength,
      };
    const occupied = used.filter((_, i) => diagram.edges[i].from !== edge.from);
    const aligned =
      (start.y === end.y &&
        u.x * (end.x - start.x) > 0 &&
        v.x * (start.x - end.x) > 0) ||
      (start.x === end.x &&
        u.y * (end.y - start.y) > 0 &&
        v.y * (start.y - end.y) > 0);
    const otherObstacles = diagram.nodes.filter(
      (n) => n.id !== a.id && n.id !== b.id,
    );
    const blockedDirect = otherObstacles.some((n) =>
      start.y === end.y
        ? start.y > n.y - halfHeight(n) - 8 &&
          start.y < n.y + halfHeight(n) + 8 &&
          Math.max(start.x, end.x) > n.x - halfWidth(n) - 8 &&
          Math.min(start.x, end.x) < n.x + halfWidth(n) + 8
        : start.x > n.x - halfWidth(n) - 8 &&
          start.x < n.x + halfWidth(n) + 8 &&
          Math.max(start.y, end.y) > n.y - halfHeight(n) - 8 &&
          Math.min(start.y, end.y) < n.y + halfHeight(n) + 8,
    );
    const sharedDirect = occupied.some((path) =>
      path.slice(1).some((q, i) => {
        const p = path[i];
        return (
          (start.y === end.y &&
            p.y === q.y &&
            p.y === start.y &&
            Math.min(Math.max(start.x, end.x), Math.max(p.x, q.x)) >
              Math.max(Math.min(start.x, end.x), Math.min(p.x, q.x))) ||
          (start.x === end.x &&
            p.x === q.x &&
            p.x === start.x &&
            Math.min(Math.max(start.y, end.y), Math.max(p.y, q.y)) >
              Math.max(Math.min(start.y, end.y), Math.min(p.y, q.y)))
        );
      }),
    );
    const direct = aligned && !blockedDirect && !sharedDirect;
    const middle = direct
      ? [start, end]
      : findPath(stubA, stubB, obstacles, occupied, start, end);
    // Overlapping user-positioned nodes may have no obstacle-free route. Mark
    // that case visibly instead of implying that automatic routing succeeded.
    const points = simplify([
      start,
      ...(middle ?? [stubA, { x: stubA.x, y: stubB.y }, stubB]),
      end,
    ]);
    used.push(points);
    const sign = {
      x: end.x + v.x * (terminalLength - 4) + (v.y ? 16 : 0),
      y: end.y + v.y * (terminalLength - 4) + (v.x ? -18 : 0),
    };
    return {
      edge,
      points,
      path: points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" "),
      sign,
      toSide,
      obstructed: !middle,
    };
  });
}
export function diagramBounds(diagram: Diagram, routes: RoutedEdge[]) {
  const points = [
    ...diagram.nodes.flatMap((n) => [
      { x: n.x - halfWidth(n) - 40, y: n.y - halfHeight(n) - 35 },
      { x: n.x + halfWidth(n) + 40, y: n.y + halfHeight(n) + 45 },
    ]),
    ...routes.flatMap((r) => [...r.points, r.sign]),
  ];
  if (!points.length) return { x: 0, y: 0, width: 1000, height: 620 };
  const left = Math.min(...points.map((p) => p.x)) - 25,
    top = Math.min(...points.map((p) => p.y)) - 25;
  return {
    x: left,
    y: top,
    width: Math.max(220, Math.max(...points.map((p) => p.x)) - left + 25),
    height: Math.max(160, Math.max(...points.map((p) => p.y)) - top + 25),
  };
}

// Place junction dots at actual forks of routes carrying the same signal,
// rather than guessing a fixed distance from the source port.
export function signalJunctions(
  routes: RoutedEdge[],
  nodes: DiagramNode[],
): Point[] {
  const dots = new Map<string, Point>();
  for (const source of new Set(routes.map((r) => r.edge.from))) {
    const group = routes.filter((r) => r.edge.from === source);
    if (group.length < 2) continue;
    const segments = group.flatMap((r) =>
      r.points.slice(1).map((b, i) => ({ a: r.points[i], b })),
    );
    const candidates = segments.flatMap((s) => [s.a, s.b]);
    for (const s of segments)
      for (const t of segments)
        if (
          s.a.x === s.b.x &&
          t.a.y === t.b.y &&
          s.a.x >= Math.min(t.a.x, t.b.x) &&
          s.a.x <= Math.max(t.a.x, t.b.x) &&
          t.a.y >= Math.min(s.a.y, s.b.y) &&
          t.a.y <= Math.max(s.a.y, s.b.y)
        )
          candidates.push({ x: s.a.x, y: t.a.y });
    for (const p of candidates) {
      if (
        nodes.some(
          (n) =>
            Math.abs(p.x - n.x) < halfWidth(n) + 1 &&
            Math.abs(p.y - n.y) < halfHeight(n) + 1,
        )
      )
        continue;
      const rays = new Set<string>();
      for (const { a, b } of segments) {
        if (
          a.x === b.x &&
          Math.abs(p.x - a.x) < 1e-6 &&
          p.y >= Math.min(a.y, b.y) &&
          p.y <= Math.max(a.y, b.y)
        ) {
          if (Math.min(a.y, b.y) < p.y) rays.add("up");
          if (Math.max(a.y, b.y) > p.y) rays.add("down");
        }
        if (
          a.y === b.y &&
          Math.abs(p.y - a.y) < 1e-6 &&
          p.x >= Math.min(a.x, b.x) &&
          p.x <= Math.max(a.x, b.x)
        ) {
          if (Math.min(a.x, b.x) < p.x) rays.add("left");
          if (Math.max(a.x, b.x) > p.x) rays.add("right");
        }
      }
      if (rays.size >= 3) dots.set(`${p.x},${p.y}`, p);
    }
  }
  return [...dots.values()];
}
