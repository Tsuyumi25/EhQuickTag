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
