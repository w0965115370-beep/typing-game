// 輸入法行為分析：瀏覽器無法讀取作業系統目前的輸入法，這裡只根據「已提交的文字」與
// composition 事件做推測，提示文字一律用「好像」「可能」，不宣稱已偵測到輸入法狀態。
import type { Eval } from "./typing.ts";
import { isPunct } from "./typing.ts";
import { HINTS } from "../config/hints.ts";

export type ImeAdvice = "englishMode" | "halfwidth" | "noCandidate" | "homophone";

export const IME_TEXT: Record<ImeAdvice, string> = {
  englishMode: "你好像正在使用英文輸入模式，請看看右下角的輸入法是不是已經切換成中文喔！",
  halfwidth: "這好像是英文的半形符號，我們需要中文的全形標點喔！",
  noCandidate: "請確認你已切換成中文注音模式，打完注音後，再從候選字中選擇正確的國字。",
  homophone: "這兩個字的讀音一樣，但寫法不同。打完注音後，看看候選字清單，選擇跟題目一樣的字。",
};

/**
 * @param sawComposition 目前位置開始輸入後，是否出現過 compositionstart
 * @param sameSound 打錯的字與目標字是否同音（由呼叫端非同步查出）
 */
export function analyze(e: Eval, target: string[], sawComposition: boolean, sameSound = false): ImeAdvice | null {
  if (!e.mistake) return null;
  const tail = e.typed.slice(e.pos);
  const letters = tail.filter(c => /[A-Za-z]/.test(c)).length;
  const wantHanzi = e.pos < target.length && !isPunct(target[e.pos]);
  if (wantHanzi && letters >= HINTS.englishLetters && !sawComposition) return "englishMode";
  if (e.mistake === "halfwidth") return "halfwidth";
  if (e.mistake === "zhuyin" || (e.mistake === "latin" && sawComposition)) return "noCandidate";
  if (e.mistake === "wrongChar" && sameSound) return "homophone";
  return null;
}

/** 每種提醒的冷卻時間，避免同一句話一直跳出來。 */
export class Cooldown {
  private last: Record<string, number> = {};
  constructor(private ms = HINTS.cooldownSec * 1000) {}
  ok(kind: string, now = Date.now()) {
    if (now - (this.last[kind] ?? -Infinity) < this.ms) return false;
    this.last[kind] = now;
    return true;
  }
}
