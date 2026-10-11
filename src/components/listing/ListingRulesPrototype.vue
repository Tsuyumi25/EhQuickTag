<script setup lang="ts">
// 列表頁：選標籤送規則頁，並把規則頁存下來的固定規則套回真實畫廊外觀。
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { GM } from '$'
import { useFloating, autoUpdate, flip, shift } from '@floating-ui/vue'
import { ChevronDown, Funnel, ListChecks, Search, Settings, Shapes, Tags, X } from '@lucide/vue'
import TagChip from '@/components/TagChip.vue'
import GalleryTagListRows, { type GalleryTagListGroup } from '@/components/gallery/GalleryTagListRows.vue'
import { useDragSelect } from '@/composables/useDragSelect'
import type { ChipRef } from '@/services/gallery/dragSelectMachine'
import { useRulePrototypeHost } from '@/composables/useRulePrototypeHost'
import { useFixedRuleStore } from '@/composables/useFixedRuleStore'
import { useSelfRatedStars } from '@/composables/useSelfRatedStars'
import { parseGalleryRef } from '@/composables/useEhSearchListing'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { isZhLocale, t } from '@/composables/useI18n'
import { DEFAULT_NS_ORDER, entryForTag, tagDbVersion } from '@/services/tags/tagDb'
import { resolveRuleEffects, type GalleryProbe, type RuleEffects } from '@/services/listing/fixedRulePrototype'
import { parseTerm, serializeEntry } from '@/services/search/searchSyntax'
import { tokenIdentity } from '@/services/search/tagState'
import { markEntriesOffPure, syncFromSearchPure, type TermEntry } from '@/services/search/sessionState'
import { loadMyTagsPalette, type MyTagsPalette } from '@/services/mytags/mytagsPalette'
import { pickUrl, savePick } from '@/services/mytags/mytagsPicks'
import { openRules, rulesCollapsed, showRules } from '@/services/appOverlays'
import { galleryMyTagsColorsEnabled, nsFormat, defaultExactMatch } from '@/services/store'
import { useEqtToast } from '@/composables/useEqtToast'
import { pageWindow } from '@/utils/pageWindow'
import '@/styles/rule-prototype.scss'

const { items, chips } = useRulePrototypeHost()
const { zhDisplay } = useDisplayConfig()
const toast = useEqtToast()
const myTagsPalette = shallowRef<MyTagsPalette | null>(null)
let paletteLoading = false
watch(() => items.value.length > 0, async available => {
  if (!available || myTagsPalette.value || paletteLoading || pageWindow<{ apiuid?: number }>().apiuid === -1) return
  paletteLoading = true
  try {
    myTagsPalette.value = await loadMyTagsPalette()
  } catch {
    toast.error(t('gallery.myTagsColorsFailed'))
  } finally {
    paletteLoading = false
  }
})
const { rules, error: rulesError } = useFixedRuleStore()
const selfRatedStars = useSelfRatedStars(items, rules, () => toast.error(t('rulePagePrototype.selfRatedFailed')))
const searchHovered = ref(false)
const searchPinned = ref(false)
const searchMenu = computed(() => searchPinned.value || searchHovered.value)
function closeSearchMenu() {
  searchPinned.value = false
  searchHovered.value = false
}
const dock = shallowRef<HTMLElement | null>(null)
const searchPanel = ref<HTMLElement | null>(null)
const selection = ref(new Map<string, 1 | -1>())
const dockSessionTerms = ref<TermEntry[]>([])

