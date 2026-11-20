// 種子、商店、背包、訂單、詩歌圖鑑、學習紀錄、設定。全部用滑鼠操作。
import { useState } from "react";
import { useGame, buy, sellCrop, startOrder, startPractice, updateSettings, askRescue } from "../store.ts";
import { ACTIVE_CROPS, CROP, type CropId } from "../config/economy.ts";
import { levelOf, needsRescue } from "../lib/farm.ts";
import { POEMS, POEM, CATEGORIES, cpm, type Poem } from "../lib/learning.ts";
import { ZhuyinLine } from "./Zhuyin.tsx";
import * as S from "../lib/sprites.ts";
import { clearSave } from "../lib/save.ts";

const Coin = ({ n }: { n: number }) => <span className="coin"><img className="px" src={S.icons.coin()} alt="金幣" />{n}</span>;

export function Seeds({ close }: { close: () => void }) {
  const seeds = useGame(s => s.farm.seeds);
  const sel = useGame(s => s.selectedSeed);
  const rescueNeeded = useGame(s => needsRescue(s.farm));
  const owned = ACTIVE_CROPS.filter(c => (seeds[c.id] ?? 0) > 0);
  return (
    <div>
      {owned.length === 0 && <p>背包裡沒有種子了，到「商店」買一些吧！</p>}
      {rescueNeeded && <p><button className="primary" onClick={askRescue}>請阿禾幫忙（免費領取白蘿蔔種子）</button></p>}
      <div className="grid">
        {owned.map(c => (
          <button key={c.id} className={`card ${sel === c.id ? "sel" : ""}`} aria-pressed={sel === c.id}
            onClick={() => { useGame.setState({ selectedSeed: c.id }); close(); }}>
            <img className="px icon48" src={S.seedBag(c.id)} alt="" />
            <b>{c.name}</b><span>還有 {seeds[c.id]} 包</span><span className="sub">成長 {c.growSec} 秒</span>
          </button>
        ))}
      </div>
      {owned.length > 0 && <p className="sub">選好種子後，點農場上一塊空的田。</p>}
    </div>
  );
}

export function Shop() {
  const farm = useGame(s => s.farm);
  const lv = levelOf(farm.xp);
  return (
    <div>
      <p>目前金幣：<Coin n={farm.coins} /></p>
      <div className="grid">
        {ACTIVE_CROPS.map(c => {
          const locked = c.unlock > lv;
          return (
            <div key={c.id} className={`card ${locked ? "locked" : ""}`}>
              <img className="px icon48" src={S.seedBag(c.id)} alt="" />
              <b>{c.name}種子</b>
              {locked ? <span>Lv.{c.unlock} 解鎖</span> : <>
                <span>一包 <Coin n={c.seedPrice} /></span>
                <span className="sub">成長 {c.growSec} 秒・賣 {c.sellPrice} 金幣</span>
                <div className="row">
                  <button disabled={farm.coins < c.seedPrice} onClick={() => buy(c.id, 1)}>買 1 包</button>
                  <button disabled={farm.coins < c.seedPrice * 5} onClick={() => buy(c.id, 5)}>買 5 包（{c.seedPrice * 5}）</button>
                </div>
              </>}
            </div>
          );
        })}
      </div>
      <p className="sub">第二階段會開放農具、肥料與土地擴建。</p>
    </div>
  );
}

export function Bag() {
  const inv = useGame(s => s.farm.inventory);
  const seeds = useGame(s => s.farm.seeds);
  const items = (Object.entries(inv) as [CropId, number][]).filter(([, n]) => n > 0);
  const seedList = (Object.entries(seeds) as [CropId, number][]).filter(([, n]) => n > 0);
  return (
    <div>
      <h3>農產品</h3>
      {items.length === 0 && <p>背包是空的。採收作物後會放在這裡。</p>}
      <div className="grid">
        {items.map(([id, n]) => (
          <div key={id} className="card">
            <img className="px icon48" src={S.produce(id)} alt="" />
            <b>{CROP[id].name} × {n}</b><span>每個 <Coin n={CROP[id].sellPrice} /></span>
            <div className="row">
              <button onClick={() => sellCrop(id, 1)}>賣 1 個</button>
              <button onClick={() => sellCrop(id, n)}>全部賣（{CROP[id].sellPrice * n}）</button>
            </div>
          </div>
        ))}
      </div>
      <h3>種子</h3>
      <p>{seedList.length ? seedList.map(([id, n]) => `${CROP[id].name} ${n} 包`).join("、") : "沒有種子"}</p>
      <h3>工具</h3>
      <p><img className="px icon24" src={S.icons.hoe()} alt="" /> 初級鋤頭　<img className="px icon24" src={S.icons.can()} alt="" /> 初級澆水器</p>
    </div>
  );
}

