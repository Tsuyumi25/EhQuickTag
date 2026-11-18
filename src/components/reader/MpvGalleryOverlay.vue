<script setup lang="ts">
// Multi-Page Viewer 上浮出目前這本的 .gm：fetch /g/ HTML，把原生 .gm 塞進浮層，標籤區照 /g/ 的
// 方式接管。/s/ 不支援：它常被其他插件整頁接管，連 <head> 的樣式都會被清掉
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Tags } from '@lucide/vue'
import ReaderGalleryTakeover from './ReaderGalleryTakeover.vue'
import { fetchGallery, type FetchedGallery } from '@/services/reader/mpvGallery'
import { readerEnhancerEnabled, readerPanelOpacity, readerPanelPosition } from '@/services/store'
import { t } from '@/composables/useI18n'

const props = defineProps<{
  /** 這個 MPV 對應的 /g/ 網址 */
  galleryUrl: string
}>()

const open = ref(false)

// .gm 是原生 layout，放在 #eqt-app 外面，避開 box-sizing reset
const layer = document.createElement('div')
layer.id = 'eqt-mpv-reader-layer'
layer.setAttribute('translate', 'no')
document.body.append(layer)
watch(readerPanelPosition, (p) => { layer.dataset.position = p }, { immediate: true })
watch(readerPanelOpacity, (v) => { layer.style.setProperty('--eqt-mpv-reader-opacity', String(v / 100)) }, { immediate: true })
watch(readerEnhancerEnabled, (enabled) => { if (!enabled) open.value = false })

// 剛按下按鈕時游標還停在右上角，浮層一出來就因為沒被 hover 而透明，看起來像按了沒反應。
// 所以先一直顯示，等游標第一次移進來再移出去才開始照 hover 收放
layer.addEventListener('mouseleave', () => { layer.classList.remove('is-fresh') })

const TEXT_FIELD = 'input, textarea, [contenteditable]'

// MPV 的 document.onkeydown 看到 w / a / s / d / 空白就翻頁並 preventDefault，不檢查焦點
layer.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement
  if (e.key !== 'Escape' && target.closest(TEXT_FIELD)) e.stopPropagation()
})

// 正在浮層裡的輸入框打字時，滑鼠移開也不收。只看文字輸入框：點過 chip 留下的焦點不算，
// 否則點一下就再也收不起來
layer.addEventListener('focusin', (e) => {
  layer.classList.toggle('is-typing', !!(e.target as Element).closest(TEXT_FIELD))
})
layer.addEventListener('focusout', (e) => {
  const next = e.relatedTarget as Element | null
  layer.classList.toggle('is-typing', !!next?.closest?.(TEXT_FIELD))
})

const gallery = shallowRef<FetchedGallery | null>(null)
const galleryKey = ref(0)
let pending: Promise<FetchedGallery> | null = null
let generation = 0

function teardown(): void {
  gallery.value = null
  layer.replaceChildren()
  layer.classList.remove('has-panel', 'is-fresh', 'is-typing')
}

async function render(): Promise<void> {
  const gen = ++generation
  teardown()
  if (!open.value) return
  if (!pending) {
    pending = fetchGallery(props.galleryUrl)
    pending.catch(() => { pending = null })
  }
  try {
    const loaded = await pending
    if (gen !== generation) return
    // 每次打開都塞一份新的：上一份的 #gd4 已經被接管過、包過一層
    const gm = document.importNode(loaded.gm, true)
    layer.append(gm)
    layer.classList.add('has-panel', 'is-fresh')
    galleryKey.value++
    gallery.value = { ...loaded, gm }
    if (!loaded.vote || loaded.vote.apiuid < 0) {
      console.warn('[EhQuickTag] no usable apiuid/apikey on the gallery page; voting will fail', loaded.vote?.apiuid)
    }
  } catch (e) {
    console.warn('[EhQuickTag] failed to load gallery for the Multi-Page Viewer', props.galleryUrl, e)
  }
}

watch(open, () => { void render() })

// MPV 的按鈕放進右上角原生圖示欄 #bar3。Exhentai-Enhancer 會在自己 mount 時把 #bar3 的
// innerHTML 用 v-html 複製進 .original-functions 再把 #bar3 藏掉：複製過去的那顆沒有事件，
// v-html 再渲染一次也會把搬進去的這顆洗掉。所以它在場時搬到 .original-functions、清掉複製品，
// 被洗掉就換一個 key 重新長出來
const mpvButton = shallowRef<HTMLElement | null>(null)
const mpvButtonHost = shallowRef<HTMLElement | null>(null)
const mpvButtonKey = ref(0)
let mpvObserver: MutationObserver | null = null

function syncMpvButton(): void {
  const enhanced = document.querySelector<HTMLElement>('.original-functions')
  const host = enhanced ?? document.getElementById('bar3')
  if (mpvButtonHost.value !== host) mpvButtonHost.value = host
  if (enhanced) {
    for (const el of enhanced.querySelectorAll('.eqt-mpv-reader__btn')) {
      if (el !== mpvButton.value) el.remove()
    }
  }
  if (mpvButton.value && !mpvButton.value.isConnected) mpvButtonKey.value++
  if (enhancerSettled(enhanced)) {
    mpvObserver?.disconnect()
    mpvObserver = null
  }
}

