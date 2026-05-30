<script setup lang="ts">
import { ref, inject, computed, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useFloating, autoUpdate, flip, shift, offset } from '@floating-ui/vue'
import { Settings } from '@lucide/vue'
import type { Line, SeparatorLine, SeparatorStyle } from '@/types'
import { POPUP_IGNORE_KEY, type PopupIgnoreRegister } from '@/composables/usePopupBehavior'
import { t } from '@/composables/useI18n'

const props = defineProps<{
  line: Line
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:line': [value: Line] }>()

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
const popupEl = ref<HTMLElement | null>(null)

const { floatingStyles } = useFloating(triggerEl, popupEl, {
  placement: 'bottom-start',
  middleware: [offset(4), flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})

onClickOutside(popupEl, () => { open.value = false }, { ignore: [triggerEl] })

const registerIgnore = inject<PopupIgnoreRegister | undefined>(POPUP_IGNORE_KEY, undefined)
let unregister: (() => void) | null = null
watch(popupEl, (el) => {
  if (unregister) { unregister(); unregister = null }
  if (el && registerIgnore) unregister = registerIgnore(el)
})

const enabled = computed(() => props.line.kind === 'separator')
const sepLine = computed<SeparatorLine | null>(() => props.line.kind === 'separator' ? props.line : null)

// 顯示用：沒設過的欄位 fallback 到「視覺預設值」（跟 CSS 預設保持一致）
// 這些 fallback 只給 UI 顯示用，不寫進資料。
const lineStyleValue = computed<SeparatorStyle['line']>(() => sepLine.value?.style?.line ?? 'solid')
const linePositionValue = computed<SeparatorStyle['linePosition']>(() => sepLine.value?.style?.linePosition ?? 'middle')
const textAlignValue = computed<SeparatorStyle['textAlign']>(() => sepLine.value?.style?.textAlign ?? 'center')
const textSizeValue = computed<number>(() => sepLine.value?.style?.textSize ?? 10)
const lineThicknessValue = computed<number>(() => sepLine.value?.style?.lineThickness ?? 2)

function toggleEnabled(next: boolean) {
  if (next) {
    // 不寫預設值——所有視覺由 CSS 給。使用者調整時才寫進 style。
    emit('update:line', { kind: 'separator' })
  } else {
    emit('update:line', { kind: 'buttons', buttons: [] })
  }
}

function updateStyle(patch: Partial<SeparatorStyle>) {
  if (!sepLine.value) return
  const merged: SeparatorStyle = { ...sepLine.value.style, ...patch }
  // 清掉 undefined key 以保持 storage 乾淨
  for (const k of Object.keys(merged) as (keyof SeparatorStyle)[]) {
    if (merged[k] === undefined) delete merged[k]
  }
  emit('update:line', {
    ...sepLine.value,
    style: Object.keys(merged).length ? merged : undefined,
  })
}
</script>

<template>
  <button
    ref="triggerEl"
    type="button"
    class="eqt-line-sep__trigger"
    :title="t('tagbar.separatorSettings')"
    @click="open = !open"
  >
    <Settings :size="12" />
  </button>
  <Teleport to="body">
    <div v-if="open" ref="popupEl" class="eqt-line-sep__popup" :style="floatingStyles">
      <label class="eqt-line-sep__row" :class="{ 'eqt-line-sep__row--disabled': disabled }">
        <input
          type="checkbox"
          :checked="enabled"
          :disabled="disabled"
          @change="toggleEnabled(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('tagbar.separatorEnable') }}</span>
      </label>
      <p v-if="disabled" class="eqt-line-sep__hint">{{ t('tagbar.separatorEmptyOnly') }}</p>
      <div class="eqt-line-sep__row eqt-line-sep__row--col" :class="{ 'eqt-line-sep__row--disabled': !enabled }">
        <span>{{ t('tagbar.separatorLinePosition') }}</span>
        <div class="eqt-line-sep__styles">
          <label v-for="opt in (['top', 'middle', 'bottom'] as const)" :key="opt" class="eqt-line-sep__style-opt">
            <input
              type="radio"
              :checked="linePositionValue === opt"
              :disabled="!enabled"
              @change="updateStyle({ linePosition: opt })"
            />
            <span>{{ t(`tagbar.separatorLinePosition_${opt}`) }}</span>
          </label>
        </div>
      </div>
      <div class="eqt-line-sep__row eqt-line-sep__row--col" :class="{ 'eqt-line-sep__row--disabled': !enabled }">
        <span>{{ t('tagbar.separatorStyle') }}</span>
        <div class="eqt-line-sep__styles">
          <label v-for="opt in (['solid', 'dashed', 'none'] as const)" :key="opt" class="eqt-line-sep__style-opt">
            <input
              type="radio"
              :checked="lineStyleValue === opt"
              :disabled="!enabled"
              @change="updateStyle({ line: opt })"
            />
            <span>{{ t(`tagbar.separatorStyle_${opt}`) }}</span>
          </label>
        </div>
      </div>
      <div class="eqt-line-sep__row eqt-line-sep__row--col" :class="{ 'eqt-line-sep__row--disabled': !enabled }">
        <span>{{ t('tagbar.separatorTextAlign') }}</span>
        <div class="eqt-line-sep__styles">
          <label v-for="opt in (['left', 'center', 'right'] as const)" :key="opt" class="eqt-line-sep__style-opt">
            <input
              type="radio"
              :checked="textAlignValue === opt"
              :disabled="!enabled"
              @change="updateStyle({ textAlign: opt })"
            />
            <span>{{ t(`tagbar.separatorTextAlign_${opt}`) }}</span>
          </label>
        </div>
      </div>
      <div class="eqt-line-sep__row eqt-line-sep__row--col" :class="{ 'eqt-line-sep__row--disabled': !enabled }">
        <div class="eqt-line-sep__slider-head">
          <span>{{ t('tagbar.separatorTextSize') }}</span>
          <span class="eqt-line-sep__slider-value">{{ textSizeValue }}px</span>
        </div>
        <input
          type="range"
          min="9"
          max="20"
          step="1"
          :value="textSizeValue"
          :disabled="!enabled"
          @input="updateStyle({ textSize: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <div class="eqt-line-sep__row eqt-line-sep__row--col" :class="{ 'eqt-line-sep__row--disabled': !enabled }">
        <div class="eqt-line-sep__slider-head">
          <span>{{ t('tagbar.separatorLineThickness') }}</span>
          <span class="eqt-line-sep__slider-value">{{ lineThicknessValue }}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          :value="lineThicknessValue"
          :disabled="!enabled || lineStyleValue === 'none'"
          @input="updateStyle({ lineThickness: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss">
.eqt-line-sep {
  &__trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--eqt-row-h);
    padding: 0 4px;
    border: none;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;

    &:hover {
      color: var(--eqt-text-secondary);
    }
  }

  &__popup {
    z-index: 100000;
    min-width: 200px;
    padding: 8px;
    background: var(--eqt-bg);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
    color: var(--eqt-text);
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 6px;

    &--col {
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
    }

    &--disabled {
      opacity: 0.5;
    }
  }

  &__styles {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__hint {
    margin: 0;
    color: var(--eqt-text-hint);
    font-size: 11px;
  }

  &__style-opt {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }

  &__slider-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__slider-value {
    color: var(--eqt-text-hint);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
}
</style>
