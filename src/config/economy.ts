// 經濟與成長數值（規格書第 19、23、27 節的初始測試值），全部集中在這裡調整。
export type CropId = "radish" | "cabbage" | "carrot" | "tomato" | "corn"
  | "strawberry" | "pumpkin" | "watermelon" | "grape" | "melon";

export type Crop = {
  id: CropId; name: string; seedPrice: number; sellPrice: number; growSec: number; unlock: number;
  phase1: boolean; // 第一階段開放的 5 種作物
};

export const CROPS: Crop[] = [
  { id: "radish", name: "白蘿蔔", seedPrice: 10, sellPrice: 18, growSec: 30, unlock: 1, phase1: true },
  { id: "cabbage", name: "高麗菜", seedPrice: 20, sellPrice: 35, growSec: 60, unlock: 1, phase1: true },
  { id: "carrot", name: "紅蘿蔔", seedPrice: 30, sellPrice: 50, growSec: 90, unlock: 2, phase1: true },
  { id: "tomato", name: "番茄", seedPrice: 45, sellPrice: 80, growSec: 120, unlock: 3, phase1: true },
  { id: "corn", name: "玉米", seedPrice: 60, sellPrice: 110, growSec: 150, unlock: 4, phase1: true },
  { id: "strawberry", name: "草莓", seedPrice: 80, sellPrice: 150, growSec: 180, unlock: 5, phase1: false },
  { id: "pumpkin", name: "南瓜", seedPrice: 120, sellPrice: 230, growSec: 240, unlock: 7, phase1: false },
  { id: "watermelon", name: "西瓜", seedPrice: 180, sellPrice: 360, growSec: 300, unlock: 10, phase1: false },
  { id: "grape", name: "葡萄", seedPrice: 250, sellPrice: 520, growSec: 360, unlock: 12, phase1: false },
  { id: "melon", name: "哈密瓜", seedPrice: 400, sellPrice: 850, growSec: 480, unlock: 15, phase1: false },
];
export const CROP: Record<CropId, Crop> = Object.fromEntries(CROPS.map(c => [c.id, c])) as Record<CropId, Crop>;
export const ACTIVE_CROPS = CROPS.filter(c => c.phase1);

export const START = {
  coins: 300,
  seeds: { radish: 5, cabbage: 3 } as Partial<Record<CropId, number>>,
  plots: 6,
};

/** 經驗值：每一項都是「完成打字任務」才給。 */
export const XP = { plant: 3, water: 2, harvest: 4, order: 12, poem: 15, practice: 1 };

export const MAX_LEVEL = 30;
/** 升到 n 級需要的累積經驗值：Lv2=30、Lv3=80、Lv4=150、Lv5=240… */
export const xpToReach = (n: number) => 10 * (n * n - 1);

/** 第二次澆水：作物長到一半時會口渴一次，讓學生多一次打字機會。 */
export const THIRSTY_AT = 0.5;

/** 訂單獎勵倍率：高於直接販售，但不會高到破壞經濟。 */
export const ORDER_BONUS = 1.4;
export const ORDER_SLOTS = 3;

export const ORDER_NPCS = ["王奶奶", "早餐店老闆", "學校午餐廚房", "水果店老闆", "麵包店阿姨", "便當店叔叔"];

/** 沒錢也沒種子時，嚮導免費送的基礎種子，避免卡關。 */
export const RESCUE_SEEDS = { radish: 3 };
