// 農場規則（純函式）：每個動作都先驗證，失敗時回傳原因，不會產生負數金幣或負數庫存。
import {
  CROP, ACTIVE_CROPS, START, XP, MAX_LEVEL, xpToReach, THIRSTY_AT, ORDER_BONUS, ORDER_SLOTS,
  ORDER_NPCS, RESCUE_SEEDS, type CropId,
} from "../config/economy.ts";

export type PlotCrop = { id: CropId; grownMs: number; waters: number };
export type Plot = { id: number; x: number; y: number; crop: PlotCrop | null };
export type Order = { id: number; npc: string; items: Partial<Record<CropId, number>>; reward: number; xp: number };
export type Farm = {
  coins: number; xp: number;
  seeds: Partial<Record<CropId, number>>;
  inventory: Partial<Record<CropId, number>>;
  plots: Plot[]; orders: Order[]; nextOrderId: number;
  totals: { planted: number; harvested: number; orders: number; kinds: CropId[] };
};
export type Result = { ok: true; farm: Farm; levelUp?: number } | { ok: false; error: string };

// 6 塊初始農地排成 3×2，位於地圖中央偏左
const PLOT_SPOTS = [[6, 5], [7, 5], [8, 5], [6, 6], [7, 6], [8, 6]];

export function newFarm(seed = 1): Farm {
  const f: Farm = {
    coins: START.coins, xp: 0, seeds: { ...START.seeds }, inventory: {},
    plots: PLOT_SPOTS.slice(0, START.plots).map(([x, y], id) => ({ id, x, y, crop: null })),
    orders: [], nextOrderId: 1, totals: { planted: 0, harvested: 0, orders: 0, kinds: [] },
  };
  const rng = mulberry(seed);
  while (f.orders.length < ORDER_SLOTS) f.orders.push(makeOrder(f, rng));
  return f;
}

export const levelOf = (xp: number) => {
  let n = 1;
  while (n < MAX_LEVEL && xp >= xpToReach(n + 1)) n++;
  return n;
};
export const unlockedCrops = (f: Farm) => ACTIVE_CROPS.filter(c => c.unlock <= levelOf(f.xp));
const total = (c: PlotCrop) => CROP[c.id].growSec * 1000;

export const needsWater = (c: PlotCrop) => c.waters === 0 || (c.waters === 1 && c.grownMs >= total(c) * THIRSTY_AT && c.grownMs < total(c));
export const isRipe = (c: PlotCrop) => c.grownMs >= total(c);

/** 1 已播種、2 發芽、3 幼苗、4 成長中、5 成熟 */
export function stageOf(c: PlotCrop): 1 | 2 | 3 | 4 | 5 {
  const p = c.grownMs / total(c);
  if (p >= 1) return 5;
  if (c.waters === 0 || p < 0.01) return 1;
  if (p < 0.25) return 2;
  if (p < 0.5) return 3;
  return 4;
}

/** 遊戲時間前進：只有已澆水、不口渴的作物會長大。由呼叫端保證只在遊戲進行中呼叫。 */
export function tick(f: Farm, dtMs: number): Farm {
  let changed = false;
  const plots = f.plots.map(p => {
    const c = p.crop;
    if (!c || needsWater(c) || isRipe(c)) return p;
    let g = Math.min(total(c), c.grownMs + dtMs);
    if (c.waters === 1) g = Math.min(g, total(c) * THIRSTY_AT); // 長到一半先停下來等第二次澆水
    if (g === c.grownMs) return p;
    changed = true;
    return { ...p, crop: { ...c, grownMs: g } };
  });
  return changed ? { ...f, plots } : f;
}

const fail = (error: string): Result => ({ ok: false, error });
function gain(f: Farm, xp: number): Result {
  const before = levelOf(f.xp);
  f.xp += xp;
  const after = levelOf(f.xp);
  return { ok: true, farm: f, levelUp: after > before ? after : undefined };
}
const add = (bag: Partial<Record<CropId, number>>, id: CropId, n: number) => { bag[id] = (bag[id] ?? 0) + n; };

export function buySeed(f0: Farm, id: CropId, qty: number): Result {
  const crop = CROP[id];
  if (!crop?.phase1) return fail("這種種子還沒開放");
  if (!Number.isInteger(qty) || qty < 1) return fail("數量不正確");
  if (crop.unlock > levelOf(f0.xp)) return fail(`農場升到 Lv.${crop.unlock} 才能買`);
  const cost = crop.seedPrice * qty;
  if (cost > f0.coins) return fail("金幣不夠");
  const f = structuredClone(f0);
  f.coins -= cost;
  add(f.seeds, id, qty);
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
  f.plots.find(p => p.id === plotId)!.crop = { id, grownMs: 0, waters: 0 };
  f.totals.planted++;
  if (!f.totals.kinds.includes(id)) f.totals.kinds.push(id);
  return gain(f, XP.plant);
}

