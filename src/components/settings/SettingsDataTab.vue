<script setup lang="ts">
import { ref, computed } from 'vue'
import { RotateCcw, Database, ChartColumn, BookOpen, Languages, Archive, Download, Upload } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import { useEqtToast } from '@/composables/useEqtToast'
import { refreshTagDb, TAG_DB_MIRRORS, type TagDbMirror } from '@/services/tags/tagDb'
import { refreshTagCount, TAG_COUNT_MIRRORS, type TagCountMirror } from '@/services/tags/tagCount'
import { refreshTagWiki, TAG_WIKI_MIRRORS, WikiSchemaMismatchError, type TagWikiMirror } from '@/services/tags/tagWiki'
import { refreshCjkDict, CJK_DICT_MIRRORS, type CjkDictMirror } from '@/services/tags/cjkDict'
import {
  tagDbMirror, tagDbTtlDays, tagCountMirror, tagCountTtlDays,
  tagWikiMirror, tagWikiTtlDays, cjkDictMirror, cjkDictTtlDays,
} from '@/services/store'
import { BackupError, decodeBackup, exportBackup, restoreBackup } from '@/services/backup'
import { askConfirm } from '@/services/confirmDialog'
import { downloadJson } from '@/utils/downloadJson'

const toast = useEqtToast()

const mirrorOptions = Object.entries(TAG_DB_MIRRORS).map(([k, v]) => ({ value: k as TagDbMirror, label: v.label }))
const tagCountMirrorOptions = Object.entries(TAG_COUNT_MIRRORS).map(([k, v]) => ({ value: k as TagCountMirror, label: v.label }))
const tagWikiMirrorOptions = Object.entries(TAG_WIKI_MIRRORS).map(([k, v]) => ({ value: k as TagWikiMirror, label: v.label }))
const cjkDictMirrorOptions = Object.entries(CJK_DICT_MIRRORS).map(([k, v]) => ({ value: k as CjkDictMirror, label: v.label }))

// 各 section 第二行顯示的來源網址：跟著選中的 mirror 連動，唯讀給使用者
// 核對實際抓哪裡
const tagDbUrl = computed(() => TAG_DB_MIRRORS[tagDbMirror.value].url)
const tagCountUrl = computed(() => TAG_COUNT_MIRRORS[tagCountMirror.value].url)
const tagWikiUrl = computed(() => TAG_WIKI_MIRRORS[tagWikiMirror.value].url)
const cjkDictUrl = computed(() => CJK_DICT_MIRRORS[cjkDictMirror.value].url)

const refreshing = ref(false)
async function onRefreshTagDb() {
  refreshing.value = true
  try {
    await refreshTagDb({ mirror: tagDbMirror.value, ttlDays: tagDbTtlDays.value })
    toast.success(t('settings.tagDbRefreshSuccess'))
  } catch (e) {
    toast.error(t('settings.tagDbRefreshFailed'))
    console.error('refreshTagDb failed', e)
  } finally {
    refreshing.value = false
  }
}

const refreshingTagCount = ref(false)
async function onRefreshTagCount() {
  refreshingTagCount.value = true
  try {
    await refreshTagCount({ mirror: tagCountMirror.value, ttlDays: tagCountTtlDays.value })
    toast.success(t('settings.tagCountRefreshSuccess'))
  } catch (e) {
    toast.error(t('settings.tagCountRefreshFailed'))
    console.error('refreshTagCount failed', e)
  } finally {
    refreshingTagCount.value = false
  }
}

const refreshingTagWiki = ref(false)
async function onRefreshTagWiki() {
  refreshingTagWiki.value = true
  try {
    await refreshTagWiki({ mirror: tagWikiMirror.value, ttlDays: tagWikiTtlDays.value })
    toast.success(t('settings.tagWikiRefreshSuccess'))
  } catch (e) {
    // schema mismatch 通常是 CDN edge 遲滯，切 mirror 到 GitHub Raw 可以繞開；
    // 純網路 / decode 錯就走通用訊息
    if (e instanceof WikiSchemaMismatchError) {
      toast.error(t('settings.tagWikiSchemaMismatch'))
    } else {
      toast.error(t('settings.tagWikiRefreshFailed'))
    }
    console.error('refreshTagWiki failed', e)
  } finally {
    refreshingTagWiki.value = false
  }
}

const refreshingCjkDict = ref(false)
async function onRefreshCjkDict() {
  refreshingCjkDict.value = true
  try {
    await refreshCjkDict({ mirror: cjkDictMirror.value, ttlDays: cjkDictTtlDays.value })
    toast.success(t('settings.cjkDictRefreshSuccess'))
  } catch (e) {
    toast.error(t('settings.cjkDictRefreshFailed'))
    console.error('refreshCjkDict failed', e)
  } finally {
    refreshingCjkDict.value = false
  }
}

const backupBusy = ref(false)
const importInput = ref<HTMLInputElement | null>(null)

