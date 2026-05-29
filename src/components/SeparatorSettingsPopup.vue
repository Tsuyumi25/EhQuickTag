<script setup lang="ts">
import { ref, inject, computed, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useFloating, autoUpdate, flip, shift, offset } from '@floating-ui/vue'
import { Settings } from '@lucide/vue'
import type { LineSeparator, SeparatorStyle, SeparatorPreset, SeparatorTextAlign } from '@/types'
import { POPUP_IGNORE_KEY, type PopupIgnoreRegister } from '@/composables/usePopupBehavior'
import { t } from '@/composables/useI18n'

const props = defineProps<{
  modelValue: LineSeparator | undefined
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: LineSeparator | undefined] }>()

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

const enabled = computed(() => !!props.modelValue)
const style = computed<SeparatorStyle>(() => props.modelValue?.style ?? 'solid')
const preset = computed<SeparatorPreset>(() => props.modelValue?.preset ?? 'header')
const textAlign = computed<SeparatorTextAlign>(() => props.modelValue?.textAlign ?? 'left')
const textSize = computed<number>(() => props.modelValue?.textSize ?? 10)
const lineThickness = computed<number>(() => props.modelValue?.lineThickness ?? 2)

function toggleEnabled(next: boolean) {
  if (next) {
    emit('update:modelValue', {
      style: 'solid',
      preset: 'header',
      textAlign: 'left',
      textSize: 10,
      lineThickness: 2,
    })
  } else {
    emit('update:modelValue', undefined)
  }
}

function setStyle(value: SeparatorStyle) {
  if (!props.modelValue) return
  emit('update:modelValue', { ...props.modelValue, style: value })
}

function setPreset(value: SeparatorPreset) {
  if (!props.modelValue) return
  emit('update:modelValue', { ...props.modelValue, preset: value })
}

function setTextAlign(value: SeparatorTextAlign) {
  if (!props.modelValue) return
  emit('update:modelValue', { ...props.modelValue, textAlign: value })
}

function setTextSize(value: number) {
  if (!props.modelValue) return
  emit('update:modelValue', { ...props.modelValue, textSize: value })
}

function setLineThickness(value: number) {
  if (!props.modelValue) return
  emit('update:modelValue', { ...props.modelValue, lineThickness: value })
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
        <span>{{ t('tagbar.separatorPreset') }}</span>
        <div class="eqt-line-sep__styles">
          <label v-for="opt in (['divider', 'header'] as const)" :key="opt" class="eqt-line-sep__style-opt">
            <input
              type="radio"
              :checked="preset === opt"
              :disabled="!enabled"
              @change="setPreset(opt)"
            />
            <span>{{ t(`tagbar.separatorPreset_${opt}`) }}</span>
          </label>
        </div>
      </div>
      <div class="eqt-line-sep__row eqt-line-sep__row--col" :class="{ 'eqt-line-sep__row--disabled': !enabled }">
        <span>{{ t('tagbar.separatorStyle') }}</span>
        <div class="eqt-line-sep__styles">
          <label v-for="opt in (['solid', 'dashed', 'none'] as const)" :key="opt" class="eqt-line-sep__style-opt">
            <input
              type="radio"
              :checked="style === opt"
              :disabled="!enabled"
              @change="setStyle(opt)"
            />
            <span>{{ t(`tagbar.separatorStyle_${opt}`) }}</span>
          </label>
        </div>
      </div>
      <div class="eqt-line-sep__row eqt-line-sep__row--col" :class="{ 'eqt-line-sep__row--disabled': !enabled }">
        <span>{{ t('tagbar.separatorTextAlign') }}</span>
        <div class="eqt-line-sep__styles">
          <label v-for="opt in (['left', 'center'] as const)" :key="opt" class="eqt-line-sep__style-opt">
            <input
              type="radio"
              :checked="textAlign === opt"
              :disabled="!enabled"
              @change="setTextAlign(opt)"
            />
            <span>{{ t(`tagbar.separatorTextAlign_${opt}`) }}</span>
          </label>
        </div>
      </div>
      <div class="eqt-line-sep__row eqt-line-sep__row--col" :class="{ 'eqt-line-sep__row--disabled': !enabled }">
        <div class="eqt-line-sep__slider-head">
          <span>{{ t('tagbar.separatorTextSize') }}</span>
          <span class="eqt-line-sep__slider-value">{{ textSize }}px</span>
        </div>
        <input
          type="range"
          min="9"
          max="20"
          step="1"
          :value="textSize"
          :disabled="!enabled"
          @input="setTextSize(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="eqt-line-sep__row eqt-line-sep__row--col" :class="{ 'eqt-line-sep__row--disabled': !enabled }">
        <div class="eqt-line-sep__slider-head">
          <span>{{ t('tagbar.separatorLineThickness') }}</span>
          <span class="eqt-line-sep__slider-value">{{ lineThickness }}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          :value="lineThickness"
          :disabled="!enabled || style === 'none'"
          @input="setLineThickness(Number(($event.target as HTMLInputElement).value))"
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
