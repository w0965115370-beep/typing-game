// 大千式注音虛擬鍵盤＋動態示範＋引導式練習。
// 引導練習在獨立、不可輸入的區塊監聽 keydown（看實體按鍵位置 e.code），不會干擾輸入框的組字。
import { useEffect, useRef, useState } from "react";
import { KEY_ROWS, keyIdFromCode } from "../config/keyboard.ts";
import { HINTS } from "../config/hints.ts";
import type { KeyStep } from "../lib/zhuyin.ts";
import { sfx } from "../lib/audio.ts";

type Props = { steps: KeyStep[]; current?: number; done?: number; showAll?: boolean; flash?: string | null };

export function Keyboard({ steps, current = -1, done = 0, showAll = false, flash }: Props) {
  const orderOf = (id: string) => steps.map((s, i) => s.key === id ? i + 1 : 0).filter(Boolean);
  return (
    <div className="kbd" role="img" aria-label={`鍵盤示範：${steps.map(s => s.key).join("、")}`}>
      {KEY_ROWS.map((row, r) => (
        <div className="krow" key={r} style={{ paddingLeft: [0, 0.5, 0.75, 0, 0][r] * 46 }}>
          {row.map(k => {
            const nums = orderOf(k.id);
            const isCur = current >= 0 && steps[current]?.key === k.id;
            const isDone = nums.some(n => n <= done);
            const isNext = current >= 0 && steps[current + 1]?.key === k.id;
            const cls = isCur ? "cur" : isNext ? "next" : isDone ? "done" : "";
            return (
              <div key={k.id} className={`key ${cls} ${flash === k.id ? "flash" : ""}`} style={{ flex: k.wide ?? 1 }}>
                {k.zy && <span className="kzy">{k.zy}</span>}
                <span className="klabel">{k.label}</span>
                {(showAll || isCur || isNext || isDone) && nums.length > 0 && <span className="knum">{nums.join(",")}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function KeySteps({ steps, current = -1 }: { steps: KeyStep[]; current?: number }) {
  return (
    <ol className="ksteps">
      {steps.map((s, i) => (
        <li key={i} className={i === current ? "cur" : ""}>
          <b>{s.key === "Space" ? "空白鍵" : s.key}</b><span>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** 動態鍵盤示範：每次只亮一個按鍵，可播放、暫停、重播、上一步、下一步。 */
export function KeyDemo({ steps, autoPlay, onGuided }: { steps: KeyStep[]; autoPlay: boolean; onGuided?: () => void }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI(n => {
      if (n >= steps.length - 1) { setPlaying(false); return n; }
      return n + 1;
    }), HINTS.demoStepMs);
    return () => clearInterval(t);
  }, [playing, steps.length]);
  return (
    <div className="demo">
      <div className="demo-bar">
        <span>第 {i + 1} / {steps.length} 鍵：<b>{steps[i]?.key === "Space" ? "空白鍵" : steps[i]?.key}</b>（{steps[i]?.label}）</span>
        <button onClick={() => setPlaying(p => !p)}>{playing ? "⏸ 暫停" : "▶ 播放"}</button>
        <button onClick={() => { setI(0); setPlaying(true); }}>↺ 重新播放</button>
        <button onClick={() => { setPlaying(false); setI(n => Math.max(0, n - 1)); }}>← 上一步</button>
        <button onClick={() => { setPlaying(false); setI(n => Math.min(steps.length - 1, n + 1)); }}>下一步 →</button>
        <button onClick={() => setAll(a => !a)} aria-pressed={all}>{all ? "隱藏" : "顯示"}全部順序</button>
        {onGuided && <button className="primary" onClick={onGuided}>一起按按看</button>}
      </div>
      <Keyboard steps={steps} current={i} done={i} showAll={all} />
    </div>
  );
}

/** 引導式練習：一次只要求按一個實體按鍵，按對才前進。完成後不會填入答案。 */
export function GuidedPractice({ steps, target, onClose }: { steps: KeyStep[]; target: string; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [msg, setMsg] = useState("請按下亮起來的按鍵。");
  const [flash, setFlash] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  const finished = i >= steps.length;
  const onKey = (e: React.KeyboardEvent) => {
    if (finished) return;
    const id = keyIdFromCode(e.nativeEvent.code);
    if (!id || e.key === "Tab" || e.key === "Escape") return;
    e.preventDefault();
    const want = steps[i].key;
    // 標點的組合鍵（例如 Shift + ,）：只看最後一個鍵，並確認 Shift 有按住
    const needShift = steps.some(s => s.key === "Shift");
    if (id === "Shift" && needShift) { setMsg("很好，按住 Shift 不要放，再按下一個鍵。"); if (want === "Shift") setI(i + 1); return; }
    setFlash(id); setTimeout(() => setFlash(null), 250);
    if (id === want && (!needShift || e.shiftKey)) {
      sfx("ok");
      setI(i + 1);
      setMsg(i + 1 >= steps.length ? `完成了！現在回到輸入框，自己打出「${target}」。` : "答對了！再按下一個亮起來的按鍵。");
    } else {
      sfx("soft");
      setMsg(`你按的是 ${id}，請找找亮起來的 ${want === "Space" ? "空白鍵" : want}（${steps[i].label}）。`);
    }
  };
  return (
    <div className="guided" ref={box} tabIndex={0} onKeyDown={onKey} aria-label="引導式按鍵練習區，請按實體鍵盤">
      <p className="guided-msg">{msg}</p>
      <p className="guided-note">這裡只練習按鍵位置，不會打出文字。點一下這個區塊再開始按。</p>
      <Keyboard steps={steps} current={finished ? -1 : i} done={i} flash={flash} />
      <button className="primary" onClick={onClose}>{finished ? "回去自己打打看" : "先不練了"}</button>
    </div>
  );
}
