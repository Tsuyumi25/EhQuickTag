<script setup lang="ts">
import { computed, onMounted, provide, ref, shallowRef, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { Tags } from '@lucide/vue'
import MyTagsDraft from '@/components/mytags/MyTagsDraft.vue'
import {
  fetchTagSet, submitMassAction, submitNewTag,
  type MyTagRow, type NewTagInput, type TagSetRef, type TagSetSnapshot,
} from '@/composables/useEhMyTagsHost'
import { useEqtToast } from '@/composables/useEqtToast'
import { t } from '@/composables/useI18n'
import { buildMyTagsPalette, fetchAllTagSets, saveMyTagsPalette, type MyTagsPalette } from '@/services/mytags/mytagsPalette'
import { canWrite, setUserTag } from '@/services/mytags/mytagsApi'
import type { TagState } from '@/services/mytags/mytagsEdits'
import { colorUsage } from '@/services/mytags/mytagsColors'
import { MYTAGS_COLOR_USAGE } from '@/composables/useMyTagsColors'
import { askConfirm } from '@/services/confirmDialog'

// 圖庫頁的 My Tags 編輯列，開著時頂替動作列的位置。
// 標籤不在這裡挑：taglist 在這個模式下是單選，點哪顆就編輯哪顆；手打名字也會回報給外層。

const props = defineProps<{
  /** 正在編輯的標籤（nsRaw）；空字串代表還沒選 */
  tag: string
}>()

const emit = defineEmits<{
  'update:tag': [tag: string]
  close: []
  palette: [palette: MyTagsPalette]
}>()

type NewTagSubmission = NewTagInput & { tagSet: string }

const toast = useEqtToast()
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
})

// stale：寫入之後本地這份跟 EH 對不上了（例如搬過去之後抓不回目標組），
// 繼續用會把已經存在的標籤當成新的，只能整份重抓
const status = ref<'loading' | 'ready' | 'signed-out' | 'failed' | 'stale'>('loading')
const sets = shallowRef<TagSetSnapshot[]>([])
const defaultSet = ref('')
// 任何一份 /mytags 的表單都送得到任何一組，抓第一次就留著重複用
let form: HTMLFormElement | null = null
provide(MYTAGS_COLOR_USAGE, computed(() => colorUsage(sets.value.flatMap((set) => set.rows))))

async function load(): Promise<void> {
  status.value = 'loading'
  try {
    const snapshot = await fetchAllTagSets()
    if (!snapshot) { status.value = 'signed-out'; return }
    sets.value = snapshot.sets
    defaultSet.value = snapshot.current
    form = snapshot.form
    if (!sets.value.some((set) => set.value === draft.value.tagSet)) {
      draft.value = { ...draft.value, tagSet: snapshot.current }
    }
    status.value = 'ready'
    publish()
  } catch (error) {
    console.error('My Tags load failed', error)
    status.value = 'failed'
  }
}

onMounted(load)

const full = computed(() => props.tag)

// 新標籤的設定換標籤時留著：同一個意圖（例如一路關注幾個作者）只要設一次
const draft = ref<TagState & { tagSet: string }>({
  tagSet: '',
  // 跟 /mytags 的新增草稿同一個理由：EH 原生預設 10，只想關注的標籤會順手多 10 分
  weight: 0,
  color: '',
  watch: false,
  hidden: false,
})

// 同一個標籤可能放在好幾組；計分只認啟用的組，所以先找啟用的
const row = computed<MyTagRow | null>(() => {
  if (!full.value) return null
  const ordered = [...sets.value.filter((set) => set.enabled), ...sets.value.filter((set) => !set.enabled)]
  for (const set of ordered) {
    const found = set.rows.find((r) => r.full === full.value)
    if (found) return found
  }
  return null
})

// 既有標籤的未存修改；換到別的標籤就作廢
const edits = ref<Partial<TagState>>({})
const moveTarget = ref('')
watch(() => row.value?.id, () => {
  edits.value = {}
  moveTarget.value = row.value?.tagSet ?? ''
}, { immediate: true })

