# 打字開心農場 Typing Farm

給台灣國小三年級的中文打字 × 農場經營網頁遊戲。用滑鼠種菜，再用注音輸入法一次打完一整首詩＝過一天：菜長大、成熟的自動換金幣，詩收進圖鑑。

目前是 **第一階段（本機存檔版）**：可完整遊玩，進度存在瀏覽器的 localStorage。正式課堂使用需要第二階段的雲端存檔與帳號（見 DEVELOPMENT_PLAN.md）。

網址：https://w0965115370-beep.github.io/typing-game/

## 本機啟動

需要 Node.js 20 以上。

```bash
npm install
npm run dev        # 開發伺服器 http://localhost:5173/typing-game/
npm test           # 自動化測試（75 項）
npm run build      # 產生 dist/
npm run poems      # 修改 scripts/poems-source.ts 後，重新產生題庫與注音
```

推送到 `main` 後，GitHub Actions 會自動建置並發布到 GitHub Pages。

## 專案結構

| 路徑 | 內容 |
|---|---|
| `src/lib/typing.ts` | 打字比對引擎（TypingEngine） |
| `src/lib/ime.ts` | 輸入法行為分析（IMEBehaviorAnalyzer） |
| `src/lib/zhuyin.ts` | 拼音轉注音、注音轉大千式按鍵 |
| `src/components/Zhuyin.tsx` | 逐字直式注音排版（ZhuyinRenderer） |
| `src/components/Keyboard.tsx` | 注音虛擬鍵盤、動態示範、引導練習 |
| `src/components/TypingPanel.tsx` | 打字工作區、分級提示（HintManager）、標點教學（PunctuationTutor） |
| `src/lib/learning.ts` | 題庫、適性學習、詩歌收藏、學習紀錄 |
| `src/lib/farm.ts` | 農場規則與經濟（FarmingEngine / EconomyManager） |
| `src/lib/save.ts` | 存檔（SaveManager，第二階段替換成雲端） |
| `src/config/` | 經濟數值、提示門檻、標點教學、鍵盤映射 |
| `scripts/` | 題庫原始資料與注音產生程式 |

其他文件：GAME_DESIGN.md、DEVELOPMENT_PLAN.md、TYPING_ENGINE_SPEC.md、IME_COMPATIBILITY.md、TEACHER_GUIDE.md、TEST_REPORT.md、ASSET_LICENSES.md。
