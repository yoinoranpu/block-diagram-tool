import { useRef, useState, useEffect } from "react";
import { calculate } from "./mathClient";
import { Formula } from "./Formula";
import type { Fraction } from "./engine";
import type { Realization } from "./realization";
export function RealizationPanel({ value }: { value: Fraction }) {
  const [result, setResult] = useState<Realization>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  async function run() {
    const id = ++request.current;
    setBusy(true); setError("");
    try {
      const data = await calculate<Realization>("realize", { num: value.n, den: value.d });
      if (request.current === id) setResult(data);
    } catch (e) {
      if (request.current === id) setError((e as Error).message);
    } finally {
      if (request.current === id) setBusy(false);
    }
  }
  return <section className="realization-section" aria-label="伝達関数から状態空間表現">
    <button className="secondary" disabled={busy} onClick={run}>
      {busy ? "状態空間表現を計算中…" : "状態空間表現を求める"}
    </button>
    {error && <p role="alert" className="error">{error}</p>}
    {result && <div className="realization-result">
      <h3>状態空間表現{result.order ? `（${result.order}状態・可制御正準形）` : "（状態なし）"}</h3>
      <p className="verified">✓ C(sI−A)⁻¹B+D からの再計算で厳密一致</p>
      <p>ẋ = Ax + Bu、y = Cx + Du</p>
      {result.matrices.map((m) => <div className="realization-matrix" key={m.name}>
        <span>{m.name} = </span><Formula tex={m.tex} />
      </div>)}
      <p className="field-hint">{result.order
        ? "初期値0で同じ入出力関係を持つ実現の一例です。実現は一意ではなく、最小とは限りません。元の線図と同じ内部状態を復元するものではありません。"
        : "定数ゲインなので状態変数は不要です。y = Du と表せます。"}</p>
      {!!result.conditions.length && <details><summary>係数の成立条件</summary>
        <ul>{result.conditions.map((v) => <li key={v}>{v}</li>)}</ul>
      </details>}
    </div>}
    {!result && <p className="field-hint">文字係数を含むプロパーな有理伝達関数・分母8次まで対応。変換後に伝達関数へ戻して検算します。</p>}
  </section>;
}
