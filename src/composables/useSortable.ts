import { onBeforeUnmount, type Ref } from 'vue'
import Sortable from 'sortablejs'

export function useSortable(el: Ref<HTMLElement | null>, options: Sortable.Options): {
  activate: () => void
  deactivate: () => void
} {
  let instance: Sortable | null = null
  let orderBeforeDrag: string[] = []

  function activate(): void {
    if (el.value && !instance) {
      instance = Sortable.create(el.value, {
        forceFallback: true,
        ...options,
        onStart: (evt) => {
          orderBeforeDrag = instance!.toArray()
          options.onStart?.(evt)
        },
        onEnd: (evt) => {
          instance!.sort(orderBeforeDrag)
          options.onEnd?.(evt)
        },
      })
    }
  }

  function deactivate(): void {
    instance?.destroy()
    instance = null
  }

  onBeforeUnmount(deactivate)

  return { activate, deactivate }
}
