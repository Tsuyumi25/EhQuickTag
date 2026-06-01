import { createApp } from 'vue'
import App from '@/App.vue'
import { loadStore, startAutoSave } from '@/services/store'
import '@/styles/theme.scss'
import '@/styles/popup.scss'
import '@/styles/tag-style.scss'

;(async () => {
  await loadStore()

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
