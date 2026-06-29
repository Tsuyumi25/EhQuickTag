<script setup lang="ts">
// Gallery 詳情頁的 taglist 接管（foundation）：只展示 chip + 提供「插件 / 原生」
// debug toggle，沒接 click handler、沒投票、沒 search 互動——這些後續 commit 增加
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { findEntryByNsTag, DEFAULT_NS_ORDER, tagDbVersion } from '@/services/tagDb'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { t, isCJKLocale } from '@/composables/useI18n'
import { parseTaglistRoot, type GalleryTag } from '@/composables/useEhGalleryHost'

type TagTier = 'gt' | 'gtl' | 'gtw'
type VoteState = 'up' | 'down' | null

const props = defineProps<{
  tags: GalleryTag[]
  taglistEl: HTMLElement
}>()

// 臨時 debug toggle：切「原生 / 插件」taglist 樣式做對照。預設 false = 插件模式
// （useEhGalleryHost 同步加的 body.eqt-gallery-plugin-active 已 hide 原生）。
// 切到 true = 移除 body class → 原生 #eqt-native-wrap 解除 visibility、我們的
// chip 區自己用 .__chips 內 css 處理隱藏；toggle 按鈕永遠 visible（不然回不來）
const showNative = ref(false)
watch(showNative, (val) => {
  document.body.classList.toggle('eqt-gallery-plugin-active', !val)
})
onBeforeUnmount(() => {
  document.body.classList.remove('eqt-gallery-plugin-active')
})

// currentTags：mutable working copy。兩個來源會更新：
//   1. 初始 mount：props.tags（mount 那刻 useEhGalleryHost 的 scrape）
//   2. MutationObserver：原生 tag_from_field 或撤銷自家標籤會改 #taglist、observer 觸發
const currentTags = ref<GalleryTag[]>([...props.tags])

// userVotes 從 currentTags.voteClass 同步——同一條真實源頭，避免漂移
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

// gt / gtl / gtw → 邊框實線 / 虛線 / 點虛線（native EH 用這 3 個 class 區分 tier）
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

interface ChipView {
  tag: GalleryTag
  display: string
  tier: TagTier
  iconUrl?: string
}

interface ChipGroup {
  ns: string
  label: string
  chips: ChipView[]
}

const groups = computed<ChipGroup[]>(() => {
  // tagDbVersion 是 async loadTagDb 完成的 reactive signal——沒這條 chip 文字第一輪
  // 顯示 raw、DB 載完後不會自動翻成 CJK
  void tagDbVersion.value

  const buckets = new Map<string, ChipView[]>()
  for (const tag of currentTags.value) {
    const entry = findEntryByNsTag(tag.ns, tag.raw)
    const display = isCJKLocale() && entry ? cjkDisplay(entry.name) : tag.raw
    const chip: ChipView = {
      tag,
      display,
      tier: tierOf(tag.tierClass),
      iconUrl: entry?.iconUrl,
    }
    if (!buckets.has(tag.ns)) buckets.set(tag.ns, [])
    buckets.get(tag.ns)!.push(chip)
  }

  // 順序跟 gallery 原 #taglist 一致（buckets Map 已照 currentTags scrape 順序排好）
  // ns label：已知走翻譯、未知 fallback raw
  const result: ChipGroup[] = []
  const knownNs = new Set(DEFAULT_NS_ORDER)
  for (const [ns, chips] of buckets) {
    result.push({ ns, label: knownNs.has(ns) ? t(`ns.${ns}`) : ns, chips })
  }
  return result
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
              `eqt-gallery-chip--${chip.tier}`,
              userVotes[chip.tag.nsRaw] === 'up' && 'eqt-gallery-chip--voted-up',
              userVotes[chip.tag.nsRaw] === 'down' && 'eqt-gallery-chip--voted-down',
            ]"
          >
            <div class="eqt-gallery-chip__body">
              <img v-if="chip.iconUrl" :src="chip.iconUrl" class="eqt-tag-icon" alt="" />{{ chip.display }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="eqt-gallery-taglist__actions">
      <button
        type="button"
        class="eqt-gallery-taglist__action-btn"
        :title="showNative ? '切回插件樣式' : '切換到原生樣式'"
        @click="showNative = !showNative"
      >{{ showNative ? '插件' : '原生' }}</button>
    </div>
  </div>
</template>
