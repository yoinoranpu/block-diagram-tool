import { RealizationPanel } from "./RealizationPanel";
import { StateSpaceWorkspace } from "./StateSpaceWorkspace";
import { ActionMenu } from "./ActionMenu";
import { normalizeFormula } from "./normalizeInput";
import { useEffect, useRef, useState } from "react";
import { Canvas, labels } from "./Canvas";
import { Formula } from "./Formula";
import { calculate } from "./mathClient";
import {
  example,
  node,
  validateDiagram,
  type Diagram,
  type Kind,
} from "./model";
import type { Analysis, Candidate } from "./engine";

type Saved = {
  version: 1;
  diagram: Diagram;
  numerator: string;
  denominator: string;
};
type Generated = {
  tex: string;
  expandedTex: string;
  candidates: Candidate[];
  limitations: string[];
};
const KEY = "control-diagram-v1";
function load(): { saved: Saved; warning?: string } {
  const fallback: Saved = {
    version: 1,
    diagram: example(),
    numerator: "K",
    denominator: "(s+a)*(s+b)",
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { saved: fallback };
    const saved = readSaved(JSON.parse(raw));
    return { saved };
  } catch {
    return {
      saved: fallback,
      warning:
        "保存データを復元できませんでした。負帰還の例題を表示しています。必要なJSONを読み込んでください。",
    };
  }
}
function readSaved(v: unknown): Saved {
  const x = v as Saved;
  if (
    !x ||
    x.version !== 1 ||
    typeof x.numerator !== "string" ||
    typeof x.denominator !== "string" ||
    x.numerator.length > 300 ||
    x.denominator.length > 300
  )
    throw new Error(
      "対応していないJSON形式です。バージョン1の書き出しデータを使ってください。",
    );
  return {
    version: 1,
    diagram: validateDiagram(x.diagram),
    numerator: x.numerator,
    denominator: x.denominator,
  };
}
function FractionInput({
  num,
  den,
  onChange,
  prefix = "伝達関数",
}: {
  num: string;
  den: string;
  onChange: (n: string, d: string) => void;
  prefix?: string;
}) {
  const [active, setActive] = useState<"n" | "d">("n");
  const nref = useRef<HTMLInputElement>(null),
    dref = useRef<HTMLInputElement>(null);
  function insert(t: string) {
    const el = (active === "n" ? nref : dref).current!,
      val = active === "n" ? num : den;
    const start = el.selectionStart ?? val.length,
      end = el.selectionEnd ?? start;
    let next: string, caret: number;
    if (t === "C") {
      next = "";
      caret = 0;
    } else if (t === "⌫") {
      const cut = start === end ? Math.max(0, start - 1) : start;
      next = val.slice(0, cut) + val.slice(end);
      caret = cut;
    } else {
      next = val.slice(0, start) + t + val.slice(end);
      caret = start + t.length;
    }
    if (next.length > 300) return;
    onChange(active === "n" ? next : num, active === "d" ? next : den);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }
  return (
    <div className="fraction-editor">
      <div className="fraction-fields">
        <label>
          <span>分子</span>
          <input
            ref={nref}
            aria-label={`${prefix}の分子`}
            aria-invalid={!num.trim()}
            placeholder="例：K、2、s+1"
            value={num}
            maxLength={300}
            onFocus={() => setActive("n")}
            onChange={(e) =>
              onChange(
                (e.nativeEvent as InputEvent).isComposing
                  ? e.target.value
                  : normalizeFormula(e.target.value),
                den,
              )
            }
            onCompositionEnd={(e) =>
              onChange(normalizeFormula(e.currentTarget.value), den)
            }
            onBlur={(e) => onChange(normalizeFormula(e.target.value), den)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <div className="fraction-rule" />
        <label>
          <span>分母</span>
          <input
            ref={dref}
            aria-label={`${prefix}の分母`}
            aria-invalid={false}
            placeholder="省略すると 1"
            value={den}
            maxLength={300}
            onFocus={() => setActive("d")}
            onChange={(e) =>
              onChange(
                num,
                (e.nativeEvent as InputEvent).isComposing
                  ? e.target.value
                  : normalizeFormula(e.target.value),
              )
            }
            onCompositionEnd={(e) =>
              onChange(num, normalizeFormula(e.currentTarget.value))
            }
            onBlur={(e) => onChange(num, normalizeFormula(e.target.value))}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
      </div>
      <details
        className={`keypad-details ${prefix === "選択ブロック" ? "compact" : "expanded"}`}
        open={prefix === "選択ブロック" ? undefined : true}
      >
        <summary>入力補助キーを開く</summary>
        <div className="keypad" aria-label="式入力の補助キー">
          {[
            "7",
            "8",
            "9",
            "+",
            "s",
            "K",
            "4",
            "5",
            "6",
            "−",
            "a",
            "b",
            "1",
            "2",
            "3",
            "×",
            "(",
            ")",
            "0",
            ".",
            "^",
            "/",
            "⌫",
            "C",
          ].map((t) => (
            <button
              key={t}
              aria-label={
                t === "⌫"
                  ? "1文字削除"
                  : t === "C"
                    ? "入力欄をクリア"
                    : undefined
              }
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(t === "−" ? "-" : t === "×" ? "*" : t)}
            >
              {t}
            </button>
          ))}
        </div>
      </details>
      {!num.trim() && (
        <p className="inline-validation" role="status">
          分子が未入力です。
        </p>
      )}
      {!den.trim() && (
        <p className="gain-hint">
          分母は1として計算し、線図では分子だけを表示します。
        </p>
      )}
      <p className="field-hint">
        掛け算は *、累乗は ^（例：s^3+a*s+1）。係数は半角英字1文字。i・e・E
        は使用できません。
      </p>
    </div>
  );
}

