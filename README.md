# EhQuickTag

[繁體中文](README.zh-TW.md) | [Sleazy Fork](https://sleazyfork.org/zh-TW/scripts/578820-eh-quick-tag)

A customizable quick tag bar and Gallery tagging toolkit for E-Hentai / ExHentai.

> [!CAUTION]
> Early development. Data formats (profiles, settings, etc.) may change in future versions and require reconfiguration.

[tag-bar-and-search-panel.webm](https://github.com/user-attachments/assets/f3db2250-dc81-4e15-b50c-1555502debbb)

[gallery-tagging.webm](https://github.com/user-attachments/assets/77448a48-2d9c-485c-aa8c-81d14e806e95)

## Features

- [x] Quick tag bar
  - [x] Include, OR, and Exclude search states
  - [x] Tag rows, separators, and cross-row dragging
  - [x] Separator text, line style, position, size, and alignment
  - [x] URL shortcuts
  - [x] EH search syntax editor
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
