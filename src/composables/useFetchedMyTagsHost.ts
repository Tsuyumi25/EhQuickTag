import { computed, reactive, ref, shallowRef } from 'vue'
import { fetchTagSet, submitMassAction, submitNewTag, type MyTagRow, type TagSetSnapshot } from '@/composables/useEhMyTagsHost'
import { useEqtToast } from '@/composables/useEqtToast'
import { t } from '@/composables/useI18n'
import { buildMyTagsPalette, fetchAllTagSets, saveMyTagsPalette, type MyTagsPalette } from '@/services/mytags/mytagsPalette'
import { pageCredentials, setUserTag, type ApiCredentials } from '@/services/mytags/mytagsApi'
import type { TagState } from '@/services/mytags/mytagsEdits'
import { addedRow, type MyTagsEditorHost, type MyTagsEditorHostStatus, type NewTagSubmission } from '@/services/mytags/mytagsEditorHost'

/** 不在 /mytags 的頁面：把每一組的 /mytags 抓回來當現況，寫回去之後更新這份 */
export function useFetchedMyTagsHost(onPalette: (palette: MyTagsPalette) => void): MyTagsEditorHost {
  const toast = useEqtToast()
  const status = ref<MyTagsEditorHostStatus>('loading')
  const sets = shallowRef<TagSetSnapshot[]>([])
  const defaultSet = ref('')
  // 任何一份 /mytags 的表單都送得到任何一組，抓第一次就留著重複用
  let form: HTMLFormElement | null = null
  // 圖庫頁有全域變數可讀；列表頁沒有，用抓回來那份 /mytags 裡的
  let credentials: ApiCredentials | null = null

  function absorb(tagSet: string, rows: MyTagRow[]): void {
    sets.value = sets.value.map((set) => (set.value === tagSet ? { ...set, rows } : set))
  }

  function publish(): void {
    const palette = buildMyTagsPalette(sets.value)
    onPalette(palette)
    void saveMyTagsPalette(palette).catch((error: unknown) => { console.error('palette save failed', error) })
  }

  async function load(): Promise<void> {
    status.value = 'loading'
    try {
      const snapshot = await fetchAllTagSets()
      if (!snapshot) { status.value = 'signed-out'; return }
      sets.value = snapshot.sets
      defaultSet.value = snapshot.current
      form = snapshot.form
      credentials = pageCredentials() ?? snapshot.credentials
      status.value = 'ready'
      publish()
    } catch (error) {
      console.error('My Tags load failed', error)
      status.value = 'failed'
    }
  }

  return reactive({
    status,
    busy: false,
    sets: computed(() => sets.value.map((set) => ({
      value: set.value,
      name: set.name,
      selected: set.value === defaultSet.value,
      used: set.rows.length,
    }))),
    setColors: computed(() => Object.fromEntries(sets.value.map((set) => [set.value, set.defaultColor]))),
    defaultSet,
    colorRows: computed(() => sets.value.flatMap((set) => set.rows)),
    rowOf(full: string): MyTagRow | null {
      for (const set of sets.value) {
        const found = set.rows.find((row) => row.full === full)
        if (found) return found
      }
      return null
    },
    load() { void load() },
    async save(row: MyTagRow, state: TagState): Promise<boolean> {
      if (!credentials) { toast.error(t('panel.noCredentials')); return false }
      const next = { ...row, ...state }
      const res = await setUserTag(next, credentials)
      if (!res.ok) { toast.error(t('gallery.myTagsSaveFailed', { tag: row.full, error: res.error })); return false }
      absorb(row.tagSet, sets.value.find((set) => set.value === row.tagSet)!.rows.map((x) => (x.id === row.id ? next : x)))
      publish()
      return true
    },
    async create(submission: NewTagSubmission): Promise<MyTagRow | null> {
      if (!form) return null
      const before = sets.value.find((set) => set.value === submission.tagSet)?.rows ?? []
      const next = await submitNewTag(form, submission.tagSet, submission)
      if (!next) { toast.error(t('panel.createFailed')); return null }
      absorb(submission.tagSet, next)
      publish()
      const added = addedRow(before, next)
      if (!added) { toast.error(t('panel.createRejected')); return null }
      const set = sets.value.find((s) => s.value === added.tagSet)
      const message = set?.enabled === false ? 'gallery.myTagsCreatedDisabled' : 'gallery.myTagsCreated'
      toast.success(t(message, { tag: added.full, set: set?.name ?? added.tagSet }))
      return added
    },
    async move(row: MyTagRow, target: string): Promise<void> {
      const next = await submitMassAction([row.id], target, row.tagSet)
      if (!next) { toast.error(t('panel.massFailed')); return }
      absorb(row.tagSet, next)
      if (next.some((x) => x.id === row.id)) { toast.error(t('panel.massFailed')); return }
      const got = await fetchTagSet(target)
      if (!got) {
        // 搬過去了卻讀不回目標組：本地少了這一列，繼續用會把它當成新的再加一次，
        // palette 也還停在搬之前。整份重抓，失敗就停在 failed、草稿鎖住
        await load()
        return
      }
      absorb(target, got.rows)
      publish()
    },
    async remove(row: MyTagRow): Promise<void> {
      const next = await submitMassAction([row.id], '0', row.tagSet)
      if (!next) { toast.error(t('panel.massFailed')); return }
      absorb(row.tagSet, next)
      publish()
      if (next.some((x) => x.id === row.id)) toast.error(t('panel.massFailed'))
    },
  })
}
