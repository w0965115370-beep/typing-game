// 種子選單、詩歌圖鑑、學習紀錄、設定。全部用滑鼠操作，字少、按鈕大。
import { useState } from "react";
import { useGame, chooseSeed, startPractice, updateSettings, askRescue } from "../store.ts";
import { ACTIVE_CROPS } from "../config/economy.ts";
import { levelOf, needsRescue } from "../lib/farm.ts";
import { POEMS, CATEGORIES, cpm, type Poem } from "../lib/learning.ts";
import { ZhuyinLine } from "./Zhuyin.tsx";
import * as S from "../lib/sprites.ts";
import { clearSave } from "../lib/save.ts";

const Coin = ({ n }: { n: number }) => <span className="coin"><img className="px" src={S.icons.coin()} alt="金幣" />{n}</span>;

/** 點空田後跳出：一張卡就是一種作物，點了就種（沒有種子會自動花金幣買一包）。 */
export function SeedPicker() {
  const farm = useGame(s => s.farm);
  const lv = levelOf(farm.xp);
  return (
    <div>
      {needsRescue(farm) && <p className="center-text"><button className="primary" onClick={askRescue}>金幣不夠了，請阿禾送種子</button></p>}
      <div className="grid seeds">
        {ACTIVE_CROPS.map(c => {
          const have = farm.seeds[c.id] ?? 0;
          const locked = c.unlock > lv;
          const poor = have === 0 && farm.coins < c.seedPrice;
          return (
            <button key={c.id} className={`card seed ${locked ? "locked" : ""}`} data-point={`seed-${c.id}`}
              disabled={locked || poor} onClick={() => chooseSeed(c.id)}>
              <img className="px icon64" src={S.produce(c.id)} alt="" />
              <b>{c.name}</b>
              {locked ? <span>Lv.{c.unlock} 才能種</span>
                : have > 0 ? <span className="have">有 {have} 包</span>
                : <span>買一包 <Coin n={c.seedPrice} /></span>}
              {!locked && <span className="sub">賣 {c.sellPrice} 金幣</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Book() {
  const col = useGame(s => s.collection);
  const [open, setOpen] = useState<Poem | null>(null);
  const [cat, setCat] = useState(CATEGORIES[0]);
  if (open) {
    const c = col[open.id];
    return (
      <div className="poem-card">
        <button className="ghost" onClick={() => setOpen(null)}>← 回去</button>
        <div className="poem-card-head">
          <img className="px cat-art" src={S.category(open.category)} alt="" />
          <div><h3>《{open.title}》</h3><p>{open.dynasty}・{open.author}</p></div>
        </div>
        <div className="poem-lines small">{open.lines.map((l, i) => <div key={i} className="pline"><ZhuyinLine chars={l.chars} /></div>)}</div>
        <p className="explain">{open.explain}</p>
        <p className="sub">完成 {c.count} 次</p>
        <button className="primary" onClick={() => startPractice({ text: open.lines.map(l => l.text).join(""), chars: open.lines.flatMap(l => l.chars) }, `再打一次《${open.title}》`)}>再打一次</button>
      </div>
    );
  }
  return (
    <div>
      <p>收集了 <b>{Object.keys(col).length}</b> / {POEMS.length} 首詩</p>
      <div className="tabs">
        {CATEGORIES.map(c => <button key={c} aria-pressed={c === cat} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="grid">
        {POEMS.filter(p => p.category === cat).map(p => col[p.id] ? (
          <button key={p.id} className="card poem" onClick={() => setOpen(p)}>
            <img className="px cat-art" src={S.category(p.category)} alt="" /><b>《{p.title}》</b>
          </button>
        ) : (
          <div key={p.id} className="card poem locked"><img className="px cat-art" src={S.category(p.category)} alt="" /><b>？？？</b></div>
        ))}
      </div>
    </div>
  );
}

export function Records() {
  const s = useGame(s => s.stats);
  const days = Object.entries(s.daily).slice(-7);
  const maxDay = Math.max(1, ...days.map(([, d]) => d.hanzi));
  const top = Object.entries(s.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div className="records">
      <div className="stat-grid">
        <div><b>{s.hanzi}</b><span>打對的字</span></div>
        <div><b>{s.punct}</b><span>打對的標點</span></div>
        <div><b>{cpm(s.hanzi, s.ms)}</b><span>一分鐘打幾個字</span></div>
      </div>
      <h3>每天打了幾個字</h3>
      {days.length === 0 ? <p>還沒有紀錄。</p> : (
        <div className="bars">{days.map(([d, v]) => (
          <div key={d} className="bar-col"><div className="bar" style={{ height: `${(v.hanzi / maxDay) * 100}%` }} /><span>{d.slice(5)}</span></div>
        ))}</div>
      )}
      <details className="teacher">
        <summary>給老師看的詳細紀錄</summary>
        <p>完成工作 {s.tasks} 次・打字 {Math.round(s.ms / 60000)} 分鐘・第一次就打對 {s.positions ? Math.round((s.firstTry / s.positions) * 100) : 0}%</p>
        <p>常打錯的字：{top.length ? top.map(([c, n]) => `${c}（${n}）`).join("、") : "無"}</p>
        <p>提示：放大字形 {s.hints.level1 ?? 0}・按鍵順序 {s.hints.level2 ?? 0}・鍵盤示範 {s.hints.level3 ?? 0}・跟著按 {s.hints.level4 ?? 0}</p>
        <p>提醒：英文模式 {s.ime.englishMode ?? 0}・半形標點 {s.ime.halfwidth ?? 0}・同音字 {s.ime.homophone ?? 0}・沒有選字 {s.ime.noCandidate ?? 0}・標點錯誤 {s.punctErrors}</p>
      </details>
    </div>
  );
}

export function Settings() {
  const st = useGame(s => s.settings);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="settings">
      <label><input type="checkbox" checked={st.muted} onChange={e => updateSettings({ muted: e.target.checked })} /> 關掉聲音</label>
      <label>字的大小
        <select value={st.fontScale} onChange={e => updateSettings({ fontScale: +e.target.value })}>
          <option value={1}>標準</option><option value={1.25}>大</option><option value={1.5}>特大</option>
        </select>
      </label>
      <details className="teacher">
        <summary>老師設定</summary>
        <label>音效音量 <input type="range" min={0} max={1} step={0.1} value={st.sfx} onChange={e => updateSettings({ sfx: +e.target.value })} /></label>
        <label>背景音樂 <input type="range" min={0} max={1} step={0.05} value={st.music} onChange={e => updateSettings({ music: +e.target.value })} /></label>
        <label><input type="checkbox" checked={st.lowPerf} onChange={e => updateSettings({ lowPerf: e.target.checked })} /> 低效能模式（關掉動畫）</label>
        <label>教學用的輸入法
          <select value={st.ime} onChange={e => updateSettings({ ime: e.target.value as typeof st.ime })}>
            <option value="ms-bopomofo">微軟注音（預設）</option><option value="other-bopomofo">其他注音</option>
            <option value="cangjie">倉頡</option><option value="other">其他</option>
          </select>
        </label>
        {!confirm ? <button className="danger" onClick={() => setConfirm(true)}>重新開始農場…</button> : (
          <p>確定要刪除這台電腦上的農場和紀錄嗎？刪除後無法復原。
            <button className="danger" onClick={() => { clearSave(); location.reload(); }}>確定刪除</button>
            <button onClick={() => setConfirm(false)}>取消</button></p>
        )}
      </details>
    </div>
  );
}
