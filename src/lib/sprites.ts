// 原創像素素材：全部用程式在 16×16（或倍數）畫布上逐點繪製，啟動時產生一次並快取。
// 顯示時以整數倍放大並使用 image-rendering: pixelated（nearest-neighbor）。
import type { CropId } from "../config/economy.ts";

type Px = (x: number, y: number, w: number, h: number, c: string) => void;
const cache = new Map<string, string>();

function draw(key: string, w: number, h: number, fn: (p: Px) => void): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d")!;
  fn((x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); });
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}

const P = {
  g1: "#86cc6e", g2: "#74bd5f", g3: "#62a852", g4: "#4f9446",
  s1: "#b77b4e", s2: "#9a6340", s3: "#7c4c30", w1: "#7a5236", w2: "#5e3e28", w3: "#4b3020",
  wood: "#b07a43", woodD: "#835a31", woodL: "#cf9b5f",
  roof: "#d65a4a", roofD: "#a9433a", roofL: "#ea7b66", wall: "#f6e7c4", wallD: "#dcc69c",
  glass: "#9fdcf5", glassD: "#5fb3dc", water: "#5ab6e6", waterD: "#3e97cf", waterL: "#a6def7",
  leaf: "#5fbf4f", leafD: "#3f9a3a", leafL: "#8be06a", out: "#3a2a1e", white: "#fffdf5",
  stone: "#d9d0b8", stoneD: "#b9ae94", gold: "#f6c945", goldD: "#d89a1e", sky: "#bfe6ff",
};

// 依座標產生固定的雜點，讓草地有紋理但每次畫出來都一樣
const hash = (x: number, y: number, s: number) => ((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) >>> 0;

/** 整張地圖的草地，一次畫好當背景 */
export function ground(w: number, h: number) {
  return draw(`ground${w}x${h}`, w * 16, h * 16, p => {
    p(0, 0, w * 16, h * 16, P.g1);
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      const v = (tx * 7 + ty * 13) % 6, ox = tx * 16, oy = ty * 16;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const k = hash(x + ox, y + oy, v) % 23;
        if (k === 0) p(ox + x, oy + y, 1, 1, P.g2);
        if (k === 1) p(ox + x, oy + y, 1, 1, P.g3);
      }
      if (v % 3 === 0) { p(ox + 4, oy + 9, 1, 2, P.g4); p(ox + 5, oy + 8, 1, 3, P.g4); p(ox + 6, oy + 9, 1, 2, P.g4); }
      if (v % 4 === 1) { p(ox + 11, oy + 4, 1, 2, P.g3); p(ox + 12, oy + 3, 1, 3, P.g3); }
    }
  });
}

export function soil(wet: boolean, selected = false) {
  return draw(`soil${wet}${selected}`, 16, 16, p => {
    const [a, b, c] = wet ? [P.w1, P.w2, P.w3] : [P.s1, P.s2, P.s3];
    p(0, 0, 16, 16, P.g1);
    p(1, 1, 14, 14, a);
    for (const y of [3, 7, 11]) { p(2, y, 12, 1, b); p(2, y + 1, 12, 1, c); }
    p(1, 14, 14, 1, c);
    if (wet) { p(4, 5, 1, 1, P.waterL); p(10, 9, 1, 1, P.waterL); p(7, 13, 1, 1, P.waterL); }
    if (selected) { p(0, 0, 16, 1, P.gold); p(0, 15, 16, 1, P.gold); p(0, 0, 1, 16, P.gold); p(15, 0, 1, 16, P.gold); }
  });
}

export function path() {
  return draw("path", 16, 16, p => {
    p(0, 0, 16, 16, P.g1);
    p(1, 1, 6, 6, P.stone); p(9, 2, 6, 5, P.stone); p(2, 9, 5, 6, P.stone); p(8, 9, 7, 6, P.stone);
    p(1, 6, 6, 1, P.stoneD); p(9, 6, 6, 1, P.stoneD); p(2, 14, 5, 1, P.stoneD); p(8, 14, 7, 1, P.stoneD);
  });
}

