import nerdamer from "nerdamer/all.js";
import {
  polynomial,
  stringify,
  normalize,
  determinant,
  plus,
  minus,
  times,
  constant,
  type P,
} from "./polynomial";

export { MathError } from "./errors";
import { MathError } from "./errors";
import {
  validateDiagram,
  node,
  edge,
  type Diagram,
  type DiagramNode,
  type Edge,
} from "./model";
export { example, validateDiagram } from "./model";
export type { Diagram, DiagramNode, Edge, Kind } from "./model";
export type Fraction = { n: string; d: string; conditions?: string[] };
const expand = (s: string): string => stringify(polynomial(s));
const zero = (s: string) => expand(s) === "0";
function guard(f: Fraction): Fraction {
  if (f.n.length + f.d.length > 18000)
    throw new MathError(
      "式が大きすぎます。ブロック数や式を簡単にしてください。",
    );
  return f;
}
export function fraction(n: string, d = "1"): Fraction {
  n = expand(n);
  d = expand(d);
  if (d === "0")
    throw new MathError(
      "分母が恒等的に0です。式または接続を確認してください。",
    );
  if (n === "0") return { n: "0", d: "1" };
  const normalized = normalize(polynomial(n), polynomial(d));
  n = stringify(normalized.n);
  d = stringify(normalized.d);
  return guard({ n, d });
}
const inherit = (result: Fraction, ...args: Fraction[]): Fraction => ({
  ...result,
  conditions: [...new Set(args.flatMap((a) => a.conditions ?? []))],
});
export const add = (a: Fraction, b: Fraction) =>
  inherit(
    fraction(`(${a.n})*(${b.d})+(${b.n})*(${a.d})`, `(${a.d})*(${b.d})`),
    a,
    b,
  );
export const neg = (a: Fraction) => ({ ...a, n: expand(`-(${a.n})`) });
export const sub = (a: Fraction, b: Fraction) => add(a, neg(b));
export const mul = (a: Fraction, b: Fraction) =>
  inherit(fraction(`(${a.n})*(${b.n})`, `(${a.d})*(${b.d})`), a, b);
export const div = (a: Fraction, b: Fraction) => {
  const result = inherit(
    fraction(`(${a.n})*(${b.d})`, `(${a.d})*(${b.n})`),
    a,
    b,
  );
  if (/[A-Za-z]/.test(b.n))
    result.conditions = [
      ...new Set([...(result.conditions ?? []), `${b.n} ≢ 0`]),
    ];
  return result;
};
export const text = (a: Fraction) => (a.d === "1" ? a.n : `(${a.n})/(${a.d})`);
export const latex = (a: Fraction) =>
  a.d === "1"
    ? nerdamer(a.n).toTeX()
    : `\\frac{${nerdamer(a.n).toTeX()}}{${nerdamer(a.d).toTeX()}}`;
export const equal = (a: Fraction, b: Fraction) =>
  zero(`(${a.n})*(${b.d})-(${b.n})*(${a.d})`);
const ONE: Fraction = { n: "1", d: "1" };

// Deliberately small grammar: rational operations only. No eval, function calls or CAS commands.
export function parse(input: string): Fraction {
  if (!input.trim() || input.length > 300)
    throw new MathError("式を1〜300文字で入力してください。");
  const source = input.replace(/\s+/g, "");
  const tokens = source.match(/(?:\d+(?:\.\d+)?|[A-Za-z]|[()+\-*/^])/g) ?? [];
  if (tokens.join("") !== source)
    throw new MathError(
      "使えるのは数値、半角英字1文字の係数、s、+ − * / ^ と括弧です。",
    );
  if (tokens.some((t) => ["i", "e", "E"].includes(t)))
    throw new MathError(
      "i・e・E は予約文字です。係数には K、a、b などを使ってください。",
    );
  let pos = 0;
  function atom(): Fraction {
    const t = tokens[pos++];
    if (t === "(") {
      const a = sum();
      if (tokens[pos++] !== ")") throw new MathError("括弧が閉じていません。");
      return a;
    }
    if (t && /^(?:\d+(?:\.\d+)?|[A-Za-z])$/.test(t)) return fraction(t);
    throw new MathError(
      "式の構文を確認してください。掛け算には * を使います。",
    );
  }
  function power(): Fraction {
    let a = atom();
    if (tokens[pos] === "^") {
      pos++;
      let sign = 1;
      if (tokens[pos] === "-") {
        sign = -1;
        pos++;
      }
      const t = tokens[pos++];
      if (!t || !/^\d+$/.test(t) || Number(t) > 12)
        throw new MathError("指数は −12〜12 の整数に対応しています。");
      const p = Number(t) * sign;
      if (p === 0) {
        if (a.n === "0") throw new MathError("0^0 は未定義です。");
        return inherit(ONE, a);
      }
      const old = a;
      a = inherit(
        p > 0
          ? fraction(`(${a.n})^${p}`, `(${a.d})^${p}`)
          : fraction(`(${a.d})^${-p}`, `(${a.n})^${-p}`),
        old,
      );
      if (p < 0 && /[A-Za-z]/.test(old.n))
        a.conditions = [...new Set([...(a.conditions ?? []), `${old.n} ≢ 0`])];
    }
    return a;
  }
  function unary(): Fraction {
    if (tokens[pos] === "+") {
      pos++;
      return unary();
    }
    if (tokens[pos] === "-") {
      pos++;
      return neg(unary());
    }
    return power();
  }
  function product(): Fraction {
    let a = unary();
    while (tokens[pos] === "*" || tokens[pos] === "/") {
      const op = tokens[pos++];
      const b = unary();
      a = op === "*" ? mul(a, b) : div(a, b);
    }
    return a;
  }
  function sum(): Fraction {
    let a = product();
    while (tokens[pos] === "+" || tokens[pos] === "-") {
      const op = tokens[pos++];
      const b = product();
      a = op === "+" ? add(a, b) : sub(a, b);
    }
    return a;
  }
  const result = sum();
  if (pos !== tokens.length)
    throw new MathError(
      "式を読み取れません。掛け算には * を使ってください（例：K*(s+a)）。",
    );
  return result;
}
export function transfer(num: string, den: string): Fraction {
  return div(parse(num), parse(den));
}

