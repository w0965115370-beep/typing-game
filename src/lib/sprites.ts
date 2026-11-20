// 原創像素素材：全部用程式在 16×16（或倍數）畫布上逐點繪製，啟動時產生一次並快取。
// 顯示時以整數倍放大並使用 image-rendering: pixelated（nearest-neighbor）。

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

export function tree() {
  return draw("tree", 32, 32, p => {
    p(13, 20, 6, 11, P.woodD); p(14, 20, 2, 11, P.wood);
    p(6, 6, 20, 16, P.leafD); p(4, 10, 24, 9, P.leafD); p(9, 2, 14, 6, P.leafD);
    p(7, 7, 17, 13, P.leaf); p(10, 3, 11, 5, P.leaf); p(9, 6, 6, 4, P.leafL); p(18, 12, 3, 3, P.leafL);
    p(11, 14, 2, 2, "#e8433a"); p(20, 8, 2, 2, "#e8433a");
    p(8, 30, 16, 2, "rgba(0,0,0,.15)");
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

// ---- 介面圖示 ----
export const icons = {
  star: () => draw("star", 16, 16, p => { p(7, 1, 2, 4, P.gold); p(2, 5, 12, 3, P.gold); p(4, 8, 8, 3, P.gold); p(3, 11, 3, 3, P.gold); p(10, 11, 3, 3, P.gold); p(7, 5, 2, 2, P.white); }),
  starOff: () => draw("staroff", 16, 16, p => { p(7, 1, 2, 4, P.stoneD); p(2, 5, 12, 3, P.stoneD); p(4, 8, 8, 3, P.stoneD); p(3, 11, 3, 3, P.stoneD); p(10, 11, 3, 3, P.stoneD); }),
  lock: () => draw("lock", 16, 16, p => { p(4, 2, 8, 2, "#8b95a1"); p(3, 3, 2, 5, "#8b95a1"); p(11, 3, 2, 5, "#8b95a1"); p(2, 7, 12, 8, P.goldD); p(3, 8, 10, 6, P.gold); p(7, 9, 2, 4, P.out); }),
  chart: () => draw("chart", 16, 16, p => { p(1, 1, 14, 14, P.white); p(1, 14, 14, 1, P.out); p(1, 1, 1, 14, P.out); p(4, 9, 2, 5, P.leaf); p(7, 6, 2, 8, P.waterD); p(10, 3, 2, 11, P.roof); }),
  gear: () => draw("gear", 16, 16, p => { p(6, 1, 4, 14, "#8b95a1"); p(1, 6, 14, 4, "#8b95a1"); p(3, 3, 10, 10, "#8b95a1"); p(5, 5, 6, 6, "#c3cad3"); p(7, 7, 2, 2, "#5b6470"); }),
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
