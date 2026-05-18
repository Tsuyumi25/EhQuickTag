/**
 * Generate dict.json (Simplified Chinese ↔ Japanese Kanji character map)
 * Original source: manakanemu/ctoj + 京都大學 CJK 漢字對照表
 * Fetched via: EhSyringe dict.yml
 * https://github.com/EhTagTranslation/EhSyringe/blob/master/src/plugin/suggest/dict.yml
 *
 * Usage: npx tsx scripts/gen-dict.ts
 */

const URL = 'https://raw.githubusercontent.com/EhTagTranslation/EhSyringe/master/src/plugin/suggest/dict.yml'
const OUT = 'src/services/dict.json'

async function main() {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  const text = await res.text()

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

  const { writeFileSync } = await import('fs')
  writeFileSync(OUT, JSON.stringify(map))
  console.log(`wrote ${OUT}: ${Object.keys(map).length} entries`)
}

main()
