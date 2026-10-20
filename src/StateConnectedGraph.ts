import type { ElkNode, ElkExtendedEdge } from "elkjs";
import type { StateSpaceInput } from "./stateSpaceModel";
export type StateNode = {
  id: string;
  kind: "gain" | "sum" | "integrator" | "input" | "output";
  label: string;
  value?: string;
};
export type StateEdge = {
  id: string;
  from: string;
  to: string;
  signal: string;
};
export function stateConnectedGraph(data: StateSpaceInput) {
  const n = data.A.length;
  const nodes: StateNode[] = [
    { id: "u", kind: "input", label: "u" },
    { id: "y", kind: "output", label: "y" },
    { id: "out", kind: "sum", label: "出力加算点" },
  ];
  const edges: StateEdge[] = [];
  const connect = (from: string, to: string, signal: string) =>
    edges.push({ id: `edge-${edges.length}`, from, to, signal });
  for (let i = 0; i < n; i++) {
    nodes.push(
      { id: `sum${i}`, kind: "sum", label: `状態${i + 1}の加算点` },
      { id: `x${i + 1}`, kind: "integrator", label: `x${i + 1}` },
    );
    connect(`sum${i}`, `x${i + 1}`, `dx${i + 1}`);
  }
  function gain(id: string, from: string, to: string, value: string) {
    if (value === "0") return;
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
  const children: ElkNode[] = nodes.map((node) => {
    const incoming = edges.filter((e) => e.to === node.id);
    const sum = node.kind === "sum";
    const width = sum
        ? 64
        : node.kind === "gain"
          ? 150
          : node.kind === "integrator"
            ? 110
            : 60,
      height = sum
        ? 64
        : node.kind === "gain"
          ? 54
          : node.kind === "integrator"
            ? 90
            : 60;
    const inPorts = incoming.map((edge, i) => ({
      id: `${edge.id}-in`,
      width: 0,
      height: 0,
      x: sum
        ? 32 -
          Math.sqrt(
            32 * 32 - (((i + 1) * height) / (incoming.length + 1) - 32) ** 2,
          )
        : 0,
      y: sum
        ? ((i + 1) * height) / (incoming.length + 1)
        : node.kind === "integrator"
          ? 30
          : height / 2,
      layoutOptions: { "elk.port.side": "WEST" },
    }));
    return {
      id: node.id,
      width,
      height,
      ports: [
        ...inPorts,
        {
          id: `${node.id}-out`,
          x: width,
          y: node.kind === "integrator" ? 30 : height / 2,
          width: 0,
          height: 0,
          layoutOptions: { "elk.port.side": "EAST" },
        },
      ],
      layoutOptions: {
        "elk.portConstraints": "FIXED_POS",
        ...(node.kind === "input"
          ? { "elk.layered.layering.layerConstraint": "FIRST_SEPARATE" }
          : node.kind === "output"
            ? { "elk.layered.layering.layerConstraint": "LAST_SEPARATE" }
            : {}),
      },
    };
  });
  const elkEdges: ElkExtendedEdge[] = edges.map((e) => ({
    id: e.id,
    sources: [`${e.from}-out`],
    targets: [`${e.id}-in`],
    layoutOptions: {
      "elk.layered.priority.direction": (() => {
        const a =
          e.from.match(/^A([123])([123])$/) ?? e.to.match(/^A([123])([123])$/);
        return a && Number(a[2]) <= Number(a[1]) ? "1" : "100";
      })(),
    },
  }));
  // Order the acyclic forward path first; only return edges from feedback gains
  // may be reversed by the layout engine (the signal direction itself is unchanged).
  const forward = edges.filter((e) => {
    const a = e.from.match(/^A([123])([123])$/);
    return !(a && Number(a[2]) <= Number(a[1]));
  });
  const ordered: string[] = [];
  const remaining = new Set(nodes.map((n) => n.id));
  while (remaining.size) {
    const ready = nodes.filter(
      (n) =>
        remaining.has(n.id) &&
        !forward.some((e) => e.to === n.id && remaining.has(e.from)),
    );
    if (!ready.length) break;
    for (const node of ready) {
      ordered.push(node.id);
      remaining.delete(node.id);
    }
  }
  children.sort((a, b) => ordered.indexOf(a.id) - ordered.indexOf(b.id));
  const graph: ElkNode = {
    id: "state-root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.layered.cycleBreaking.strategy": "MODEL_ORDER",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "44",
      "elk.layered.spacing.nodeNodeBetweenLayers": "70",
      "elk.spacing.edgeEdge": "16",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "16",
      "elk.layered.feedbackEdges": "true",
      "elk.randomSeed": "1",
      "elk.padding": "[top=40,left=40,bottom=40,right=40]",
    },
    children,
    edges: elkEdges,
  };
  return { graph, nodes, edges };
}
