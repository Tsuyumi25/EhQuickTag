import { watch } from 'vue'
import { GM_registerMenuCommand, GM_unregisterMenuCommand } from '$'
import { locale, t } from '@/composables/useI18n'
import { openEvrSettings, openSettings } from '@/services/appOverlays'
import { evrInstalled } from '@/utils/evr'

// 選單的文字在註冊當下就定了，換語言要整組撤掉重新註冊
export function registerMenuCommands(): void {
  let ids: ReturnType<typeof GM_registerMenuCommand>[] = []
  watch(locale, () => {
    for (const id of ids) GM_unregisterMenuCommand(id)
    ids = [GM_registerMenuCommand(t('settings.title'), () => openSettings())]
    if (evrInstalled) ids.push(GM_registerMenuCommand(t('menu.evrSettings'), () => void openEvrSettings()))
  }, { immediate: true })
}
