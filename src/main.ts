import { createApp } from 'vue'
import Toast, { POSITION } from 'vue-toastification'
import App from '@/App.vue'
import { loadStore, startAutoSave } from '@/services/store'
import { loadSessionHistory } from '@/services/search/searchSession'
import '@/styles/theme.scss'
import '@/styles/popup.scss'
import '@/styles/tag-style.scss'
import '@/styles/native-search-row.scss'
import '@/styles/tag-icon.scss'
import '@/styles/gallery-taglist.scss'
import '@/styles/gallery-intro-panel.scss'
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

  const appContainer = document.createElement('div')
  appContainer.id = 'eqt-app'
  appContainer.setAttribute('translate', 'no')
  document.body.append(appContainer)

  const app = createApp(App)
  app.use(Toast, {
    container: toastContainer,
    position: POSITION.TOP_RIGHT,
    timeout: 5000,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    draggable: true,
  })
  app.mount(appContainer)

  startAutoSave()
})()
