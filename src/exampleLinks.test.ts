import { expect, it } from 'vitest';
import { exampleLink, linkedDiagram, linkedState, exampleTitles, type ExampleId } from './exampleLinks';
import { solve, equal, parse } from './engine';
import { stateSpace } from './stateSpace';
it.each([
  ['series', '2/(s^2+4*s+3)'], ['parallel', '(3*s+7)/(s^2+4*s+3)'],
  ['negative', '2/(s+5)'], ['positive', '2/(s+1)'], ['multi', '(2*s+4)/(s^2+5*s+8)'],
] as const)('例題リンク%sの図と公開した答えが一致する', (id, answer) => {
  expect(equal(solve(linkedDiagram(id)).value, parse(answer))).toBe(true);
});
it('状態空間の入力済み例題と解説の答えが一致する', () => {
  expect(equal(stateSpace(linkedState).value, parse('1/(s^2+3*s+2)'))).toBe(true);
});
it('リンクは許可した例題IDだけを受け付ける', () => {
  for (const id of Object.keys(exampleTitles)) expect(exampleLink('?example=' + id)).toBe(id as ExampleId);
  for (const search of ['', '?example=__proto__', '?example=constructor', '?example=https://example.org']) expect(exampleLink(search)).toBeUndefined();
});