export function house() {
  return draw("house", 48, 48, p => {
    p(4, 20, 40, 26, P.wall); p(4, 44, 40, 2, P.wallD);
    for (let i = 0; i < 18; i++) { p(6 + i, 18 - i, 36 - 2 * i, 2, i % 3 === 0 ? P.roofD : P.roof); }
    p(2, 18, 44, 3, P.roofD); p(22, 2, 4, 2, P.roofL);
    p(30, 6, 5, 9, P.woodD); p(29, 5, 7, 2, P.out);
    p(20, 30, 9, 16, P.woodD); p(21, 31, 7, 15, P.wood); p(26, 38, 1, 2, P.gold);
    for (const x of [8, 33]) {
      p(x, 26, 9, 9, P.woodD); p(x + 1, 27, 7, 7, P.glass); p(x + 1, 27, 3, 3, P.white);
      p(x + 4, 27, 1, 7, P.woodD); p(x + 1, 30, 7, 1, P.woodD);
    }
    p(4, 46, 40, 2, "rgba(0,0,0,.18)");
  });
}

export function tree() {
  return draw("tree", 32, 32, p => {
    p(13, 20, 6, 11, P.woodD); p(14, 20, 2, 11, P.wood);
    p(6, 6, 20, 16, P.leafD); p(4, 10, 24, 9, P.leafD); p(9, 2, 14, 6, P.leafD);
    p(7, 7, 17, 13, P.leaf); p(10, 3, 11, 5, P.leaf); p(9, 6, 6, 4, P.leafL); p(18, 12, 3, 3, P.leafL);
    p(11, 14, 2, 2, "#e8433a"); p(20, 8, 2, 2, "#e8433a");
    p(8, 30, 16, 2, "rgba(0,0,0,.15)");
  });
}

export function fence() {
  return draw("fence", 16, 16, p => {
    p(0, 7, 16, 2, P.woodD); p(0, 11, 16, 2, P.woodD);
    p(2, 4, 3, 11, P.wood); p(11, 4, 3, 11, P.wood); p(2, 4, 3, 1, P.woodL); p(11, 4, 3, 1, P.woodL);
  });
}

export function flower(color: string) {
  return draw(`flower${color}`, 16, 16, p => {
    for (const [x, y] of [[3, 4], [10, 7], [6, 11]]) {
      p(x + 1, y + 2, 1, 3, P.leafD);
      p(x, y, 3, 1, color); p(x + 1, y - 1, 1, 3, color); p(x + 1, y, 1, 1, P.gold);
    }
  });
}

export function pond() {
  return draw("pond", 32, 32, p => {
    p(3, 4, 26, 24, P.stoneD); p(4, 3, 24, 26, P.stoneD);
    p(5, 5, 22, 22, P.water); p(4, 7, 24, 18, P.water);
    p(8, 9, 6, 1, P.waterL); p(17, 18, 7, 1, P.waterL); p(6, 22, 20, 3, P.waterD);
    p(20, 8, 4, 3, P.leaf); p(21, 9, 1, 1, "#f49bc1");
  });
}

