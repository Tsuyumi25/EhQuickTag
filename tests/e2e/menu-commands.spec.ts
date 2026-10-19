import { test, expect, type Page } from '@playwright/test'
import { injectUserscript } from './helpers'

type MenuWindow = Window & { __eqtMenuCommands: Map<number, { name: string, onClick: () => void }> }

const menuNames = (page: Page) => page.evaluate(() => [...(window as unknown as MenuWindow).__eqtMenuCommands.values()].map(command => command.name))
const runMenu = (page: Page, name: string) => page.evaluate((target) => {
  for (const command of (window as unknown as MenuWindow).__eqtMenuCommands.values()) {
    if (command.name === target) command.onClick()
  }
}, name)

test('沒有 EVR 時選單只有設定，按下去打開設定頁', async ({ page }) => {
  await injectUserscript(page)
  await expect.poll(() => menuNames(page)).toEqual(['設定'])
  await runMenu(page, '設定')
  await expect(page.locator('.eqt-settings__tab--active')).toBeVisible()
})

test('裝了 EVR 時選單多一項，按下去先收起設定頁再發出 evr:open-settings', async ({ page }) => {
  await page.addInitScript(() => {
    // init script 跑的時候 <html> 還沒被 parser 建出來；EQT 在頁面載完後才注入，DOMContentLoaded 時補上就趕得上
    document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-evr-version', '0.0.0'))
    document.addEventListener('evr:open-settings', () => {
      document.documentElement.dataset.evrOpenedWithEqtSettings = String(!!document.querySelector('.eqt-settings__tab'))
    })
  })
  await injectUserscript(page)
  await expect.poll(() => menuNames(page)).toEqual(['設定', 'Eh View Refined 設定'])
  await runMenu(page, '設定')
  await expect(page.locator('.eqt-settings__tab--active')).toBeVisible()
  await runMenu(page, 'Eh View Refined 設定')
  await expect(page.locator('html')).toHaveAttribute('data-evr-opened-with-eqt-settings', 'false')
  await expect(page.locator('.eqt-settings__tab')).toHaveCount(0)
})
