import { ref, watch, nextTick } from 'vue'

// contenteditable 顯示名稱輸入的共用邏輯。
// 因為 <input> 不支援 ::before（pushable preset 的 3D pedestal），改用
// <span contenteditable>，所以無法用 v-model 自動同步，必須手寫一套：
// - 攔 IME composition 期間的 input 事件，避免候選字被當作正式輸入
// - 偵測「全選刪光後瀏覽器塞 <br>」幽靈，清成真正的 empty 以觸發
//   :empty::after placeholder
// - 外部寫入 label（譬如 fetchTitle、props 變化）時 push 回 DOM，
//   並 nextTick 比對 innerText 避免覆蓋 caret

export function useContentEditableName() {
  const label = ref('')
  const nameInputEl = ref<HTMLElement | null>(null)
  let labelComposing = false

  function readName(el: HTMLElement): string {
    const text = el.innerText
    if (!text || text === '\n') {
      if (el.innerHTML !== '') el.innerHTML = ''
      return ''
    }
    return text
  }

  function onNameInput(e: Event) {
    if (labelComposing) return
    label.value = readName(e.target as HTMLElement)
  }

  function onNameCompositionStart() {
    labelComposing = true
  }

  function onNameCompositionEnd(e: CompositionEvent) {
    labelComposing = false
    label.value = readName(e.target as HTMLElement)
  }

  watch(label, (newVal) => {
    nextTick(() => {
      if (nameInputEl.value && nameInputEl.value.innerText !== newVal) {
        nameInputEl.value.innerText = newVal
      }
    })
  }, { immediate: true })

  return {
    label,
    nameInputEl,
    onNameInput,
    onNameCompositionStart,
    onNameCompositionEnd,
  }
}
