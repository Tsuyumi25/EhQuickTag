// dict.json: Simplified Chinese ↔ Japanese Kanji
//   Source: manakanemu/ctoj + 京都大學 CJK 漢字對照表 (via EhSyringe dict.yml)
// t2s.json:  Traditional → Simplified Chinese (from OpenCC TSCharacters.txt, Apache-2.0)
// s2t.json:  Simplified → Traditional Chinese (from OpenCC STCharacters.txt, Apache-2.0)
// Regenerate: npx tsx scripts/gen-dict.ts / npx tsx scripts/gen-t2s.ts / npx tsx scripts/gen-s2t.ts
import CN2JP from './dict.json'
import T2S from './t2s.json'
import S2T from './s2t.json'

const cn2jp: Readonly<Record<string, readonly string[]>> = CN2JP
const jp2cn: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(cn2jp).flatMap(([k, v]) => v.map(vv => [vv, k])),
)
const t2s: Readonly<Record<string, string>> = T2S
const s2t: Readonly<Record<string, string>> = S2T

export function isASCII(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) >= 0x80) return false
  }
  return true
}

/** Convert traditional/JP kanji → CN simplified */
export function toCN(text: string): string {
  let ret = ''
  for (const ch of text) {
    ret += t2s[ch] ?? jp2cn[ch] ?? ch
  }
  return ret
}

/**
 * Convert CN simplified → Traditional Chinese (char-level, OpenCC STCharacters)
 * 一對多取第一個。沒考慮地區慣用詞（譬如「软件 → 軟件」而非台灣慣用的「軟體」）
 */
export function toTW(text: string): string {
  let ret = ''
  for (const ch of text) {
    ret += s2t[ch] ?? ch
  }
  return ret
}

const MAX_COMBINE = 16

/** Convert CN simplified → JP kanji variants (one-to-many, cartesian product) */
export function toJP(text: string): string[] {
  let res = ['']
  for (const ch of text) {
    const jp = cn2jp[ch]
    if (jp) {
      if (jp.length > 1 && res.length < MAX_COMBINE) {
        const tmp: string[] = []
        for (const r of res) {
          for (const j of jp) {
            tmp.push(r + j)
          }
        }
        res = tmp
        continue
      }
      const rep = jp[0]
      for (let i = 0; i < res.length; i++) {
        res[i] += rep
      }
    } else {
      for (let i = 0; i < res.length; i++) {
        res[i] += ch
      }
    }
  }
  return res
}
