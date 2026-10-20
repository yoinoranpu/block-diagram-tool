import { it, expect } from "vitest";
import ELK from "elkjs/lib/elk.bundled.js";
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
    const out = await new ELK().layout(model.graph);
    expect(out.edges).toHaveLength(model.edges.length);
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
