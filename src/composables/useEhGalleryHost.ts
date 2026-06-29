// Gallery 詳情頁（/g/xxx/xxx）host：偵測 → 抓 #taglist tags（含 tagid 給 vote 路徑用）
// → 隱藏原生 taglist 和 tag_menu → 在 #gd4 內 inject anchor。
//
// 跟 useEhFormHost 同樣只負責 DOM 邊界，回 handle 給 App.vue 接

export interface GalleryTag {
  /** e站內部 tag id（譬如 98020）——voteUp/voteDown 走 native window function 需要 */
  tagid: number
  /** namespace（不含尾 colon） */
  ns: string
  /** 原文 raw tag（含空格） */
  raw: string
  /** `ns:raw` 完整 form */
  nsRaw: string
  /**
   * `<div id="td_...">` 上的 class——e站用這欄帶權重 tier 信號：
   *   - `gt`  = 確定（多數票通過、border 實線）
   *   - `gtl` = 投票多但未確定（border 虛線）
   *   - `gtw` = 權重低（少數票、border 點虛線）
   * 第一輪只 reproduce 已知值，未知 class 不套 border-style 變化
   */
  tierClass: string
  /**
   * `<a id="ta_...">` 上的 class——帶當前使用者對該 tag 的投票狀態：
   *   - `tup` = 已 upvote（文字顯示綠）
   *   - `tdn` = 已 downvote（文字顯示紅）
   * 初始值用於 hydrate UI 上的「我已投過」呈現
   */
  voteClass: string
}

export interface EhGalleryHost {
  tags: GalleryTag[]
  /** Vue Teleport target——#gd4 內第二區（第一區 #eqt-native-wrap 包所有 native
   *  元素）。插件模式 hide native wrap、anchor 仍 visible；原生模式反過來，但
   *  anchor 內兩排 action row 永久 visible 讓 user 切回插件 */
  anchor: HTMLElement
  /**
   * 原生 #taglist 元素——保留指標讓 component MutationObserver 監聽用：
   *   - 原生 `tag_from_field`（newtagfield 提交）會用 `taglist.innerHTML = tagpane` 更新
   *   - 撤銷自家標籤也走同條路徑
   *   - 我們自家 vote 回 server 的 tagpane 也統一寫進來，靠 observer 同步狀態
   */
  taglistEl: HTMLElement
}

// 從 `toggle_tagmenu(98020,'female:gyaru',this)` 抓 tagid 跟 nsRaw。
// 為什麼解析 onclick 而非從 id 抓：id 用 `_` 取代空格、href 用 `+`，這兩種 encoding
// 都會把含空格的 raw 給破壞掉；onclick 字面值的 'female:big breasts' 是 e站自己
// 寫的原文，最可信
const ONCLICK_RE = /toggle_tagmenu\(\s*(\d+)\s*,\s*'([^']+)'/

/**
 * 從原生 taglist DOM 結構 scrape 出 GalleryTag 列表。
 *
 * 兩個 caller 共用：
 *   - 初次 mount 時 scrape 整顆 #taglist
 *   - MutationObserver 觸發時 re-scrape #taglist（同 DOM、現在新狀態）
 */
export function parseTaglistRoot(root: Element): GalleryTag[] {
  const tags: GalleryTag[] = []
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[onclick^="return toggle_tagmenu"]')) {
    const m = a.getAttribute('onclick')?.match(ONCLICK_RE)
    if (!m) continue
    const tagid = Number(m[1])
    const nsRaw = m[2]
    const colon = nsRaw.indexOf(':')
    if (colon <= 0) continue
    // div 帶 tier 信號（gt/gtl/...）、a 帶 vote 信號（tup/...）
    const divEl = a.parentElement as HTMLElement | null
    tags.push({
      tagid,
      ns: nsRaw.slice(0, colon),
      raw: nsRaw.slice(colon + 1),
      nsRaw,
      tierClass: divEl?.className ?? '',
      voteClass: a.className ?? '',
    })
  }
  return tags
}

export function useEhGalleryHost(): EhGalleryHost | null {
  const tagList = document.querySelector<HTMLElement>('#taglist')
  const gd4 = document.querySelector<HTMLElement>('#gd4')
  if (!tagList || !gd4) return null

  const tags = parseTaglistRoot(tagList)

  // #tagmenu_act2 是第三方插件注入（譬如 quick-tag-voting）、不在我們的接管範圍
  const tagmenuAct2 = gd4.querySelector<HTMLElement>('#tagmenu_act2')
  if (tagmenuAct2) tagmenuAct2.style.display = 'none'

  // 在 #gd4 內把現有 native children 包進一個 wrapper、anchor 並列為第二區。
  // 插件模式直接 hide native wrapper 一條 CSS 搞定（不需 enumerate 個別 native id）。
  // 直接放 #gd4.after 會干擾 #gmid 的 grid layout（auto-placement 跑位），所以
  // wrap 進去仍由 #gd4 原本的 grid-area: gd4 收容
  const nativeWrap = document.createElement('div')
  nativeWrap.id = 'eqt-native-wrap'
  while (gd4.firstChild) nativeWrap.appendChild(gd4.firstChild)
  gd4.appendChild(nativeWrap)

  const anchor = document.createElement('div')
  anchor.id = 'eqt-gallery-anchor'
  anchor.setAttribute('translate', 'no')
  gd4.appendChild(anchor)

  return { tags, anchor, taglistEl: tagList }
}
