---
name: release
description: Release EhQuickTag when the user asks for one (發版, "release 0.x.y"). Drafts bilingual English + Traditional Chinese GitHub release notes for review, then tags and publishes after the user confirms.
compatibility: Needs jj colocated with git, gh authenticated for this repository, and pnpm.
---

# Release

A release happens when the user asks for one. The user reviews the notes as text in the conversation; the draft stage stays read-only, and tagging waits for the word 確定.

## 1. Draft

1. Find the range: the previous tag is `git describe --tags --abbrev=0 main`, the changes are `<previous tag>..main`.
2. Read the diff of every commit a user could notice. A later commit often overrides an earlier one in the same range, so describe the final state, and grep the code before claiming a behaviour.
3. Check `src/services/store.ts` for settings renamed or dropped without migration: users lose those values, or get defaults back, on update.
4. Pick the version: the one the user names, otherwise a proposal (`feat` → minor, `fix` → patch, pointing out any `!`).
5. Show the version and the full notes in the conversation, written to the rules and format below. Keep this stage to reading and the conversation: files, tags and GitHub stay untouched.

Done when every commit in the range is either covered by a line or knowingly left out, and the user has the version and both languages in front of them.

## 2. Notes

### Rules

Based on [Common Changelog](https://common-changelog.org/) section 3, trimmed for people who use the userscript rather than develop it.

- One line per change, opening with a verb: Add, Show, Remove, Fix… In Chinese, a short phrase that opens with the action.
- Groups in this order, empty ones omitted: `Changed`, `Added`, `Removed`, `Fixed` / `變更`, `新增`, `移除`, `修正`.
- A breaking change goes first in its group, marked `**Breaking:**` / `**破壞性：**`.
- Merge commits that make one change and drop changes a later commit undid: describe the difference from the previous release.
- Keep to what users notice. Refactors, tests, CI, internal cleanup and small editor details stay out.
- Name UI elements with the labels in `src/locales/en.ts` and `src/locales/zh-TW.ts`.
- Each line states the new behaviour on its own: commit links, history of the old behaviour and concrete tag values stay out (AGENTS.md, Public repository).

### Format

English first, then a `<!-- lang:zh -->` line, then Traditional Chinese, with the same lines in the same order. The release title already shows the version, so the body opens with the first group.

```markdown
### Changed

- **Breaking:** <verb> <what users now experience>
- <verb> <what changed>

### Added

- <verb> <new capability, with the label users see>

<!-- lang:zh -->

### 變更

- **破壞性：** <動作開頭，用戶現在會遇到的行為>
- <動作開頭，改了什麼>

### 新增

- <動作開頭，新功能，用畫面上的名稱>
```

## 3. Publish — after the user says 確定

1. Check the starting point: `jj st` shows an empty working copy whose parent is `main`, and `git rev-parse --abbrev-ref 'main@{upstream}'` prints `origin/main`. release-it needs a clean tree and an upstream, and its `before:init` hook runs `git switch main`.
2. Run `pnpm release <version> --ci`. It bumps `package.json`, commits `Release <version>`, tags `v<version>` and pushes; `.release-it.json` leaves the GitHub release to the workflow the tag starts.
3. Wait for that run: `gh run list --workflow release.yml --branch v<version> --limit 1` gives its id (a tag run's branch is the tag name), then `gh run watch <id> --exit-status`.
4. Write the confirmed notes to a file under `/tmp` and run `gh release edit v<version> --notes-file <file>`, replacing the compare link the workflow generated.
5. Finish with `jj new main`, so the next change starts on top of the release commit.

Done when `gh release view v<version>` shows the confirmed notes and both assets, `eh-quick-tag.user.js` and `eh-quick-tag.meta.js`.
