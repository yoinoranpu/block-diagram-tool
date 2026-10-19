import { MathError } from "./errors";
export type Kind = "input" | "output" | "block" | "sum" | "branch";
export type DiagramNode = {
  id: string;
  kind: Kind;
  label: string;
  x: number;
  y: number;
  num: string;
  den: string;
  reversed?: boolean;
};
export type Edge = { id: string; from: string; to: string; sign: 1 | -1 };
export type Diagram = { nodes: DiagramNode[]; edges: Edge[] };
export function validateDiagram(value: unknown): Diagram {
  if (!value || typeof value !== "object")
    throw new MathError("線図データがありません。");
  const d = value as Diagram;
  if (
    !Array.isArray(d.nodes) ||
    !Array.isArray(d.edges) ||
    d.nodes.length > 16 ||
    d.edges.length > 32
  )
    throw new MathError("線図は16要素・32配線までです。");
  const ids = new Set<string>();
  for (const n of d.nodes) {
    if (
      !n ||
      typeof n.id !== "string" ||
      n.id.length > 80 ||
      ids.has(n.id) ||
      !["input", "output", "block", "sum", "branch"].includes(n.kind) ||
      typeof n.label !== "string" ||
      n.label.length > 40 ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y) ||
      n.x < 0 ||
      n.x > 980 ||
      n.y < 0 ||
      n.y > 600 ||
      typeof n.num !== "string" ||
      (n.reversed !== undefined && typeof n.reversed !== "boolean") ||
      typeof n.den !== "string" ||
      n.num.length > 300 ||
      n.den.length > 300
    )
      throw new MathError("要素の形式・座標・文字数が正しくありません。");
    ids.add(n.id);
  }
  const edgeIds = new Set<string>();
  for (const e of d.edges) {
    if (
      !e ||
      typeof e.id !== "string" ||
      edgeIds.has(e.id) ||
      !ids.has(e.from) ||
      !ids.has(e.to) ||
      ![1, -1].includes(e.sign)
    )
      throw new MathError("配線の形式が正しくありません。");
    edgeIds.add(e.id);
  }
  return structuredClone(d);
}

export function node(
  kind: Kind,
  id: string,
  x: number,
  y: number,
  num = "1",
  den = "1",
): DiagramNode {
  return {
    kind,
    id,
    x,
    y,
    num,
    den,
    label: {
      input: "入力",
      output: "出力",
      block:
        id === "h"
          ? "H"
          : id === "j"
            ? "F"
            : /^(i|a|b)[0-9]+$/.test(id)
              ? id.toUpperCase()
              : "G",
      sum: "加算点",
      branch: "分岐点",
    }[kind],
  };
}
export const edge = (from: string, to: string, sign: 1 | -1 = 1): Edge => ({
  id: `${from}-${to}`,
  from,
  to,
  sign,
});
export function example(
  type: "series" | "parallel" | "negative" | "positive" | "multi" = "negative",
): Diagram {
  const u = node("input", "u", 80, 210),
    y = node("output", "y", 880, 210);
  if (type === "series")
    return {
      nodes: [
        u,
        node("block", "g", 340, 210, "K", "s+a"),
        node("block", "h", 610, 210, "1", "s+b"),
        y,
      ],
      edges: [edge("u", "g"), edge("g", "h"), edge("h", "y")],
    };
  if (type === "parallel")
    return {
      nodes: [
        u,
        node("branch", "p", 240, 210),
        node("block", "g", 450, 110, "K", "s+a"),
        node("block", "h", 450, 350, "1", "s+b"),
        node("sum", "q", 700, 210),
        y,
      ],
      edges: [
        edge("u", "p"),
        edge("p", "g"),
        edge("p", "h"),
        edge("g", "q"),
        edge("h", "q"),
        edge("q", "y"),
      ],
    };
  const d: Diagram = {
    nodes: [
      u,
      node("sum", "q", 260, 210),
      node("block", "g", 480, 210, "K", "s+a"),
      node("branch", "p", 700, 210),
      node("block", "h", 480, 400, "1", "1"),
      y,
    ],
    edges: [
      edge("u", "q"),
      edge("q", "g"),
      edge("g", "p"),
      edge("p", "y"),
      edge("p", "h"),
      edge("h", "q", type === "positive" ? 1 : -1),
    ],
  };
  if (type === "multi") {
    d.nodes.find((n) => n.id === "g")!.den = "s^3+a*s^2+b*s+1";
    d.nodes.push(node("block", "j", 480, 70, "b", "s+1"));
    d.edges.push(edge("p", "j"), edge("j", "q", -1));
  }
  d.nodes
    .filter((n) => n.id === "h" || n.id === "j")
    .forEach((n) => {
      n.reversed = true;
    });
  return d;
}
