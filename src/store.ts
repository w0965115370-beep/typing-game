// 全域狀態。打字元件不訂閱農場狀態，農場更新不會讓輸入框重新渲染。
import { create } from "zustand";
import * as F from "./lib/farm.ts";
import * as L from "./lib/learning.ts";
import { CROP, type CropId } from "./config/economy.ts";
import { loadSave, writeSave } from "./lib/save.ts";
import { sfx } from "./lib/audio.ts";

export type Task = { id: number; kind: "day" | "practice"; title: string; lines: L.Line[]; poemId?: string };
export type Screen = null | "seeds" | "book" | "records" | "settings";
export type Settings = {
  sfx: number; music: number; muted: boolean; fontScale: number; lowPerf: boolean;
  ime: "ms-bopomofo" | "other-bopomofo" | "cangjie" | "other";
};
export type DayResult = F.DayReport & { poemId: string; firstTime: boolean };

type Persist = {
  farm: F.Farm; learner: L.Learner; poemId: string; collection: L.Collection;
  stats: L.Stats; settings: Settings; tutorial: number;
};
type State = Persist & {
  screen: Screen; pickPlot: number | null; task: Task | null;
  toast: { text: string; id: number } | null; saveStatus: "saved" | "saving" | "error";
  levelUp: number | null; dayResult: DayResult | null;
};

const fresh = (): Persist => ({
  farm: F.newFarm(), learner: L.newLearner(), poemId: "chunxiao", collection: {}, stats: L.newStats(),
  settings: { sfx: 0.4, music: 0.15, muted: false, fontScale: 1, lowPerf: false, ime: "ms-bopomofo" },
  tutorial: 0,
});

export const useGame = create<State>(() => ({
  ...fresh(), ...(loadSave<Persist>() ?? {}),
  screen: null, pickPlot: null, task: null, toast: null, saveStatus: "saved", levelUp: null, dayResult: null,
}));
const set = useGame.setState, get = useGame.getState;

// ---- 存檔：每個操作後 0.5 秒內寫入 ----
let timer = 0;
export function saveSoon(delay = 500) {
  set({ saveStatus: "saving" });
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    const s = get();
    const ok = writeSave({
      farm: s.farm, learner: s.learner, poemId: s.poemId, collection: s.collection,
      stats: s.stats, settings: s.settings, tutorial: s.tutorial,
    } satisfies Persist);
    set({ saveStatus: ok ? "saved" : "error" });
  }, delay);
}

let toastId = 0;
export const toast = (text: string) => set({ toast: { text, id: ++toastId } });

function applyFarm(r: F.Result) {
  if (!r.ok) { toast(r.error); sfx("soft"); return false; }
  set({ farm: r.farm });
  if (r.levelUp) set({ levelUp: r.levelUp });
  saveSoon();
  return true;
}

/** 點田：空田 → 跳出種子選單；有作物 → 告訴小朋友還要幾天。 */
export function clickPlot(plotId: number) {
  const s = get();
  if (s.task) return;
  const c = s.farm.plots.find(p => p.id === plotId)?.crop;
  if (!c) { sfx("click"); set({ screen: "seeds", pickPlot: plotId }); return; }
  toast(`${CROP[c.id].name}還要 ${F.daysLeft(c)} 天，打完一首詩就會長大！`);
}

/** 種子選單：有種子就直接種；沒有就先花金幣買一包再種。 */
export function chooseSeed(id: CropId) {
  const s = get();
  const plotId = s.pickPlot;
  if (plotId === null) return;
  if (!(s.farm.seeds[id]! > 0) && !applyFarm(F.buySeed(s.farm, id, 1))) return;
  if (!applyFarm(F.plant(get().farm, plotId, id))) return;
  sfx("plant");
  set({ screen: null, pickPlot: null });
}

let taskSeq = 0;
export function startDay() {
  const s = get();
  if (s.task) return;
  const poem = L.POEM[s.poemId];
  set({ screen: null, task: { id: ++taskSeq, kind: "day", title: `第 ${s.farm.day} 天的農事`, lines: poem.lines, poemId: poem.id } });
}
export function startPractice(line: L.Line, title = "練習") {
  set({ screen: null, task: { id: ++taskSeq, kind: "practice", title, lines: [line] } });
}
export const cancelTask = () => set({ task: null });

/** 打完：記錄學習；如果是一天的農事，作物長大、自動採收、收藏這首詩、換下一首。 */
export function completeTask(r: L.TaskResult) {
  const s = get();
  const t = s.task;
  if (!t) return;
  const day = L.today();
  const learner = L.adapt(s.learner, r);
  set({ task: null, stats: L.record(s.stats, r, day), learner });
  if (t.kind === "day") {
    const rep = F.endDay(s.farm);
    const firstTime = !s.collection[t.poemId!];
    const collection = L.collect(s.collection, t.poemId!, day);
    set({
      farm: rep.farm, collection, poemId: L.pickPoem(learner, collection, Math.random, t.poemId),
      dayResult: { ...rep, poemId: t.poemId!, firstTime },
      levelUp: rep.levelUp ?? null,
    });
    sfx(rep.earned ? "harvest" : "water");
  }
  saveSoon();
}

export function askRescue() { if (applyFarm(F.rescue(get().farm))) toast("阿禾送你 3 包白蘿蔔種子！"); }
export function updateSettings(p: Partial<Settings>) { set({ settings: { ...get().settings, ...p } }); saveSoon(); }
export function setTutorial(step: number) { set({ tutorial: step }); saveSoon(); }
