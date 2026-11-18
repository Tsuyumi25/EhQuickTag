// 標籤區旁邊兩塊會浮出來的東西長在哪：新增標籤的 picker、tag 介紹面板。
// /g/ 上照原生版面找位置；閱讀器裡的圖庫面板沒有原生版面，由它自己提供
import { inject, type InjectionKey } from 'vue'

export interface PanelRect {
  left: number
  top: number
  width: number
  height: number
}

export interface GalleryLayout {
  /** picker teleport 進去、也當定位基準的元素 */
  addTarget: string
  /** picker 蓋住的範圍，座標相對 addTarget；量不到時是 null */
  addRect: () => PanelRect | null
  /** 介紹面板 teleport 進去的元素 */
  introTarget: string
}

export const GALLERY_LAYOUT: InjectionKey<GalleryLayout> = Symbol('galleryLayout')

// panel 對外圍 native 元素的 margin：左 / 上 / 下 各 6px，右側貼齊 #gd3.right
// 不留 margin（右側就是 #gd4 chips 區、視覺上不需要再隔開）
const PANEL_MARGIN = 6

// picker 蓋住 #gd1 下半（封面下半部）+ #gd3（meta 區），保留 #gd2 標題列。座標開啟時才量，
// 原生 responsive 改寬度也跟得上
function nativeAddRect(): PanelRect | null {
  const gd1 = document.getElementById('gd1')
  const gd3 = document.getElementById('gd3')
  const gm = document.querySelector('.gm')
  if (!gd1 || !gd3 || !gm) return null
  const r1 = gd1.getBoundingClientRect()
  const r3 = gd3.getBoundingClientRect()
  const rGm = gm.getBoundingClientRect()
  return {
    left: r1.left - rGm.left + PANEL_MARGIN,
    top: r3.top - rGm.top + PANEL_MARGIN,
    width: r3.right - r1.left - PANEL_MARGIN,
    height: r3.bottom - r3.top - 2 * PANEL_MARGIN,
  }
}

const NATIVE_LAYOUT: GalleryLayout = {
  addTarget: '.gm',
  addRect: nativeAddRect,
  introTarget: '#gd5',
}

export function useGalleryLayout(): GalleryLayout {
  return inject(GALLERY_LAYOUT, NATIVE_LAYOUT)
}
