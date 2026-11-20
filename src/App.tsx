import { useEffect, useRef, useState } from "react";
import { useGame, tickGame, completeTask, cancelTask, setTutorial, startPractice, clickPlot, askRescue, type Screen } from "./store.ts";
import { Farm, STAGE_NAME } from "./components/Farm.tsx";
import { TypingPanel } from "./components/TypingPanel.tsx";
import { Seeds, Shop, Bag, Orders, Book, Records, Settings } from "./components/Panels.tsx";
import { ZhuyinLine } from "./components/Zhuyin.tsx";
import * as S from "./lib/sprites.ts";
import * as F from "./lib/farm.ts";
import { CROP, ACTIVE_CROPS, xpToReach, MAX_LEVEL } from "./config/economy.ts";
import { POEM, PRACTICE } from "./lib/learning.ts";
import { configureAudio, sfx } from "./lib/audio.ts";

const TITLES: Record<Exclude<Screen, null>, string> = {
  seeds: "選擇種子", shop: "種子商店", bag: "背包", orders: "訂單公告板", book: "詩歌圖鑑", records: "我的學習紀錄", settings: "設定",
};
const TOOLBAR: [Exclude<Screen, null>, string, () => string][] = [
  ["seeds", "種子", S.icons.seeds], ["shop", "商店", S.icons.shop], ["bag", "背包", S.icons.bag],
  ["orders", "訂單", S.icons.orders], ["book", "詩歌圖鑑", S.icons.book], ["records", "學習紀錄", S.icons.chart],
  ["settings", "設定", S.icons.gear],
];
const IME_TEST = ["我", "小", "花", "，", "。"].map(t => PRACTICE.find(p => p.text === t)!);

