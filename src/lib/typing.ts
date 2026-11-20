// 打字比對引擎：只處理「已提交」的文字（組字中的內容由元件負責略過）。
// 逐字元嚴格比對：全形/半形標點視為不同字元，不做 NFKC 正規化。
import { isZhuyinSymbol } from "./zhuyin.ts";

export type Mistake =
  | "latin"          // 需要中文字卻提交了英文字母
  | "zhuyin"         // 提交了注音符號本身（沒有選字）
  | "halfwidth"      // 需要中文標點卻打了英文半形符號
  | "wrongPunct"     // 標點打錯成另一個標點
  | "missingPunct"   // 需要標點卻打了下一個字（漏打標點）
  | "punctForChar"   // 需要中文字卻打了標點（標點位置錯誤）
  | "missing"        // 漏打一個字
  | "extra"          // 多打一個字
  | "wrongChar"      // 打錯字（可能是同音字，需另外查）
  | "tooLong";       // 已經打完卻還有多餘字元

export const PUNCT_CHARS = "，。、？！：；「」『』《》…—";
export const isPunct = (c: string) => PUNCT_CHARS.includes(c);
const isAsciiPunct = (c: string) => /^[!-/:-@[-`{-~]$/.test(c);

/** 中文標點 → 容易混淆的英文半形符號 */
export const HALF_OF: Record<string, string> = {
  "，": ",", "。": ".", "？": "?", "！": "!", "：": ":", "；": ";", "、": "\\", "「": "[", "」": "]",
};

export type Eval = {
  typed: string[];   // 去除空白與換行後的已提交字元
  pos: number;       // 從頭開始連續正確的字數（＝目前要打的位置）
  done: boolean;
  mistake: Mistake | null;
  wrong?: string;    // 第一個錯的字元
};

/** 換行與空白是排版用的，不要求學生輸入，比對前移除。 */
export const clean = (value: string) => Array.from(value.replace(/[\s　]/g, ""));

export function evaluate(target: string[], value: string): Eval {
  const typed = clean(value);
  let pos = 0;
  while (pos < typed.length && pos < target.length && typed[pos] === target[pos]) pos++;
  const done = pos === target.length && typed.length === target.length;
  if (pos >= typed.length) return { typed, pos, done, mistake: null };
  return { typed, pos, done: false, mistake: classify(target, typed, pos), wrong: typed[pos] };
}

export function classify(target: string[], typed: string[], p: number): Mistake {
  const t = target[p], c = typed[p];
  if (t === undefined) return "tooLong";
  if (isPunct(t)) {
    if (HALF_OF[t] === c || isAsciiPunct(c)) return "halfwidth";
    if (isPunct(c)) return "wrongPunct";
    return "missingPunct";
  }
  if (/[A-Za-z]/.test(c)) return "latin";
  if (isZhuyinSymbol(c)) return "zhuyin";
  if (isPunct(c) || isAsciiPunct(c)) return "punctForChar";
  if (target[p + 1] === c) return "missing";
  if (typed[p + 1] === t) return "extra";
  return "wrongChar";
}

/**
 * 每個題目位置的連續錯誤次數。同一筆錯誤（同位置、同錯字、同一段輸入）只算一次，
 * 所以 input 與 compositionend 對同一個值各觸發一次也不會重複計算。
 */
export class ErrorCounter {
  counts: number[] = [];
  private lastKey = "";
  record(e: Eval): boolean {
    if (!e.mistake) { this.lastKey = ""; return false; }
    const key = `${e.pos}|${e.typed.slice(e.pos).join("")}`;
    if (key === this.lastKey) return false;
    // 學生只是刪掉部分錯字（輸入變短）不算新錯誤
    const prev = this.lastKey.split("|");
    this.lastKey = key;
    if (prev[0] === String(e.pos) && prev[1]?.startsWith(e.typed.slice(e.pos).join(""))) return false;
    this.counts[e.pos] = (this.counts[e.pos] ?? 0) + 1;
    return true;
  }
  at(pos: number) { return this.counts[pos] ?? 0; }
}
