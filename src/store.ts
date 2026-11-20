// 全域狀態。打字元件不訂閱農場狀態，農場每秒成長不會讓輸入框重新渲染。
import { create } from "zustand";
import * as F from "./lib/farm.ts";
import * as L from "./lib/learning.ts";
import { CROP, XP, type CropId } from "./config/economy.ts";
import { loadSave, writeSave } from "./lib/save.ts";
import { sfx } from "./lib/audio.ts";

export type TaskKind = "plant" | "water" | "harvest" | "order" | "practice";
export type Task = {
  id: number; kind: TaskKind; title: string; lines: L.Line[];
  plotId?: number; cropId?: CropId; orderId?: number; poemId?: string;
};
export type Screen = null | "seeds" | "shop" | "bag" | "orders" | "book" | "records" | "settings";
export type Settings = {
  sfx: number; music: number; muted: boolean; fontScale: number; lowPerf: boolean;
  ime: "ms-bopomofo" | "other-bopomofo" | "cangjie" | "other";
};

type Persist = {
  farm: F.Farm; learner: L.Learner; progress: L.Progress; collection: L.Collection;
  stats: L.Stats; settings: Settings; tutorial: number; playMs: number;
};
type State = Persist & {
  screen: Screen; task: Task | null; selectedPlot: number | null; selectedSeed: CropId | null;
  toast: { text: string; id: number } | null; saveStatus: "saved" | "saving" | "error";
  paused: boolean; levelUp: number | null; poemDone: string | null;
};

const fresh = (): Persist => ({
  farm: F.newFarm(Date.now()), learner: L.newLearner(),
  progress: { poemId: "chunxiao", line: 0 }, collection: {}, stats: L.newStats(),
  settings: { sfx: 0.4, music: 0.15, muted: false, fontScale: 1, lowPerf: false, ime: "ms-bopomofo" },
  tutorial: 0, playMs: 0,
});

const saved = loadSave<Persist>();
export const useGame = create<State>(() => ({
  ...fresh(), ...(saved ?? {}),
  screen: null, task: null, selectedPlot: null, selectedSeed: null, toast: null,
  saveStatus: "saved", paused: false, levelUp: null, poemDone: null,
}));
const set = useGame.setState, get = useGame.getState;

// ---- 存檔：重要操作後 0.5 秒內寫入；每秒成長只在 10 秒一次的節奏存 ----
let timer = 0;
export function saveSoon(delay = 500) {
  set({ saveStatus: "saving" });
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    const s = get();
    const ok = writeSave({
      farm: s.farm, learner: s.learner, progress: s.progress, collection: s.collection,
      stats: s.stats, settings: s.settings, tutorial: s.tutorial, playMs: s.playMs,
    } satisfies Persist);
    set({ saveStatus: ok ? "saved" : "error" });
  }, delay);
}

let toastId = 0;
export const toast = (text: string) => set({ toast: { text, id: ++toastId } });

function applyFarm(r: F.Result, okText?: string) {
  if (!r.ok) { toast(r.error); sfx("soft"); return false; }
  set({ farm: r.farm });
  if (r.levelUp) { set({ levelUp: r.levelUp }); sfx("levelup"); }
  if (okText) toast(okText);
  saveSoon();
  return true;
}

// ---- 遊戲時間：只有在畫面開著、沒有暫停時才前進；離線不會補算 ----
export function tickGame(dtMs: number) {
  const s = get();
  if (s.paused || document.hidden) return;
  const dt = Math.min(dtMs, 2000);
  const farm = F.tick(s.farm, dt);
  set({ farm, playMs: s.playMs + dt });
  if (Math.floor((s.playMs + dt) / 10000) !== Math.floor(s.playMs / 10000)) saveSoon(0);
}

// ---- 打字任務 ----
let taskSeq = 0;
function poemTask(kind: TaskKind, title: string, extra: Partial<Task>): Task {
  const s = get();
  const lines = L.takeLines(s.progress, L.linesFor(kind, s.learner));
  return { id: ++taskSeq, kind, title, lines, poemId: s.progress.poemId, ...extra };
}

