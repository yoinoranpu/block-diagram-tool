import { describe, it, expect } from "vitest";
import { routeEdges, halfWidth, halfHeight, diagramBounds } from "./routing";
import { example } from "./model";
import { generate } from "./engine";
describe("直角配線と全体表示の範囲", () => {
  it.each(["series", "parallel", "negative", "positive", "multi"] as const)(
    "%s の配線は要素を避けて終点へ到達する",
    (type) => {
      const d = example(type),
        routes = routeEdges(d);
      expect(routes).toHaveLength(d.edges.length);
      for (const r of routes) {
        expect(r.obstructed).toBe(false);
        expect(r.points.length).toBeGreaterThan(1);
        for (let i = 1; i < r.points.length; i++) {
          const a = r.points[i - 1],
            b = r.points[i];
          expect(a.x === b.x || a.y === b.y).toBe(true);
          for (const n of d.nodes.filter(
            (n) => n.id !== r.edge.from && n.id !== r.edge.to,
          )) {
            const intersects =
              a.x === b.x
                ? a.x > n.x - halfWidth(n) &&
                  a.x < n.x + halfWidth(n) &&
                  Math.max(a.y, b.y) > n.y - halfHeight(n) &&
                  Math.min(a.y, b.y) < n.y + halfHeight(n)
                : a.y > n.y - halfHeight(n) &&
                  a.y < n.y + halfHeight(n) &&
                  Math.max(a.x, b.x) > n.x - halfWidth(n) &&
                  Math.min(a.x, b.x) < n.x + halfWidth(n);
            expect(intersects, `${r.edge.id} intersects ${n.id}`).toBe(false);
          }
        }
      }
    },
  );
  it("積分器の帰還は別々の入力方向に分かれ、全配線が表示範囲に入る", () => {
    const d = generate("K", "(s+a)*(s+b)").candidates.find(
      (c) => c.title === "積分器による構成",
    )!.diagram;
    const routes = routeEdges(d),
      incoming = routes.filter((r) => r.edge.to === "q");
    expect(incoming.filter((r) => r.toSide === "top")).toHaveLength(2);
    expect(
      new Set(
        incoming.map((r) => r.points.at(-1)!.x + "," + r.points.at(-1)!.y),
      ).size,
    ).toBe(3);
    expect(routes.every((r) => !r.obstructed)).toBe(true);
    const box = diagramBounds(d, routes);
    for (const p of routes.flatMap((r) => r.points)) {
      expect(
        p.x >= box.x &&
          p.x <= box.x + box.width &&
          p.y >= box.y &&
          p.y <= box.y + box.height,
      ).toBe(true);
    }
  });
});

it("3次系のすべての生成パターンで要素が重ならず配線できる", () => {
  const result = generate("s^2+2*s+3", "s^3+a*s^2+b*s+1");
  expect(result.candidates.some((c) => c.title === "積分器による構成")).toBe(
    true,
  );
  for (const c of result.candidates) {
    for (let i = 0; i < c.diagram.nodes.length; i++)
      for (let j = i + 1; j < c.diagram.nodes.length; j++) {
        const a = c.diagram.nodes[i],
          b = c.diagram.nodes[j];
        expect(
          Math.abs(a.x - b.x) >= halfWidth(a) + halfWidth(b) + 10 ||
            Math.abs(a.y - b.y) >= halfHeight(a) + halfHeight(b) + 10,
          `${c.title}: ${a.id},${b.id}`,
        ).toBe(true);
      }
    expect(
      routeEdges(c.diagram).every((r) => !r.obstructed),
      c.title,
    ).toBe(true);
  }
});

it.each([
  ["parallel", 4],
  ["negative", 2],
  ["positive", 2],
] as const)("%s は必要な曲がりだけにする", (kind, maxBends) => {
  const routes = routeEdges(example(kind));
  expect(
    routes.reduce((n, r) => n + Math.max(0, r.points.length - 2), 0),
  ).toBeLessThanOrEqual(maxBends);
  for (const r of routes)
    for (let i = 2; i < r.points.length; i++) {
      const a = r.points[i - 2],
        b = r.points[i - 1],
        c = r.points[i];
      expect((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)).toBe(
        false,
      );
    }
});

it.each(["parallel", "negative", "positive"] as const)(
  "%s の要素を動かしても配線がブロックを避ける",
  (kind) => {
    const d = example(kind);
    d.nodes = d.nodes.map((n) =>
      n.kind === "branch"
        ? { ...n, x: n.x - 20, y: n.y + 30 }
        : n.kind === "block"
          ? { ...n, x: n.x - 20, y: n.y + 20 }
          : n,
    );
    const routes = routeEdges(d);
    expect(routes.every((r) => !r.obstructed)).toBe(true);
    for (const r of routes)
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1],
          b = r.points[i];
        for (const n of d.nodes.filter(
          (n) => n.id !== r.edge.from && n.id !== r.edge.to,
        ))
          expect(
            a.x === b.x
              ? a.x > n.x - halfWidth(n) &&
                  a.x < n.x + halfWidth(n) &&
                  Math.max(a.y, b.y) > n.y - halfHeight(n) &&
                  Math.min(a.y, b.y) < n.y + halfHeight(n)
              : a.y > n.y - halfHeight(n) &&
                  a.y < n.y + halfHeight(n) &&
                  Math.max(a.x, b.x) > n.x - halfWidth(n) &&
                  Math.min(a.x, b.x) < n.x + halfWidth(n),
          ).toBe(false);
      }
  },
);
