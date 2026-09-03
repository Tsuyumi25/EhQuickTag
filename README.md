# EhQuickTag

[繁體中文](README.zh-TW.md) | [Sleazy Fork](https://sleazyfork.org/zh-TW/scripts/578820-eh-quick-tag)

A customizable quick tag bar and Gallery tagging toolkit for E-Hentai / ExHentai.

[tag-bar-and-search-panel.webm](https://github.com/user-attachments/assets/f3db2250-dc81-4e15-b50c-1555502debbb)

[gallery-tagging.webm](https://github.com/user-attachments/assets/77448a48-2d9c-485c-aa8c-81d14e806e95)

## Screenshots

Normal mode
<img width="1857" height="1295" alt="Normal mode" src="https://github.com/user-attachments/assets/a60eddbb-692d-4620-9411-99c66ad221a1" />

Edit mode
<img width="2232" height="1226" alt="Edit mode" src="https://github.com/user-attachments/assets/caba3961-3067-48fa-b2f5-aa203dfac410" />

Tag editor
<img width="2078" height="992" alt="Tag editor" src="https://github.com/user-attachments/assets/16f28de7-dd27-4d94-a4ff-468234c795af" />

Link button editor
<img width="2067" height="1272" alt="Link button editor" src="https://github.com/user-attachments/assets/d2bbc76a-615b-42a4-872e-9fa6b219d898" />

Tag browser
<img width="2366" height="2008" alt="Tag browser" src="https://github.com/user-attachments/assets/6ed46053-80c7-4df9-a56b-4e92e21659c8" />

Gallery Tagging Enhancer
<img width="1454" height="831" alt="Gallery Tagging Enhancer" src="https://github.com/user-attachments/assets/2335e64e-3655-42df-b884-b10e68d321e9" />

## Features

- [x] Quick tag bar
  - [x] Include, OR, and Exclude search states
  - [x] Tag rows, separators, and cross-row dragging
  - [x] Separator text, line style, position, size, and alignment
  - [x] Inline gaps and springs, drag-resizable with cross-row snapping
  - [x] EH search syntax editor
- [x] Link buttons
  - [x] Build EH search URLs from categories, keywords, and advanced options
  - [x] Fill in the current page's search conditions in one click
  - [x] Links follow whichever site you are on (e-hentai / exhentai)
- [x] Search panel
  - [x] Visual search terms
  - [x] Cross-page search history
  - [x] Drag search terms back into the quick tag bar
- [x] Tag data
  - [x] [EhTagTranslation/Database](https://github.com/EhTagTranslation/Database) integration for tag search in Traditional Chinese, Simplified Chinese, Japanese, and English
  - [x] Site-wide tag usage statistics for ranking suggestions by Gallery count
  - [x] [ehwiki](https://ehwiki.org/) tag definition integration with Chinese and English descriptions on Gallery pages
  - [x] OpenCC Simplified/Traditional display conversion
- [x] Gallery Tagging Enhancer
  - [x] Left-click, right-click, and drag selection
  - [x] Batch voting and batch search
  - [x] Inline add-tag picker
  - [x] Gallery Tagging Wiki shortcut
- [x] Personalization
  - [x] Multiple independent tag profiles
  - [x] Profile ordering, renaming, trash, and JSON editor
  - [x] Row and button colors
  - [x] Button styles and custom fonts
  - [x] Configurable tag bar and Gallery double-click actions
  - [x] E-Hentai and ExHentai support
  - [x] Traditional Chinese, Simplified Chinese, English, Japanese, and Korean UI

## Install

Requires [Tampermonkey](https://www.tampermonkey.net/) or a compatible userscript manager.

- [x] [Sleazy Fork](https://sleazyfork.org/zh-TW/scripts/578820-eh-quick-tag)
- [x] [GitHub Releases](https://github.com/Tsuyumi25/EhQuickTag/releases)

## Development

```bash
git clone https://github.com/Tsuyumi25/EhQuickTag.git
cd EhQuickTag
pnpm install
pnpm dev       # Start dev server; the browser will auto-install the dev userscript
pnpm build     # Output dist/eh-quick-tag.user.js
```

## Tech Stack

- TypeScript + Vue 3 + Vite
- [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)
- [vuedraggable](https://github.com/SortableJS/vue.draggable.next)

## Credits

- [EhTagTranslation/Database](https://github.com/EhTagTranslation/Database) — Tag translation database (CC BY-NC-SA 3.0)
- [EhTagTranslation/EhSyringe](https://github.com/EhTagTranslation/EhSyringe) — Search ranking logic reference (MIT)
- [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC) — CJK character mapping data (Apache-2.0)
- [URenko/e-hentai-db](https://github.com/URenko/e-hentai-db) — Nightly EH metadata SQLite (source for the tag count weight)

## Inspiration

- [Add button on exhentai searchbox](https://sleazyfork.org/scripts/454282)
- [ExAdvancedSearchMemo](https://sleazyfork.org/scripts/454209)
- [Lolicon E-Hentai/ExHentai Enhancer](https://sleazyfork.org/scripts/516145)
- [sk2589822/Exhentai-Enhancer](https://github.com/sk2589822/Exhentai-Enhancer) — Tech stack reference
- [mokurin000/e-hentai-tag-count](https://github.com/mokurin000/e-hentai-tag-count)

## License

MIT
