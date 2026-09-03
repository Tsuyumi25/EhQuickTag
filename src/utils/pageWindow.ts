import { unsafeWindow } from '$'

/**
 * 原生頁面的 window。EH 把 `apiuid` / `apikey` 這類東西掛在上面。
 *
 * ⚠️ `unsafeWindow` 不保證存在。打包後的 shim 是
 * `typeof unsafeWindow != "undefined" ? unsafeWindow : void 0`，而 `pnpm dev` 的模式
 * 會把 bundle 注入頁面環境執行——那裡沒有 GM API，於是這個 import 就是 undefined，
 * 呼叫端一存取屬性就炸。
 *
 * 沒有沙盒的時候 `window` 本身就是頁面的 window，拿得到同樣的東西，所以退回它。
 */
export function pageWindow<T>(): T {
  return ((unsafeWindow as unknown) ?? window) as T
}
