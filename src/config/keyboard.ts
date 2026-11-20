// 台灣標準大千式注音鍵盤。所有映射集中在這裡，鍵盤畫面與按鍵提示都由此產生。
export type KeyDef = { id: string; label: string; zy?: string; wide?: number };

export const KEY_ROWS: KeyDef[][] = [
  [
    { id: "1", label: "1", zy: "ㄅ" }, { id: "2", label: "2", zy: "ㄉ" }, { id: "3", label: "3", zy: "ˇ" },
    { id: "4", label: "4", zy: "ˋ" }, { id: "5", label: "5", zy: "ㄓ" }, { id: "6", label: "6", zy: "ˊ" },
    { id: "7", label: "7", zy: "˙" }, { id: "8", label: "8", zy: "ㄚ" }, { id: "9", label: "9", zy: "ㄞ" },
    { id: "0", label: "0", zy: "ㄢ" }, { id: "-", label: "-", zy: "ㄦ" },
    { id: "Backspace", label: "Backspace", wide: 2 },
  ],
  [
    { id: "Q", label: "Q", zy: "ㄆ" }, { id: "W", label: "W", zy: "ㄊ" }, { id: "E", label: "E", zy: "ㄍ" },
    { id: "R", label: "R", zy: "ㄐ" }, { id: "T", label: "T", zy: "ㄔ" }, { id: "Y", label: "Y", zy: "ㄗ" },
    { id: "U", label: "U", zy: "ㄧ" }, { id: "I", label: "I", zy: "ㄛ" }, { id: "O", label: "O", zy: "ㄟ" },
    { id: "P", label: "P", zy: "ㄣ" },
  ],
  [
    { id: "A", label: "A", zy: "ㄇ" }, { id: "S", label: "S", zy: "ㄋ" }, { id: "D", label: "D", zy: "ㄎ" },
    { id: "F", label: "F", zy: "ㄑ" }, { id: "G", label: "G", zy: "ㄕ" }, { id: "H", label: "H", zy: "ㄘ" },
    { id: "J", label: "J", zy: "ㄨ" }, { id: "K", label: "K", zy: "ㄜ" }, { id: "L", label: "L", zy: "ㄠ" },
    { id: ";", label: ";", zy: "ㄤ" }, { id: "Enter", label: "Enter", wide: 2 },
  ],
  [
    { id: "Shift", label: "Shift", wide: 2 },
    { id: "Z", label: "Z", zy: "ㄈ" }, { id: "X", label: "X", zy: "ㄌ" }, { id: "C", label: "C", zy: "ㄏ" },
    { id: "V", label: "V", zy: "ㄒ" }, { id: "B", label: "B", zy: "ㄖ" }, { id: "N", label: "N", zy: "ㄙ" },
    { id: "M", label: "M", zy: "ㄩ" }, { id: ",", label: ",", zy: "ㄝ" }, { id: ".", label: ".", zy: "ㄡ" },
    { id: "/", label: "/", zy: "ㄥ" },
  ],
  [
    { id: "Ctrl", label: "Ctrl" }, { id: "Win", label: "Win" }, { id: "Alt", label: "Alt" },
    { id: "Space", label: "空白鍵", wide: 6 },
    { id: "←", label: "←" }, { id: "↑", label: "↑" }, { id: "↓", label: "↓" }, { id: "→", label: "→" },
  ],
];

export const KEY_OF_SYMBOL: Record<string, string> = Object.fromEntries(
  KEY_ROWS.flat().filter(k => k.zy).map(k => [k.zy!, k.id]),
);

/** KeyboardEvent.code → 鍵盤畫面上的按鍵 id（引導練習用，code 是實體按鍵位置，不受輸入法影響）。 */
export function keyIdFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const map: Record<string, string> = {
    Minus: "-", Semicolon: ";", Comma: ",", Period: ".", Slash: "/", Space: "Space",
    ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl",
    AltLeft: "Alt", AltRight: "Alt", MetaLeft: "Win", MetaRight: "Win", Enter: "Enter",
    Backspace: "Backspace", ArrowLeft: "←", ArrowUp: "↑", ArrowDown: "↓", ArrowRight: "→",
  };
  return map[code] ?? null;
}
