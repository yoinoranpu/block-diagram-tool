import { stateSpace, type StateSpaceInput } from "./stateSpace";
import {
  solve,
  generate,
  transfer,
  fraction,
  equal,
  latex,
  type Diagram,
} from "./engine";
self.onmessage = (
  event: MessageEvent<{
    state: StateSpaceInput;
    id: number;
    kind: string;
    diagram: Diagram;
    num: string;
    den: string;
    otherNum: string;
    otherDen: string;
  }>,
) => {
  const { id, kind, diagram, num, den, otherNum, otherDen } = event.data;
  try {
    const value =
      kind === "stateSpace"
        ? stateSpace(event.data.state)
        : kind === "solve"
          ? solve(diagram)
          : kind === "generate"
            ? generate(num, den)
            : (() => {
                const a = fraction(num, den),
                  b = transfer(otherNum, otherDen);
                return {
                  equal: equal(a, b),
                  tex: latex(b),
                  conditions: b.conditions ?? [],
                };
              })();
    self.postMessage({ id, value });
  } catch (error) {
    self.postMessage({
      id,
      nodeId: (error as { nodeId?: string }).nodeId,
      error:
        error instanceof Error
          ? error.message
          : "計算できませんでした。式を確認してください。",
    });
  }
};