// ---- 作物：五個成長階段 ----
const CROP_COLORS: Record<CropId, { leaf: string; leafD: string; fruit: string; fruitD: string }> = {
  radish: { leaf: "#6cc65a", leafD: "#3f9a3a", fruit: "#f4f1e6", fruitD: "#d9d3c0" },
  cabbage: { leaf: "#9fdc7c", leafD: "#5fae4c", fruit: "#c3eea0", fruitD: "#86c96a" },
  carrot: { leaf: "#58b84a", leafD: "#3a8a35", fruit: "#f28a2a", fruitD: "#c96515" },
  tomato: { leaf: "#4fa846", leafD: "#337e30", fruit: "#e8463a", fruitD: "#b82e25" },
  corn: { leaf: "#78c44c", leafD: "#4c9433", fruit: "#f6d23c", fruitD: "#d5a71e" },
  strawberry: { leaf: "#4fa846", leafD: "#337e30", fruit: "#e8463a", fruitD: "#b82e25" },
  pumpkin: { leaf: "#58b84a", leafD: "#3a8a35", fruit: "#f28a2a", fruitD: "#c96515" },
  watermelon: { leaf: "#58b84a", leafD: "#3a8a35", fruit: "#3f9a3a", fruitD: "#2c6e29" },
  grape: { leaf: "#58b84a", leafD: "#3a8a35", fruit: "#8a4fc0", fruitD: "#5e3389" },
  melon: { leaf: "#58b84a", leafD: "#3a8a35", fruit: "#d8e89a", fruitD: "#a9bd6a" },
};

export function crop(id: CropId, stage: number) {
  const k = CROP_COLORS[id];
  return draw(`crop${id}${stage}`, 16, 16, p => {
    if (stage === 1) { // 已播種：小土堆和種子
      p(5, 11, 6, 2, P.s3); p(6, 10, 4, 1, P.s3); p(6, 11, 1, 1, P.wallD); p(9, 11, 1, 1, P.wallD);
      return;
    }
    if (stage === 2) { // 發芽
      p(7, 9, 1, 4, P.leafD); p(5, 8, 2, 2, P.leaf); p(8, 7, 3, 2, P.leaf); p(9, 7, 1, 1, P.leafL);
      return;
    }
    if (id === "corn") {
      const h = stage === 3 ? 6 : stage === 4 ? 10 : 13;
      p(7, 14 - h, 2, h, k.leafD); p(4, 14 - h + 3, 3, 1, k.leaf); p(9, 14 - h + 5, 3, 1, k.leaf);
      p(3, 14 - h + 4, 2, 1, k.leaf); p(11, 14 - h + 6, 2, 1, k.leaf);
      if (stage >= 4) { p(5, 14 - h + 7, 2, 1, k.leaf); p(9, 14 - h + 1, 3, 1, k.leaf); }
      if (stage === 5) { p(9, 4, 3, 5, k.fruit); p(10, 4, 1, 5, k.fruitD); p(9, 3, 3, 1, P.leafL); p(4, 6, 3, 4, k.fruit); p(4, 6, 1, 4, k.fruitD); }
      return;
    }
    if (id === "tomato") {
      p(7, 3, 1, 11, P.woodD); // 支架
      const top = stage === 3 ? 9 : stage === 4 ? 5 : 3;
      for (let y = top; y < 14; y += 2) { p(5, y, 2, 2, k.leaf); p(8, y + 1, 3, 2, k.leafD); }
      if (stage === 4) { p(5, 9, 2, 2, "#9fd36a"); }
      if (stage === 5) { p(4, 6, 3, 3, k.fruit); p(9, 8, 3, 3, k.fruit); p(5, 11, 3, 3, k.fruit); p(4, 6, 1, 1, P.white); p(9, 8, 1, 1, P.white); p(5, 11, 1, 1, P.white); }
      return;
    }
    if (id === "cabbage") {
      const r = stage === 3 ? 3 : stage === 4 ? 5 : 6;
      p(8 - r, 13 - r, r * 2, r, k.leafD); p(8 - r + 1, 12 - r, r * 2 - 2, r, k.leaf);
      if (stage >= 4) { p(8 - r + 2, 13 - r - 1, r * 2 - 4, r - 1, k.fruit); }
      if (stage === 5) { p(5, 6, 6, 5, k.fruit); p(6, 7, 4, 3, k.fruitD); p(7, 7, 2, 1, P.white); }
      return;
    }
    // 白蘿蔔、紅蘿蔔：葉子在上、根露出土面
    const leafH = stage === 3 ? 4 : stage === 4 ? 7 : 8;
    p(7, 13 - leafH, 2, leafH, k.leafD);
    p(4, 13 - leafH + 1, 3, 2, k.leaf); p(9, 13 - leafH, 3, 2, k.leaf);
    if (stage >= 4) { p(3, 13 - leafH + 4, 3, 2, k.leaf); p(10, 13 - leafH + 3, 3, 2, k.leaf); }
    if (id === "carrot") { p(4, 13 - leafH, 1, 2, k.leaf); p(11, 13 - leafH - 1, 1, 2, k.leaf); }
    if (stage >= 4) { const w = stage === 5 ? 6 : 4; p(8 - w / 2, 12, w, 3, k.fruit); p(8 - w / 2, 14, w, 1, k.fruitD); }
  });
}

