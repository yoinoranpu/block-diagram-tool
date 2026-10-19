import { describe, it, expect } from "vitest";
import {
  polynomial as p,
  stringify,
  minus,
  times,
  exactDivide,
  determinant,
} from "./polynomial";
describe("多項式の厳密演算とBareiss行列式", () => {
  it("安全整数を超える係数も正確に扱う", () =>
    expect(stringify(p("9007199254740993+1"))).toBe("9007199254740994"));
  it("小数を有理数に変換", () =>
    expect(stringify(p("0.1+0.2-3/10"))).toBe("0"));
  it("多変数の完全除算と非整除を区別", () => {
    const a = p("(s+a)*(s+b)*(K+s)");
    expect(stringify(minus(exactDivide(a, p("(s+a)*(K+s)"))!, p("s+b")))).toBe(
      "0",
    );
    expect(exactDivide(p("s+a"), p("s+b"))).toBeUndefined();
  });
  it("先頭のピボットが0なら行を交換して符号も補正", () => {
    expect(
      stringify(
        determinant([
          [p("0"), p("a")],
          [p("b"), p("s")],
        ]),
      ),
    ).toBe("-a*b");
  });
  it("3x3の文字係数行列式を独立した余因子展開と比較", () => {
    const matrix = [
      ["s", "a", "K"],
      ["b", "s+1", "c"],
      ["1", "b", "s+2"],
    ].map((r) => r.map(p));
    const expected = p("s*((s+1)*(s+2)-b*c)-a*(b*(s+2)-c)+K*(b^2-s-1)");
    expect(stringify(minus(determinant(matrix), expected))).toBe("0");
  });
  it("決定的な数値行列40例を独立した3x3公式と比較", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const m = Array.from({ length: 3 }, (_, i) =>
        Array.from(
          { length: 3 },
          (_, j) => ((seed * (i + 2) * (j + 3) + i * 7 + j * 11) % 19) - 9,
        ),
      );
      const [a, b, c] = m;
      const expected =
        a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0]);
      expect(
        stringify(determinant(m.map((r) => r.map((v) => p(String(v)))))),
      ).toBe(String(expected));
    }
  });
  it("分配法則を文字係数で満たす", () =>
    expect(
      stringify(minus(times(p("s+a"), p("b+c")), p("s*b+s*c+a*b+a*c"))),
    ).toBe("0"));
});
