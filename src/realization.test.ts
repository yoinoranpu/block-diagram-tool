import { it, expect } from "vitest";
import { realize } from "./realization";
import { editStateDiagram } from "./editStateDiagram";
import { equal, solve, transfer } from "./engine";
import { stateSpace } from "./stateSpace";
it.each([
  ["1", "s+a", 1], ["K", "(s+a)*(s+b)", 2],
  ["s^2+3*s+4", "2*s^2+5*s+6", 2], ["s^3+s+1", "s^3+a*s^2+b*s+c", 3],
] as const)("%s / %s を状態空間と編集可能な線図に往復できる", (num, den, order) => {
  const r = realize(num, den);
  expect(r.order).toBe(order);
  expect(equal(stateSpace(r.coefficients).value, transfer(num, den))).toBe(true);
  const diagram = editStateDiagram(r.coefficients);
  expect(equal(solve(diagram, false).value, transfer(num, den))).toBe(true);
}, 15000);
it.each(["0", "K", "3/2", "K/a"])("定数%sは状態を増やさずDだけで表現する", (num) => {
  const r = realize(num, "1");
  expect(r.order).toBe(0);
  expect(r.coefficients.A).toEqual([]);
  expect(equal(transfer(r.coefficients.D, "1"), transfer(num, "1"))).toBe(true);
});
it("文字係数の最高次係数が0でない条件を引き継ぐ", () => {
  const r = realize("K", "a*s^2+b*s+c");
  expect(r.conditions.some((v) => v.includes("a") && v.includes("0"))).toBe(true);
});
it.each([4, 8])("%d次の式も検算できる", (n) => {
  const r = realize("1", `s^${n}+2*s+3`);
  expect(r.order).toBe(n);
  expect(r.coefficients.A).toHaveLength(n);
  expect(r.coefficients.A.at(-1)![0]).toBe("-3");
  expect(r.coefficients.C[0]).toBe("1");
}, 15000);
it("非プロパーと変換上限を明示する", () => {
  expect(() => realize("s^2+1", "s+1")).toThrow("非プロパー");
  expect(() => realize("1", "s^9+1")).toThrow("分母8次");
});
it("3次の25要素を編集でき、省略設定でも計算結果が変わらない", () => {
  const data = { A: [["-1", "2", "0"], ["0", "-2", "1"], ["1", "0", "-3"]], B: ["1", "1", "1"], C: ["1", "1", "1"], D: "0" };
  const diagram = editStateDiagram(data);
  expect(diagram.nodes).toHaveLength(25);
  const expected = stateSpace(data).value;
  expect(equal(solve(diagram, false).value, expected)).toBe(true);
  expect(equal(solve(editStateDiagram(data, { omitZero: true, omitOne: true }), false).value, expected)).toBe(true);
}, 15000);
it("省略で入力から切り離された無励振の状態は0として扱う", () => {
  const data = { A: [["-1"]], B: ["0"], C: ["1"], D: "0" };
  expect(equal(solve(editStateDiagram(data, { omitZero: true }), false).value, transfer("0", "1"))).toBe(true);
});
