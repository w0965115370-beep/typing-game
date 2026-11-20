import { useEffect, useRef, useState } from "react";
import { useGame, completeTask, cancelTask, setTutorial, startPractice, startDay, askRescue, type Screen } from "./store.ts";
import { Farm } from "./components/Farm.tsx";
import { TypingPanel } from "./components/TypingPanel.tsx";
import { SeedPicker, Book, Records, Settings } from "./components/Panels.tsx";
import { ZhuyinLine } from "./components/Zhuyin.tsx";
import * as S from "./lib/sprites.ts";
import * as F from "./lib/farm.ts";
import { CROP, ACTIVE_CROPS, xpToReach, MAX_LEVEL, type CropId } from "./config/economy.ts";
import { POEM, PRACTICE } from "./lib/learning.ts";
import { configureAudio, sfx } from "./lib/audio.ts";

const TITLES: Record<Exclude<Screen, null>, string> = { seeds: "要種什麼？", book: "詩歌圖鑑", records: "我的紀錄", settings: "設定" };
const TOOLBAR: [Exclude<Screen, null>, string, () => string][] = [
  ["book", "詩歌圖鑑", S.icons.book], ["records", "我的紀錄", S.icons.chart], ["settings", "設定", S.icons.gear],
];
const IME_TEST = ["我", "花", "，"].map(t => PRACTICE.find(p => p.text === t)!);

export default function App() {
  const screen = useGame(s => s.screen);
  const task = useGame(s => s.task);
  const settings = useGame(s => s.settings);
  const started = useRef(false);

  useEffect(() => { configureAudio({ sfx: settings.sfx, music: settings.music, muted: settings.muted }, started.current); }, [settings]);
  useEffect(() => {
    const first = () => { if (started.current) return; started.current = true; const s = useGame.getState().settings; configureAudio({ sfx: s.sfx, music: s.music, muted: s.muted }, true); };
    window.addEventListener("pointerdown", first);
    return () => window.removeEventListener("pointerdown", first);
  }, []);

  const close = () => useGame.setState({ screen: null, pickPlot: null });

  return (
    <div className={`app ${settings.lowPerf ? "lowperf" : ""}`}>
      <TopBar />
      <Guide />
      <main className="center"><Farm /></main>
      <nav className="toolbar" aria-label="工具列">
        {TOOLBAR.map(([id, label, icon]) => (
          <button key={id} onClick={() => { sfx("click"); useGame.setState({ screen: id }); }} disabled={!!task}>
            <img className="px" src={icon()} alt="" /><span>{label}</span>
          </button>
        ))}
      </nav>

      {screen && !task && (
        <div className="sheet" role="dialog" aria-label={TITLES[screen]}>
          <div className="sheet-head"><h2>{TITLES[screen]}</h2><button className="ghost" onClick={close}>關閉 ✕</button></div>
          <div className="sheet-body">
            {screen === "seeds" && <SeedPicker />}
            {screen === "book" && <Book />}
            {screen === "records" && <Records />}
            {screen === "settings" && <Settings />}
          </div>
        </div>
      )}

      {task && <div className="typing-dock"><TypingPanel key={task.id} task={task} onDone={completeTask} onCancel={cancelTask} /></div>}
      <Toast />
      <DayResultModal />
    </div>
  );
}

function TopBar() {
  const xp = useGame(s => s.farm.xp);
  const coins = useGame(s => s.farm.coins);
  const day = useGame(s => s.farm.day);
  const save = useGame(s => s.saveStatus);
  const lv = F.levelOf(xp);
  const from = xpToReach(lv), to = xpToReach(Math.min(MAX_LEVEL, lv + 1));
  return (
    <header className="topbar">
      <h1><img className="px" src={S.produce("radish")} alt="" />打字開心農場</h1>
      <span className="chip">第 {day} 天</span>
      <span className="chip lv">Lv.{lv}<span className="xpbar"><span style={{ width: `${lv >= MAX_LEVEL ? 100 : ((xp - from) / (to - from)) * 100}%` }} /></span></span>
      <span className="coin big"><img className="px" src={S.icons.coin()} alt="金幣" />{coins}</span>
      <span className={`save ${save}`}>{save === "error" ? "⚠ 無法存檔" : save === "saving" ? "存檔中…" : "✔ 已存檔"}</span>
    </header>
  );
}

