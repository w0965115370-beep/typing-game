import { describe, it, expect } from "vitest";
import { pinyinToZhuyin, zhuyinToKeys, splitZhuyin } from "./zhuyin.ts";
import { KEY_ROWS, KEY_OF_SYMBOL, keyIdFromCode } from "../config/keyboard.ts";
import { evaluate, ErrorCounter } from "./typing.ts";
import { analyze, Cooldown } from "./ime.ts";
import * as F from "./farm.ts";
import { POEMS, PRACTICE, POEM, adapt, newLearner, collect, pickPoem, type TaskResult, type Learner } from "./learning.ts";
import { PUNCT_HELP } from "../config/punctuation.ts";

const T = (s: string) => Array.from(s);

describe("拼音轉注音", () => {
  it.each([
    ["jue2", "ㄐㄩㄝˊ"], ["jiao4", "ㄐㄧㄠˋ"], ["hang2", "ㄏㄤˊ"], ["xing2", "ㄒㄧㄥˊ"], ["yue4", "ㄩㄝˋ"],
    ["le4", "ㄌㄜˋ"], ["chong2", "ㄔㄨㄥˊ"], ["zhong4", "ㄓㄨㄥˋ"], ["shi4", "ㄕˋ"], ["zi3", "ㄗˇ"],
    ["yi1", "ㄧ"], ["wu2", "ㄨˊ"], ["yun2", "ㄩㄣˊ"], ["xiong2", "ㄒㄩㄥˊ"], ["lü4", "ㄌㄩˋ"], ["nüe4", "ㄋㄩㄝˋ"],
    ["qu4", "ㄑㄩˋ"], ["you3", "ㄧㄡˇ"], ["gui4", "ㄍㄨㄟˋ"], ["lun2", "ㄌㄨㄣˊ"], ["er4", "ㄦˋ"], ["de0", "˙ㄉㄜ"],
    ["weng1", "ㄨㄥ"], ["yong3", "ㄩㄥˇ"], ["niu2", "ㄋㄧㄡˊ"],
  ])("%s → %s", (py, zy) => expect(pinyinToZhuyin(py)).toBe(zy));
  it("無法轉換時丟出錯誤", () => expect(() => pinyinToZhuyin("abc9")).toThrow());
});

