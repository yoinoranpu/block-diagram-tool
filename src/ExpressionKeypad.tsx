import type { RefObject } from 'react';
import { editExpression, displayExpression } from './expressionDisplay';
import { isUnityDenominator } from './normalizeInput';
export const prefersCalculator = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
export function ExpressionKeypad({ inputRef, value, onChange }: {
  inputRef: RefObject<HTMLInputElement | null>; value: string; onChange: (value:string)=>void;
}) {
  function insert(token:string) {
    const el=inputRef.current;
    const next=editExpression(value,el?.selectionStart??value.length,el?.selectionEnd??value.length,token);
    if(next.value.length>300)return;
    onChange(next.value);
    requestAnimationFrame(()=>{el?.focus({preventScroll:true});el?.setSelectionRange(next.caret,next.caret);});
  }
  return <div className="expression-keys" aria-label="式入力の補助キー">
    <div className="expression-key-grid">{[
      ['7','7'],['8','8'],['9','9'],['+','+'],['s','s'],['K','K'],
      ['4','4'],['5','5'],['6','6'],['−','-'],['a','a'],['b','b'],
      ['1','1'],['2','2'],['3','3'],['×','*'],['(','('],[')',')'],
      ['0','0'],['.','.'],['^','^'],['÷','/'],['⌫','backspace'],['AC','clear'],
    ].map(([label,token])=><button type="button" key={token}
      aria-label={token==='clear'?'入力欄をクリア':token==='backspace'?'1文字削除':label==='^'?'指数を入力':undefined}
      onPointerDown={e=>e.preventDefault()} onClick={()=>insert(token)}>{label}</button>)}</div>
    <label className="coefficient-key">ほかの文字
      <select aria-label="文字係数を挿入" value="" onChange={e=>{if(e.target.value)insert(e.target.value);}}>
        <option value="">文字を選ぶ</option>{['c','d','f','g','h','k','m','n','p','r','t','x','y','z','R','L','C','T','A','B'].map(c=><option key={c}>{c}</option>)}
      </select>
    </label>
  </div>;
}
export function ExpressionPreview({num,den}:{num:string;den:string}) {
 return <div className="expression-preview" role="math" aria-label={`表示例：(${num || '未入力'}) / (${den.trim() || '1'})`}>
   <span className={isUnityDenominator(den)?'':'preview-numerator'}>{displayExpression(num) || '未入力'}</span>
   {!isUnityDenominator(den)&&<span>{displayExpression(den)}</span>}
 </div>;
}
