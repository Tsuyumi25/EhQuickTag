import type { Selection } from '@/services/tagPick'

export const MOUSE_BUTTONS = ['left', 'middle', 'right'] as const
export type MouseButtonName = typeof MOUSE_BUTTONS[number]
export type MouseRoles = Record<MouseButtonName, Selection>

/** 三顆鍵各佔一個動作：把 role 交給 button，原本拿著 role 的那顆接手 button 的舊動作 */
export function assignRole(roles: MouseRoles, button: MouseButtonName, role: Selection): MouseRoles {
  const holder = MOUSE_BUTTONS.find(other => roles[other] === role)
  return holder ? { ...roles, [holder]: roles[button], [button]: role } : { ...roles, [button]: role }
}
