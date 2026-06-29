<script setup lang="ts">
// Gallery 詳情頁的 taglist 接管：
//   - 統一 selection Map<nsRaw, 'positive' | 'negative'>：左鍵 positive、右鍵 negative，
//     兩態互斥（再點同邊取消、點對邊覆蓋）。selection 跟 action 解耦——同一份選擇
//     可以送 search（positive=include / negative=exclude）也可以送 vote
//     (positive=+1 / negative=−1)
//   - 任何 chip click 都 setPanelTag(chip.tag)：對 x tag 的任何操作都繼續顯示定義，
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

type TagTier = 'gt' | 'gtl' | 'gtw'
type Selection = 'positive' | 'negative'

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

// === click handlers ===

function setSelection(nsRaw: string, target: Selection): void {
  const next = new Map(selection.value)
  if (next.get(nsRaw) === target) next.delete(nsRaw)
  else next.set(nsRaw, target)
  selection.value = next
}

function onChipLeftClick(chip: ChipView): void {
  setPanelTag(chip.tag)
  setSelection(chip.tag.nsRaw, 'positive')
}

function onChipRightClick(chip: ChipView, e: MouseEvent): void {
  e.preventDefault()
  setPanelTag(chip.tag)
  setSelection(chip.tag.nsRaw, 'negative')
}

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
  <div class="eqt-gallery-taglist">
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
            @click="onChipLeftClick(chip)"
            @contextmenu="onChipRightClick(chip, $event)"
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
