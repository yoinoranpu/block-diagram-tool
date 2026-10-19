import { it, expect } from "vitest";
import { arrangeDiagram, inspectWiring, traceSignal, snap } from "./graphTools";
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
