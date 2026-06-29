<script setup lang="ts">
// Gallery 詳情頁的 taglist 接管：
//   - 統一 selection Map<nsRaw, 'positive' | 'negative'>，state ∈ {1, 0, -1}（後者
//     用 undefined 代表）。對齊 vote 的心智模型：左鍵 +1、右鍵 −1，clamp 到 [-1, 1]
//   - selection 跟 action 解耦——同一份選擇可以送 search（positive=include /
//     negative=exclude）也可以送 vote (positive=+1 / negative=−1)
//   - drag select 走 cohort 模型：drag 只影響跟起點同態的 chip。起點 + drag 方向
//     決定 cohort 跟 transition：起點 0 + 左 = 把 0 推 1、起點 1 + 右 = 把 1 推 0
//     (cancel)、起點 -1 + 左 = 把 -1 推 0 (cancel)，依此類推
//   - 任何選取動作都 setPanelTag(chip.tag)：對 x tag 的任何操作都繼續顯示定義，
//     直到 selection 全空才 auto close panel
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { GM } from '$'
import { serializeEntry } from '@/services/searchSyntax'
import { findEntryByNsTag, DEFAULT_NS_ORDER, tagDbVersion } from '@/services/tagDb'
import { nsFormat, defaultExactMatch, newTabActive } from '@/services/store'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { t, isCJKLocale } from '@/composables/useI18n'
import { batchVote, type VoteState } from '@/services/galleryVote'
import { useToast } from 'vue-toastification'
import { parseTaglistRoot, type GalleryTag } from '@/composables/useEhGalleryHost'
import { useIntroPanel } from '@/composables/useIntroPanel'
import { Settings, Search } from '@lucide/vue'
import { useDragSelect } from '@/composables/useDragSelect'
import type { ChipRef, TriState, Selection } from '@/services/gallery/dragSelectMachine'

type TagTier = 'gt' | 'gtl' | 'gtw'

const props = defineProps<{
  tags: GalleryTag[]
  taglistEl: HTMLElement
}>()

const emit = defineEmits<{
  'open-settings': []
}>()

const toast = useToast()

const currentTags = ref<GalleryTag[]>([...props.tags])
const userVotes = ref<Record<string, VoteState>>({})

function syncUserVotesFromTags(): void {
  const v: Record<string, VoteState> = {}
  for (const tag of currentTags.value) {
    if (/\btup\b/.test(tag.voteClass)) v[tag.nsRaw] = 'up'
    else if (/\btdn\b/.test(tag.voteClass)) v[tag.nsRaw] = 'down'
    else v[tag.nsRaw] = null
  }
  userVotes.value = v
}
syncUserVotesFromTags()

function tierOf(cls: string): TagTier {
  if (/\bgtw\b/.test(cls)) return 'gtw'
  if (/\bgtl\b/.test(cls)) return 'gtl'
  return 'gt'
}

let taglistObserver: MutationObserver | null = null
onMounted(() => {
  taglistObserver = new MutationObserver(() => {
    currentTags.value = parseTaglistRoot(props.taglistEl)
    syncUserVotesFromTags()
  })
  taglistObserver.observe(props.taglistEl, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  })
})
onBeforeUnmount(() => {
  taglistObserver?.disconnect()
})

const { cjkDisplay } = useDisplayConfig()
const { setPanelTag, close: closePanel } = useIntroPanel()

const selection = ref<Map<string, Selection>>(new Map())

interface ChipView {
  tag: GalleryTag
  token: string
  display: string
  selected: Selection | undefined
  tier: TagTier
  iconUrl?: string
}

interface ChipGroup {
  ns: string
  label: string
  chips: ChipView[]
}

