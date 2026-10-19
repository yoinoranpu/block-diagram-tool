import { useId, useRef, useState } from "react";
import type { StateSpaceInput } from "./stateSpace";
import { downloadDiagram } from "./exportDiagram";
export function StateSpaceDiagram({ data }: { data: StateSpaceInput }) {
  const id = useId().replace(/:/g, ""),
    svg = useRef<SVGSVGElement>(null);
  const [error, setError] = useState(""),
    [scale, setScale] = useState(1);
  const rows = [
    ...data.A.map((r, i) => ({
      name: `x${i + 1}`,
      integrate: true,
      terms: [
        ...r.map((v, j) => ({
          source: `x${j + 1}`,
          value: v,
          label: `A${i + 1}${j + 1}`,
        })),
        { source: "u", value: data.B[i], label: `B${i + 1}` },
      ],
    })),
    {
      name: "y",
      integrate: false,
      terms: [
        ...data.C.map((v, j) => ({
          source: `x${j + 1}`,
          value: v,
          label: `C${j + 1}`,
        })),
        { source: "u", value: data.D, label: "D" },
      ],
    },
  ].map((row) => ({ ...row, terms: row.terms.filter((t) => t.value !== "0") }));
  let top = 24;
  const lanes = rows.map((row) => {
    const height = Math.max(100, row.terms.length * 66);
    const y = top;
    top += height + 32;
    return { ...row, y, height };
  });
  const bounds = { x: 0, y: 0, width: 900, height: top };
  async function save(format: "svg" | "png") {
    try {
      setError("");
      await downloadDiagram(svg.current!, bounds, format);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="state-diagram">
      <p className="field-hint">
        同じラベル（x1・x2・x3・u）は同じ信号です。各行は入力した行列の状態方程式に対応します。負号は係数ブロック内に表示します。
      </p>
      <div className="state-diagram-tools">
        <button onClick={() => setScale(Math.max(1, scale - 0.5))}>縮小</button>
        <button onClick={() => setScale(Math.min(3, scale + 0.5))}>拡大</button>
        <button onClick={() => setScale(1)}>全体表示</button>
        <button onClick={() => save("png")}>PNG保存</button>
        <button onClick={() => save("svg")}>SVG保存</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="state-diagram-scroll">
        <svg
          ref={svg}
          viewBox={`0 0 900 ${top}`}
          width={`${scale * 100}%`}
          role="img"
          aria-label="入力した行列に対応する状態変数線図"
        >
          <defs>
            <marker
              id={`state-${id}`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0L8 4L0 8" fill="#53677f" />
            </marker>
          </defs>
          {lanes.map((row) => {
            const middle = row.y + row.height / 2;
            return (
              <g key={row.name}>
                <text x="24" y={row.y + 14} className="node-label">
                  {row.integrate ? `${row.name} の状態方程式` : "出力方程式"}
                </text>
                {row.terms.map((term, i) => {
                  const y = row.y + 36 + i * 66;
                  const offset = (i - (row.terms.length - 1) / 2) * 10;
                  const entryX =
                    (row.integrate ? 575 : 745) -
                    Math.sqrt(22 * 22 - offset * offset);
                  return (
                    <g key={term.label}>
                      <text x="40" y={y + 5} className="node-label">
                        {term.source}
                      </text>
                      <path
                        d={`M75 ${y}H150`}
                        className="wire"
                        markerEnd={`url(#state-${id})`}
                      />
                      <rect
                        x="150"
                        y={y - 22}
                        width="190"
                        height="44"
                        rx="5"
                        className="node-body"
                      />
                      <text
                        x="245"
                        y={y - 5}
                        textAnchor="middle"
                        className="terminal-label"
                      >
                        {term.label}
                      </text>
                      <text
                        x="245"
                        y={y + 13}
                        textAnchor="middle"
                        className="node-expression"
                        textLength={term.value.length > 18 ? 174 : undefined}
                        lengthAdjust="spacingAndGlyphs"
                      >
                        <title>{term.value}</title>
                        {term.value}
                      </text>
                      <path
                        d={`M340 ${y}H${400 + Math.abs(i - (row.terms.length - 1) / 2) * 30}V${middle + offset}H${entryX}`}
                        className="wire"
                        markerEnd={`url(#state-${id})`}
                      />
                    </g>
                  );
                })}
                {!row.terms.length && (
                  <>
                    <path
                      d={`M275 ${middle}H${row.integrate ? 553 : 723}`}
                      className="wire"
                      markerEnd={`url(#state-${id})`}
                    />
                    <text
                      x="245"
                      y={middle + 5}
                      textAnchor="middle"
                      className="node-expression"
                    >
                      0
                    </text>
                  </>
                )}
                <circle
                  cx={row.integrate ? 575 : 745}
                  cy={middle}
                  r="22"
                  className="node-body"
                />
                {row.terms.length > 0 && (
                  <text
                    x={row.integrate ? 543 : 713}
                    y={middle - 28}
                    className="node-label"
                  >
                    ＋
                  </text>
                )}
                {row.integrate && (
                  <>
                    <path
                      d={`M597 ${middle}H660`}
                      className="wire"
                      markerEnd={`url(#state-${id})`}
                    />
                    <rect
                      x="660"
                      y={middle - 30}
                      width="80"
                      height="60"
                      rx="5"
                      className="node-body"
                    />
                    <text
                      x="700"
                      y={middle - 7}
                      textAnchor="middle"
                      className="node-expression"
                    >
                      1
                    </text>
                    <path d={`M675 ${middle}H725`} stroke="#607991" />
                    <text
                      x="700"
                      y={middle + 20}
                      textAnchor="middle"
                      className="node-expression"
                    >
                      s
                    </text>
                  </>
                )}
                <path
                  d={`M${row.integrate ? 740 : 767} ${middle}H830`}
                  className="wire"
                  markerEnd={`url(#state-${id})`}
                />
                <text x="845" y={middle + 5} className="node-label">
                  {row.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
