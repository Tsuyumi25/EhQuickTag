<script setup lang="ts">
// Gallery 詳情頁的 taglist 接管：
//   - chip 左鍵 toggle Include/Off、右鍵 cycle Or → Exclude → Off（對齊 TagBar 模型）
//   - 底部兩排 action：row 1 是執行類（搜索 / 取消選取）、row 2 是 mode 切換 + 設定
//   - 兩排永久 visible：原生模式下我們的 chips 區會 hide，actions 不能跟著否則切回不去
//
// 狀態管理選擇本地 ref `modelValue` 而非接 searchSession——gallery 頁無 #f_search、
// 跟列表頁的 search session 是兩個獨立 context，第一輪不做跨頁同步
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { GM } from '$'
import { parseTerm, serializeEntry } from '@/services/searchSyntax'
import { tokenize, tokenIdentity, buildIdentityIndex, getNextRightClickState, setTagState, removeTag } from '@/services/tagState'
import { findEntryByNsTag, DEFAULT_NS_ORDER, tagDbVersion } from '@/services/tagDb'
import { nsFormat, defaultExactMatch, newTabActive } from '@/services/store'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { t, isCJKLocale } from '@/composables/useI18n'
import { parseTaglistRoot, type GalleryTag } from '@/composables/useEhGalleryHost'
import { TagState } from '@/types'

type TagTier = 'gt' | 'gtl' | 'gtw'
type VoteState = 'up' | 'down' | null

const props = defineProps<{
  tags: GalleryTag[]
  taglistEl: HTMLElement
}>()

const modelValue = ref('')

const showNative = ref(false)
watch(showNative, (val) => {
  document.body.classList.toggle('eqt-gallery-plugin-active', !val)
})
onBeforeUnmount(() => {
  document.body.classList.remove('eqt-gallery-plugin-active')
})

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

const identityIndex = computed(() => buildIdentityIndex(tokenize(modelValue.value)))

interface ChipView {
  tag: GalleryTag
  token: string
  display: string
  state: TagState
  tier: TagTier
  iconUrl?: string
}

const STATE_CLASS: Record<TagState, string> = {
  [TagState.Include]: 'eqt-gallery-chip--include',
  [TagState.Or]:      'eqt-gallery-chip--or',
  [TagState.Exclude]: 'eqt-gallery-chip--exclude',
  [TagState.Off]:     'eqt-gallery-chip--off',
}

function stateOf(token: string): TagState {
  const id = tokenIdentity(token)
  if (!id) return TagState.Off
  const present = identityIndex.value.get(id)
  if (!present) return TagState.Off
  const prefix = parseTerm(present).prefix
  if (prefix === '-') return TagState.Exclude
  if (prefix === '~') return TagState.Or
  return TagState.Include
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
      state: stateOf(token),
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

const searchSelectedCount = computed(() =>
  groups.value.reduce((acc, g) =>
    acc + g.chips.filter(c => c.state !== TagState.Off).length, 0),
)

// === click handlers ===

function applyState(token: string, next: TagState): void {
  if (next === TagState.Off) {
    modelValue.value = removeTag(modelValue.value, [token])
  } else {
    modelValue.value = setTagState(modelValue.value, [token], next)
  }
}

function onChipLeftClick(chip: ChipView): void {
  const next = chip.state === TagState.Include ? TagState.Off : TagState.Include
  applyState(chip.token, next)
}

function onChipRightClick(chip: ChipView, e: MouseEvent): void {
  e.preventDefault()
  const next = getNextRightClickState([chip.token], undefined, chip.state)
  if (next === null) return
  applyState(chip.token, next)
}

function onSearch(): void {
  if (searchSelectedCount.value === 0) return
  const url = new URL('/', window.location.href)
  url.searchParams.set('f_search', modelValue.value)
  // fire-and-forget；GM.openInTab 視 manager 實作回 control 物件或 Promise，
  // Promise.resolve 收齊兩種、`.catch` 兜底避免 unhandled rejection 噴 console
  Promise.resolve(GM.openInTab(url.href, { active: newTabActive.value })).catch(() => {})
  onClearSelection()
}

function onClearSelection(): void {
  modelValue.value = ''
}
</script>

<template>
  <div class="eqt-gallery-taglist">
    <div class="eqt-gallery-taglist__chips">
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
              STATE_CLASS[chip.state],
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

    <!-- Row 1: 執行類 action -->
    <div class="eqt-gallery-taglist__actions">
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn"
        disabled
        :title="t('gallery.browseTags')"
      >
        {{ t('gallery.browseTags') }}
      </button>
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn"
        :disabled="searchSelectedCount === 0"
        @click="onSearch"
      >
        {{ t('gallery.searchN', { n: String(searchSelectedCount) }) }}
      </button>
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn"
        :disabled="searchSelectedCount === 0"
        @click="onClearSelection"
      >
        {{ t('gallery.clearSelection') }}
      </button>
    </div>

    <!-- Row 2: mode 切換 + 設定 (mode toggle / 設定 button 暫時 disabled、後續 commit 接邏輯) -->
    <div class="eqt-gallery-taglist__actions">
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn"
        disabled
      >{{ t('gallery.modeSearch') }}</button>
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn"
        :title="showNative ? '切回插件樣式' : '切換到原生樣式'"
        @click="showNative = !showNative"
      >{{ showNative ? '插件' : '原生' }}</button>
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn"
        disabled
      >⚙</button>
    </div>
  </div>
</template>
