import { useRef, useState, useMemo, useLayoutEffect, useId } from "react";
import {
  routeEdges,
  diagramBounds,
  portPoint,
  inputSide,
  outputSide,
} from "./routing";
import { downloadDiagram } from "./exportDiagram";
import type { Diagram, DiagramNode } from "./model";
export const labels = {
  input: "入力",
  output: "出力",
  block: "伝達関数",
  sum: "加算点",
  branch: "分岐点",
};
export function Canvas({
  diagram,
  selected,
  select,
  change,
  wire,
  setWire,
  readonly = false,
}: {
  diagram: Diagram;
  selected?: string;
  select: (id: string) => void;
  change: (d: Diagram) => void;
  wire?: string;
  setWire: (id?: string) => void;
  readonly?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);
  const [moving, setMoving] = useState<DiagramNode>();
  const nodes = diagram.nodes.map((n) => (moving?.id === n.id ? moving : n));
  function point(e: React.PointerEvent) {
    const p = new DOMPoint(e.clientX, e.clientY);
    return p.matrixTransform(svg.current!.getScreenCTM()!.inverse());
  }
  const routes = useMemo(
    () => routeEdges({ ...diagram, nodes }),
    [diagram, moving],
  );
  const bounds = useMemo(
    () => diagramBounds({ ...diagram, nodes }, routes),
    [diagram, moving, routes],
  );
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 380 });
  const [camera, setCamera] = useState({ x: 500, y: 310, width: 1050 });
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    distance: number;
    camera: typeof camera;
    anchor: { x: number; y: number };
  } | null>(null);
  const pan = useRef<{ x: number; y: number; camera: typeof camera } | null>(
    null,
  );
  const identity = useId().replace(/:/g, "");
  const gridId = `grid-${identity}`,
    arrowId = `arrow-${identity}`;
  const fitted = () => ({
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
    width: Math.max(bounds.width, (bounds.height * size.width) / size.height),
  });
  const fit = () => setCamera(fitted());
  const structure = diagram.nodes.map((n) => n.id).join("|");
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    fit();
  }, [size.width, size.height, structure]);
  const height = (camera.width * size.height) / size.width;
  const zoom = Math.round((fitted().width / camera.width) * 100);
  function zoomBy(factor: number) {
    setCamera((c) => ({
      ...c,
      width: Math.max(
        fitted().width / 5,
        Math.min(fitted().width * 3, c.width * factor),
      ),
    }));
  }
  function capturePoint(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.current.size === 2) {
      drag.current = null;
      setMoving(undefined);
      pan.current = null;
      const [a, b] = [...points.current.values()],
        rect = svg.current!.getBoundingClientRect();
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinch.current = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        camera,
        anchor: {
          x:
            camera.x +
            ((mid.x - rect.left - rect.width / 2) * camera.width) / rect.width,
          y:
            camera.y +
            ((mid.y - rect.top - rect.height / 2) * height) / rect.height,
        },
      };
    }
  }
  function moveTouches(e: React.PointerEvent) {
    if (points.current.has(e.pointerId))
      points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.current.size < 2 || !pinch.current) return;
    const [a, b] = [...points.current.values()],
      p = pinch.current,
      rect = svg.current!.getBoundingClientRect();
    const width = Math.max(
      fitted().width / 5,
      Math.min(
        fitted().width * 3,
        (p.camera.width * p.distance) /
          Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      ),
    );
    setCamera({
      width,
      x:
        p.anchor.x -
        (((a.x + b.x) / 2 - rect.left - rect.width / 2) * width) / rect.width,
      y:
        p.anchor.y -
        (((a.y + b.y) / 2 - rect.top - rect.height / 2) * width) / rect.width,
    });
  }
  function release(e: React.PointerEvent) {
    points.current.delete(e.pointerId);
    if (points.current.size < 2) pinch.current = null;
    pan.current = null;
  }
  async function save(format: "svg" | "png") {
    setExporting(true);
    setExportError("");
    try {
      await downloadDiagram(svg.current!, bounds, format);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }
  function port(n: DiagramNode, side: "in" | "out") {
    if (readonly) return;
    if (side === "out") {
      setWire(wire === n.id ? undefined : n.id);
      return;
    }
    if (!wire) return;
    if (diagram.edges.length >= 32) return;
    if (diagram.edges.some((e) => e.from === wire && e.to === n.id)) {
      setWire(undefined);
      return;
    }
    if (n.kind !== "sum" && diagram.edges.some((e) => e.to === n.id)) return;
    change({
      ...diagram,
      edges: [
        ...diagram.edges,
        { id: crypto.randomUUID(), from: wire, to: n.id, sign: 1 },
      ],
    });
    setWire(undefined);
  }
  return (
    <div className={`canvas-shell ${readonly ? "readonly" : ""}`}>
      <div className="view-controls" aria-label="線図の表示と画像保存">
        <div>
          <button aria-label="縮小" onClick={() => zoomBy(1.25)}>
            −
          </button>
          <output aria-label="表示倍率">{zoom}%</output>
          <button aria-label="拡大" onClick={() => zoomBy(0.8)}>
            ＋
          </button>
          <button onClick={fit}>全体表示</button>
        </div>
        <div>
          <button
            disabled={exporting || !diagram.nodes.length}
            onClick={() => save("png")}
          >
            PNG保存
          </button>
          <button
            disabled={exporting || !diagram.nodes.length}
            onClick={() => save("svg")}
          >
            SVG保存
          </button>
        </div>
      </div>
      {exportError && (
        <p className="canvas-warning" role="alert">
          {exportError}
        </p>
      )}
      {routes.some((r) => r.obstructed) && (
        <p className="canvas-warning" role="status">
          自動配線できない箇所があります。重なった要素を離すか、図を簡単にしてください。
        </p>
      )}
      <div ref={container} className="canvas-scroll">
        <svg
          ref={svg}
          viewBox={`${camera.x - camera.width / 2} ${camera.y - height / 2} ${camera.width} ${height}`}
          preserveAspectRatio="none"
          onPointerDownCapture={capturePoint}
          onPointerMoveCapture={moveTouches}
          onPointerUpCapture={release}
          onPointerCancelCapture={release}
          onPointerDown={(e) => {
            if ((e.target as Element).closest(".diagram-node,.edge-group"))
              return;
            if (points.current.size > 1) return;
            pan.current = { x: e.clientX, y: e.clientY, camera };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const p = pan.current;
            if (!p || points.current.size > 1) return;
            setCamera({
              ...p.camera,
              x: p.camera.x - ((e.clientX - p.x) * p.camera.width) / size.width,
              y: p.camera.y - ((e.clientY - p.y) * p.camera.width) / size.width,
            });
          }}
          onPointerUp={() => {
            pan.current = null;
          }}
          className="diagram-canvas"
          role="img"
          aria-label="ブロック線図。各要素の右側の接続口から左側の接続口へクリックして配線します。"
          onClick={(e) => {
            if (e.target === e.currentTarget) select("");
          }}
        >
          <defs>
            <pattern
              id={gridId}
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.9" fill="#cbd5e1" />
            </pattern>
            <marker
              id={arrowId}
              markerWidth="9"
              markerHeight="9"
              refX="8"
              refY="4.5"
              orient="auto"
            >
              <path d="M0 0 L9 4.5 L0 9" fill="#64748b" />
            </marker>
          </defs>
          <rect
            className="export-hide"
            x="-3000"
            y="-3000"
            width="7000"
            height="7000"
            fill={`url(#${gridId})`}
            pointerEvents="none"
          />
          {routes.map(({ edge: e, path, sign }) => {
            const b = nodes.find((n) => n.id === e.to)!;
            return (
              <g
                key={e.id}
                className={`edge-group ${selected === e.id ? "highlighted" : ""}`}
              >
                <title>
                  {nodes.find((n) => n.id === e.from)?.label} → {b.label}
                  {b.kind === "sum" ? (e.sign === 1 ? "（＋）" : "（−）") : ""}
                </title>
                <path d={path} className="wire-underlay" />
                <path
                  d={path}
                  className={`wire ${selected === e.id ? "selected" : ""}`}
                  markerEnd={`url(#${arrowId})`}
                />
                <path
                  d={path}
                  fill="none"
                  className="export-hide wire-hit"
                  stroke="transparent"
                  strokeWidth="18"
                  onClick={() => !readonly && select(e.id)}
                  style={{ cursor: "pointer" }}
                />
                {b.kind === "sum" && (
                  <g
                    className="sign-button"
                    role={readonly ? undefined : "button"}
                    tabIndex={readonly ? undefined : 0}
                    aria-label={`加算点の入力符号 ${e.sign === 1 ? "プラス" : "マイナス"}。押すと切り替え`}
                    onClick={() =>
                      !readonly &&
                      change({
                        ...diagram,
                        edges: diagram.edges.map((x) =>
                          x.id === e.id
                            ? { ...x, sign: x.sign === 1 ? -1 : 1 }
                            : x,
                        ),
                      })
                    }
                    onKeyDown={(ev) => {
                      if (!readonly && (ev.key === "Enter" || ev.key === " ")) {
                        ev.preventDefault();
                        change({
                          ...diagram,
                          edges: diagram.edges.map((x) =>
                            x.id === e.id
                              ? { ...x, sign: x.sign === 1 ? -1 : 1 }
                              : x,
                          ),
                        });
                      }
                    }}
                    transform={`translate(${sign.x},${sign.y})`}
                  >
                    <circle r="17" fill="#fff" stroke="none" />
                    <text
                      textAnchor="middle"
                      dy="6"
                      fontSize="22"
                      fill="#334155"
                    >
                      {e.sign === 1 ? "+" : "−"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {nodes
            .filter(
              (n) => diagram.edges.filter((e) => e.from === n.id).length > 1,
            )
            .map((n) => {
              const p = portPoint(n, outputSide(n));
              return (
                <circle
                  key={`junction-${n.id}`}
                  className="signal-junction"
                  cx={p.x + (n.reversed ? -24 : 24)}
                  cy={p.y}
                  r="3.5"
                  fill="#334d68"
                  pointerEvents="none"
                />
              );
            })}
          {nodes.map((n) => (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              className={`diagram-node ${selected === n.id ? "selected" : ""} ${n.kind === "block" && (!n.num.trim() || !n.den.trim()) ? "invalid" : ""}`}
              role={readonly ? undefined : "button"}
              tabIndex={readonly ? undefined : 0}
              aria-label={`${labels[n.kind]} ${n.label}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") select(n.id);
              }}
              onPointerDown={(e) => {
                if (
                  readonly ||
                  points.current.size > 1 ||
                  (e.target as Element).closest(".port")
                )
                  return;
                e.stopPropagation();
                select(n.id);
                const p = point(e);
                drag.current = {
                  id: n.id,
                  startX: p.x,
                  startY: p.y,
                  x: n.x,
                  y: n.y,
                  pointerId: e.pointerId,
                  moved: false,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drag.current || drag.current.id !== n.id) return;
                const p = point(e),
                  d = drag.current;
                if (Math.abs(p.x - d.startX) + Math.abs(p.y - d.startY) > 4)
                  d.moved = true;
                if (d.moved)
                  setMoving({
                    ...n,
                    x: Math.round(
                      Math.max(70, Math.min(930, d.x + p.x - d.startX)),
                    ),
                    y: Math.round(
                      Math.max(55, Math.min(565, d.y + p.y - d.startY)),
                    ),
                  });
              }}
              onPointerUp={(e) => {
                if (drag.current?.id !== n.id) return;
                if (moving && drag.current.moved)
                  change({
                    ...diagram,
                    nodes: diagram.nodes.map((v) =>
                      v.id === n.id ? moving : v,
                    ),
                  });
                drag.current = null;
                setMoving(undefined);
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setMoving(undefined);
              }}
            >
              {n.kind === "block" ? (
                <>
                  <rect
                    className="node-body"
                    x="-64"
                    y="-43"
                    width="128"
                    height="86"
                    rx="9"
                  />
                  <text y="-17" textAnchor="middle" className="node-label">
                    {n.label}
                  </text>
                  <text y="5" textAnchor="middle" className="node-expression">
                    {!n.num.trim()
                      ? "未入力"
                      : n.num.length > 15
                        ? n.num.slice(0, 14) + "…"
                        : n.num}
                  </text>
                  <line x1="-45" y1="13" x2="45" y2="13" stroke="#94a3b8" />
                  <text y="31" textAnchor="middle" className="node-expression">
                    {!n.den.trim()
                      ? "未入力"
                      : n.den.length > 15
                        ? n.den.slice(0, 14) + "…"
                        : n.den}
                  </text>
                  <title>
                    {n.label}: ({n.num}) / ({n.den})
                  </title>
                </>
              ) : n.kind === "sum" ? (
                <circle className="node-body sum-body" r="23" />
              ) : n.kind === "branch" ? (
                <circle className="branch-body" r="8" />
              ) : (
                <>
                  <rect
                    className="terminal-body"
                    x="-33"
                    y="-24"
                    width="66"
                    height="48"
                    rx="24"
                  />
                  <text textAnchor="middle" dy="6" className="node-label">
                    {n.kind === "input" ? "U(s)" : "Y(s)"}
                  </text>
                  <text y="46" textAnchor="middle" className="terminal-label">
                    {n.label}
                  </text>
                </>
              )}
              {!readonly && n.kind !== "input" && (
                <g
                  className="port"
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.label} の入力接続口`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    port(n, "in");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      port(n, "in");
                    }
                  }}
                >
                  <circle
                    cx={portPoint(n, inputSide(n)).x - n.x}
                    r="19"
                    fill="transparent"
                  />
                  <circle
                    cx={portPoint(n, inputSide(n)).x - n.x}
                    r="6"
                    className={`port-dot ${wire ? "target" : ""}`}
                  />
                </g>
              )}
              {!readonly && n.kind !== "output" && (
                <g
                  className="port"
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.label} の出力接続口`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    port(n, "out");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      port(n, "out");
                    }
                  }}
                >
                  <circle
                    cx={portPoint(n, outputSide(n)).x - n.x}
                    r="19"
                    fill="transparent"
                  />
                  <circle
                    cx={portPoint(n, outputSide(n)).x - n.x}
                    r="6"
                    className={`port-dot output-port ${wire === n.id ? "active" : ""}`}
                  />
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="view-hint">
        空白部分をドラッグして移動 · 2本指で拡大・縮小 ·
        「全体表示」で元に戻せます
      </div>
    </div>
  );
}
