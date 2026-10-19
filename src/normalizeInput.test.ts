import { it, expect } from "vitest";
import { normalizeFormula, isUnityDenominator } from "./normalizeInput";
import { parse, equal } from "./engine";
it.each([
  ["Ｋ＊（ｓ＋１）", "K*(s+1)"],
  ["ｓ²＋２×ｓ−３", "s^2+2*s-3"],
  ["１÷２", "1/2"],
  ["ｓ⁻²", "s^-2"],
])("全角等を意味を保って正規化 %s", (raw, expected) => {
  expect(normalizeFormula(raw)).toBe(expected);
  expect(equal(parse(raw), parse(expected))).toBe(true);
});
it.each(["１", "1", " 1 ", "(1)", "1.0", ""])(
  "分母 %s を単一ゲイン表示とする",
  (s) => expect(isUnityDenominator(s)).toBe(true),
);
it("分母の一般式を勝手に1に変えない", () => {
  expect(isUnityDenominator("s+1")).toBe(false);
  expect(() => parse("α")).toThrow();
});
