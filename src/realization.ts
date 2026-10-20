import { coefficients, transfer, fraction, parse, div, mul, sub, text, equal, latex } from "./engine";
import { stateSpace } from "./stateSpace";
import type { StateSpaceInput } from "./stateSpaceModel";
export type Realization = {
  coefficients: StateSpaceInput;
  matrices: { name: string; tex: string }[];
  order: number;
  conditions: string[];
  tex: string;
};
export function realize(num: string, den: string): Realization {
  const original = transfer(num, den);
  const ns = coefficients(original.n), ds = coefficients(original.d);
  const order = ds.length - 1;
  if (ns.length > ds.length)
    throw new Error("非プロパーな伝達関数です。入力の微分を含まない通常の状態空間表現（ẋ=Ax+Bu, y=Cx+Du）には変換できません。");
  if (order > 8)
    throw new Error("状態空間への変換は分母8次まで対応しています。伝達関数の計算は引き続き利用できます。");
  const leading = fraction(ds.at(-1)!);
  const a = ds.map((v) => div(fraction(v), leading));
  const b = Array.from({ length: order + 1 }, (_, i) => div(fraction(ns[i] ?? "0"), leading));
  const direct = b[order];
  const data: StateSpaceInput = {
    A: Array.from({ length: order }, (_, i) => Array.from({ length: order }, (_, j) =>
      i === order - 1 ? text(mul(fraction("-1"), a[j])) : j === i + 1 ? "1" : "0")),
    B: Array.from({ length: order }, (_, i) => i === order - 1 ? "1" : "0"),
    C: Array.from({ length: order }, (_, i) => text(sub(b[i], mul(direct, a[i])))),
    D: text(direct),
  };
  const checked = order ? stateSpace(data, 8) : undefined;
  const value = checked?.value ?? parse(data.D);
  if (!equal(original, value)) throw new Error("状態空間表現からの再計算が一致しなかったため、結果を表示していません。");
  const matrix = (rows: string[][]) => rows.length
    ? `\\begin{bmatrix}${rows.map((row) => row.map((v) => latex(parse(v))).join(" & ")).join(" \\\\ ")}\\end{bmatrix}`
    : "\\varnothing";
  return {
    coefficients: data, order,
    conditions: [...new Set([...(original.conditions ?? []), ...(checked?.conditions ?? [])])],
    tex: latex(value),
    matrices: [
      { name: "A", tex: matrix(data.A) },
      { name: "B", tex: matrix(data.B.map((v) => [v])) },
      { name: "C", tex: matrix(order ? [data.C] : []) },
      { name: "D", tex: latex(parse(data.D)) },
    ],
  };
}
