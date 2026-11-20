// 我的紀錄、設定。字少、按鈕大，給老師看的細節收在 details 裡。
import { useState } from "react";
import { useGame, updateSettings } from "../store.ts";
import { cpm } from "../lib/learning.ts";
import { clearSave } from "../lib/save.ts";

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
        {!confirm ? <button className="danger" onClick={() => setConfirm(true)}>全部重新開始…</button> : (
          <p>確定要刪除這台電腦上的關卡分數和紀錄嗎？刪除後無法復原。
            <button className="danger" onClick={() => { clearSave(); location.reload(); }}>確定刪除</button>
            <button onClick={() => setConfirm(false)}>取消</button></p>
        )}
      </details>
    </div>
  );
}
