// /mytags host：偵測頁面 → 讀標籤列 → 遮蔽原生 UI → inject anchor。
//
// ⚠️ 頁面上只有「當前選中那一組」的標籤，但 EH 計分時是把所有啟用中的標籤集
// 當成合併成一組來算（見 ehwiki My Tags 的 Quirks 一節）。所以面板要拿到正確
// 的分數，必須另外把其他組抓回來。
//
// ⭐ 遮蔽原生 UI 之後，原生輸入框就沒有人會去動了——它們的值等同「已存值」。
// 使用者的編輯住在我們自己的 pending 裡，兩者比對就知道有什麼還沒套用。

import { postMassAction } from '@/services/mytagsApi'

/** 一組的容量。Gold Star+ 可開 10 組，每組都是這個數 */
export const TAGSET_CAPACITY = 100

export interface MyTagRow {
  /** EH 的 tagid。setusertag 用它定位，跨標籤集唯一 */
  id: number
  full: string
  weight: number
  hidden: boolean
  watch: boolean
  color: string
  /** 這個標籤住在哪一組（標籤集的 value） */
  tagSet: string
}

export interface TagSetRef {
  value: string
  name: string
  selected: boolean
  /** 已用格數。當前組數得出來，其他組從 #usertag_target 的括號讀 */
  used: number | null
}

export interface TagSetSnapshot {
  value: string
  name: string
  enabled: boolean
  /** 這一組的預設顏色。組裡沒自己設色的標籤會繼承它 */
  defaultColor: string
  rows: MyTagRow[]
}

export interface EhMyTagsHost {
  anchor: HTMLElement
  /** 當前選中的標籤集 */
  currentSet: string
  /** 下拉選單裡的所有標籤集 */
  tagSets: TagSetRef[]
  /** 當前這組有沒有啟用；沒啟用的組不進計分 */
  enabled: boolean
  /** 當前組的預設顏色 */
  defaultColor: string
  readRows(): MyTagRow[]
  /** 蓋住原生 UI。DOM 留在文件裡（display:none），寫入路徑還要靠它 */
  coverNative(on: boolean): void
  /** 下面這些都會讓整頁刷新——呼叫前 pending 必須先落地 */
  switchSet(value: string): void
  createTag(input: NewTagInput): void
  /**
   * 刪除 / 搬移。`tagSet` 是這批 tagid 所屬的組，不是當前組——表單認的是 URL 上的
   * `?tagset=`，所以任何一組都動得了，也不刷新。回傳那一組的最新標籤列，null 代表失敗。
   */
  deleteTags(ids: number[], tagSet: string): Promise<MyTagRow[] | null>
  moveTags(ids: number[], targetSet: string, tagSet: string): Promise<MyTagRow[] | null>
  /** 改當前組的預設色與啟用。改名是另一個動作，EH 分成兩種 action */
  saveTagSet(input: { defaultColor: string; enabled: boolean }): void
  renameTagSet(name: string): void
  createTagSet(name: string): void
  deleteTagSet(): void
  /** 綁在容器上的事件委派，回傳解除函式 */
  onChange(fn: () => void): () => void
}

export interface NewTagInput {
  full: string
  weight: number
  hidden: boolean
  watch: boolean
  color: string
}

// 權重輸入框的 `oninput="update_tagweight(id, this.value, saved)"`，第三個參數是
// 已經存進 EH 的權重——EH 拿它跟當前輸入比對，決定 Save 按鈕要不要亮。
const SAVED_WEIGHT = /update_tagweight\(\s*\d+\s*,[^,]*,\s*(-?\d+)\s*\)/
/** #usertag_target 的選項文字長成「名稱 (34)」 */
const SET_USED = /\((\d+)\)\s*$/

function el<T extends HTMLElement>(root: Document, id: string): T | null {
  return root.getElementById(id) as T | null
}

