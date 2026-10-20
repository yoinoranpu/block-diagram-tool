import {
  displayFraction,
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
// Fraction-free elimination avoids factorial work for higher-order realizations.
function det(matrix: Fraction[][]): Fraction {
  if (!matrix.length) return fraction("1");
  const m = matrix.map((row) => [...row]);
  let previous = fraction("1"), sign = fraction("1");
  for (let k = 0; k < m.length - 1; k++) {
    const pivotRow = m.findIndex((row, i) => i >= k && row[k].n !== "0");
    if (pivotRow < 0) return fraction("0");
    if (pivotRow !== k) {
      [m[k], m[pivotRow]] = [m[pivotRow], m[k]];
      sign = mul(sign, fraction("-1"));
    }
    const pivot = m[k][k];
    for (let i = k + 1; i < m.length; i++) {
      for (let j = k + 1; j < m.length; j++)
        m[i][j] = div(sub(mul(m[i][j], pivot), mul(m[i][k], m[k][j])), previous);
      m[i][k] = fraction("0");
    }
    previous = pivot;
  }
  // Pivot denominators are an elimination device, not restrictions on the
  // determinant. Input coefficient denominators are collected by entry().
  return { ...mul(sign, m.at(-1)!.at(-1)!), conditions: [] };
}
export function stateSpace(input: StateSpaceInput, maxStates = 3): StateSpaceResult {
  const data = validateStateSpace(input, false, maxStates),
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
    value: displayFraction(value),
    tex: latex(value),
    expandedTex: latex(value, true),
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
