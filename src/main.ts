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
import 'vue-toastification/dist/index.css'
import '@/styles/toast-overrides.scss'

;(async () => {
  // 讀不同 GM key、無依賴，並行省一條 round-trip
  await Promise.all([loadStore(), loadSessionHistory()])

  const app = createApp(App)
  app.use(Toast, {
    position: POSITION.TOP_RIGHT,
    timeout: 5000,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    draggable: true,
  })
  app.mount(
    (() => {
      if (location.hostname === 'exhentai.org') {
        document.documentElement.classList.add('eqt-dark')
      }
      const container = document.createElement('div')
      container.id = 'eqt-app'
      container.setAttribute('translate', 'no')
      document.body.append(container)
      return container
    })(),
  )

  startAutoSave()
})()
