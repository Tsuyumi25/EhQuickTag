// 讀寫 EH 的使用者設定（/uconfig.php）。
//
// ⛔ POST 這個頁面是「整份覆蓋」，不是部分更新。只送一個欄位的話，沒被送到的設定
// 全部會回到預設值——顯示模式、縮圖大小、封鎖的上傳者、收藏夾名稱都算在內。
// 所以流程必須是：先 GET 把整張表單收下來，改掉要改的那格，再整包送回去。
//
// ⚠️ 因此這裡的風險不在「送出失敗」，在「送出成功但我們漏收了某個欄位」。漏收是
// 靜默的，可能過幾天才會發現某個設定被重置。所以送完再讀一次，把不該變卻變了的
// 欄位名報出來。

const UCONFIG = '/uconfig.php'
/** EH 用這個欄位判斷「這是套用請求」。它是 submit 按鈕，不會出現在 form.elements 的值裡 */
const APPLY = ['apply', 'Apply'] as const

/**
 * 表單上所有會被送出的欄位。
 *
 * ⚠️ 值是陣列，不是字串。同一個 name 可以掛多個控制項（checkbox group、
 * `<select multiple>`），只留最後一個的話，送回去時其餘的就被清掉了——而且
 * `unexpectedChanges` 也看不到，因為它比對的兩份都是同樣被截斷的資料。
 */
export type ConfigFields = Record<string, string[]>

/**
 * 收集一張表單會送出的東西。
 *
 * 沒勾的 checkbox / radio 不送，那是 HTML 的規則，EH 讀的時候也照這個假設——所以
 * 「欄位不存在」本身就是一個值，不能補成空字串。
 */
export function collectFields(form: HTMLFormElement): ConfigFields {
  const out: ConfigFields = {}
  const push = (name: string, value: string): void => {
    (out[name] ??= []).push(value)
  }
  for (const el of Array.from(form.elements)) {
    const f = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    if (!f.name || f.disabled) continue
    const type = (f as HTMLInputElement).type
    if (type === 'submit' || type === 'button' || type === 'reset') continue
    if ((type === 'checkbox' || type === 'radio') && !(f as HTMLInputElement).checked) continue
    // ⚠️ 多選 select 的 `.value` 只給第一個選中的選項，剩下的要自己走 selectedOptions
    if (f.tagName === 'SELECT' && (f as HTMLSelectElement).multiple) {
      for (const o of Array.from((f as HTMLSelectElement).selectedOptions)) push(f.name, o.value)
      continue
    }
    push(f.name, f.value)
  }
  return out
}

function sameValues(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a || !b) return a === b
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * 送出前後的差異裡，哪些是我們沒打算動的。
 *
 * ⭐ 兩個方向都要看：欄位的值變了算，欄位整個消失或冒出來也算——checkbox 被清掉的
 * 表現就是「本來在、現在不在」，只比對共同的 key 會完全看不到它。
 */
export function unexpectedChanges(
  before: ConfigFields,
  after: ConfigFields,
  intended: string[],
): string[] {
  const skip = new Set(intended)
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  const out: string[] = []
  for (const name of names) {
    if (skip.has(name)) continue
    if (!sameValues(before[name], after[name])) out.push(name)
  }
  return out.sort()
}

async function loadForm(anchorId: string): Promise<HTMLFormElement | null> {
  const res = await fetch(UCONFIG, { credentials: 'same-origin' })
  if (!res.ok) return null
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
  // 用要改的那格反查它屬於哪張表單。設定頁上另有一張 profile 表單，不能送錯
  return doc.getElementById(anchorId)?.closest('form') ?? null
}

export type SaveResult =
  | { ok: true; clobbered: string[] }
  | { ok: false; error: string }

/**
 * 改一格設定並送出，然後重讀一次確認只有那一格變了。
 *
 * `clobbered` 非空代表送出成功、但有別的設定跟著被改掉了——那是我們漏收欄位，
 * 不是使用者做錯什麼，所以要原原本本報出來。
 */
export async function patchConfig(
  anchorId: string,
  name: string,
  value: string,
): Promise<SaveResult> {
  try {
    const form = await loadForm(anchorId)
    if (!form) return { ok: false, error: 'no-form' }

    const before = collectFields(form)
    if (!(name in before)) return { ok: false, error: `no-field-${name}` }

    const body = new URLSearchParams()
    for (const [key, values] of Object.entries(before)) {
      for (const v of (key === name ? [value] : values)) body.append(key, v)
    }
    body.append(...APPLY)
    const res = await fetch(UCONFIG, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) return { ok: false, error: `http-${res.status}` }

    const again = await loadForm(anchorId)
    // 讀不回來就沒辦法保證什麼。與其宣稱成功，不如說我們不知道
    if (!again) return { ok: false, error: 'verify-failed' }
    const after = collectFields(again)
    if (after[name]?.[0] !== value) return { ok: false, error: 'not-applied' }

    return { ok: true, clobbered: unexpectedChanges(before, after, [name]) }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
