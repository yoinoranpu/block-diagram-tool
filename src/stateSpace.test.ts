import { it, expect } from "vitest";
import { stateSpace } from "./stateSpace";
import { equal, transfer } from "./engine";
it("2次の文字係数行列からK/(s²+a*s+b)を厳密計算", () => {
  const r = stateSpace({
    A: [
      ["0", "1"],
      ["-b", "-a"],
    ],
    B: ["0", "K"],
    C: ["1", "0"],
    D: "0",
  });
  expect(equal(r.value, transfer("K", "s^2+a*s+b"))).toBe(true);
});
it("3次・非ゼロ直達項・状態ごとの出力係数", () => {
  const r = stateSpace({
    A: [
      ["0", "1", "0"],
      ["0", "0", "1"],
      ["-c", "-b", "-a"],
    ],
    B: ["0", "0", "1"],
    C: ["f", "g", "h"],
    D: "d",
  });
  expect(
    equal(
      r.value,
      transfer("d*(s^3+a*s^2+b*s+c)+h*s^2+g*s+f", "s^3+a*s^2+b*s+c"),
    ),
  ).toBe(true);
});
it("可制御正準形でない密な行列・分数係数", () => {
  const r = stateSpace({
    A: [
      ["1", "2"],
      ["3", "4"],
    ],
    B: ["1/2", "2"],
    C: ["3", "5"],
    D: "7",
  });
  expect(equal(r.value, transfer("14*s^2-47*s-21", "2*(s^2-5*s-2)"))).toBe(
    true,
  );
});
it("零伝達関数でも内部モードを保持し、零で割らない", () => {
  const r = stateSpace({ A: [["a"]], B: ["0"], C: ["1"], D: "2" });
  expect(equal(r.value, transfer("2", "1"))).toBe(true);
  expect(r.determinant).toContain("s");
});
it("分数の文字係数の成立条件を保持する", () => {
  const r = stateSpace({ A: [["-a"]], B: ["1/b"], C: ["K"], D: "0" });
  expect(equal(r.value, transfer("K", "b*(s+a)"))).toBe(true);
  expect(r.conditions.some((c) => c.includes("b"))).toBe(true);
});
it("特異なAでもsI−Aが有理行列として可逆なら計算する", () => {
  const r = stateSpace({
    A: [
      ["0", "0"],
      ["0", "0"],
    ],
    B: ["1", "1"],
    C: ["1", "1"],
    D: "0",
  });
  expect(equal(r.value, transfer("2", "s"))).toBe(true);
});
it("全角を正規化し、不正なサイズ・s・空欄・ゼロ分母を明示する", () => {
  expect(
    equal(
      stateSpace({ A: [["−ａ"]], B: ["Ｋ"], C: ["１"], D: "０" }).value,
      transfer("K", "s+a"),
    ),
  ).toBe(true);
  expect(() =>
    stateSpace({ A: [["0", "1"]], B: ["1"], C: ["1"], D: "0" }),
  ).toThrow("正方行列");
  for (const coefficient of ["s", "", "1/0"])
    expect(() =>
      stateSpace({ A: [[coefficient]], B: ["1"], C: ["1"], D: "0" }),
    ).toThrow();
});
it("密な3次行列を独立したSymPy計算の結果と照合する", () => {
  const r = stateSpace({
    A: [
      ["1", "2", "0"],
      ["-1", "3", "4"],
      ["2", "0", "-2"],
    ],
    B: ["1", "0", "2"],
    C: ["2", "3", "1"],
    D: "1/2",
  });
  // Reference: SymPy C*(s*I-A).inv()*B + 1/2.
  expect(
    equal(r.value, transfer("(s+2)*(s^2+4*s+15)", "2*(s^3-2*s^2-3*s-6)")),
  ).toBe(true);
});

it("行列式の消去用ピボットを係数の成立条件として追加しない", () => {
  const data = { A: [["-1", "0", "0"], ["0", "-2", "0"], ["0", "0", "-3"]],
    B: ["K", "0", "0"], C: ["1", "0", "0"], D: "0" };
  const r = stateSpace(data);
  expect(equal(r.value, transfer("K", "s+1"))).toBe(true);
  expect(r.conditions.some((v) => v.includes("K"))).toBe(false);
  expect(equal(stateSpace({ ...data, B: ["0", "0", "0"] }).value, transfer("0", "1"))).toBe(true);
});
