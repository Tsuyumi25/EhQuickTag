import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { GM_addValueChangeListener, GM_removeValueChangeListener, type GmValueListenerId } from '$'
import { cacheGet, cacheSet, hasGM } from '@/services/gmStorage'
import { reserveRuleIds, type GalleryRule } from '@/services/listing/galleryRules'
import { decodeRules, RULE_SCHEMA } from '@/services/listing/ruleStorage'
import { createPageContext } from '@/composables/createPageContext'

const STORAGE_KEY = 'eqt_gallery_rules'

export const useGalleryRuleStore = createPageContext(() => {
  const rules = ref<GalleryRule[]>([])
  const ready = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  let listener: GmValueListenerId | undefined
  let disposed = false
  let accepted = ''
  let pending: string | null = null
  // 存檔途中別的分頁也寫了：通知被擋下，存完要重讀一次，否則這一頁會一直停在自己那一版
  let stale = false
  // 這一頁有寫不出去的編輯：別的分頁的版本不能蓋掉它，錯誤訊息答應過使用者內容還留在這頁
  let failed = false
  let received = 0

  function accept(raw: string | null) {
    const loaded = decodeRules(raw)
    reserveRuleIds(loaded)
    accepted = JSON.stringify({ schema: RULE_SCHEMA, rules: loaded })
    rules.value = loaded
    ready.value = true
    error.value = null
  }

  // 存著的資料讀不懂（多半是新版存的）就停止寫入：這一頁手上的是舊格式，寫回去會把新資料蓋掉
  function reject() {
    ready.value = false
    pending = null
    error.value = 'rulePage.loadFailed'
  }

  function receive(raw: string | null) {
    received += 1
    if (disposed) return
    if (saving.value || failed) {
      stale = true
      return
    }
    try { accept(raw) } catch { reject() }
  }

  async function flush() {
    if (saving.value) return
    saving.value = true
    while (pending !== null || stale) {
      const raw = pending
      // 先讀再寫：別的分頁存進來的要是讀不懂，手上這份就不能寫出去
      if (stale || raw === null) {
        stale = false
        try {
          const stored = await cacheGet(STORAGE_KEY)
          if (disposed) break
          // 重讀途中又改了、或有沒存成的編輯，就讓本地這份留著等著寫出去：它比讀到的那份還新
          if (pending === null && !failed) accept(stored)
          else decodeRules(stored)
        } catch {
          reject()
          break
        }
        continue
      }
      pending = null
      try {
        await cacheSet(STORAGE_KEY, raw)
        accepted = raw
        failed = false
        error.value = null
      } catch {
        failed = true
        error.value = 'rulePage.saveFailed'
      }
    }
    saving.value = false
  }

  watch(rules, () => {
    if (!ready.value) return
    const raw = JSON.stringify({ schema: RULE_SCHEMA, rules: rules.value })
    if (raw === accepted) {
      // 改回存著的那一版，就沒有寫不出去的東西了；期間擋下的別頁版本這時才接過來
      if (failed) {
        failed = false
        error.value = null
        if (stale) void flush()
      }
      return
    }
    // 寫出去的必須是自己讀得回來的：讀不回來的一條規則會讓整份規則在下次載入時全部打不開
    try {
      decodeRules(raw)
    } catch {
      failed = true
      error.value = 'rulePage.saveFailed'
      return
    }
    pending = raw
    void flush()
  }, { deep: true, flush: 'post' })

  function onStorage(event: StorageEvent) {
    if (event.storageArea === localStorage && event.key === STORAGE_KEY) receive(event.newValue)
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!saving.value && !failed) return
    event.preventDefault()
    event.returnValue = ''
  }

  onMounted(async () => {
    try {
      if (hasGM) {
        listener = GM_addValueChangeListener<string>(STORAGE_KEY, (_key, _old, value, remote) => {
          if (remote) receive(value ?? null)
        })
      } else {
        window.addEventListener('storage', onStorage)
      }
      window.addEventListener('beforeunload', onBeforeUnload)
      const revision = received
      const raw = await cacheGet(STORAGE_KEY)
      if (!disposed && revision === received) accept(raw)
    } catch {
      if (!disposed) error.value = 'rulePage.loadFailed'
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    if (listener !== undefined) GM_removeValueChangeListener(listener)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('beforeunload', onBeforeUnload)
  })

  return { rules, ready, saving, error }
})
