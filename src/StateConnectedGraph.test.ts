import { it, expect } from "vitest";
import { layoutStateGraph } from "./stateConnectedLayout";
import { stateConnectedGraph } from "./StateConnectedGraph";
import type { StateSpaceInput } from "./stateSpaceModel";
const cases: StateSpaceInput[] = [
  { A: [["-a"]], B: ["K"], C: ["1"], D: "0" },
  {
    A: [
      ["0", "1"],
      ["-b", "-a"],
    ],
    B: ["0", "K"],
    C: ["1", "0"],
    D: "0",
  },
  {
    A: [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
    ],
    B: ["1", "1", "1"],
    C: ["1", "1", "1"],
    D: "1",
  },
  {
    A: [
      ["0", "0"],
      ["0", "0"],
    ],
    B: ["0", "0"],
    C: ["0", "0"],
    D: "0",
  },
];
it.each(cases)(
  "行列のすべての非ゼロ成分を配線し、配置後も接続と図形の分離を保つ",
  async (data) => {
    const model = stateConnectedGraph(data);
    const nonzero = [...data.A.flat(), ...data.B, ...data.C, data.D].filter(
      (v) => v !== "0",
    ).length;
    expect(model.nodes.filter((n) => n.kind === "gain")).toHaveLength(nonzero);
    expect(model.edges).toHaveLength(nonzero * 2 + data.A.length + 1);
    const out = layoutStateGraph(model);
    expect(out.edges).toHaveLength(model.edges.length);
    const baseline = out.children.find((n) => n.id === "u")!;
    for (const node of out.children)
      expect(node.y + node.height / 2).toBeGreaterThanOrEqual(baseline.y + baseline.height / 2);

    for (const node of out.children!) {
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
      for (const other of out.children!.filter((n) => n.id !== node.id)) {
        const overlaps =
          node.x! < other.x! + other.width! &&
          node.x! + node.width! > other.x! &&
          node.y! < other.y! + other.height! &&
          node.y! + node.height! > other.y!;
        expect(overlaps, `${node.id} / ${other.id}`).toBe(false);
      }
    }
    for (let i = 0; i < out.edges!.length; i++)
      for (let j = i + 1; j < out.edges!.length; j++) {
        const a = out.edges![i],
          b = out.edges![j];
        if (
          model.edges.find((e) => e.id === a.id)!.from ===
          model.edges.find((e) => e.id === b.id)!.from
        )
          continue;
        for (const as of a.sections!)
          for (const bs of b.sections!) {
            const aa = [as.startPoint, ...(as.bendPoints ?? []), as.endPoint],
              bb = [bs.startPoint, ...(bs.bendPoints ?? []), bs.endPoint];
            for (let k = 1; k < aa.length; k++)
              for (let l = 1; l < bb.length; l++) {
                const p = aa[k - 1],
                  q = aa[k],
                  r = bb[l - 1],
                  s = bb[l];
                const vertical =
                  Math.abs(p.x - q.x) < 0.01 &&
                  Math.abs(r.x - s.x) < 0.01 &&
                  Math.abs(p.x - r.x) < 0.01;
                const horizontal =
                  Math.abs(p.y - q.y) < 0.01 &&
                  Math.abs(r.y - s.y) < 0.01 &&
                  Math.abs(p.y - r.y) < 0.01;
                const overlap = vertical
                  ? Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y)) -
                    Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y))
                  : horizontal
                    ? Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x)) -
                      Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x))
                    : 0;
                expect(overlap, `${a.id} overlaps ${b.id}`).toBeLessThanOrEqual(
                  1,
                );
              }
          }
      }
    for (const edge of out.edges!) {
      expect(edge.sections?.length).toBeGreaterThan(0);
      for (const section of edge.sections!) {
        const points = [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ];
        for (const p of points)
          expect(p.y).toBeGreaterThanOrEqual(baseline.y + baseline.height / 2 - 1e-8);
        for (let i = 1; i < points.length; i++)
          expect(
            Math.abs(points[i].x - points[i - 1].x) < 0.01 ||
              Math.abs(points[i].y - points[i - 1].y) < 0.01,
          ).toBe(true);
      }
    }
  },
  15000,
);

it("主経路を一直線に保ち、Dがあっても積分器を通る経路を優先する", () => {
  const model = stateConnectedGraph({
    A: [
      ["0", "1"],
      ["-b", "-a"],
    ],
    B: ["0", "K"],
    C: ["1", "0"],
    D: "1",
  });
  const layout = layoutStateGraph(model);
  expect(layout.main).toContain("x1");
  expect(layout.main).toContain("x2");
  const y = layout.children.find((n) => n.id === "u")!.y + 24;
  for (const id of layout.main) {
    const n = layout.children.find((n) => n.id === id)!;
    expect(n.y + n.height / 2).toBe(y);
  }
  for (let i = 1; i < layout.main.length; i++) {
    const edge = model.edges.find(
      (e) => e.from === layout.main[i - 1] && e.to === layout.main[i],
    )!;
    const route = layout.edges.find((e) => e.id === edge.id)!.sections[0];
    expect(route.bendPoints).toHaveLength(0);
    expect(route.startPoint.y).toBe(route.endPoint.y);
  }
});

