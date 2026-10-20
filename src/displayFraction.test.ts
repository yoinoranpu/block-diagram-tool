import { it, expect } from "vitest";
import { displayFraction, transfer, latex, equal } from "./engine";
it("画像の分数係数を整数係数と正の最高次係数にそろえる", () => {
  const original = transfer("1", "-s^2/2+5*s/2-3");
  const shown = displayFraction(original);
  expect(shown.n).toBe("-2");
  expect(shown.d).toBe("s^2-5*s+6");
  expect(latex(original, true)).toBe("\\frac{-2}{s^{2}-5s+6}");
  expect(equal(original, shown)).toBe(true);
});
it.each([
  ["1/2", "s/3+2/5"],
  ["K", "a*s^2+b*s+c"],
  ["0", "s+1"],
  ["-1", "-s-2"],
  ["s+1", "2*s+2"],
])("表示の通分と符号調整で値を変えない：%s / %s", (n, d) => {
  const original = transfer(n, d),
    shown = displayFraction(original);
  expect(equal(original, shown)).toBe(true);
  expect(displayFraction(shown)).toEqual(shown);
  expect(shown.n).not.toContain("/");
  expect(shown.d).not.toContain("/");
});
it("sの高次項から表示し、文字係数で割らない", () => {
  const shown = displayFraction(transfer("K", "a*s^2+b*s+c"));
  expect(shown.n).toBe("K");
  expect(shown.d).toContain("a*s^2");
  expect(latex(shown)).toBe("\\frac{K}{a\\,s^{2}+b\\,s+c}");
});

it("因数形を既定にし、展開形も取得できる", () => {
  const value = transfer("-2", "s^2-5*s+6");
  expect(latex(value)).toBe("\\frac{-2}{\\left(s-2\\right)\\left(s-3\\right)}");
  expect(latex(value, true)).toBe("\\frac{-2}{s^{2}-5s+6}");
  expect(latex(transfer("1", "s^2+2*s+1"))).toContain("\\left(s+1\\right)^{2}");
  expect(latex(transfer("-s^2+s+6", "1"))).toContain("\\left(s-3\\right)");
});