async function onExportBackup() {
  backupBusy.value = true
  try {
    const now = new Date()
    downloadJson(`EhQuickTag-backup-${now.toISOString().slice(0, 10)}.json`, await exportBackup(now))
  } catch (e) {
    toast.error(t('settings.backupExportFailed'))
    console.error('exportBackup failed', e)
  } finally {
    backupBusy.value = false
  }
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // 清掉選取，同一個檔案改過之後再選一次也會觸發 change
  input.value = ''
  if (!file) return
  backupBusy.value = true
  try {
    const backup = decodeBackup(await file.text())
    const date = new Date(backup.exportedAt).toLocaleString()
    if (!await askConfirm(t('settings.backupImportConfirm', { date }), t('settings.backupImportConfirmLabel'))) return
    await restoreBackup(backup)
    location.reload()
  } catch (e) {
    if (e instanceof BackupError) {
      toast.error(t(e.reason === 'newer' ? 'settings.backupImportNewer' : 'settings.backupImportInvalid'))
    } else {
      toast.error(t('settings.backupImportFailed'))
    }
    console.error('importBackup failed', e)
  } finally {
    backupBusy.value = false
  }
}
</script>

<template>
  <div class="eqt-settings__tab-content">
    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Archive :size="14" /> {{ t('settings.backupSection') }}</h4>
      <div class="eqt-settings__row">
        <button class="eqt-settings__data-btn" type="button" :disabled="backupBusy" @click="onExportBackup">
          <Download :size="12" /> {{ t('settings.backupExport') }}
        </button>
        <button class="eqt-settings__data-btn" type="button" :disabled="backupBusy" @click="importInput?.click()">
          <Upload :size="12" /> {{ t('settings.backupImport') }}
        </button>
        <input ref="importInput" type="file" accept=".json,application/json" hidden @change="onImportFile" />
      </div>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Database :size="14" /> {{ t('settings.tagDbSection') }}</h4>
      <div class="eqt-settings__row">
        <select class="eqt-settings__select" v-model="tagDbMirror" :title="t('settings.tagDbMirror')">
          <option v-for="opt in mirrorOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <input class="eqt-settings__input eqt-settings__input--short" type="number" min="1" max="30" v-model.number="tagDbTtlDays" :title="t('settings.tagDbTtlDays')" />
        <button class="eqt-settings__data-btn" type="button" :disabled="refreshing" @click="onRefreshTagDb">
          <RotateCcw :size="12" /> {{ refreshing ? t('settings.tagDbRefreshing') : t('settings.tagDbRefresh') }}
        </button>
      </div>
      <div class="eqt-settings__row">
        <input class="eqt-settings__text-input eqt-settings__text-input--full" :value="tagDbUrl" readonly />
      </div>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><ChartColumn :size="14" /> {{ t('settings.tagCountSection') }}</h4>
      <div class="eqt-settings__row">
        <select class="eqt-settings__select" v-model="tagCountMirror" :title="t('settings.tagCountMirror')">
          <option v-for="opt in tagCountMirrorOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <input class="eqt-settings__input eqt-settings__input--short" type="number" min="1" max="30" v-model.number="tagCountTtlDays" :title="t('settings.tagCountTtlDays')" />
        <button class="eqt-settings__data-btn" type="button" :disabled="refreshingTagCount" @click="onRefreshTagCount">
          <RotateCcw :size="12" /> {{ refreshingTagCount ? t('settings.tagCountRefreshing') : t('settings.tagCountRefresh') }}
        </button>
      </div>
      <div class="eqt-settings__row">
        <input class="eqt-settings__text-input eqt-settings__text-input--full" :value="tagCountUrl" readonly />
      </div>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><BookOpen :size="14" /> {{ t('settings.tagWikiSection') }}</h4>
      <div class="eqt-settings__row">
        <select class="eqt-settings__select" v-model="tagWikiMirror" :title="t('settings.tagWikiMirror')">
          <option v-for="opt in tagWikiMirrorOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <input class="eqt-settings__input eqt-settings__input--short" type="number" min="1" max="30" v-model.number="tagWikiTtlDays" :title="t('settings.tagWikiTtlDays')" />
        <button class="eqt-settings__data-btn" type="button" :disabled="refreshingTagWiki" @click="onRefreshTagWiki">
          <RotateCcw :size="12" /> {{ refreshingTagWiki ? t('settings.tagWikiRefreshing') : t('settings.tagWikiRefresh') }}
        </button>
      </div>
      <div class="eqt-settings__row">
        <input class="eqt-settings__text-input eqt-settings__text-input--full" :value="tagWikiUrl" readonly />
      </div>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Languages :size="14" /> {{ t('settings.cjkDictSection') }}</h4>
      <div class="eqt-settings__row">
        <select class="eqt-settings__select" v-model="cjkDictMirror" :title="t('settings.cjkDictMirror')">
          <option v-for="opt in cjkDictMirrorOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <input class="eqt-settings__input eqt-settings__input--short" type="number" min="1" max="90" v-model.number="cjkDictTtlDays" :title="t('settings.cjkDictTtlDays')" />
        <button class="eqt-settings__data-btn" type="button" :disabled="refreshingCjkDict" @click="onRefreshCjkDict">
          <RotateCcw :size="12" /> {{ refreshingCjkDict ? t('settings.cjkDictRefreshing') : t('settings.cjkDictRefresh') }}
        </button>
      </div>
      <div class="eqt-settings__row">
        <input class="eqt-settings__text-input eqt-settings__text-input--full" :value="cjkDictUrl" readonly />
      </div>
    </section>
  </div>
</template>

<style lang="scss">
@use '../../styles/buttons' as *;

.eqt-settings {
  &__data-btn {
    @include btn-toned;
    height: var(--eqt-ctrl-h);
    padding: 0 8px;

    &:disabled {
      opacity: 0.5;
    }
  }
}
</style>
