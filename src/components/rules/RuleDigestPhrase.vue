<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/composables/useI18n'

const props = defineProps<{ textKey?: string; params?: Record<string, string | number> }>()
// 各語言的語序不同，chip 要插在譯文裡 {items} 的位置；t() 會把沒給值的佔位符換成空字串，
// 所以把 {items} 原樣塞回去再切開
const parts = computed(() => (props.textKey ? t(props.textKey, { ...props.params, items: '{items}' }).split('{items}') : []))
</script>

<template>{{ parts[0] }}<slot />{{ parts[1] }}</template>
