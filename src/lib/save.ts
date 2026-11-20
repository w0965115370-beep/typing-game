// 本機存檔（第一階段測試用）。介面刻意只有 load/save 兩個函式，
// 第二階段換成雲端存檔時只需替換這個檔案。
// shortcut: 用 localStorage，電腦教室若有還原卡會被清除；正式上課前要換成雲端存檔（Phase 2）。
const KEY = "typing-farm-save";
export const SAVE_VERSION = 3;

export function loadSave<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s?.version === SAVE_VERSION ? (s.data as T) : null;
  } catch { return null; }
}

export function writeSave(data: unknown): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), data }));
    return true;
  } catch { return false; }
}

export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* 無法存取就算了 */ } }
