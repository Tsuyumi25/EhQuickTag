# EhQuickTag — AI agent rules

Rules for AI coding assistants (Claude Code, Codex, Cursor, ...) working in
this repository. The document is in English; the code it describes is not —
see Language below.

## Host environment

A userscript bundled by `vite-plugin-monkey` and injected into
`e-hentai.org` and `exhentai.org` pages. We are a guest on someone else's
document, which is where most of the non-obvious constraints come from:

- **Every mount point resets its own box model.** `#eqt-app`,
  `#eqt-bar-anchor` and `#eqt-gallery-anchor` each carry a reset in
  `theme.scss`. Without it our elements inherit the host's content-box and
  its assorted offsets. A new mount point needs the same treatment.
- **Overlays teleported to `body` need `translate="no"`.** Browser
  translation extensions rewrite text nodes outside our subtree otherwise,
  which breaks both the copy and the layout.
- **The host DOM is a black box.** Its classes, inline `onclick` handlers
  and global functions were learned by observation, not from documentation.
  Record what you learn in a comment — that knowledge cannot be recovered
  by reading our source.

## Comments

- Write one only when the WHY is non-obvious: a hidden constraint, a subtle
  invariant, a workaround for a specific bug, behavior that would surprise a
  reader.
- Never explain WHAT the code does — well-named identifiers do that.
- Quirks of the host page and of browser layout count as WHY. They are the
  reason this codebase carries more comments than most.
- Traditional Chinese or English, and nothing else. Either is fine, even
  side by side in one file. Keep technical terms in their original form.

## Commit messages

- Write them in Traditional Chinese. Format: `type(scope): effect` — feat /
  fix / refactor / docs / style / perf / test / build / ci / chore.
- **The subject states the effect, not the action.** "extract X + split Y",
  "A → B" describe moves that `git diff` already shows. What the reader
  wants is what became possible once the move was made.
- Write a body only when there is a real WHY: the reasoning behind a
  decision, an invariant that now holds, an alternative that was ruled out
  and why.
- Do not narrate process ("tried X, then Y"), do not list changed files, do
  not quote test counts. The diff and CI already say those.

## Language

- Identifiers, file names, type names: English.
- Comments: Traditional Chinese or English, nothing else.
- Commit messages: Traditional Chinese.
- User-facing strings: always through i18n. `src/locales/` holds five
  locales (en / ja / ko / zh-CN / zh-TW) and **a new key must be added to
  all five** — a missing one fails silently at runtime, not at build time.

## Styles

- BEM: `eqt-<block>__<element>--<modifier>`.
- Colors, sizes and radii come from `--eqt-*` tokens defined in
  `src/styles/theme.scss`. Never hard-code a value: the light (e-hentai) and
  dark (exhentai) themes swap the same token names, so a literal breaks on
  one of the two.
- Shared button visuals go through the mixins in `src/styles/_buttons.scss`.

## Pure functions and DOM adapters

Geometry and state machines live in pure functions under `src/services/`;
Vue components are thin adapters that measure rects, feed inputs and apply
results. `spacerResize.ts` (drag-to-resize snapping) and
`gallery/dragSelectMachine.ts` (marquee selection) both have this shape.

Pure functions get unit tests. Where the invariants are hard to enumerate,
add a property test (fast-check).

## Public repository

Treat commit messages, comments, README and issues as permanent:

- No personal information, tokens, or private discussion.
- No concrete tag values as examples — tags from this platform are easy to
  misread out of context. Use an abstract stand-in ("some parody tag")
  instead; category names (female / male / parody / character) are fine.

## Setup

```
pnpm install
pnpm dev        # dev server; the URL it prints installs into a script manager
pnpm build      # vue-tsc --noEmit && vite build → dist/eh-quick-tag.user.js
pnpm test       # vitest
pnpm test:e2e   # playwright
```

Type checking runs `vue-tsc`, not bare `tsc` — the latter does not
understand `.vue` and reports phantom missing modules.

## Architecture

- `src/components/` — Vue components (`gallery/` and `search/` subdomains)
- `src/composables/` — reactive logic and host boundaries; `useEhFormHost`
  and `useEhGalleryHost` detect the page, take over native elements and hand
  back a Teleport target
- `src/services/` — pure logic and persisted state: `store` (settings and
  profiles), `tagDb` (tag database), `tagState` (three-state tags),
  `search/` (search session)
- `src/styles/` — tokens, mixins, per-area SCSS
- `src/locales/` — the five locales
- `src/utils/` — small helpers
- `scripts/` — data generation (wiki scraping, dictionary building); not
  bundled
- `tests/e2e/` — Playwright
