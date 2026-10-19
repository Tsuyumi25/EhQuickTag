import { shallowRef } from 'vue'
import { useEqtToast } from '@/composables/useEqtToast'
import { t } from '@/composables/useI18n'
import { loadMyTagsPalette, type MyTagsPalette } from '@/services/mytags/mytagsPalette'
import { pageWindow } from '@/utils/pageWindow'

// 整頁共用一份：規則頁裡每顆 chip、素材與候選清單都要查同一張表，各自載會重複打 /mytags
const palette = shallowRef<MyTagsPalette | null>(null)
let requested = false

/** 未登入（apiuid = -1）時沒有 My Tags，維持 null，chip 照一般配色 */
export function useMyTagsPalette() {
  if (!requested && pageWindow<{ apiuid?: number }>().apiuid !== -1) {
    // 失敗也不重試：每顆 chip 都會呼叫這裡，重試會變成一整排錯誤提示
    requested = true
    const toast = useEqtToast()
    loadMyTagsPalette()
      .then(loaded => { palette.value = loaded })
      .catch(() => toast.error(t('gallery.myTagsColorsFailed')))
  }
  return palette
}
