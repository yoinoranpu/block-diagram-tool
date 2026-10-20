import { useEffect, useMemo, useRef, useState, useId } from "react";
import type { StateLayout, LayoutPoint } from "./StateConnectedGraph";
import type { StateSpaceInput } from "./stateSpaceModel";
import { stateConnectedGraph } from "./StateConnectedGraph";
import { stateSignalLabel } from "./stateNotation";
import { downloadDiagram } from "./exportDiagram";
function simplify(points: LayoutPoint[]) {
  const result: LayoutPoint[] = [];
  for (const p of points) {
    if (result.at(-1)?.x === p.x && result.at(-1)?.y === p.y) continue;
    while (result.length >= 2) {
      const a = result[result.length - 2],
        b = result[result.length - 1];
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))
        result.pop();
      else break;
    }
    result.push(p);
  }
  return result;
}
export function StateConnectedDiagram({
  data,
  onFallback,
}: {
  data: StateSpaceInput;
  onFallback: () => void;
}) {
  const key = JSON.stringify(data),
    model = useMemo(() => stateConnectedGraph(data), [key]);
  const [layout, setLayout] = useState<{ key: string; graph: StateLayout }>(),
    [error, setError] = useState(""),
    [scale, setScale] = useState(1),
    [exportError, setExportError] = useState("");
  const svg = useRef<SVGSVGElement>(null),
    frame = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(600);
  const id = useId().replace(/:/g, "");
  useEffect(() => {
    setError("");
    setScale(1);
    const worker = new Worker(
      new URL("./stateLayout.worker.ts", import.meta.url),
      { type: "module" },
    );
    const timeout = setTimeout(() => {
      worker.terminate();
      setError("配置を15秒で中止しました。ラベル接続表示をご利用ください。");
    }, 15000);
    worker.onmessage = (e) => {
      clearTimeout(timeout);
      if (e.data.error) setError(e.data.error);
      else setLayout({ key, graph: e.data.graph });
      worker.terminate();
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      setError("配置を完了できませんでした。ラベル接続表示をご利用ください。");
      worker.terminate();
    };
    worker.postMessage(model);
    return () => {
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [key]);
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width) setWidth(entry.contentRect.width);
    });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [layout?.key]);
  const graph = layout?.key === key ? layout.graph : undefined;
  if (error)
    return (
      <div role="alert" className="canvas-warning">
        {error}
        <button onClick={onFallback}>ラベル接続へ切替</button>
      </div>
    );
  if (!graph)
    return <p role="status">すべての線をつなぐ配置を計算しています…</p>;
  const bounds = {
    x: 0,
    y: 0,
    width: graph.width ?? 900,
    height: graph.height ?? 600,
  };
  // Fit both dimensions within the preview; zoom only changes the drawing, never the page.
  const fit = Math.min(
    1,
    Math.max(240, window.innerHeight * 0.6) /
      ((bounds.height * width) / bounds.width),
  );
  const renderedWidth = Math.max(1, width * fit * scale);

  async function save(format: "svg" | "png") {
    try {
      setExportError("");
      await downloadDiagram(svg.current!, bounds, format);
    } catch (e) {
      setExportError((e as Error).message);
    }
  }
  const positions = new Map(graph.children?.map((n) => [n.id, n]));
  return (
    <div className="state-connected">
      <p className="field-hint">
        すべての信号を線で接続しています。黒丸は分岐、黒丸のない交差は未接続です。状態信号は下付きのx₁・x₂・x₃で表します。係数ブロック内の負号も計算に含みます。
      </p>
      <div className="state-diagram-tools">
        <button
          disabled={scale <= 1}
          onClick={() => setScale(Math.max(1, scale / 1.4))}
        >
          縮小
        </button>
        <button onClick={() => setScale(Math.min(8, scale * 1.4))}>拡大</button>
        <button onClick={() => setScale(1)}>全体表示</button>
        <button onClick={() => save("png")}>PNG保存</button>
        <button onClick={() => save("svg")}>SVG保存</button>
      </div>
      {exportError && <p role="alert">{exportError}</p>}
      <div className="state-connected-scroll" ref={frame}>
        <svg
          ref={svg}
          viewBox={`0 0 ${bounds.width} ${bounds.height}`}
          width={renderedWidth}
          height={(renderedWidth * bounds.height) / bounds.width}
          role="img"
          aria-label="全信号を線で接続した状態変数線図"
        >
          <defs>
            <marker
              id={`connected-${id}`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0L8 4L0 8" fill="#53677f" />
            </marker>
          </defs>
          {graph.edges?.map((e) => (
            <g key={e.id} className="state-connected-edge">
              <title>
                {stateSignalLabel(
                  model.edges.find((v) => v.id === e.id)!.signal,
                )}
              </title>
              {e.sections?.map((s, i) => {
                const points = simplify([
                  s.startPoint,
                  ...(s.bendPoints ?? []),
                  s.endPoint,
                ]);
                const d = points
                  .map((p, j) => `${j ? "L" : "M"}${p.x} ${p.y}`)
                  .join(" ");
                return (
                  <g key={i}>
                    <path d={d} className="wire-underlay" />
                    <path
                      d={d}
                      className="wire"
                      markerEnd={`url(#connected-${id})`}
                    />
                  </g>
                );
              })}
            </g>
          ))}
          {graph.edges
            ?.flatMap((e) => e.junctionPoints ?? [])
            .map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill="#334d68" />
            ))}
          {model.nodes.map((node) => {
            const p = positions.get(node.id)!;
            const w = p.width!,
              h = p.height!;
            return (
              <g
                key={node.id}
                transform={`translate(${p.x},${p.y})`}
                className="state-connected-node"
                data-node-id={node.id}
              >
                <title>
                  {stateSignalLabel(node.label)}
                  {node.value ? `: ${node.value}` : ""}
                </title>
                {node.kind === "sum" ? (
                  <>
                    <circle
                      cx={w / 2}
                      cy={h / 2}
                      r={w / 2}
                      className="node-body"
                    />
                    {!model.edges.some((e) => e.to === node.id) && (
                      <text
                        x={w / 2}
                        y={h / 2 + 6}
                        textAnchor="middle"
                        className="node-label"
                      >
                        0
                      </text>
                    )}
                    {p.ports
                      ?.filter((port) => port.id.endsWith("-in"))
                      .map((port) => (
                        <text
                          key={port.id}
                          x={port.signX ?? (port.x ?? 0) - 9}
                          y={port.signY ?? (port.y ?? 0) - 6}
                          textAnchor="middle"
                          fontSize="11"
                        >
                          +
                        </text>
                      ))}
                  </>
                ) : node.kind === "integrator" ? (
                  <>
                    <rect
                      x="0"
                      y="0"
                      width={w}
                      height={h}
                      rx="5"
                      className="node-body"
                    />
                    <text
                      x={w / 2}
                      y="32"
                      textAnchor="middle"
                      className="node-expression"
                    >
                      1
                    </text>
                    <path d={`M20 43H${w - 20}`} stroke="#607991" />
                    <text
                      x={w / 2}
                      y="66"
                      textAnchor="middle"
                      className="node-expression"
                    >
                      s
                    </text>
                    <text
                      x={w / 2}
                      y="-10"
                      textAnchor="middle"
                      className="node-label"
                    >
                      {stateSignalLabel(node.label)}(s)
                    </text>
                  </>
                ) : node.kind === "gain" ? (
                  <>
                    <rect
                      x="0"
                      y="0"
                      width={w}
                      height={h}
                      rx="5"
                      className="node-body"
                    />
                    <text
                      x={w / 2}
                      y="16"
                      textAnchor="middle"
                      className="terminal-label"
                    >
                      {node.label}
                    </text>
                    <text
                      x={w / 2}
                      y="58"
                      textAnchor="middle"
                      className="node-expression"
                      textLength={
                        (node.value?.length ?? 0) > 16 ? w - 16 : undefined
                      }
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {node.value}
                    </text>
                  </>
                ) : (
                  <>
                    <rect width={w} height={h} rx="20" className="node-body" />
                    <text
                      x={w / 2}
                      y={h / 2 + 6}
                      textAnchor="middle"
                      className="node-label"
                    >
                      {node.label}(s)
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="field-hint">
        拡大した図は枠内をスクロールして確認できます。画像保存は倍率にかかわらず線図全体を出力します。
      </p>
    </div>
  );
}
