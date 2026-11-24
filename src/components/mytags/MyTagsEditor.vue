<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { Tags } from '@lucide/vue'
import MyTagsDraft from '@/components/mytags/MyTagsDraft.vue'
import { useEqtToast } from '@/composables/useEqtToast'
import { t } from '@/composables/useI18n'
import { applyTagPatch, newTagDraft, restage, stateOf, type TagPatch, type TagState } from '@/services/mytags/mytagsEdits'
import type { MyTagsEditorHost, MyTagsWish, NewTagSubmission } from '@/services/mytags/mytagsEditorHost'
import type { TagImpact } from '@/services/mytags/mytagsScore'
import { colorUsage } from '@/services/mytags/mytagsColors'
import { MYTAGS_COLOR_USAGE } from '@/composables/useMyTagsColors'
import { askConfirm, confirmRequest } from '@/services/confirmDialog'

// 新增、修改、搬移、刪除一個 My Tags 標籤，按下去就寫回 EH。/mytags 編輯區、圖庫頁、列表 dock 都是這一個。
// 標籤不在這裡挑：使用端決定交給它哪一顆；手打名字也會回報給使用端。

const props = withDefaults(defineProps<{
  /** 正在編輯的標籤（nsRaw）；空字串代表還沒選 */
  tag: string
  host: MyTagsEditorHost
  /** 排成一列、帶標題列與關閉鈕：頂替圖庫頁動作列或列表 dock 的那一條 */
  row?: boolean
  impact?: TagImpact
  previewed?: boolean
}>(), {
  row: false,
  impact: undefined,
  previewed: false,
})

const emit = defineEmits<{
  'update:tag': [tag: string]
  close: []
  preview: []
  confirm: []
  wish: [wish: MyTagsWish | null]
}>()

const toast = useEqtToast()
if (props.row) {
  useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    // 確認框開著時 Esc 是在回答它；色盤用掉的 Esc 會先標記 defaultPrevented
    if (e.key !== 'Escape' || e.defaultPrevented || confirmRequest.value) return
    emit('close')
  })
}
provide(MYTAGS_COLOR_USAGE, computed(() => colorUsage(props.host.colorRows)))
onMounted(() => props.host.load())

const saved = computed(() => (props.tag ? props.host.rowOf(props.tag) : null))
const exists = computed(() => saved.value !== null)

const draft = ref(newTagDraft(props.host.defaultSet))
const edits = ref<TagPatch>({})
// 標籤就是 key：換了名字，或這顆從沒有變成有、從有變成沒有，手上的修改都是上一顆的
watch([() => props.tag, exists], () => {
  draft.value = newTagDraft(props.host.defaultSet)
  edits.value = {}
})
watch(() => props.host.sets, (sets) => {
  if (!sets.some((set) => set.value === draft.value.tagSet)) {
    draft.value = { ...draft.value, tagSet: props.host.defaultSet }
  }
})
const moveTarget = ref('')
watch(() => saved.value?.tagSet, (tagSet) => { moveTarget.value = tagSet ?? '' }, { immediate: true })

const state = computed<TagState>(() => (saved.value ? { ...stateOf(saved.value), ...edits.value } : draft.value))
const dirty = computed(() => exists.value && Object.keys(edits.value).length > 0)

const wish = computed<MyTagsWish | null>(() => {
  if (!props.tag) return null
  const row = saved.value
  if (!row) return { full: props.tag, tagSet: draft.value.tagSet, state: draft.value }
  return dirty.value ? { full: row.full, tagSet: row.tagSet, state: state.value } : null
})
watch(wish, (value) => emit('wish', value), { immediate: true })

function patch(change: Partial<TagState>): void {
  if (saved.value) edits.value = restage(stateOf(saved.value), edits.value, change) ?? {}
  else draft.value = applyTagPatch(draft.value, change)
}

function setTarget(value: string): void {
  if (saved.value) moveTarget.value = value
  else draft.value = { ...draft.value, tagSet: value }
}

