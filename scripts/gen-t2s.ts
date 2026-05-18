/**
 * Generate t2s.json (Traditional Chinese → Simplified Chinese character map)
 * Source: OpenCC TSCharacters.txt (Apache-2.0)
 * https://github.com/BYVoid/OpenCC/blob/master/data/dictionary/TSCharacters.txt
 *
 * Usage: npx tsx scripts/gen-t2s.ts
 */

const URL = 'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSCharacters.txt'
const OUT = 'src/services/t2s.json'

async function main() {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  const text = await res.text()

  const map: Record<string, string> = {}
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const [trad, simps] = line.split('\t')
    if (!trad || trad.length !== 1 || !simps) continue
    const simp = simps.split(' ')[0]
    if (simp.length === 1 && simp !== trad) map[trad] = simp
  }

  const { writeFileSync } = await import('fs')
  writeFileSync(OUT, JSON.stringify(map))
  console.log(`wrote ${OUT}: ${Object.keys(map).length} entries`)
}

main()