/** 從一份 /mytags 文件（當前頁或 fetch 回來的）解析出標籤列 */
export function parseTagRows(doc: Document | HTMLElement, tagSet: string): MyTagRow[] {
  const rows: MyTagRow[] = []
  const outer = doc.querySelector('#usertags_outer')
  if (!outer) return rows
  const root = (doc instanceof Document ? doc : doc.ownerDocument)!

  for (const preview of outer.querySelectorAll<HTMLElement>('[id^="tagpreview_"]')) {
    const raw = preview.id.slice('tagpreview_'.length)
    // usertag_0 是「新增標籤」那一列的空白輸入框，不是真的標籤
    if (raw === '0') continue
    const full = preview.title
    if (!full) continue

    const weightEl = el<HTMLInputElement>(root, `tagweight_${raw}`)
    // parseInt 而不是 Number：EH 自己的 handler 就是 `b = parseInt(b)`，跟著它才會
    // 跟使用者眼前的預覽配色一致
    const live = parseInt(weightEl?.value ?? '', 10)
    const saved = Number(
      SAVED_WEIGHT.exec(weightEl?.getAttribute('oninput') ?? '')?.[1] ?? 10)
    rows.push({
      id: Number(raw),
      full,
      // 原生 UI 被蓋住之後不會有人打字，這裡幾乎總是等於已存值。留著 fallback 是
      // 因為使用者可以把原生 UI 叫回來，那時打到一半的 "-" parseInt 出來是 NaN，
      // 一路加總下去會讓「被擋」整片翻成「會顯示」
      weight: Number.isNaN(live) ? saved : live,
      hidden: el<HTMLInputElement>(root, `taghide_${raw}`)?.checked ?? false,
      watch: el<HTMLInputElement>(root, `tagwatch_${raw}`)?.checked ?? false,
      color: el<HTMLInputElement>(root, `tagcolor_${raw}`)?.value ?? '',
      tagSet,
    })
  }
  return rows
}

export interface Thresholds {
  /** Tag Filtering Threshold：加總低於它就被軟過濾掉。範圍 -9999 ~ 0 */
  filter: number | null
}

/** ⚠️ 路徑帶 `.php`。不帶的 `/uconfig` 是 404，而 404 只會讓門檻靜默變成 null */
const UCONFIG = '/uconfig.php'