const { floatingStyles: searchFloatingStyles } = useFloating(dock, searchPanel, {
  placement: 'top',
  strategy: 'absolute',
  middleware: [flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})

const labels = computed(() => {
  void tagDbVersion.value
  const names = new Set(items.value.flatMap(item => item.tags.map(tag => tag.name)))
  return new Map([...names].map(full => {
    const entry = entryForTag(full)
    return [full, isZhLocale() ? zhDisplay(entry.name) : entry.raw]
  }))
})
function display(full: string): string {
  const known = labels.value.get(full)
  if (known) return known
  const entry = entryForTag(full)
  return isZhLocale() ? zhDisplay(entry.name) : entry.raw
}
const tagTiers = computed(() => new Map(chips.value.map(chip => [chip.name, chip.tier])))
const sessionGroups = computed<GalleryTagListGroup[]>(() => {
  void tagDbVersion.value
  const groups = new Map<string, GalleryTagListGroup>()
  for (const term of dockSessionTerms.value) {
    const parsed = parseTerm(term.positive)
    const full = `${parsed.namespace}:${parsed.tag}`
    const state = selection.value.get(full)
    const entry = entryForTag(full)
    let group = groups.get(entry.ns)
    if (!group) {
      group = {
        key: entry.ns,
        label: DEFAULT_NS_ORDER.includes(entry.ns) ? t(`ns.${entry.ns}`) : entry.ns,
        candidate: false,
        chips: [],
      }
      groups.set(entry.ns, group)
    }
    const tier = tagTiers.value.get(full) ?? 'gt'
    group.chips.push({
      tag: { tagid: 0, ns: entry.ns, raw: entry.raw, nsRaw: full, tierClass: tier, voteClass: '' },
      token: term.positive,
      display: isZhLocale() ? zhDisplay(entry.name) : entry.raw,
      selected: state === 1 ? 'positive' : state === -1 ? 'negative' : undefined,
      tier,
      iconUrl: entry.iconUrl,
      personalTag: myTagsPalette.value?.[full],
      candidate: null,
      evidence: null,
      sources: '',
    })
  }
  return [...groups.values()]
})
const dockVisible = computed(() => items.value.length > 0 && dockSessionTerms.value.length > 0)
// 規則頁預覽中：選好的標籤可以直接帶回規則頁當素材，按一下就順便返回
const previewingRules = computed(() => showRules.value && rulesCollapsed.value)
watch(dockVisible, visible => {
  if (visible) return
  closeSearchMenu()
})

const effects = computed(() => {
  const resolved = new Map<number, RuleEffects>()
  for (const item of items.value) {
    const rating = item.selfRated ? selfRatedStars.value.get(parseGalleryRef(item.href)?.gid ?? -1) ?? null : item.rating
    const probe: GalleryProbe = { tags: item.tagSet, complete: item.complete, rating, pages: item.pages }
    resolved.set(item.id, resolveRuleEffects(rules.value, probe))
  }
  return resolved
})

function clearEffects(item: { root: HTMLElement }) {
  item.root.classList.remove('eqt-rule-prototype__gallery--background', 'eqt-rule-prototype__gallery--blur')
  item.root.style.removeProperty('--eqt-rule-prototype-background')
}

watchEffect(() => {
  for (const item of items.value) {
    const effect = effects.value.get(item.id)!
    item.root.classList.toggle('eqt-rule-prototype__gallery--background', !!effect.background)
    item.root.classList.toggle('eqt-rule-prototype__gallery--blur', effect.blur)
    if (effect.background) item.root.style.setProperty('--eqt-rule-prototype-background', effect.background)
    else item.root.style.removeProperty('--eqt-rule-prototype-background')
  }
})
watch(rulesError, key => {
  if (key) toast.error(t(key))
})

function selectTag(tag: string, direction: 1 | -1) {
  const current = selection.value.get(tag) ?? 0
  const state = Math.max(-1, Math.min(1, current + direction))
  if (state === current) return
  const next = new Map(selection.value)
  if (state === 0) {
    const id = tokenIdentity(serializeEntry(entryForTag(tag)))
    if (id) dockSessionTerms.value = markEntriesOffPure(dockSessionTerms.value, new Set([id]))
    next.delete(tag)
  } else {
    next.set(tag, state as 1 | -1)
  }
  selection.value = next
}

const chipByAnchor = computed(() => new Map(chips.value.map(chip => [chip.anchor, chip])))
const tagAreas = computed(() => new Set(chips.value.map(chip => chip.area)))
let suppressContextMenu = false

function chipFor(target: EventTarget | null) {
  if (!(target instanceof Element)) return undefined
  const content = target.closest<HTMLElement>('.eqt-rule-prototype__tag-content')
  return content ? chipByAnchor.value.get(content) : undefined
}

function chipFromPoint(x: number, y: number): ChipRef | null {
  const chip = chipFor(document.elementFromPoint(x, y))
  if (!chip) return null
  return { id: chip.name, state: selection.value.get(chip.name) ?? 0 }
}

const { onAreaMouseDown } = useDragSelect({
  chipFromPoint,
  applySelection: (id, mode) => selectTag(id, mode === 'positive' ? 1 : -1),
  takeOver: true,
})

function ownsTagArea(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target.closest('.eqt-rule-prototype')) return false
  for (let element: Element | null = target; element; element = element.parentElement) {
    if (tagAreas.value.has(element as HTMLElement)) return true
    if (element.matches('a, button, input, select, textarea, [contenteditable]')) return false
  }
  return false
}

