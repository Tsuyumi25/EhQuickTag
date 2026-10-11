import type { Component } from 'vue'
import { Files, Star } from '@lucide/vue'
import type { RangeField } from '@/services/listing/fixedRulePrototype'

export const RANGE_FIELD_ICONS: Record<RangeField, Component> = { rating: Star, pages: Files }
