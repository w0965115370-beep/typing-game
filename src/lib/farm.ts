// 農場規則（純函式）：每個動作都先驗證，失敗時回傳原因，不會產生負數金幣或負數種子。
// 玩法：用滑鼠播種 → 打完一首詩＝過一天：所有作物長大一天，成熟的自動採收換金幣。
import { CROP, ACTIVE_CROPS, START, XP, MAX_LEVEL, xpToReach, RESCUE_SEEDS, type CropId } from "../config/economy.ts";

export type PlotCrop = { id: CropId; days: number };
export type Plot = { id: number; x: number; y: number; crop: PlotCrop | null };
export type Farm = {
  coins: number; xp: number; day: number;
  seeds: Partial<Record<CropId, number>>;
  plots: Plot[];
  totals: { planted: number; harvested: number; kinds: CropId[] };
};
export type Result = { ok: true; farm: Farm; levelUp?: number } | { ok: false; error: string };
export type DayReport = {
  farm: Farm; levelUp?: number; earned: number;
  harvested: Partial<Record<CropId, number>>;
  growing: { id: CropId; left: number }[];
};

// 6 塊初始農地排成 3×2，位於地圖中央
const PLOT_SPOTS = [[6, 5], [7, 5], [8, 5], [6, 6], [7, 6], [8, 6]];

export function newFarm(): Farm {
  return {
    coins: START.coins, xp: 0, day: 1, seeds: { ...START.seeds },
    plots: PLOT_SPOTS.slice(0, START.plots).map(([x, y], id) => ({ id, x, y, crop: null })),
    totals: { planted: 0, harvested: 0, kinds: [] },
  };
}

export const levelOf = (xp: number) => {
  let n = 1;
  while (n < MAX_LEVEL && xp >= xpToReach(n + 1)) n++;
  return n;
};
export const unlockedCrops = (f: Farm) => ACTIVE_CROPS.filter(c => c.unlock <= levelOf(f.xp));
export const daysLeft = (c: PlotCrop) => Math.max(0, CROP[c.id].days - c.days);

/** 1 剛種下、2 發芽、3 幼苗、4 快長好了、5 成熟 */
export function stageOf(c: PlotCrop): 1 | 2 | 3 | 4 | 5 {
  const p = c.days / CROP[c.id].days;
  if (p >= 1) return 5;
  if (p === 0) return 1;
  if (p < 0.4) return 2;
  if (p < 0.6) return 3;
  return 4;
}

const fail = (error: string): Result => ({ ok: false, error });
function addXp(f: Farm, xp: number) {
  const before = levelOf(f.xp);
  f.xp += xp;
  const after = levelOf(f.xp);
  return after > before ? after : undefined;
}

export function buySeed(f0: Farm, id: CropId, qty: number): Result {
  const crop = CROP[id];
  if (!crop?.phase1) return fail("這種種子還沒開放");
  if (!Number.isInteger(qty) || qty < 1) return fail("數量不正確");
  if (crop.unlock > levelOf(f0.xp)) return fail(`農場升到 Lv.${crop.unlock} 才能種`);
  const cost = crop.seedPrice * qty;
  if (cost > f0.coins) return fail("金幣不夠");
  const f = structuredClone(f0);
  f.coins -= cost;
  f.seeds[id] = (f.seeds[id] ?? 0) + qty;
  return { ok: true, farm: f };
}

export function canPlant(f: Farm, plotId: number, id: CropId): string | null {
  const plot = f.plots.find(p => p.id === plotId);
  if (!plot) return "找不到這塊田";
  if (plot.crop) return "這塊田已經種了東西";
  if (!(f.seeds[id]! > 0)) return "沒有這種種子了";
  return null;
}
export function plant(f0: Farm, plotId: number, id: CropId): Result {
  const err = canPlant(f0, plotId, id);
  if (err) return fail(err);
  const f = structuredClone(f0);
  f.seeds[id]! -= 1;
  f.plots.find(p => p.id === plotId)!.crop = { id, days: 0 };
  f.totals.planted++;
  if (!f.totals.kinds.includes(id)) f.totals.kinds.push(id);
  return { ok: true, farm: f, levelUp: addXp(f, XP.plant) };
}

/** 打完一首詩：過一天。所有作物長大一天，成熟的自動採收、換成金幣。 */
export function endDay(f0: Farm): DayReport {
  const f = structuredClone(f0);
  const harvested: DayReport["harvested"] = {};
  const growing: DayReport["growing"] = [];
  let earned = 0, n = 0;
  for (const p of f.plots) {
    if (!p.crop) continue;
    p.crop.days++;
    if (daysLeft(p.crop) === 0) {
      harvested[p.crop.id] = (harvested[p.crop.id] ?? 0) + 1;
      earned += CROP[p.crop.id].sellPrice;
      n++;
      p.crop = null;
    } else growing.push({ id: p.crop.id, left: daysLeft(p.crop) });
  }
  f.coins += earned;
  f.day++;
  f.totals.harvested += n;
  const levelUp = addXp(f, XP.poem + n * XP.harvest);
  return { farm: f, levelUp, earned, harvested, growing };
}

/** 買不起最便宜的種子、手上沒種子、田裡也沒作物時，送基礎種子。 */
export function needsRescue(f: Farm) {
  const cheapest = Math.min(...unlockedCrops(f).map(c => c.seedPrice));
  return f.coins < cheapest && !Object.values(f.seeds).some(n => n! > 0) && !f.plots.some(p => p.crop);
}
export function rescue(f0: Farm): Result {
  if (!needsRescue(f0)) return fail("現在不需要幫忙");
  const f = structuredClone(f0);
  for (const [id, n] of Object.entries(RESCUE_SEEDS)) f.seeds[id as CropId] = (f.seeds[id as CropId] ?? 0) + n;
  return { ok: true, farm: f };
}