const busy = ref(false)

async function run(task: () => Promise<void>): Promise<void> {
  if (busy.value || props.host.busy) return
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

function save(): Promise<void> {
  return run(async () => {
    const row = saved.value
    if (!row || !dirty.value) return
    if (await props.host.save(row, state.value)) edits.value = {}
  })
}

function create(submission: NewTagSubmission): Promise<void> {
  return run(async () => {
    const added = await props.host.create(submission)
    if (added && added.full !== props.tag) emit('update:tag', added.full)
  })
}

function move(target: string): Promise<void> {
  return run(async () => {
    const row = saved.value
    if (!row || target === row.tagSet) return
    await props.host.move(row, target)
  })
}

function remove(): Promise<void> {
  return run(async () => {
    const row = saved.value
    if (!row) return
    if (!await askConfirm(t('panel.deleteConfirmOne', { tag: row.full }), t('panel.labelDelete'))) return
    await props.host.remove(row)
  })
}
</script>

<template>
  <MyTagsDraft
    class="eqt-mytags-editor"
    :row="row"
    :disabled="host.status !== 'ready'"
    :full="tag"
    :state="state"
    :target-set="saved ? moveTarget : draft.tagSet"
    :source-set="saved?.tagSet ?? null"
    :sets="host.sets"
    :set-colors="host.setColors"
    :busy="busy || host.busy"
    :impact="impact"
    :show-impact="impact !== undefined"
    :previewed="previewed"
    @update:target-set="setTarget"
    @update:full="emit('update:tag', $event)"
    @patch="patch"
    @create="create"
    @move="move"
    @remove="remove"
    @preview="emit('preview')"
    @confirm="emit('confirm')"
  >
    <template v-if="row" #head>
      <div class="eqt-mytags-editor__head">
        <span class="eqt-mytags-editor__title"><Tags :size="14" />{{ t('gallery.myTags') }}</span>
        <span v-if="host.status === 'loading'" class="eqt-mytags-editor__note" role="status">
          {{ t('gallery.myTagsLoading') }}
        </span>
        <span v-else-if="host.status === 'signed-out'" class="eqt-mytags-editor__note" role="status">
          {{ t('gallery.myTagsSignedOut') }}
        </span>
        <template v-else-if="host.status === 'failed'">
          <span class="eqt-mytags-editor__note eqt-mytags-editor__note--alert" role="alert">
            {{ t('gallery.myTagsLoadFailed') }}
          </span>
          <button type="button" class="eqt-mytags-editor__reload eqt-panel__btn" @click="host.load()">
            {{ t('gallery.myTagsReload') }}
          </button>
        </template>
        <span v-else-if="!tag" class="eqt-mytags-editor__note">{{ t('gallery.myTagsPickHint') }}</span>
        <button
          type="button"
          class="eqt-mytags-editor__close"
          :title="t('settings.close')"
          @click="emit('close')"
        >×</button>
      </div>
    </template>
    <button
      v-if="dirty"
      type="button"
      class="eqt-mytags-editor__save eqt-panel__btn eqt-panel__btn--primary"
      :disabled="busy || host.busy"
      @click="save"
    >{{ busy ? t('panel.working') : t('gallery.myTagsSave') }}</button>
  </MyTagsDraft>
</template>

<style lang="scss">
// 根節點就是 MyTagsDraft 的那一格：外框、底色都用它的；放在哪、留多少外距由使用端決定
.eqt-mytags-editor {
  // 一列版放在別人的頁面上，字色、對齊、字級都會從宿主繼承過來
  &.eqt-tag-draft--row {
    color: var(--eqt-text);
    text-align: left;
    font-size: var(--eqt-fs-md);
  }

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

  &.eqt-tag-draft--row &__save {
    height: calc(var(--eqt-checkbox-size) + var(--eqt-border-width) * 2);
    padding: 0 calc(var(--eqt-checkbox-size) / 3);
    font-size: var(--eqt-fs-xs);
  }
}
</style>
