export function normalizeFormula(input: string): string {
  const superscripts: Record<string, string> = {
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁻": "-",
    "⁺": "+",
  };
  return input
    .replace(
      /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g,
      (s) => "^" + [...s].map((c) => superscripts[c]).join(""),
    )
    .normalize("NFKC")
    .replace(/[×✕⋅·・]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—ー]/g, "-");
}
export const isUnityDenominator = (value: string) => {
  const n = normalizeFormula(value).replace(/\s/g, "");
  return (
    n === "" ||
    (/^\(*1(?:\.0+)?\)*$/.test(n) &&
      (n.match(/\(/g) || []).length === (n.match(/\)/g) || []).length)
  );
};