export function produce(id: CropId) {
  const k = CROP_COLORS[id];
  return draw(`produce${id}`, 16, 16, p => {
    if (id === "radish" || id === "carrot") {
      p(6, 1, 1, 4, k.leaf); p(8, 0, 1, 5, k.leafD); p(10, 1, 1, 4, k.leaf);
      p(5, 5, 7, 4, k.fruit); p(6, 9, 5, 3, k.fruit); p(7, 12, 3, 2, k.fruit); p(8, 14, 1, 1, k.fruitD);
      p(10, 6, 1, 6, k.fruitD); p(6, 6, 1, 1, P.white);
    } else if (id === "cabbage") {
      p(3, 4, 10, 9, k.leafD); p(4, 3, 8, 11, k.leafD); p(5, 5, 6, 7, k.fruit); p(6, 6, 2, 2, P.white); p(8, 4, 1, 9, k.fruitD);
    } else if (id === "tomato") {
      p(4, 5, 8, 8, k.fruit); p(3, 6, 10, 6, k.fruit); p(5, 4, 6, 1, k.leafD); p(7, 2, 2, 3, k.leafD);
      p(5, 6, 2, 2, P.white); p(10, 10, 2, 2, k.fruitD);
    } else {
      p(5, 2, 6, 12, k.fruit); p(6, 1, 4, 14, k.fruit);
      for (let y = 3; y < 13; y += 2) p(6, y, 4, 1, k.fruitD);
      p(3, 8, 2, 7, P.leaf); p(11, 7, 2, 8, P.leaf);
    }
  });
}

export function seedBag(id: CropId) {
  const k = CROP_COLORS[id];
  return draw(`bag${id}`, 16, 16, p => {
    p(3, 3, 10, 12, P.wallD); p(4, 2, 8, 13, P.wall); p(4, 2, 8, 2, P.woodL); p(7, 1, 2, 2, P.woodD);
    p(5, 6, 6, 6, k.fruit); p(6, 7, 4, 4, k.leaf); p(7, 8, 2, 2, k.fruit);
  });
}

