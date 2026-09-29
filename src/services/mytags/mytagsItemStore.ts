// 遷移只寫不可變的 base，後續編輯與刪除墓碑寫 live，避免較慢的遷移覆蓋新資料。

import { cacheDelete, cacheGet, cacheKeys, cacheSet } from '@/services/gmStorage'

const ITEM_SCHEMA = 2

function itemNamespace(prefix: string): { live: string; base: string } {
  return { live: `${prefix}:`, base: `${prefix}_base:` }
}

export interface ItemStoreSpec<T> {
  /** key 前綴。用 function 的話每次讀寫前重新解析，換掉就代表整個命名空間換代了 */
  prefix: string | (() => Promise<string>)
  /** 舊版整份表的 key */
  legacyKey: string
  /** 舊版整份表裡裝資料的欄位名 */
  legacyField: string
  legacyPrefix?: string
  legacySchema: number
  /** 驗證單筆；不合格的回 null，該筆被丟掉但不影響其他筆 */
  parse: (value: unknown) => T | null
}

/** 存檔來源的 key 可能是 number（tagid）或 string（gid） */
export type ItemMap<T> = Record<string, T> | Record<number, T>

export interface ItemStore<T> {
  load: () => Promise<Record<string, T>>
  /** 只寫這個 instance 上次成功存檔之後改動的那幾筆 */
  save: (next: ItemMap<T>) => Promise<void>
}

interface ItemRecord {
  schema?: number
  value?: unknown
  deleted?: boolean
}

export function createItemStore<T>(spec: ItemStoreSpec<T>): ItemStore<T> {
  const tombstone = JSON.stringify({ schema: ITEM_SCHEMA, deleted: true })
  let tail: Promise<unknown> = Promise.resolve()
  let bound = ''
  /** 上次確定寫進 storage 的內容。寫失敗就不更新，下次存檔自然會再送一次 */
  let saved = new Map<string, string>()
  /** 有 `_base:` 影子、刪除時得寫墓碑的 id */
  let shadowed = new Set<string>()

  function record(value: T): string {
    return JSON.stringify({ schema: ITEM_SCHEMA, value })
  }

  function readValue(raw: string | null): T | null {
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as ItemRecord
      if (parsed.schema !== ITEM_SCHEMA || parsed.deleted === true) return null
      return spec.parse(parsed.value)
    } catch {
      return null
    }
  }

  function parseLegacy(raw: string): [string, T][] | null {
    let parsed: { schema?: number } & Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as { schema?: number } & Record<string, unknown>
    } catch {
      return null
    }
    // schema 對不上的不一定是垃圾，也可能是更新版寫的。看不懂就別動它
    if (parsed?.schema !== spec.legacySchema) return null
    const table = parsed[spec.legacyField]
    if (!table || typeof table !== 'object' || Array.isArray(table)) return []
    const out: [string, T][] = []
    for (const [id, value] of Object.entries(table as Record<string, unknown>)) {
      const item = spec.parse(value)
      if (item !== null) out.push([id, item])
    }
    return out
  }

  function bind(prefix: string): { live: string; base: string } {
    // 換代表示舊命名空間已經作廢：基準值留著，改過的才會寫進新命名空間，沒改的
    // 不會被重貼回來；墓碑屬於舊命名空間，跟著作廢
    if (prefix !== bound) {
      bound = prefix
      shadowed = new Set()
    }
    return itemNamespace(prefix)
  }

  async function migrate(base: string): Promise<void> {
    const raw = await cacheGet(spec.legacyKey)
    if (!raw) return
    const entries = parseLegacy(raw)
    if (entries === null) return
    await Promise.all(entries.map(([id, value]) => cacheSet(`${base}${id}`, record(value))))
    await cacheDelete(spec.legacyKey)
  }

  async function read(live: string, base: string): Promise<Record<string, T>> {
    const [baseKeys, liveKeys] = await Promise.all([cacheKeys(base), cacheKeys(live)])
    const out: Record<string, T> = {}
    shadowed = new Set(baseKeys.map((key) => key.slice(base.length)))

    const migrated = await Promise.all(baseKeys.map(async (key) => [
      key.slice(base.length),
      readValue(await cacheGet(key)),
    ] as const))
    for (const [id, value] of migrated) if (value !== null) out[id] = value

    const current = await Promise.all(liveKeys.map(async (key) => [
      key.slice(live.length),
      readValue(await cacheGet(key)),
    ] as const))
    // live 讀不出來就當這筆沒了，不退回 `_base:` 的舊值：刪掉的東西不該復活
    for (const [id, value] of current) {
      if (value === null) delete out[id]
      else out[id] = value
    }

    saved = new Map(Object.entries(out).map(([id, value]) => [id, record(value)]))
    return out
  }

  async function write(wanted: Map<string, string>, prefix: string): Promise<void> {
    const { live } = bind(prefix)
    const tasks: (() => Promise<void>)[] = []
    for (const [id, next] of wanted) {
      if (saved.get(id) === next) continue
      tasks.push(async () => {
        await cacheSet(`${live}${id}`, next)
        saved.set(id, next)
      })
    }
    for (const id of saved.keys()) {
      if (wanted.has(id)) continue
      tasks.push(async () => {
        if (shadowed.has(id)) await cacheSet(`${live}${id}`, tombstone)
        else await cacheDelete(`${live}${id}`)
        saved.delete(id)
      })
    }
    const results = await Promise.allSettled(tasks.map((task) => task()))
    const failed = results.filter((result) => result.status === 'rejected')
    if (failed.length) {
      throw new AggregateError(
        failed.map((result) => result.reason),
        `${bound}: ${failed.length} item(s) failed to save`,
      )
    }
  }

  function queue<R>(task: () => Promise<R>): Promise<R> {
    const next = tail.then(task, task)
    tail = next.catch(() => {})
    return next
  }

  return {
    load: () => queue(async () => {
      const prefix = typeof spec.prefix === 'function' ? await spec.prefix() : spec.prefix
      const { live, base } = bind(prefix)
      await migrate(spec.legacyPrefix ? itemNamespace(spec.legacyPrefix).base : base)
      return read(live, base)
    }),
    save(next: ItemMap<T>): Promise<void> {
      // 呼叫端手上那份還會繼續被改，排隊前先定格
      const entries = Object.entries(next as Record<string, T>)
      const wanted = new Map(entries.map(([id, value]) => [id, record(value)]))
      const prefix = typeof spec.prefix === 'function' ? spec.prefix() : spec.prefix
      if (typeof prefix !== 'string') void prefix.catch(() => {})
      return queue(async () => write(wanted, await prefix))
    },
  }
}