export function canWater(f: Farm, plotId: number): string | null {
  const c = f.plots.find(p => p.id === plotId)?.crop;
  if (!c) return "這塊田沒有作物";
  if (!needsWater(c)) return "現在不需要澆水";
  return null;
}
export function water(f0: Farm, plotId: number): Result {
  const err = canWater(f0, plotId);
  if (err) return fail(err);
  const f = structuredClone(f0);
  f.plots.find(p => p.id === plotId)!.crop!.waters++;
  return gain(f, XP.water);
}

export function canHarvest(f: Farm, plotId: number): string | null {
  const c = f.plots.find(p => p.id === plotId)?.crop;
  if (!c) return "這塊田沒有作物";
  if (!isRipe(c)) return "還沒成熟";
  return null;
}
export function harvest(f0: Farm, plotId: number): Result {
  const err = canHarvest(f0, plotId);
  if (err) return fail(err);
  const f = structuredClone(f0);
  const plot = f.plots.find(p => p.id === plotId)!;
  add(f.inventory, plot.crop!.id, 1);
  plot.crop = null;
  f.totals.harvested++;
  return gain(f, XP.harvest);
}

export function sell(f0: Farm, id: CropId, qty: number): Result {
  if (!Number.isInteger(qty) || qty < 1) return fail("數量不正確");
  if ((f0.inventory[id] ?? 0) < qty) return fail("背包裡沒有那麼多");
  const f = structuredClone(f0);
  f.inventory[id]! -= qty;
  f.coins += CROP[id].sellPrice * qty;
  return { ok: true, farm: f };
}

export function canFulfill(f: Farm, orderId: number): string | null {
  const o = f.orders.find(o => o.id === orderId);
  if (!o) return "這張訂單已經完成了";
  for (const [id, n] of Object.entries(o.items)) if ((f.inventory[id as CropId] ?? 0) < n!) return "農產品還不夠";
  return null;
}
/** 完成訂單：訂單從清單移除後才發獎勵，同一張訂單不可能領兩次。 */
export function fulfill(f0: Farm, orderId: number, rng = Math.random): Result {
  const err = canFulfill(f0, orderId);
  if (err) return fail(err);
  const f = structuredClone(f0);
  const i = f.orders.findIndex(o => o.id === orderId);
  const [o] = f.orders.splice(i, 1);
  for (const [id, n] of Object.entries(o.items)) f.inventory[id as CropId]! -= n!;
  f.coins += o.reward;
  f.totals.orders++;
  f.orders.splice(i, 0, makeOrder(f, rng));
  return gain(f, o.xp);
}

export function makeOrder(f: Farm, rng: () => number): Order {
  const crops = unlockedCrops(f);
  const kinds = crops.length > 1 && rng() < 0.4 ? 2 : 1;
  const items: Order["items"] = {};
  for (let k = 0; k < kinds; k++) {
    const c = crops[Math.floor(rng() * crops.length)];
    items[c.id] = (items[c.id] ?? 0) + 2 + Math.floor(rng() * 3);
  }
  const value = Object.entries(items).reduce((s, [id, n]) => s + CROP[id as CropId].sellPrice * n!, 0);
  const count = Object.values(items).reduce((s, n) => s + n!, 0);
  return {
    id: f.nextOrderId++, npc: ORDER_NPCS[Math.floor(rng() * ORDER_NPCS.length)],
    items, reward: Math.round(value * ORDER_BONUS), xp: XP.order + count,
  };
}

/** 沒有金幣買最便宜的種子、手上沒種子、田裡沒作物、背包也沒東西可賣時，送基礎種子。 */
export function needsRescue(f: Farm) {
  const cheapest = Math.min(...unlockedCrops(f).map(c => c.seedPrice));
  return f.coins < cheapest
    && !Object.values(f.seeds).some(n => n! > 0)
    && !f.plots.some(p => p.crop)
    && !Object.values(f.inventory).some(n => n! > 0);
}
export function rescue(f0: Farm): Result {
  if (!needsRescue(f0)) return fail("現在不需要幫忙");
  const f = structuredClone(f0);
  for (const [id, n] of Object.entries(RESCUE_SEEDS)) add(f.seeds, id as CropId, n);
  return { ok: true, farm: f };
}

/** 可重現的亂數（測試用） */
export function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
