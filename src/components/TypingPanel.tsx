// 中文打字工作區。重點：
// - 原生 textarea、非受控（不在 React 裡設定 value），組字中不改值、不搶焦點、不攔任何按鍵。
// - 只在 compositionend 之後或非組字的 input 事件時判定；同一個值只判定一次。
// - 畫面只有：詩句、輸入框、「我不會打」。其他提示在需要時自動出現，一次只出現一則訊息。
import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../store.ts";
import { useGame } from "../store.ts";
import { ZhuyinLine, ZhuyinChar } from "./Zhuyin.tsx";
import { KeyDemo, KeySteps, GuidedPractice, Keyboard } from "./Keyboard.tsx";
import { evaluate, ErrorCounter, isPunct, type Eval, type Mistake } from "../lib/typing.ts";
import { analyze, Cooldown, IME_TEXT, type ImeAdvice } from "../lib/ime.ts";
import { zhuyinToKeys, pinyinToZhuyin, type KeyStep } from "../lib/zhuyin.ts";
import { HINTS } from "../config/hints.ts";
import { PUNCT_HELP, SYMBOL_MENU_HELP } from "../config/punctuation.ts";
import { LEVELS, type TaskResult } from "../lib/learning.ts";
import { sfx } from "../lib/audio.ts";
import { Icon } from "./Art.tsx";

type Props = { task: Task; onDone: (r: TaskResult) => void; onCancel: () => void };

function mistakeText(m: Mistake, t = ""): string {
  const name = PUNCT_HELP[t]?.name ?? "";
  switch (m) {
    case "latin": return `要打中文字「${t}」喔！`;
    case "zhuyin": return `要選出國字「${t}」喔！`;
    case "halfwidth": return `要打中文的${name}「${t}」喔！`;
    case "wrongPunct": return `這裡要打${name}「${t}」喔！`;
    case "missingPunct": return `別忘了${name}「${t}」喔！`;
    case "punctForChar": return `先打「${t}」喔！`;
    case "missing": return `漏打了「${t}」喔！`;
    case "tooLong": return "打太多了！";
    default: return `這裡要打「${t}」喔！`;
  }
}

/** 查打錯的字是否與目標同音（第一次用到才載入拼音字典）。 */
async function sameSound(wrong: string, targetZy: string) {
  try {
    const { pinyin } = await import("pinyin-pro");
    const all = pinyin(wrong, { toneType: "num", type: "array", multiple: true }) as string[];
    return all.some(p => { try { return pinyinToZhuyin(p) === targetZy; } catch { return false; } });
  } catch { return false; }
}

