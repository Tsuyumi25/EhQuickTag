<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { GripVertical, Undo2, Trash2 } from '@lucide/vue'
import { useSortable } from '@/composables/useSortable'
import { NS_LABEL } from '@/types'
import { deletedProfiles, restoreProfile, purgeProfile, fontFamily, fontWeight } from '@/services/store'

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
          <span class="eqt-settings__ns-grip"><GripVertical :size="14" /></span>
        </li>
      </ul>

      <h4 class="eqt-settings__subtitle">自定義字體</h4>
      <div class="eqt-settings__font-row">
        <input
          :value="fontFamily"
          class="eqt-settings__font-input"
          placeholder="留空則使用頁面字體"
          @input="fontFamily = ($event.target as HTMLInputElement).value"
        />
      </div>
      <div class="eqt-settings__font-row">
        <label class="eqt-settings__font-label">字重</label>
        <select
          :value="fontWeight"
          class="eqt-settings__font-input eqt-settings__font-select"
          @change="fontWeight = ($event.target as HTMLSelectElement).value"
        >
          <option value="">預設</option>
          <option value="100">100 Thin</option>
          <option value="200">200 Extra Light</option>
          <option value="300">300 Light</option>
          <option value="400">400 Normal</option>
          <option value="500">500 Medium</option>
          <option value="600">600 Semi Bold</option>
          <option value="700">700 Bold</option>
          <option value="800">800 Extra Bold</option>
          <option value="900">900 Black</option>
        </select>
      </div>
      <p class="eqt-settings__hint">
        font-family 值範例：<code>"Noto Sans TC", sans-serif</code>
      </p>
      <div class="eqt-settings__font-preview" :style="{ fontFamily: fontFamily || 'inherit', fontWeight: fontWeight || 'inherit' }">
        The quick brown fox jumps over the lazy dog<br />
        天地玄黃，宇宙洪荒。日月盈昃，辰宿列張。
      </div>

      <template v-if="deletedProfiles.length">
        <h4 class="eqt-settings__subtitle">已刪除的 Profile</h4>
        <ul class="eqt-settings__ns-list">
          <li
            v-for="(p, i) in deletedProfiles"
            :key="i"
            class="eqt-settings__ns-item"
          >
            <span class="eqt-settings__deleted-name">{{ p.name }}</span>
            <span class="eqt-settings__deleted-count">{{ p.tagLines.flat().length }} 標籤</span>
            <button class="eqt-settings__deleted-btn" type="button" title="恢復" @click="restoreProfile(i)">
              <Undo2 :size="12" />
            </button>
            <button class="eqt-settings__deleted-btn eqt-settings__deleted-btn--purge" type="button" title="永久刪除" @click="purgeProfile(i)">
              <Trash2 :size="12" />
            </button>
          </li>
        </ul>
      </template>

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

  &__font-row {
    margin-top: 4px;
  }

  &__font-label {
    font-size: 12px;
    font-weight: bold;
    margin-right: 6px;
  }

  &__font-select {
    width: auto;
  }

  &__font-input {
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    font-size: 13px;
    background: var(--eqt-bg-elevated);
    color: var(--eqt-text);
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--eqt-border-focus);
    }
  }

  &__font-preview {
    margin-top: 6px;
    padding: 8px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--eqt-text);
    background: var(--eqt-bg-elevated);
  }

  &__deleted-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__deleted-count {
    font-size: 11px;
    color: var(--eqt-text-hint);
    flex-shrink: 0;
  }

  &__deleted-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;

    &:hover {
      background: var(--eqt-bg-active);
      color: var(--eqt-text);
    }

    &--purge:hover {
      color: #8c3333;
    }
  }
}
</style>
