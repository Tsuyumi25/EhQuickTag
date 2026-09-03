# EhQuickTag

[English](README.md) | [Sleazy Fork](https://sleazyfork.org/zh-TW/scripts/578820-eh-quick-tag)

E-Hentai / ExHentai 的可自訂快捷標籤列與 Gallery 標籤工具。

[tag-bar-and-search-panel.webm](https://github.com/user-attachments/assets/f3db2250-dc81-4e15-b50c-1555502debbb)

[gallery-tagging.webm](https://github.com/user-attachments/assets/77448a48-2d9c-485c-aa8c-81d14e806e95)

## 截圖

一般模式
<img width="1857" height="1295" alt="一般模式" src="https://github.com/user-attachments/assets/a60eddbb-692d-4620-9411-99c66ad221a1" />

編輯模式
<img width="2232" height="1226" alt="編輯模式" src="https://github.com/user-attachments/assets/caba3961-3067-48fa-b2f5-aa203dfac410" />

標籤編輯器
<img width="2078" height="992" alt="標籤編輯器" src="https://github.com/user-attachments/assets/16f28de7-dd27-4d94-a4ff-468234c795af" />

連結按鈕編輯器
<img width="2067" height="1272" alt="連結按鈕編輯器" src="https://github.com/user-attachments/assets/d2bbc76a-615b-42a4-872e-9fa6b219d898" />

標籤瀏覽器
<img width="2366" height="2008" alt="標籤瀏覽器" src="https://github.com/user-attachments/assets/6ed46053-80c7-4df9-a56b-4e92e21659c8" />

Gallery Tagging Enhancer
<img width="1454" height="831" alt="Gallery Tagging Enhancer" src="https://github.com/user-attachments/assets/2335e64e-3655-42df-b884-b10e68d321e9" />

## 功能

- [x] 快捷標籤列
  - [x] Include、OR、Exclude 搜尋狀態切換
  - [x] 標籤行、分隔線與跨行拖曳
  - [x] 分隔線文字、線型、位置、尺寸與對齊
  - [x] 行內間隔與彈簧，可拖曳調寬並跨行吸附對齊
  - [x] EH 搜尋語法編輯器
- [x] 連結按鈕
  - [x] 以分類、關鍵字與進階選項組出 EH 搜尋網址
  - [x] 一鍵帶入當前頁面的搜尋條件
  - [x] 連結自動跟隨當前所在的表 / 裡站
- [x] 搜尋面板
  - [x] 視覺化目前搜尋條件
  - [x] 跨頁搜尋歷史
  - [x] 將搜尋條件拖回快捷標籤列
- [x] 標籤資料
  - [x] 整合 [EhTagTranslation/Database](https://github.com/EhTagTranslation/Database) 標籤資料，支援繁中、簡中、日文與英文搜尋
  - [x] 全站標籤使用量統計，依 Gallery 數量排序建議
  - [x] 整合 [ehwiki](https://ehwiki.org/) 標籤定義，在 Gallery 查看中英文說明
  - [x] OpenCC 繁簡顯示轉換
- [x] Gallery Tagging Enhancer
  - [x] 左鍵、右鍵與拖曳選取
  - [x] 批次投票與批次搜尋
  - [x] 內嵌新增標籤 picker
  - [x] Gallery Tagging Wiki 快捷連結
- [x] 個人化
  - [x] 多組獨立標籤配置
  - [x] 標籤組排序、改名、回收桶與 JSON 編輯器
  - [x] 行與按鈕顏色
  - [x] 按鈕樣式與自訂字體
  - [x] 標籤列與 Gallery 雙擊動作
  - [x] E-Hentai 與 ExHentai
  - [x] 繁體中文、簡體中文、英文、日文與韓文介面

## 安裝

需要 [Tampermonkey](https://www.tampermonkey.net/) 或相容的 userscript 管理器。

- [x] [Sleazy Fork](https://sleazyfork.org/zh-TW/scripts/578820-eh-quick-tag)
- [x] [GitHub Releases](https://github.com/Tsuyumi25/EhQuickTag/releases)

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
- [EhTagTranslation/EhSyringe](https://github.com/EhTagTranslation/EhSyringe) — 搜尋排序權重邏輯參考（MIT）
- [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC) — 繁簡轉換字表資料（Apache-2.0）
- [URenko/e-hentai-db](https://github.com/URenko/e-hentai-db) — EH metadata nightly SQLite（本 repo tag count 的資料源）

## 靈感來源

- [Add button on exhentai searchbox](https://sleazyfork.org/scripts/454282)
- [ExAdvancedSearchMemo](https://sleazyfork.org/scripts/454209)
- [Lolicon E-Hentai/ExHentai Enhancer](https://sleazyfork.org/scripts/516145)
- [sk2589822/Exhentai-Enhancer](https://github.com/sk2589822/Exhentai-Enhancer) — 技術棧參考
- [mokurin000/e-hentai-tag-count](https://github.com/mokurin000/e-hentai-tag-count)

## 授權

MIT
