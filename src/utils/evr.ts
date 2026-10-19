// EhViewRefined 在 document-start 就把版本寫進 <html data-evr-version>；EQT 在 document-end 才跑，
// 讀的時候它一定已經寫好了，之後也不會再出現或消失
export const evrInstalled = document.documentElement.hasAttribute('data-evr-version')
