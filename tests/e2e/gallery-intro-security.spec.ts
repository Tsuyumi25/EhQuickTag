import { test, expect, type Page } from '@playwright/test'
import { injectGalleryUserscript } from './helpers'


const TAG_NS_RAW = 'female:sample tag'
const WIKI_KEY = 'tag/sample_tag'
const CLOBBER_ID = 'body'
const STYLE_LEAK_PROP = '--eqt-xss-style'

const SAFE_LINK = 'https://example.org/wiki/safe'
const SAFE_IMG = 'https://example.org/img/safe.png'
const SAFE_EXTRA_IMG = 'https://example.org/img/extra.png'
const TRACKER_IMG = 'https://tracker.invalid/pixel.png'

function mark(label: string): string {
  return `(window.__eqtXss=window.__eqtXss||[]).push('${label}')`
}

const WIKI_PRELUDE = [
  '<p>prelude-text-probe</p>',
  `<img src="/prelude-probe.png" onerror="${mark('prelude-img')}">`,
  `<a href="javascript:${mark('prelude-link')}">prelude-link-probe</a>`,
  `<span onmouseover="${mark('prelude-span')}">prelude-span-probe</span>`,
  '<iframe src="/prelude-frame.html"></iframe>',
].join('')

const WIKI_BLOCK_HOSTILE = [
  `<ul><li><img src="/block-probe.png" onerror="${mark('block-img')}"> block-item-probe</li></ul>`,
  `<div onclick="${mark('block-click')}">block-click-probe</div>`,
  `<details open ontoggle="${mark('block-toggle')}"><summary>block-toggle-probe</summary>detail</details>`,
  `<a id="${CLOBBER_ID}" href="javascript:${mark('block-link')}">block-link-probe</a>`,
  '<iframe src="/block-frame.html"></iframe><object data="/block-object"></object><embed src="/block-embed">',
  `<script>${mark('block-script')}</script>`,
  `<style>body{${STYLE_LEAK_PROP}:1}</style>`,
  '<div style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999">overlay-probe</div>',
  `<div style="background-image:url(${TRACKER_IMG})">background-probe</div>`,
].join('')

const WIKI_BLOCK_SAFE = [
  '<p>plain-text-probe</p>',
  '<table><tbody><tr><td>table-cell-probe</td></tr></tbody></table>',
  '<dl><dt>term-probe</dt><dd>definition-probe</dd></dl>',
  `<a href="${SAFE_LINK}">safe-link-probe</a>`,
  `<img src="${SAFE_IMG}" alt="safe-image-probe">`,
  '<span style="color:#ff0000;border:1px solid #00ff00">style-probe</span>',
].join('')

const INTRO_HTML = [
  '<p>intro-text-probe</p>',
  '<table><tbody><tr><td>intro-cell-probe</td></tr></tbody></table>',
  '<dl><dt>intro-term-probe</dt><dd>intro-definition-probe</dd></dl>',
  `<span onmouseover="${mark('intro-span')}">intro-span-probe</span>`,
  `<img src="${SAFE_EXTRA_IMG}" alt="intro-image-probe">`,
  `<img src="javascript:${mark('intro-img-src')}" alt="intro-bad-image-probe">`,
  '<iframe src="/intro-frame.html"></iframe>',
].join('')

const LINKS_HTML = [
  `<a href="${SAFE_LINK}">links-safe-probe</a>`,
  `<a href="javascript:${mark('links-link')}">links-bad-probe</a>`,
  `<img src="/links-probe.png" onerror="${mark('links-img')}">`,
].join('')

const WIKI_PAYLOAD = JSON.stringify({
  version: 3,
  entries: { [WIKI_KEY]: [{ prelude: WIKI_PRELUDE, blocks: [WIKI_BLOCK_HOSTILE, WIKI_BLOCK_SAFE] }] },
})

