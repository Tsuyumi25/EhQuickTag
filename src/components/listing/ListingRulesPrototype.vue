<script setup lang="ts">
// 列表頁：選標籤送規則頁，並把規則頁存下來的固定規則套回真實畫廊外觀。
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { GM } from '$'
import { useFloating, autoUpdate, flip, offset, shift } from '@floating-ui/vue'
import { ChevronDown, Eye, Funnel, ListChecks, Search, Settings, Shapes, Tags, UserRound, X } from '@lucide/vue'
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
import {
  conditionRange, resolveRuleEffects, type GalleryProbe, type RangeCondition, type RuleEffects,
} from '@/services/listing/fixedRulePrototype'
import { formatRange } from '@/services/listing/ruleDigest'
import { CATEGORY_LABELS } from '@/services/listing/galleryCategory'
import { parseTerm, serializeEntry } from '@/services/search/searchSyntax'
import { tokenIdentity } from '@/services/search/tagState'
import { markEntriesOffPure, syncFromSearchPure, type TermEntry } from '@/services/search/sessionState'
import { loadMyTagsPalette, type MyTagsPalette } from '@/services/mytags/mytagsPalette'
import { pickUrl, savePick } from '@/services/mytags/mytagsPicks'
import { openRule, openRules, openSettings, rulesCollapsed, showRules } from '@/services/appOverlays'
import {
  defaultExactMatch, listingDockAlwaysVisible, listingMyTagsColorsEnabled, listingMyTagsMarksEnabled, listingMyTagsScoresEnabled,
  listingRulesPaused, listingTagLayout, listingTagSelectEnabled, listingTagsEnabled, nsFormat,
} from '@/services/store'
import { useEqtToast } from '@/composables/useEqtToast'
import { pageWindow } from '@/utils/pageWindow'
import '@/styles/rule-prototype.scss'

