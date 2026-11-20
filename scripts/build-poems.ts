// 產生 src/data/poems.json：node scripts/build-poems.ts
// 1. pinyin-pro 先給出預設讀音 → 2. 台灣讀音表修正 → 3. 每首詩的 zy 覆寫多音字。
// 產生後仍需教師逐字校對（見 TEACHER_GUIDE.md），status 預設為 "ai-reviewed"。
import { writeFileSync } from "node:fs";
import { pinyin } from "pinyin-pro";
import { pinyinToZhuyin } from "../src/lib/zhuyin.ts";
import { SOURCES, PRACTICE } from "./poems-source.ts";

// 台灣（教育部）與 pinyin-pro 預設讀音不同、且本題庫會用到的字。
const TW: Record<string, string> = {
  期: "ㄑㄧˊ", 惜: "ㄒㄧˊ", 跡: "ㄐㄧ", 播: "ㄅㄛˋ", 擷: "ㄒㄧㄝˊ", 剝: "ㄅㄛ", 誰: "ㄕㄟˊ",
  微: "ㄨㄟˊ", 危: "ㄨㄟˊ", 息: "ㄒㄧˊ", 夕: "ㄒㄧˋ", 擊: "ㄐㄧˊ", 室: "ㄕˋ", 帆: "ㄈㄢˊ",
  研: "ㄧㄢˊ", 蝸: "ㄨㄛ", 摘: "ㄓㄞ", 殼: "ㄎㄜˊ", 熟: "ㄕㄡˊ", 綸: "ㄌㄨㄣˊ", 莓: "ㄇㄟˊ",
};
const PUNCT = /[，。、？！：；「」『』《》…—]/;

function annotate(text: string, zy: Record<string, string> = {}) {
  const chars = Array.from(text);
  const py = pinyin(text, { toneType: "num", type: "array", nonZh: "consecutive", toneSandhi: false });
  // pinyin-pro 對標點也回傳一格；非中文字回傳原字。逐字對齊：
  let k = 0;
  const out = chars.map(c => {
    if (PUNCT.test(c)) { k++; return { c, zy: "" }; }
    const p = py[k++];
    return { c, zy: TW[c] ?? pinyinToZhuyin(p) };
  });
  // 詞語覆寫：較長的詞先套用
  for (const [word, reading] of Object.entries(zy).sort((a, b) => b[0].length - a[0].length)) {
    const w = Array.from(word), r = reading.split(" ");
    if (w.length !== r.length) throw new Error(`覆寫字數不符：${word}`);
    let found = false;
    for (let i = 0; i + w.length <= chars.length; i++) {
      if (w.every((ch, j) => chars[i + j] === ch)) { w.forEach((_, j) => out[i + j].zy = r[j]); found = true; }
    }
    if (!found) throw new Error(`「${text}」裡找不到覆寫詞：${word}`);
  }
  return out;
}

const PUNCT_STAGE2 = /[、？！]/, PUNCT_STAGE3 = /[：；「」《》]/;
const stageOf = (s: string) => PUNCT_STAGE3.test(s) ? 3 : PUNCT_STAGE2.test(s) ? 2 : 1;

const poems = SOURCES.map(s => {
  const all = s.lines.join("");
  // 覆寫只套用到這首詩實際出現的詞，避免某一句找不到就報錯：
  const lines = s.lines.map(line => {
    const own = Object.fromEntries(Object.entries(s.zy ?? {}).filter(([w]) => line.includes(w)));
    return { text: line, chars: annotate(line, own) };
  });
  for (const w of Object.keys(s.zy ?? {})) if (!all.includes(w)) throw new Error(`${s.title} 找不到覆寫詞 ${w}`);
  const hanzi = Array.from(all).filter(c => !PUNCT.test(c)).length;
  const maxLine = Math.max(...s.lines.map(l => Array.from(l).length));
  return {
    id: s.id, title: s.title, author: s.author, dynasty: s.dynasty, kind: s.kind,
    category: s.category, explain: s.explain, lines,
    hanzi, maxLine, punctStage: stageOf(all),
    punct: [...new Set(Array.from(all).filter(c => PUNCT.test(c)))],
    status: "ai-reviewed",
    source: s.kind === "classical" ? "公版古典詩歌（作者逝世逾千年）" : s.kind === "spec-sample" ? "專案規格書提供之原創童詩範例" : "本專案原創",
    license: s.kind === "classical" ? "Public Domain" : "專案原創，可自由用於本遊戲",
  };
});

const practice = PRACTICE.map((p, i) => ({ id: `p${i}`, text: p.text, chars: annotate(p.text, p.zy) }));

writeFileSync(new URL("../src/data/poems.json", import.meta.url), JSON.stringify({ poems, practice }, null, 1));

// 列出每首詩的逐字注音，方便人工校對
if (process.argv.includes("--print")) {
  for (const p of poems) {
    console.log(`\n【${p.title}】`);
    for (const l of p.lines) console.log(l.chars.map(c => c.zy ? `${c.c}${c.zy}` : c.c).join(" "));
  }
  console.log("\n【練習】" + practice.map(p => p.chars.map(c => c.c + c.zy).join("")).join(" "));
}
console.log(`poems: ${poems.length}, practice: ${practice.length}`);
