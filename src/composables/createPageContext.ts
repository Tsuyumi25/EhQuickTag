import { getCurrentInstance, getCurrentScope } from 'vue'

export function createPageContext<T>(setup: () => T): () => T {
  const created = new WeakMap<object, T>()

  return (): T => {
    // App 必須先在根組件取用，讓副作用跟隨根組件的 scope。
    const owner = getCurrentInstance()?.appContext ?? getCurrentScope()
    if (!owner) {
      throw new Error('page context requires an active component setup or effect scope')
    }

    if (created.has(owner)) return created.get(owner)!
    const value = setup()
    created.set(owner, value)
    return value
  }
}
