/**
 * Generate cjk-dict.json.gz: { version, cn2jp, t2s, s2t } character maps for CJK search and display
 *
 * cn2jp: Simplified Chinese → Japanese Kanji
 *   Original source: manakanemu/ctoj + 京都大學 CJK 漢字對照表, fetched via EhSyringe dict.yml
 *   https://github.com/EhTagTranslation/EhSyringe/blob/master/src/plugin/suggest/dict.yml
 * t2s: Traditional → Simplified Chinese, OpenCC TSCharacters.txt (Apache-2.0)
 * s2t: Simplified → Traditional Chinese, OpenCC STCharacters.txt (Apache-2.0)
 *   https://github.com/BYVoid/OpenCC/tree/master/data/dictionary
 *
 * Usage: npx tsx scripts/gen-cjk-dict.ts <out.json.gz>
 * CI 每月跑一次並推到 data 分支的 cjk-dict/（.github/workflows/cjk-dict.yml）
 */

import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const SCHEMA_VERSION = 1

const SOURCES = {
  cn2jp: 'https://raw.githubusercontent.com/EhTagTranslation/EhSyringe/master/src/plugin/suggest/dict.yml',
  t2s: 'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSCharacters.txt',
  s2t: 'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/STCharacters.txt',
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  return res.text()
}

function parseCn2Jp(text: string): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^"?(.)(?:")?:\s*\[(.+)]$/)
    if (!match) continue
    const [, cn, values] = match
    const jp = values
      .split(',')
      .map(v => v.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
    if (jp.length) map[cn] = jp
  }
  return map
}

// OpenCC 的 *Characters.txt 是逐字對照，一對多時取第一個。沒考慮地區慣用詞（簡 → 繁台灣／繁香港不同），
// 純粹做字面轉換；要「台灣慣用詞」得改用 s2twp 那一系列詞表
function parseOpenCcCharacters(text: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const [from, tos] = line.split('\t')
    if (!from || from.length !== 1 || !tos) continue
    const to = tos.split(' ')[0]
    if (to.length === 1 && to !== from) map[from] = to
  }
  return map
}

async function main() {
  const out = process.argv[2]
  if (!out) throw new Error('usage: gen-cjk-dict.ts <out.json.gz>')
  const [cn2jp, t2s, s2t] = await Promise.all([
    fetchText(SOURCES.cn2jp).then(parseCn2Jp),
    fetchText(SOURCES.t2s).then(parseOpenCcCharacters),
    fetchText(SOURCES.s2t).then(parseOpenCcCharacters),
  ])
  writeFileSync(out, gzipSync(JSON.stringify({ version: SCHEMA_VERSION, cn2jp, t2s, s2t })))
  console.log(`wrote ${out}: cn2jp ${Object.keys(cn2jp).length}, t2s ${Object.keys(t2s).length}, s2t ${Object.keys(s2t).length}`)
}

main()
