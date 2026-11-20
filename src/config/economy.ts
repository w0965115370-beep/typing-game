// 經濟與成長數值，全部集中在這裡調整。價格用規格書的初始測試值；成長改用「天數」：打完一首詩＝過一天。
export type CropId = "radish" | "cabbage" | "carrot" | "tomato" | "corn"
  | "strawberry" | "pumpkin" | "watermelon" | "grape" | "melon";

export type Crop = {
  id: CropId; name: string; seedPrice: number; sellPrice: number; days: number; unlock: number;
  phase1: boolean; // 第一階段開放的 5 種作物
};

export const CROPS: Crop[] = [
  { id: "radish", name: "白蘿蔔", seedPrice: 10, sellPrice: 18, days: 1, unlock: 1, phase1: true },
  { id: "cabbage", name: "高麗菜", seedPrice: 20, sellPrice: 35, days: 2, unlock: 1, phase1: true },
  { id: "carrot", name: "紅蘿蔔", seedPrice: 30, sellPrice: 50, days: 2, unlock: 2, phase1: true },
  { id: "tomato", name: "番茄", seedPrice: 45, sellPrice: 80, days: 3, unlock: 3, phase1: true },
  { id: "corn", name: "玉米", seedPrice: 60, sellPrice: 110, days: 3, unlock: 4, phase1: true },
  { id: "strawberry", name: "草莓", seedPrice: 80, sellPrice: 150, days: 3, unlock: 5, phase1: false },
  { id: "pumpkin", name: "南瓜", seedPrice: 120, sellPrice: 230, days: 4, unlock: 7, phase1: false },
  { id: "watermelon", name: "西瓜", seedPrice: 180, sellPrice: 360, days: 4, unlock: 10, phase1: false },
  { id: "grape", name: "葡萄", seedPrice: 250, sellPrice: 520, days: 5, unlock: 12, phase1: false },
  { id: "melon", name: "哈密瓜", seedPrice: 400, sellPrice: 850, days: 5, unlock: 15, phase1: false },
];
export const CROP: Record<CropId, Crop> = Object.fromEntries(CROPS.map(c => [c.id, c])) as Record<CropId, Crop>;
export const ACTIVE_CROPS = CROPS.filter(c => c.phase1);

export const START = {
  coins: 300,
  seeds: { radish: 5, cabbage: 3 } as Partial<Record<CropId, number>>,
  plots: 6,
};

/** 經驗值：打完一首詩（一天）15、每種下一棵 2、每收成一棵 4。 */
export const XP = { plant: 2, harvest: 4, poem: 15 };

export const MAX_LEVEL = 30;
/** 升到 n 級需要的累積經驗值：Lv2=30、Lv3=80、Lv4=150、Lv5=240… */
export const xpToReach = (n: number) => 10 * (n * n - 1);

/** 沒錢也沒種子時，嚮導免費送的基礎種子，避免卡關。 */
export const RESCUE_SEEDS = { radish: 3 };