/** `ft` 這個 id 找不到時，退回從欄位周圍的文字撈 */
function findThreshold(doc: Document, id: string, label: RegExp): number | null {
  const byId = doc.querySelector<HTMLInputElement>(`#${id}`)
  const guess = byId ?? [...doc.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="number"]')]
    .find((el) => label.test(el.closest('div, tr, p')?.textContent ?? ''))
  const raw = guess?.value.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * 門檻住在設定頁而不是 /mytags，只能另外抓。抓不到回傳 null——那時候寧可讓使用者
 * 自己填，也不要拿預設值算出一份看起來很篤定的錯誤試算
 */
export async function fetchThresholds(): Promise<Thresholds> {
  try {
    const res = await fetch(UCONFIG, { credentials: 'same-origin' })
    if (!res.ok) return { filter: null }
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
    return { filter: findThreshold(doc, 'ft', /filter/i) }
  } catch { return { filter: null } }
}

/** 抓另一組標籤集的頁面。回傳 null 代表抓失敗 */
export async function fetchTagSet(value: string): Promise<TagSetSnapshot | null> {
  try {
    const res = await fetch(`/mytags?tagset=${encodeURIComponent(value)}`, {
      credentials: 'same-origin',
    })
    if (!res.ok) return null
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
    const sel = doc.querySelector<HTMLOptionElement>('#tagset_outer option[selected]')
    return {
      value,
      name: sel?.textContent?.trim() ?? value,
      enabled: doc.querySelector<HTMLInputElement>('#tagset_enable')?.checked ?? true,
      defaultColor: doc.querySelector<HTMLInputElement>('#tagcolor')?.value ?? '',
      rows: parseTagRows(doc, value),
    }
  } catch { return null }
}

/** `change_tagset` 的規則：第一組不帶參數 */
export function tagSetUrl(value: string): string {
  return Number(value) > 1
    ? `${location.origin}/mytags?tagset=${encodeURIComponent(value)}`
    : `${location.origin}/mytags`
}

export function useEhMyTagsHost(): EhMyTagsHost | null {
  if (location.pathname !== '/mytags') return null
  const form = document.querySelector<HTMLFormElement>('#usertag_form')
  const outer = document.querySelector<HTMLElement>('#usertags_outer')
  if (!form || !outer) return null

  const setForm = document.querySelector<HTMLFormElement>('#tagset_form')
  const options = [...document.querySelectorAll<HTMLOptionElement>('#tagset_outer select option')]
  const currentSet = options.find((o) => o.selected)?.value ?? '1'

  // ⚠️ #usertag_target 只列「其他組」，當前組不在裡面——所以當前組的已用格數只能
  // 自己數列
  const used = new Map<string, number>()
  for (const o of document.querySelectorAll<HTMLOptionElement>('#usertag_target option')) {
    if (o.value === '0') continue          // 「Delete Selected」不是標籤集
    const n = SET_USED.exec(o.textContent ?? '')
    if (n) used.set(o.value, Number(n[1]))
  }
  used.set(currentSet, outer.querySelectorAll('[id^="usertag_"]').length - 1)

  const tagSets: TagSetRef[] = options.map((o) => ({
    value: o.value,
    name: (o.textContent ?? o.value).replace(SET_USED, '').trim(),
    selected: o.value === currentSet,
    used: used.get(o.value) ?? null,
  }))

  // 掛在 #outer 之後，不是塞進它裡面：#outer 有 max-width:900px，塞進去的話左右
  // 兩欄分不開。掛在它後面位置一樣在頁面內容正下方，但寬度不受限
  const anchor = document.createElement('div')
  anchor.id = 'eqt-mytags-anchor'
  anchor.setAttribute('translate', 'no')
  // ⚠️ #outer 是整頁的外框，跟上面那個 #usertags_outer（標籤列容器）是不同的東西
  const pageBox = document.querySelector('#outer')
  if (pageBox) pageBox.after(anchor)
  else form.after(anchor)

  function submitUsertagForm(action: string): void {
    const field = el<HTMLInputElement>(document, 'usertag_action')
    if (!field || !form) return
    field.value = action
    form.submit()
  }

  function submitTagSetForm(action: string): void {
    const field = el<HTMLInputElement>(document, 'tagset_action')
    if (!field || !setForm) return
    field.value = action
    setForm.submit()
  }

  async function massAction(
    ids: number[],
    target: string,
    tagSet: string,
  ): Promise<MyTagRow[] | null> {
    if (!ids.length) return null
    const doc = await postMassAction(tagSet, ids, target)
    return doc ? parseTagRows(doc, tagSet) : null
  }

  return {
    anchor,
    currentSet,
    tagSets,
    enabled: document.querySelector<HTMLInputElement>('#tagset_enable')?.checked ?? true,
    defaultColor: document.querySelector<HTMLInputElement>('#tagcolor')?.value ?? '',
    readRows: () => parseTagRows(document, currentSet),

    coverNative(on) {
      // ⚠️ 藏的是 #outer 整個，不是裡面那兩張表單——#outer 本身就是 .stuffbox，
      // 只藏表單的話那個帶邊框的空殼會留在畫面上。
      // display:none 而不是搬走：寫入路徑（新增 / 刪除 / 標籤集）還要 submit 這些
      // 表單，而 form.submit() 和 getElementById 對隱藏的節點照樣有效
      const box = pageBox ?? form
      if (box instanceof HTMLElement) box.style.display = on ? 'none' : ''
    },

    switchSet(value) { location.href = tagSetUrl(value) },

    createTag(input) {
      const name = el<HTMLInputElement>(document, 'tagname_new')
      if (!name) return
      name.value = input.full
      const w = el<HTMLInputElement>(document, 'tagweight_0')
      if (w) w.value = String(input.weight)
      const c = el<HTMLInputElement>(document, 'tagcolor_0')
      if (c) c.value = input.color
      const h = el<HTMLInputElement>(document, 'taghide_0')
      if (h) h.checked = input.hidden
      const t = el<HTMLInputElement>(document, 'tagwatch_0')
      if (t) t.checked = input.watch
      submitUsertagForm('add')
    },

    deleteTags(ids, tagSet) { return massAction(ids, '0', tagSet) },   // 0 = Delete Selected
    moveTags(ids, targetSet, tagSet) { return massAction(ids, targetSet, tagSet) },

    saveTagSet({ defaultColor, enabled }) {
      const color = el<HTMLInputElement>(document, 'tagcolor')
      if (color) color.value = defaultColor
      const on = el<HTMLInputElement>(document, 'tagset_enable')
      if (on) on.checked = enabled
      submitTagSetForm('update')
    },
    renameTagSet(name) {
      const field = el<HTMLInputElement>(document, 'tagset_name')
      if (field) field.value = name
      submitTagSetForm('rename')
    },
    createTagSet(name) {
      const field = el<HTMLInputElement>(document, 'tagset_name')
      if (field) field.value = name
      submitTagSetForm('create')
    },
    deleteTagSet() { submitTagSetForm('delete') },

    onChange(fn) {
      // 事件委派掛在 outer 上：EH 自己的 oninput handler 也在同一批 element 上，
      // 各自獨立不互相干擾
      const handler = (): void => fn()
      outer.addEventListener('input', handler)
      outer.addEventListener('change', handler)
      return () => {
        outer.removeEventListener('input', handler)
        outer.removeEventListener('change', handler)
      }
    },
  }
}
