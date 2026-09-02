<script setup lang="ts">
import { ref, watch } from 'vue'
import { t } from '@/composables/useI18n'
import { readEhSearchSnapshot } from '@/composables/ehSearchSnapshot'
import {
  EH_CATEGORIES,
  MIN_RATINGS,
  buildSearchUrl,
  parseSearchUrl,
  emptyAdvancedOptions,
  type EhSearchParams,
} from '@/services/ehSearchParams'
import { EH_ORIGIN } from '@/utils/ehUrl'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const keywords = ref('')
const categories = ref<Set<number>>(new Set())
const useAdvanced = ref(false)
const advanced = ref(emptyAdvancedOptions())

const allCategories = () => new Set(EH_CATEGORIES.map(c => c.bit))

let restoring = false

function load(params: EhSearchParams) {
  restoring = true
  keywords.value = params.keywords
  categories.value = new Set(params.categories)
  useAdvanced.value = params.advanced !== null
  advanced.value = params.advanced ?? emptyAdvancedOptions()
  restoring = false
}

load(parseSearchUrl(props.modelValue) ?? { keywords: '', categories: allCategories(), advanced: null })

function currentParams(): EhSearchParams {
  return {
    keywords: keywords.value,
    categories: categories.value,
    advanced: useAdvanced.value ? advanced.value : null,
  }
}

watch(
  advanced,
  () => { if (!restoring) useAdvanced.value = true },
  { deep: true, flush: 'sync' },
)

watch(
  [keywords, categories, useAdvanced, advanced],
  () => emit('update:modelValue', buildSearchUrl(currentParams(), EH_ORIGIN)),
  { deep: true },
)

function toggleCategory(bit: number) {
  const next = new Set(categories.value)
  if (next.has(bit)) next.delete(bit)
  else next.add(bit)
  categories.value = next
}

function useCurrentPage() {
  const snapshot = readEhSearchSnapshot()
  if (!snapshot) return
  load(snapshot)
  emit('update:modelValue', buildSearchUrl(currentParams(), EH_ORIGIN))
}

defineExpose({ useCurrentPage })
</script>

<template>
  <div class="eqt-url-builder">
    <div class="eqt-url-builder__field">
      <label class="eqt-popup__label">{{ t('urlBuilder.keywords') }}</label>
      <div class="eqt-url-builder__row">
        <input v-model="keywords" class="eqt-popup__input" />
      </div>
    </div>

    <div class="eqt-url-builder__field">
      <label class="eqt-popup__label">{{ t('urlBuilder.categories') }}</label>
      <div class="eqt-url-builder__cats">
        <button
          v-for="c in EH_CATEGORIES"
          :key="c.bit"
          class="eqt-url-builder__cat cs"
          :class="c.nativeClass"
          :data-disabled="categories.has(c.bit) ? undefined : '1'"
          type="button"
          :aria-pressed="categories.has(c.bit)"
          @click="toggleCategory(c.bit)"
        >{{ t(`category.${c.key}`) }}</button>
      </div>
    </div>

    <div class="eqt-url-builder__advanced">
      <div class="eqt-url-builder__adv-row">
        <label class="eqt-url-builder__check">
          <input type="checkbox" v-model="useAdvanced" />
          <span>{{ t('urlBuilder.showAdvanced') }}</span>
        </label>
      </div>

      <div class="eqt-url-builder__adv-row">
        <label class="eqt-url-builder__check">
          <input type="checkbox" v-model="advanced.browseExpunged" />
          <span>{{ t('urlBuilder.browseExpunged') }}</span>
        </label>
        <label class="eqt-url-builder__check">
          <input type="checkbox" v-model="advanced.requireTorrent" />
          <span>{{ t('urlBuilder.requireTorrent') }}</span>
        </label>
      </div>

      <div class="eqt-url-builder__adv-row">
        <span class="eqt-url-builder__adv-cell">
          {{ t('urlBuilder.pagesBetween') }}
          <input v-model="advanced.pagesFrom" class="eqt-url-builder__num" maxlength="4" inputmode="numeric" />
          {{ t('urlBuilder.pagesAnd') }}
          <input v-model="advanced.pagesTo" class="eqt-url-builder__num" maxlength="4" inputmode="numeric" />
          {{ t('urlBuilder.pagesUnit') }}
        </span>
        <span class="eqt-url-builder__adv-cell">
          {{ t('urlBuilder.minRating') }}
          <select v-model="advanced.minRating" class="eqt-url-builder__select">
            <option v-for="r in MIN_RATINGS" :key="r" :value="r">
              {{ r === '0' ? t('urlBuilder.anyRating') : t('urlBuilder.stars').replace('{n}', r) }}
            </option>
          </select>
        </span>
      </div>

      <div class="eqt-url-builder__adv-row">
        <span class="eqt-url-builder__adv-cell">{{ t('urlBuilder.disableFilters') }}</span>
        <label class="eqt-url-builder__check">
          <input type="checkbox" v-model="advanced.disableFilterLanguage" />
          <span>{{ t('urlBuilder.filterLanguage') }}</span>
        </label>
        <label class="eqt-url-builder__check">
          <input type="checkbox" v-model="advanced.disableFilterUploader" />
          <span>{{ t('urlBuilder.filterUploader') }}</span>
        </label>
        <label class="eqt-url-builder__check">
          <input type="checkbox" v-model="advanced.disableFilterTags" />
          <span>{{ t('urlBuilder.filterTags') }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
