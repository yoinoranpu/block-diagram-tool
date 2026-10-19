import { useRef, useState } from "react";
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
  const half = (n: DiagramNode) =>
    n.kind === "block"
      ? 64
      : n.kind === "sum"
        ? 23
        : n.kind === "branch"
          ? 12
          : 33;
  function port(n: DiagramNode, side: "in" | "out") {
    if (readonly) return;
    select(n.id);
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
    <div className={`canvas-scroll ${readonly ? "readonly" : ""}`}>
      <svg
        ref={svg}
        viewBox="0 0 1000 620"
        className="diagram-canvas"
        role="img"
        aria-label="ブロック線図。各要素の右側の接続口から左側の接続口へクリックして配線します。"
        onClick={(e) => {
          if (e.target === e.currentTarget) select("");
        }}
      >
        <defs>
          <pattern
            id={readonly ? "grid-read" : "grid-edit"}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.9" fill="#cbd5e1" />
          </pattern>
          <marker
            id={readonly ? "arrow-read" : "arrow-edit"}
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
          width="1000"
          height="620"
          fill={`url(#${readonly ? "grid-read" : "grid-edit"})`}
          pointerEvents="none"
        />
        {diagram.edges.map((e, index) => {
          const a = nodes.find((n) => n.id === e.from)!,
            b = nodes.find((n) => n.id === e.to)!;
          const x1 = a.x + half(a),
            x2 = b.x - half(b),
            y1 = a.y,
            y2 = b.y;
          const backward = x1 >= x2;
          const lane = (index % 3) * 18;
          const path =
            a.id === b.id
              ? `M ${x1} ${y1} C ${x1 + 100} ${y1 - 120},${x2 - 100} ${y2 - 120},${x2} ${y2}`
              : backward
                ? `M${x1} ${y1} C${x1 + 50} ${y1 + 65 + lane},${x2 - 50} ${y2 + 65 + lane},${x2} ${y2}`
                : `M${x1} ${y1} C${x1 + (x2 - x1) / 2} ${y1},${x1 + (x2 - x1) / 2} ${y2},${x2} ${y2}`;
          return (
            <g key={e.id}>
              <path
                d={path}
                className={`wire ${selected === e.id ? "selected" : ""}`}
                markerEnd={`url(#${readonly ? "arrow-read" : "arrow-edit"})`}
              />
              <path
                d={path}
                fill="none"
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
                  transform={`translate(${x2 - 26},${y2 + (backward ? 27 + lane : -24 - lane)})`}
                >
                  <circle
                    r="17"
                    fill={e.sign === -1 ? "#fff1f2" : "#eff6ff"}
                    stroke={e.sign === -1 ? "#e9a3a3" : "#93b9f3"}
                  />
                  <text textAnchor="middle" dy="6" fontSize="22" fill="#334155">
                    {e.sign === 1 ? "+" : "−"}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {nodes.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            className={`diagram-node ${selected === n.id ? "selected" : ""}`}
            role={readonly ? undefined : "button"}
            tabIndex={readonly ? undefined : 0}
            aria-label={`${labels[n.kind]} ${n.label}`}
            onKeyDown={(e) => {
              if (e.key === "Enter") select(n.id);
            }}
            onPointerDown={(e) => {
              if (readonly || (e.target as Element).closest(".port")) return;
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
                  nodes: diagram.nodes.map((v) => (v.id === n.id ? moving : v)),
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
                  {n.num.length > 15 ? n.num.slice(0, 14) + "…" : n.num}
                </text>
                <line x1="-45" y1="13" x2="45" y2="13" stroke="#94a3b8" />
                <text y="31" textAnchor="middle" className="node-expression">
                  {n.den.length > 15 ? n.den.slice(0, 14) + "…" : n.den}
                </text>
                <title>
                  {n.label}: ({n.num}) / ({n.den})
                </title>
              </>
            ) : n.kind === "sum" ? (
              <>
                <circle className="node-body" r="23" />
                <text textAnchor="middle" dy="7" fontSize="23">
                  Σ
                </text>
              </>
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
                <circle cx={-half(n)} r="19" fill="transparent" />
                <circle
                  cx={-half(n)}
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
                <circle cx={half(n)} r="19" fill="transparent" />
                <circle
                  cx={half(n)}
                  r="6"
                  className={`port-dot ${wire === n.id ? "active" : ""}`}
                />
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
