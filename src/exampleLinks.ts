import { example, type Diagram } from './model';
import type { StateSpaceInput } from './stateSpaceModel';
export const exampleTitles = {
  series: '直列結合', parallel: '並列結合', negative: '負帰還', positive: '正帰還', multi: '複数の帰還経路', state: '状態空間表現の2次系',
} as const;
export type ExampleId = keyof typeof exampleTitles;
export function exampleLink(search: string): ExampleId | undefined {
  const value = new URLSearchParams(search).get('example');
  return value && Object.hasOwn(exampleTitles, value) ? value as ExampleId : undefined;
}
export function linkedDiagram(id: ExampleId): Diagram {
  const d = example(id === 'state' ? 'negative' : id);
  for (const n of d.nodes) {
    if (n.id === 'g') {
      n.label = id === 'series' || id === 'parallel' ? 'G₁' : 'G';
      n.num = '2';
      n.den = id === 'series' || id === 'parallel' || id === 'multi' ? 's+1' : 's+3';
    }
    if (n.id === 'h') { n.label = id === 'series' || id === 'parallel' ? 'G₂' : id === 'multi' ? 'H₁' : 'H'; n.num = '1'; n.den = id === 'series' || id === 'parallel' ? 's+3' : '1'; }
    if (n.id === 'j') { n.label = 'H₂'; n.num = '1'; n.den = 's+2'; }
  }
  return d;
}
export const linkedState: StateSpaceInput = { A: [['0', '1'], ['-2', '-3']], B: ['0', '1'], C: ['1', '0'], D: '0' };
