import { describe, expect, it, vi } from 'vitest'

// pageWindow 走 vite-plugin-monkey 的 unsafeWindow，node 底下一 import 就炸；這裡用不到它
vi.mock('@/utils/pageWindow', () => ({ pageWindow: () => ({}) }))

import { parseCredentials } from '@/services/mytags/mytagsApi'

describe('parseCredentials', () => {
  // EH 頁面 inline script 的寫法：各一行 var，夾在其他全域變數中間
  const script = [
    'var base_url = "https://e-hentai.org/";',
    'var apiuid = 123456;',
    'var apikey = "0a1b2c3d4e5f6789";',
    'var api_url = "https://api.e-hentai.org/api.php";',
  ].join('\n')

  it('讀出寫回要的 apiuid、apikey 與 api_url', () => {
    expect(parseCredentials(script)).toEqual({
      apiuid: 123456, apikey: '0a1b2c3d4e5f6789', apiUrl: 'https://api.e-hentai.org/api.php',
    })
  })

  it('沒給 api_url 就留空，交給站別預設', () => {
    expect(parseCredentials(script.replace(/var api_url.*/, ''))).toEqual({ apiuid: 123456, apikey: '0a1b2c3d4e5f6789', apiUrl: undefined })
  })

  it('少了 apikey，或 apiuid 是未登入的 -1，都等於沒有憑證', () => {
    expect(parseCredentials(script.replace(/var apikey.*/, ''))).toBeNull()
    expect(parseCredentials(script.replace('123456', '-1'))).toBeNull()
  })
})
