import {
  parse,
  fraction,
  add,
  sub,
  mul,
  div,
  latex,
  text,
  type Fraction,
} from "./engine";
import {
  validateStateSpace,
  type StateSpaceInput,
  type StateSpaceResult,
} from "./stateSpaceModel";
export type { StateSpaceInput, StateSpaceResult } from "./stateSpaceModel";
function det(m: Fraction[][]): Fraction {
  if (!m.length) return fraction("1");
  if (m.length === 1) return m[0][0];
  return m[0].reduce((sum, x, j) => {
    const term = mul(
      x,
      det(m.slice(1).map((row) => row.filter((_, k) => k !== j))),
    );
    return j % 2 ? sub(sum, term) : add(sum, term);
  }, fraction("0"));
}
export function stateSpace(input: StateSpaceInput): StateSpaceResult {
  const data = validateStateSpace(input),
    conditions = new Set<string>();
  const entry = (s: string, name: string) => {
    if (/s/.test(s))
      throw new Error(
        `${name}：行列の係数にsは使えません。時間に依存しない係数を入力してください。`,
      );
    try {
      const value = parse(s);
      value.conditions?.forEach((c) => conditions.add(c));
      return value;
    } catch (e) {
      throw new Error(`${name}：${(e as Error).message}`);
    }
  };
  const A = data.A.map((row, i) =>
      row.map((x, j) => entry(x, `A(${i + 1},${j + 1})`)),
    ),
    B = data.B.map((x, i) => entry(x, `B(${i + 1})`)),
    C = data.C.map((x, i) => entry(x, `C(${i + 1})`)),
    D = entry(data.D, "D");
  const M = A.map((row, i) =>
      row.map((x, j) => sub(fraction(i === j ? "s" : "0"), x)),
    ),
    denominator = det(M);
  let value = D;
  for (let j = 0; j < A.length; j++) {
    const replaced = M.map((row, i) => row.map((x, k) => (k === j ? B[i] : x)));
    value = add(value, div(mul(C[j], det(replaced)), denominator));
  }
  value.conditions
    ?.filter((c) => !c.includes("s"))
    .forEach((c) => conditions.add(c));
  const coefficients = {
    A: A.map((row) => row.map(text)),
    B: B.map(text),
    C: C.map(text),
    D: text(D),
  };
  return {
    value,
    tex: latex(value),
    expression: text(value),
    conditions: [...conditions],
    determinant: text(denominator),
    coefficients,
    equations: [
      ...A.map(
        (row, i) =>
          `dx${i + 1}/dt = ${[...row.map((x, j) => `(${text(x)})*x${j + 1}`), `(${text(B[i])})*u`].join(" + ")}`,
      ),
      `y = ${[...C.map((x, j) => `(${text(x)})*x${j + 1}`), `(${text(D)})*u`].join(" + ")}`,
    ],
  };
}
