import { createApp } from 'vue'
import App from '@/App.vue'

const app = createApp(App)

app.mount(
  (() => {
    const container = document.createElement('div')
    container.id = 'eqt-app'
    document.body.append(container)
    return container
  })(),
)
