import { createApp } from 'vue'
import App from '@/App.vue'
import { loadStore, startAutoSave } from '@/services/store'

;(async () => {
  await loadStore()

  const app = createApp(App)
  app.mount(
    (() => {
      const container = document.createElement('div')
      container.id = 'eqt-app'
      document.body.append(container)
      return container
    })(),
  )

  startAutoSave()
})()
