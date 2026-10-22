import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { normalizeFormula } from "./normalizeInput";
import type { DiagramNode } from "./model";
export function BlockEditor({ block, svg, change, close, cameraKey }: {
  block: DiagramNode;
  svg: RefObject<SVGSVGElement | null>;
  change: (patch: Partial<DiagramNode>) => void;
  close: () => void;
  cameraKey: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, maxHeight: window.innerHeight - 24 });
  useLayoutEffect(() => {
    function place() {
      const matrix = svg.current?.getScreenCTM();
      if (!matrix || !panel.current) return;
      const anchor = new DOMPoint(block.x, block.y).matrixTransform(matrix);
      const right = new DOMPoint(block.x + 64, block.y).matrixTransform(matrix).x;
      const bottom = new DOMPoint(block.x, block.y + 43).matrixTransform(matrix).y;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0, left = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const box = panel.current.getBoundingClientRect();
      const preferredX = right + 12 + box.width <= left + width - 12
        ? right + 12 : anchor.x - box.width / 2;
      const preferredY = right + 12 + box.width <= left + width - 12
        ? anchor.y - box.height / 2 : bottom + 12;
      setPosition({
        maxHeight: Math.max(100, height - 24),
        left: Math.max(left + 12, Math.min(preferredX, left + width - box.width - 12)),
        top: Math.max(top + 12, Math.min(preferredY, top + height - box.height - 12)),
      });
    }
    place();
    const resize = new ResizeObserver(place);
    if (panel.current) resize.observe(panel.current);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      resize.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [block.id, block.x, block.y, cameraKey]);
  return createPortal(<div ref={panel} className="block-editor-popover" role="region"
    aria-label="ブロックを編集" style={position}
    onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") close(); }}>
    <div className="block-editor-heading"><strong>ブロックを編集</strong>
      <button aria-label="編集欄を閉じる" onClick={close}>完了</button>
    </div>
    <label>名前<input aria-label="ブロックの名前" value={block.label} maxLength={30}
      onChange={(e) => change({ label: e.target.value })} /></label>
    {(["num", "den"] as const).map((field) => <label key={field}>
      {field === "num" ? "分子" : "分母"}
      <input aria-label={`選択ブロックの${field === "num" ? "分子" : "分母"}`}
        value={block[field]} placeholder={field === "den" ? "空欄は1" : "例：K、s+1"}
        maxLength={300} autoCapitalize="off" autoCorrect="off" spellCheck={false}
        onChange={(e) => change({ [field]: (e.nativeEvent as InputEvent).isComposing
          ? e.target.value : normalizeFormula(e.target.value) })}
        onCompositionEnd={(e) => change({ [field]: normalizeFormula(e.currentTarget.value) })} />
    </label>)}
    <p>分母は空欄でも1として計算します。掛け算は *。</p>
  </div>, document.body);
}
