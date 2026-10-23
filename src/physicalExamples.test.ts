import { it, expect } from "vitest";
import { physicalExamples } from "./physicalExamples";
import { stateSpace } from "./stateSpace";
import { editStateDiagram } from "./editStateDiagram";
import { solve, equal, transfer } from "./engine";
it.each(physicalExamples)("$title の行列・線図・解析解が厳密に一致する", (example) => {
  const expected = transfer(example.num, example.den);
  expect(equal(stateSpace(example.state).value, expected)).toBe(true);
  expect(equal(solve(editStateDiagram(example.state), false).value, expected)).toBe(true);
});
it("全角の-R/Lと分母の積を含む文字係数も計算できる", () => {
  const r = stateSpace({ A: [["−Ｒ／Ｌ"]], B: ["１／Ｌ"], C: ["１"], D: "０" });
  expect(equal(r.value, transfer("1", "L*s+R"))).toBe(true);
  const rc = stateSpace({ A: [["−１／（Ｒ＊Ｃ）"]], B: ["１／（Ｒ＊Ｃ）"], C: ["１"], D: "０" });
  expect(equal(rc.value, transfer("1", "R*C*s+1"))).toBe(true);
  expect(rc.conditions.some((v) => v.includes("R") && v.includes("C"))).toBe(true);
});
