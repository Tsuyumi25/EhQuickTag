import { computed } from 'vue'
import { tagStylePreset } from '@/services/store'

export const TAG_STYLE_PRESETS = [
  { id: 'flat',          className: '',                       labelKey: 'settings.tagStyleFlat' },
  { id: '3d-border',     className: 'eqt-tag-style-3d',       labelKey: 'settings.tagStyle3dBorder' },
  { id: 'offset-shadow', className: 'eqt-tag-style-offset',   labelKey: 'settings.tagStyleOffsetShadow' },
  { id: 'pushable',      className: 'eqt-tag-style-pushable', labelKey: 'settings.tagStylePushable' },
] as const

export type TagStylePresetId = typeof TAG_STYLE_PRESETS[number]['id']

export const PRESETS_BY_ID = new Map<TagStylePresetId, typeof TAG_STYLE_PRESETS[number]>(
  TAG_STYLE_PRESETS.map(p => [p.id, p]),
)

export const currentTagStyleClass = computed(
  () => PRESETS_BY_ID.get(tagStylePreset.value)?.className ?? '',
)
