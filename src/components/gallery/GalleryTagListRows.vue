<script lang="ts">
import type { GalleryTag } from '@/composables/useEhGalleryHost'
import type { TagTier } from '@/composables/useEhGalleryPreview'
import type { MyTagsPalette } from '@/services/mytags/mytagsPalette'
import type { Selection } from '@/services/gallery/dragSelectMachine'

export interface GalleryTagListChip {
  tag: GalleryTag
  token: string
  display: string
  selected: Selection | undefined
  tier: TagTier
  iconUrl?: string
  personalTag?: MyTagsPalette[string]
  candidate: 'added' | 'imported' | null
  /** 別本提供的佐證；本頁已有的實線標籤省略 */
  evidence: 'solid' | 'dashed' | 'dotted' | null
  /** 開頭記號的 hover 說明：從哪幾本帶進來 */
  sources: string
}

export interface GalleryTagListGroup {
  key: string
  /** 空字串代表緊接在同 ns 的真標籤列底下：ns 欄改畫 corner-left-up 指回上一列 */
  label: string
  candidate: boolean
  chips: GalleryTagListChip[]
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  galleryMyTagsColorsEnabled, galleryMyTagsScoresEnabled, galleryMyTagsMarksEnabled, galleryTaglistZoom,
  listingMyTagsColorsEnabled, listingMyTagsScoresEnabled, listingMyTagsMarksEnabled,
} from '@/services/store'
import { useDragSelect } from '@/composables/useDragSelect'
import type { ChipRef, TriState } from '@/services/gallery/dragSelectMachine'
import type { VoteState } from '@/services/gallery/galleryVote'
import { CornerLeftUp, TagPlus, CircleCheck, CircleDashedCheck } from '@lucide/vue'
import { CircleDottedCheck } from './circleDottedCheck'
import TagChip from '@/components/TagChip.vue'

const props = defineProps<{
  groups: readonly GalleryTagListGroup[]
  /** 標籤外觀跟著哪一頁的設定走：列表的 dock 也借這份清單來顯示 */
  scene: 'gallery' | 'listing'
  userVotes?: Record<string, VoteState>
}>()

const APPEARANCE = {
  gallery: { colors: galleryMyTagsColorsEnabled, scores: galleryMyTagsScoresEnabled, marks: galleryMyTagsMarksEnabled },
  listing: { colors: listingMyTagsColorsEnabled, scores: listingMyTagsScoresEnabled, marks: listingMyTagsMarksEnabled },
}
const appearance = computed(() => APPEARANCE[props.scene])

const emit = defineEmits<{
  select: [nsRaw: string, mode: Selection]
  inspect: [nsRaw: string]
  dblclick: [event: MouseEvent]
  contextmenu: [event: MouseEvent]
}>()

const taglistEl = ref<HTMLElement | null>(null)

const selectionByNsRaw = computed(() => {
  const map = new Map<string, Selection>()
  for (const group of props.groups) {
    for (const chip of group.chips) {
      if (chip.selected) map.set(chip.tag.nsRaw, chip.selected)
    }
  }
  return map
})

function chipFromPoint(x: number, y: number): ChipRef | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  const chipEl = el?.closest<HTMLElement>('.eqt-gallery-chip')
  if (!chipEl || !taglistEl.value?.contains(chipEl)) return null
  const nsRaw = chipEl.dataset.nsRaw
  if (!nsRaw) return null
  const s = selectionByNsRaw.value.get(nsRaw)
  const state: TriState = s === 'positive' ? 1 : s === 'negative' ? -1 : 0
  return { id: nsRaw, state }
}

const { onAreaMouseDown } = useDragSelect({
  chipFromEvent: event => chipFromPoint(event.clientX, event.clientY),
  applySelection: (nsRaw, mode) => emit('select', nsRaw, mode),
  setPanelTag: (nsRaw) => emit('inspect', nsRaw),
})
</script>

<template>
  <div
    ref="taglistEl"
    class="eqt-gallery-taglist"
    :style="{ zoom: galleryTaglistZoom / 100 }"
    @mousedown="onAreaMouseDown"
    @dblclick="emit('dblclick', $event)"
    @contextmenu="emit('contextmenu', $event)"
  >
    <div
      v-for="group in groups"
      :key="group.key"
      class="eqt-gallery-taglist__row"
    >
      <div class="eqt-gallery-taglist__label">
        <template v-if="group.label">{{ group.label }}:</template>
        <CornerLeftUp v-else-if="group.candidate" class="eqt-gallery-taglist__label-icon" />
      </div>
      <div class="eqt-gallery-taglist__cells" :class="{ 'eqt-gallery-taglist__cells--candidate': group.candidate }">
        <TagChip
          v-for="chip in group.chips"
          :key="chip.tag.nsRaw"
          :full="chip.tag.nsRaw"
          :display="chip.display"
          :icon-url="chip.iconUrl"
          :tier="chip.tier"
          :colors="appearance.colors.value ? chip.personalTag : undefined"
          :weight="chip.personalTag?.weight"
          :hidden="chip.personalTag?.hidden"
          :watch="chip.personalTag?.watch"
          :show-score="appearance.scores.value"
          :show-marks="appearance.marks.value"
          :selection="chip.selected"
          :vote="userVotes?.[chip.tag.nsRaw]"
        >
          <template v-if="chip.candidate || chip.evidence" #lead>
            <TagPlus v-if="chip.candidate === 'added'" />
            <CircleCheck v-else-if="chip.evidence === 'solid'" :title="chip.sources" />
            <CircleDashedCheck v-else-if="chip.evidence === 'dashed'" :title="chip.sources" />
            <CircleDottedCheck v-else :title="chip.sources" />
          </template>
        </TagChip>
      </div>
    </div>
  </div>
</template>
