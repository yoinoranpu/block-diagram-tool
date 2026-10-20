import type { StateSpaceInput } from "./stateSpaceModel";
export type StateNode = {
  id: string;
  kind: "gain" | "sum" | "integrator" | "input" | "output" | "branch";
  label: string;
  value?: string;
};
export type StateEdge = {
  id: string;
  from: string;
  to: string;
  signal: string;
};
export type StateGraph = { nodes: StateNode[]; edges: StateEdge[] };
export type LayoutPoint = { x: number; y: number };
export type StateLayout = {
  width: number;
  height: number;
  main: string[];
  children: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    ports: {
      id: string;
      x: number;
      y: number;
      signX?: number;
      signY?: number;
    }[];
  }[];
  edges: {
    id: string;
    sections: {
      startPoint: LayoutPoint;
      bendPoints: LayoutPoint[];
      endPoint: LayoutPoint;
    }[];
    junctionPoints: LayoutPoint[];
  }[];
};
export function stateConnectedGraph(data: StateSpaceInput): StateGraph {
  const nodes: StateNode[] = [
      { id: "u", kind: "input", label: "u" },
      { id: "y", kind: "output", label: "y" },
      { id: "out", kind: "sum", label: "出力加算点" },
    ],
    edges: StateEdge[] = [];
  const connect = (from: string, to: string, signal: string) =>
    edges.push({ id: `edge-${edges.length}`, from, to, signal });
  for (let i = 0; i < data.A.length; i++) {
    nodes.push(
      { id: `sum${i}`, kind: "sum", label: `状態${i + 1}の加算点` },
      { id: `x${i + 1}`, kind: "integrator", label: `x${i + 1}` },
    );
    connect(`sum${i}`, `x${i + 1}`, `dx${i + 1}`);
  }
  function gain(id: string, from: string, to: string, value: string) {
    nodes.push({ id, kind: "gain", label: id, value });
    connect(from, id, from);
    connect(id, to, id);
  }
  data.A.forEach((row, i) =>
    row.forEach((v, j) => gain(`A${i + 1}${j + 1}`, `x${j + 1}`, `sum${i}`, v)),
  );
  data.B.forEach((v, i) => gain(`B${i + 1}`, "u", `sum${i}`, v));
  data.C.forEach((v, i) => gain(`C${i + 1}`, `x${i + 1}`, "out", v));
  gain("D", "u", "out", data.D);
  connect("out", "y", "y");
  return { nodes, edges };
}
