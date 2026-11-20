// 16×12 方格農場地圖。地面一次畫好，作物與田地用絕對定位的像素圖片，整數倍放大。
import { useEffect, useRef, useState } from "react";
import { useGame, clickPlot } from "../store.ts";
import * as S from "../lib/sprites.ts";
import { stageOf, daysLeft } from "../lib/farm.ts";
import { CROP } from "../config/economy.ts";

const W = 16, H = 12, T = 16;

// 固定的地圖擺設（第二階段改為可布置）
const PATH = [[2, 4], [2, 5], [2, 6], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [10, 8], [10, 9]];
const FENCE = [[5, 4], [6, 4], [7, 4], [8, 4], [9, 4]];
const TREES = [[12, 0], [14, 1], [0, 9], [13, 9]];
const FLOWERS: [number, number, string][] = [[4, 2, "#f49bc1"], [9, 10, "#f6c945"], [5, 10, "#ffffff"], [15, 6, "#f49bc1"], [0, 6, "#f6c945"]];

export function Farm() {
  const plots = useGame(s => s.farm.plots);
  const lowPerf = useGame(s => s.settings.lowPerf);
  const busy = useGame(s => !!s.task);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(2);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => {
      const s = Math.floor(Math.min(el.clientWidth / (W * T), el.clientHeight / (H * T)));
      setScale(Math.max(1, Math.min(4, s)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const u = T * scale;
  const at = (x: number, y: number, w = 1, h = 1) => ({ left: x * u, top: y * u, width: w * u, height: h * u });

  return (
    <div className="farm-box" ref={box}>
      <div className="farm" style={{ width: W * u, height: H * u, backgroundImage: `url(${S.ground(W, H)})`, backgroundSize: `${W * u}px ${H * u}px` }}>
        {PATH.map(([x, y]) => <img key={`p${x}-${y}`} className="px tile" src={S.path()} style={at(x, y)} alt="" />)}
        {FENCE.map(([x, y]) => <img key={`f${x}`} className="px tile" src={S.fence()} style={at(x, y)} alt="" />)}
        {FLOWERS.map(([x, y, c]) => <img key={`fl${x}-${y}`} className="px tile" src={S.flower(c)} style={at(x, y)} alt="" />)}
        <img className="px tile" src={S.pond()} style={at(11, 5, 2, 2)} alt="池塘" />
        <img className="px tile" src={S.house()} style={at(1, 1, 3, 3)} alt="小木屋" />
        <img className="px tile guide-npc" src={S.guide()} style={at(3, 4)} alt="農場嚮導阿禾" />

        {plots.map((p, i) => {
          const c = p.crop;
          const left = c ? daysLeft(c) : 0;
          const label = c ? `第${i + 1}塊田：${CROP[c.id].name}，還要 ${left} 天` : `第${i + 1}塊田：空的，點一下種菜`;
          return (
            <button key={p.id} className="tile plot" style={at(p.x, p.y)} data-point={`plot-${p.id}`}
              onClick={() => clickPlot(p.id)} disabled={busy} aria-label={label} title={label}>
              <img className="px" src={S.soil(!!c)} alt="" />
              {c && <img className={`px crop ${lowPerf ? "" : "sway"}`} src={S.crop(c.id, stageOf(c))} alt="" />}
              {c && <span className="days-tag">{left}天</span>}
            </button>
          );
        })}

        {TREES.map(([x, y]) => <img key={`t${x}`} className={`px tile ${lowPerf ? "" : "breeze"}`} src={S.tree()} style={at(x, y, 2, 2)} alt="" />)}
        {!lowPerf && <>
          <Butterfly x={4} y={2} u={u} color="#f6c945" />
          <Butterfly x={14} y={6} u={u} color="#9fd3f5" delay={2} />
        </>}
      </div>
    </div>
  );
}

function Butterfly({ x, y, u, color, delay = 0 }: { x: number; y: number; u: number; color: string; delay?: number }) {
  const [f, setF] = useState(0);
  useEffect(() => { const t = setInterval(() => setF(n => 1 - n), 300); return () => clearInterval(t); }, []);
  return <img className="px butterfly" src={S.butterfly(f, color)} alt="" style={{ left: x * u, top: y * u, width: u / 2, height: u / 2, animationDelay: `${delay}s` }} />;
}