const TAG_DB_PAYLOAD = JSON.stringify([{
  fullTag: TAG_NS_RAW,
  ns: 'female',
  raw: 'sample tag',
  name: 'sample tag',
  iconUrl: `javascript:${mark('icon-url')}`,
  introHtml: INTRO_HTML,
  linksHtml: LINKS_HTML,
  introSearch: '',
}])

// 直接種入有效快取，讓舊資料也必須經過顯示前防護。
async function openIntroPanel(page: Page, primaryLang: 'en' | 'zh'): Promise<void> {
  await page.addInitScript(([wiki, db, settings, tagRaw]) => {
    const put = (key: string, value: string): void => {
      localStorage.setItem(`eqt-test:${key}`, JSON.stringify(value))
    }
    const now = String(Date.now())
    put('eqt_tag_wiki_v3', wiki)
    put('eqt_tag_wiki_v3_ts', now)
    put('eqt_tag_db_v3', db)
    put('eqt_tag_db_v3_ts', now)
    put('eqt_settings', settings)
    document.addEventListener('DOMContentLoaded', () => {
      const tag = document.querySelector('#taglist a[onclick^="return toggle_tagmenu"]')
      if (!tag) throw new Error('gallery fixture tag missing')
      tag.setAttribute('onclick', `return toggle_tagmenu(1,'${tagRaw}',this)`)
    }, { once: true })
  }, [WIKI_PAYLOAD, TAG_DB_PAYLOAD, JSON.stringify({ introPanelPrimaryLang: primaryLang }), TAG_NS_RAW])

  await injectGalleryUserscript(page)

  const chip = page.locator(`.eqt-gallery-chip[data-ns-raw="${TAG_NS_RAW}"] .eqt-gallery-chip__body`)
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(page.locator('.eqt-intro-panel')).toBeVisible()
}

interface PanelAudit {
  eventAttrs: string[]
  unsafeUrls: string[]
  dangerousTags: string[]
  markers: string[]
  clobberedId: boolean
  styleLeak: string
}

const DISPATCHED_EVENTS = ['error', 'load', 'click', 'mouseover', 'mouseenter', 'focus', 'toggle', 'animationstart']

async function auditPanel(page: Page, dispatchScopes: string[]): Promise<PanelAudit> {
  return page.evaluate(({ scopes, clobberId, styleProp, events }) => {
    const panel = document.querySelector('.eqt-intro-panel')
    if (!panel) throw new Error('intro panel missing')

    const prevent = (e: Event): void => e.preventDefault()
    document.addEventListener('click', prevent, true)
    try {
      for (const scope of scopes) {
        for (const host of Array.from(document.querySelectorAll(scope))) {
          for (const el of [host, ...Array.from(host.querySelectorAll('*'))]) {
            for (const type of events) {
              el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))
            }
          }
        }
      }
    } finally {
      document.removeEventListener('click', prevent, true)
    }

    const DANGEROUS_TAGS: Record<string, true> = {
      IFRAME: true, SCRIPT: true, OBJECT: true, EMBED: true, STYLE: true,
      BASE: true, META: true, LINK: true, FRAME: true,
    }
    const eventAttrs: string[] = []
    const unsafeUrls: string[] = []
    const dangerousTags: string[] = []
    for (const el of [panel, ...Array.from(panel.querySelectorAll('*'))]) {
      if (DANGEROUS_TAGS[el.tagName]) dangerousTags.push(el.tagName)
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase()
        if (name.startsWith('on')) eventAttrs.push(`${el.tagName}[${name}]`)
        if (attr.value.replace(/\s/g, '').toLowerCase().includes('javascript:')) {
          unsafeUrls.push(`${el.tagName}[${name}]=${attr.value}`)
        }
      }
    }

    return {
      eventAttrs,
      unsafeUrls,
      dangerousTags,
      markers: (window as typeof window & { __eqtXss?: string[] }).__eqtXss ?? [],
      clobberedId: document.getElementById(clobberId) !== null,
      styleLeak: getComputedStyle(document.body).getPropertyValue(styleProp).trim(),
    }
  }, { scopes: dispatchScopes, clobberId: CLOBBER_ID, styleProp: STYLE_LEAK_PROP, events: DISPATCHED_EVENTS })
}