it.each([false, true])("長い枝の幅を先に確保し、接続先を通り越さない（帰還=%s）", (feedback) => {
  const nodes = [
    { id: "u", kind: "input" as const, label: "u" },
    { id: "i", kind: "integrator" as const, label: "i" },
    { id: "out", kind: "sum" as const, label: "out" },
    { id: "y", kind: "output" as const, label: "y" },
    ...["a", "b", "c", "d"].map((id) => ({ id, kind: "gain" as const, label: id })),
  ];
  const from = feedback ? "out" : "u", to = feedback ? "i" : "out";
  const pairs = [["u", "i"], ["i", "out"], ["out", "y"],
    [from, "a"], ["a", "b"], ["b", "c"], ["c", "d"], ["d", to]];
  const layout = layoutStateGraph({ nodes, edges: pairs.map(([from, to], i) =>
    ({ id: `e${i}`, from, to, signal: from })) });
  const center = (id: string) => {
    const n = layout.children.find((n) => n.id === id)!;
    return n.x + n.width / 2;
  };
  const direction = feedback ? -1 : 1;
  const path = [from, "a", "b", "c", "d", to];
  for (let i = 1; i < path.length; i++)
    expect(direction * (center(path[i]) - center(path[i - 1]))).toBeGreaterThanOrEqual(100);
  expect(layout.width).toBeGreaterThan(1200);
  for (const id of ["a", "b", "c"]) {
    const edge = layout.edges.find((e) => e.id === `e${pairs.findIndex(([a]) => a === id)}`)!;
    expect(edge.sections[0].bendPoints).toHaveLength(0);
  }
});

it.each([
  [2, 2, false], [2, 2, true],
  [3, 1, false], [3, 1, true],
  [1, 3, false], [1, 3, true],
] as const)("主経路%d個・枝%d個を整列する（帰還=%s）", (count, sideCount, feedback) => {
  const forward = Array.from({ length: count }, (_, i) => `m${i}`);
  const side = Array.from({ length: sideCount }, (_, i) => `h${i}`);
  const nodes = [
    { id: "u", kind: "input" as const, label: "u" },
    { id: "q", kind: "sum" as const, label: "q" },
    ...forward.map((id) => ({ id, kind: "integrator" as const, label: id })),
    { id: "r", kind: "sum" as const, label: "r" },
    { id: "y", kind: "output" as const, label: "y" },
    ...side.map((id) => ({ id, kind: "gain" as const, label: id })),
  ];
  const paths = [["u", "q", ...forward, "r", "y"],
    feedback ? ["r", ...side, "q"] : ["q", ...side, "r"]];
  const edges = paths.flatMap((path, p) => path.slice(1).map((to, i) =>
    ({ id: `${p}-${i}`, from: path[i], to, signal: path[i] })));
  const layout = layoutStateGraph({ nodes, edges });
  const point = (id: string) => {
    const n = layout.children.find((n) => n.id === id)!;
    return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
  };
  const mainX = forward.map((id) => point(id).x);
  const sideX = side.map((id) => point(id).x).sort((a, b) => a - b);
  if (count === sideCount) expect(sideX).toEqual(mainX);
  else expect((sideX[0] + sideX.at(-1)!) / 2)
    .toBeCloseTo((mainX[0] + mainX.at(-1)!) / 2);
  for (const id of ["u", "q", ...forward, "r", "y"])
    expect(point(id).y).toBe(point("u").y);
  for (const id of side) {
    expect(point(id).y).toBe(point(side[0]).y);
    expect(point(id).y).toBeGreaterThan(point("u").y);
    const output = layout.children.find((n) => n.id === id)!.ports.find((p) => p.id === `${id}-out`)!;
    expect(output.x === 0).toBe(feedback);
  }
});

it.each([2, 3])("%d状態の並列経路と自己帰還を列にそろえ、U字の帰還に余計な折返しを作らない", (count) => {
  const model = stateConnectedGraph({
    A: Array.from({ length: count }, (_, i) =>
      Array.from({ length: count }, (_, j) => i === j ? `${i + 2}` : "0")),
    B: Array.from({ length: count }, (_, i) => i === 0 ? "2" : "-2"),
    C: Array(count).fill("1"), D: "0",
  });
  const layout = layoutStateGraph(model);
  const center = (id: string) => {
    const n = layout.children.find((n) => n.id === id)!;
    return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
  };
  for (let i = 1; i <= count; i++) {
    const state = center(`x${i}`), loop = center(`A${i}${i}`);
    expect(loop.x).toBe(state.x);
    expect(loop.y).toBeGreaterThan(state.y);
    for (const [id, reference] of [[`B${i}`, "B1"], [`sum${i - 1}`, "sum0"], [`x${i}`, "x1"], [`C${i}`, "C1"]]) {
      expect(center(id).x).toBe(center(reference).x);
      expect(center(id).y).toBe(state.y);
    }
    if (i < count) expect(loop.y).toBeLessThan(center(`B${i + 1}`).y);
    const route = (from: string, to: string) => {
      const id = model.edges.find((e) => e.from === from && e.to === to)!.id;
      const s = layout.edges.find((e) => e.id === id)!.sections[0];
      return [s.startPoint, ...s.bendPoints, s.endPoint];
    };
    const down = route(`x${i}`, `A${i}${i}`);
    const back = route(`A${i}${i}`, `sum${i - 1}`);
    expect(down.length - 2 + back.length - 2).toBeLessThanOrEqual(3);
    for (let j = 1; j < down.length; j++) expect(down[j].y).toBeGreaterThanOrEqual(down[j - 1].y);
    for (let j = 1; j < back.length; j++) {
      expect(back[j].x).toBeLessThanOrEqual(back[j - 1].x);
      expect(back[j].y).toBeLessThanOrEqual(back[j - 1].y);
    }
    const input = route("u", `B${i}`);
    expect(input.length - 2).toBeLessThanOrEqual(2);
    for (let j = 1; j < input.length; j++) {
      expect(input[j].x).toBeGreaterThanOrEqual(input[j - 1].x);
      expect(input[j].y).toBeGreaterThanOrEqual(input[j - 1].y);
    }
  }
});