function captureTagEvent(event: Event) {
  const chip = chipFor(event.target)
  const owned = !!chip || ownsTagArea(event.target)
  if (event.type === 'mousedown') {
    if (!(event instanceof MouseEvent) || (event.button !== 0 && event.button !== 2)) return
    suppressContextMenu = owned && event.button === 2
    if (owned) onAreaMouseDown(event)
    return
  }
  if (event.type === 'contextmenu' && suppressContextMenu) {
    suppressContextMenu = false
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
  if (!owned) return
  if (event instanceof MouseEvent && event.button !== 0 && event.button !== 2) return
  if (event.type === 'pointerdown' || event.type === 'pointerup') {
    event.stopImmediatePropagation()
    return
  }
  if (event.type === 'click' && event instanceof MouseEvent && event.detail === 0 && chip) {
    selectTag(chip.name, 1)
  }
  event.preventDefault()
  event.stopImmediatePropagation()
}

const capturedEvents = ['mousedown', 'pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'dragstart'] as const
function clearSelection() {
  selection.value = new Map()
  dockSessionTerms.value = []
}
function keydown(event: KeyboardEvent) {
  if (!items.value.length) return
  if (event.key === 'Escape') closeSearchMenu()
}
const selectedTerms = computed(() => [...selection.value].map(([tag, state]) =>
  `${state === -1 ? '-' : ''}${serializeEntry(entryForTag(tag), {
    nsFormat: nsFormat.value, exactMatch: defaultExactMatch.value,
  })}`))
const searchDraft = computed(() => selectedTerms.value.join(' '))
watch(searchDraft, text => {
  dockSessionTerms.value = syncFromSearchPure(text, dockSessionTerms.value)
}, { flush: 'sync' })
async function openMyTags(): Promise<void> {
  const terms = selectedTerms.value
  if (!terms.length) return
  try {
    const href = pickUrl(location.origin, await savePick(terms))
    await GM.openInTab(href, { active: true })
    clearSelection()
  } catch {
    toast.error(t('gallery.myTagsOpenFailed'))
  }
}
function openRulesEditor() {
  openRules(selectedTerms.value)
  clearSelection()
}
const searchHref = computed(() => {
  if (!selection.value.size) return null
  const url = new URL('/', location.origin)
  url.searchParams.set('f_search', searchDraft.value)
  return url.href
})
onMounted(() => {
  document.addEventListener('keydown', keydown)
  for (const name of capturedEvents) document.addEventListener(name, captureTagEvent, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', keydown)
  for (const name of capturedEvents) document.removeEventListener(name, captureTagEvent, true)
  for (const item of items.value) clearEffects(item)
})
</script>

<template>
  <Teleport v-for="chip in chips" :key="chip.id" :to="chip.anchor">
    <TagChip
      class="eqt-rule-prototype__chip"
      :full="chip.name" :display="display(chip.name)" :tier="chip.tier" :style="chip.geometry"
      :colors="galleryMyTagsColorsEnabled ? myTagsPalette?.[chip.name] : undefined"
      :selection="selection.get(chip.name) === 1 ? 'positive' : selection.get(chip.name) === -1 ? 'negative' : undefined"
      :show-score="false" :show-marks="false"
    />
  </Teleport>

  <Teleport to="body">
    <aside
      v-if="dockVisible" ref="dock" class="eqt-rule-prototype__floating"
      :class="{ 'eqt-rule-prototype__floating--previewing': previewingRules }" translate="no"
    >
      <div class="eqt-rule-prototype__dock">
        <div class="eqt-rule-prototype__dock-tools">
          <button type="button" class="eqt-rule-prototype__settings" :title="t('settings.title')" disabled><Settings aria-hidden="true" />{{ t('settings.title') }}</button>
          <span class="eqt-rule-prototype__separator" aria-hidden="true" />
          <div
            class="eqt-rule-prototype__search-menu"
            @mouseenter="searchHovered = true"
            @mouseleave="searchHovered = false"
          >
            <button
              type="button" class="eqt-rule-prototype__selection-count"
              :aria-expanded="searchMenu" :aria-pressed="searchPinned"
              aria-live="polite" @click="searchPinned = !searchPinned"
            >
              <ListChecks aria-hidden="true" />
              <span>{{ t('rulePrototype.selectedCount', { n: selection.size }) }}</span>
              <ChevronDown class="eqt-rule-prototype__menu-chevron" aria-hidden="true" />
            </button>
            <div
              v-if="searchMenu" ref="searchPanel"
              class="eqt-rule-prototype__search-popover"
              :style="searchFloatingStyles" translate="no"
            >
              <section class="eqt-rule-prototype__panel eqt-rule-prototype__search-panel">
                <header class="eqt-rule-prototype__header">
                  <strong>{{ t('rulePrototype.selectedCount', { n: selection.size }) }}</strong>
                  <button type="button" :aria-label="t('rulePrototype.close')" @click="closeSearchMenu">×</button>
                </header>
                <GalleryTagListRows
                  :groups="sessionGroups"
                  @select="(tag, mode) => selectTag(tag, mode === 'positive' ? 1 : -1)"
                  @contextmenu.prevent
                />
              </section>
            </div>
          </div>
          <span class="eqt-rule-prototype__separator" aria-hidden="true" />
          <button
            v-if="previewingRules" type="button" class="eqt-rule-prototype__rules-toggle eqt-rule-prototype__rules-toggle--carry"
            @click="openRulesEditor"
          ><Shapes aria-hidden="true" />{{ t('rulePrototype.carryToMaterials') }}</button>
          <button v-else type="button" class="eqt-rule-prototype__rules-toggle" @click="openRulesEditor"><Funnel aria-hidden="true" />{{ t('rulePrototype.rules') }}</button>
          <span class="eqt-rule-prototype__separator" aria-hidden="true" />
          <button type="button" class="eqt-rule-prototype__mytags" :disabled="selection.size === 0" @click="openMyTags"><Tags aria-hidden="true" />{{ t('gallery.openInMyTags') }}</button>
          <span class="eqt-rule-prototype__separator" aria-hidden="true" />
          <a v-if="searchHref" class="eqt-rule-prototype__search" :href="searchHref" target="_blank" rel="noopener noreferrer"><Search aria-hidden="true" />{{ t('tagbar.search') }}</a>
          <button v-else type="button" class="eqt-rule-prototype__search" disabled><Search aria-hidden="true" />{{ t('tagbar.search') }}</button>
        </div>
        <span class="eqt-rule-prototype__separator" aria-hidden="true" />
        <button type="button" class="eqt-rule-prototype__clear" :aria-label="t('gallery.clearSelection')" :title="t('gallery.clearSelection')" @click="clearSelection"><X aria-hidden="true" /></button>
      </div>
    </aside>
  </Teleport>
</template>
