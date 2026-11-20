import { useEffect, useRef, useState } from "react";
import {
  useGame, completeTask, cancelTask, setTutorial, startPractice, startLevel,
  unlocked, totalScore, totalStars, nextLevel, type Screen,
} from "./store.ts";
import { TypingPanel } from "./components/TypingPanel.tsx";
import { Records, Settings } from "./components/Panels.tsx";
import { ArtDefs, Guide as GuideArt, Arrow, Star, Lock, Stamp, Icon, ZoneScene } from "./components/Art.tsx";
import { LEVELS, ZONES, ZONE_SIZE, PRACTICE } from "./lib/learning.ts";
import { configureAudio, sfx } from "./lib/audio.ts";

const TITLES: Record<Exclude<Screen, null>, string> = { records: "我的紀錄", settings: "設定" };
const IME_TEST = ["我", "花", "，"].map(t => PRACTICE.find(p => p.text === t)!);
const Stars = ({ n, size = 20 }: { n: number; size?: number }) => (
  <span className="stars" aria-label={`${n} 顆星`}>
    {[0, 1, 2].map(i => <span key={i} className="star" style={{ animationDelay: `${i * 0.3}s` }}><Star on={i < n} size={size} /></span>)}
  </span>
);

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

  return (
    <div className={`app ${settings.lowPerf ? "lowperf" : ""}`}>
      <ArtDefs />
      <TopBar />
      <Guide />
      <main className="center">
        {task ? <div className="play-page"><TypingPanel key={task.id} task={task} onDone={completeTask} onCancel={cancelTask} /></div> : <LevelMap />}
      </main>
      {!task && (
        <nav className="toolbar" aria-label="工具列">
          <button onClick={() => useGame.setState({ screen: "records" })}><Icon name="scroll" /><span>我的紀錄</span></button>
          <button onClick={() => useGame.setState({ screen: "settings" })}><Icon name="fan" /><span>設定</span></button>
        </nav>
      )}
      {screen && !task && (
        <div className="sheet" role="dialog" aria-label={TITLES[screen]}>
          <div className="sheet-head"><h2>{TITLES[screen]}</h2><button className="ghost" onClick={() => useGame.setState({ screen: null })}>關閉 ✕</button></div>
          <div className="sheet-body">{screen === "records" ? <Records /> : <Settings />}</div>
        </div>
      )}
      <ResultModal />
      <Toast />
    </div>
  );
}

function TopBar() {
  const best = useGame(s => s.best);
  const save = useGame(s => s.saveStatus);
  return (
    <header className="topbar">
      <h1><Icon name="brush" size={34} />小小打字王</h1>
      <span className="chip">總分 <b>{totalScore(best)}</b></span>
      <span className="chip"><Star on size={22} />{totalStars(best)} / {LEVELS.length * 3}</span>
      <span className={`save ${save}`}>{save === "error" ? "⚠ 無法存檔" : save === "saving" ? "存檔中…" : "✔ 已存檔"}</span>
    </header>
  );
}