test('cached wiki 內容的 handler、JS 連結與注入節點都進不了 panel', async ({ page }) => {
  await openIntroPanel(page, 'en')
  await expect(page.locator('.eqt-intro-panel__wiki-block').first()).toBeVisible()
  const prelude = page.locator('.eqt-intro-panel__wiki-prelude')
  await expect(prelude).toHaveCount(1)
  await expect(prelude).toBeHidden()
  await expect(prelude).toContainText('prelude-text-probe')

  const audit = await auditPanel(page, ['.eqt-intro-panel__content'])
  expect(audit.eventAttrs).toEqual([])
  expect(audit.unsafeUrls).toEqual([])
  expect(audit.dangerousTags).toEqual([])
  expect(audit.markers).toEqual([])
  expect(audit.clobberedId).toBe(false)
  expect(audit.styleLeak).toBe('')
})

test('wiki 內容的危險 CSS 被中和，顏色與邊框保留', async ({ page }) => {
  await openIntroPanel(page, 'en')
  const content = page.locator('.eqt-intro-panel__content')

  const overlay = content.getByText('overlay-probe')
  await expect(overlay).toHaveCSS('position', 'static')

  const background = content.getByText('background-probe')
  await expect(background).toHaveCSS('background-image', 'none')

  const styled = content.getByText('style-probe')
  await expect(styled).toHaveCSS('color', 'rgb(255, 0, 0)')
  await expect(styled).toHaveCSS('border-top-style', 'solid')
  await expect(styled).toHaveCSS('border-top-width', '1px')
  await expect(styled).toHaveCSS('border-top-color', 'rgb(0, 255, 0)')
})

test('wiki 安全結構保留，javascript: 圖片 URL 被濾掉', async ({ page }) => {
  await openIntroPanel(page, 'en')
  const content = page.locator('.eqt-intro-panel__content')

  await expect(content).toContainText('plain-text-probe')
  await expect(content.locator('table td')).toHaveText('table-cell-probe')
  await expect(content.locator('dl dt')).toHaveText('term-probe')
  await expect(content.locator('dl dd')).toHaveText('definition-probe')
  await expect(content.locator(`a[href="${SAFE_LINK}"]`)).toHaveText('safe-link-probe')
  await expect(content.locator(`.eqt-intro-panel__wiki-block img[src="${SAFE_IMG}"]`)).toHaveCount(1)

  const extras = page.locator('.eqt-intro-panel__wiki-images img')
  await expect(extras).toHaveCount(1)
  await expect(extras).toHaveAttribute('src', SAFE_EXTRA_IMG)

  await expect(page.locator('.eqt-intro-panel__name-icon')).toHaveCount(0)
})

test('中文 intro 與 links 預覽同樣清洗，安全結構保留', async ({ page }) => {
  await openIntroPanel(page, 'zh')
  const content = page.locator('.eqt-intro-panel__content')
  const links = page.locator('.eqt-intro-panel__links')
  await expect(content).toContainText('intro-text-probe')
  await expect(links).toBeVisible()

  const audit = await auditPanel(page, ['.eqt-intro-panel__content', '.eqt-intro-panel__links'])
  expect(audit.eventAttrs).toEqual([])
  expect(audit.unsafeUrls).toEqual([])
  expect(audit.dangerousTags).toEqual([])
  expect(audit.markers).toEqual([])

  await expect(content.locator('table td')).toHaveText('intro-cell-probe')
  await expect(content.locator('dl dt')).toHaveText('intro-term-probe')
  await expect(content.locator('dl dd')).toHaveText('intro-definition-probe')
  await expect(content.locator(`img[src="${SAFE_EXTRA_IMG}"]`)).toHaveCount(1)
  await expect(links.locator(`a[href="${SAFE_LINK}"]`)).toHaveText('links-safe-probe')
})
