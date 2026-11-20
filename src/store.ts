// 全域狀態：關卡地圖、目前的打字任務、成績與設定。打字元件只在開始時讀取任務。
import { create } from "zustand";
import * as L from "./lib/learning.ts";
import { loadSave, writeSave } from "./lib/save.ts";
import { sfx } from "./lib/audio.ts";

export type Task = { id: number; title: string; lines: L.Line[]; level?: number };
export type Screen = null | "records" | "settings";
export type Settings = {
  sfx: number; music: number; muted: boolean; fontScale: number; lowPerf: boolean;
  ime: "ms-bopomofo" | "other-bopomofo" | "cangjie" | "other";
};
export type LevelResult = ReturnType<typeof L.scoreOf> & { level: number; best: boolean };

type Persist = { best: L.Best; stats: L.Stats; settings: Settings; tutorial: number };
type State = Persist & {
  screen: Screen; task: Task | null; result: LevelResult | null;
  toast: { text: string; id: number } | null; saveStatus: "saved" | "saving" | "error";
};

const fresh = (): Persist => ({
  best: {}, stats: L.newStats(), tutorial: 0,
  settings: { sfx: 0.4, music: 0.15, muted: false, fontScale: 1, lowPerf: false, ime: "ms-bopomofo" },
});

export const useGame = create<State>(() => ({
  ...fresh(), ...(loadSave<Persist>() ?? {}),
  screen: null, task: null, result: null, toast: null, saveStatus: "saved",
}));
const set = useGame.setState, get = useGame.getState;

let timer = 0;
export function saveSoon(delay = 300) {
  set({ saveStatus: "saving" });
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    const s = get();
    const ok = writeSave({ best: s.best, stats: s.stats, settings: s.settings, tutorial: s.tutorial } satisfies Persist);
    set({ saveStatus: ok ? "saved" : "error" });
  }, delay);
}

let toastId = 0;
export const toast = (text: string) => set({ toast: { text, id: ++toastId } });

/** 第 i 關是否已開放：第 1 關一開始就能玩，之後要過了前一關。 */
export const unlocked = (best: L.Best, i: number) => i === 0 || !!best[L.LEVELS[i - 1].id];
export const totalScore = (best: L.Best) => Object.values(best).reduce((n, b) => n + b.score, 0);
export const totalStars = (best: L.Best) => Object.values(best).reduce((n, b) => n + b.stars, 0);
/** 下一個要挑戰的關卡：第一個還沒過的關卡 */
export const nextLevel = (best: L.Best) => L.LEVELS.findIndex(p => !best[p.id]);

let taskSeq = 0;
export function startLevel(i: number) {
  if (!unlocked(get().best, i) || !L.LEVELS[i]) return;
  sfx("click");
  const p = L.LEVELS[i];
  set({ screen: null, result: null, task: { id: ++taskSeq, title: `第 ${i + 1} 關：${p.title}`, lines: p.lines, level: i } });
}
export function startPractice(line: L.Line, title = "練習") {
  set({ screen: null, task: { id: ++taskSeq, title, lines: [line] } });
}
export const cancelTask = () => set({ task: null });

/** 打完：記錄學習；如果是關卡，算分、更新最高分、解鎖下一關。 */
export function completeTask(r: L.TaskResult) {
  const s = get();
  const t = s.task;
  if (!t) return;
  const stats = L.record(s.stats, r, L.today());
  if (t.level === undefined) { set({ task: null, stats }); saveSoon(); return; }
  const sc = L.scoreOf(r);
  const id = L.LEVELS[t.level].id;
  const prev = s.best[id];
  const isBest = !prev || sc.total > prev.score;
  const best = { ...s.best, [id]: { score: Math.max(prev?.score ?? 0, sc.total), stars: Math.max(prev?.stars ?? 0, sc.stars), plays: (prev?.plays ?? 0) + 1 } };
  set({ task: null, stats, best, result: { ...sc, level: t.level, best: isBest } });
  sfx("levelup");
  saveSoon();
}

export function updateSettings(p: Partial<Settings>) { set({ settings: { ...get().settings, ...p } }); saveSoon(); }
export function setTutorial(step: number) { set({ tutorial: step }); saveSoon(); }