function LevelMap() {
  const best = useGame(s => s.best);
  const next = nextLevel(best);
  return (
    <div className="map">
      {ZONES.map((zone, z) => (
        <section key={zone} className={`zone zone${z}`}>
          <ZoneScene zone={z} />
          <h2>{zone}<small>第 {z * ZONE_SIZE + 1}～{Math.min(LEVELS.length, (z + 1) * ZONE_SIZE)} 關</small></h2>
          <div className="path">
            {LEVELS.slice(z * ZONE_SIZE, (z + 1) * ZONE_SIZE).map((p, k) => {
              const i = z * ZONE_SIZE + k;
              const open = unlocked(best, i);
              const b = best[p.id];
              return (
                <button key={p.id} className={`node ${i === next ? "next" : ""} ${b ? "done" : ""}`} disabled={!open}
                  data-point={`level-${i}`} onClick={() => startLevel(i)}
                  aria-label={open ? `第 ${i + 1} 關《${p.title}》${b ? `，最高 ${b.score} 分` : ""}` : `第 ${i + 1} 關，還沒開放`}>
                  {open ? <b className="num">{i + 1}</b> : <Lock />}
                  {b && <Stamp size={40} />}
                  <span className="ntitle">{open ? p.title : "？？？"}</span>
                  {b ? <><Stars n={b.stars} size={16} /><span className="nscore">{b.score} 分</span></> : <span className="nlen">{p.hanzi} 字</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** 嚮導：一句話＋一個按鈕＋箭頭指著下一步。新手教學時其他地方變暗、點不到。 */
function Guide() {
  const st = useGame(s => s.tutorial);
  const task = useGame(s => s.task);
  const best = useGame(s => s.best);
  const result = useGame(s => s.result);
  const screen = useGame(s => s.screen);
  const tasks = useGame(s => s.stats.tasks);
  const startTasks = useRef(tasks);

  useEffect(() => {
    if (st >= 2 && st <= 4 && !task && tasks > startTasks.current) { startTasks.current = tasks; setTutorial(st + 1); }
    if (st === 5 && result) setTutorial(6);
  }, [st, task, tasks, result]);

  const next = nextLevel(best);
  let say = "", point: string | null = null, dim = false, act: React.ReactNode = null;
  const nextBtn = (label: string, onClick: () => void) => <button className="primary big-btn" data-point="next" onClick={onClick}>{label}</button>;

  if (task) {
    say = task.level === undefined ? "照著打打看！" : "照著打完整首詩，就過關了！";
    if (st >= 0) point = "typing-input";
  } else if (result) {
    say = st === 6 ? "過關了！按「下一關」繼續挑戰！" : "過關了！";
    if (st === 6) { point = "next-level"; dim = true; }
  } else if (st === 0) {
    say = "嗨！我是阿禾，一起來打字闖關吧！"; act = nextBtn("好！", () => setTutorial(1)); point = "next";
  } else if (st === 1) {
    say = "先看看螢幕右下角，要顯示「中」喔！"; act = nextBtn("看好了", () => setTutorial(2)); point = "next";
  } else if (st >= 2 && st <= 4) {
    const item = IME_TEST[st - 2];
    say = `先練習一下：打出「${item.text}」`;
    act = nextBtn("開始", () => startPractice(item, `練習：打出「${item.text}」`)); point = "next"; dim = true;
  } else if (st === 5) {
    say = "點第 1 關，開始挑戰！"; point = "level-0"; dim = true;
  } else if (next < 0) {
    say = "全部過關了，好厲害！可以再玩一次，挑戰更高分。";
  } else {
    say = "點發亮的關卡，繼續挑戰！"; point = screen ? null : `level-${next}`;
  }

  return (
    <>
      <div className="guide-strip">
        <GuideArt className="guide-face" size={60} wink={st % 2 === 1} />
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
    const el = document.querySelector(`[data-point="${target}"]`);
    if (el && target.startsWith("level-")) el.scrollIntoView({ block: "center", behavior: "smooth" });
    const find = () => {
      const box = document.querySelector(`[data-point="${target}"]`)?.getBoundingClientRect();
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
      <div className={`pointer ${below ? "up" : ""}`}
        style={{ left: r.left + r.width / 2 - size / 2, top: below ? r.bottom + 6 : r.top - size - 6 }}><Arrow size={size} /></div>
    </>
  );
}

function ResultModal() {
  const res = useGame(s => s.result);
  const st = useGame(s => s.tutorial);
  if (!res) return null;
  const p = LEVELS[res.level];
  const hasNext = res.level + 1 < LEVELS.length;
  const close = () => { useGame.setState({ result: null }); if (st === 6) setTutorial(-1); };
  return (
    <div className="modal" role="dialog" aria-label="過關結果">
      <div className="modal-box result">
        <h2>第 {res.level + 1} 關 過關！</h2>
        <Stars n={res.stars} size={56} />
        <table className="score">
          <tbody>
            <tr><td>打完 {p.lines.reduce((n, l) => n + l.chars.length, 0)} 個字</td><td>+{res.base}</td></tr>
            <tr><td>第一次就打對的字</td><td>+{res.clean}</td></tr>
            <tr><td>速度獎勵（每分鐘 {res.cpm} 字）</td><td>+{res.speed}</td></tr>
            <tr className="total"><td>總分</td><td>{res.total} 分</td></tr>
          </tbody>
        </table>
        {res.best && <p className="newbest">新紀錄！</p>}
        {res.stars < 3 && <p className="sub">第一次就打對越多，星星越多喔！</p>}
        <p className="explain"><b>《{p.title}》</b>{p.explain}</p>
        <div className="row">
          {hasNext && <button className="primary big-btn" data-point="next-level" onClick={() => { close(); startLevel(res.level + 1); }}>下一關 →</button>}
          <button className="big-btn" onClick={() => { close(); startLevel(res.level); }}>再玩一次</button>
          <button className="big-btn" onClick={() => { close(); sfx("click"); }}>回地圖</button>
        </div>
      </div>
    </div>
  );
}

function Toast() {
  const t = useGame(s => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => { if (!t) return; setShow(true); const h = setTimeout(() => setShow(false), 2600); return () => clearTimeout(h); }, [t]);
  return show && t ? <div className="toast" role="status">{t.text}</div> : null;
}