/** 嚮導：一句話＋一個按鈕＋箭頭指著下一步。新手教學時其他地方變暗、點不到。 */
function Guide() {
  const st = useGame(s => s.tutorial);
  const farm = useGame(s => s.farm);
  const task = useGame(s => s.task);
  const screen = useGame(s => s.screen);
  const busyModal = useGame(s => !!s.dayResult || !!s.levelUp);
  const tasks = useGame(s => s.stats.tasks);
  const startTasks = useRef(tasks);

  // 教學依實際完成的動作前進
  useEffect(() => {
    if (st >= 2 && st <= 4 && !task && tasks > startTasks.current) { startTasks.current = tasks; setTutorial(st + 1); }
    if (st === 5 && farm.totals.planted > 0 && !screen) setTutorial(6);
    if (st === 6 && farm.day > 1) setTutorial(7);
  }, [st, farm, task, tasks, screen]);

  const empty = farm.plots.find(p => !p.crop);
  const canBuy = F.unlockedCrops(farm).some(c => (farm.seeds[c.id] ?? 0) > 0 || farm.coins >= c.seedPrice);
  const anyCrop = farm.plots.some(p => p.crop);

  let say = "", point: string | null = null, dim = false, act: React.ReactNode = null;
  const startBtn = <button className="primary big-btn" data-point="start" onClick={startDay} disabled={!!task}>開始打字</button>;

  if (task) {
    say = task.kind === "day" ? "照著打完整首詩，就完成今天的農事！" : "照著打打看！";
    if (st >= 0) point = "typing-input";
  } else if (st === 0) {
    say = "嗨！我是阿禾，我們一起來種菜吧！";
    act = <button className="primary big-btn" data-point="next" onClick={() => setTutorial(1)}>好！</button>; point = "next";
  } else if (st === 1) {
    say = "先看看螢幕右下角，要顯示「中」喔！";
    act = <button className="primary big-btn" data-point="next" onClick={() => setTutorial(2)}>看好了</button>; point = "next";
  } else if (st >= 2 && st <= 4) {
    const item = IME_TEST[st - 2];
    say = `先練習一下：打出「${item.text}」`;
    act = <button className="primary big-btn" data-point="next" onClick={() => startPractice(item, `練習：打出「${item.text}」`)}>開始</button>; point = "next"; dim = true;
  } else if (st === 5) {
    if (screen === "seeds") { say = "點「白蘿蔔」把它種下去！"; point = "seed-radish"; }
    else { say = "點一塊空的田！"; point = `plot-${empty?.id ?? 0}`; }
    dim = true;
  } else if (st === 6) {
    say = "按「開始打字」，打完一首詩，菜就會長大！"; act = startBtn; point = "start"; dim = true;
  } else if (st === 7 && !busyModal) {
    say = "你學會了！種菜、打詩，收集更多詩吧！";
    act = <button className="primary big-btn" data-point="next" onClick={() => setTutorial(-1)}>好！</button>; point = "next";
  } else if (F.needsRescue(farm)) {
    say = "沒有金幣和種子了嗎？阿禾送你！";
    act = <button className="primary big-btn" data-point="next" onClick={askRescue}>領種子</button>; point = "next";
  } else if (!anyCrop && empty && canBuy) {
    say = "點空的田，種一些菜吧！"; point = screen === "seeds" ? null : `plot-${empty.id}`; act = startBtn;
  } else {
    say = empty && canBuy ? "可以再多種幾棵，或按「開始打字」！" : "按「開始打字」，完成今天的農事！";
    act = startBtn; point = screen ? null : "start";
  }
  if (busyModal) { point = null; dim = false; }

  return (
    <>
      <div className="guide-strip">
        <img className="px guide-face" src={S.guide(st % 2)} alt="嚮導阿禾" />
        <p className="speech">{say}</p>
        {act}
      </div>
      {point && <Pointer target={point} dim={dim} />}
    </>
  );
}