const state = computed<TagState>(() => {
  const r = row.value
  if (!r) return draft.value
  return { weight: r.weight, color: r.color, watch: r.watch, hidden: r.hidden, ...edits.value }
})

const dirty = computed(() => {
  const r = row.value
  if (!r) return false
  return (Object.keys(edits.value) as (keyof TagState)[]).some((key) => edits.value[key] !== r[key])
})

const setRefs = computed<TagSetRef[]>(() => sets.value.map((set) => ({
  value: set.value,
  name: set.name,
  selected: set.value === defaultSet.value,
  used: set.rows.length,
})))

const setColors = computed(() => Object.fromEntries(sets.value.map((set) => [set.value, set.defaultColor])))

function patch(change: Partial<TagState>): void {
  if (row.value) edits.value = { ...edits.value, ...change }
  else draft.value = { ...draft.value, ...change }
}

function setTarget(value: string): void {
  if (row.value) moveTarget.value = value
  else draft.value = { ...draft.value, tagSet: value }
}

function absorb(tagSet: string, rows: MyTagRow[]): void {
  sets.value = sets.value.map((set) => (set.value === tagSet ? { ...set, rows } : set))
}

function publish(): void {
  const palette = buildMyTagsPalette(sets.value)
  emit('palette', palette)
  void saveMyTagsPalette(palette).catch((error: unknown) => { console.error('palette save failed', error) })
}

const busy = ref(false)

async function run(task: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await task()
  } catch (error) {
    console.error('My Tags write failed', error)
    toast.error(t('panel.massFailed'))
  } finally {
    busy.value = false
  }
}

function create(submission: NewTagSubmission): Promise<void> {
  return run(async () => {
    if (!form) return
    const known = new Set(sets.value.find((set) => set.value === submission.tagSet)?.rows.map((r) => r.id))
    const next = await submitNewTag(form, submission.tagSet, submission)
    if (!next) { toast.error(t('panel.createFailed')); return }
    absorb(submission.tagSet, next)
    publish()
    const added = next.find((r) => !known.has(r.id))
    if (!added) { toast.error(t('panel.createRejected')); return }
    const set = sets.value.find((s) => s.value === added.tagSet)
    const message = set?.enabled === false ? 'gallery.myTagsCreatedDisabled' : 'gallery.myTagsCreated'
    toast.success(t(message, { tag: added.full, set: set?.name ?? added.tagSet }))
  })
}

function save(): Promise<void> {
  return run(async () => {
    const r = row.value
    if (!r || !dirty.value) return
    if (!canWrite()) { toast.error(t('panel.noCredentials')); return }
    const next = { ...r, ...state.value }
    const res = await setUserTag(next)
    if (!res.ok) { toast.error(t('gallery.myTagsSaveFailed', { tag: r.full, error: res.error })); return }
    absorb(r.tagSet, sets.value.find((set) => set.value === r.tagSet)!.rows.map((x) => (x.id === r.id ? next : x)))
    edits.value = {}
    publish()
  })
}

function move(target: string): Promise<void> {
  return run(async () => {
    const r = row.value
    if (!r || target === r.tagSet) return
    const next = await submitMassAction([r.id], target, r.tagSet)
    if (!next) { toast.error(t('panel.massFailed')); return }
    absorb(r.tagSet, next)
    if (next.some((x) => x.id === r.id)) { toast.error(t('panel.massFailed')); return }
    const got = await fetchTagSet(target)
    if (!got) {
      status.value = 'stale'
      return
    }
    absorb(target, got.rows)
    publish()
  })
}

function remove(): Promise<void> {
  return run(async () => {
    const r = row.value
    if (!r) return
    if (!await askConfirm(t('panel.deleteConfirmOne', { tag: r.full }), t('panel.labelDelete'))) return
    const next = await submitMassAction([r.id], '0', r.tagSet)
    if (!next) { toast.error(t('panel.massFailed')); return }
    absorb(r.tagSet, next)
    publish()
    if (next.some((x) => x.id === r.id)) toast.error(t('panel.massFailed'))
  })
}
</script>

