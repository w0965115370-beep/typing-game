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

// ---- 適性學習 ----
export type Learner = { level: 1 | 2 | 3; punctStage: 1 | 2; clean: number; struggle: number; punctOk: number };
export const newLearner = (): Learner => ({ level: 1, punctStage: 1, clean: 0, struggle: 0, punctOk: 0 });

export type TaskResult = {
  hanzi: number; punct: number; ms: number;
  maxHint: number;          // 這次用到的最高提示等級（0～4）
  firstTry: number;         // 第一次就打對的字元數
  positions: number;        // 題目總字元數
  punctErrors: number; halfwidth: number;
  hints: Record<string, number>; ime: Record<string, number>; mistakes: Record<string, number>;
};

/** 依最近表現調整：連續 4 次不用提示且首次正確率 ≥90% 才升級；連續 2 次需要按鍵提示就降一級。農場等級不影響。 */
export function adapt(l0: Learner, r: TaskResult): Learner {
  const l = { ...l0 };
  if (r.maxHint === 0 && r.firstTry / r.positions >= 0.9) {
    l.clean++; l.struggle = 0;
    if (l.clean >= 4 && l.level < 3) { l.level = (l.level + 1) as Learner["level"]; l.clean = 0; }
  } else if (r.maxHint >= 2) {
    l.struggle++; l.clean = 0;
    if (l.struggle >= 2 && l.level > 1) { l.level = (l.level - 1) as Learner["level"]; l.struggle = 0; }
  } else { l.clean = 0; }
  // 逗號、句號熟練（累積 20 個且這次沒有標點錯誤）後，才加入頓號、問號、驚嘆號
  if (r.punctErrors === 0) l.punctOk += r.punct;
  if (l.punctStage === 1 && l.punctOk >= 20) l.punctStage = 2;
  return l;
}

/** 每種農場工作要打幾句：播種固定一句；其他工作依學生程度 1～2 句。 */
export const linesFor = (kind: string, l: Learner) => kind === "plant" ? 1 : l.level >= 2 ? 2 : 1;

// ---- 詩歌收藏 ----
export type Progress = { poemId: string; line: number };
export type Collection = Record<string, { count: number; first: string; last: string }>;

export function pickPoem(l: Learner, col: Collection, rng = Math.random, avoid?: string): string {
  const ok = POEMS.filter(p => p.punctStage <= l.punctStage && p.id !== avoid)
    // 程度 1 先練一句 5～7 字的詩；程度 3 才會出現六句的長詩
    .filter(p => l.level >= 3 || p.lines.length <= 4);
  const fresh = ok.filter(p => !col[p.id]);
  const pool = fresh.length ? fresh : ok;
  const least = Math.min(...pool.map(p => col[p.id]?.count ?? 0));
  const best = pool.filter(p => (col[p.id]?.count ?? 0) === least);
  return best[Math.floor(rng() * best.length)].id;
}

export function takeLines(p: Progress, n: number): Line[] {
  return POEM[p.poemId].lines.slice(p.line, p.line + n);
}

/** 完成幾句後前進；整首完成就收藏並換下一首。 */
export function advance(p: Progress, n: number, col: Collection, l: Learner, today: string, rng = Math.random) {
  const poem = POEM[p.poemId];
  const line = p.line + n;
  if (line < poem.lines.length) return { progress: { ...p, line }, collection: col, finished: null as Poem | null };
  const prev = col[poem.id];
  const collection = { ...col, [poem.id]: { count: (prev?.count ?? 0) + 1, first: prev?.first ?? today, last: today } };
  return { progress: { poemId: pickPoem(l, collection, rng, poem.id), line: 0 }, collection, finished: poem };
}

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
