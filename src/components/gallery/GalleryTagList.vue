<script setup lang="ts">
// Gallery 詳情頁的 taglist 接管：
//   - chip 左右鍵依 galleryTaglistMode 分流：
//     search mode → 左 toggle Include/Off、右 cycle Or → Exclude → Off (TagBar 模型)
//     vote mode → 左 toggle voteSelected up、右 toggle voteSelected down
//       (一個 tag 在 vote 維度只有 3 態互斥：off / up / down，存進單一 Map)
//   - 任何 click 都 setPanelTag(chip.tag)：對 x tag 的任何操作都繼續顯示定義，
//     直到 search + vote 兩個 list 都空才 auto close panel
//   - 底部兩排 action 永久 visible（原生模式 chip 區 hide、actions 不能跟著否則切回不去）
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { GM } from '$'
import { parseTerm, serializeEntry } from '@/services/searchSyntax'
import { tokenize, tokenIdentity, buildIdentityIndex, getNextRightClickState, setTagState, removeTag } from '@/services/tagState'
import { findEntryByNsTag, DEFAULT_NS_ORDER, tagDbVersion } from '@/services/tagDb'
import { nsFormat, defaultExactMatch, newTabActive, galleryTaglistMode } from '@/services/store'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { t, isCJKLocale } from '@/composables/useI18n'
import { batchVote, type VoteState } from '@/services/galleryVote'
import { useToast } from 'vue-toastification'
import { parseTaglistRoot, type GalleryTag } from '@/composables/useEhGalleryHost'
import { useIntroPanel } from '@/composables/useIntroPanel'
import { Settings } from '@lucide/vue'
import { TagState } from '@/types'

type TagTier = 'gt' | 'gtl' | 'gtw'
type VotePending = 'up' | 'down'

const props = defineProps<{
  tags: GalleryTag[]
  taglistEl: HTMLElement
}>()

const emit = defineEmits<{
  'open-settings': []
}>()

const toast = useToast()

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
const { setPanelTag, close: closePanel } = useIntroPanel()

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

const voteSelected = ref<Map<string, VotePending>>(new Map())

function setVotePending(nsRaw: string, target: VotePending): void {
  const next = new Map(voteSelected.value)
  if (next.get(nsRaw) === target) next.delete(nsRaw)
  else next.set(nsRaw, target)
  voteSelected.value = next
}

const upSelectedCount = computed(() =>
  [...voteSelected.value.values()].filter(v => v === 'up').length)
const downSelectedCount = computed(() =>
  [...voteSelected.value.values()].filter(v => v === 'down').length)

const votePending = ref(false)

// === click handlers ===

function applyState(token: string, next: TagState): void {
  if (next === TagState.Off) {
    modelValue.value = removeTag(modelValue.value, [token])
  } else {
    modelValue.value = setTagState(modelValue.value, [token], next)
  }
}

function onChipLeftClick(chip: ChipView): void {
  setPanelTag(chip.tag)
  if (galleryTaglistMode.value === 'vote') {
    setVotePending(chip.tag.nsRaw, 'up')
    return
  }
  const next = chip.state === TagState.Include ? TagState.Off : TagState.Include
  applyState(chip.token, next)
}

function onChipRightClick(chip: ChipView, e: MouseEvent): void {
  e.preventDefault()
  setPanelTag(chip.tag)
  if (galleryTaglistMode.value === 'vote') {
    setVotePending(chip.tag.nsRaw, 'down')
    return
  }
  const next = getNextRightClickState([chip.token], undefined, chip.state)
  if (next === null) return
  applyState(chip.token, next)
}

function onSearch(): void {
  if (searchSelectedCount.value === 0) return
  const url = new URL('/', window.location.href)
  url.searchParams.set('f_search', modelValue.value)
  Promise.resolve(GM.openInTab(url.href, { active: newTabActive.value })).catch(() => {})
  onClearSelection()
}

function tagsFor(target: VotePending): GalleryTag[] {
  return currentTags.value.filter(t => voteSelected.value.get(t.nsRaw) === target)
}

async function onSendBatchVotes(): Promise<void> {
  if (votePending.value) return
  const ups = tagsFor('up')
  const downs = tagsFor('down')
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
  modelValue.value = ''
  voteSelected.value = new Map()
}

// 對齊 user「直到選取都被清除才 off define」的語意：search + vote 兩個 list 全空
// 時 auto close panel（user 也可 panel 內 close button 手動關）
watch([modelValue, voteSelected], () => {
  if (modelValue.value === '' && voteSelected.value.size === 0) {
    closePanel()
  }
})
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
              voteSelected.get(chip.tag.nsRaw) === 'up' && 'eqt-gallery-chip--vote-up-pending',
              voteSelected.get(chip.tag.nsRaw) === 'down' && 'eqt-gallery-chip--vote-down-pending',
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
        v-if="galleryTaglistMode === 'search'"
        type="button"
        class="eqt-gallery-taglist__action-btn"
        :disabled="searchSelectedCount === 0"
        @click="onSearch"
      >
        {{ t('gallery.searchN', { n: String(searchSelectedCount) }) }}
      </button>
      <button
        v-if="galleryTaglistMode === 'vote'"
        type="button"
        class="eqt-gallery-taglist__action-btn"
        :disabled="(upSelectedCount === 0 && downSelectedCount === 0) || votePending"
        @click="onSendBatchVotes"
      >
        {{ t('gallery.sendBatchVote', { u: String(upSelectedCount), d: String(downSelectedCount) }) }}
      </button>
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn"
        :disabled="searchSelectedCount === 0 && upSelectedCount === 0 && downSelectedCount === 0"
        @click="onClearSelection"
      >
        {{ t('gallery.clearSelection') }}
      </button>
    </div>

    <!-- Row 2: mode 切換 + 設定 -->
    <div class="eqt-gallery-taglist__actions">
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn"
        :title="galleryTaglistMode === 'search' ? t('gallery.modeSearchTitle') : t('gallery.modeVoteTitle')"
        @click="galleryTaglistMode = galleryTaglistMode === 'search' ? 'vote' : 'search'"
      >{{ galleryTaglistMode === 'search' ? t('gallery.modeSearch') : t('gallery.modeVote') }}</button>
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn"
        :title="showNative ? '切回插件樣式' : '切換到原生樣式'"
        @click="showNative = !showNative"
      >{{ showNative ? '插件' : '原生' }}</button>
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn eqt-gallery-taglist__action-btn--icon"
        :title="t('settings.title')"
        @click="emit('open-settings')"
      >
        <Settings :size="14" />
      </button>
    </div>
  </div>
</template>
