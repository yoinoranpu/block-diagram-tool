import { routeEdges } from "./routing";
import { it, expect } from "vitest";
import {
  arrangeDiagram,
  inspectWiring,
  traceSignal,
  snap,
  insertOnEdge,
} from "./graphTools";
import { example } from "./model";
import { solve, equal, generate } from "./engine";
it("未接続と二重接続、出力につながらない要素を検出", () => {
  const d = example("series");
  expect(inspectWiring(d)).toHaveLength(0);
  d.edges = d.edges.filter((e) => e.to !== "h");
  expect(inspectWiring(d).some((i) => i.nodeId === "h")).toBe(true);
  d.edges.push({ id: "double", from: "u", to: "g", sign: 1 });
  expect(inspectWiring(d).some((i) => i.message.includes("二重接続"))).toBe(
    true,
  );
});
it.each(["series", "parallel", "negative", "multi"] as const)(
  "%s は整列しても計算結果・配線を保つ",
  (kind) => {
    const d = example(kind),
      next = arrangeDiagram(d);
    expect(next.edges).toEqual(d.edges);
    expect(routeEdges(next).every((r) => !r.obstructed)).toBe(true);
    expect(equal(solve(next, false).value, solve(d, false).value)).toBe(true);
    expect(inspectWiring(next)).toHaveLength(0);
  },
);
it("選んだ経路の入力元・出力先と経路の線を特定", () => {
  const d = example("negative"),
    trace = traceSignal(d, "p-h");
  expect(trace.label).toContain("分岐点 → H");
  expect(trace.edges.has("p-h")).toBe(true);
  expect(trace.nodes.has("u")).toBe(true);
  expect(trace.nodes.has("y")).toBe(true);
  expect(snap(243)).toBe(240);
});

it.each(["block", "branch", "sum"] as const)(
  "帰還線への%s挿入は符号と伝達関数を保つ",
  (kind) => {
    const d = example("negative");
    const edge = d.edges.find((e) => e.sign === -1)!;
    const next = insertOnEdge(d, edge.id, kind);
    expect(next.nodes).toHaveLength(d.nodes.length + 1);
    expect(next.edges).toHaveLength(d.edges.length + 1);
    expect(next.edges.find((e) => e.id === edge.id)?.sign).toBe(-1);
    expect(inspectWiring(next)).toHaveLength(0);
    expect(equal(solve(next, false).value, solve(d, false).value)).toBe(true);
  },
);
it("整列は乱れた座標に影響されず、帰還ブロックを戻り方向に配置する", () => {
  const d = example("negative");
  const clean = arrangeDiagram(d);
  const messy = arrangeDiagram({
    ...d,
    nodes: d.nodes.map((n, i) => ({ ...n, x: 900 - i * 30, y: 100 + i * 25 })),
  });
  expect(messy).toEqual(clean);
  expect(clean.nodes.find((n) => n.id === "h")?.reversed).toBe(true);
  expect(clean.nodes.find((n) => n.id === "h")!.y).toBeGreaterThan(
    clean.nodes.find((n) => n.id === "g")!.y,
  );
});

it.each([
  ["K", "(s+a)*(s+b)"],
  ["s^2+2*s+3", "s^3+3*s^2+2*s+1"],
  ["s^3+2*s+1", "s^3+3*s^2+2*s+1"],
])(
  "積分器線図は整列を繰り返しても連鎖と出力の位置・計算を保つ：%s",
  (num, den) => {
    const original = generate(num, den).candidates.find(
      (c) => c.title === "積分器による構成",
    )!.diagram;
    const scrambled = {
      ...original,
      nodes: original.nodes.map((n, i) => ({
        ...n,
        x: 80 + (i % 5) * 170,
        y: 80 + Math.floor(i / 5) * 160,
      })),
    };
    const arranged = arrangeDiagram(scrambled);
    expect(arrangeDiagram(arranged)).toEqual(arranged);
    expect(arranged.nodes.find((n) => n.id === "y")!.x).toBeGreaterThan(
      arranged.nodes.find((n) => n.id === "i1")!.x,
    );
    expect(arranged.nodes.find((n) => n.id === "z")!.x).toBeGreaterThan(
      arranged.nodes.find((n) => n.id === "i1")!.x,
    );
    expect(arranged.edges).toEqual(original.edges);
    expect(
      equal(solve(arranged, false).value, solve(original, false).value),
    ).toBe(true);
    expect(routeEdges(arranged).every((r) => !r.obstructed)).toBe(true);
  },
);
