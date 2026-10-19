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
import { solve, equal } from "./engine";
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
