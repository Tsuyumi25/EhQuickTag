# EhQuickTag

[繁體中文](README.zh-TW.md)

A customizable quick tag bar for E-Hentai / ExHentai search.

Adds a tag bar above the search box. Click to combine search conditions, with tag database search, multiple profiles, and drag-and-drop reordering.

![screenshot](docs/screenshot.png)

## Features

- **Quick tag bar**: Click to toggle three states (include / OR / exclude), synced with the search box in real time
- **Tag database search**: Integrates [EhTagTranslation](https://github.com/EhTagTranslation/Database) — search tags in Chinese (Traditional/Simplified), Japanese, or English, with nhentai popularity weighting
- **Multiple profiles**: Create multiple tag configurations, quick switch, with recycle bin and JSON editor
- **URL buttons**: Custom shortcuts to frequently used search pages
- **Drag-and-drop**: Reorder tags across rows, reorder rows, reorder profiles
- **Background double-click search**: Left/right double-click on tag bar background to trigger search, actions are configurable
- **Custom font**: Choose font-family and weight
- **Persistent data**: Stored in GM storage, supports Tampermonkey backup/sync
- **Supports both** e-hentai.org and exhentai.org
- **i18n**: Traditional Chinese, Simplified Chinese, English, Japanese

## Install

Requires [Tampermonkey](https://www.tampermonkey.net/) or a compatible userscript manager.

- [Sleazy Fork](https://sleazyfork.org/zh-TW/scripts/578820-eh-quick-tag)
- [GitHub Releases](https://github.com/Tsuyumi25/EhQuickTag/releases)

> ⚠️ Under active development. Data formats (profiles, settings, etc.) may change in future versions, which could require reconfiguration.

## Development

```bash
git clone https://github.com/Tsuyumi25/EhQuickTag.git
cd EhQuickTag
pnpm install
pnpm dev       # Start dev server, browser will auto-install the dev userscript
pnpm build     # Output dist/eh-quick-tag.user.js
```

## Tech Stack

- TypeScript + Vue 3 + Vite
- [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey)
- [vuedraggable](https://github.com/SortableJS/vue.draggable.next)

## Credits

- [EhTagTranslation/Database](https://github.com/EhTagTranslation/Database) — Tag translation database (CC BY-NC-SA 3.0)
- [EhSyringe](https://github.com/EhTagTranslation/EhSyringe) — Search ranking logic reference (MIT)
- [OpenCC](https://github.com/BYVoid/OpenCC) — CJK character mapping data (Apache-2.0)

## Inspiration

- [Add button on exhentai searchbox](https://sleazyfork.org/scripts/454282)
- [ExAdvancedSearchMemo](https://sleazyfork.org/scripts/454209)
- [Lolicon E-Hentai/ExHentai Enhancer](https://sleazyfork.org/scripts/516145)
- [Exhentai-Enhancer](https://github.com/sk2589822/Exhentai-Enhancer) — Tech stack reference

## License

MIT
