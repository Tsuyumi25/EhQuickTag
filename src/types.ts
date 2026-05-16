export enum TagState {
  Off = 0,
  Include = 1,
  Or = 2,
  Exclude = 3,
}

export interface QuickTag {
  tag: string
  label?: string
}

export const NS_LABEL: Record<string, string> = {
  female: '女', male: '男', mixed: '混', other: '其他',
  location: '地點', language: '語言', parody: '原作',
  character: '角色', artist: '繪師', cosplayer: 'Coser',
  group: '團體', reclass: '分類', temp: '臨時',
}
