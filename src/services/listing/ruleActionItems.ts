// 一條規則的動作一項一項寫出來：畫面上的摘要與複製出去的 Markdown 讀同一份，兩邊列的項目與順序才會一樣

import type { RuleActions } from './galleryRules'

/** 動作作用在圖庫卡片的哪個位置；編輯時照這個分頁，新的動作照位置放進對應的那一頁 */
export const ACTION_TARGETS = ['card', 'cover', 'prefix', 'title'] as const
export type ActionTarget = (typeof ACTION_TARGETS)[number]

/** 這個位置有沒有設定任何動作；分頁上標一個點，不必一頁頁點開才知道哪裡有改 */
export function targetInUse(actions: RuleActions, target: ActionTarget): boolean {
  switch (target) {
    case 'card': return actions.background !== null || actions.dim > 0 || actions.showName || actions.hide
    case 'cover': return actions.blur > 0
    case 'prefix': return actions.prefix !== null
    case 'title': return actions.titleColor !== null || actions.titleBackground !== null
      || actions.strike || actions.underline || actions.bold || actions.italic
  }
}

export type ActionItemKey =
  | 'hide' | 'background' | 'dim' | 'blur' | 'showName' | 'prefix'
  | 'titleColor' | 'titleBackground' | 'bold' | 'italic' | 'underline' | 'strike'

export interface ActionItem {
  key: ActionItemKey
  message: string
  /** 填進譯文的值；color 與 prefix 是原樣的字，複製成 Markdown 時包成 code */
  params?: { color?: string; prefix?: string; amount?: number }
  /** 顏色類的項目，摘要上畫成色塊 */
  swatch?: string
}

/** 隱藏時其他動作都不作用，只列隱藏 */
export function actionItems(actions: RuleActions): ActionItem[] {
  if (actions.hide) return [{ key: 'hide', message: 'rulePage.hideShort' }]
  const items: ActionItem[] = []
  const color = (key: ActionItemKey, message: string, value: string | null) => {
    if (value) items.push({ key, message, params: { color: value }, swatch: value })
  }
  color('background', 'rulePage.backgroundIs', actions.background)
  if (actions.dim) items.push({ key: 'dim', message: 'rulePage.dimIs', params: { amount: actions.dim } })
  if (actions.blur) {
    const message = actions.blurMode === 'mosaic' ? 'rulePage.mosaicIs' : 'rulePage.blurIs'
    items.push({ key: 'blur', message, params: { amount: actions.blur } })
  }
  if (actions.showName) items.push({ key: 'showName', message: 'rulePage.showNameShort' })
  if (actions.prefix) items.push({ key: 'prefix', message: 'rulePage.titlePrefixIs', params: { prefix: actions.prefix } })
  color('titleColor', 'rulePage.titleColorIs', actions.titleColor)
  color('titleBackground', 'rulePage.titleBackgroundIs', actions.titleBackground)
  for (const key of ['bold', 'italic', 'underline', 'strike'] as const) {
    if (actions[key]) items.push({ key, message: `rulePage.${key}Short` })
  }
  return items
}