export function Orders() {
  const farm = useGame(s => s.farm);
  return (
    <div className="grid">
      {farm.orders.map(o => {
        const ready = Object.entries(o.items).every(([id, n]) => (farm.inventory[id as CropId] ?? 0) >= n!);
        return (
          <div key={o.id} className="card order">
            <b>{o.npc}需要：</b>
            {Object.entries(o.items).map(([id, n]) => {
              const have = farm.inventory[id as CropId] ?? 0;
              return <span key={id} className={have >= n! ? "ok" : ""}>
                <img className="px icon24" src={S.produce(id as CropId)} alt="" />{CROP[id as CropId].name} {Math.min(have, n!)}/{n}
              </span>;
            })}
            <span>獎勵 <Coin n={o.reward} />＋{o.xp} 經驗</span>
            <button className="primary" disabled={!ready} onClick={() => startOrder(o.id)}>{ready ? "打字出貨" : "農產品還不夠"}</button>
          </div>
        );
      })}
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
        <button className="ghost" onClick={() => setOpen(null)}>← 回圖鑑</button>
        <div className="poem-card-head">
          <img className="px cat-art" src={S.category(open.category)} alt="" />
          <div><h3>《{open.title}》</h3><p>{open.dynasty}・{open.author}</p></div>
        </div>
        <div className="poem-lines small">{open.lines.map((l, i) => <div key={i} className="pline"><ZhuyinLine chars={l.chars} /></div>)}</div>
        <p className="explain">{open.explain}</p>
        <p className="sub">第一次收藏：{c.first}・最近完成：{c.last}・完成 {c.count} 次</p>
        <button className="primary" onClick={() => { useGame.setState({ screen: null }); startPractice({ text: open.lines.map(l => l.text).join(""), chars: open.lines.flatMap(l => l.chars) }, `重新練習《${open.title}》`); }}>再練習一次</button>
      </div>
    );
  }
  const list = POEMS.filter(p => p.category === cat);
  return (
    <div>
      <p>已收藏 {Object.keys(col).length} / {POEMS.length} 首。每種農場工作會打一句詩，打完整首就能收藏！</p>
      <div className="tabs">
        {CATEGORIES.map(c => <button key={c} aria-pressed={c === cat} onClick={() => setCat(c)}>{c}（{POEMS.filter(p => p.category === c && col[p.id]).length}/{POEMS.filter(p => p.category === c).length}）</button>)}
      </div>
      <div className="grid">
        {list.map(p => col[p.id] ? (
          <button key={p.id} className="card poem" onClick={() => setOpen(p)}>
            <img className="px cat-art" src={S.category(p.category)} alt="" />
            <b>《{p.title}》</b><span>{p.dynasty}・{p.author}</span>
          </button>
        ) : (
          <div key={p.id} className="card poem locked"><img className="px cat-art" src={S.category(p.category)} alt="" /><b>？？？</b><span>還沒收藏</span></div>
        ))}
      </div>
    </div>
  );
}

