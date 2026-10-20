import { layoutStateGraph } from "./stateConnectedLayout";
import type { StateGraph } from "./StateConnectedGraph";
self.onmessage = (event: MessageEvent<StateGraph>) => {
  try {
    self.postMessage({ graph: layoutStateGraph(event.data) });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
