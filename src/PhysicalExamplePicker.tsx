import { physicalExamples, type PhysicalExample } from "./physicalExamples";
export function PhysicalExamplePicker({ onChoose, disabled = false, compact = false }: {
  onChoose: (example: PhysicalExample) => void; disabled?: boolean; compact?: boolean;
}) {
  return <label className={`physical-example-picker ${compact ? "compact" : ""}`}>
    <span className={compact ? "visually-hidden" : undefined}>回路・力学</span>
    <select aria-label="回路・力学の例題" value="" disabled={disabled}
      onChange={(e) => {
        const example = physicalExamples.find((v) => v.id === e.target.value);
        if (example) onChoose(example);
      }}>
      <option value="">{compact ? "回路・力学" : "モデルを選択"}</option>
      {physicalExamples.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
    </select>
  </label>;
}

export function PhysicalExampleGuide({ example, open = false }: { example: PhysicalExample; open?: boolean }) {
  return <details className="physical-example-guide" open={open}>
    <summary>{example.title}：入出力・状態変数・条件</summary>
    <p>{example.description}</p><p>{example.states}</p><p>{example.assumptions}</p>
  </details>;
}