<template>
  <MyTagsDraft
    class="eqt-gallery-mytags"
    row
    :disabled="status !== 'ready'"
    :full="full"
    :state="state"
    :target-set="row ? moveTarget : draft.tagSet"
    :source-set="row?.tagSet ?? null"
    :sets="setRefs"
    :set-colors="setColors"
    :busy="busy"
    @update:target-set="setTarget"
    @update:full="emit('update:tag', $event)"
    @patch="patch"
    @create="create"
    @move="move"
    @remove="remove"
  >
    <template #head>
      <div class="eqt-gallery-mytags__head">
        <span class="eqt-gallery-mytags__title"><Tags :size="14" />My Tags</span>
        <span v-if="status === 'loading'" class="eqt-gallery-mytags__note" role="status">
          {{ t('gallery.myTagsLoading') }}
        </span>
        <span v-else-if="status === 'signed-out'" class="eqt-gallery-mytags__note" role="status">
          {{ t('gallery.myTagsSignedOut') }}
        </span>
        <template v-else-if="status === 'failed' || status === 'stale'">
          <span class="eqt-gallery-mytags__note eqt-gallery-mytags__note--alert" role="alert">
            {{ t(status === 'failed' ? 'gallery.myTagsLoadFailed' : 'gallery.myTagsStale') }}
          </span>
          <button type="button" class="eqt-gallery-mytags__reload eqt-panel__btn" @click="load">
            {{ t('gallery.myTagsReload') }}
          </button>
        </template>
        <span v-else-if="!full" class="eqt-gallery-mytags__note">{{ t('gallery.myTagsPickHint') }}</span>
        <button
          type="button"
          class="eqt-gallery-mytags__close"
          :title="t('settings.close')"
          @click="emit('close')"
        >×</button>
      </div>
    </template>
    <button
      v-if="dirty"
      type="button"
      class="eqt-gallery-mytags__save eqt-panel__btn eqt-panel__btn--primary"
      :disabled="busy"
      @click="save"
    >{{ busy ? t('panel.working') : t('gallery.myTagsSave') }}</button>
  </MyTagsDraft>
</template>

<style lang="scss">
// 根節點就是 MyTagsDraft 的那一格：外框、底色都用它的，這裡只管它在動作列位置上的擺法
.eqt-gallery-mytags {
  // 跟 .eqt-gallery-actions 同一個外距，翻面前後的位置對得上
  margin: 6px 6px 0 0;
  color: var(--eqt-text);
  text-align: left;
  font-size: var(--eqt-fs-md);

  // 一列版的草稿會換行，標題列佔滿第一行
  &__head {
    display: flex;
    flex: 1 0 100%;
    align-items: center;
    gap: calc(var(--eqt-checkbox-size) / 3);
    min-width: 0;
  }

  &__title {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: calc(var(--eqt-checkbox-size) / 6);
    font-weight: bold;
  }

  &__note {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: var(--eqt-text-hint);
    text-overflow: ellipsis;
    white-space: nowrap;

    &--alert { color: var(--eqt-danger); }
  }

  &__reload { flex: none; }

  &__close {
    flex: none;
    margin-left: auto;
    padding: 0;
    width: var(--eqt-row-h);
    border: none;
    background: transparent;
    color: inherit;
    font-size: calc(var(--eqt-fs-lg) * 1.25);
    line-height: var(--eqt-row-h);
    cursor: pointer;
    opacity: 0.8;

    &:hover { opacity: 1; }
  }

  &__save {
    height: calc(var(--eqt-checkbox-size) + var(--eqt-border-width) * 2);
    padding: 0 calc(var(--eqt-checkbox-size) / 3);
    font-size: var(--eqt-fs-xs);
  }
}
</style>
