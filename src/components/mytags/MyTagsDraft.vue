<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '@/composables/useI18n'
import MyTagsTagBody from '@/components/mytags/MyTagsTagBody.vue'
import { TAGSET_CAPACITY, type NewTagInput, type TagSetRef } from '@/composables/useEhMyTagsHost'
import { normalizeTagColor } from '@/services/mytags/mytagsColors'
import type { TagState } from '@/services/mytags/mytagsEdits'
import type { TagImpact } from '@/services/mytags/mytagsScore'

// 一個標籤的編輯區：還沒加的是新增草稿，已經在某一組的可以搬移或刪除。
// /mytags 面板與圖庫頁封面位共用；標籤從哪裡挑由外層決定

type NewTagSubmission = NewTagInput & { tagSet: string }

const props = withDefaults(defineProps<{
  full: string
  state: TagState
  targetSet: string
  /** 這個標籤目前住的組；null 代表還沒加 */
  sourceSet: string | null
  sets: TagSetRef[]
  setColors: Record<string, string>
  busy: boolean
  impact?: TagImpact
  showImpact?: boolean
  previewed?: boolean
  /** 排成一列：給圖庫頁頂替動作列的那一條，高度要壓在兩列按鈕左右 */
  row?: boolean
  /** 送不了：標籤集還沒讀到或讀壞了。欄位照樣能填，送出的按鈕與標籤集選單鎖住 */
  disabled?: boolean
}>(), {
  impact: undefined,
  showImpact: false,
  previewed: false,
  row: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:targetSet': [value: string]
  'update:full': [value: string]
  patch: [change: Partial<TagState>]
  create: [submission: NewTagSubmission]
  move: [target: string]
  remove: []
  preview: []
  confirm: []
}>()

const name = ref(props.full)
watch(() => props.full, (full) => {
  if (name.value.trim() !== full) name.value = full
})

const selectedSet = computed(() => props.sets.find((set) => set.value === props.targetSet))
const existing = computed(() => props.sourceSet !== null)
const setFull = computed(() => (selectedSet.value?.used ?? 0) >= TAGSET_CAPACITY)
const normalizedColor = computed(() => normalizeTagColor(props.state.color))
const colorInvalid = computed(() => normalizedColor.value === null)
const canCreate = computed(() => (
  !existing.value
  && !!props.full
  && !setFull.value
  && !colorInvalid.value
  && !props.busy
  && !props.disabled
))
const canMove = computed(() => (
  existing.value
  && props.targetSet !== props.sourceSet
  && !setFull.value
  && !props.busy
  && !props.disabled
))

function commit(): void {
  if (existing.value) {
    if (canMove.value) emit('move', props.targetSet)
    return
  }
  if (!canCreate.value || normalizedColor.value === null) return
  emit('create', {
    full: props.full,
    tagSet: props.targetSet,
    ...props.state,
    color: normalizedColor.value,
  })
}
</script>

<template>
  <div
    class="eqt-tag-draft"
    :class="{ 'eqt-tag-draft--previewed': previewed, 'eqt-tag-draft--row': row }"
  >
    <slot name="head" />
    <MyTagsTagBody
      :full="full"
      :state="state"
      :set-color="setColors[sourceSet ?? targetSet] ?? ''"
      :impact="impact"
      :show-impact="showImpact"
      @patch="emit('patch', $event)"
    >
      <template #tag>
        <input
          v-model="name"
          class="eqt-taglist__input eqt-tag-draft__name"
          type="text"
          :aria-label="t('manage.newTag')"
          :placeholder="t('manage.newTag')"
          autocomplete="off"
          spellcheck="false"
          @input="emit('update:full', name.trim())"
          @focus="emit('preview')"
          @keydown.enter.prevent="!$event.isComposing && full && emit('confirm')"
        >
      </template>
    </MyTagsTagBody>

    <div class="eqt-tag-draft__create-row">
      <select
        class="eqt-panel__setpick"
        :value="targetSet"
        :aria-label="t(existing ? 'manage.moveTarget' : 'manage.targetSet')"
        :disabled="disabled"
        @change="emit('update:targetSet', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="set in sets"
          :key="set.value"
          :value="set.value"
          :disabled="(set.used ?? 0) >= TAGSET_CAPACITY && set.value !== sourceSet"
        >{{ set.name }} · {{ set.used ?? '?' }}/{{ TAGSET_CAPACITY }}</option>
      </select>
      <button
        type="button"
        class="eqt-tag-draft__create eqt-panel__btn eqt-panel__btn--primary"
        :disabled="existing ? !canMove : !canCreate"
        @click="commit"
      >{{ busy ? t('panel.working') : t(existing ? 'manage.moveTag' : 'taglist.addTag') }}</button>
      <slot />
      <button
        v-if="existing"
        type="button"
        class="eqt-tag-draft__delete eqt-panel__btn eqt-panel__btn--primary"
        :disabled="busy || disabled"
        @click="emit('remove')"
      >{{ t('panel.labelDelete') }}</button>
    </div>

    <p v-if="full && setFull && targetSet !== sourceSet" class="eqt-tag-draft__error">
      {{ t('manage.setFull') }}
    </p>
    <p v-else-if="full && !existing && colorInvalid" class="eqt-tag-draft__error">
      {{ t('manage.colorInvalid') }}
    </p>
  </div>
</template>

<style lang="scss">

.eqt-tag-draft {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: calc(var(--eqt-checkbox-size) / 4);
  padding: calc(var(--eqt-checkbox-size) / 3);
  border: var(--eqt-border-width) solid var(--eqt-divider);
  border-radius: var(--eqt-radius-md);
  background: var(--eqt-bg-stripe);

  &--previewed {
    background: var(--eqt-bg-active);
  }

  // 一列版：名字、顏色、旗標、權重排一行，標籤集與按鈕視寬度接在後面或換到第二行
  &--row {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    padding: calc(var(--eqt-checkbox-size) / 6);

    > .eqt-taglist__body {
      flex: 1 1 auto;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      min-width: 0;
    }

    .eqt-taglist__top {
      flex: 1 1 calc(var(--eqt-number-field-width) * 2);
      min-width: 0;
    }

    .eqt-taglist__controls { flex: none; }

    > .eqt-tag-draft__create-row {
      flex: 1 1 calc(var(--eqt-number-field-width) * 2);
    }
  }

  &__name {
    flex: 1;
    min-width: 0;
  }

  &__create-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-auto-flow: column;
    gap: calc(var(--eqt-checkbox-size) / 4);
    align-items: stretch;

    > .eqt-panel__setpick {
      width: 100%;
      height: calc(var(--eqt-checkbox-size) + var(--eqt-border-width) * 2);
      box-sizing: border-box;
    }
  }

  &__create,
  &__delete {
    height: calc(var(--eqt-checkbox-size) + var(--eqt-border-width) * 2);
    padding: 0 calc(var(--eqt-checkbox-size) / 3);
    font-size: var(--eqt-fs-xs);
    box-sizing: border-box;
  }

  &__error {
    margin: 0;
    color: var(--eqt-danger);
    font-size: var(--eqt-fs-xs);
  }
}
</style>
