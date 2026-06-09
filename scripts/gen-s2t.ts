/**
 * Generate s2t.json (Simplified Chinese → Traditional Chinese character map)
 * Source: OpenCC STCharacters.txt (Apache-2.0)
 * https://github.com/BYVoid/OpenCC/blob/master/data/dictionary/STCharacters.txt
 *
 * Usage: npx tsx scripts/gen-s2t.ts
 *
 * Note: STCharacters 是 char-level 對照（簡 → 繁可能一對多，本 script 取第一個）。
 * 沒考慮地區慣用詞（簡 -> 繁台灣／繁香港 不同），純粹做字面繁化。如果未來要走
 * 「台灣慣用詞」更精準，要改用 s2twp / s2t.json + TWPhrases 一系列詞表。
 */

const URL = 'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/STCharacters.txt'
const OUT = 'src/services/s2t.json'

async function main() {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  const text = await res.text()

  const map: Record<string, string> = {}
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const [simp, trads] = line.split('\t')
    if (!simp || simp.length !== 1 || !trads) continue
    const trad = trads.split(' ')[0]
    if (trad.length === 1 && trad !== simp) map[simp] = trad
  }

  const { writeFileSync } = await import('fs')
  writeFileSync(OUT, JSON.stringify(map))
  console.log(`wrote ${OUT}: ${Object.keys(map).length} entries`)
}

main()