export function Records() {
  const s = useGame(s => s.stats);
  const learner = useGame(s => s.learner);
  const progress = useGame(s => s.progress);
  const days = Object.entries(s.daily).slice(-7);
  const maxDay = Math.max(1, ...days.map(([, d]) => d.hanzi));
  const top = Object.entries(s.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const rate = s.positions ? Math.round((s.firstTry / s.positions) * 100) : 0;
  return (
    <div className="records">
      <div className="stat-grid">
        <div><b>{s.hanzi}</b><span>正確中文字</span></div>
        <div><b>{s.punct}</b><span>正確標點符號</span></div>
        <div><b>{cpm(s.hanzi, s.ms)}</b><span>每分鐘正確字數（CPM）</span></div>
        <div><b>{rate}%</b><span>第一次就打對</span></div>
        <div><b>{s.tasks}</b><span>完成的打字工作</span></div>
        <div><b>{Math.round(s.ms / 60000)}</b><span>打字分鐘數</span></div>
      </div>
      <h3>最近的進步</h3>
      {days.length === 0 ? <p>還沒有紀錄，去農場工作吧！</p> : (
        <div className="bars">{days.map(([d, v]) => (
          <div key={d} className="bar-col"><div className="bar" style={{ height: `${(v.hanzi / maxDay) * 100}%` }} /><span>{d.slice(5)}</span><span className="sub">{v.hanzi} 字</span></div>
        ))}</div>
      )}
      <h3>練習狀態</h3>
      <p>目前一次打 {learner.level >= 2 ? "兩" : "一"} 句（播種固定一句）。標點練習：{learner.punctStage === 1 ? "逗號、句號" : "逗號、句號、頓號、問號、驚嘆號"}。正在練習《{POEM[progress.poemId].title}》第 {progress.line + 1} 句。</p>
      <h3>需要多練習的字</h3>
      <p>{top.length ? top.map(([c, n]) => `${c}（${n}）`).join("、") : "目前沒有"}</p>
      <h3>提示與提醒</h3>
      <p className="sub">
        放大字形 {s.hints.level1 ?? 0} 次・按鍵順序 {s.hints.level2 ?? 0} 次・動態示範 {s.hints.level3 ?? 0} 次・引導練習 {s.hints.level4 ?? 0} 次<br />
        英文模式提醒 {s.ime.englishMode ?? 0} 次・半形標點提醒 {s.ime.halfwidth ?? 0} 次・同音字提醒 {s.ime.homophone ?? 0} 次・選字提醒 {s.ime.noCandidate ?? 0} 次<br />
        標點錯誤 {s.punctErrors} 次（其中全形半形混淆 {s.halfwidth} 次）
      </p>
      <p className="sub">使用提示不會扣金幣或經驗值，放心使用。</p>
    </div>
  );
}

export function Settings() {
  const st = useGame(s => s.settings);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="settings">
      <label>音效音量 <input type="range" min={0} max={1} step={0.1} value={st.sfx} onChange={e => updateSettings({ sfx: +e.target.value })} /></label>
      <label>背景音樂 <input type="range" min={0} max={1} step={0.05} value={st.music} onChange={e => updateSettings({ music: +e.target.value })} /></label>
      <label><input type="checkbox" checked={st.muted} onChange={e => updateSettings({ muted: e.target.checked })} /> 全部靜音</label>
      <label>題目字級
        <select value={st.fontScale} onChange={e => updateSettings({ fontScale: +e.target.value })}>
          <option value={1}>標準（34px）</option><option value={1.25}>大</option><option value={1.5}>特大</option>
        </select>
      </label>
      <label><input type="checkbox" checked={st.lowPerf} onChange={e => updateSettings({ lowPerf: e.target.checked })} /> 低效能模式（關掉蝴蝶、搖晃等動畫）</label>
      <label>教學使用的輸入法
        <select value={st.ime} onChange={e => updateSettings({ ime: e.target.value as typeof st.ime })}>
          <option value="ms-bopomofo">Windows 微軟注音（預設）</option>
          <option value="other-bopomofo">其他注音輸入法</option>
          <option value="cangjie">倉頡</option>
          <option value="other">其他輸入方式</option>
        </select>
      </label>
      <p className="sub">這只是選擇教學內容，網頁無法讀取電腦實際使用的輸入法。鍵盤提示以大千式注音鍵盤為準。</p>
      <hr />
      {!confirm ? <button className="danger" onClick={() => setConfirm(true)}>重新開始農場…</button> : (
        <p>確定要刪除這台電腦上的農場、收藏和紀錄嗎？刪除後無法復原。
          <button className="danger" onClick={() => { clearSave(); location.reload(); }}>確定刪除</button>
          <button onClick={() => setConfirm(false)}>取消</button></p>
      )}
    </div>
  );
}
