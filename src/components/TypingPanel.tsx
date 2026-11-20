// 中文打字工作區。重點：
// - 原生 textarea、非受控（不在 React 裡設定 value），組字中不改值、不搶焦點、不攔任何按鍵。
// - 只在 compositionend 之後或非組字的 input 事件時判定；同一個值只判定一次。
// - 這個元件不訂閱農場狀態，農場每秒成長不會讓它重新渲染。
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
import { CROP } from "../config/economy.ts";
import { POEM, type TaskResult } from "../lib/learning.ts";
import { sfx } from "../lib/audio.ts";
import { icons, produce, seedBag } from "../lib/sprites.ts";

type Props = { task: Task; onDone: (r: TaskResult) => void; onCancel: () => void };

const ENCOURAGE = ["再試一次！", "看看旁邊的注音。", "這個字可以看看鍵盤提示。", "記得選擇正確的國字。"];

function mistakeText(m: Mistake, t: string | undefined, c: string | undefined): string {
  const name = t ? PUNCT_HELP[t]?.name ?? "標點" : "";
  switch (m) {
    case "latin": return `這裡要打中文字「${t}」喔！`;
    case "zhuyin": return `打完注音後，要選出國字「${t}」喔！`;
    case "halfwidth":
      if (t === "，" && c === ",") return "你打出的是英文逗號，我們需要中文逗號喔！請先確認已切換成中文輸入模式。";
      if (t === "。" && c === ".") return "這是英文句點，請試著輸入中文句號。";
      return `「${c}」是英文的半形符號，這裡需要中文的${name}「${t}」。`;
    case "wrongPunct": return `這裡要打${name}「${t}」，你打成了「${c}」。`;
    case "missingPunct": return `別忘了中文標點符號：這裡要先打${name}「${t}」。`;
    case "punctForChar": return `這裡還不用打標點，先打國字「${t}」。`;
    case "missing": return `好像漏打了「${t}」，你直接打了下一個字。`;
    case "extra": return `多打了一個「${c}」，把它刪掉就好。`;
    case "wrongChar": return `這裡是「${t}」，你打成了「${c}」。`;
    case "tooLong": return "已經打完了，多打的字要刪掉喔。";
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
  const autoDemo = true;

  const ta = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const sawComp = useRef(false);
  const lastValue = useRef<string | null>(null);
  const counter = useRef(new ErrorCounter());
  const cooldown = useRef(new Cooldown());
  const missed = useRef(new Set<number>());
  const startedAt = useRef(0);
  const tally = useRef({ punctErrors: 0, halfwidth: 0, hints: {} as Record<string, number>, ime: {} as Record<string, number>, mistakes: {} as Record<string, number>, maxHint: 0, seen: new Set<string>() });

  const [ev, setEv] = useState<Eval>(() => evaluate(target, ""));
  const [idle, setIdle] = useState(0);
  const [manual, setManual] = useState(0);
  const [advice, setAdvice] = useState<ImeAdvice | null>(null);
  const [homophone, setHomophone] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "keys" | "punct" | "ime" | "guided">(null);
  const [finished, setFinished] = useState(false);

  const doneTimer = useRef(0);
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
  if (panel === "guided") level = 4;
  const ask = idle >= HINTS.askAfterSec && level < 2 && !finished;

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
    if (curIsPunct) return (PUNCT_HELP[cur.c]?.keys ?? []).map(k => ({ key: k, label: k === "Shift" ? "按住" : cur.c }));
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
    if (e.pos > ev.pos) { // 前進了
      sfx("ok"); sawComp.current = false; setIdle(0); setManual(0); setHomophone(null); setAdvice(null);
      if (panel !== "ime") setPanel(null);
    } else if (e.pos < ev.pos) { setIdle(0); }
    if (counter.current.record(e)) {
      missed.current.add(e.pos);
      sfx("soft");
      if (e.mistake !== "tooLong") t.mistakes[target[e.pos]] = (t.mistakes[target[e.pos]] ?? 0) + 1;
      if (isPunct(target[e.pos] ?? "")) t.punctErrors++;
      if (e.mistake === "halfwidth") t.halfwidth++;
    }
    const a = analyze(e, target, sawComp.current);
    if (a && cooldown.current.ok(a)) { setAdvice(a); t.ime[a] = (t.ime[a] ?? 0) + 1; }
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
  const poem = task.poemId ? POEM[task.poemId] : null;
  const reward = rewardText(task);
  const help = cur && curIsPunct ? PUNCT_HELP[cur.c] : null;

  return (
    <section className="typing" aria-label="打字工作區" style={{ ["--zh" as string]: `${34 * fontScale}px` }}>
      <header className="typing-head">
        <img className="px" src={taskIcon(task)} alt="" width={40} height={40} />
        <div>
          <h2>{task.title}</h2>
          {poem && <p className="poem-meta">《{poem.title}》{poem.dynasty}・{poem.author}</p>}
        </div>
        <p className="reward">完成後：{reward}</p>
        <button className="ghost" onClick={onCancel}>先不做了</button>
      </header>

      <div className="poem-lines" aria-label="要輸入的內容">
        {task.lines.map((l, li) => {
          const offset = task.lines.slice(0, li).reduce((n, x) => n + x.chars.length, 0);
          return <div key={li} className="pline"><ZhuyinLine chars={l.chars} states={states.slice(offset, offset + l.chars.length)} /></div>;
        })}
      </div>

      <div className="progress-row">
        <span>已完成 {pos} / {target.length}</span>
        <div className="pbar"><div style={{ width: `${(pos / target.length) * 100}%` }} /></div>
      </div>

      <textarea
        ref={ta}
        className="typing-input"
        rows={2}
        lang="zh-Hant-TW"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        placeholder="在這裡用注音輸入法打字…"
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

      {finished && <p className="done-msg" role="status">太好了，這一句完成了！</p>}

      {!finished && (
        <div className="help-row">
          <button onClick={() => setManual(m => Math.min(3, Math.max(m, level) + 1))}><img className="px" src={icons.help()} alt="" />我不會打</button>
          <button onClick={() => setPanel(panel === "keys" ? null : "keys")} aria-pressed={panel === "keys"}><img className="px" src={icons.keyboard()} alt="" />鍵盤提示</button>
          <button onClick={() => setPanel(panel === "punct" ? null : "punct")} aria-pressed={panel === "punct"}>，標點提示</button>
          <button onClick={() => setPanel(panel === "ime" ? null : "ime")} aria-pressed={panel === "ime"}>中 輸入法協助</button>
        </div>
      )}

      <div className="hints" aria-live="polite">
        {!finished && advice && (
          <div className="hint ime">
            <p>{IME_TEXT[advice]}</p>
            {advice === "englishMode" && <button onClick={() => setPanel("ime")}>看看怎麼切換</button>}
            {advice === "halfwidth" && <button onClick={() => setPanel("punct")}>學習中文標點</button>}
            <button className="ghost" onClick={() => setAdvice(null)}>知道了</button>
          </div>
        )}

        {!finished && ev.mistake && (
          <div className="hint mistake">
            <p>{mistakeText(ev.mistake, target[pos], ev.wrong)}</p>
            <p className="sub">{ENCOURAGE[Math.min(errs, ENCOURAGE.length) - 1] ?? ENCOURAGE[0]} 按 Backspace 可以把錯的字刪掉。</p>
          </div>
        )}

        {!finished && ask && !ev.mistake && (
          <div className="hint ask">
            <p>你是不是遇到不會輸入的字？要不要看看鍵盤提示？</p>
            <button onClick={() => setManual(2)}>好，給我提示</button>
          </div>
        )}

        {!finished && cur && level >= 1 && level < 4 && (
          <div className="hint big">
            <div className="bigchar"><ZhuyinChar {...cur} /></div>
            <div>
              {help ? (
                <>
                  <p>這裡要打<b>{help.name}</b>「{cur.c}」</p>
                  {help.half && <p className="sub">中文的「{cur.c}」比較大、佔一整格；英文的「{help.half}」比較小。要打中文的喔！</p>}
                  {ev.wrong && <p className="sub">你剛剛打的是「{ev.wrong}」</p>}
                </>
              ) : (
                <>
                  <p>這個字是「{cur.c}」，注音是 <b>{cur.zy}</b></p>
                  {homophone && <p className="sub">「{homophone}」和「{cur.c}」讀音一樣、寫法不同。打完注音後，在候選字裡找「{cur.c}」。</p>}
                </>
              )}
            </div>
          </div>
        )}

        {!finished && cur && level === 2 && steps.length > 0 && (
          <div className="hint">
            <p>按鍵順序：</p>
            <KeySteps steps={steps} />
            {!curIsPunct && <p className="sub">按完後，從候選字中選擇「{cur.c}」。</p>}
          </div>
        )}

        {!finished && cur && level === 3 && steps.length > 0 && (
          <KeyDemo key={pos} steps={steps} autoPlay={autoDemo} onGuided={() => setPanel("guided")} />
        )}

        {!finished && panel === "guided" && cur && steps.length > 0 && (
          <GuidedPractice key={pos} steps={steps} target={cur.c} onClose={() => { setPanel(null); setManual(0); ta.current?.focus(); }} />
        )}

        {!finished && panel === "keys" && cur && (
          <div className="hint">
            {steps.length > 0 ? <><KeySteps steps={steps} /><Keyboard steps={steps} showAll /></>
              : <p>{SYMBOL_MENU_HELP}</p>}
          </div>
        )}

        {!finished && panel === "punct" && <PunctTutor need={curIsPunct ? cur!.c : null} wrong={ev.wrong} />}
        {!finished && panel === "ime" && <ImeHelp />}
      </div>
    </section>
  );
}

function PunctTutor({ need, wrong }: { need: string | null; wrong?: string }) {
  const list = need ? [need] : ["，", "。"];
  return (
    <div className="hint punct-tutor">
      {list.map(p => {
        const h = PUNCT_HELP[p];
        return (
          <div key={p} className="punct-card">
            <div className="punct-big" aria-label={h.name}>{p}</div>
            <div>
              <p><b>{h.name}</b>：{h.how}</p>
              {h.half && <p className="sub">英文半形「{h.half}」看起來很像，但不是中文標點，不能通過。</p>}
              {wrong && need && <p className="sub">你目前打的是「{wrong}」。</p>}
              {h.keys.length > 0 && <Keyboard steps={h.keys.map(k => ({ key: k, label: k }))} showAll />}
            </div>
          </div>
        );
      })}
      <p className="sub">{SYMBOL_MENU_HELP}</p>
      <p className="sub">標點要自己打出來，畫面不會幫你補上。</p>
    </div>
  );
}

function ImeHelp() {
  return (
    <div className="hint ime-help">
      <p><b>怎麼切換成中文注音輸入法？</b></p>
      <ol>
        <li>看螢幕右下角的工作列，找到「中」或「英」、「ENG」的圖示。</li>
        <li>同時按 <kbd>Windows 鍵</kbd> + <kbd>空白鍵</kbd>，可以切換不同的輸入法。選「中文（繁體，台灣）微軟注音」。</li>
        <li>如果右下角顯示「英」，代表現在是英數模式。很多電腦按一下 <kbd>Shift</kbd> 可以切回「中」，但每台電腦的設定可能不同。</li>
        <li>切換好以後，點一下上面的輸入框，再試一次。</li>
      </ol>
      <p className="sub">網頁沒有辦法直接知道你的電腦用哪一種輸入法，這些提醒是根據你打出來的字推測的。</p>
    </div>
  );
}

function rewardText(t: Task) {
  const s = useGame.getState();
  if (t.kind === "plant") return `種下${CROP[t.cropId!].name}`;
  if (t.kind === "water") return "作物喝到水，會繼續長大";
  if (t.kind === "harvest") {
    const id = s.farm.plots.find(p => p.id === t.plotId)?.crop?.id;
    return id ? `收成 1 個${CROP[id].name}` : "收成";
  }
  if (t.kind === "order") {
    const o = s.farm.orders.find(o => o.id === t.orderId);
    return o ? `${o.reward} 金幣、${o.xp} 經驗值` : "完成訂單";
  }
  return "練習打字";
}

function taskIcon(t: Task) {
  if (t.kind === "plant") return seedBag(t.cropId!);
  if (t.kind === "water") return icons.can();
  if (t.kind === "harvest") {
    const id = useGame.getState().farm.plots.find(p => p.id === t.plotId)?.crop?.id;
    return id ? produce(id) : icons.hoe();
  }
  if (t.kind === "order") return icons.orders();
  return icons.keyboard();
}