export default function App() {
  const [initial] = useState(load);
  const [history, setHistory] = useState<Diagram[]>([initial.saved.diagram]);
  const [cursor, setCursor] = useState(0);
  const diagram = history[cursor];
  const [selected, setSelected] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const select = (id: string) => {
    setSelected(id);
    setShowDetails(false);
  };
  const [wire, setWire] = useState<string>();
  const [tab, setTab] = useState<"diagram" | "formula" | "state">("diagram");
  const [num, setNum] = useState(initial.saved.numerator),
    [den, setDen] = useState(initial.saved.denominator);
  const [answer, setAnswer] = useState<{ data: Analysis; key: string }>();
  const [generated, setGenerated] = useState<{
    data: Generated;
    key: string;
  }>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(initial.warning ?? "");
  const [saveStatus, setSaveStatus] = useState("自動保存");
  const [cmpNum, setCmpNum] = useState(""),
    [cmpDen, setCmpDen] = useState("1");
  const [comparison, setComparison] = useState<{
    equal: boolean;
    tex: string;
    conditions: string[];
    key: string;
  }>();
  const [candidateIndex, setCandidateIndex] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const requestId = useRef(0);
  const [inputIssue, setInputIssue] = useState<{
    nodeId: string;
    message: string;
  }>();
  const diagramKey = JSON.stringify(diagram),
    formulaKey = JSON.stringify([num, den]);
  const comparisonKey = JSON.stringify([
    diagramKey,
    formulaKey,
    tab,
    cmpNum,
    cmpDen,
  ]);
  const shownComparison =
    comparison?.key === comparisonKey ? comparison : undefined;
  const currentAnswer = answer?.key === diagramKey ? answer.data : undefined;
  const currentGenerated =
    generated?.key === formulaKey ? generated.data : undefined;
  const n = diagram.nodes.find((x) => x.id === selected),
    e = diagram.edges.find((x) => x.id === selected);
  const current = tab === "diagram" ? currentAnswer : undefined;
  const formulaTex = tab === "diagram" ? current?.expandedTex : currentGenerated?.expandedTex;
  const answerFraction =
    tab === "diagram"
      ? current?.value
      : currentGenerated?.candidates[0]?.result.value;
  const candidate = currentGenerated?.candidates[candidateIndex];
  useEffect(() => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          diagram,
          numerator: num,
          denominator: den,
        }),
      );
      setSaveStatus("このブラウザに保存済み");
    } catch {
      setSaveStatus("自動保存できません。JSONで保存してください");
    }
  }, [diagram, num, den]);
  useEffect(() => {
    setComparison(undefined);
  }, [diagramKey, formulaKey, tab, cmpNum, cmpDen]);
  function change(d: Diagram) {
    if (JSON.stringify(d) === JSON.stringify(diagram)) return;
    setHistory((h) => [...h.slice(0, cursor + 1), d].slice(-60));
    setCursor(Math.min(cursor + 1, 59));
    setError("");
    setInputIssue(undefined);
  }
  function updateNode(patch: Partial<typeof n>) {
    if (n)
      change({
        ...diagram,
        nodes: diagram.nodes.map((x) =>
          x.id === n.id ? { ...x, ...patch } : x,
        ),
      });
  }
  function remove() {
    change({
      nodes: diagram.nodes.filter((x) => x.id !== selected),
      edges: diagram.edges.filter(
        (x) => x.id !== selected && x.from !== selected && x.to !== selected,
      ),
    });
    select("");
    setWire(undefined);
  }
  function addNode(kind: Kind) {
    if (diagram.nodes.length >= 32) {
      setError("初版の上限は32要素です。");
      return;
    }
    const v = node(
      kind,
      crypto.randomUUID(),
      150 + (diagram.nodes.length % 5) * 160,
      90 + Math.floor(diagram.nodes.length / 5) * 125,
    );
    v.label =
      kind === "block"
        ? `G${diagram.nodes.filter((x) => x.kind === "block").length + 1}`
        : labels[kind];
    change({ ...diagram, nodes: [...diagram.nodes, v] });
    select(v.id);
  }
  const copiedNode = useRef<typeof n>(undefined);
  const pasteCount = useRef(0);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const element = event.target as HTMLElement;
      if (
        element.closest("input,textarea,[contenteditable=true]") ||
        !(event.ctrlKey || event.metaKey) ||
        tab !== "diagram"
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "z" || key === "y") {
        event.preventDefault();
        const redo = key === "y" || event.shiftKey;
        setCursor((c) =>
          Math.max(0, Math.min(history.length - 1, c + (redo ? 1 : -1))),
        );
        select("");
        setWire(undefined);
      } else if (key === "c" && n && !window.getSelection()?.toString()) {
        event.preventDefault();
        copiedNode.current = structuredClone(n);
        pasteCount.current = 0;
        setNotice(`${n.label} をコピーしました。Ctrl＋Vで貼り付けできます。`);
      } else if (key === "v" && copiedNode.current) {
        event.preventDefault();
        if (diagram.nodes.length >= 32) {
          setError("要素は32個までです。");
          return;
        }
        const offset = 40 * ++pasteCount.current;
        const v = {
          ...copiedNode.current,
          id: crypto.randomUUID(),
          x: Math.min(9930, copiedNode.current.x + offset),
          y: Math.min(9945, copiedNode.current.y + offset),
          label: (copiedNode.current.label + " コピー").slice(0, 40),
        };
        change({ ...diagram, nodes: [...diagram.nodes, v] });
        select(v.id);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [diagram, cursor, history, selected, tab]);
  async function run() {
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    setComparison(undefined);
    setInputIssue(undefined);
    setWire(undefined);
    try {
      if (tab === "diagram") {
        const data = await calculate<Analysis>("solve", { diagram });
        if (id === requestId.current) setAnswer({ data, key: diagramKey });
      } else {
        const data = await calculate<Generated>("generate", { num, den });
        if (id === requestId.current) {
          setGenerated({ data, key: formulaKey });
          setCandidateIndex(0);
        }
      }
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    } catch (err) {
      if (id === requestId.current) {
        setError((err as Error).message);
        const nodeId = (err as Error & { nodeId?: string }).nodeId;
        if (nodeId) {
          select(nodeId);
          setInputIssue({ nodeId, message: (err as Error).message });
        }
      }
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  function exportJson() {
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, diagram, numerator: num, denominator: den },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "control-diagram.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importJson(f?: File) {
    if (!f) return;
    try {
      if (f.size > 100000) throw new Error("JSONは100KB以内にしてください。");
      const saved = readSaved(JSON.parse(await f.text()));
      change(saved.diagram);
      setNum(saved.numerator);
      setDen(saved.denominator);
      select("");
      setWire(undefined);
      setNotice("JSONを読み込みました。線図の変更は「元に戻す」で戻せます。");
    } catch (err) {
      setError((err as Error).message);
    }
    if (file.current) file.current.value = "";
  }
  async function copy() {
    if (!answerFraction) return;
    const expression =
      answerFraction.d === "1"
        ? answerFraction.n
        : `(${answerFraction.n})/(${answerFraction.d})`;
    try {
      await navigator.clipboard.writeText(expression);
      setNotice("数式をコピーしました。");
    } catch {
      setNotice(
        "コピーできませんでした。答えのテキスト式を選択してコピーしてください。",
      );
    }
  }
  async function compare() {
    if (!answerFraction) return;
    setBusy(true);
    setError("");
    try {
      const result = await calculate<{
        equal: boolean;
        tex: string;
        conditions: string[];
      }>("compare", {
        num: answerFraction.n,
        den: answerFraction.d,
        otherNum: cmpNum,
        otherDen: cmpDen,
      });
      setComparison({ ...result, key: comparisonKey });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="site-header">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">
            ▱
          </span>
          <span>
            制御ブロック線図<span className="brand-suffix">ノート</span>
          </span>
          <span className="version">β</span>
        </div>
        <span className="header-note">ログイン不要 · ブラウザ内で計算</span>
      </header>
      <main>
        <h1 className="visually-hidden">制御ブロック線図と伝達関数の計算</h1>
        <nav className="tabs" aria-label="計算モード">
          <button
            aria-label="01 線図から伝達関数"
            className={tab === "diagram" ? "active" : ""}
            onClick={() => {
              setTab("diagram");
              setError("");
            }}
          >
            <span>01</span> 線図から伝達関数
          </button>
          <button
            aria-label="02 伝達関数から線図"
            className={tab === "formula" ? "active" : ""}
            onClick={() => {
              setTab("formula");
              setError("");
            }}
          >
            <span>02</span> 伝達関数から線図
          </button>
          <button
            aria-label="03 状態空間表現から"
            className={tab === "state" ? "active" : ""}
            onClick={() => {
              setTab("state");
              setError("");
            }}
          >
            <span>03</span> 状態空間表現から
          </button>
        </nav>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button aria-label="通知を閉じる" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        {tab === "state" ? (
          <StateSpaceWorkspace onEdit={(d) => {
            change(d);
            select("");
            setWire(undefined);
            setAnswer(undefined);
            setError("");
            setTab("diagram");
          }} />
        ) : (
          <div className="workspace">
            <section className="input-panel panel">
              <div className="panel-heading">
                <h2>
                  <span className="step">1</span>
                  {tab === "diagram"
                    ? "ブロック線図を作る"
                    : "伝達関数を入力する"}
                </h2>
                {tab === "formula" && (
                  <ActionMenu label="保存・読込">
                    <button onClick={exportJson}>JSON保存</button>
                    <button onClick={() => file.current?.click()}>読込</button>
                  </ActionMenu>
                )}
                <input
                  ref={file}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(ev) => importJson(ev.target.files?.[0])}
                />
              </div>
              {tab === "diagram" ? (
                <>
                  <div className="examples">
                    <span>例題から始める</span>
                    {(
                      [
                        ["series", "直列"],
                        ["parallel", "並列"],
                        ["negative", "負帰還"],
                        ["positive", "正帰還"],
                        ["multi", "複数ループ"],
                      ] as const
                    ).map(([kind, title]) => (
                      <button
                        key={kind}
                        onClick={() => {
                          change(example(kind));
                          select("");
                          setWire(undefined);
                        }}
                      >
                        {title}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        change({ nodes: [], edges: [] });
                        select("");
                        setWire(undefined);
                      }}
                    >
                      新規線図
                    </button>
                  </div>
                  <div className="editor-toolbar">
                    <div className="add-tools">
                      {(
                        ["block", "sum", "branch", "input", "output"] as Kind[]
                      ).map((kind) => (
                        <button
                          key={kind}
                          onClick={() => addNode(kind)}
                          title={`${labels[kind]}を追加`}
                        >
                          <span aria-hidden="true">
                            {
                              {
                                block: "▭",
                                sum: "○",
                                branch: "●",
                                input: "→",
                                output: "↗",
                              }[kind]
                            }
                          </span>
                          {labels[kind]}
                        </button>
                      ))}
                    </div>
                    <div className="undo-tools">
                      <button
                        aria-label="元に戻す"
                        title="元に戻す"
                        disabled={cursor === 0}
                        onClick={() => {
                          setCursor(cursor - 1);
                          select("");
                          setWire(undefined);
                        }}
                      >
                        ↶
                      </button>
                      <button
                        aria-label="やり直す"
                        title="やり直す"
                        disabled={cursor === history.length - 1}
                        onClick={() => {
                          setCursor(cursor + 1);
                          select("");
                          setWire(undefined);
                        }}
                      >
                        ↷
                      </button>
                    </div>
                  </div>
                  <div className={`canvas-guide ${wire ? "wiring" : ""}`}>
                    <span>
                      {wire
                        ? "● 接続先の白い入力口を選んでください。合流は白丸の加算点へ。"
                        : "青い出力口 → 白い入力口で配線。ブロックを選ぶと図上で式を入力できます。掛け算は *。"}
                    </span>
                    {wire && (
                      <button onClick={() => setWire(undefined)}>
                        配線を中止
                      </button>
                    )}
                    <button
                      className="primary diagram-calculate"
                      disabled={busy}
                      onClick={run}
                    >
                      {busy ? "計算しています…" : "全体の伝達関数を求める"}
                    </button>
                  </div>
                  <Canvas
                    fileActions={
                      <>
                        <button onClick={exportJson}>JSON保存</button>
                        <button onClick={() => file.current?.click()}>
                          JSON読込
                        </button>
                      </>
                    }
                    diagram={diagram}
                    selected={selected}
                    select={select}
                    change={change}
                    wire={wire}
                    setWire={setWire}
                    detailsOpen={showDetails}
                    openDetails={() => setShowDetails(true)}
                  />
                  <div className="canvas-footer">
                    <span>
                      {diagram.nodes.length}/32 要素 · {diagram.edges.length}/64
                      配線
                    </span>
                    <span>{saveStatus}</span>
                  </div>
                  <div
                    hidden={n?.kind === "block" && !showDetails}
                    className={`inspector ${n || e ? "active" : ""}`}
                    role={n || e ? "region" : undefined}
                    aria-label={n || e ? "選択した要素の編集" : undefined}
                  >
                    {(n || e) && (
                      <button
                        className="close-inspector"
                        aria-label="編集欄を閉じる"
                        onClick={() => select("")}
                      >
                        閉じる ×
                      </button>
                    )}
                    {inputIssue?.nodeId === selected && (
                      <p className="input-issue" role="alert">
                        {inputIssue.message}
                      </p>
                    )}
                    {n ? (
                      <>
                        <div className="inspector-title">
                          <strong>
                            {n.label} · {labels[n.kind]}の編集
                          </strong>
                          <div>
                            <button
                              onClick={() => {
                                if (diagram.nodes.length >= 32) {
                                  setError("要素は32個までです。");
                                  return;
                                }
                                const c = {
                                  ...n,
                                  id: crypto.randomUUID(),
                                  x: Math.min(9930, n.x + 45),
                                  y: Math.min(9945, n.y + 65),
                                  label: n.label + " コピー",
                                };
                                change({
                                  ...diagram,
                                  nodes: [...diagram.nodes, c],
                                });
                                select(c.id);
                              }}
                            >
                              複製
                            </button>
                            <button className="danger" onClick={remove}>
                              削除
                            </button>
                          </div>
                        </div>
                        <label className="name-field">
                          名前
                          <input
                            value={n.label}
                            maxLength={30}
                            onChange={(ev) =>
                              updateNode({ label: ev.target.value })
                            }
                          />
                        </label>
                        {n.kind === "block" && (
                          <FractionInput
                            prefix="詳細ブロック"
                            num={n.num}
                            den={n.den}
                            onChange={(num, den) => updateNode({ num, den })}
                          />
                        )}
                        {n.kind === "block" && (
                          <button
                            className="reverse-button"
                            onClick={() =>
                              updateNode({ reversed: !n.reversed })
                            }
                          >
                            入出力の向き：{n.reversed ? "←" : "→"}（反転）
                          </button>
                        )}
                        <div className="move-tools">
                          <span>位置を調整</span>
                          {(
                            [
                              ["←", -20, 0],
                              ["↑", 0, -20],
                              ["↓", 0, 20],
                              ["→", 20, 0],
                            ] as const
                          ).map(([t, x, y]) => (
                            <button
                              key={t}
                              aria-label={`要素を${t}へ移動`}
                              onClick={() =>
                                updateNode({
                                  x: Math.max(70, Math.min(9930, n.x + x)),
                                  y: Math.max(55, Math.min(9945, n.y + y)),
                                })
                              }
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : e ? (
                      <>
                        <div className="inspector-title">
                          <strong>配線の編集</strong>
                          <button className="danger" onClick={remove}>
                            配線を削除
                          </button>
                        </div>
                        <p>
                          {diagram.nodes.find((n) => n.id === e.from)?.label} →{" "}
                          {diagram.nodes.find((n) => n.id === e.to)?.label}
                        </p>
                        {diagram.nodes.find((n) => n.id === e.to)?.kind ===
                          "sum" && (
                          <button
                            onClick={() =>
                              change({
                                ...diagram,
                                edges: diagram.edges.map((x) =>
                                  x.id === e.id
                                    ? { ...x, sign: x.sign === 1 ? -1 : 1 }
                                    : x,
                                ),
                              })
                            }
                          >
                            入力符号：{e.sign === 1 ? "+" : "−"}（切替）
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="inspector-empty">
                        要素を選ぶと、式の編集・複製・削除・位置調整ができます。
                        <br />
                        加算点の配線上の ＋ / −
                        をタップすると符号が切り替わります。
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="formula-entry">
                  <div className="entry-label">
                    <span>G(s) =</span>
                    <span>分子と分母をそれぞれ入力</span>
                  </div>
                  <FractionInput
                    num={num}
                    den={den}
                    onChange={(n, d) => {
                      setNum(n);
                      setDen(d);
                    }}
                  />
                  <div className="expression-presets">
                    <span>入力例</span>
                    {[
                      ["K", "(s+a)*(s+b)", "文字係数・2次"],
                      ["s+2", "s^3+3*s^2+2*s+1", "3次系"],
                      ["1", "s^4+1", "4次系"],
                    ].map(([n, d, t]) => (
                      <button
                        key={t}
                        onClick={() => {
                          setNum(n);
                          setDen(d);
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="explanation">
                    単一ブロック・ゲイン分離・因数分解・積分器構成のうち、成立するものを表示します。生成後は線図から再計算し、元の式との一致を確認します。
                  </p>
                  <p className="field-hint">{saveStatus}</p>
                </div>
              )}
              {tab === "formula" && (
                <div className="calculate-bar">
                  <span>記号係数・高次の有理式に対応</span>
                  <button className="primary" disabled={busy} onClick={run}>
                    {busy ? "計算しています…" : "等価な線図を生成する"}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </section>
            <aside ref={resultRef} className="result-panel panel">
              <div className="panel-heading">
                <h2>
                  <span className="step">2</span>答えを確かめる
                </h2>
                <span className="exact-badge">厳密な記号計算</span>
              </div>
              {error && (
                <div className="error" role="alert">
                  <strong>計算・操作を完了できませんでした</strong>
                  <p>{error}</p>
                </div>
              )}
              {formulaTex ? (
                <>
                  <div className="result-card">
                    <div className="result-caption">
                      {tab === "diagram"
                        ? "全体の伝達関数"
                        : "入力した伝達関数"}
                      <button onClick={copy}>式をコピー</button>
                    </div>
                    <div className="result-formula">
                      <span>G(s) =</span>
                      <Formula tex={formulaTex} />
                    </div>
                    <details className="expanded-expression">
                      <summary>因数形を表示</summary>
                      <Formula
                        tex={
                          tab === "diagram"
                            ? current!.tex
                            : currentGenerated!.tex
                        }
                      />
                    </details>
                    <details className="text-expression">
                      <summary>テキスト式を表示</summary>
                      <code>
                        {answerFraction &&
                          `(${answerFraction.n})/(${answerFraction.d})`}
                      </code>
                    </details>
                    <p className="result-status">
                      <span />
                      有理式として計算済み · 係数条件は下記参照
                    </p>
                  </div>
                  {answerFraction && <RealizationPanel
                    key={`${tab}:${JSON.stringify(answerFraction)}`}
                    value={answerFraction}
                  />}
                  {tab === "formula" && currentGenerated && (
                    <div className="candidate-section">
                      <h3>
                        等価な線図{" "}
                        <span>
                          {currentGenerated.candidates.length} パターン
                        </span>
                      </h3>
                      <div className="candidate-tabs">
                        {currentGenerated.candidates.map((c, i) => (
                          <button
                            className={candidateIndex === i ? "chosen" : ""}
                            key={c.title}
                            onClick={() => setCandidateIndex(i)}
                          >
                            {c.title}
                          </button>
                        ))}
                      </div>
                      {candidate && (
                        <>
                          <p className="verified">
                            ✓ 線図からの再計算で厳密一致
                          </p>
                          <Canvas
                            key={candidate.title}
                            diagram={candidate.diagram}
                            select={() => {}}
                            change={() => {}}
                            setWire={() => {}}
                            readonly
                          />
                          <p className="explanation">
                            {candidate.explanation}{" "}
                            「全体表示」で全体を確認し、拡大すると配線や式を詳しく見られます。
                          </p>
                          <button
                            className="secondary"
                            onClick={() => {
                              change(candidate.diagram);
                              select("");
                              setWire(undefined);
                              setTab("diagram");
                              setAnswer({
                                data: candidate.result,
                                key: JSON.stringify(candidate.diagram),
                              });
                            }}
                          >
                            この線図を編集する →
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {current && (
                    <section className="learning-section">
                      <h3>基本公式でたどる計算</h3>
                      {current.learning.map((step, i) => (
                        <details key={i} className="learning-step">
                          <summary>
                            {i + 1}. {step.title}
                          </summary>
                          <p>{step.explanation}</p>
                          <Formula tex={step.tex} />
                          <Canvas
                            key={`${diagramKey}-${i}`}
                            diagram={step.diagram}
                            readonly
                            select={() => {}}
                            change={() => {}}
                            setWire={() => {}}
                          />
                          <p className="verified">✓ 元の伝達関数と厳密一致</p>
                        </details>
                      ))}
                      <p className="explanation">{current.learningNote}</p>
                    </section>
                  )}
                  <details className="calculation-details" open>
                    <summary>
                      <span className="step">3</span>計算過程・解説
                    </summary>
                    <p>
                      各要素の出力を x1, x2, …、外部入力を U
                      として、信号方程式を立てます。ブロックの伝達関数と入力符号を反映し、係数行列を
                      A
                      とし、分数なし消去法で行列式を厳密に計算します。出力の列を入力係数に置き換えた行列式との比から
                      Y/U を求めます。
                    </p>
                    {(current ?? candidate?.result) && (
                      <>
                        <div className="equations">
                          {(current ?? candidate!.result).equations.map(
                            (eq, i) => (
                              <div key={i}>{eq}</div>
                            ),
                          )}
                        </div>
                        <h4>行列式から伝達関数を求める</h4>
                        <div className="equations">
                          {(current ?? candidate!.result).derivation.map(
                            (step, i) => (
                              <div key={i}>{step}</div>
                            ),
                          )}
                        </div>
                        <h4>成立条件と注意</h4>
                        <ul>
                          {(current ?? candidate!.result).conditions.map(
                            (c) => (
                              <li key={c}>
                                <code>{c}</code>
                              </li>
                            ),
                          )}
                          {(current ?? candidate!.result).notes.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {currentGenerated?.limitations.map((t) => (
                      <p className="limitation" key={t}>
                        {t}
                      </p>
                    ))}
                  </details>
                  <details className="compare-section">
                    <summary>別の答えと等価か比較する</summary>
                    <p>
                      自分で求めた式を入力してください。係数の特殊な値を除き、有理式の差が厳密に0か確認します。
                    </p>
                    <FractionInput
                      prefix="比較する式"
                      num={cmpNum}
                      den={cmpDen}
                      onChange={(n, d) => {
                        setCmpNum(n);
                        setCmpDen(d);
                      }}
                    />
                    <button
                      className="secondary"
                      onClick={compare}
                      disabled={busy || !cmpNum}
                    >
                      等価性を確認
                    </button>
                    {shownComparison && (
                      <div
                        className={
                          shownComparison.equal
                            ? "comparison yes"
                            : "comparison no"
                        }
                        role="status"
                      >
                        <strong>
                          {shownComparison.equal
                            ? "✓ 有理式として等価です"
                            : "入力された式とは等価ではありません"}
                        </strong>
                        <Formula small tex={shownComparison.tex} />
                        <p>
                          分母が0になる係数条件や内部安定性は別途確認してください。
                        </p>
                        {shownComparison.conditions.map((c) => (
                          <p key={c}>
                            <code>{c}</code>
                          </p>
                        ))}
                      </div>
                    )}
                  </details>
                </>
              ) : (
                <div className="empty-result">
                  <div className="empty-icon" aria-hidden="true">
                    ƒ
                  </div>
                  <h3>
                    {busy
                      ? "記号式を計算しています"
                      : "ここに答えが表示されます"}
                  </h3>
                  <p>
                    {tab === "diagram"
                      ? "線図を編集して、青い計算ボタンを押してください。まずは負帰還の例題で試せます。"
                      : "伝達関数を入力して、青い生成ボタンを押してください。"}
                    {(answer || generated) && " 編集後は再計算してください。"}
                  </p>
                  <div className="result-flow">
                    入力 <span>→</span> 答え <span>→</span> 計算過程
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
        <aside className="ad-slot" aria-label="広告掲載予定スペース">
          <span>広告掲載予定スペース</span>
        </aside>
        <footer>
          <p>
            対応範囲：線形・時不変系の有理伝達関数。遅延・非線形要素・多入力多出力は未対応。指数は
            −12〜12、計算は15秒で打ち切ります。
          </p>
          <p>
            無料・ログイン不要。AI
            APIや外部計算サーバーは使いません。自動保存はこのブラウザ内のみです。重要な図はJSONで保存してください。
          </p>
        </footer>
      </main>
    </>
  );
}
