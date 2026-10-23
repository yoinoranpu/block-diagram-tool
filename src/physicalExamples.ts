import type { StateSpaceInput } from "./stateSpaceModel";
export type PhysicalExample = {
  id: string; title: string; description: string; states: string; assumptions: string;
  num: string; den: string; state: StateSpaceInput;
};
export const physicalExamples: PhysicalExample[] = [
  {
    id: "rl", title: "直列RL回路（電流）",
    description: "入力uは直列RL回路に加える電圧[V]、出力yは電流[A]です。",
    states: "x₁ = インダクタ電流 i_L [A]", assumptions: "R > 0、L > 0を想定。初期電流は0。",
    num: "1", den: "L*s+R",
    state: { A: [["-R/L"]], B: ["1/L"], C: ["1"], D: "0" },
  },
  {
    id: "rc", title: "直列RC回路（コンデンサ電圧）",
    description: "入力uは直列RC回路に加える電圧[V]、出力yはコンデンサ両端の電圧[V]です。",
    states: "x₁ = コンデンサ電圧 v_C [V]", assumptions: "R > 0、C > 0を想定。初期電圧は0。",
    num: "1", den: "R*C*s+1",
    state: { A: [["-1/(R*C)"]], B: ["1/(R*C)"], C: ["1"], D: "0" },
  },
  {
    id: "rlc", title: "直列RLC回路（コンデンサ電圧）",
    description: "電圧源uでR・L・Cを直列に駆動します。入力uは印加電圧[V]、出力yはコンデンサ両端の電圧[V]です。",
    states: "x₁ = コンデンサ電圧 v_C [V]、x₂ = インダクタ電流 i_L [A]",
    assumptions: "R > 0、L > 0、C > 0を想定。初期電圧・初期電流は0。",
    num: "1", den: "L*C*s^2+R*C*s+1",
    state: { A: [["0", "1/C"], ["-1/L", "-R/L"]], B: ["0", "1/L"], C: ["1", "0"], D: "0" },
  },
  {
    id: "mechanical", title: "質量・ばね・ダンパ（変位）",
    description: "入力uは質点への外力[N]、出力yは平衡点からの変位[m]です。mは質量、bは粘性減衰係数、kはばね定数です。",
    states: "x₁ = 変位 q [m]、x₂ = 速度 dq/dt [m/s]", assumptions: "m > 0、b ≥ 0、k > 0を想定。初期変位・初期速度は0。",
    num: "1", den: "m*s^2+b*s+k",
    state: { A: [["0", "1"], ["-k/m", "-b/m"]], B: ["0", "1/m"], C: ["1", "0"], D: "0" },
  },
];
