// 注音工具：拼音轉注音（只在產生題庫與同音字比對時使用）、注音拆解、注音轉大千式按鍵。
// 這個檔案只用可被 Node 直接執行的 TS 語法，讓 scripts/build-poems.ts 也能匯入。
import { KEY_OF_SYMBOL } from "../config/keyboard.ts";

const INITIALS: [string, string][] = [
  ["zh", "ㄓ"], ["ch", "ㄔ"], ["sh", "ㄕ"], ["b", "ㄅ"], ["p", "ㄆ"], ["m", "ㄇ"], ["f", "ㄈ"],
  ["d", "ㄉ"], ["t", "ㄊ"], ["n", "ㄋ"], ["l", "ㄌ"], ["g", "ㄍ"], ["k", "ㄎ"], ["h", "ㄏ"],
  ["j", "ㄐ"], ["q", "ㄑ"], ["x", "ㄒ"], ["r", "ㄖ"], ["z", "ㄗ"], ["c", "ㄘ"], ["s", "ㄙ"],
];
const FINALS: Record<string, string> = {
  a: "ㄚ", o: "ㄛ", e: "ㄜ", ê: "ㄝ", ai: "ㄞ", ei: "ㄟ", ao: "ㄠ", ou: "ㄡ", an: "ㄢ", en: "ㄣ",
  ang: "ㄤ", eng: "ㄥ", er: "ㄦ", ong: "ㄨㄥ",
  i: "ㄧ", ia: "ㄧㄚ", io: "ㄧㄛ", ie: "ㄧㄝ", iao: "ㄧㄠ", iu: "ㄧㄡ", iou: "ㄧㄡ", ian: "ㄧㄢ",
  in: "ㄧㄣ", iang: "ㄧㄤ", ing: "ㄧㄥ", iong: "ㄩㄥ",
  u: "ㄨ", ua: "ㄨㄚ", uo: "ㄨㄛ", uai: "ㄨㄞ", ui: "ㄨㄟ", uei: "ㄨㄟ", uan: "ㄨㄢ", un: "ㄨㄣ",
  uen: "ㄨㄣ", uang: "ㄨㄤ", ueng: "ㄨㄥ",
  ü: "ㄩ", üe: "ㄩㄝ", üan: "ㄩㄢ", ün: "ㄩㄣ",
};
const TONE_MARK = ["", "", "ˊ", "ˇ", "ˋ"];

/** "jue2" → "ㄐㄩㄝˊ"；"de0" / "de5" → "˙ㄉㄜ"。無法轉換時丟出錯誤，不默默猜。 */
export function pinyinToZhuyin(py: string): string {
  const m = py.toLowerCase().replace(/v/g, "ü").match(/^([a-zêü]+)([0-5])$/);
  if (!m) throw new Error(`無法轉換的拼音：${py}`);
  let s = m[1];
  const tone = Number(m[2]);
  if (s[0] === "y") {
    if (s.startsWith("yu")) s = "ü" + s.slice(2);
    else if (s.startsWith("yi")) s = s.slice(1);
    else s = "i" + s.slice(1);
  } else if (s[0] === "w") {
    s = s === "wu" ? "u" : "u" + s.slice(1);
  }
  let init = "";
  for (const [p, z] of INITIALS) {
    if (s.startsWith(p)) { init = z; s = s.slice(p.length); break; }
  }
  if ("ㄐㄑㄒ".includes(init) && init && s[0] === "u") s = "ü" + s.slice(1);
  let fin: string;
  if (s === "i" && "ㄓㄔㄕㄖㄗㄘㄙ".includes(init) && init) fin = "";
  else if (s === "") fin = "";
  else {
    fin = FINALS[s];
    if (fin === undefined) throw new Error(`無法轉換的拼音：${py}`);
  }
  const body = init + fin;
  if (!body) throw new Error(`無法轉換的拼音：${py}`);
  return tone === 0 || tone === 5 ? "˙" + body : body + TONE_MARK[tone];
}

export type ZhuyinParts = { neutral: boolean; symbols: string[]; tone: "" | "ˊ" | "ˇ" | "ˋ" };

/** 拆成直式排版需要的部分：輕聲、注音符號、聲調。 */
export function splitZhuyin(zy: string): ZhuyinParts {
  const chars = Array.from(zy);
  const neutral = chars[0] === "˙";
  if (neutral) chars.shift();
  const last = chars[chars.length - 1];
  const tone = (last === "ˊ" || last === "ˇ" || last === "ˋ" ? chars.pop() : "") as ZhuyinParts["tone"];
  return { neutral, symbols: chars, tone };
}

export type KeyStep = { key: string; label: string };

/** 注音 → 微軟注音（大千式）按鍵順序。第一聲用空白鍵確認，輕聲的˙在最後按。 */
export function zhuyinToKeys(zy: string): KeyStep[] {
  const { neutral, symbols, tone } = splitZhuyin(zy);
  const steps = symbols.map(s => {
    const key = KEY_OF_SYMBOL[s];
    if (!key) throw new Error(`鍵盤上找不到注音：${s}`);
    return { key, label: s };
  });
  if (neutral) steps.push({ key: KEY_OF_SYMBOL["˙"], label: "˙" });
  else if (tone) steps.push({ key: KEY_OF_SYMBOL[tone], label: tone });
  else steps.push({ key: "Space", label: "一聲" });
  return steps;
}

export const isZhuyinSymbol = (c: string) => /[㄀-ㄯㆠ-ㆿˊˇˋ˙]/.test(c);
