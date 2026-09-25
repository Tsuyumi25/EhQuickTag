import { describe, expect, it, beforeEach, vi } from 'vitest'
import { reactive } from 'vue'

vi.mock('@/services/store', () => ({ lines: reactive([]) }))

import { lines } from '@/services/store'
import { useTagButtonEditor } from '@/composables/useTagButtonEditor'
import type { Line, TagButton, UrlButton } from '@/types'

function tag(label: string): TagButton {
  return { kind: 'tag', tags: [], label }
}

function setLines(...next: Line[]) {
  lines.splice(0, lines.length, ...next)
}

describe('useTagButtonEditor', () => {
  beforeEach(() => setLines())

  it('編輯既有 button 時 save 覆寫原位置', () => {
    const original = tag('before')
    setLines({ kind: 'buttons', buttons: [tag('other'), original] })
    const editor = useTagButtonEditor()

    editor.onConfigure(0, 1)
    expect(editor.pendingAdd.value).toBe(false)
    expect(editor.tagPopupValue.value).toEqual(original)

    editor.onSave(tag('after'))
    const line = lines[0] as Extract<Line, { kind: 'buttons' }>
    expect(line.buttons).toHaveLength(2)
    expect((line.buttons[1] as TagButton).label).toBe('after')
    expect(editor.tagPopupValue.value).toBeNull()
  })

  it('新增時給空 draft，save 追加到末行而不動既有 button', () => {
    setLines({ kind: 'buttons', buttons: [tag('kept')] })
    const editor = useTagButtonEditor()

    editor.onAdd()
    expect(editor.pendingAdd.value).toBe(true)
    expect(editor.tagPopupValue.value).toEqual({ kind: 'tag', tags: [], label: '' })

    editor.onSave(tag('added'))
    const line = lines[0] as Extract<Line, { kind: 'buttons' }>
    expect(line.buttons.map((b) => (b as TagButton).label)).toEqual(['kept', 'added'])
  })

  it('取消不寫入任何變更', () => {
    setLines({ kind: 'buttons', buttons: [tag('kept')] })
    const editor = useTagButtonEditor()

    editor.onAdd()
    editor.onClose()
    expect(editor.pendingAdd.value).toBe(false)
    expect(editor.tagPopupValue.value).toBeNull()
    const line = lines[0] as Extract<Line, { kind: 'buttons' }>
    expect(line.buttons.map((b) => (b as TagButton).label)).toEqual(['kept'])
  })

  it('末行是 separator 時新增先補一個 button 行', () => {
    setLines({ kind: 'buttons', buttons: [tag('kept')] }, { kind: 'separator' })
    const editor = useTagButtonEditor()

    editor.onAdd()
    editor.onSave(tag('added'))

    expect(lines).toHaveLength(3)
    expect(lines[1].kind).toBe('separator')
    const created = lines[2] as Extract<Line, { kind: 'buttons' }>
    expect(created.buttons.map((b) => (b as TagButton).label)).toEqual(['added'])
  })

  it('url button 走 url popup，tag popup 保持關閉', () => {
    const url: UrlButton = { kind: 'url', url: 'https://example.com' }
    setLines({ kind: 'buttons', buttons: [url] })
    const editor = useTagButtonEditor()

    editor.onConfigure(0, 0)
    expect(editor.urlPopupValue.value).toEqual(url)
    expect(editor.tagPopupValue.value).toBeNull()
  })

  it('兩個實例各自持有編輯狀態', () => {
    setLines({ kind: 'buttons', buttons: [tag('a'), tag('b')] })
    const first = useTagButtonEditor()
    const second = useTagButtonEditor()

    first.onConfigure(0, 0)
    expect(second.tagPopupValue.value).toBeNull()

    second.onAdd('url')
    expect(first.pendingAdd.value).toBe(false)
    expect(first.tagPopupValue.value).toEqual(tag('a'))
    expect(second.urlPopupValue.value).toEqual({ kind: 'url', url: '', label: '' })
  })
})
