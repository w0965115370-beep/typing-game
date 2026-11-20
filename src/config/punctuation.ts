// 標點符號教學設定檔：教師可修改（第二階段移到後台）。
// verified=false 表示「尚未在實際 Windows 微軟注音環境驗證」，畫面上會同時提供符號選單的方法。
export type PunctHelp = {
  name: string; stage: 1 | 2 | 3 | 4; half?: string;
  keys: string[];        // 在中文模式下的按法（鍵盤畫面用的按鍵 id）
  how: string;           // 給學生看的一句話
  verified: boolean;
};

export const PUNCT_HELP: Record<string, PunctHelp> = {
  "，": { name: "逗號", stage: 1, half: ",", keys: ["Ctrl", ","], how: "在中文模式，按住 Ctrl 再按 , 鍵（逗號鍵）", verified: true },
  "。": { name: "句號", stage: 1, half: ".", keys: ["Ctrl", "."], how: "在中文模式，按住 Ctrl 再按 . 鍵（句點鍵）", verified: false },
  "、": { name: "頓號", stage: 2, keys: [], how: "可以用輸入法的符號表選取「、」", verified: false },
  "？": { name: "問號", stage: 2, half: "?", keys: ["Ctrl", "Shift", "/"], how: "在中文模式，按住 Ctrl 和 Shift 再按 / 鍵", verified: false },
  "！": { name: "驚嘆號", stage: 2, half: "!", keys: ["Ctrl", "Shift", "1"], how: "在中文模式，按住 Ctrl 和 Shift 再按 1 鍵", verified: false },
  "：": { name: "冒號", stage: 3, half: ":", keys: ["Ctrl", "Shift", ";"], how: "在中文模式，按住 Ctrl 和 Shift 再按 ; 鍵", verified: false },
  "；": { name: "分號", stage: 3, half: ";", keys: [], how: "可以用輸入法的符號表選取「；」", verified: false },
  "「": { name: "上引號", stage: 3, keys: [], how: "可以用輸入法的符號表選取「「」", verified: false },
  "」": { name: "下引號", stage: 3, keys: [], how: "可以用輸入法的符號表選取「」」", verified: false },
};

/** 快捷鍵無效時的替代方法（微軟注音的符號表）。 */
export const SYMBOL_MENU_HELP =
  "如果按了沒有出現中文標點：在中文模式下按一下鍵盤左上角的 ` 鍵（數字 1 左邊），會出現符號清單，再用滑鼠或數字選擇。" +
  "不同電腦的輸入法版本可能不一樣，找不到時請舉手問老師。";
