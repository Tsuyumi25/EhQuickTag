<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSortable } from '@/composables/useSortable'
import { NS_LABEL } from '@/types'

const props = defineProps<{
  useNhWeight: boolean
  nsOrder: string[]
  disabledNs: Set<string>
}>()

const emit = defineEmits<{
  'update:useNhWeight': [value: boolean]
  'update:nsOrder': [value: string[]]
  'update:disabledNs': [value: Set<string>]
  'close': []
}>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

// --- Sortable ---

const nsListEl = ref<HTMLElement | null>(null)

const { activate: activateSortable } = useSortable(nsListEl, {
  animation: 150,
  handle: '.eqt-settings__ns-grip',
  ghostClass: 'eqt-settings__ns-item--ghost',
  chosenClass: 'eqt-settings__ns-item--chosen',
  onEnd: (evt) => {
    if (evt.oldIndex !== undefined && evt.newIndex !== undefined && evt.oldIndex !== evt.newIndex) {
      const newOrder = [...props.nsOrder]
      const [item] = newOrder.splice(evt.oldIndex, 1)
      newOrder.splice(evt.newIndex, 0, item)
      emit('update:nsOrder', newOrder)
    }
  },
})

onMounted(activateSortable)

// --- toggle ---

function toggleNs(ns: string) {
  const next = new Set(props.disabledNs)
  if (next.has(ns)) next.delete(ns)
  else next.add(ns)
  emit('update:disabledNs', next)
}
</script>

<template>
  <div class="eqt-popup-overlay" @click.self="emit('close')" @keydown="onKeydown">
    <div class="eqt-popup">
      <h3 class="eqt-popup__title">EH Quick Tag 設定</h3>

      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="props.useNhWeight"
          @change="emit('update:useNhWeight', ($event.target as HTMLInputElement).checked)"
        />
        <span class="eqt-settings__label">使用 nhentai 人氣權重排序</span>
      </label>
      <p class="eqt-settings__hint">
        開啟後，搜尋建議會優先顯示 nhentai 上傳量高的標籤（top 500），其餘按預設公式排序。
      </p>

      <h4 class="eqt-settings__subtitle">Namespace 搜尋順序</h4>
      <p class="eqt-settings__hint">
        調整搜尋建議中 namespace 的內部排序權重。拖曳調整順序，取消勾選可隱藏該類別。<br />
        注意：此順序僅影響 namespace 之間的排列，匹配品質和 nhentai 人氣仍然優先。
      </p>
      <ul ref="nsListEl" class="eqt-settings__ns-list">
        <li
          v-for="ns in nsOrder"
          :key="ns"
          :data-id="ns"
          class="eqt-settings__ns-item"
        >
          <input
            type="checkbox"
            :checked="!disabledNs.has(ns)"
            @change="toggleNs(ns)"
          />
          <span class="eqt-settings__ns-label">{{ NS_LABEL[ns] ?? ns }}</span>
          <span class="eqt-settings__ns-key">{{ ns }}</span>
          <span class="eqt-settings__ns-grip">⠿</span>
        </li>
      </ul>

      <div class="eqt-popup__actions">
        <div class="eqt-popup__spacer" />
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="emit('close')">
          關閉
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.eqt-popup__title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: bold;
}

.eqt-settings {
  &__row {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 13px;
  }

  &__label {
    user-select: none;
  }

  &__hint {
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--eqt-text-hint);
    line-height: 1.4;
  }

  &__subtitle {
    margin: 14px 0 4px;
    font-size: 13px;
    font-weight: bold;
  }

  &__ns-list {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
  }

  &__ns-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 13px;

    &:hover {
      background: var(--eqt-bg-hover);
    }

    &--ghost {
      opacity: 0.4;
    }

    &--chosen {
      background: var(--eqt-bg-active);
    }
  }

  &__ns-label {
    user-select: none;
    min-width: 3em;
  }

  &__ns-key {
    font-size: 11px;
    color: var(--eqt-text-hint);
    flex: 1;
  }

  &__ns-grip {
    color: var(--eqt-grip);
    cursor: grab;
    user-select: none;
  }
}
</style>
