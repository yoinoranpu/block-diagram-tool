import { expect, it } from 'vitest';
import { equal, parse } from './engine';
import { stateSpace } from './stateSpace';
it('解説ページの負帰還・正帰還・直列・並列の数値例が一致する', () => {
  for (const [expression, answer] of [
    ['(2/(s+3))/(1+2/(s+3))', '2/(s+5)'],
    ['(2/(s+3))/(1-2/(s+3))', '2/(s+1)'],
    ['2/(s+1)*1/(s+3)', '2/(s^2+4*s+3)'],
    ['2/(s+1)+1/(s+3)', '(3*s+7)/(s^2+4*s+3)'],
    ['2/(s+1)-1/(s+3)', '(s+5)/(s^2+4*s+3)'],
  ]) expect(equal(parse(expression), parse(answer))).toBe(true);
});
it('状態空間表現の解説例と因数形・展開形が一致する', () => {
  const result = stateSpace({ A: [['0', '1'], ['-2', '-3']], B: ['0', '1'], C: ['1', '0'], D: '0' });
  expect(equal(result.value, parse('1/(s^2+3*s+2)'))).toBe(true);
  expect(equal(result.value, parse('1/((s+1)*(s+2))'))).toBe(true);
});
