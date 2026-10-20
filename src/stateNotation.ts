const subscripts: Record<string, string> = { "1": "₁", "2": "₂", "3": "₃" };
export function stateSignalLabel(label: string) {
  return label.replace(/x([123])/g, (_, n: string) => `x${subscripts[n]}`);
}