export default function App() {
  const screen = useGame(s => s.screen);
  const task = useGame(s => s.task);
  const settings = useGame(s => s.settings);
  const started = useRef(false);

  // 遊戲時間：每秒前進一次（畫面隱藏時 store 會略過）
  useEffect(() => { const t = setInterval(() => tickGame(1000), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { configureAudio({ sfx: settings.sfx, music: settings.music, muted: settings.muted }, started.current); }, [settings]);
  useEffect(() => {
    const first = () => { if (started.current) return; started.current = true; const s = useGame.getState().settings; configureAudio({ sfx: s.sfx, music: s.music, muted: s.muted }, true); };
    window.addEventListener("pointerdown", first);
    return () => window.removeEventListener("pointerdown", first);
  }, []);

  const open = (s: Screen) => { sfx("click"); useGame.setState({ screen: s }); };
  const close = () => useGame.setState({ screen: null });

  return (
    <div className={`app ${settings.lowPerf ? "lowperf" : ""}`}>
      <TopBar />
      <aside className="left"><Guide /></aside>
      <main className="center" data-tour="farm"><Farm onOpen={open} /></main>
      <aside className="right"><Info /></aside>
      <nav className="toolbar" data-tour="bottom" aria-label="工具列">
        {TOOLBAR.map(([id, label, icon]) => (
          <button key={id} onClick={() => open(id)} aria-pressed={screen === id} disabled={!!task}>
            <img className="px" src={icon()} alt="" /><span>{label}</span>
          </button>
        ))}
      </nav>

      {screen && !task && (
        <div className="sheet" role="dialog" aria-label={TITLES[screen]}>
          <div className="sheet-head"><h2>{TITLES[screen]}</h2><button className="ghost" onClick={close}>關閉 ✕</button></div>
          <div className="sheet-body">
            {screen === "seeds" && <Seeds close={close} />}
            {screen === "shop" && <Shop />}
            {screen === "bag" && <Bag />}
            {screen === "orders" && <Orders />}
            {screen === "book" && <Book />}
            {screen === "records" && <Records />}
            {screen === "settings" && <Settings />}
          </div>
        </div>
      )}

      {task && (
        <div className="typing-dock">
          <TypingPanel key={task.id} task={task} onDone={completeTask} onCancel={cancelTask} />
        </div>
      )}
      <Toast />
      <Celebrations />
    </div>
  );
}

function TopBar() {
  const xp = useGame(s => s.farm.xp);
  const coins = useGame(s => s.farm.coins);
  const save = useGame(s => s.saveStatus);
  const lv = F.levelOf(xp);
  const from = xpToReach(lv), to = xpToReach(Math.min(MAX_LEVEL, lv + 1));
  return (
    <header className="topbar" data-tour="top">
      <h1><img className="px" src={S.produce("radish")} alt="" />打字開心農場</h1>
      <span className="who">小農夫</span>
      <span className="lv">Lv.{lv}</span>
      <span className="xp" title={`經驗值 ${xp}`}>
        <img className="px" src={S.icons.star()} alt="經驗值" />
        <span className="xpbar"><span style={{ width: `${lv >= MAX_LEVEL ? 100 : ((xp - from) / (to - from)) * 100}%` }} /></span>
        {xp - from}/{to - from}
      </span>
      <span className="coin big"><img className="px" src={S.icons.coin()} alt="金幣" />{coins}</span>
      <span className={`save ${save}`}>{save === "saved" ? "✔ 已儲存" : save === "saving" ? "儲存中…" : "⚠ 無法儲存"}</span>
    </header>
  );
}

function Guide() {
  const st = useGame(s => s.tutorial);
  const farm = useGame(s => s.farm);
  const task = useGame(s => s.task);
  const progress = useGame(s => s.progress);
  const ime = useGame(s => s.settings.ime);
  const tasks = useGame(s => s.stats.tasks);
  const startTasks = useRef(tasks);

  // 教學進度：依實際完成的動作前進
  useEffect(() => {
    if (st >= 2 && st <= 6 && !task && tasks > startTasks.current) { startTasks.current = tasks; setTutorial(st + 1); }
    if (st === 10 && farm.totals.planted > 0) setTutorial(11);
    if (st === 11 && farm.plots.some(p => p.crop && p.crop.waters > 0)) setTutorial(12);
    if (st === 12 && farm.totals.harvested > 0) setTutorial(13);
  }, [st, farm, task, tasks]);
  useEffect(() => {
    document.body.dataset.tour = st === 7 ? "top" : st === 8 ? "farm" : st === 9 || st === 10 ? "bottom" : "";
  }, [st]);

  let say: React.ReactNode, act: React.ReactNode = null;
  if (st === 0) {
    say = "嗨！我是農場嚮導阿禾。在這座農場，播種、澆水、採收都要靠打字完成喔！我們一步一步來。";
    act = <button className="primary" onClick={() => setTutorial(1)}>好，開始吧！</button>;
  } else if (st === 1) {
    say = <>先確認鍵盤和輸入法：<br />1. 看看螢幕右下角，要顯示「中」。<br />2. 不是的話，按 <kbd>Windows 鍵</kbd>＋<kbd>空白鍵</kbd> 換成「微軟注音」。</>;
    act = <>
      <label className="sub">我用的輸入法：
        <select value={ime} onChange={e => useGame.setState({ settings: { ...useGame.getState().settings, ime: e.target.value as typeof ime } })}>
          <option value="ms-bopomofo">微軟注音</option><option value="other-bopomofo">其他注音</option><option value="cangjie">倉頡</option><option value="other">其他</option>
        </select></label>
      <button className="primary" onClick={() => setTutorial(2)}>我準備好了</button>
    </>;
  } else if (st >= 2 && st <= 6) {
    const item = IME_TEST[st - 2];
    say = <>輸入法小測驗 {st - 1}/5：請打出「{item.text}」。{st >= 5 && "標點符號也要自己打出來喔！"}</>;
    act = !task && <button className="primary" onClick={() => startPractice(item, `輸入法小測驗 ${st - 1}/5`)}>開始打字</button>;
  } else if (st === 7) {
    say = "上面是你的農場等級、經驗值和金幣。右上角會顯示有沒有存好檔。"; act = <button className="primary" onClick={() => setTutorial(8)}>下一步</button>;
  } else if (st === 8) {
    say = "中間是你的農場。點田地就可以播種、澆水、採收。"; act = <button className="primary" onClick={() => setTutorial(9)}>下一步</button>;
  } else if (st === 9) {
    say = "下面是工具列：種子、商店、背包、訂單和詩歌圖鑑都在這裡。"; act = <button className="primary" onClick={() => setTutorial(10)}>下一步</button>;
  } else if (st === 10) {
    say = "第一次播種：點下面的「種子」，選「白蘿蔔」，再點一塊空的田，打完一句詩就種下去了！";
  } else if (st === 11) {
    say = "種子需要喝水！點剛剛種下的田（上面有水壺），打字幫它澆水。";
  } else if (st === 12) {
    say = "白蘿蔔正在長大！長到一半會再口渴一次，記得再澆水。成熟時田上會出現白蘿蔔，點它打字採收。";
  } else if (st === 13) {
    say = "採收成功！打開下面的「背包」，把白蘿蔔賣掉換金幣。";
  } else if (st === 14) {
    say = "你已經學會經營農場了！接下來可以完成訂單、買新種子、收藏整首詩。每完成一首詩，就會放進詩歌圖鑑。";
    act = <button className="primary" onClick={() => setTutorial(-1)}>開始經營農場</button>;
  } else {
    const ripe = farm.plots.find(p => p.crop && F.isRipe(p.crop));
    const thirsty = farm.plots.find(p => p.crop && F.needsWater(p.crop));
    const empty = farm.plots.find(p => !p.crop);
    const hasSeeds = Object.values(farm.seeds).some(n => n! > 0);
    const ready = farm.orders.find(o => !F.canFulfill(farm, o.id));
    if (F.needsRescue(farm)) { say = "金幣和種子都用完了嗎？別擔心，我送你一些白蘿蔔種子！"; act = <button className="primary" onClick={askRescue}>領取種子</button>; }
    else if (ripe) { say = `${CROP[ripe.crop!.id].name}成熟了！點它打字採收。`; act = <button onClick={() => clickPlot(ripe.id)}>去採收</button>; }
    else if (thirsty) { say = `${CROP[thirsty.crop!.id].name}口渴了，點它打字澆水。`; act = <button onClick={() => clickPlot(thirsty.id)}>去澆水</button>; }
    else if (ready) say = `${ready.npc}的訂單可以出貨囉！打開「訂單」完成它。`;
    else if (empty && hasSeeds) say = "還有空的田，點「種子」選一種來播種吧。";
    else if (empty) say = "到「商店」買一些種子吧！";
    else say = "作物正在長大。可以去「詩歌圖鑑」看看收藏的詩。";
  }
  const poem = POEM[progress.poemId];
  return (
    <div className="guide">
      <h2>目前任務</h2>
      <div className="guide-row">
        <img className="px guide-face" src={S.guide(st % 2)} alt="嚮導阿禾" />
        <div className="speech">{say}</div>
      </div>
      {act && <div className="guide-act">{act}</div>}
      <div className="poem-progress">
        <h3>正在收藏的詩</h3>
        <p>《{poem.title}》第 {progress.line + 1} / {poem.lines.length} 句</p>
        <div className="pbar"><div style={{ width: `${(progress.line / poem.lines.length) * 100}%` }} /></div>
      </div>
    </div>
  );
}

function Info() {
  const sel = useGame(s => s.selectedPlot);
  const plot = useGame(s => s.farm.plots.find(p => p.id === s.selectedPlot));
  const seed = useGame(s => s.selectedSeed);
  const seeds = useGame(s => s.farm.seeds);
  const c = plot?.crop;
  return (
    <div className="info">
      <h2>選取的田</h2>
      {sel === null || !plot ? <p>點一塊田看看狀態。</p> : !c ? (
        <><p>第 {plot.id + 1} 塊田：空的</p><p className="sub">{seed ? `目前選的種子：${CROP[seed].name}（剩 ${seeds[seed] ?? 0} 包）` : "還沒選種子"}</p></>
      ) : (
        <>
          <div className="info-crop"><img className="px icon48" src={S.crop(c.id, F.stageOf(c))} alt="" /><div><b>{CROP[c.id].name}</b><br />{STAGE_NAME[F.stageOf(c)]}</div></div>
          <div className="pbar grow"><div style={{ width: `${Math.min(100, (c.grownMs / (CROP[c.id].growSec * 1000)) * 100)}%` }} /></div>
          <p className="sub">
            {F.isRipe(c) ? "可以採收了！" : F.needsWater(c) ? "口渴了，需要澆水才會長大。" : `再 ${Math.ceil((CROP[c.id].growSec * 1000 - c.grownMs) / 1000)} 秒左右${c.waters === 1 ? "（中途還要再澆一次水）" : ""}`}
          </p>
          {(F.isRipe(c) || F.needsWater(c)) && <button className="primary" onClick={() => clickPlot(plot.id)}>{F.isRipe(c) ? "打字採收" : "打字澆水"}</button>}
        </>
      )}
      <h2>快速查看</h2>
      <p className="sub">種子：{Object.entries(seeds).filter(([, n]) => n! > 0).map(([id, n]) => `${CROP[id as keyof typeof CROP].name}×${n}`).join("、") || "無"}</p>
    </div>
  );
}

function Toast() {
  const t = useGame(s => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => { if (!t) return; setShow(true); const h = setTimeout(() => setShow(false), 2600); return () => clearTimeout(h); }, [t]);
  return show && t ? <div className="toast" role="status">{t.text}</div> : null;
}

function Celebrations() {
  const lv = useGame(s => s.levelUp);
  const poemId = useGame(s => s.poemDone);
  const task = useGame(s => s.task);
  if (task) return null;
  if (poemId) {
    const p = POEM[poemId];
    return (
      <div className="modal" role="dialog" aria-label="收藏詩歌">
        <div className="modal-box">
          <h2>收藏了新的詩！</h2>
          <img className="px cat-art big" src={S.category(p.category)} alt="" />
          <h3>《{p.title}》<small>{p.dynasty}・{p.author}</small></h3>
          <div className="poem-lines small">{p.lines.map((l, i) => <div key={i} className="pline"><ZhuyinLine chars={l.chars} /></div>)}</div>
          <p className="explain">{p.explain}</p>
          <button className="primary" onClick={() => useGame.setState({ poemDone: null })}>放進詩歌圖鑑</button>
        </div>
      </div>
    );
  }
  if (lv) {
    const unlocked = ACTIVE_CROPS.filter(c => c.unlock === lv);
    const next = ACTIVE_CROPS.find(c => c.unlock > lv);
    return (
      <div className="modal" role="dialog" aria-label="農場升級">
        <div className="modal-box levelup">
          <h2>農場升到 Lv.{lv}！</h2>
          {unlocked.length > 0 ? <p>新作物解鎖：{unlocked.map(c => <span key={c.id} className="unlock"><img className="px icon48" src={S.produce(c.id)} alt="" />{c.name}</span>)}</p>
            : <p>你的農場越來越棒了！</p>}
          <p className="sub">{next ? `下一個目標：Lv.${next.unlock} 解鎖${next.name}。` : "第一階段的作物都解鎖了！"}</p>
          <button className="primary" onClick={() => useGame.setState({ levelUp: null })}>太好了</button>
        </div>
      </div>
    );
  }
  return null;
}
