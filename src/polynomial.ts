// Sparse multivariate polynomials over Q. BigInt rational coefficients, no floats.
export type Q = { n: bigint; d: bigint };
export type P = Map<string, Q>;
const abs = (n: bigint) => (n < 0n ? -n : n);
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
function q(n: bigint, d = 1n): Q {
  if (!d) throw new Error("分母が0です。");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const qa = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const qm = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const qd = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
export const constant = (n: bigint): P =>
  n ? new Map([["", q(n)]]) : new Map();
export const isZero = (p: P) => p.size === 0;
const exps = (k: string) =>
  new Map(
    k
      ? k.split(",").map((t) => {
          const [v, p] = t.split(":");
          return [v, Number(p)] as const;
        })
      : [],
  );
const key = (m: Map<string, number>) =>
  [...m]
    .filter(([, p]) => p)
    .sort(([a], [b]) => a.localeCompare(b, "en", { sensitivity: "variant" }))
    .map(([v, p]) => `${v}:${p}`)
    .join(",");
function keyMul(a: string, b: string) {
  const m = exps(a);
  for (const [v, p] of exps(b)) m.set(v, (m.get(v) ?? 0) + p);
  return key(m);
}
function keyDiv(a: string, b: string): string | undefined {
  const m = exps(a);
  for (const [v, p] of exps(b)) {
    const next = (m.get(v) ?? 0) - p;
    if (next < 0) return undefined;
    m.set(v, next);
  }
  return key(m);
}
function check(p: P): P {
  if (p.size > 1800)
    throw new Error(
      "展開後の項が多すぎます（上限1800項）。式を簡単にしてください。",
    );
  return p;
}
function put(p: P, k: string, v: Q) {
  const next = qa(p.get(k) ?? q(0n), v);
  if (next.n) p.set(k, next);
  else p.delete(k);
}
export function plus(a: P, b: P): P {
  const p = new Map(a);
  for (const [k, v] of b) put(p, k, v);
  return check(p);
}
export function minus(a: P, b: P): P {
  return plus(a, new Map([...b].map(([k, v]) => [k, { n: -v.n, d: v.d }])));
}
export function times(a: P, b: P): P {
  const p: P = new Map();
  for (const [ka, va] of a)
    for (const [kb, vb] of b) put(p, keyMul(ka, kb), qm(va, vb));
  return check(p);
}
function compare(a: string, b: string): number {
  const x = exps(a),
    y = exps(b);
  const dx = [...x.values()].reduce((a, b) => a + b, 0),
    dy = [...y.values()].reduce((a, b) => a + b, 0);
  if (dx !== dy) return dx - dy;
  const vars = [...new Set([...x.keys(), ...y.keys()])].sort();
  for (const v of vars) {
    const diff = (x.get(v) ?? 0) - (y.get(v) ?? 0);
    if (diff) return diff;
  }
  return 0;
}
const lead = (p: P): [string, Q] =>
  [...p].reduce((a, b) => (compare(a[0], b[0]) > 0 ? a : b));
export function exactDivide(a: P, b: P): P | undefined {
  if (!b.size) throw new Error("多項式を0で除算できません。");
  let rest = new Map(a);
  const out: P = new Map(),
    [kb, vb] = lead(b);
  let count = 0;
  while (rest.size) {
    if (++count > 4000) throw new Error("多項式除算の計算上限を超えました。");
    const [ka, va] = lead(rest),
      k = keyDiv(ka, kb);
    if (k === undefined) return undefined;
    const term = new Map([[k, qd(va, vb)]]);
    put(out, k, qd(va, vb));
    rest = minus(rest, times(b, term));
  }
  return check(out);
}
export function polynomial(input: string): P {
  const t =
    input.replace(/\s+/g, "").match(/\d+(?:\.\d+)?|[A-Za-z]|[()+\-*/^]/g) ?? [];
  let i = 0;
  function atom(): P {
    const c = t[i++];
    if (c === "(") {
      const p = sum();
      if (t[i++] !== ")") throw new Error("多項式の括弧エラー");
      return p;
    }
    if (c && /^\d/.test(c)) {
      const [a, b = ""] = c.split(".");
      return BigInt(a + b) !== 0n
        ? new Map([["", q(BigInt(a + b), 10n ** BigInt(b.length))]])
        : new Map();
    }
    if (c && /^[A-Za-z]$/.test(c)) return new Map([[`${c}:1`, q(1n)]]);
    throw new Error("多項式の構文エラー");
  }
  function power(): P {
    let a = atom();
    if (t[i] === "^") {
      i++;
      let par = false;
      if (t[i] === "(") {
        par = true;
        i++;
      }
      const p = Number(t[i++]);
      if (!Number.isInteger(p) || p < 0 || p > 200)
        throw new Error("多項式の次数上限を超えました。");
      if (par && t[i++] !== ")") throw new Error("指数の構文エラー");
      let v = constant(1n);
      for (let j = 0; j < p; j++) v = times(v, a);
      a = v;
    }
    return a;
  }
  function unary(): P {
    if (t[i] === "+") {
      i++;
      return unary();
    }
    if (t[i] === "-") {
      i++;
      return minus(constant(0n), unary());
    }
    return power();
  }
  function product(): P {
    let a = unary();
    while (t[i] === "*" || t[i] === "/") {
      const op = t[i++],
        b = unary();
      if (op === "*") a = times(a, b);
      else {
        const d = exactDivide(a, b);
        if (!d) throw new Error("多項式でない内部式です。");
        a = d;
      }
    }
    return a;
  }
  function sum(): P {
    let a = product();
    while (t[i] === "+" || t[i] === "-") {
      const op = t[i++],
        b = product();
      a = op === "+" ? plus(a, b) : minus(a, b);
    }
    return a;
  }
  const result = sum();
  if (i !== t.length) throw new Error("多項式を読み取れません。");
  return result;
}
export function stringify(p: P): string {
  if (!p.size) return "0";
  return [...p]
    .sort(([a], [b]) => -compare(a, b))
    .map(([k, v]) => {
      const monomial = [...exps(k)]
        .map(([v, p]) => (p === 1 ? v : `${v}^${p}`))
        .join("*");
      const coeff = v.d === 1n ? `${abs(v.n)}` : `(${abs(v.n)}/${v.d})`;
      return `${v.n < 0n ? "-" : "+"}${monomial ? (abs(v.n) === v.d ? "" : coeff + "*") + monomial : coeff}`;
    })
    .join("")
    .replace(/^\+/, "");
}
export function normalize(n: P, d: P): { n: P; d: P } {
  if (!d.size)
    throw new Error("分母が恒等的に0です。式または接続を確認してください。");
  if (!n.size) return { n: constant(0n), d: constant(1n) };
  const nd = exactDivide(n, d);
  if (nd) return { n: nd, d: constant(1n) };
  const dn = exactDivide(d, n);
  if (dn) return { n: constant(1n), d: dn };
  // Cancel shared monomial content. General polynomial cancellation is optional;
  // equality is always determined by exact cross multiplication.
  const common = (p: P) => {
    let m: Map<string, number> | undefined;
    for (const k of p.keys()) {
      const e = exps(k);
      if (!m) m = e;
      else for (const [v, power] of m) m.set(v, Math.min(power, e.get(v) ?? 0));
    }
    return m!;
  };
  const a = common(n),
    b = common(d);
  for (const [v, p] of a) a.set(v, Math.min(p, b.get(v) ?? 0));
  const k = key(a);
  if (k) {
    n = exactDivide(n, new Map([[k, q(1n)]]))!;
    d = exactDivide(d, new Map([[k, q(1n)]]))!;
  }
  const scale = lead(d)[1];
  n = new Map([...n].map(([k, v]) => [k, qd(v, scale)]));
  d = new Map([...d].map(([k, v]) => [k, qd(v, scale)]));
  return { n, d };
}
export function determinant(matrix: P[][]): P {
  const a = matrix.map((row) => row.map((p) => new Map(p)));
  let previous = constant(1n),
    sign = 1n;
  for (let k = 0; k < a.length - 1; k++) {
    const p = a.findIndex((row, i) => i >= k && row[k].size > 0);
    if (p < 0) return constant(0n);
    if (p !== k) {
      [a[p], a[k]] = [a[k], a[p]];
      sign = -sign;
    }
    const pivot = a[k][k];
    for (let i = k + 1; i < a.length; i++) {
      for (let j = k + 1; j < a.length; j++) {
        const numerator = minus(times(pivot, a[i][j]), times(a[i][k], a[k][j]));
        const divided = exactDivide(numerator, previous);
        if (!divided)
          throw new Error("厳密消去に失敗しました。計算結果は表示できません。");
        a[i][j] = divided;
      }
      a[i][k] = constant(0n);
    }
    previous = pivot;
  }
  return times(constant(sign), a.at(-1)!.at(-1)!);
}
