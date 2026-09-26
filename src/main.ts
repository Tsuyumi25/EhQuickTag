import { createApp, effectScope } from 'vue'
import Toast, { POSITION } from 'vue-toastification'
import App from '@/App.vue'
import { loadStore, startAutoSave, tagDbMirror, tagDbTtlDays, tagCountMirror, tagCountTtlDays, tagWikiMirror, tagWikiTtlDays } from '@/services/store'
import { loadSessionHistory } from '@/services/search/searchSession'
import { createAnchor } from '@/utils/createAnchor'
import { loadTagDb } from '@/services/tags/tagDb'
import { loadTagCount } from '@/services/tags/tagCount'
import { loadTagWiki, WikiSchemaMismatchError } from '@/services/tags/tagWiki'
import { useEqtToast } from '@/composables/useEqtToast'
import { t } from '@/composables/useI18n'
import '@/styles/tagbar.scss'
import '@/styles/theme.scss'
import '@/styles/popup.scss'
import '@/styles/tag-style.scss'
import '@/styles/native-search-row.scss'
import '@/styles/tag-icon.scss'
import '@/styles/gallery-taglist.scss'
import '@/styles/gallery-intro-panel.scss'
import '@/styles/mytags-panel.scss'
import 'vue-toastification/dist/index.css'
import '@/styles/toast-overrides.scss'

;(async () => {
  // 讀不同 GM key、無依賴，並行省一條 round-trip
  await Promise.all([loadStore(), loadSessionHistory()])

  if (location.hostname === 'exhentai.org') {
    document.documentElement.classList.add('eqt-dark')
  }

  const toastContainer = document.createElement('div')
  toastContainer.id = 'eqt-toast'
  document.body.append(toastContainer)

  const anchorScope = effectScope()
  const appContainer = anchorScope.run(() => createAnchor('eqt-app'))!
  document.body.append(appContainer)

  const app = createApp(App)
  app.onUnmount(() => anchorScope.stop())
  app.use(Toast, {
    container: toastContainer,
    position: POSITION.TOP_RIGHT,
    timeout: 5000,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    draggable: true,
  })

  const toast = useEqtToast()
  loadTagDb({ mirror: tagDbMirror.value, ttlDays: tagDbTtlDays.value })
  loadTagCount({ mirror: tagCountMirror.value, ttlDays: tagCountTtlDays.value })
  loadTagWiki({ mirror: tagWikiMirror.value, ttlDays: tagWikiTtlDays.value })
    .catch((e) => {
      // 初次載入時失敗——schema 錯 (CDN 遲滯) 用專屬提示引導切 mirror；其他錯默默
      // console 不打擾使用者 (單純網路瞬斷之類的下次載入自然重試)
      if (e instanceof WikiSchemaMismatchError) {
        toast.error(t('settings.tagWikiSchemaMismatch'))
      }
      console.error('[tagWiki] load failed:', e)
    })

  app.mount(appContainer)

  startAutoSave()
})()
