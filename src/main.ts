import { createApp } from 'vue'
import App from '@/App.vue'
import { loadStore, startAutoSave } from '@/services/store'
import '@/styles/theme.scss'

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
      document.body.append(container)
      return container
    })(),
  )

  startAutoSave()
})()
