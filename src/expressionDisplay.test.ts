import { expect, it } from 'vitest';
import { displayExpression, diagramExpression, editExpression } from './expressionDisplay';
import { equal, parse } from './engine';
it('元の計算式は保持し、表示だけ指数と掛け算を変える',()=>{
 const source='s^3+a*s^2+b*s+1';
 expect(displayExpression(source)).toBe('s³+a×s²+b×s+1');
 expect(diagramExpression(source).text).toBe('s³+a×s²+b×s+1');
 expect(equal(parse(source),parse(displayExpression(source)))).toBe(true);
 expect(displayExpression('s^(-12)-s^-2')).toBe('s⁻¹²−s⁻²');
 expect(displayExpression('s^(a+1)')).toBe('s^(a+1)');
 expect(displayExpression('s^2.5')).toBe('s^2.5');
 expect(displayExpression('s^2^3')).toBe('s^2^3');
});
it('電卓キーはカーソル位置で置換・削除し、入力用の記号を返す',()=>{
 expect(editExpression('s+1',1,1,'×')).toEqual({value:'s*+1',caret:2});
 expect(editExpression('s+1',2,3,'a')).toEqual({value:'s+a',caret:3});
 expect(editExpression('s+1',3,3,'backspace')).toEqual({value:'s+',caret:2});
 expect(editExpression('s+1',0,2,'backspace')).toEqual({value:'1',caret:0});
 expect(editExpression('s+1',0,0,'backspace')).toEqual({value:'s+1',caret:0});
 expect(editExpression('s+1',1,1,'clear')).toEqual({value:'',caret:0});
});