const { items, chips } = useRulePrototypeHost({ tagsEnabled: () => listingTagsEnabled.value, tagLayout: () => listingTagLayout.value })
// 圖庫規則是圖庫列表強化的一部分：關掉時規則也不套用，跟暫停一樣
const rulesActive = computed(() => listingTagsEnabled.value && !listingRulesPaused.value)
// 選取做在 chip 上：標籤沒換成 chip 時沒有東西可選
const tagSelectEnabled = computed(() => listingTagsEnabled.value && listingTagSelectEnabled.value)
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
    // 上傳者在搜尋語法裡是 uploader: 限定詞，沒有 namespace；選取的 key 跟列表上的 chip 一樣寫成 uploader:名稱
    const full = parsed.qualifier === 'uploader' ? `uploader:${parsed.tag}` : `${parsed.namespace}:${parsed.tag}`
    const state = selection.value.get(full)
    const entry = entryForTag(full)
    let group = groups.get(entry.ns)
    if (!group) {
      group = {
        key: entry.ns,
        label: DEFAULT_NS_ORDER.includes(entry.ns) ? t(`ns.${entry.ns}`) : entry.ns === 'uploader' ? t('rulePagePrototype.uploader') : entry.ns,
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
// dock 開不開跟選取分開：選了第一個標籤時打開，取消選取不會收起來，只有關閉會——關閉一律連選取一起清掉。
// 規則頁開著時 dock 一直在：預覽、返回與關閉都在這裡，沒選標籤也要按得到
const dockOpen = ref(false)
watch(() => selection.value.size, (size, before) => {
  if (size > 0 && before === 0) dockOpen.value = true
})
// 規則頁的 dock 是規則介面的一部分，不受列表的標籤選取設定影響
const dockVisible = computed(() => showRules.value
  || (items.value.length > 0 && tagSelectEnabled.value && (dockOpen.value || listingDockAlwaysVisible.value)))
function closeDock() {
  clearSelection()
  dockOpen.value = false
}
// 規則頁不論從哪裡關（dock 上的關閉、規則頁右上角、Esc），都跟 dock 的關閉同一件事
watch(showRules, (open, wasOpen) => {
  if (wasOpen && !open) closeDock()
})
watch(dockVisible, visible => {
  if (visible) return
  closeSearchMenu()
})

const effects = computed(() => {
  const resolved = new Map<number, RuleEffects>()
  for (const item of items.value) {
    const rating = item.selfRated ? selfRatedStars.value.get(parseGalleryRef(item.href)?.gid ?? -1) ?? null : item.rating
    const probe: GalleryProbe = {
      tags: item.tagSet, complete: item.complete, rating, pages: item.pages, category: item.category, uploader: item.uploader,
    }
    resolved.set(item.id, resolveRuleEffects(rulesActive.value ? rules.value : [], probe))
  }
  return resolved
})

const labelTargets = computed(() => items.value.flatMap(item => {
  const labels = effects.value.get(item.id)?.labels ?? []
  return item.labelAnchor && labels.length ? [{ id: item.id, anchor: item.labelAnchor, labels }] : []
}))

const prefixTargets = computed(() => items.value.flatMap(item => {
  const prefixes = effects.value.get(item.id)?.prefixes ?? []
  return item.titleAnchor && prefixes.length ? [{ id: item.id, anchor: item.titleAnchor, prefixes }] : []
}))

function toneStyle(tone: string | null) {
  return tone ? { '--eqt-rule-prototype-tone': tone } : undefined
}
function rangeText(condition: RangeCondition) {
  return `${t(`rulePagePrototype.${condition.kind}`)} ${formatRange(condition.kind, conditionRange(condition))}`
}

// 命中原因：滑鼠停在（或鍵盤移到）圖庫上的規則名稱時浮出來
type ShownLabel = RuleEffects['labels'][number]
const whyAnchor = shallowRef<HTMLElement | null>(null)
const whyLabel = shallowRef<ShownLabel | null>(null)
const whyPanel = ref<HTMLElement | null>(null)
const { floatingStyles: whyFloatingStyles } = useFloating(whyAnchor, whyPanel, {
  placement: 'bottom',
  middleware: [offset(4), flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})
function showWhy(event: Event, label: ShownLabel) {
  whyAnchor.value = event.currentTarget as HTMLElement
  whyLabel.value = label
}
function hideWhy() {
  whyAnchor.value = null
  whyLabel.value = null
}
watch(labelTargets, targets => {
  if (whyAnchor.value && !targets.some(target => target.anchor.contains(whyAnchor.value))) hideWhy()
})

const MODIFIERS = ['background', 'blur', 'dim', 'strike', 'hidden'] as const
type Modifier = (typeof MODIFIERS)[number]

function clearEffects(item: { root: HTMLElement }) {
  item.root.classList.remove(...MODIFIERS.map(name => `eqt-rule-prototype__gallery--${name}`))
  item.root.style.removeProperty('--eqt-rule-prototype-background')
}

watchEffect(() => {
  for (const item of items.value) {
    const effect = effects.value.get(item.id)!
    const active: Record<Modifier, boolean> = {
      'background': !!effect.background,
      'blur': effect.blur,
      'dim': effect.dim,
      'strike': effect.strike,
      'hidden': effect.hide,
    }
    for (const name of MODIFIERS) item.root.classList.toggle(`eqt-rule-prototype__gallery--${name}`, active[name])
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
// 關掉標籤選取時不攔任何事件，點標籤照原生行為；已經選了的一併清掉，不然標籤上的選取色會留著
function listenTagEvents(enabled: boolean) {
  for (const name of capturedEvents) {
    if (enabled) document.addEventListener(name, captureTagEvent, true)
    else document.removeEventListener(name, captureTagEvent, true)
  }
}
watch(tagSelectEnabled, enabled => {
  listenTagEvents(enabled)
  if (!enabled) closeDock()
})
onMounted(() => {
  document.addEventListener('keydown', keydown)
  listenTagEvents(tagSelectEnabled.value)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', keydown)
  listenTagEvents(false)
  for (const item of items.value) clearEffects(item)
})
</script>

<template>
  <Teleport v-for="chip in chips" :key="chip.id" :to="chip.anchor">
    <TagChip
      class="eqt-rule-prototype__chip"
      :full="chip.name" :display="display(chip.name)" :tier="chip.tier" :style="chip.geometry"
      :colors="listingMyTagsColorsEnabled ? myTagsPalette?.[chip.name] : undefined"
      :weight="myTagsPalette?.[chip.name]?.weight" :hidden="myTagsPalette?.[chip.name]?.hidden" :watch="myTagsPalette?.[chip.name]?.watch"
      :selection="selection.get(chip.name) === 1 ? 'positive' : selection.get(chip.name) === -1 ? 'negative' : undefined"
      :show-score="listingMyTagsScoresEnabled" :show-marks="listingMyTagsMarksEnabled"
    ><template v-if="chip.uploader" #lead><UserRound :aria-label="t('rulePagePrototype.uploader')" /></template></TagChip>
  </Teleport>

  <Teleport v-for="target in labelTargets" :key="target.id" :to="target.anchor">
    <TagChip
      v-for="label in target.labels" :key="label.ruleId"
      class="eqt-rule-prototype__label" :class="{ 'eqt-rule-prototype__label--toned': label.tone }"
      :full="label.text" :display="label.text" :show-score="false" :show-marks="false" :style="toneStyle(label.tone)"
      @pick="openRule(label.ruleId)"
      @mouseenter="showWhy($event, label)" @mouseleave="hideWhy" @focusin="showWhy($event, label)" @focusout="hideWhy"
    ><template #lead><Funnel aria-hidden="true" /></template></TagChip>
  </Teleport>

  <Teleport v-for="target in prefixTargets" :key="target.id" :to="target.anchor">
    <span
      v-for="prefix in target.prefixes" :key="prefix.ruleId" class="eqt-rule-prototype__prefix" :style="toneStyle(prefix.tone)"
    >{{ prefix.text }}</span>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="whyLabel" ref="whyPanel" class="eqt-rule-prototype eqt-rule-prototype__why" :style="[whyFloatingStyles, toneStyle(whyLabel.tone)]"
      role="tooltip" translate="no"
    >
      <b>{{ whyLabel.text }}</b>
      <span
        v-for="category in whyLabel.evidence.categories" :key="category" class="eqt-rule-prototype__why-term"
      >{{ CATEGORY_LABELS[category] }}</span>
      <span v-for="uploader in whyLabel.evidence.uploaders" :key="`uploader:${uploader}`" class="eqt-rule-prototype__why-term">
        <UserRound class="eqt-rule-prototype__why-icon" aria-hidden="true" />{{ uploader }}
      </span>
      <span v-for="tag in whyLabel.evidence.tags" :key="tag" class="eqt-rule-prototype__why-term">{{ display(tag) }}</span>
      <span
        v-for="condition in whyLabel.evidence.ranges" :key="condition.id" class="eqt-rule-prototype__why-term"
      >{{ rangeText(condition) }}</span>
    </div>
  </Teleport>

  <Teleport to="body">
    <aside v-if="dockVisible" ref="dock" class="eqt-rule-prototype__floating" translate="no">
      <div class="eqt-rule-prototype__dock">
        <div class="eqt-rule-prototype__dock-tools">
          <template v-if="!showRules">
            <button type="button" class="eqt-rule-prototype__settings" @click="openSettings('listing')"><Settings aria-hidden="true" />{{ t('settings.title') }}</button>
            <span class="eqt-rule-prototype__separator" aria-hidden="true" />
          </template>
          <!-- 兩種 dock 都把取消選取放在選取數的左邊，跟它操作的東西貼在一起 -->
          <button type="button" class="eqt-rule-prototype__deselect" :disabled="selection.size === 0" @click="clearSelection">
            <X aria-hidden="true" />{{ t('gallery.clearSelection') }}
          </button>
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
          <!-- 規則介面開著時 dock 只做規則的事；右端的關閉跟規則介面的關閉同一件事，關掉之後才回到平常的 dock -->
          <template v-if="showRules">
            <!-- 預覽排在 dock 正中間；預覽中這顆換成回到規則介面，圖示與「圖庫規則」同一個漏斗 -->
            <button
              type="button" class="eqt-rule-prototype__preview" :aria-pressed="rulesCollapsed" aria-keyshortcuts="Space"
              @click="rulesCollapsed = !rulesCollapsed"
            >
              <component :is="rulesCollapsed ? Funnel : Eye" aria-hidden="true" />
              {{ t(rulesCollapsed ? 'rulePagePrototype.backToRules' : 'rulePagePrototype.preview') }}
              <kbd class="eqt-rule-prototype__kbd">{{ t('rulePagePrototype.spaceKey') }}</kbd>
            </button>
            <button
              type="button" class="eqt-rule-prototype__carry" :disabled="selection.size === 0" @click="openRulesEditor"
            ><Shapes aria-hidden="true" />{{ t('rulePrototype.carryToMaterials') }}</button>
          </template>
          <template v-else>
            <button type="button" class="eqt-rule-prototype__rules-toggle" @click="openRulesEditor"><Funnel aria-hidden="true" />{{ t('rulePrototype.rules') }}</button>
            <span class="eqt-rule-prototype__separator" aria-hidden="true" />
            <button type="button" class="eqt-rule-prototype__mytags" :disabled="selection.size === 0" @click="openMyTags"><Tags aria-hidden="true" />{{ t('gallery.openInMyTags') }}</button>
            <span class="eqt-rule-prototype__separator" aria-hidden="true" />
            <a v-if="searchHref" class="eqt-rule-prototype__search" :href="searchHref" target="_blank" rel="noopener noreferrer"><Search aria-hidden="true" />{{ t('tagbar.search') }}</a>
            <button v-else type="button" class="eqt-rule-prototype__search" disabled><Search aria-hidden="true" />{{ t('tagbar.search') }}</button>
          </template>
        </div>
        <!-- 規則頁開著時關的是規則頁，showRules 的 watch 會接著關 dock；兩種情況選取都會清掉。
             設成始終顯示時，普通 dock 關不掉，清選取交給左邊的取消選取 -->
        <template v-if="showRules || !listingDockAlwaysVisible">
          <span class="eqt-rule-prototype__separator" aria-hidden="true" />
          <button type="button" class="eqt-rule-prototype__close" @click="showRules ? showRules = false : closeDock()">
            <X aria-hidden="true" />{{ t('rulePrototype.close') }}
          </button>
        </template>
      </div>
    </aside>
  </Teleport>
</template>