const groups = computed<ChipGroup[]>(() => {
  void tagDbVersion.value

  const buckets = new Map<string, ChipView[]>()
  for (const tag of currentTags.value) {
    const token = serializeEntry(
      { ns: tag.ns, raw: tag.raw },
      { nsFormat: nsFormat.value, exactMatch: defaultExactMatch.value },
    )
    const entry = findEntryByNsTag(tag.ns, tag.raw)
    const display = isCJKLocale() && entry ? cjkDisplay(entry.name) : tag.raw
    const chip: ChipView = {
      tag,
      token,
      display,
      selected: selection.value.get(tag.nsRaw),
      tier: tierOf(tag.tierClass),
      iconUrl: entry?.iconUrl,
    }
    if (!buckets.has(tag.ns)) buckets.set(tag.ns, [])
    buckets.get(tag.ns)!.push(chip)
  }

  const result: ChipGroup[] = []
  const knownNs = new Set(DEFAULT_NS_ORDER)
  for (const [ns, chips] of buckets) {
    result.push({ ns, label: knownNs.has(ns) ? t(`ns.${ns}`) : ns, chips })
  }
  return result
})

const positiveCount = computed(() =>
  [...selection.value.values()].filter(v => v === 'positive').length)
const negativeCount = computed(() =>
  [...selection.value.values()].filter(v => v === 'negative').length)
const selectedCount = computed(() => selection.value.size)

const votePending = ref(false)

// === selection update ===
// vote-style 3-state: 1/0/-1（positive / off / negative）。
// target 是「按鍵方向」：左鍵 = +1、右鍵 = −1。當前狀態 + delta 後 clamp 到 [-1, 1]：
//   off + 左 = positive；positive + 左 = positive（已上限）；negative + 左 = off
//   off + 右 = negative；negative + 右 = negative（已下限）；positive + 右 = off
function setSelection(nsRaw: string, target: Selection): void {
  const cur = selection.value.get(nsRaw)
  const curN = cur === 'positive' ? 1 : cur === 'negative' ? -1 : 0
  const delta = target === 'positive' ? 1 : -1
  const nextN = Math.max(-1, Math.min(1, curN + delta))
  if (nextN === curN) return

  const next = new Map(selection.value)
  if (nextN === 0) next.delete(nsRaw)
  else next.set(nsRaw, nextN === 1 ? 'positive' : 'negative')
  selection.value = next
}

// drag-select 狀態機跟 click 路徑封裝在 useDragSelect，邏輯放在
// services/gallery/dragSelectMachine.ts（pure reducer + property test）。
// 這裡只負責把 DOM hit-test 跟業務動作注入
function chipFromPoint(x: number, y: number): ChipRef | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  const chipEl = el?.closest<HTMLElement>('.eqt-gallery-chip')
  if (!chipEl) return null
  const nsRaw = chipEl.dataset.nsRaw
  if (!nsRaw) return null
  const s = selection.value.get(nsRaw)
  const state: TriState = s === 'positive' ? 1 : s === 'negative' ? -1 : 0
  return { id: nsRaw, state }
}

function applySelectionById(nsRaw: string, mode: Selection): void {
  setSelection(nsRaw, mode)
}

function setPanelTagById(nsRaw: string): void {
  const tag = currentTags.value.find(t => t.nsRaw === nsRaw)
  if (tag) setPanelTag(tag)
}

const { onAreaMouseDown } = useDragSelect({
  chipFromPoint,
  applySelection: applySelectionById,
  setPanelTag: setPanelTagById,
})

function onSearch(): void {
  if (selectedCount.value === 0) return
  const tokens: string[] = []
  for (const group of groups.value) {
    for (const chip of group.chips) {
      if (chip.selected === 'positive') tokens.push(chip.token)
      else if (chip.selected === 'negative') tokens.push(`-${chip.token}`)
    }
  }
  const url = new URL('/', window.location.href)
  url.searchParams.set('f_search', tokens.join(' '))
  Promise.resolve(GM.openInTab(url.href, { active: newTabActive.value })).catch(() => {})
  onClearSelection()
}

function tagsFor(target: Selection): GalleryTag[] {
  return currentTags.value.filter(t => selection.value.get(t.nsRaw) === target)
}