// Enhancer 的 v-html 填進原生圖示、我們那顆也已經搬進去，之後就不會再被洗掉
function enhancerSettled(enhanced: HTMLElement | null): boolean {
  if (!enhanced?.querySelector('img')) return false
  return !!mpvButton.value && enhanced.contains(mpvButton.value)
}

// Enhancer 什麼時候 mount 不一定（它先讀完 GM storage 才掛），所以一直盯到它安頓好；
// 沒裝 Enhancer 就盯整頁的生命週期，每次變動只是一個 querySelector
mpvObserver = new MutationObserver(syncMpvButton)
mpvObserver.observe(document.body, { childList: true, subtree: true })
syncMpvButton()

// 打開期間按鈕要一直看得到。.original-functions 平時 opacity: 0、hover 才顯示，祖先的 opacity
// 子孫蓋不掉，所以打開時把按鈕搬到 body、fixed 在原本的位置（靠右對齊，視窗縮放也跟著走），
// 收起再搬回去。原生 #bar3 本來就一直顯示，留在原地即可
const mpvButtonPin = shallowRef<{ top: number, right: number } | null>(null)
const mpvButtonTarget = computed(() => (mpvButtonPin.value ? document.body : mpvButtonHost.value))

watch(open, (isOpen) => {
  if (!isOpen) {
    mpvButtonPin.value = null
    return
  }
  const el = mpvButton.value
  if (!el || !mpvButtonHost.value?.classList.contains('original-functions')) return
  const rect = el.getBoundingClientRect()
  mpvButtonPin.value = { top: rect.top, right: window.innerWidth - rect.right }
})

onBeforeUnmount(() => {
  mpvObserver?.disconnect()
  generation++
  teardown()
  layer.remove()
})
</script>

<template>
  <ReaderGalleryTakeover v-if="gallery" :key="galleryKey" :gallery="gallery" />
  <Teleport v-if="readerEnhancerEnabled && mpvButtonTarget" :to="mpvButtonTarget">
    <span
      :key="mpvButtonKey"
      ref="mpvButton"
      class="eqt-mpv-reader__btn"
      :class="{ 'eqt-mpv-reader__btn--open': open, 'eqt-mpv-reader__btn--pinned': mpvButtonPin }"
      :style="mpvButtonPin ? { top: `${mpvButtonPin.top}px`, right: `${mpvButtonPin.right}px` } : undefined"
      role="button"
      :title="t(open ? 'reader.hideGallery' : 'reader.showGallery')"
      @click="open = !open"
    ><Tags :size="22" /></span>
  </Teleport>
</template>

<style lang="scss">
// 照 #bar3 原生圖示的排法：24px 寬、靠右、margin 3px 5px 3px 3px，跟上一組隔 20px；
// 沒選中的原生選項是半透明，這裡收起時也照做
.eqt-mpv-reader__btn {
  display: inline-block;
  width: 24px;
  height: 24px;
  margin: 20px 5px 3px 3px;
  color: var(--eqt-text);
  opacity: 0.5;
  cursor: pointer;
  vertical-align: top;

  &--open {
    opacity: 1;
  }

  // top / right 由 script 量好寫在 inline style；量到的是不含 margin 的框，所以 margin 歸零。
  // 跟浮層同一層，靠 DOM 順序（打開時才搬進 body，排在浮層後面）壓在浮層上
  &--pinned {
    position: fixed;
    z-index: var(--eqt-z-panel);
    margin: 0;
  }

  svg {
    display: block;
    margin: 1px;
  }
}

// 打開之後平時完全透明，滑過原位才淡入；透明時仍佔著位置、照樣攔滑鼠。
// z-index 用 panel 那層（比彈窗的 overlay 低一階）：浮層裡的設定按鈕打開的設定彈窗、
// 從浮層 teleport 出去的 popover 才會蓋在浮層上面。MPV 自己最高只到 #bar3 的 z-index: 3
#eqt-mpv-reader-layer {
  position: fixed;
  left: 0;
  right: 0;
  z-index: var(--eqt-z-panel);
  margin: 0 auto;
  width: fit-content;
  max-width: 100vw;
  max-height: 85vh;
  overflow: auto;
  opacity: var(--eqt-mpv-reader-opacity, 0.85);
  transition: opacity 220ms ease-out;

  &[data-position="top"] {
    top: 0;
  }

  // fixed 元素上下都貼 0、高度 fit-content、margin auto，就會垂直置中；不用 transform，
  // 免得浮層變成裡面 fixed 元素的定位基準
  &[data-position="middle"] {
    top: 0;
    bottom: 0;
    height: fit-content;
    margin: auto;
  }

  &[data-position="bottom"] {
    bottom: 0;
  }

  &:not(.has-panel) {
    display: none;
  }

  // 焦點在浮層的輸入框裡、或剛打開還沒被游標碰過，就不收
  &:not(:hover):not(.is-typing):not(.is-fresh) {
    opacity: 0;
    transition: opacity 140ms ease-in;
  }
}
</style>
