import { fc } from '@fast-check/vitest'
import {
  createActions, createCategoryCondition, createGroup, createRangeCondition, createRule, createTagCondition, createUploaderCondition,
  GROUP_MODES, RANGE_OPS,
  type RuleConditionItem, type GalleryRule, type GalleryProbe, type GroupMode, type RangeField, type RangeOp,
} from '@/services/listing/galleryRules'
import type { GalleryCategory } from '@/services/listing/galleryCategory'

// === 規則的 property test 共用 arbitraries ===
// 標籤只取四個，隨機規則與隨機圖庫才會常常碰在一起；評分取半星、頁數取 1–12，區間的邊界也常碰到

const TAGS = ['female:a', 'female:b', 'male:c', 'other:d']
// 分類也只取三種：同一條規則裡常會碰到兩種不同的分類，互斥的情況才測得到
const CATEGORIES: GalleryCategory[] = ['doujinshi', 'manga', 'misc']
// 上傳者兩個就夠碰出互斥；同一個人寫成不同大小寫，比對要當成同一個
const UPLOADERS = ['uploader a', 'Uploader A', 'uploader b']

export function rule(mode: GroupMode, conditions: RuleConditionItem[], negate = false): GalleryRule {
  return { ...createRule(1), root: createGroup(mode, conditions, negate), actions: createActions() }
}

const ratingArb = fc.integer({ min: 0, max: 10 }).map(n => n / 2)
const tagArb = fc.record({ tag: fc.constantFrom(...TAGS), exclude: fc.boolean() })
  .map(({ tag, exclude }) => createTagCondition(tag, exclude))
const pagesArb = fc.integer({ min: 1, max: 12 })
const categoryArb = fc.record({ category: fc.constantFrom(...CATEGORIES), exclude: fc.boolean() })
  .map(({ category, exclude }) => createCategoryCondition(category, exclude))
const uploaderArb = fc.record({ uploader: fc.constantFrom(...UPLOADERS), exclude: fc.boolean() })
  .map(({ uploader, exclude }) => createUploaderCondition(uploader, exclude))
const rangeConditionArb = (field: RangeField, valueArb: fc.Arbitrary<number>) =>
  fc.tuple(fc.constantFrom<RangeOp>(...RANGE_OPS), valueArb, valueArb, fc.boolean())
    .map(([op, a, b, open]) => ({
      ...createRangeCondition(field, op, Math.min(a, b)),
      // 頁數的介於可以不給上限
      ...(op === 'between' && !(field === 'pages' && open) ? { max: Math.max(a, b) } : {}),
    }))
const leafArb = fc.oneof(
  { weight: 4, arbitrary: tagArb },
  { weight: 2, arbitrary: categoryArb },
  { weight: 1, arbitrary: uploaderArb },
  { weight: 1, arbitrary: rangeConditionArb('rating', ratingArb) },
  { weight: 1, arbitrary: rangeConditionArb('pages', pagesArb) },
)
const modeArb = fc.constantFrom<GroupMode>(...GROUP_MODES)
const groupArb = (inner: fc.Arbitrary<RuleConditionItem>) =>
  fc.tuple(modeArb, fc.array(inner, { minLength: 1, maxLength: 3 }), fc.boolean())
    .map(([mode, conditions, negate]) => createGroup(mode, conditions, negate))
export const itemArb: fc.Arbitrary<RuleConditionItem> = fc.oneof(
  { weight: 3, arbitrary: leafArb },
  { weight: 1, arbitrary: groupArb(fc.oneof({ weight: 3, arbitrary: leafArb }, { weight: 1, arbitrary: groupArb(leafArb) })) },
)
export const ruleArb = fc.tuple(modeArb, fc.array(itemArb, { minLength: 1, maxLength: 4 }), fc.boolean())
  .map(([mode, conditions, negate]) => rule(mode, conditions, negate))
export const probeArb = fc.record({
  tags: fc.subarray(TAGS), rating: ratingArb, pages: pagesArb, category: fc.constantFrom(...CATEGORIES), uploader: fc.constantFrom(...UPLOADERS),
}).map(({ tags, ...rest }): GalleryProbe => ({ tags: new Set(tags), complete: true, ...rest }))