export type Analysis = {
  value: Fraction;
  tex: string;
  expression: string;
  equations: string[];
  derivation: string[];
  conditions: string[];
  notes: string[];
};
export function solve(diagram: Diagram): Analysis {
  const d = validateDiagram(diagram);
  const inputs = d.nodes.filter((n) => n.kind === "input");
  const outputs = d.nodes.filter((n) => n.kind === "output");
  if (inputs.length !== 1 || outputs.length !== 1)
    throw new MathError(
      "入力と出力をそれぞれ1つ配置してください（初版は1入力1出力）。",
    );
  for (const n of d.nodes) {
    const incoming = d.edges.filter((e) => e.to === n.id);
    if (n.kind === "input" && incoming.length)
      throw new MathError("入力への配線はできません。");
    if (n.kind !== "input" && n.kind !== "sum" && incoming.length !== 1)
      throw new MathError(
        `${n.label} の入力配線は1本にしてください。合流には加算点を使います。`,
      );
    if (n.kind === "sum" && !incoming.length)
      throw new MathError("加算点に入力を接続してください。");
    if (n.kind === "output" && d.edges.some((e) => e.from === n.id))
      throw new MathError("出力から配線できません。分岐点を使ってください。");
    if (incoming.some((e) => e.sign === -1) && n.kind !== "sum")
      throw new MathError("負符号は加算点の入力だけで指定できます。");
  }
  const reached = new Set([inputs[0].id]);
  for (let i = 0; i < d.nodes.length; i++)
    for (const e of d.edges) if (reached.has(e.from)) reached.add(e.to);
  if (!reached.has(outputs[0].id))
    throw new MathError("入力から出力まで配線がつながっていません。");
  if (reached.size !== d.nodes.length)
    throw new MathError(
      "入力から到達できない要素があります。未使用の要素を削除するか接続してください。",
    );
  const nodes = d.nodes.filter((n) => n.kind !== "input");
  const gains = nodes.map((n) => {
    if (n.kind !== "block") return ONE;
    for (const [field, label] of [
      ["num", "分子"],
      ["den", "分母"],
    ] as const) {
      try {
        parse(n[field]);
      } catch (error) {
        throw Object.assign(
          new MathError(
            `「${n.label}」の${label}：${n[field].trim() ? (error as Error).message : `未入力です。${field === "den" ? "定数ゲインなら分母に 1 を入力してください。" : "分子を入力してください。"}`}`,
          ),
          { nodeId: n.id },
        );
      }
    }
    try {
      return transfer(n.num, n.den);
    } catch (error) {
      throw Object.assign(
        new MathError(`「${n.label}」：${(error as Error).message}`),
        { nodeId: n.id },
      );
    }
  });
  const conditions = new Set<string>(gains.flatMap((g) => g.conditions ?? []));
  for (const n of d.nodes.filter((n) => n.kind === "block")) {
    const numerator = parse(n.num),
      denominator = parse(n.den);
    for (const expression of [numerator.d, denominator.d, denominator.n])
      if (/[A-Za-z]/.test(expression)) conditions.add(`${expression} ≢ 0`);
  }
  // Clear each row's gain denominator, then solve by fraction-free Bareiss
  // determinants (Cramer's rule for the selected output). All coefficients are exact Q.
  const a: P[][] = nodes.map((_, i) =>
    nodes.map((__, j) => (i === j ? polynomial(gains[i].d) : constant(0n))),
  );
  const b: P[] = nodes.map(() => constant(0n));
  const equations: string[] = [];
  nodes.forEach((n, i) => {
    const terms: string[] = [];
    for (const e of d.edges.filter((e) => e.to === n.id)) {
      const g = times(constant(BigInt(e.sign)), polynomial(gains[i].n));
      const j = nodes.findIndex((v) => v.id === e.from);
      if (j < 0) b[i] = plus(b[i], g);
      else a[i][j] = minus(a[i][j], g);
      terms.push(`${e.sign === -1 ? "−" : "+"}${j < 0 ? "U" : `x${j + 1}`}`);
    }
    equations.push(
      `x${i + 1} [${n.label}] = (${text(gains[i])}) × (${terms.join(" ").replace(/^\+/, "")})`,
    );
  });
  const det = determinant(a);
  if (det.size === 0)
    throw new MathError(
      "連立方程式が特異です。出力が一意に定まりません（例：正帰還のループゲインが1）。",
    );
  const detText = stringify(det);
  if (/[A-Za-z]/.test(detText)) conditions.add(`${detText} ≢ 0`);
  const outIndex = nodes.findIndex((n) => n.id === outputs[0].id);
  const replaced = a.map((row, i) =>
    row.map((v, j) => (j === outIndex ? b[i] : v)),
  );
  const numerator = stringify(determinant(replaced));
  const result = fraction(numerator, detText);
  const derivation = [
    `出力 Y = x${outIndex + 1}`,
    `D = det(A) = ${detText}`,
    `D_Y = det(Aの出力列を入力係数で置換) = ${numerator}`,
    `Y/U = D_Y/D = ${text(result)}`,
  ];
  return {
    value: result,
    tex: latex(result),
    expression: text(result),
    equations,
    derivation,
    conditions: [...conditions],
    notes: [
      "初期値0の線形・時不変系として、各要素の信号方程式を有理式の厳密演算で解いています。",
      "≢ 0 は s の式として恒等的に0でない条件です。係数の特殊な値で条件が崩れる場合は、その値を代入して再計算してください。",
      "入出力の伝達関数の一致を検証します。内部安定性・実現の最小性・極零相殺後の内部状態は保証しません。",
    ],
  };
}