// ---- 介面圖示 ----
export const icons = {
  coin: () => draw("coin", 16, 16, p => { p(4, 2, 8, 12, P.goldD); p(2, 4, 12, 8, P.goldD); p(4, 3, 8, 10, P.gold); p(3, 4, 10, 8, P.gold); p(7, 5, 2, 6, P.goldD); p(5, 4, 2, 2, P.white); }),
  star: () => draw("star", 16, 16, p => { p(7, 1, 2, 4, P.gold); p(2, 5, 12, 3, P.gold); p(4, 8, 8, 3, P.gold); p(3, 11, 3, 3, P.gold); p(10, 11, 3, 3, P.gold); p(7, 5, 2, 2, P.white); }),
  seeds: () => seedBag("radish"),
  shop: () => draw("shop", 16, 16, p => { p(1, 3, 14, 4, P.roof); for (let x = 1; x < 15; x += 4) p(x, 3, 2, 4, P.white); p(2, 7, 12, 8, P.wood); p(4, 9, 8, 4, P.woodL); p(5, 10, 2, 2, "#e8463a"); p(9, 10, 2, 2, P.gold); }),
  bag: () => draw("backpack", 16, 16, p => { p(3, 4, 10, 11, P.woodD); p(4, 3, 8, 12, P.wood); p(6, 1, 4, 3, P.woodD); p(5, 8, 6, 4, P.woodL); p(7, 9, 2, 1, P.gold); }),
  orders: () => draw("board", 16, 16, p => { p(1, 2, 14, 10, P.woodD); p(2, 3, 12, 8, P.wood); p(3, 4, 4, 5, P.white); p(9, 5, 4, 4, P.white); p(4, 5, 2, 1, P.out); p(10, 6, 2, 1, P.out); p(3, 12, 2, 4, P.woodD); p(11, 12, 2, 4, P.woodD); }),
  book: () => draw("book", 16, 16, p => { p(2, 2, 12, 12, "#4f7fd1"); p(3, 3, 10, 10, "#6b9be6"); p(2, 13, 12, 2, P.white); p(6, 5, 5, 1, P.white); p(6, 7, 4, 1, P.white); p(5, 9, 3, 2, P.gold); }),
  chart: () => draw("chart", 16, 16, p => { p(1, 1, 14, 14, P.white); p(1, 14, 14, 1, P.out); p(1, 1, 1, 14, P.out); p(4, 9, 2, 5, P.leaf); p(7, 6, 2, 8, P.waterD); p(10, 3, 2, 11, P.roof); }),
  gear: () => draw("gear", 16, 16, p => { p(6, 1, 4, 14, "#8b95a1"); p(1, 6, 14, 4, "#8b95a1"); p(3, 3, 10, 10, "#8b95a1"); p(5, 5, 6, 6, "#c3cad3"); p(7, 7, 2, 2, "#5b6470"); }),
  can: () => draw("can", 16, 16, p => { p(3, 6, 8, 8, "#5aa0d8"); p(4, 7, 6, 6, "#7dbbe8"); p(11, 7, 4, 2, "#5aa0d8"); p(14, 5, 2, 3, "#5aa0d8"); p(5, 3, 4, 4, "#3e7fb5"); p(6, 4, 2, 2, "#7dbbe8"); }),
  hoe: () => draw("hoe", 16, 16, p => { p(3, 3, 2, 12, P.wood); p(3, 2, 8, 3, "#8b95a1"); p(9, 2, 2, 5, "#8b95a1"); }),
  keyboard: () => draw("kbd", 16, 16, p => { p(0, 4, 16, 9, "#5b6470"); for (let y = 5; y < 12; y += 3) for (let x = 1; x < 15; x += 3) p(x, y, 2, 2, P.white); }),
  help: () => draw("help", 16, 16, p => { p(3, 1, 10, 14, P.gold); p(1, 3, 14, 10, P.gold); p(6, 3, 4, 2, P.out); p(10, 4, 2, 3, P.out); p(7, 7, 3, 2, P.out); p(7, 9, 2, 1, P.out); p(7, 11, 2, 2, P.out); }),
};

/** 指引箭頭：大大的黃色向下箭頭 */
export function arrow() {
  return draw("arrow", 16, 16, p => {
    p(5, 0, 6, 9, P.out); p(1, 8, 14, 2, P.out); p(2, 10, 12, 1, P.out); p(3, 11, 10, 1, P.out);
    p(4, 12, 8, 1, P.out); p(5, 13, 6, 1, P.out); p(6, 14, 4, 1, P.out); p(7, 15, 2, 1, P.out);
    p(6, 1, 4, 8, P.gold); p(3, 9, 10, 1, P.gold); p(4, 10, 8, 1, P.gold); p(5, 11, 6, 1, P.gold);
    p(6, 12, 4, 1, P.gold); p(7, 13, 2, 1, P.gold); p(6, 1, 1, 7, P.white);
  });
}