describe("大千式鍵盤", () => {
  it("37 個注音符號與聲調都有唯一按鍵", () => {
    const syms = "ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˊˇˋ˙";
    for (const s of syms) expect(KEY_OF_SYMBOL[s], s).toBeTruthy();
    const ids = KEY_ROWS.flat().map(k => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it.each([
    ["ㄋㄨㄥˊ", ["S", "J", "/", "6"]], ["ㄔㄨㄣ", ["T", "J", "P", "Space"]],
    ["˙ㄉㄜ", ["2", "K", "7"]], ["ㄐㄩㄝˊ", ["R", "M", ",", "6"]], ["ㄦˋ", ["-", "4"]], ["ㄕˇ", ["G", "3"]],
  ])("%s 的按鍵順序", (zy, keys) => expect(zhuyinToKeys(zy).map(s => s.key)).toEqual(keys));
  it("拆解輕聲與聲調", () => {
    expect(splitZhuyin("˙ㄌㄜ")).toEqual({ neutral: true, symbols: ["ㄌ", "ㄜ"], tone: "" });
    expect(splitZhuyin("ㄒㄧㄠˇ")).toEqual({ neutral: false, symbols: ["ㄒ", "ㄧ", "ㄠ"], tone: "ˇ" });
  });
  it("實體按鍵 code 轉換", () => {
    expect(keyIdFromCode("KeyS")).toBe("S"); expect(keyIdFromCode("Slash")).toBe("/"); expect(keyIdFromCode("Digit6")).toBe("6");
  });
});

describe("打字比對：標點符號驗收", () => {
  const target = T("春眠不覺曉，處處聞啼鳥。");
  it("正確中文逗號、句號可以通過", () => expect(evaluate(target, "春眠不覺曉，處處聞啼鳥。").done).toBe(true));
  it("英文半形逗號不能通過", () => {
    const e = evaluate(target, "春眠不覺曉,");
    expect(e.done).toBe(false); expect(e.mistake).toBe("halfwidth"); expect(e.pos).toBe(5);
  });
  it("英文句點不能通過", () => expect(evaluate(target, "春眠不覺曉，處處聞啼鳥.").mistake).toBe("halfwidth"));
  it("漏打標點不能通過", () => {
    expect(evaluate(target, "春眠不覺曉處處聞啼鳥").done).toBe(false);
    expect(evaluate(target, "春眠不覺曉處").mistake).toBe("missingPunct");
  });
  it("多打標點不能通過", () => expect(evaluate(target, "春眠不覺曉，處處聞啼鳥。。").mistake).toBe("tooLong"));
  it("錯誤標點不能通過", () => expect(evaluate(target, "春眠不覺曉。").mistake).toBe("wrongPunct"));
  it("標點位置錯誤不能通過", () => expect(evaluate(target, "春眠，").mistake).toBe("punctForChar"));
  it("不做 NFKC：全形與半形視為不同字元", () => expect(evaluate(T("！"), "!").done).toBe(false));
  it("換行與空白不需要輸入", () => expect(evaluate(target, "春眠不覺曉，\n處處聞啼鳥。").done).toBe(true));
});

describe("打字比對：中文字", () => {
  const target = T("春眠不覺曉，");
  it("一次提交多個字", () => expect(evaluate(target, "春眠不").pos).toBe(3));
  it("錯字分類", () => {
    expect(evaluate(target, "春棉").mistake).toBe("wrongChar");
    expect(evaluate(target, "春不").mistake).toBe("missing");
    expect(evaluate(target, "春春眠").mistake).toBe("extra");
    expect(evaluate(target, "春ab").mistake).toBe("latin");
    expect(evaluate(target, "春ㄇ").mistake).toBe("zhuyin");
  });
  it("Backspace 修正後可繼續", () => expect(evaluate(target, "春眠").mistake).toBe(null));
  it("同一筆錯誤只算一次（input 與 compositionend 重複觸發）", () => {
    const c = new ErrorCounter();
    const e = evaluate(target, "春棉");
    expect(c.record(e)).toBe(true);
    expect(c.record(e)).toBe(false);
    expect(c.record(evaluate(target, "春棉"))).toBe(false);
    expect(c.at(1)).toBe(1);
    c.record(evaluate(target, "春")); // 刪掉
    expect(c.record(evaluate(target, "春綿"))).toBe(true);
    expect(c.at(1)).toBe(2);
  });
  it("刪掉部分錯字不算新錯誤", () => {
    const c = new ErrorCounter();
    c.record(evaluate(target, "春abc"));
    expect(c.record(evaluate(target, "春ab"))).toBe(false);
    expect(c.at(1)).toBe(1);
  });
});

describe("輸入法行為分析", () => {
  const target = T("春眠，");
  it("沒有組字、連續提交英文字母 → 英文模式提醒", () => expect(analyze(evaluate(target, "tj"), target, false)).toBe("englishMode"));
  it("有組字事件就不判定為英文模式", () => expect(analyze(evaluate(target, "tj"), target, true)).not.toBe("englishMode"));
  it("只有一個英文字母不提醒英文模式", () => expect(analyze(evaluate(target, "t"), target, false)).toBe(null));
  it("半形標點", () => expect(analyze(evaluate(target, "春眠,"), target, false)).toBe("halfwidth"));
  it("提交注音符號 → 選字提醒", () => expect(analyze(evaluate(target, "ㄔㄨㄣ"), target, true)).toBe("noCandidate"));
  it("同音字", () => expect(analyze(evaluate(target, "椿"), target, true, true)).toBe("homophone"));
  it("冷卻時間內不重複", () => {
    const c = new Cooldown(1000);
    expect(c.ok("a", 0)).toBe(true); expect(c.ok("a", 500)).toBe(false); expect(c.ok("a", 1500)).toBe(true);
  });
});

describe("農場經濟", () => {
  const ok = (r: F.Result) => { if (!r.ok) throw new Error(r.error); return r.farm; };
  it("初始狀態", () => {
    const f = F.newFarm();
    expect(f.coins).toBe(300); expect(f.seeds).toEqual({ radish: 5, cabbage: 3 }); expect(f.plots).toHaveLength(6); expect(f.day).toBe(1);
  });
  it("打完一首詩＝過一天：白蘿蔔一天就收成換金幣，高麗菜要兩天", () => {
    let f = ok(F.plant(F.newFarm(), 0, "radish"));
    f = ok(F.plant(f, 1, "cabbage"));
    expect(f.seeds).toEqual({ radish: 4, cabbage: 2 });
    let d = F.endDay(f);
    expect(d.harvested).toEqual({ radish: 1 }); expect(d.earned).toBe(18);
    expect(d.farm.coins).toBe(318); expect(d.farm.plots[0].crop).toBe(null);
    expect(d.growing).toEqual([{ id: "cabbage", left: 1 }]); expect(d.farm.day).toBe(2);
    d = F.endDay(d.farm);
    expect(d.harvested).toEqual({ cabbage: 1 }); expect(d.farm.coins).toBe(353);
  });
  it("沒種菜也可以過一天，只是沒有收成", () => {
    const d = F.endDay(F.newFarm());
    expect(d.earned).toBe(0); expect(d.farm.coins).toBe(300); expect(d.farm.xp).toBeGreaterThan(0);
  });
  it("成長外觀依天數變化", () => {
    expect([0, 1, 2].map(days => F.stageOf({ id: "tomato", days }))).toEqual([1, 2, 4]);
    expect(F.stageOf({ id: "cabbage", days: 1 })).toBe(3);
    expect(F.stageOf({ id: "radish", days: 1 })).toBe(5);
  });
  it("同一塊田不能種兩次、沒種子不能種", () => {
    const f = ok(F.plant(F.newFarm(), 0, "radish"));
    expect(F.plant(f, 0, "radish").ok).toBe(false);
    expect(F.plant(f, 1, "carrot").ok).toBe(false);
  });
  it("金幣不夠不能買、不會變負數", () => {
    const f = { ...F.newFarm(), coins: 5 };
    expect(F.buySeed(f, "radish", 1).ok).toBe(false);
    expect(F.buySeed(f, "radish", -3).ok).toBe(false);
    expect(F.buySeed(F.newFarm(), "radish", 30).ok).toBe(true);
    expect(F.buySeed(F.newFarm(), "radish", 31).ok).toBe(false);
  });
  it("未解鎖的作物不能買", () => expect(F.buySeed(F.newFarm(), "carrot", 1).ok).toBe(false));
  it("沒錢沒種子時可以領免費種子，其他時候不行", () => {
    const f = F.newFarm();
    expect(F.rescue(f).ok).toBe(false);
    const r = F.rescue({ ...f, coins: 0, seeds: {} }); expect(r.ok).toBe(true);
    expect(F.rescue(ok(r)).ok).toBe(false);
  });
  it("升級", () => { expect(F.levelOf(0)).toBe(1); expect(F.levelOf(30)).toBe(2); expect(F.levelOf(79)).toBe(2); expect(F.levelOf(80)).toBe(3); });
});

describe("題庫", () => {
  const items = POEMS.reduce((n, p) => n + p.lines.length + Math.floor(p.lines.length / 2) + 1, 0) + PRACTICE.length;
  it("至少 100 道不同題目（單句、雙句、整首、新手練習）", () => expect(items).toBeGreaterThanOrEqual(100));
  it("每個中文字都有注音，標點都沒有注音且是全形", () => {
    for (const p of POEMS) for (const l of p.lines) for (const c of l.chars) {
      if (PUNCT_HELP[c.c]) expect(c.zy, `${p.title} ${c.c}`).toBe("");
      else {
        expect(c.zy, `${p.title} ${c.c}`).toMatch(/^˙?[ㄅ-ㄩ]+[ˊˇˋ]?$/);
        expect(() => zhuyinToKeys(c.zy)).not.toThrow();
      }
      expect(c.c).not.toMatch(/[,.?!:;]/);
    }
  });
  it("每句都以標點結尾，且只用到已有教學的標點", () => {
    for (const p of POEMS) for (const l of p.lines) {
      expect(PUNCT_HELP[l.text.at(-1)!], `${p.title}：${l.text}`).toBeTruthy();
      for (const c of l.text) if (/[，。、？！：；「」]/.test(c)) expect(PUNCT_HELP[c]).toBeTruthy();
    }
  });
  it("多音字依上下文標注", () => {
    const zy = (id: string, line: number, i: number) => POEMS.find(p => p.id === id)!.lines[line].chars[i].zy;
    expect(zy("chunxiao", 0, 3)).toBe("ㄐㄩㄝˊ");      // 春眠不覺曉
    expect(zy("bailuobo", 1, 6)).toBe("ㄐㄧㄠˋ");      // 睡大覺
    expect(zy("jueju", 1, 1)).toBe("ㄏㄤˊ");           // 一行白鷺
    expect(zy("qingming", 1, 2)).toBe("ㄒㄧㄥˊ");      // 路上行人
    expect(zy("haopengyou", 3, 2)).toBe("ㄌㄜˋ");      // 快樂
    expect(zy("zaofabaidi", 3, 5)).toBe("ㄔㄨㄥˊ");    // 萬重山
    expect(zy("chunxiao", 0, 2)).toBe("ㄅㄨˋ");        // 「不」標本調
  });
  it("古典詩原文、作者與朝代齊全", () => {
    for (const p of POEMS.filter(p => p.kind === "classical")) {
      expect(p.author && p.dynasty && p.explain).toBeTruthy();
      expect(p.license).toBe("Public Domain");
    }
  });
});

describe("適性學習與詩歌收藏", () => {
  const r = (o: Partial<TaskResult>): TaskResult => ({ hanzi: 5, punct: 1, ms: 1000, maxHint: 0, firstTry: 6, positions: 6, punctErrors: 0, halfwidth: 0, hints: {}, ime: {}, mistakes: {}, ...o });
  it("連續 3 首不用提示才升一級", () => {
    let l = newLearner();
    for (let i = 0; i < 2; i++) l = adapt(l, r({}));
    expect(l.level).toBe(1);
    l = adapt(l, r({})); expect(l.level).toBe(2);
  });
  it("連續 2 次需要按鍵提示就降一級", () => {
    let l: Learner = { ...newLearner(), level: 2 };
    l = adapt(l, r({ maxHint: 2 })); expect(l.level).toBe(2);
    l = adapt(l, r({ maxHint: 3 })); expect(l.level).toBe(1);
  });
  it("逗號句號熟練後才加入問號、驚嘆號", () => {
    let l = newLearner();
    expect(POEMS.filter(p => p.punctStage === 2).map(p => pickPoem(l, {}, () => 0))).not.toContain("caihong");
    for (let i = 0; i < 20; i++) l = adapt(l, r({}));
    expect(l.punctStage).toBe(2);
  });
  it("打完整首詩就收藏，再打一次累加次數", () => {
    let col = collect({}, "chunxiao", "2026-11-20");
    col = collect(col, "chunxiao", "2026-11-21");
    expect(col.chunxiao).toEqual({ count: 2, first: "2026-11-20", last: "2026-11-21" });
  });
  it("程度 1 只出 20 字以內的詩，並優先出還沒收藏的", () => {
    const l = newLearner();
    for (let i = 0; i < 20; i++) {
      const id = pickPoem(l, { chunxiao: { count: 1, first: "", last: "" } });
      expect(POEM[id].hanzi).toBeLessThanOrEqual(20); expect(id).not.toBe("chunxiao");
    }
  });
});
