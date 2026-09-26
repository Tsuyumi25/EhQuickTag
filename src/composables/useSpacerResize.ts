import { ref } from 'vue'
import type { SpacerButton, LineTextAlign } from '@/types'
import { computeSpacerResize, edgeSensitivity, DEFAULT_SPACER_WIDTH } from '@/services/tagbar/spacerResize'

// 數學核心（閉環實測 + gap 恆等式吸附）住在 services/tagbar/spacerResize.ts 的
// 純函式裡,這邊只當薄 DOM adapter：pointerdown 收集吸附目標、pointermove
// 量 rect 餵給 computeSpacerResize、把結果套回資料與 guide 線。
// 目標集合在 pointerdown 收集一次即可：拖曳只影響自己這一行,其他行的
// x 座標不動（自己行折行數變化只造成下方行的垂直位移,目標只存 x）。
export function useSpacerResize(getRows: () => HTMLElement | null) {
  // 吸附輔助線。x 是對齊軸,top / height 讓線只涵蓋「目標行 ↔ spacer 行」這一段
  // 而不是縱貫整個 TagBar——線穿過每一行的話,看的人不知道自己對齊到誰。
  // 座標都已換算到 __line-rows 座標系
  const spacerGuide = ref<{ x: number; top: number; height: number } | null>(null)
  const resizingSpacer = ref<SpacerButton | null>(null)
  // 拖曳中的顯示寬——故意不寫進 lines 樹:store 的自動存檔 watcher 沒有
  // debounce,每次 pointermove 寫 btn.width 會觸發「全 profile 深拷貝 +
  // JSON 序列化 + GM 寫入」的風暴。拖曳期間只更新這個 ref,pointerup 才
  // commit 進 btn.width——整場拖曳只存檔一次
  const resizingWidth = ref<number | null>(null)

  // 拖曳中以 resizingWidth 為準,其餘時候讀資料值;fallback 同時涵蓋
  // 手編 JSON 沒帶 width 的資料(避免顯示 undefinedpx)
  function spacerRenderWidth(b: SpacerButton): number {
    if (resizingSpacer.value === b && resizingWidth.value !== null) return resizingWidth.value
    return b.width ?? DEFAULT_SPACER_WIDTH
  }

  // 這一緣拖得動嗎。規則的唯一來源是 spacerResize 的 edgeSensitivity——靈敏度 0
  // 表示那一緣被行釘死(left 行的左緣、right 行的右緣),拖再多都不動。把手的
  // v-if 與方括號的 class 共用這條判斷,兩者永遠指向同一緣
  function spacerHasGrip(b: SpacerButton, align: LineTextAlign, side: 'left' | 'right'): boolean {
    return b.mode === 'fixed' && edgeSensitivity(align, side) !== 0
  }

  let spacerResizeCtx: {
    btn: SpacerButton
    pointerId: number    // 一次只允許一場 resize:move / up 都驗 pointerId,
                         // 第二根手指按上別顆把手不會覆寫進行中的 session
    lastX: number        // 上一次 move 的 clientX——逐次增量的唯一狀態
    widthF: number       // 意圖寬度的浮點累積（避免逐次 round 漂移）
    align: LineTextAlign
    side: 'left' | 'right'   // 被拖的把手（center 行兩緣都有把手）
    spacerEl: HTMLElement
    rowsEl: Element
    targetsL: number[]   // 參照 item 左緣集合,viewport 絕對 x（供 spacer 左緣吸）
    targetsR: number[]   // 參照 item 右緣集合,viewport 絕對 x（供 spacer 右緣吸）
    targetEls: Element[] // 與上面兩個集合平行:命中時當場重量它的 y 範圍畫輔助線
  } | null = null

  function onSpacerGripDown(e: PointerEvent, li: number, b: SpacerButton, align: LineTextAlign, side: 'left' | 'right'): void {
    e.preventDefault()
    e.stopPropagation()   // 擋住 sortable 把 grip 拖曳當成排序拖曳
    // 已有進行中的 resize(多指):忽略後來者。但拖曳中那一行若被移除,grip 連同
    // 它身上的 pointerup / pointercancel 一起消失,ctx 會永遠留著、擋掉之後每一次
    // 調整。上一個 ctx 的元素已離開文件就代表它不可能再收到收尾事件,直接清掉
    if (spacerResizeCtx) {
      if (spacerResizeCtx.spacerEl.isConnected) return
      finishSpacerResize()
    }
    const grip = e.currentTarget as HTMLElement
    grip.setPointerCapture(e.pointerId)
    const rowsEl = getRows()
    const spacerEl = grip.parentElement
    if (!rowsEl || !spacerEl) return
    // 兩邊都收：left 行只用右緣集、right 行只用左緣集、center 行兩集都用。
    // 參照 item 含按鈕與兩種 spacer——spacer 也是幾何 item,邊緣同樣是有效參照。
    // 存 viewport 絕對座標:吸附判斷是「絕對對絕對」做差,天然就是相對量,
    // 只有畫 guide 線時才換算回 __line-rows 座標系
    const targetsL: number[] = []
    const targetsR: number[] = []
    const targetEls: Element[] = []
    rowsEl.querySelectorAll('.eqt-tag-bar__line-wrap').forEach((wrap, wi) => {
      if (wi === li) return
      wrap.querySelectorAll('.eqt-tag-bar__btn, .eqt-tag-bar__spacer').forEach((item) => {
        const r = item.getBoundingClientRect()
        targetsL.push(r.left)
        targetsR.push(r.right)
        targetEls.push(item)
      })
    })
    const startWidth = spacerEl.getBoundingClientRect().width
    spacerResizeCtx = {
      btn: b,
      pointerId: e.pointerId,
      lastX: e.clientX,
      widthF: startWidth,
      align,
      side,
      spacerEl,
      rowsEl,
      targetsL,
      targetsR,
      targetEls,
    }
    resizingSpacer.value = b
    resizingWidth.value = Math.round(startWidth)
  }

  // 輔助線的幾何:垂直範圍取「目標 item ∪ spacer」的聯集,線因此從目標那一行連到
  // 被拖的這一行。目標的 y 在此刻才量——pointerdown 的快照會被拖曳中的折行數變化
  // 作廢(自己這行少一折,下方所有行整批往上移),x 不受影響所以那個仍可快照
  function buildSpacerGuide(
    ctx: NonNullable<typeof spacerResizeCtx>,
    guideX: number,
    guideIndex: number,
    spacerRect: DOMRect,
  ): { x: number; top: number; height: number } | null {
    const targetRect = ctx.targetEls[guideIndex]?.getBoundingClientRect()
    if (!targetRect) return null
    const rows = ctx.rowsEl.getBoundingClientRect()
    const top = Math.min(targetRect.top, spacerRect.top)
    const bottom = Math.max(targetRect.bottom, spacerRect.bottom)
    return { x: guideX - rows.left, top: top - rows.top, height: bottom - top }
  }

  function onSpacerGripMove(e: PointerEvent): void {
    const ctx = spacerResizeCtx
    if (!ctx || e.pointerId !== ctx.pointerId) return
    const rect = ctx.spacerEl.getBoundingClientRect()
    const result = computeSpacerResize({
      align: ctx.align,
      side: ctx.side,
      widthF: ctx.widthF,
      deltaX: e.clientX - ctx.lastX,
      rectLeft: rect.left,
      rectRight: rect.right,
      targetsL: ctx.targetsL,
      targetsR: ctx.targetsR,
      // 上限 = 行容器寬（實測）:間隔永遠不寬於它的行
      maxWidth: ctx.spacerEl.parentElement?.getBoundingClientRect().width ?? Infinity,
    })
    ctx.lastX = e.clientX
    ctx.widthF = result.widthF
    resizingWidth.value = result.width
    spacerGuide.value = result.guideX !== null && result.guideIndex !== null
      ? buildSpacerGuide(ctx, result.guideX, result.guideIndex, rect)
      : null
  }

  // commit + 清理。除了 pointerup / pointercancel,退出編輯模式也走這裡——
  // grip 是 v-if="editing" 的,拖曳中按「完成」會讓元素 unmount、pointerup
  // 永遠送不到,不清的話 resizing 視覺會殘留到下次進編輯
  function finishSpacerResize(): void {
    const ctx = spacerResizeCtx
    if (!ctx) return
    if (resizingWidth.value !== null) ctx.btn.width = resizingWidth.value
    spacerResizeCtx = null
    resizingSpacer.value = null
    resizingWidth.value = null
    spacerGuide.value = null
  }

  function onSpacerGripUp(e: PointerEvent): void {
    if (spacerResizeCtx && e.pointerId !== spacerResizeCtx.pointerId) return
    finishSpacerResize()
  }

  return {
    spacerGuide,
    resizingSpacer,
    spacerRenderWidth,
    spacerHasGrip,
    onSpacerGripDown,
    onSpacerGripMove,
    onSpacerGripUp,
    finishSpacerResize,
  }
}
