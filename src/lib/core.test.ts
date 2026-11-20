import { describe, it, expect } from "vitest";
import { pinyinToZhuyin, zhuyinToKeys, splitZhuyin } from "./zhuyin.ts";
import { KEY_ROWS, KEY_OF_SYMBOL, keyIdFromCode } from "../config/keyboard.ts";
import { evaluate, ErrorCounter } from "./typing.ts";
import { analyze, Cooldown } from "./ime.ts";
import { POEMS, PRACTICE, LEVELS, scoreOf, type TaskResult } from "./learning.ts";
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

describe("關卡與計分", () => {
  const r = (o: Partial<TaskResult>): TaskResult => ({ hanzi: 20, punct: 4, ms: 120000, maxHint: 0, firstTry: 24, positions: 24, punctErrors: 0, halfwidth: 0, hints: {}, ime: {}, mistakes: {}, ...o });
  it("45 首詩都是關卡，由短到長，問號驚嘆號的詩排在後面", () => {
    expect(LEVELS).toHaveLength(POEMS.length);
    expect(LEVELS[0].hanzi).toBe(Math.min(...POEMS.map(p => p.hanzi)));
    const firstStage2 = LEVELS.findIndex(p => p.punctStage === 2);
    expect(LEVELS.slice(firstStage2).every(p => p.punctStage === 2)).toBe(true);
    for (let i = 1; i < firstStage2; i++) expect(LEVELS[i].hanzi).toBeGreaterThanOrEqual(LEVELS[i - 1].hanzi);
  });
  it("全部第一次就打對：3 顆星，分數＝字數×15＋速度獎勵", () => {
    const s = scoreOf(r({}));
    expect(s.stars).toBe(3); expect(s.cpm).toBe(10); expect(s.speed).toBe(50);
    expect(s.total).toBe(24 * 10 + 24 * 5 + 50);
  });
  it("星星看第一次就打對的比例", () => {
    expect(scoreOf(r({ firstTry: 20 })).stars).toBe(2);   // 83%
    expect(scoreOf(r({ firstTry: 18 })).stars).toBe(1);   // 75%
  });
  it("速度獎勵最多 100 分，用提示不扣分", () => {
    expect(scoreOf(r({ ms: 10000 })).speed).toBe(100);
    expect(scoreOf(r({ maxHint: 4 })).total).toBe(scoreOf(r({})).total);
  });
});
