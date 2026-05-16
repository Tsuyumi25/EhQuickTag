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
        ...options,
        onStart: (evt) => {
          orderBeforeDrag = instance!.toArray()
          options.onStart?.(evt)
        },
        onEnd: (evt) => {
          // Sortable moves DOM nodes directly, bypassing Vue's virtual DOM.
          // Restore the pre-drag DOM order so Vue's reconciler can re-render
          // from a clean baseline instead of fighting Sortable over node positions.
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
