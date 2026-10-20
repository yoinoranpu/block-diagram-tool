import { useEffect, useRef, useState } from "react";
import { calculate } from "./mathClient";
import { normalizeFormula } from "./normalizeInput";
import {
  validateStateSpace,
  type StateSpaceInput,
  type StateSpaceResult,
} from "./stateSpaceModel";
import { StateSpaceDiagram } from "./StateSpaceDiagram";
import { Formula } from "./Formula";
const example: StateSpaceInput = {
  A: [
    ["0", "1"],
    ["-b", "-a"],
  ],
  B: ["0", "K"],
  C: ["1", "0"],
  D: "0",
};
const storage = "control-state-space-v1";
function initial() {
  try {
    const raw = localStorage.getItem(storage);
    return raw
      ? validateStateSpace(JSON.parse(raw), true)
      : structuredClone(example);
  } catch {
    return structuredClone(example);
  }
}
export function StateSpaceWorkspace() {
  const [data, setData] = useState<StateSpaceInput>(initial),
    [response, setResponse] = useState<{
      key: string;
      result: StateSpaceResult;
    }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const file = useRef<HTMLInputElement>(null),
    request = useRef(0),
    resultPanel = useRef<HTMLElement>(null),
    key = JSON.stringify(data),
    result = response?.key === key ? response.result : undefined;
  useEffect(() => {
    try {
      localStorage.setItem(storage, key);
    } catch {
      setNotice("自動保存できません。JSONで保存してください。");
    }
  }, [key]);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const n = data.A.length;
  function resize(size: number) {
    setData({
      A: Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => data.A[i]?.[j] ?? "0"),
      ),
      B: Array.from({ length: size }, (_, i) => data.B[i] ?? "0"),
      C: Array.from({ length: size }, (_, i) => data.C[i] ?? "0"),
      D: data.D,
    });
  }
  function update(
    matrix: "A" | "B" | "C" | "D",
    i: number,
    j: number,
    value: string,
  ) {
    setData((d) =>
      matrix === "A"
        ? {
            ...d,
            A: d.A.map((row, r) =>
              row.map((v, c) => (r === i && c === j ? value : v)),
            ),
          }
        : matrix === "D"
          ? { ...d, D: value }
          : { ...d, [matrix]: d[matrix].map((v, r) => (r === i ? value : v)) },
    );
  }
  function cell(
    matrix: "A" | "B" | "C" | "D",
    i: number,
    j: number,
    value: string,
  ) {
    const label =
      matrix === "A"
        ? `A(${i + 1},${j + 1})`
        : matrix === "D"
          ? "D"
          : `${matrix}(${i + 1})`;
    return (
      <input
        aria-label={label}
        value={value}
        maxLength={300}
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) =>
          update(
            matrix,
            i,
            j,
            (e.nativeEvent as InputEvent).isComposing
              ? e.target.value
              : normalizeFormula(e.target.value),
          )
        }
        onCompositionEnd={(e) =>
          update(matrix, i, j, normalizeFormula(e.currentTarget.value))
        }
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (matrix !== "A" || !/[\t\n]/.test(text)) return;
          const rows = text
            .trim()
            .split(/\r?\n/)
            .map((row) => row.split("\t"));
          if (rows.length + i > n || rows.some((row) => row.length + j > n)) {
            e.preventDefault();
            setError("貼り付ける範囲がAのサイズを超えています。");
            return;
          }
          e.preventDefault();
          setData((d) => ({
            ...d,
            A: d.A.map((row, r) =>
              row.map((v, c) =>
                rows[r - i]?.[c - j] === undefined
                  ? v
                  : normalizeFormula(rows[r - i][c - j]),
              ),
            ),
          }));
        }}
      />
    );
  }
  async function run() {
    const id = ++request.current;
    setBusy(true);
    setError("");
    try {
      const result = await calculate<StateSpaceResult>("stateSpace", {
        state: data,
      });
      if (id === request.current) {
        setResponse({ key, result });
        resultPanel.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    } catch (e) {
      if (id === request.current) setError((e as Error).message);
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  function save() {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ version: 1, type: "state-space", ...data }, null, 2)],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "state-space.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function load(f?: File) {
    if (!f) return;
    try {
      if (f.size > 100000) throw new Error("JSONファイルが大きすぎます。");
      const v = JSON.parse(await f.text());
      if (v.version !== 1 || v.type !== "state-space")
        throw new Error("状態空間表現のJSONを選んでください。");
      setData(validateStateSpace(v, true));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  return (
    <div className="workspace state-workspace">
      <section className="panel input-panel">
        <div className="panel-heading">
          <h2>
            <span className="step">1</span>状態空間表現を入力
          </h2>
        </div>
        <div className="state-input">
          <p>dx/dt = Ax + Bu、y = Cx + Du</p>
          <p className="field-hint">
            初期値0・1入力1出力。状態数1〜3、文字係数・分数に対応。係数にsは使えません。掛け算は
            *。空欄には0を入力してください。
          </p>
          <div className="state-actions">
            <label>
              状態数{" "}
              <select
                aria-label="状態数"
                value={n}
                onChange={(e) => resize(Number(e.target.value))}
              >
                {[1, 2, 3].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => setData(structuredClone(example))}>
              2次の例題
            </button>
            <button
              onClick={() =>
                setData({
                  A: [
                    ["0", "1", "0"],
                    ["0", "0", "1"],
                    ["-c", "-b", "-a"],
                  ],
                  B: ["0", "0", "K"],
                  C: ["1", "0", "0"],
                  D: "0",
                })
              }
            >
              3次の例題
            </button>
          </div>
          <div className="matrix-fields">
            <fieldset>
              <legend>
                A（{n}×{n}）
              </legend>
              <table>
                <tbody>
                  {data.A.map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td key={j}>{cell("A", i, j, v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </fieldset>
            <fieldset>
              <legend>B（{n}×1）</legend>
              {data.B.map((v, i) => (
                <div key={i}>{cell("B", i, 0, v)}</div>
              ))}
            </fieldset>
            <fieldset>
              <legend>C（1×{n}）</legend>
              <div className="matrix-row">
                {data.C.map((v, i) => (
                  <span key={i}>{cell("C", i, 0, v)}</span>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>D（1×1）</legend>
              {cell("D", 0, 0, data.D)}
            </fieldset>
          </div>
          <p className="field-hint">
            Aは表計算から複数セルを貼り付けることもできます。入力はこのブラウザ内に自動保存します。
          </p>
          <div className="state-actions">
            <button onClick={save}>行列をJSON保存</button>
            <button onClick={() => file.current?.click()}>
              行列をJSON読込
            </button>
            <input
              type="file"
              accept="application/json,.json"
              ref={file}
              hidden
              onChange={(e) => load(e.target.files?.[0])}
            />
          </div>
          {notice && <p role="status">{notice}</p>}
          <button className="primary" disabled={busy} onClick={run}>
            {busy ? "計算しています…" : "伝達関数と状態変数線図を求める"}
          </button>
        </div>
      </section>
      <aside className="panel result-panel" ref={resultPanel}>
        <div className="panel-heading">
          <h2>
            <span className="step">2</span>答えを確かめる
          </h2>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {result ? (
          <>
            <div className="result-card">
              <div className="result-caption">
                全体の伝達関数
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.expression);
                      setNotice("式をコピーしました。");
                    } catch {
                      setNotice("テキスト式を選択してコピーしてください。");
                    }
                  }}
                >
                  式をコピー
                </button>
              </div>
              <div className="result-formula">
                <span>G(s) =</span>
                <Formula tex={result.tex} />
              </div>
              <details className="expanded-expression">
                <summary>展開形を表示</summary>
                <Formula tex={result.expandedTex} />
              </details>
              <details className="text-expression">
                <summary>テキスト式を表示</summary>
                <code>{result.expression}</code>
              </details>
              <p className="result-status">
                初期値0の入出力関係として厳密計算済み
              </p>
            </div>
          </>
        ) : (
          <div className="empty-result">
            <h3>
              {response
                ? "行列を編集しました。再計算してください。"
                : "行列を入力して計算してください"}
            </h3>
            <p>伝達関数→状態変数線図→計算過程の順に表示します。</p>
          </div>
        )}
      </aside>
      {result && (
        <section className="panel state-output state-output-wide">
          <h3>入力した行列の状態変数線図</h3>
          <StateSpaceDiagram data={result.coefficients} />
          <details>
            <summary>計算過程・成立条件</summary>
            <p>G(s) = C(sI−A)⁻¹B + D</p>
            <p>
              初期値を0として (sI−A)X = BU を解き、Y = CX + DU
              に代入します。逆行列の数値近似を使わず、行列式で有理式を計算しています。
            </p>
            <code>det(sI−A) = {result.determinant}</code>
            <p>
              逆行列の式はdet(sI−A) ≠
              0の範囲で成立し、答えは有理伝達関数として扱います。
            </p>
            {result.conditions.map((c) => (
              <p key={c}>{c}</p>
            ))}
            {result.equations.map((e) => (
              <pre key={e}>{e}</pre>
            ))}
            <p>
              極零相殺がある場合、伝達関数だけでは内部状態の安定性を判断できません。非ゼロ初期値、時変系、多入力多出力は未対応です。
            </p>
          </details>
        </section>
      )}
    </div>
  );
}
