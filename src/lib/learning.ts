// 詩歌題庫、適性難度、詩歌收藏進度與學習紀錄。
import data from "../data/poems.json";

export type Char = { c: string; zy: string };
export type Line = { text: string; chars: Char[] };
export type Poem = {
  id: string; title: string; author: string; dynasty: string; kind: string; category: string;
  explain: string; lines: Line[]; hanzi: number; maxLine: number; punctStage: number; punct: string[];
  status: string; source: string; license: string;
};
export const POEMS = data.poems as Poem[];
export const PRACTICE = data.practice as { id: string; text: string; chars: Char[] }[];
export const POEM = Object.fromEntries(POEMS.map(p => [p.id, p])) as Record<string, Poem>;
export const CATEGORIES = ["春天", "夏天", "秋天", "冬天", "花草樹木", "山水風景", "可愛動物", "農田生活", "生活童詩", "思念與友情"];

// ---- 關卡：一首詩一關，先短後長、先只有逗號句號 ----
export const LEVELS = [...POEMS].sort((a, b) => a.punctStage - b.punctStage || a.hanzi - b.hanzi || a.maxLine - b.maxLine);
export const ZONE_SIZE = 15;
export const ZONES = ["草原村", "魔法森林", "天空城堡"];

export type TaskResult = {
  hanzi: number; punct: number; ms: number;
  maxHint: number;          // 這次用到的最高提示等級（0～4）
  firstTry: number;         // 第一次就打對的字元數
  positions: number;        // 題目總字元數
  punctErrors: number; halfwidth: number;
  hints: Record<string, number>; ime: Record<string, number>; mistakes: Record<string, number>;
};

/** 分數：每個字 10 分＋第一次就打對的字每個再 5 分＋速度獎勵（每分鐘每個字 5 分，最多 100）。用提示不扣分。 */
export function scoreOf(r: TaskResult) {
  const base = r.positions * 10;
  const clean = r.firstTry * 5;
  const speedCpm = cpm(r.hanzi, r.ms);
  const speed = Math.min(100, speedCpm * 5);
  const rate = r.positions ? r.firstTry / r.positions : 0;
  const stars = rate >= 0.95 ? 3 : rate >= 0.8 ? 2 : 1;
  return { base, clean, speed, total: base + clean + speed, stars, cpm: speedCpm, rate };
}

export type Best = Record<string, { score: number; stars: number; plays: number }>;

// ---- 學習紀錄 ----
export type Stats = {
  hanzi: number; punct: number; tasks: number; ms: number; firstTry: number; positions: number;
  punctErrors: number; halfwidth: number;
  hints: Record<string, number>; ime: Record<string, number>; mistakes: Record<string, number>;
  daily: Record<string, { hanzi: number; ms: number }>;
};
export const newStats = (): Stats => ({
  hanzi: 0, punct: 0, tasks: 0, ms: 0, firstTry: 0, positions: 0, punctErrors: 0, halfwidth: 0,
  hints: {}, ime: {}, mistakes: {}, daily: {},
});
const merge = (a: Record<string, number>, b: Record<string, number>) => {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = (o[k] ?? 0) + v;
  return o;
};
export function record(s: Stats, r: TaskResult, today: string): Stats {
  const d = s.daily[today] ?? { hanzi: 0, ms: 0 };
  return {
    hanzi: s.hanzi + r.hanzi, punct: s.punct + r.punct, tasks: s.tasks + 1, ms: s.ms + r.ms,
    firstTry: s.firstTry + r.firstTry, positions: s.positions + r.positions,
    punctErrors: s.punctErrors + r.punctErrors, halfwidth: s.halfwidth + r.halfwidth,
    hints: merge(s.hints, r.hints), ime: merge(s.ime, r.ime), mistakes: merge(s.mistakes, r.mistakes),
    daily: { ...s.daily, [today]: { hanzi: d.hanzi + r.hanzi, ms: d.ms + r.ms } },
  };
}
/** 每分鐘正確中文字數（不含標點） */
export const cpm = (hanzi: number, ms: number) => ms > 0 ? Math.round(hanzi / (ms / 60000)) : 0;
export const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
