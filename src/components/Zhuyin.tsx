// 逐字直式注音：注音在國字正右側、由上而下；輕聲點在最上方；二三四聲標在注音右側、
// 對齊最後一個符號。國字與注音包在同一個 inline-flex 裡，換行時不會分開。
import { memo } from "react";
import { splitZhuyin } from "../lib/zhuyin.ts";
import type { Char } from "../lib/learning.ts";

export const ZhuyinChar = memo(function ZhuyinChar({ c, zy, state }: Char & { state?: string }) {
  if (!zy) return <span className={`zc punct ${state ?? ""}`}><span className="hz">{c}</span></span>;
  const { neutral, symbols, tone } = splitZhuyin(zy);
  return (
    <span className={`zc ${state ?? ""}`} aria-label={`${c}（${zy}）`}>
      <span className="hz" aria-hidden>{c}</span>
      <span className="zy" aria-hidden data-n={symbols.length}>
        {neutral && <span className="neu">˙</span>}
        {symbols.map((s, i) => <span key={i} className="sym">{s}</span>)}
        {tone && <span className="tone" style={{ top: `${(symbols.length - 1) + (neutral ? 1 : 0)}em` }}>{tone}</span>}
      </span>
    </span>
  );
});

export function ZhuyinLine({ chars, states }: { chars: Char[]; states?: string[] }) {
  return <span className="zline">{chars.map((ch, i) => <ZhuyinChar key={i} {...ch} state={states?.[i]} />)}</span>;
}
