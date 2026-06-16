import femaleData from '@/data/eh-popularity-female.json'
import maleData from '@/data/eh-popularity-male.json'
import mixedData from '@/data/eh-popularity-mixed.json'
import otherData from '@/data/eh-popularity-other.json'
import languageData from '@/data/eh-popularity-language.json'
import artistData from '@/data/nh-popularity-artist.json'
import characterData from '@/data/nh-popularity-character.json'
import parodyData from '@/data/nh-popularity-parody.json'
import groupData from '@/data/nh-popularity-group.json'
import { normalize } from './nhNormalize'

const POOLS: Record<string, Map<string, number>> = {
  female: new Map(Object.entries(femaleData as Record<string, number>)),
  male: new Map(Object.entries(maleData as Record<string, number>)),
  mixed: new Map(Object.entries(mixedData as Record<string, number>)),
  other: new Map(Object.entries(otherData as Record<string, number>)),
  artist: new Map(Object.entries(artistData as Record<string, number>)),
  character: new Map(Object.entries(characterData as Record<string, number>)),
  parody: new Map(Object.entries(parodyData as Record<string, number>)),
  group: new Map(Object.entries(groupData as Record<string, number>)),
  language: new Map(Object.entries(languageData as Record<string, number>)),
}

export function getNhWeight(ns: string, raw: string): number | undefined {
  return POOLS[ns]?.get(normalize(raw))
}
