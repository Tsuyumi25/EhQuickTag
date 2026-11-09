<script setup lang="ts">
import { Brush, Mouse } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import { dragTrailEnabled, mouseRoles } from '@/services/store'
import { MOUSE_BUTTONS, assignRole, type MouseButtonName } from '@/services/mouseRoles'
import type { Selection } from '@/services/tagPick'

const BUTTON_LABEL_KEYS: Record<MouseButtonName, string> = {
  left: 'settings.mouseLeft',
  middle: 'settings.mouseMiddle',
  right: 'settings.mouseRight',
}
const ROLES: { id: Selection; labelKey: string }[] = [
  { id: 'positive', labelKey: 'settings.rolePositive' },
  { id: 'negative', labelKey: 'settings.roleNegative' },
  { id: 'or', labelKey: 'settings.roleOr' },
]
</script>

<template>
  <div class="eqt-settings__tab-content">
    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Mouse :size="14" /> {{ t('settings.sectionMouseButtons') }}</h4>
      <div class="eqt-settings__field-grid">
        <template v-for="button in MOUSE_BUTTONS" :key="button">
          <label class="eqt-settings__field-label">{{ t(BUTTON_LABEL_KEYS[button]) }}</label>
          <select
            class="eqt-settings__select"
            :value="mouseRoles[button]"
            @change="mouseRoles = assignRole(mouseRoles, button, ($event.target as HTMLSelectElement).value as Selection)"
          >
            <option v-for="role in ROLES" :key="role.id" :value="role.id">{{ t(role.labelKey) }}</option>
          </select>
        </template>
      </div>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Brush :size="14" /> {{ t('settings.sectionDragSelect') }}</h4>
      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="dragTrailEnabled"
          @change="dragTrailEnabled = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.dragTrail') }}</span>
      </label>
    </section>
  </div>
</template>
