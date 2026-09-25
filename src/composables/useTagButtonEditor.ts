import { ref, computed } from 'vue'
import { lines } from '@/services/store'
import type { Button, TagButton, UrlButton } from '@/types'

export function useTagButtonEditor() {
  const editingLine = ref(-1)
  const editingIdx = ref(-1)
  const pendingAdd = ref(false)
  const showTagPopup = ref(false)
  const showUrlPopup = ref(false)

  // 兩個 draft ref 各自對應 popup——避免同一 ref 帶 union type 在 v-bind 上需要 cast
  const draftTagButton = ref<TagButton>({ kind: 'tag', tags: [] })
  const draftUrlButton = ref<UrlButton>({ kind: 'url', url: '' })

  function onConfigure(lineIdx: number, tagIdx: number) {
    editingLine.value = lineIdx
    editingIdx.value = tagIdx
    pendingAdd.value = false
    const line = lines[lineIdx]
    if (line.kind !== 'buttons') return
    const b = line.buttons[tagIdx]
    if (b.kind === 'url') showUrlPopup.value = true
    else showTagPopup.value = true
  }

  function onAdd(type: 'tag' | 'url' = 'tag') {
    if (type === 'url') draftUrlButton.value = { kind: 'url', url: '', label: '' }
    else draftTagButton.value = { kind: 'tag', tags: [], label: '' }
    // 末行不是 ButtonLine 時 push 一個新空行——SeparatorLine 不能容納 button，
    // 也避免在末行是 separator 時新 button 被塞到看不見的位置
    const last = lines[lines.length - 1]
    if (!last || last.kind !== 'buttons') {
      lines.push({ kind: 'buttons', buttons: [] })
    }
    editingLine.value = lines.length - 1
    pendingAdd.value = true
    if (type === 'url') showUrlPopup.value = true
    else showTagPopup.value = true
  }

  function onSave(updated: Button) {
    const line = lines[editingLine.value]
    if (line.kind !== 'buttons') return
    if (pendingAdd.value) line.buttons.push(updated)
    else line.buttons[editingIdx.value] = updated
    pendingAdd.value = false
    showTagPopup.value = false
    showUrlPopup.value = false
  }

  function onClose() {
    pendingAdd.value = false
    showTagPopup.value = false
    showUrlPopup.value = false
  }

  // 給 popup binding 用的 computed——既處理 add 模式的 draft，也處理 edit 模式
  // narrow 到正確 button kind。computed return null 時 popup 不渲染。
  const tagPopupValue = computed<TagButton | null>(() => {
    if (!showTagPopup.value) return null
    if (pendingAdd.value) return draftTagButton.value
    const line = lines[editingLine.value]
    if (!line || line.kind !== 'buttons') return null
    const b = line.buttons[editingIdx.value]
    return b && b.kind === 'tag' ? b : null
  })

  const urlPopupValue = computed<UrlButton | null>(() => {
    if (!showUrlPopup.value) return null
    if (pendingAdd.value) return draftUrlButton.value
    const line = lines[editingLine.value]
    if (!line || line.kind !== 'buttons') return null
    const b = line.buttons[editingIdx.value]
    return b && b.kind === 'url' ? b : null
  })

  const editingLineColor = computed(() => {
    const line = lines[editingLine.value]
    return line?.kind === 'buttons' ? line.color : undefined
  })

  return {
    tagPopupValue,
    urlPopupValue,
    editingLineColor,
    pendingAdd,
    onConfigure,
    onAdd,
    onSave,
    onClose,
  }
}
