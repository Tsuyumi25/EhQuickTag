import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { GM_addValueChangeListener, GM_removeValueChangeListener, type GmValueListenerId } from '$'
import { cacheGet, cacheSet, hasGM } from '@/services/gmStorage'
import { reserveRuleIds, type FixedRule } from '@/services/listing/fixedRulePrototype'
import { decodeRules, RULE_SCHEMA } from '@/services/listing/ruleStorage'
import { createPageContext } from '@/composables/createPageContext'

const STORAGE_KEY = 'eqt_fixed_rules'

export const useFixedRuleStore = createPageContext(() => {
  const rules = ref<FixedRule[]>([])
  const ready = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  let listener: GmValueListenerId | undefined
  let disposed = false
  let accepted = ''
  let pending: string | null = null
  let received = 0

  function accept(raw: string | null) {
    const loaded = decodeRules(raw)
    reserveRuleIds(loaded)
    accepted = JSON.stringify({ schema: RULE_SCHEMA, rules: loaded })
    rules.value = loaded
    ready.value = true
    error.value = null
  }

  function receive(raw: string | null) {
    received += 1
    if (disposed || saving.value) return
    try { accept(raw) } catch { error.value = 'rulePagePrototype.loadFailed' }
  }

  async function flush() {
    if (saving.value) return
    saving.value = true
    while (pending !== null) {
      const raw = pending
      pending = null
      try {
        await cacheSet(STORAGE_KEY, raw)
        accepted = raw
        error.value = null
      } catch {
        error.value = 'rulePagePrototype.saveFailed'
      }
    }
    saving.value = false
  }

  watch(rules, () => {
    if (!ready.value) return
    const raw = JSON.stringify({ schema: RULE_SCHEMA, rules: rules.value })
    if (raw === accepted) return
    pending = raw
    void flush()
  }, { deep: true, flush: 'post' })

  function onStorage(event: StorageEvent) {
    if (event.storageArea === localStorage && event.key === STORAGE_KEY) receive(event.newValue)
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!saving.value && error.value !== 'rulePagePrototype.saveFailed') return
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
      if (!disposed) error.value = 'rulePagePrototype.loadFailed'
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
