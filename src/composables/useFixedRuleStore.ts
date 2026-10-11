import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { GM_addValueChangeListener, GM_removeValueChangeListener, type GmValueListenerId } from '$'
import { cacheGet, cacheSet, hasGM } from '@/services/gmStorage'
import {
  MAX_FOLDER_DEPTH, RANGE_FIELDS, RANGE_OPS, reserveRuleIds,
  type FixedCondition, type FixedConditionItem, type FixedRule, type RangeField, type RangeOp,
} from '@/services/listing/fixedRulePrototype'
import { createPageContext } from '@/composables/createPageContext'

const STORAGE_KEY = 'eqt_fixed_rules'
const SCHEMA = 4

function validCondition(condition: unknown): condition is FixedCondition {
  if (!condition || typeof condition !== 'object' || !('id' in condition) || !Number.isSafeInteger(condition.id)
    || !('kind' in condition)) return false
  if (condition.kind === 'tag') {
    return 'tag' in condition && typeof condition.tag === 'string'
      && 'exclude' in condition && typeof condition.exclude === 'boolean'
  }
  if (typeof condition.kind !== 'string' || !Object.hasOwn(RANGE_FIELDS, condition.kind)) return false
  const field = RANGE_FIELDS[condition.kind as RangeField]
  const inField = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= field.min && value <= field.max
  return 'op' in condition && RANGE_OPS.includes(condition.op as RangeOp)
    && 'value' in condition && inField(condition.value) && (!('max' in condition) || inField(condition.max))
}

function validConditionItem(condition: unknown, depth = 0): condition is FixedConditionItem {
  if (!condition || typeof condition !== 'object' || !('kind' in condition)) return false
  if (condition.kind !== 'folder') return validCondition(condition)
  return depth < MAX_FOLDER_DEPTH && 'id' in condition && Number.isSafeInteger(condition.id)
    && 'mode' in condition && typeof condition.mode === 'string' && ['all', 'any', 'none'].includes(condition.mode)
    && 'conditions' in condition && Array.isArray(condition.conditions)
    && condition.conditions.every(child => validConditionItem(child, depth + 1))
}

function decodeAlternatives(value: unknown, legacy: boolean): FixedConditionItem[] {
  if (!Array.isArray(value)) throw new Error('Invalid fixed rule storage')
  return value.map((item: unknown) => {
    let condition = item
    if (legacy && item !== null && typeof item === 'object' && !('kind' in item)
      && 'id' in item && 'conditions' in item) {
      condition = { id: item.id, kind: 'folder', mode: 'all', conditions: item.conditions }
    }
    if (!validConditionItem(condition)) throw new Error('Invalid fixed rule storage')
    return condition
  })
}

function validRuleFields(rule: unknown): rule is Omit<FixedRule, 'alternatives'> {
  if (!rule || typeof rule !== 'object') return false
  return 'id' in rule && Number.isSafeInteger(rule.id)
    && 'name' in rule && typeof rule.name === 'string' && 'enabled' in rule && typeof rule.enabled === 'boolean'
    && 'common' in rule && Array.isArray(rule.common) && rule.common.every(condition => validConditionItem(condition))
    && 'exceptions' in rule && Array.isArray(rule.exceptions) && rule.exceptions.every(condition => validConditionItem(condition))
    && 'actions' in rule && rule.actions !== null && typeof rule.actions === 'object'
    && 'background' in rule.actions && (rule.actions.background === null || typeof rule.actions.background === 'string')
    && 'blur' in rule.actions && typeof rule.actions.blur === 'string' && ['unchanged', 'blur', 'clear'].includes(rule.actions.blur)
}

function decode(raw: string | null): FixedRule[] {
  if (raw === null) return []
  const data: unknown = JSON.parse(raw)
  if (!data || typeof data !== 'object' || !('schema' in data)
    || (data.schema !== 1 && data.schema !== 2 && data.schema !== 3 && data.schema !== SCHEMA)
    || !('rules' in data) || !Array.isArray(data.rules)) throw new Error('Invalid fixed rule storage')
  return data.rules.map((rule: unknown): FixedRule => {
    if (!validRuleFields(rule)) throw new Error('Invalid fixed rule storage')
    const storedAlternatives = data.schema === 1 || data.schema === 2
      ? ('groups' in rule ? rule.groups : null)
      : ('alternatives' in rule ? rule.alternatives : null)
    const alternatives = decodeAlternatives(storedAlternatives, data.schema !== SCHEMA)
    return {
      id: rule.id, name: rule.name, enabled: rule.enabled,
      common: rule.common, alternatives, exceptions: rule.exceptions, actions: rule.actions,
    }
  })
}

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
    const loaded = decode(raw)
    reserveRuleIds(loaded)
    accepted = JSON.stringify({ schema: SCHEMA, rules: loaded })
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
    const raw = JSON.stringify({ schema: SCHEMA, rules: rules.value })
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
