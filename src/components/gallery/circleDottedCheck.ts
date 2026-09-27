import { createLucideIcon } from '@lucide/vue'

// lucide 只有實線（circle-check）和虛線（circle-dashed-check）兩版。點線照虛線版的節奏：
// 虛線版是從正上方起每 45° 一段，這裡每 22.5° 一顆點，共 16 顆；點用 lucide 慣用的
// `h.01` 短線配圓頭線帽畫成
const DOTS = [
  [12, 2], [15.827, 2.761], [19.071, 4.929], [21.239, 8.173],
  [22, 12], [21.239, 15.827], [19.071, 19.071], [15.827, 21.239],
  [12, 22], [8.173, 21.239], [4.929, 19.071], [2.761, 15.827],
  [2, 12], [2.761, 8.173], [4.929, 4.929], [8.173, 2.761],
] as const

export const CircleDottedCheck = createLucideIcon('circle-dotted-check', [
  ...DOTS.map(([x, y]) => ['path', { d: `M${x} ${y}h.01` }] as ['path', { d: string }]),
  ['path', { d: 'm16 9-5.5 5.5L8 12' }],
])
