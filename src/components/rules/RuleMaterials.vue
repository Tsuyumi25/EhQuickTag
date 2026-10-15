<script setup lang="ts">
import type { Component } from 'vue'
import Draggable from 'vuedraggable'
import { BrushCleaning, Shapes } from '@lucide/vue'
import RuleTagChip from './RuleTagChip.vue'
import { RANGE_FIELD_ICONS } from './rangeFieldIcons'
import { RULE_CONDITIONS_GROUP, ruleDragOptions } from './ruleDrag'
import { t } from '@/composables/useI18n'
import { ruleMaterials } from '@/services/appOverlays'
import {
  createGroup, createRangeCondition, GROUP_MODE_OPERATORS, tagConditionKey,
  type FixedConditionItem, type GroupMode, type RangeField, type TagCondition,
} from '@/services/listing/fixedRulePrototype'

type Source = { id: RangeField; kind: 'range' } | { id: GroupMode; kind: 'group' }

// 產生器拖出去的是新建的一份，產生器本身留著。
// 兩種群組本質上是同一種東西、拖進去後也能改判定模式與 NOT，分成兩個只是讓拖曳少一步
const SOURCES: Source[] = [
  { id: 'rating', kind: 'range' }, { id: 'pages', kind: 'range' },
  { id: 'all', kind: 'group' }, { id: 'any', kind: 'group' },
]
const sourceGroup = { name: RULE_CONDITIONS_GROUP, pull: 'clone', put: false }
// 標籤（條件區的 chip、候選清單的項目）可以丟進來當素材；數值條件與群組不收，
// 它們隨時能從產生器再拉一個。素材拖出去就離開素材區，留下來的就是還沒用掉的
const materialGroup = {
  name: RULE_CONDITIONS_GROUP,
  pull: true,
  put: (_to: unknown, _from: unknown, dragged: HTMLElement) => dragged.dataset.kind === 'tag',
}

function cloneSource(source: Source): FixedConditionItem {
  return source.kind === 'group' ? createGroup(source.id) : createRangeCondition(source.id)
}

// Draggable 的 slot 把 element 給成 any，圖示與文字在這裡用 Source 型別查好；群組跟標題列一樣只寫運算子
function sourceView(source: Source): { icon?: Component; label: string } {
  return source.kind === 'group'
    ? { label: GROUP_MODE_OPERATORS[source.id] }
    : { icon: RANGE_FIELD_ICONS[source.id], label: t(`rulePagePrototype.${source.id}`) }
}

// 從條件區丟回來的標籤可能已經在素材裡，留先來的那顆
function dropDuplicate(event: { added?: { element: TagCondition; newIndex: number } }) {
  const added = event.added
  if (!added) return
  const key = tagConditionKey(added.element)
  const duplicate = ruleMaterials.value.some((material, index) => index !== added.newIndex && tagConditionKey(material) === key)
  if (duplicate) ruleMaterials.value.splice(added.newIndex, 1)
}
</script>

<template>
  <section class="eqt-rule-page__materials" :aria-label="t('rulePagePrototype.materials')">
    <header class="eqt-rule-page__materials-head">
      <h2><Shapes class="eqt-rule-page__icon" />{{ t('rulePagePrototype.materials') }}</h2>
      <button
        type="button" class="eqt-rule-page__tool" :disabled="!ruleMaterials.length"
        :title="t('rulePagePrototype.clearMaterials')" @click="ruleMaterials.splice(0)"
      ><BrushCleaning class="eqt-rule-page__icon" />{{ t('rulePagePrototype.clearMaterials') }}</button>
    </header>

    <Draggable
      :list="SOURCES" item-key="id" v-bind="ruleDragOptions" :group="sourceGroup" :sort="false"
      :clone="cloneSource" class="eqt-rule-page__sources"
    >
      <template #item="{ element: source }">
        <div
          class="eqt-rule-page__item eqt-rule-page__source" :class="source.kind === 'group' && `eqt-rule-page__source--${source.id}`"
          :data-height="source.kind === 'group' ? 1 : 0"
        >
          <component :is="sourceView(source).icon" v-if="sourceView(source).icon" class="eqt-rule-page__icon" />{{ sourceView(source).label }}
        </div>
      </template>
    </Draggable>

    <Draggable
      :list="ruleMaterials" item-key="id" v-bind="ruleDragOptions" :group="materialGroup"
      class="eqt-rule-page__tray eqt-rule-page__material-tray"
      :data-empty="t('rulePagePrototype.materialsEmpty')" @change="dropDuplicate"
    >
      <template #item="{ element: material, index }">
        <RuleTagChip class="eqt-rule-page__item" :condition="material" @remove="ruleMaterials.splice(index, 1)" />
      </template>
    </Draggable>
  </section>
</template>
