// 一條規則的動作一項一項寫出來：畫面上的摘要與複製出去的 Markdown 讀同一份，兩邊列的項目與順序才會一樣

import type { FixedActions } from './fixedRulePrototype'

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
export function actionItems(actions: FixedActions): ActionItem[] {
  if (actions.hide) return [{ key: 'hide', message: 'rulePagePrototype.hideShort' }]
  const items: ActionItem[] = []
  const color = (key: ActionItemKey, message: string, value: string | null) => {
    if (value) items.push({ key, message, params: { color: value }, swatch: value })
  }
  color('background', 'rulePagePrototype.backgroundIs', actions.background)
  if (actions.dim) items.push({ key: 'dim', message: 'rulePagePrototype.dimIs', params: { amount: actions.dim } })
  if (actions.blur) {
    const message = actions.blurMode === 'mosaic' ? 'rulePagePrototype.mosaicIs' : 'rulePagePrototype.blurIs'
    items.push({ key: 'blur', message, params: { amount: actions.blur } })
  }
  if (actions.showName) items.push({ key: 'showName', message: 'rulePagePrototype.showNameShort' })
  if (actions.prefix) items.push({ key: 'prefix', message: 'rulePagePrototype.titlePrefixIs', params: { prefix: actions.prefix } })
  color('titleColor', 'rulePagePrototype.titleColorIs', actions.titleColor)
  color('titleBackground', 'rulePagePrototype.titleBackgroundIs', actions.titleBackground)
  for (const key of ['bold', 'italic', 'underline', 'strike'] as const) {
    if (actions[key]) items.push({ key, message: `rulePagePrototype.${key}Short` })
  }
  return items
}
