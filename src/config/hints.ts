// 提示觸發門檻（第二階段由教師後台修改，第一階段集中在這裡）。
export const HINTS = {
  level1Errors: 2,   // 同一位置連錯 2 次 → 放大字形與注音
  level2Errors: 3,   // 連錯 3 次 → 按鍵順序
  level3Errors: 5,   // 連錯 5 次 → 動態鍵盤示範
  askAfterSec: 10,   // 停在同一字 10 秒 → 問「需要提示嗎？」
  keysAfterSec: 20,  // 20 秒 → 按鍵順序
  demoAfterSec: 35,  // 35 秒 → 動態示範
  englishLetters: 2, // 連續提交幾個英文字母就提醒切換輸入法
  cooldownSec: 15,   // 同一種輸入法提醒的冷卻時間
  demoStepMs: 700,   // 鍵盤示範每一鍵停留時間
};
