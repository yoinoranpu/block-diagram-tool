import { normalizeFormula } from './normalizeInput';
const superscript: Record<string,string> = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻','+':'⁺' };
// Typography only: do not evaluate, simplify, or change the stored expression.
export function displayExpression(value: string): string {
  const normalized = normalizeFormula(value);
  // Keep chained or fractional powers explicit rather than making them look like one integer exponent.
  const formatted = /\^(?:\([+-]?\d+\)|[+-]?\d+)\s*\^/.test(normalized) ? normalized : normalized.replace(/\^\(([+-]?\d+)\)|\^([+-]?\d+)(?![\d.A-Za-z])/g,
    (_, group, bare) => [...(group ?? bare)].map(c=>superscript[c]).join(''));
  return formatted.replace(/\*/g,'×').replace(/-/g,'−');
}
export function diagramExpression(value: string): { text: string; fontSize: number } {
  const text = displayExpression(value.trim());
  const visible = text.length > 22 ? text.slice(0,21)+'…' : text;
  return { text: visible || '未入力', fontSize: Math.max(10,Math.min(15,110/Math.max(1,visible.length*0.58))) };
}
export function editExpression(value: string, start: number, end: number, token: string) {
  if (token === 'clear') return {value:'',caret:0};
  if (token === 'backspace') { const cut=start===end?Math.max(0,start-1):start; return {value:value.slice(0,cut)+value.slice(end),caret:cut}; }
  const insert = normalizeFormula(token);
  return {value:value.slice(0,start)+insert+value.slice(end),caret:start+insert.length};
}
