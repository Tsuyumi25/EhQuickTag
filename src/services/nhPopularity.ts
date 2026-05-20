import bundledData from '@/data/nh-popularity.json'

function normalize(name: string): string {
  return name.toLowerCase().replace(/[-_ ]/g, '')
}

const popularityMap = new Map(Object.entries(bundledData as Record<string, number>))

export function getNhCount(tagRaw: string): number | undefined {
  return popularityMap.get(normalize(tagRaw))
}
