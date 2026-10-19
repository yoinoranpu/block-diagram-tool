import { normalizeFormula } from "./normalizeInput";
import type { Fraction } from "./engine";
export type StateSpaceInput = {
  A: string[][];
  B: string[];
  C: string[];
  D: string;
};
export type StateSpaceResult = {
  value: Fraction;
  tex: string;
  expression: string;
  conditions: string[];
  equations: string[];
  determinant: string;
  coefficients: StateSpaceInput;
};
export function validateStateSpace(
  value: unknown,
  allowIncomplete = false,
): StateSpaceInput {
  const v = value as StateSpaceInput;
  const n = v?.A?.length;
  if (
    !Array.isArray(v?.A) ||
    n < 1 ||
    n > 3 ||
    !v.A.every((row) => Array.isArray(row) && row.length === n) ||
    !Array.isArray(v.B) ||
    !Array.isArray(v.C) ||
    v.B.length !== n ||
    v.C.length !== n
  )
    throw new Error(
      "Aは1〜3次の正方行列、Bは同じ行数の列ベクトル、Cは同じ列数の行ベクトルにしてください（1入力1出力）。",
    );
  if (
    ![...v.A.flat(), ...v.B, ...v.C, v.D].every(
      (s) =>
        typeof s === "string" &&
        (allowIncomplete || s.trim().length > 0) &&
        s.length <= 300,
    )
  )
    throw new Error(
      "すべての成分を1〜300文字で入力してください。ゼロは0と入力します。",
    );
  return {
    A: v.A.map((row) => row.map(normalizeFormula)),
    B: v.B.map(normalizeFormula),
    C: v.C.map(normalizeFormula),
    D: normalizeFormula(v.D),
  };
}
