import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import TagChip from './TagChip.vue'

function render(props: Record<string, unknown>) {
  return renderToString(createSSRApp({
    render: () => h(TagChip, { full: 'parody:sample', display: 'sample', ...props }),
  }))
}

function text(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

describe('TagChip', () => {
  it('零權重仍顯示數字，未設定個人權重則不顯示', async () => {
    expect(text(await render({ weight: 0 }))).toMatch(/sample\s*0$/)
    expect(text(await render({}))).toBe('sample')
  })

  it('關注與隱藏標記共用開關，獨立於數字分數', async () => {
    const hidden = await render({ hidden: true, watch: true })
    expect(hidden).toContain('lucide-ban')
    expect(hidden).toContain('lucide-eye')

    const scoreOff = await render({ hidden: true, watch: true, showScore: false })
    expect(scoreOff).toContain('lucide-ban')
    expect(scoreOff).toContain('lucide-eye')

    const marksOff = await render({ weight: 7, watch: true, showMarks: false })
    expect(text(marksOff)).toMatch(/sample\s*\+7$/)
    expect(marksOff).not.toContain('lucide-eye')

    const hiddenMarksOff = await render({ weight: -7, hidden: true, watch: true, showMarks: false })
    expect(hiddenMarksOff).not.toContain('lucide-ban')
    expect(hiddenMarksOff).not.toContain('lucide-eye')
    expect(text(hiddenMarksOff)).toBe('sample')

    const visibleScoreOff = await render({ weight: 7, watch: true, showScore: false })
    expect(text(visibleScoreOff)).toBe('sample')
    expect(visibleScoreOff).toContain('lucide-eye')
  })
})
