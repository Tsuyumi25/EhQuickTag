import { GM } from '$'
import { hasGMXHR } from '@/services/gmStorage'

// 用 DecompressionStream 解 gzip——現代瀏覽器原生支援，不引第三方 lib
export async function fetchGzText(url: string): Promise<string> {
  const gz = await fetchArrayBuffer(url)
  const stream = new Response(gz).body!.pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  if (hasGMXHR) {
    const { promise, resolve, reject } = Promise.withResolvers<ArrayBuffer>()
    GM.xmlHttpRequest({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      onload: (res) => {
        if (res.status === 200) resolve(res.response as ArrayBuffer)
        else reject(new Error(`HTTP ${res.status}`))
      },
      onerror: (err) => reject(new Error(`Network error: ${JSON.stringify(err)}`)),
    })
    return promise
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.arrayBuffer()
}
