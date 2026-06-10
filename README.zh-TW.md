# EhQuickTag

[English](README.md) | [Sleazy Fork](https://sleazyfork.org/zh-TW/scripts/578820-eh-quick-tag)

> ⚠️ 早期開發中，資料格式（標籤組、設定等）在未來版本可能不相容，屆時可能需要重新設定。

![screenshot](docs/screenshot.png)

E-Hentai / ExHentai 搜尋快捷標籤列。

在搜尋框上方加入可自訂的快捷標籤列，點擊就能組合搜尋條件；另附搜索欄面板，把當前搜尋條件呈現成可點按、可拖回標籤列的按鈕，並保留跨頁搜尋歷史。

## 功能

### 快捷標籤列

- **三態切換**：點擊每顆按鈕在 加入 / OR / 排除 之間循環，即時與原生搜尋框同步；左右鍵可分別配置
- **行（Line）配置**：
  - 標籤行 / 分隔線行兩種，可自由穿插
  - 整行可拖曳排序、可上色，標籤可跨行拖曳
  - 分隔線可命名，可調整實線／虛線／無線、位置（上／中／下）、線長、粗細、文字大小與對齊
- **網址按鈕**：把常用搜尋頁面收成按鈕，支援自動抓取網頁標題
- **背景雙擊**：標籤列空白處左／右鍵雙擊可觸發搜尋或清空搜尋框，動作可自訂

### 搜索欄面板

- **視覺化當前搜尋**：把搜尋框裡的條件拆成按鈕呈現，可一鍵切換 加入 / OR / 排除
- **拖回標籤列**：把常用搜尋詞直接拖進標籤列，永久變成快捷按鈕
- **跨頁搜尋歷史**：自動記錄搜尋過的詞，再次搜尋時一鍵帶入；可關閉以保護隱私
- **工具列**：搜尋、清空搜尋框、清除歷史、「+ 尋找標籤」（從標籤資料庫挑一個加入當前搜尋）
- **顯示語言**：自動 / 中英可切換 / 純英文；「中英可切換」模式時會多一顆中／EN 切換鈕

### 標籤資料庫搜尋

- 整合 [EhTagTranslation](https://github.com/EhTagTranslation/Database)，支援中文（繁／簡）、日文、英文搜尋
- **nhentai 人氣權重**：可開關，啟用時上傳量高的標籤優先呈現
- **OpenCC 繁簡轉換**：中文翻譯可選 自動 / 繁體 / 簡體（DB 原文）
- **Namespace 順序與可見性**：自訂 namespace 排序權重，可隱藏不感興趣的類別
- **資料庫鏡像與快取**：可選 CDN 鏡像、調整快取天數、手動立即更新

### 標籤按鈕設定

![tag settings](docs/tag_settings.png)

- **完整語法編輯器**：namespace（長／短形式）、限定詞、精確搜尋（`$`）、萬用字元（`*`）等
- **顯示名稱**：與標籤語法分離，可在按鈕上顯示自訂文字
- **左右鍵循環模式**：圖形化編輯每個鍵的狀態循環，並會標出無法在 e站搜尋文法表達的形狀

### 外觀

![color picker](docs/color_feature.png)

- **四種按鈕樣式預設**：預設、下方陰影、右下陰影、立體按壓
- **兩層顏色**：行可上色、按鈕也可單獨上色；可選擇選中時是否一律覆蓋為綠色
- **自訂字體**：自選 font-family 與字重，僅作用於本元件不外溢

### 多標籤組

- 建立多組獨立配置，一鍵切換、可拖曳排序、可命名
- **回收桶**：刪除後可救回，亦可永久刪除
- **JSON 編輯器**：直接匯入／匯出設定，無法解析的資料會收進「損壞的資料」區
- **資料持久化**：存於 GM storage，可隨 Tampermonkey 備份／同步

### 站點與語言

- 同時支援 **e-hentai.org** 與 **exhentai.org**
- 介面語言：**繁體中文、簡體中文、英文、日文**

## 安裝

需要 [Tampermonkey](https://www.tampermonkey.net/) 或相容的 userscript 管理器，並到 [Sleazy Fork](https://sleazyfork.org/zh-TW/scripts/578820-eh-quick-tag) 或 [GitHub Releases](https://github.com/Tsuyumi25/EhQuickTag/releases) 安裝。

## 開發

```bash
git clone https://github.com/Tsuyumi25/EhQuickTag.git
cd EhQuickTag
pnpm install
pnpm dev       # 啟動 dev server，瀏覽器會自動安裝開發用 userscript
pnpm build     # 產出 dist/eh-quick-tag.user.js
```

## 技術棧

- TypeScript + Vue 3 + Vite
- [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)
- [vuedraggable](https://github.com/SortableJS/vue.draggable.next)

## 致謝

- [EhTagTranslation/Database](https://github.com/EhTagTranslation/Database) — 標籤中文翻譯資料庫（CC BY-NC-SA 3.0）
- [EhSyringe](https://github.com/EhTagTranslation/EhSyringe) — 搜尋排序權重邏輯參考（MIT）
- [OpenCC](https://github.com/BYVoid/OpenCC) — 繁簡轉換字表資料（Apache-2.0）

## 靈感來源

- [Add button on exhentai searchbox](https://sleazyfork.org/scripts/454282)
- [ExAdvancedSearchMemo](https://sleazyfork.org/scripts/454209)
- [Lolicon E-Hentai/ExHentai Enhancer](https://sleazyfork.org/scripts/516145)
- [Exhentai-Enhancer](https://github.com/sk2589822/Exhentai-Enhancer) — 技術棧參考

## 授權

MIT