async function onSendBatchVotes(): Promise<void> {
  if (votePending.value) return
  const ups = tagsFor('positive')
  const downs = tagsFor('negative')
  if (ups.length === 0 && downs.length === 0) return

  votePending.value = true
  for (const tag of ups) userVotes.value[tag.nsRaw] = 'up'
  for (const tag of downs) userVotes.value[tag.nsRaw] = 'down'

  try {
    if (ups.length) await dispatchBatch(ups, 1)
    if (downs.length) await dispatchBatch(downs, -1)
  } finally {
    votePending.value = false
  }
  onClearSelection()
}

async function dispatchBatch(tags: GalleryTag[], voteValue: 1 | -1): Promise<void> {
  const response = await batchVote(tags, voteValue)
  if (response.tagpaneHtml) {
    props.taglistEl.innerHTML = response.tagpaneHtml
  } else if (response.error) {
    syncUserVotesFromTags()
  }
  if (response.error) toast.error(response.error)
  if (response.needsLogin) toast.warning(t('gallery.sessionExpired'))
  if (response.redirect) toast.info(`Redirect: ${response.redirect}`)
}

function onClearSelection(): void {
  selection.value = new Map()
}

// selection 全空時 auto close panel（user 也可 panel 內 close button 手動關）
watch(selection, () => {
  if (selection.value.size === 0) closePanel()
})
</script>

<template>
  <div
    class="eqt-gallery-taglist"
    @mousedown="onAreaMouseDown"
    @contextmenu.prevent
  >
    <div
      v-for="group in groups"
      :key="group.ns"
      class="eqt-gallery-taglist__row"
    >
      <div class="eqt-gallery-taglist__label">{{ group.label }}:</div>
      <div class="eqt-gallery-taglist__cells">
        <div
          v-for="chip in group.chips"
          :key="chip.tag.nsRaw"
          class="eqt-gallery-chip"
          :data-ns-raw="chip.tag.nsRaw"
          :class="[
            chip.selected === 'positive' && 'eqt-gallery-chip--selected-positive',
            chip.selected === 'negative' && 'eqt-gallery-chip--selected-negative',
            `eqt-gallery-chip--${chip.tier}`,
            userVotes[chip.tag.nsRaw] === 'up' && 'eqt-gallery-chip--voted-up',
            userVotes[chip.tag.nsRaw] === 'down' && 'eqt-gallery-chip--voted-down',
          ]"
        >
          <button
            type="button"
            class="eqt-gallery-chip__body"
          >
            <img v-if="chip.iconUrl" :src="chip.iconUrl" class="eqt-tag-icon" alt="" />{{ chip.display }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Action 區：3 欄 × 2 列 grid。search 左跨 2 列、vote 右跨 2 列（兩個大方塊，
       物理距離把誤觸代價較高的 vote 跟 search 隔開）。中間欄第 1 列 Browse、
       第 2 列 Clear + Settings -->
  <div class="eqt-gallery-actions">
    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--search"
      :disabled="selectedCount === 0"
      @click="onSearch"
    >
      <Search :size="20" />
      <span>{{ t('gallery.searchN', { n: String(selectedCount) }) }}</span>
    </button>

    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--browse"
      disabled
      :title="t('gallery.browseTags')"
    >
      {{ t('gallery.browseTags') }}
    </button>

    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--clear"
      :disabled="selectedCount === 0"
      @click="onClearSelection"
    >
      {{ t('gallery.clearSelection') }}
    </button>

    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--settings eqt-gallery-actions__btn--icon"
      :title="t('settings.title')"
      @click="emit('open-settings')"
    >
      <Settings :size="14" />
    </button>

    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--vote"
      :disabled="selectedCount === 0 || votePending"
      @click="onSendBatchVotes"
    >
      <span class="eqt-gallery-actions__vote-counts">↑{{ positiveCount }} ↓{{ negativeCount }}</span>
      <span>{{ t('gallery.vote') }}</span>
    </button>
  </div>
</template>