export function TypingPanel({ task, onDone, onCancel }: Props) {
  const chars = useMemo(() => task.lines.flatMap(l => l.chars), [task]);
  const target = useMemo(() => chars.map(c => c.c), [chars]);
  const fontScale = useGame(s => s.settings.fontScale);

  const ta = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const sawComp = useRef(false);
  const lastValue = useRef<string | null>(null);
  const counter = useRef(new ErrorCounter());
  const cooldown = useRef(new Cooldown());
  const missed = useRef(new Set<number>());
  const startedAt = useRef(0);
  const doneTimer = useRef(0);
  const tally = useRef({ punctErrors: 0, halfwidth: 0, hints: {} as Record<string, number>, ime: {} as Record<string, number>, mistakes: {} as Record<string, number>, maxHint: 0, seen: new Set<string>() });

  const [ev, setEv] = useState<Eval>(() => evaluate(target, ""));
  const [idle, setIdle] = useState(0);
  const [manual, setManual] = useState(0);
  const [advice, setAdvice] = useState<ImeAdvice | null>(null);
  const [homophone, setHomophone] = useState<string | null>(null);
  const [guided, setGuided] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => { ta.current?.focus(); return () => clearTimeout(doneTimer.current); }, []);

  // 停在同一個字的秒數：組字中、切換到別的分頁時不計時
  useEffect(() => {
    const t = setInterval(() => { if (!composing.current && !document.hidden && !finished) setIdle(n => n + 1); }, 1000);
    return () => clearInterval(t);
  }, [finished]);

  const pos = ev.pos;
  const cur = chars[pos];
  const curIsPunct = cur ? isPunct(cur.c) : false;
  const errs = counter.current.at(pos);

  let level = manual;
  if (errs >= HINTS.level3Errors || idle >= HINTS.demoAfterSec) level = Math.max(level, 3);
  else if (errs >= HINTS.level2Errors || idle >= HINTS.keysAfterSec) level = Math.max(level, 2);
  else if (errs >= HINTS.level1Errors) level = Math.max(level, 1);
  if (guided) level = 4;
  const ask = idle >= HINTS.askAfterSec && level === 0 && !finished;

  // 記錄提示使用（每個位置每個等級只記一次）
  useEffect(() => {
    if (level <= 0) return;
    const key = `${pos}:${level}`;
    const t = tally.current;
    if (t.seen.has(key)) return;
    t.seen.add(key);
    t.hints[`level${level}`] = (t.hints[`level${level}`] ?? 0) + 1;
    t.maxHint = Math.max(t.maxHint, level);
  }, [level, pos]);

  const steps: KeyStep[] = useMemo(() => {
    if (!cur) return [];
    if (curIsPunct) return (PUNCT_HELP[cur.c]?.keys ?? []).map(k => ({ key: k, label: k === "Shift" || k === "Ctrl" ? "按住" : cur.c }));
    try { return zhuyinToKeys(cur.zy); } catch { return []; }
  }, [cur, curIsPunct]);

  function check() {
    const el = ta.current;
    if (!el || composing.current || finished) return;
    const v = el.value;
    if (v === lastValue.current) return; // input 與 compositionend 可能各觸發一次，同一個值只算一次
    lastValue.current = v;
    if (!startedAt.current && v) startedAt.current = performance.now();
    const e = evaluate(target, v);
    const t = tally.current;
    if (e.pos > ev.pos) { // 前進了：收起提示
      sfx("ok"); sawComp.current = false; setIdle(0); setManual(0); setHomophone(null); setAdvice(null); setGuided(false);
    } else if (e.pos < ev.pos) setIdle(0);
    if (counter.current.record(e)) {
      missed.current.add(e.pos);
      sfx("soft");
      if (e.mistake !== "tooLong") t.mistakes[target[e.pos]] = (t.mistakes[target[e.pos]] ?? 0) + 1;
      if (isPunct(target[e.pos] ?? "")) t.punctErrors++;
      if (e.mistake === "halfwidth") t.halfwidth++;
    }
    const a = analyze(e, target, sawComp.current);
    if (a && cooldown.current.ok(a)) { setAdvice(a); t.ime[a] = (t.ime[a] ?? 0) + 1; }
    if (!e.mistake) setAdvice(null);
    if (e.mistake === "wrongChar" && e.wrong && chars[e.pos]?.zy) {
      const w = e.wrong, p = e.pos;
      sameSound(w, chars[p].zy).then(same => {
        if (!same || ta.current?.value !== v) return;
        setHomophone(w);
        if (cooldown.current.ok("homophone")) { setAdvice("homophone"); t.ime.homophone = (t.ime.homophone ?? 0) + 1; }
      });
    }
    setEv(e);
    if (e.done) finish();
  }

  function finish() {
    setFinished(true);
    const t = tally.current;
    const hanzi = target.filter(c => !isPunct(c)).length;
    const result: TaskResult = {
      hanzi, punct: target.length - hanzi, ms: startedAt.current ? performance.now() - startedAt.current : 0,
      maxHint: t.maxHint, firstTry: target.length - missed.current.size, positions: target.length,
      punctErrors: t.punctErrors, halfwidth: t.halfwidth, hints: t.hints, ime: t.ime, mistakes: t.mistakes,
    };
    doneTimer.current = window.setTimeout(() => onDone(result), 900);
  }

  const states = chars.map((_, i) => i < pos ? "ok" : i === pos ? (ev.mistake ? "cur bad" : "cur") : "");
  const poem = task.level !== undefined ? LEVELS[task.level] : null;
  const help = cur && curIsPunct ? PUNCT_HELP[cur.c] : null;

  // 一次只顯示一則訊息：完成 > 輸入法提醒 > 打錯 > 停太久
  let message: React.ReactNode = null;
  if (finished) message = <p className="msg good">太棒了！</p>;
  else if (advice) message = (
    <div className="msg warn">
      <p>{IME_TEXT[advice]}</p>
      {advice === "englishMode" && <p className="sub">按 <kbd>Windows</kbd> + <kbd>空白鍵</kbd>，換成「微軟注音」。</p>}
      {advice === "halfwidth" && help && <p className="sub">{help.how}</p>}
      {advice === "homophone" && homophone && cur && <p className="sub">你打的是「{homophone}」，要找的是「{cur.c}」。</p>}
    </div>
  );
  else if (ev.mistake) message = (
    <div className="msg bad"><p>{mistakeText(ev.mistake, target[pos])}</p><p className="sub">按 <kbd>Backspace ⌫</kbd> 刪掉打錯的字。</p></div>
  );
  else if (ask) message = <div className="msg ask"><p>不會打嗎？按下面的黃色按鈕！</p></div>;

  return (
    <section className="typing" aria-label="打字工作區" style={{ ["--zh" as string]: `${34 * fontScale}px` }}>
      <header className="typing-head">
        <Icon name="brush" size={40} />
        <h2>{task.title}</h2>
        {poem && <span className="poem-meta">{poem.dynasty}・{poem.author}</span>}
        <button className="ghost close" onClick={onCancel} aria-label="先不做了">✕</button>
      </header>

      <p className="instruct">照著打完整首詩，標點也要打喔：</p>
      <div className="poem-lines" aria-label="要輸入的內容">
        {task.lines.map((l, li) => {
          const offset = task.lines.slice(0, li).reduce((n, x) => n + x.chars.length, 0);
          return <div key={li} className="pline"><ZhuyinLine chars={l.chars} states={states.slice(offset, offset + l.chars.length)} /></div>;
        })}
      </div>

      <textarea
        ref={ta}
        className="typing-input"
        data-point="typing-input"
        rows={1}
        lang="zh-Hant-TW"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        placeholder="在這裡打字"
        aria-label="中文輸入框"
        disabled={finished}
        onCompositionStart={() => { composing.current = true; sawComp.current = true; }}
        onCompositionEnd={() => { composing.current = false; check(); }}
        onInput={e => { if (!(e.nativeEvent as InputEvent).isComposing) check(); }}
        onBeforeInput={e => {
          const t = (e.nativeEvent as InputEvent).inputType;
          if (t === "insertFromPaste" || t === "insertFromDrop" || t === "insertFromPasteAsQuotation") e.preventDefault();
        }}
        onPaste={e => e.preventDefault()}
        onDrop={e => e.preventDefault()}
      />

      <div className="msg-row" aria-live="polite">
        {message}
        {!finished && level < 3 && (
          <button className="sos" onClick={() => setManual(m => Math.min(3, Math.max(m, level) + 1))}>
            <Icon name="help" size={32} />我不會打
          </button>
        )}
      </div>

      {!finished && cur && level >= 1 && level <= 2 && (
        <div className="hint big">
          <div className="bigchar"><ZhuyinChar {...cur} /></div>
          <div>
            {help ? <>
              <p><b>{help.name}</b>：{help.how}</p>
              {help.keys.length === 0 && <p className="sub">{SYMBOL_MENU_HELP}</p>}
            </> : <p>看注音：<b className="zy-big">{cur.zy}</b></p>}
            {level === 2 && steps.length > 0 && <><p>依序按這些鍵：</p><KeySteps steps={steps} /></>}
            {level === 2 && !curIsPunct && <p className="sub">再從跳出來的字裡選「{cur.c}」。</p>}
          </div>
        </div>
      )}

      {!finished && cur && level === 3 && (steps.length > 0
        ? <KeyDemo key={pos} steps={steps} autoPlay onGuided={() => setGuided(true)} />
        : <div className="hint"><p>{SYMBOL_MENU_HELP}</p><Keyboard steps={[]} /></div>)}

      {!finished && guided && cur && steps.length > 0 && (
        <GuidedPractice key={pos} steps={steps} target={cur.c} onClose={() => { setGuided(false); setManual(0); ta.current?.focus(); }} />
      )}
    </section>
  );
}

