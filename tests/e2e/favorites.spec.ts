import { test, expect } from '@playwright/test'
import { injectFavoritesUserscript } from './helpers'

test('收藏頁的搜尋表單也掛上 TagBar，送出的搜尋留在收藏頁並帶著目前的收藏分類', async ({ page }) => {
  await injectFavoritesUserscript(page)
  await expect(page.locator('.eqt-tag-bar')).toBeVisible()

  const input = page.locator('.eqt-native-search-row > input[name="f_search"]')
  await expect(input).toBeVisible()
  await input.fill('language:chinese')
  await expect(page.locator('.eqt-search-panel__button').first()).toBeVisible()

  const href = new URL((await page.locator('[data-testid="search-submit"]').getAttribute('href'))!)
  expect(href.origin + href.pathname).toBe('https://e-hentai.org/favorites.php')
  expect(href.searchParams.get('favcat')).toBe('all')
  expect(href.searchParams.get('f_search')).toBe('language:chinese')
})
