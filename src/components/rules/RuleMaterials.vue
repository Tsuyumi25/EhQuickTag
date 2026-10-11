<script setup lang="ts">
import Draggable from 'vuedraggable'
import { BrushCleaning, FolderOpen, Shapes } from '@lucide/vue'
import RuleTagChip from './RuleTagChip.vue'
import { RANGE_FIELD_ICONS } from './rangeFieldIcons'
import { RULE_CONDITIONS_GROUP, ruleDragOptions } from './ruleDrag'
import { t } from '@/composables/useI18n'
import { ruleMaterials } from '@/services/appOverlays'
import {
  createFolder, createRangeCondition, createTagCondition, tagConditionKey,
  type FixedConditionItem, type RangeField, type TagCondition,
} from '@/services/listing/fixedRulePrototype'

interface Source { id: RangeField | 'folder' }

// 素材拖出去的是複本，原件留著：同一個素材可以放進好幾條規則、好幾個區塊
const SOURCES: Source[] = [{ id: 'rating' }, { id: 'pages' }, { id: 'folder' }]
const sourceGroup = { name: RULE_CONDITIONS_GROUP, pull: 'clone', put: false }
// 標籤（條件區的 chip、候選清單的項目）可以丟進來當素材；數值條件與 Folder 不收，
// 它們隨時能從產生器再拉一個
const materialGroup = {
  name: RULE_CONDITIONS_GROUP,
  pull: 'clone',
  put: (_to: unknown, _from: unknown, dragged: HTMLElement) => dragged.dataset.kind === 'tag',
}

function cloneSource(source: Source): FixedConditionItem {
  return source.id === 'folder' ? createFolder() : createRangeCondition(source.id)
}

function cloneMaterial(material: TagCondition): TagCondition {
  return createTagCondition(material.tag, material.exclude)
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
        <div class="eqt-rule-page__item eqt-rule-page__source" :data-height="source.id === 'folder' ? 1 : 0">
          <template v-if="source.id === 'folder'"><FolderOpen class="eqt-rule-page__icon" />{{ t('rulePagePrototype.folder') }}</template>
          <template v-else>
            <component :is="RANGE_FIELD_ICONS[source.id as RangeField]" class="eqt-rule-page__icon" />{{ t(`rulePagePrototype.${source.id}`) }}
          </template>
        </div>
      </template>
    </Draggable>

    <Draggable
      :list="ruleMaterials" item-key="id" v-bind="ruleDragOptions" :group="materialGroup"
      :clone="cloneMaterial" class="eqt-rule-page__tray eqt-rule-page__material-tray"
      :data-empty="t('rulePagePrototype.materialsEmpty')" @change="dropDuplicate"
    >
      <template #item="{ element: material, index }">
        <RuleTagChip class="eqt-rule-page__item" :condition="material" @remove="ruleMaterials.splice(index, 1)" />
      </template>
    </Draggable>
  </section>
</template>
