import { stateSignalLabel } from "./stateNotation";
import { stateConnectedGraph, type StateDiagramOptions } from "./StateConnectedGraph";
import { layoutStateGraph } from "./stateConnectedLayout";
import type { StateSpaceInput } from "./stateSpaceModel";
import { validateDiagram, type Diagram, type DiagramNode } from "./model";
export function editStateDiagram(data: StateSpaceInput, options: StateDiagramOptions = {}): Diagram {
  const full = stateConnectedGraph(data, options);
  const reached = new Set(["u"]);
  for (let i = 0; i < full.nodes.length; i++)
    for (const e of full.edges) if (reached.has(e.from)) reached.add(e.to);
  // Unforced states with zero initial conditions contribute zero to the output.
  if (!reached.has("y")) return {
    nodes: [
      { id: "u", kind: "input", label: "u", x: 100, y: 180, num: "1", den: "1" },
      { id: "zero", kind: "block", label: "G", x: 400, y: 180, num: "0", den: "1" },
      { id: "y", kind: "output", label: "y", x: 700, y: 180, num: "1", den: "1" },
    ], edges: [{ id: "e0", from: "u", to: "zero", sign: 1 }, { id: "e1", from: "zero", to: "y", sign: 1 }],
  };
  const model = {
    nodes: full.nodes.filter((n) => reached.has(n.id)),
    edges: full.edges.filter((e) => reached.has(e.from) && reached.has(e.to)),
  };
  const layout = layoutStateGraph(model);
  return validateDiagram({
    nodes: model.nodes.map((n) => {
      const p = layout.children.find((p) => p.id === n.id)!;
      return { id: n.id, label: stateSignalLabel(n.label),
        kind: n.kind === "gain" || n.kind === "integrator" ? "block" : n.kind,
        x: p.x + p.width / 2, y: p.y + p.height / 2,
        num: n.value ?? "1", den: n.kind === "integrator" ? "s" : "1",
        reversed: p.ports.find((port) => port.id === `${n.id}-out`)?.x === 0,
      } as DiagramNode;
    }),
    edges: model.edges.map((e) => ({ ...e, sign: 1 as const })),
  });
}