/** 農場嚮導「阿禾」：戴草帽的小農夫 */
export function guide(frame = 0) {
  return draw(`guide${frame}`, 16, 16, p => {
    p(2, 3, 12, 2, "#e9c46a"); p(4, 1, 8, 3, "#e9c46a"); p(4, 3, 8, 1, "#c99a3a");
    p(5, 5, 6, 5, "#f6d3b0"); p(6, 7, 1, 1, P.out); p(9, 7, 1, 1, P.out); p(7, 9, 2, 1, "#d9826a");
    p(4, 10, 8, 4, "#4f8fd1"); p(5, 10, 2, 3, "#6ba8e6"); p(9, 10, 2, 3, "#6ba8e6");
    p(5, 14, 2, 2, P.woodD); p(9, 14, 2, 2, P.woodD);
    if (frame) { p(12, 9, 2, 2, "#f6d3b0"); } else { p(2, 11, 2, 2, "#f6d3b0"); }
  });
}

export function butterfly(frame: number, color: string) {
  return draw(`bf${frame}${color}`, 8, 8, p => {
    p(3, 2, 2, 4, P.out);
    if (frame) { p(0, 1, 3, 3, color); p(5, 1, 3, 3, color); p(1, 4, 2, 2, color); p(5, 4, 2, 2, color); }
    else { p(1, 2, 2, 2, color); p(5, 2, 2, 2, color); }
  });
}

/** 詩歌圖鑑分類插畫（32×24 小風景） */
export function category(name: string) {
  return draw(`cat${name}`, 32, 24, p => {
    const sky: Record<string, string> = { 春天: "#cdeffd", 夏天: "#9fdcf5", 秋天: "#fde3b8", 冬天: "#e3ecf5", 思念與友情: "#2d3e6e" };
    p(0, 0, 32, 24, sky[name] ?? P.sky);
    p(0, 17, 32, 7, name === "冬天" ? P.white : name === "秋天" ? "#e3b45a" : P.g1);
    if (name === "思念與友情") { p(22, 3, 5, 5, "#fff6c2"); p(23, 4, 2, 2, P.white); p(6, 4, 1, 1, P.white); p(14, 7, 1, 1, P.white); }
    else p(25, 3, 4, 4, P.gold);
    if (name === "山水風景") { p(2, 9, 12, 8, "#7aa36a"); p(5, 6, 6, 3, "#7aa36a"); p(16, 11, 14, 6, "#94b882"); p(0, 20, 32, 2, P.water); }
    if (name === "春天" || name === "花草樹木") for (const x of [4, 12, 20, 27]) { p(x, 15, 1, 3, P.leafD); p(x - 1, 14, 3, 1, "#f49bc1"); p(x, 13, 1, 3, "#f49bc1"); }
    if (name === "夏天") { p(4, 18, 10, 3, P.water); p(6, 15, 3, 3, P.leaf); p(7, 14, 2, 1, "#f49bc1"); }
    if (name === "秋天") for (const [x, y] of [[5, 6], [12, 10], [18, 5]]) p(x, y, 2, 2, "#e07a2a");
    if (name === "冬天") { p(6, 9, 6, 8, P.white); p(7, 5, 4, 4, P.white); p(8, 6, 1, 1, P.out); }
    if (name === "可愛動物") { p(6, 12, 8, 5, P.white); p(12, 9, 4, 4, P.white); p(15, 10, 2, 1, "#f28a2a"); p(13, 10, 1, 1, P.out); }
    if (name === "農田生活") for (let x = 2; x < 30; x += 5) { p(x, 14, 1, 4, P.leafD); p(x - 1, 13, 3, 2, P.leaf); }
    if (name === "生活童詩") { p(8, 8, 10, 9, P.wall); p(7, 6, 12, 3, P.roof); p(11, 12, 3, 5, P.woodD); }
    if (name === "思念與友情") { p(9, 12, 3, 5, "#4f8fd1"); p(16, 12, 3, 5, "#e8463a"); p(9, 9, 3, 3, "#f6d3b0"); p(16, 9, 3, 3, "#f6d3b0"); }
  });
}
