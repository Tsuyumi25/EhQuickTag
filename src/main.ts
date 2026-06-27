import { createApp } from 'vue'
import App from '@/App.vue'
import { loadStore, startAutoSave } from '@/services/store'
import { loadSessionHistory } from '@/services/search/searchSession'
import '@/styles/theme.scss'
import '@/styles/popup.scss'
import '@/styles/tag-style.scss'
import '@/styles/native-search-row.scss'
import '@/styles/tag-icon.scss'

;(async () => {
  // 讀不同 GM key、無依賴，並行省一條 round-trip
  await Promise.all([loadStore(), loadSessionHistory()])

  const app = createApp(App)
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