export type Candidate = {
  title: string;
  explanation: string;
  diagram: Diagram;
  result: Analysis;
};
function chain(blocks: Fraction[]): Diagram {
  const folded = blocks.length > 4;
  const nodes = [
    node("input", "u", 60, folded ? 170 : 220),
    ...blocks.map((g, i) => {
      const second = i >= 4;
      const x = folded
        ? second
          ? 760 - (i - 4) * 180
          : 220 + i * 180
        : blocks.length === 1
          ? 500
          : 220 + (i * 560) / (blocks.length - 1);
      const n = node(
        "block",
        `g${i}`,
        x,
        folded ? (second ? 430 : 170) : 220,
        g.n,
        g.d,
      );
      if (second) n.reversed = true;
      return n;
    }),
    node("output", "y", folded ? 60 : 950, folded ? 430 : 220),
  ];
  if (folded) nodes.at(-1)!.reversed = true;
  return {
    nodes,
    edges: nodes.slice(1).map((n, i) => edge(nodes[i].id, n.id)),
  };
}
function coefficients(p: string): string[] {
  const terms = polynomial(p);
  const result: P[] = [];
  for (const [key, value] of terms) {
    const parts = key ? key.split(",") : [];
    const s = parts.find((t) => t.startsWith("s:"));
    const degree = s ? Number(s.slice(2)) : 0;
    while (result.length <= degree) result.push(new Map());
    result[degree].set(
      parts.filter((t) => !t.startsWith("s:")).join(","),
      value,
    );
  }
  return result.length ? result.map(stringify) : ["0"];
}
export function generate(
  num: string,
  den: string,
): {
  original: Fraction;
  tex: string;
  candidates: Candidate[];
  limitations: string[];
} {
  const original = transfer(num, den);
  const candidates: Candidate[] = [],
    limitations: string[] = [];
  const accept = (title: string, explanation: string, diagram: Diagram) => {
    try {
      const result = solve(diagram);
      result.conditions = [
        ...new Set([...(original.conditions ?? []), ...result.conditions]),
      ];
      if (!equal(original, result.value))
        throw new MathError("生成線図の再計算が一致しませんでした。");
      candidates.push({ title, explanation, diagram, result });
    } catch (err) {
      if (title === "単一ブロック") throw err;
      limitations.push(
        `${title}：${err instanceof Error ? err.message : "再計算できませんでした。"} この構成は表示していません。`,
      );
    }
  };
  const single = chain([original]);
  // Preserve the user's compact input; expanding it can exceed the editor's 300-character limit.
  single.nodes[1].num = num;
  single.nodes[1].den = den;
  accept(
    "単一ブロック",
    "入力した伝達関数をそのまま1つのブロックにします。",
    single,
  );
  const ns = coefficients(original.n),
    ds = coefficients(original.d);
  const gain = div(fraction(ns.at(-1)!), fraction(ds.at(-1)!));
  if (gain.n !== "0" && !equal(gain, ONE))
    accept(
      "ゲイン分離",
      "分子・分母の最高次係数の比を独立したゲインとして取り出します。",
      chain([gain, div(original, gain)]),
    );
  else
    limitations.push(
      "ゲイン分離：最高次係数の比が1、または零伝達関数のため省略しました。",
    );
  try {
    if (original.n.length + original.d.length > 400)
      throw new MathError("式が因数分解の初版上限を超えています。");
    const factors: Fraction[] = [];
    for (const [poly, invert] of [
      [original.n, false],
      [original.d, true],
    ] as const) {
      const factored = nerdamer.factor(poly).toString();
      // A factored expression is split only at top-level multiplication signs.
      let depth = 0,
        start = 0;
      const pieces: string[] = [];
      for (let i = 0; i < factored.length; i++) {
        if (factored[i] === "(") depth++;
        if (factored[i] === ")") depth--;
        if (factored[i] === "*" && depth === 0) {
          pieces.push(factored.slice(start, i));
          start = i + 1;
        }
      }
      pieces.push(factored.slice(start));
      for (const piece of pieces) {
        const f = parse(piece);
        if (!equal(f, ONE)) factors.push(invert ? div(ONE, f) : f);
      }
    }
    if (factors.length >= 2 && factors.length <= 8)
      accept(
        "因数による直列構成",
        "記号計算で得た分子・分母の因子を直列に配置します。各ブロック単体がプロパーとは限りません。",
        chain(factors),
      );
    else
      limitations.push(
        "因数分解：有理係数・文字係数の範囲で、別の直列構成を作れる因子が見つかりませんでした。",
      );
  } catch {
    limitations.push(
      "因数分解：この式の因数分解は未対応、または生成上限を超えました。",
    );
  }
  const order = ds.length - 1;
  if (
    order >= 1 &&
    order <= 3 &&
    ns.length <= ds.length &&
    original.n !== "0"
  ) {
    const leading = fraction(ds.at(-1)!);
    const a = ds.map((c) => div(fraction(c), leading));
    const b = Array.from({ length: order + 1 }, (_, i) =>
      div(fraction(ns[i] ?? "0"), leading),
    );
    const direct = b[order];
    const d: Diagram = {
      nodes: [
        node("input", "u", 65, 280),
        node("sum", "q", 200, 280),
        node("sum", "z", 870, 510),
        node("output", "y", 970, 510),
      ],
      edges: [edge("u", "q"), edge("z", "y")],
    };
    for (let i = 1; i <= order; i++) {
      d.nodes.push(node("block", `i${i}`, 250 + i * 175, 280, "1", "s"));
      d.edges.push(edge(i === 1 ? "q" : `i${i - 1}`, `i${i}`));
      const feedback = a[order - i];
      if (feedback.n !== "0") {
        d.nodes.push(
          node("block", `a${i}`, 250 + i * 175, 85, feedback.n, feedback.d),
        );
        d.edges.push(edge(`i${i}`, `a${i}`), edge(`a${i}`, "q", -1));
      }
      const outGain = sub(b[order - i], mul(direct, a[order - i]));
      if (outGain.n !== "0") {
        d.nodes.push(
          node("block", `b${i}`, 200 + i * 175, 510, outGain.n, outGain.d),
        );
        d.edges.push(edge(`i${i}`, `b${i}`), edge(`b${i}`, "z"));
      }
    }
    if (direct.n !== "0") {
      d.nodes.push(node("block", "direct", 200, 560, direct.n, direct.d));
      d.edges.push(edge("u", "direct"), edge("direct", "z"));
    }
    d.nodes
      .filter((n) => /^a[0-9]+$/.test(n.id))
      .forEach((n) => {
        n.reversed = true;
      });
    accept(
      "積分器による構成",
      "可制御正準形の積分器連鎖です。分母を最高次係数で正規化し、状態からの帰還と出力の重みを構成します。",
      d,
    );
  } else
    limitations.push(
      "積分器構成：初版では分母1〜3次のプロパーな有理関数に対応します。高次式の計算・単一ブロック生成は利用できます。",
    );
  return { original, tex: latex(original), candidates, limitations };
}
