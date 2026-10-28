import { expect, it } from 'vitest';
import katex from 'katex';
import { example, solve, equal } from './engine';
it.each(['series', 'parallel', 'negative', 'positive'] as const)('%sの解説式は構文が正しく、入力した式と結果を含む', (kind) => {
  const result = solve(example(kind));
  expect(result.learning.length).toBeGreaterThan(0);
  for (const step of result.learning) {
    expect(step.details).toHaveLength(4);
    for (const detail of step.details) {
      expect(detail.explanation.length).toBeGreaterThan(10);
      expect(() => katex.renderToString(detail.tex, { throwOnError: true, strict: 'error' })).not.toThrow();
    }
    expect(equal(solve(step.diagram, false).value, result.value)).toBe(true);
  }
});
it('負と正の帰還で、関係式と公式の分母の符号が対応する', () => {
  const negative = solve(example('negative')).learning[0].details;
  const positive = solve(example('positive')).learning[0].details;
  expect(negative[0].tex).toContain('E=U-HY');
  expect(negative[1].tex).toContain('1+GH');
  expect(positive[0].tex).toContain('E=U+HY');
  expect(positive[1].tex).toContain('1-GH');
});
