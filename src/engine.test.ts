import { describe, it, expect } from "vitest";
import {
  parse,
  transfer,
  equal,
  solve,
  generate,
  example,
  MathError,
} from "./engine";
describe("厳密な記号演算", () => {
  it("文字係数・高次式・小数を扱う", () => {
    expect(equal(parse("(s+a)*(s+b)"), parse("s^2+(a+b)*s+a*b"))).toBe(true);
    expect(equal(parse("(s^4+2*s^2+1)/(s^2+1)"), parse("s^2+1"))).toBe(true);
    expect(equal(parse("0.1+0.2"), parse("3/10"))).toBe(true);
    expect(equal(parse("-s^2"), parse("-(s^2)"))).toBe(true);
    expect(
      equal(parse("1/(s+a)+1/(s+b)"), parse("(2*s+a+b)/((s+a)*(s+b))")),
    ).toBe(true);
  });
  it("文字係数を数値代入せずに非等価と判定する", () => {
    expect(equal(parse("K/(s+a)"), parse("K/(s+b)"))).toBe(false);
  });
  it.each(["1/0", "sin(s)", "s^99", "2s", "s+", "alert(1)", "i+s", "0^0"])(
    "未対応・不正な式 %s を拒否する",
    (s) => expect(() => parse(s)).toThrow(MathError),
  );
});
describe("線図を連立方程式として解く", () => {
  it.each([
    ["series", "K/((s+a)*(s+b))"],
    ["parallel", "K/(s+a)+1/(s+b)"],
    ["negative", "K/(s+a+K)"],
    ["positive", "K/(s+a-K)"],
    ["multi", "(K*(s+1))/((s^3+a*s^2+b*s+1)*(s+1)+K*(s+1)+K*b)"],
  ] as const)("%s の解析解と厳密に一致する", (kind, expected) => {
    expect(equal(solve(example(kind)).value, parse(expected))).toBe(true);
  });
  it("特異ループを検出する", () => {
    const d = example("positive");
    d.nodes.find((n) => n.id === "g")!.num = "1";
    d.nodes.find((n) => n.id === "g")!.den = "1";
    expect(() => solve(d)).toThrow("特異");
  });
  it("出力が未接続なら拒否する", () => {
    const d = example();
    d.edges = d.edges.filter((e) => e.to !== "y");
    expect(() => solve(d)).toThrow();
  });
});
describe("等価線図の生成と独立した再計算", () => {
  it.each([
    ["K", "(s+a)*(s+b)"],
    ["s^2+2*s+3", "s^3+a*s^2+b*s+1"],
    ["s^2+1", "s^2+2*s+3"],
    ["1", "s^4+1"],
    ["0", "s+1"],
    ["s^2", "s+1"],
  ])("%s / %s", (n, d) => {
    const result = generate(n, d);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const candidate of result.candidates)
      expect(equal(solve(candidate.diagram).value, transfer(n, d))).toBe(true);
  });
  it("成立する生成方式を実際に返す", () => {
    const titles = generate("K", "(s+a)*(s+b)").candidates.map((c) => c.title);
    expect(titles).toEqual([
      "単一ブロック",
      "ゲイン分離",
      "因数による直列構成",
      "積分器による構成",
    ]);
  });
});

describe("係数条件と結合ループ", () => {
  it("約分で消えた分母の条件を保持する", () => {
    expect(transfer("a/a", "1").conditions).toContain("a ≢ 0");
    expect(equal(transfer("a/a", "1"), parse("1"))).toBe(true);
    const d = example("series");
    d.nodes.find((n) => n.id === "g")!.num = "a/a";
    expect(solve(d).conditions).toContain("a ≢ 0");
  });
  it("内側と外側のループが結合する場合も解析解に一致する", async () => {
    const { node, edge } = await import("./model");
    const d = {
      nodes: [
        node("input", "u", 50, 200),
        node("sum", "q1", 150, 200),
        node("block", "g1", 300, 200, "K", "s+a"),
        node("sum", "q2", 450, 200),
        node("block", "g2", 600, 200, "1", "s+b"),
        node("branch", "p", 750, 200),
        node("output", "y", 920, 200),
        node("block", "h1", 400, 450, "c"),
        node("block", "h2", 600, 60, "b", "s+1"),
      ],
      edges: [
        edge("u", "q1"),
        edge("q1", "g1"),
        edge("g1", "q2"),
        edge("q2", "g2"),
        edge("g2", "p"),
        edge("p", "y"),
        edge("p", "h1"),
        edge("h1", "q1", -1),
        edge("p", "h2"),
        edge("h2", "q2", -1),
      ],
    };
    expect(
      equal(solve(d).value, parse("K*(s+1)/((s+a)*((s+b)*(s+1)+b)+K*c*(s+1))")),
    ).toBe(true);
  });
  it("12次までの高次式と零伝達関数を扱う", () => {
    const d = example("series");
    const g = d.nodes.find((n) => n.id === "g")!;
    g.num = "K";
    g.den = "s^12+a*s^3+b";
    expect(equal(solve(d).value, parse("K/((s^12+a*s^3+b)*(s+b))"))).toBe(true);
    g.num = "0";
    expect(solve(d).value.n).toBe("0");
  });
  it("生成を編集用のJSONとして検証可能", () => {
    for (const c of generate("K", "(s+a)*(s+b)").candidates) {
      const d = JSON.parse(JSON.stringify(c.diagram));
      expect(equal(solve(d).value, parse("K/((s+a)*(s+b))"))).toBe(true);
    }
  });
});

it("展開で300文字を超える式も単一ブロックとして生成する", () => {
  const result = generate("K", "(s+a+b+c)^6");
  expect(result.candidates[0].diagram.nodes[1].den).toBe("(s+a+b+c)^6");
  expect(equal(result.candidates[0].result.value, parse("K/(s+a+b+c)^6"))).toBe(
    true,
  );
  expect(result.limitations.length).toBeGreaterThan(0);
});

it("空白の分母は1として計算し、明示的な分母0は拒否する", () => {
  const d = example("series");
  const g = d.nodes.find((n) => n.id === "g")!;
  g.num = "2";
  g.den = "  ";
  expect(equal(solve(d).value, parse("2/(s+b)"))).toBe(true);
  expect(equal(transfer("K", ""), parse("K"))).toBe(true);
  g.den = "0";
  expect(() => solve(d)).toThrow("「G」");
  g.den = "1";
  g.num = "";
  try {
    solve(d);
    throw new Error("expected failure");
  } catch (error) {
    expect((error as Error).message).toContain("分子");
    expect((error as Error & { nodeId: string }).nodeId).toBe("g");
  }
});

it.each(["series", "parallel", "negative", "positive"] as const)(
  "%s の基本公式による各段階が元の線図と厳密に等価",
  (kind) => {
    const result = solve(example(kind));
    expect(result.learning.length).toBeGreaterThan(0);
    for (const step of result.learning)
      expect(equal(solve(step.diagram, false).value, result.value)).toBe(true);
    expect(result.learning.at(-1)!.diagram.nodes).toHaveLength(3);
  },
);
