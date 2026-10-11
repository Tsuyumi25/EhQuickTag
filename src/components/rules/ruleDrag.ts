import { baseDragOptions } from '@/utils/drag'
import { MAX_FOLDER_DEPTH } from '@/services/listing/fixedRulePrototype'

// 條件區、Folder、素材庫共用一個 group，素材才能拖進任何一區，條件也能丟回素材庫
export const RULE_CONDITIONS_GROUP = 'eqt-rule-conditions'

/** Sortable 傳給 group.put 的目標實例，這裡只用得到它的根元素 */
interface SortableTarget { el: HTMLElement }

// 清單用 data-depth 標自己的層數、拖曳中的項目用 data-height 標自己有幾層 Folder，
// 兩者相加超過上限就拒收
export function fitsFolderDepth(to: SortableTarget, _from: unknown, dragged: HTMLElement): boolean {
  return Number(to.el.dataset.depth) + Number(dragged.dataset.height) <= MAX_FOLDER_DEPTH
}

export const ruleDragOptions = {
  ...baseDragOptions,
  draggable: '.eqt-rule-page__item',
  handle: '.eqt-gallery-chip, .eqt-rule-page__range, .eqt-rule-page__folder-head, .eqt-rule-page__source',
  filter: 'input, select, .eqt-rule-page__chip-remove, .eqt-rule-page__polarity, .eqt-number-field',
  // Sortable 預設會對 filter 命中的元素 preventDefault，select 的原生選單就打不開
  preventOnFilter: false,
  // forceFallback 預設滑一個像素就開始拖，手一抖點擊就變成拖曳
  fallbackTolerance: 3,
  ghostClass: 'eqt-rule-page__item--ghost',
}
