import type { Component } from 'vue'
import { CheckCheck, Split } from '@lucide/vue'
import type { GroupMode } from '@/services/listing/fixedRulePrototype'

export const GROUP_MODE_ICONS: Record<GroupMode, Component> = { all: CheckCheck, any: Split }