export function clickPlot(plotId: number) {
  const s = get();
  if (s.task) return;
  const plot = s.farm.plots.find(p => p.id === plotId)!;
  set({ selectedPlot: plotId });
  if (!plot.crop) {
    if (!s.selectedSeed) { toast("先在下面的「種子」選一種種子"); set({ screen: "seeds" }); return; }
    const err = F.canPlant(s.farm, plotId, s.selectedSeed);
    if (err) { toast(err); return; }
    set({ task: poemTask("plant", `播種：${CROP[s.selectedSeed].name}`, { plotId, cropId: s.selectedSeed }) });
  } else if (F.needsWater(plot.crop)) {
    set({ task: poemTask("water", `澆水：${CROP[plot.crop.id].name}`, { plotId }) });
  } else if (F.isRipe(plot.crop)) {
    set({ task: poemTask("harvest", `採收：${CROP[plot.crop.id].name}`, { plotId }) });
  }
}

export function startOrder(orderId: number) {
  const s = get();
  const err = F.canFulfill(s.farm, orderId);
  if (err) { toast(err); return; }
  const o = s.farm.orders.find(o => o.id === orderId)!;
  set({ screen: null, task: poemTask("order", `出貨給${o.npc}`, { orderId }) });
}

export function startPractice(text: L.Line, title = "新手練習") {
  set({ task: { id: ++taskSeq, kind: "practice", title, lines: [text] } });
}

export const cancelTask = () => set({ task: null });

/** 打字完成：再驗證一次農場動作，才發放成果並前進詩歌進度。 */
export function completeTask(r: L.TaskResult) {
  const s = get();
  const t = s.task;
  if (!t) return;
  const day = L.today();
  set({ task: null, stats: L.record(s.stats, r, day), learner: L.adapt(s.learner, r) });
  if (t.kind === "practice") { saveSoon(); return; }

  let res: F.Result;
  if (t.kind === "plant") res = F.plant(get().farm, t.plotId!, t.cropId!);
  else if (t.kind === "water") res = F.water(get().farm, t.plotId!);
  else if (t.kind === "harvest") res = F.harvest(get().farm, t.plotId!);
  else res = F.fulfill(get().farm, t.orderId!);
  const sound = { plant: "plant", water: "water", harvest: "harvest", order: "order" }[t.kind];
  if (!applyFarm(res)) return;
  sfx(sound as Parameters<typeof sfx>[0]);

  // 詩歌進度只在這首詩的題目完成時前進（任務開始後換過詩就不算）
  const s2 = get();
  if (t.poemId === s2.progress.poemId) {
    const a = L.advance(s2.progress, t.lines.length, s2.collection, s2.learner, day);
    set({ progress: a.progress, collection: a.collection });
    if (a.finished) {
      const g = F.levelOf(get().farm.xp);
      const farm = { ...get().farm, xp: get().farm.xp + XP.poem };
      set({ farm, poemDone: a.finished.id });
      if (F.levelOf(farm.xp) > g) set({ levelUp: F.levelOf(farm.xp) });
    }
  }
  saveSoon();
}

// ---- 商店與背包（用滑鼠完成，不需要打字） ----
export function buy(id: CropId, qty: number) {
  if (applyFarm(F.buySeed(get().farm, id, qty), `買了 ${qty} 包${CROP[id].name}種子`)) {
    sfx("coin"); set({ selectedSeed: id });
  }
}
export function sellCrop(id: CropId, qty: number) {
  if (applyFarm(F.sell(get().farm, id, qty), `賣出 ${qty} 個${CROP[id].name}，得到 ${CROP[id].sellPrice * qty} 金幣`)) {
    sfx("coin");
    if (get().tutorial === 13) setTutorial(14);
  }
}
export function askRescue() {
  if (applyFarm(F.rescue(get().farm), "阿禾送你 3 包白蘿蔔種子，再試一次吧！")) set({ selectedSeed: "radish" });
}

export function updateSettings(p: Partial<Settings>) { set({ settings: { ...get().settings, ...p } }); saveSoon(); }
export function setTutorial(step: number) { set({ tutorial: step }); saveSoon(); }