/** 大箭頭指著目標；dim 時其他地方變暗，只有目標可以點。 */
function Pointer({ target, dim }: { target: string; dim: boolean }) {
  const [r, setR] = useState<DOMRect | null>(null);
  useEffect(() => {
    const find = () => {
      const el = document.querySelector(`[data-point="${target}"]`);
      const box = el?.getBoundingClientRect();
      setR(box && box.width ? box : null);
    };
    find();
    const t = setInterval(find, 250);
    return () => clearInterval(t);
  }, [target]);
  if (!r) return null;
  const pad = 8, size = 56;
  const below = r.top < size + 10;
  const W = window.innerWidth, H = window.innerHeight;
  const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
  return (
    <>
      {dim && <div className="dim" style={{ clipPath: `path(evenodd, "M0 0H${W}V${H}H0Z M${x} ${y}h${w}v${h}h${-w}Z")` }} />}
      {dim && <div className="spot" style={{ left: x, top: y, width: w, height: h }} />}
      <img className={`px pointer ${below ? "up" : ""}`} src={S.arrow()} alt=""
        style={{ left: r.left + r.width / 2 - size / 2, top: below ? r.bottom + 6 : r.top - size - 6, width: size, height: size }} />
    </>
  );
}

function Toast() {
  const t = useGame(s => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => { if (!t) return; setShow(true); const h = setTimeout(() => setShow(false), 2600); return () => clearTimeout(h); }, [t]);
  return show && t ? <div className="toast" role="status">{t.text}</div> : null;
}

function DayResultModal() {
  const res = useGame(s => s.dayResult);
  const lv = useGame(s => s.levelUp);
  const task = useGame(s => s.task);
  if (task) return null;
  if (res) {
    const p = POEM[res.poemId];
    const got = Object.entries(res.harvested) as [CropId, number][];
    return (
      <div className="modal" role="dialog" aria-label="今天的收穫">
        <div className="modal-box">
          <h2>第 {res.farm.day - 1} 天完成！</h2>
          {got.length > 0 ? (
            <div className="harvest">
              {got.map(([id, n]) => <span key={id} className="unlock"><img className="px icon64" src={S.produce(id)} alt="" />{CROP[id].name} ×{n}</span>)}
              <p className="earned"><img className="px" src={S.icons.coin()} alt="" />+{res.earned} 金幣</p>
            </div>
          ) : <p>{res.growing.length ? "菜長大了一點！" : "田裡還沒有種菜，下次先種菜喔！"}</p>}
          {res.growing.length > 0 && <p className="sub">{res.growing.map(g => `${CROP[g.id].name}還要 ${g.left} 天`).join("、")}</p>}
          <div className="collected">
            <p>{res.firstTime ? "收集到新的詩！" : "又打完一次："}《{p.title}》</p>
            <div className="poem-lines small">{p.lines.map((l, i) => <div key={i} className="pline"><ZhuyinLine chars={l.chars} /></div>)}</div>
            <p className="explain">{p.explain}</p>
          </div>
          <button className="primary big-btn" onClick={() => useGame.setState({ dayResult: null })}>好！</button>
        </div>
      </div>
    );
  }
  if (lv) {
    const unlocked = ACTIVE_CROPS.filter(c => c.unlock === lv);
    return (
      <div className="modal" role="dialog" aria-label="升級">
        <div className="modal-box levelup">
          <h2>升到 Lv.{lv} 了！</h2>
          {unlocked.length > 0 ? <p>可以種新的菜：{unlocked.map(c => <span key={c.id} className="unlock"><img className="px icon64" src={S.produce(c.id)} alt="" />{c.name}</span>)}</p>
            : <p>你的農場越來越棒了！</p>}
          <button className="primary big-btn" onClick={() => useGame.setState({ levelUp: null })}>太好了</button>
        </div>
      </div>
    );
  }
  return null;
}
