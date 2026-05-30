// ==UserScript==
// @name               EH Quick Tag
// @name:zh-TW         EH 快捷標籤
// @name:zh-CN         EH 快捷标签
// @namespace          https://github.com/Tsuyumi25/EhQuickTag
// @version            0.8.0
// @author             tsuyumi
// @description        Quick tag bar for E-Hentai / ExHentai search
// @description:zh-TW  E-Hentai / ExHentai 搜尋快捷標籤列
// @description:zh-CN  E-Hentai / ExHentai 搜索快捷标签栏
// @license            MIT
// @icon               https://e-hentai.org/favicon.ico
// @homepageURL        https://github.com/Tsuyumi25/EhQuickTag
// @supportURL         https://github.com/Tsuyumi25/EhQuickTag/issues
// @match              https://exhentai.org/*
// @match              https://e-hentai.org/*
// @connect            raw.githubusercontent.com
// @connect            cdn.jsdelivr.net
// @connect            fastly.jsdelivr.net
// @connect            gcore.jsdelivr.net
// @grant              GM.getValue
// @grant              GM.setValue
// @grant              GM_addStyle
// @grant              GM_openInTab
// @grant              GM_xmlhttpRequest
// @run-at             document-end
// ==/UserScript==

(function() {
  'use strict';
	var s = new Set();
	var _css = async (t) => {
		if (s.has(t)) return;
		s.add(t);
		((c) => {
			if (typeof GM_addStyle === "function") GM_addStyle(c);
			else (document.head || document.documentElement).appendChild(document.createElement("style")).append(c);
		})(t);
	};
	_css(" .eqt-color-picker{flex-direction:column;gap:6px;display:flex}.eqt-color-picker__picker{-webkit-user-select:none;user-select:none;width:180px;height:180px}.eqt-color-picker__input-row{gap:4px;display:flex}.eqt-color-picker__input{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-elevated);min-width:0;color:var(--eqt-text);box-sizing:border-box;border-radius:3px;flex:1;padding:4px 6px;font-family:monospace;font-size:12px}.eqt-color-picker__input:focus{border-color:var(--eqt-border-focus);outline:none}.eqt-color-picker__copy{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-btn);color:var(--eqt-text-secondary);cursor:pointer;border-radius:3px;flex-shrink:0;justify-content:center;align-items:center;padding:4px 6px;display:flex}.eqt-color-picker__copy:hover:not(:disabled){background:var(--eqt-bg-hover)}.eqt-color-picker__copy:disabled{opacity:.4;cursor:not-allowed}.eqt-line-color__trigger{height:var(--eqt-row-h);color:var(--eqt-text-hint);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:0 4px;display:flex}.eqt-line-color__trigger:hover{color:var(--eqt-text-secondary)}.eqt-line-color__popup{z-index:100000;background:var(--eqt-bg);border:var(--eqt-border-width) solid var(--eqt-border);border-radius:4px;flex-direction:column;gap:6px;padding:8px;display:flex;box-shadow:0 2px 8px #00000026}.eqt-line-color__clear{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-btn);color:var(--eqt-text-secondary);cursor:pointer;border-radius:3px;justify-content:center;align-items:center;gap:4px;padding:4px 8px;font-size:12px;display:inline-flex}.eqt-line-color__clear:hover{background:var(--eqt-bg-hover)}.eqt-line-sep__trigger{height:var(--eqt-row-h);color:var(--eqt-text-hint);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:0 4px;display:flex}.eqt-line-sep__trigger:hover{color:var(--eqt-text-secondary)}.eqt-line-sep__popup{z-index:100000;background:var(--eqt-bg);border:var(--eqt-border-width) solid var(--eqt-border);min-width:200px;color:var(--eqt-text);border-radius:4px;flex-direction:column;gap:8px;padding:8px;font-size:12px;display:flex;box-shadow:0 2px 8px #00000026}.eqt-line-sep__row{align-items:center;gap:6px;display:flex}.eqt-line-sep__row--col{flex-direction:column;align-items:stretch;gap:4px}.eqt-line-sep__styles{flex-wrap:wrap;gap:12px;display:flex}.eqt-line-sep__style-opt{cursor:pointer;align-items:center;gap:4px;display:inline-flex}.eqt-line-sep__slider-head{justify-content:space-between;align-items:center;display:flex}.eqt-line-sep__slider-value{color:var(--eqt-text-hint);font-variant-numeric:tabular-nums;font-size:11px}.eqt-tag-bar{padding:6px 0;position:relative}.eqt-tag-bar:before{content:\"\";background-color:var(--eqt-bg);background-image:linear-gradient(var(--eqt-bg-hover), var(--eqt-bg-hover));clip-path:circle(0 at 14px 14px);opacity:0;pointer-events:none;z-index:1;transition:clip-path .4s ease-out,opacity .4s ease-out;position:absolute;inset:0}.eqt-tag-bar:has(.eqt-tag-bar__info:hover):before{clip-path:circle(150% at 14px 14px);opacity:.9}.eqt-tag-bar__info{width:var(--eqt-row-h);height:var(--eqt-row-h);color:var(--eqt-text-secondary);-webkit-user-select:none;user-select:none;z-index:2;border-radius:3px;justify-content:center;align-items:center;gap:4px;padding:0;font-size:11px;display:inline-flex;position:absolute;top:0;right:100%}.eqt-tag-bar__info-text{background:var(--eqt-bg);border:var(--eqt-border-width) solid var(--eqt-border);color:var(--eqt-text-secondary);white-space:nowrap;pointer-events:none;z-index:1;border-radius:3px;margin-left:6px;padding:2px 8px;font-size:11px;display:none;position:absolute;top:0;left:100%}.eqt-tag-bar__info:hover .eqt-tag-bar__info-text{display:block}.eqt-tag-bar__lines{width:calc(100% - 2 * var(--eqt-controls-w,10%));flex-direction:column;gap:4px;margin:0 auto;display:flex}.eqt-tag-bar__line-rows{flex-direction:column;gap:4px;display:flex}.eqt-tag-bar__line-wrap{align-items:flex-start;gap:4px;display:flex;position:relative}.eqt-tag-bar__line-wrap--ghost{opacity:.4}.eqt-tag-bar__line-controls{height:var(--eqt-row-h);align-items:center;display:flex;position:absolute;top:0;right:100%}.eqt-tag-bar__handle{width:var(--eqt-row-h);height:var(--eqt-row-h);cursor:grab;color:var(--eqt-text-hint);-webkit-user-select:none;user-select:none;justify-content:center;align-items:center;padding:0;display:flex}.eqt-tag-bar__handle:hover{color:var(--eqt-text-secondary)}.eqt-tag-bar__handle:active{cursor:grabbing}.eqt-tag-bar__handle--hidden{visibility:hidden;pointer-events:none}.eqt-tag-bar__bottom-row{align-items:center;gap:4px;display:flex}.eqt-tag-bar__line-add{border:var(--eqt-border-width) solid var(--eqt-border);border-radius:3px;flex:1;display:flex;overflow:hidden}.eqt-tag-bar__line-add-btn{color:var(--eqt-text-hint);cursor:pointer;background:0 0;border:none;flex:1;justify-content:center;align-items:center;gap:4px;padding:2px 8px;font-size:12px;line-height:1.4;display:inline-flex}.eqt-tag-bar__line-add-btn:hover{background:var(--eqt-bg-hover);color:var(--eqt-text-secondary)}.eqt-tag-bar__line-add-btn+.eqt-tag-bar__line-add-btn{border-left:var(--eqt-border-width) solid var(--eqt-border)}.eqt-tag-bar__line-delete{height:var(--eqt-row-h);color:var(--eqt-text-hint);cursor:pointer;background:0 0;border:none;flex-shrink:0;justify-content:center;align-items:center;padding:0 4px;display:flex}.eqt-tag-bar__line-delete:hover{color:#8c3333}.eqt-tag-bar__line{min-height:var(--eqt-row-h);flex-wrap:wrap;flex:1;gap:4px;display:flex}.eqt-tag-bar__line--separator{min-height:var(--eqt-row-h);color:var(--line-color,var(--eqt-text-hint));--separator-line-length:100%;font-size:10px;line-height:1.4;position:relative}.eqt-tag-bar__line--separator:before,.eqt-tag-bar__line--separator:after{content:\"\";border-top:var(--separator-line-thickness,2px) solid var(--line-color,var(--eqt-divider))}.eqt-tag-bar__line--separator-pos-middle{flex-direction:row;align-items:center;display:flex}.eqt-tag-bar__line--separator-pos-middle:before,.eqt-tag-bar__line--separator-pos-middle:after{flex:1}.eqt-tag-bar__line--separator-pos-middle:not(:has(.eqt-tag-bar__separator-label)):after{display:none}.eqt-tag-bar__line--separator-pos-middle:not(:has(.eqt-tag-bar__separator-label)):before{max-width:var(--separator-line-length)}.eqt-tag-bar__line--separator-pos-middle:not(:has(.eqt-tag-bar__separator-label)).eqt-tag-bar__line--separator-align-left{justify-content:flex-start}.eqt-tag-bar__line--separator-pos-middle:not(:has(.eqt-tag-bar__separator-label)).eqt-tag-bar__line--separator-align-center{justify-content:center}.eqt-tag-bar__line--separator-pos-middle:not(:has(.eqt-tag-bar__separator-label)).eqt-tag-bar__line--separator-align-right{justify-content:flex-end}.eqt-tag-bar__line--separator-pos-middle:has(.eqt-tag-bar__separator-label){gap:8px}.eqt-tag-bar__line--separator-pos-middle:has(.eqt-tag-bar__separator-label):before{max-width:calc(var(--separator-line-length) / 2)}.eqt-tag-bar__line--separator-pos-middle:has(.eqt-tag-bar__separator-label):after{max-width:calc(var(--separator-line-length) / 2)}.eqt-tag-bar__line--separator-pos-middle:has(.eqt-tag-bar__separator-label).eqt-tag-bar__line--separator-align-left:before{border-top:0;flex:0}.eqt-tag-bar__line--separator-pos-middle:has(.eqt-tag-bar__separator-label).eqt-tag-bar__line--separator-align-left:after{max-width:var(--separator-line-length)}.eqt-tag-bar__line--separator-pos-middle:has(.eqt-tag-bar__separator-label).eqt-tag-bar__line--separator-align-right:after{border-top:0;flex:0}.eqt-tag-bar__line--separator-pos-middle:has(.eqt-tag-bar__separator-label).eqt-tag-bar__line--separator-align-right:before{max-width:var(--separator-line-length)}.eqt-tag-bar__line--separator-pos-top{padding-top:calc(var(--separator-line-thickness,2px) + 2px);justify-content:center;align-items:flex-start;display:flex}.eqt-tag-bar__line--separator-pos-top:before{top:0;left:calc((100% - var(--separator-line-length)) / 2);right:calc((100% - var(--separator-line-length)) / 2);position:absolute}.eqt-tag-bar__line--separator-pos-top:after{display:none}.eqt-tag-bar__line--separator-pos-top.eqt-tag-bar__line--separator-align-left{justify-content:flex-start}.eqt-tag-bar__line--separator-pos-top.eqt-tag-bar__line--separator-align-left:before{left:0;right:calc(100% - var(--separator-line-length))}.eqt-tag-bar__line--separator-pos-top.eqt-tag-bar__line--separator-align-right{justify-content:flex-end}.eqt-tag-bar__line--separator-pos-top.eqt-tag-bar__line--separator-align-right:before{left:calc(100% - var(--separator-line-length));right:0}.eqt-tag-bar__line--separator-pos-bottom{padding-bottom:calc(var(--separator-line-thickness,2px) + 2px);justify-content:center;align-items:flex-end;display:flex}.eqt-tag-bar__line--separator-pos-bottom:before{display:none}.eqt-tag-bar__line--separator-pos-bottom:after{bottom:0;left:calc((100% - var(--separator-line-length)) / 2);right:calc((100% - var(--separator-line-length)) / 2);position:absolute}.eqt-tag-bar__line--separator-pos-bottom.eqt-tag-bar__line--separator-align-left{justify-content:flex-start}.eqt-tag-bar__line--separator-pos-bottom.eqt-tag-bar__line--separator-align-left:after{left:0;right:calc(100% - var(--separator-line-length))}.eqt-tag-bar__line--separator-pos-bottom.eqt-tag-bar__line--separator-align-right{justify-content:flex-end}.eqt-tag-bar__line--separator-pos-bottom.eqt-tag-bar__line--separator-align-right:after{left:calc(100% - var(--separator-line-length));right:0}.eqt-tag-bar__line--separator-dashed:before,.eqt-tag-bar__line--separator-dashed:after{border-top-style:dashed}.eqt-tag-bar__line--separator-none:before,.eqt-tag-bar__line--separator-none:after{border-top:0}.eqt-tag-bar__separator-label{white-space:nowrap;flex-shrink:0}.eqt-tag-bar__separator-label--editing{cursor:text;outline:none}.eqt-tag-bar__separator-label--editing:empty:before{content:attr(data-placeholder);color:var(--eqt-text-hint);opacity:.5;pointer-events:none}.eqt-tag-bar__separator-label--editing:has(>br:only-child):before{content:attr(data-placeholder);color:var(--eqt-text-hint);opacity:.5;pointer-events:none}.eqt-tag-bar__controls{gap:4px;margin-left:auto;display:flex}.eqt-tag-bar__profile-row{align-items:stretch;gap:4px;display:flex;position:relative}.eqt-tag-bar__profile-nav{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-btn);color:var(--eqt-text-hint);cursor:pointer;text-overflow:ellipsis;white-space:nowrap;border-radius:3px;flex:2;justify-content:center;align-items:center;padding:0 6px;font-size:11px;line-height:1.4;display:flex;overflow:hidden}.eqt-tag-bar__profile-nav--prev,.eqt-tag-bar__profile-nav--next{text-align:center}.eqt-tag-bar__profile-nav:hover:not(:disabled){background:var(--eqt-bg-hover)}.eqt-tag-bar__profile-nav:disabled{opacity:.3;cursor:default}.eqt-tag-bar__profile-split{border:var(--eqt-border-width) solid var(--eqt-border);border-radius:3px;flex:5;min-width:0;position:relative}.eqt-tag-bar__profile-split-name{background:var(--eqt-bg-btn);width:100%;color:var(--eqt-text-secondary);cursor:pointer;text-align:center;text-overflow:ellipsis;white-space:nowrap;border:none;min-width:0;padding:0;font-size:13px;font-weight:700;line-height:1.4;display:block;overflow:hidden}.eqt-tag-bar__profile-split-name:hover{background:var(--eqt-bg-hover)}.eqt-tag-bar__profile-split-delete{border:none;border-left:var(--eqt-border-width) solid var(--eqt-border);color:var(--eqt-text-hint);cursor:pointer;background:0 0;border-radius:0 3px 3px 0;align-items:center;padding:0 8px;font-size:11px;line-height:1.4;display:flex;position:absolute;top:0;bottom:0;right:0}.eqt-tag-bar__profile-split-delete:hover:not(:disabled){color:#8c3333;background:#8c333326}.eqt-tag-bar__profile-split-delete:disabled{opacity:.3;cursor:default}.eqt-tag-bar__profile-split-delete--hidden{visibility:hidden;pointer-events:none}.eqt-tag-bar__profile-input{border:var(--eqt-border-width) solid var(--eqt-border-focus);background:var(--eqt-bg);color:var(--eqt-text-secondary);text-align:center;box-sizing:border-box;border-radius:3px;flex:5;padding:0;font-size:13px;font-weight:700;line-height:1.4}.eqt-tag-bar__profile-input:focus{outline:none}.eqt-tag-bar__btn{box-sizing:border-box;height:var(--eqt-row-h);border:var(--eqt-border-width) solid var(--line-color,var(--eqt-border));background:color-mix(in srgb, var(--line-color,var(--eqt-bg-btn)) 15%, var(--eqt-bg-btn));color:var(--eqt-text-secondary);cursor:pointer;border-radius:3px;align-items:center;gap:4px;padding:0 8px;font-size:12px;line-height:1.4;transition:background .15s,border-color .15s,color .15s;display:inline-flex}.eqt-tag-bar__btn:hover{background:var(--eqt-bg-hover)}.eqt-tag-bar__btn--url{text-decoration:none}.eqt-tag-bar__btn--editing{cursor:grab}.eqt-tag-bar__btn--editing:hover{background:var(--eqt-bg-hover)}.eqt-tag-bar__btn--ghost{opacity:.4}.eqt-tag-bar__btn--chosen{cursor:grabbing}.eqt-tag-bar__btn--drag{opacity:.8;box-shadow:0 2px 8px #0003}.eqt-tag-bar__ctrl{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-btn);color:var(--eqt-text-secondary);cursor:pointer;border-radius:3px;align-items:center;gap:4px;padding:2px 6px;font-size:12px;line-height:1.4;display:inline-flex}.eqt-tag-bar__ctrl:hover{background:var(--eqt-bg-hover)}.eqt-tag-bar__ctrl--toggle{align-items:center;display:inline-grid}.eqt-tag-bar__ctrl--toggle>*{grid-area:1/1;align-items:center;gap:4px;display:inline-flex}.eqt-tag-bar__ctrl-hidden{visibility:hidden}.eqt-popup__no-result{color:var(--eqt-text-hint);background:var(--eqt-bg-elevated);border:var(--eqt-border-width) solid var(--eqt-border);z-index:1;border-radius:3px;padding:6px 8px;font-size:12px;position:absolute;top:100%;left:0;right:0}.eqt-popup__suggestions{background:var(--eqt-bg-elevated);border:var(--eqt-border-width) solid var(--eqt-border);z-index:1;border-radius:3px;max-height:50vh;margin:2px 0 0;padding:0;position:absolute;top:100%;left:0;right:0;overflow-y:auto}.eqt-popup__suggestion{box-sizing:border-box;cursor:pointer;flex-wrap:wrap;align-items:center;gap:0 8px;padding:4px 8px;display:flex}.eqt-popup__suggestion:hover,.eqt-popup__suggestion--active{background:var(--eqt-bg-active)}.eqt-popup__suggestion-ns{color:var(--eqt-text-hint);flex-shrink:0;font-size:11px}.eqt-popup__suggestion-name{flex:1;min-width:0;font-size:13px}.eqt-popup__suggestion-tag{color:var(--eqt-text-hint);flex-shrink:0;margin-left:auto;font-size:11px}.eqt-row__builder{align-items:stretch;gap:4px;font-size:12px;line-height:1.4;display:flex}.eqt-row__prefix-cycle{border:var(--eqt-border-width) solid var(--eqt-border);min-width:2.2em;color:var(--eqt-text-hint);cursor:pointer;background:0 0;border-radius:3px;flex-shrink:0;justify-content:center;align-items:center;padding:0 6px;font-weight:700;display:flex}.eqt-row__prefix-cycle:hover{background:var(--eqt-bg-hover)}.eqt-row__prefix-cycle--exclude{color:#8c3333;background:#8c333326;border-color:#8c3333}.eqt-dark .eqt-row__prefix-cycle--exclude{color:#f87171;background:#f8717133;border-color:#f87171}.eqt-row__prefix-cycle--or{color:#b8860b;background:#b8860b26;border-color:#b8860b}.eqt-dark .eqt-row__prefix-cycle--or{color:#fbbf24;background:#fbbf2433;border-color:#fbbf24}.eqt-row__select{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-elevated);color:var(--eqt-text);border-radius:3px;flex-shrink:0;padding:0 4px}.eqt-row__select:focus{border-color:var(--eqt-border-focus);outline:none}.eqt-row__select--colon{max-width:11em}.eqt-row__colon-split{border:var(--eqt-border-width) solid var(--eqt-border);border-radius:3px;flex-shrink:0;display:flex;overflow:hidden}.eqt-row__colon-split .eqt-row__select--colon{border:none;border-radius:0;max-width:10em}.eqt-row__colon-toggle{border:none;border-right:var(--eqt-border-width) solid var(--eqt-border);color:var(--eqt-text-hint);cursor:pointer;background:0 0;flex-shrink:0;place-items:center;padding:0 6px;display:inline-grid}.eqt-row__colon-toggle>*{grid-area:1/1}.eqt-row__colon-toggle:hover:not(:disabled){background:var(--eqt-bg-hover);color:var(--eqt-text)}.eqt-row__colon-toggle--disabled{opacity:.3;cursor:default}.eqt-row__colon-toggle-hidden{visibility:hidden}.eqt-row__tag-wrap{flex:1;min-width:0;display:flex;position:relative}.eqt-row__tag-input{flex:1;width:100%}.eqt-row__suffix-cycle{border:var(--eqt-border-width) solid var(--eqt-border);min-width:2.2em;color:var(--eqt-text-hint);cursor:pointer;background:0 0;border-radius:3px;flex-shrink:0;justify-content:center;align-items:center;padding:0 6px;font-weight:700;display:flex}.eqt-row__suffix-cycle:hover{background:var(--eqt-bg-hover)}.eqt-row__suffix-cycle--exact{color:#dc2626;background:#dc26261a;border-color:#dc2626}.eqt-dark .eqt-row__suffix-cycle--exact{color:#f87171;background:#f8717133;border-color:#f87171}.eqt-row__suffix-cycle--wild{color:#7c3aed;background:#7c3aed1a;border-color:#7c3aed}.eqt-dark .eqt-row__suffix-cycle--wild{color:#a78bfa;background:#a78bfa33;border-color:#a78bfa}.eqt-row__raw-line{align-items:center;gap:4px;margin-top:4px;display:flex}.eqt-row__raw-label{color:var(--eqt-text-hint);flex-shrink:0;min-width:4em;font-size:10px}.eqt-row__raw-editable{background:var(--eqt-bg-elevated);border:var(--eqt-border-width) solid var(--eqt-border);box-sizing:border-box;white-space:nowrap;cursor:text;border-radius:3px;flex:1;min-width:0;padding:4px 6px;font-family:SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;font-size:12px;line-height:1.4;overflow:hidden}.eqt-row__raw-editable:focus{border-color:var(--eqt-border-focus);outline:none}.eqt-row__raw-editable:empty:before{content:attr(data-placeholder);color:var(--eqt-text-hint)}.eqt-explain--prefix{color:#d97706;background:#d977061a;border-radius:2px;padding:0 2px}.eqt-dark .eqt-explain--prefix{color:#fbbf24;background:#fbbf2426}.eqt-explain--ns{color:#2563eb;background:#2563eb1a;border-radius:2px;padding:0 2px}.eqt-dark .eqt-explain--ns{color:#60a5fa;background:#60a5fa26}.eqt-explain--qualifier{color:#7c3aed;background:#7c3aed1a;border-radius:2px;padding:0 2px}.eqt-dark .eqt-explain--qualifier{color:#a78bfa;background:#a78bfa26}.eqt-explain--tag{color:#059669;background:#0596691a;border-radius:2px;padding:0 2px}.eqt-dark .eqt-explain--tag{color:#34d399;background:#34d39926}.eqt-explain--suffix{color:#dc2626;background:#dc26261a;border-radius:2px;padding:0 2px}.eqt-dark .eqt-explain--suffix{color:#f87171;background:#f8717126}.eqt-explain--error{color:#dc2626;padding:0 2px;-webkit-text-decoration:underline wavy #dc2626;text-decoration:underline wavy #dc2626}.eqt-dark .eqt-explain--error{color:#f87171;text-decoration-color:#f87171}.eqt-explain--punct{color:var(--eqt-text-hint)}.eqt-popup-overlay{z-index:99999;background:var(--eqt-overlay);justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.eqt-popup{text-align:left;background:var(--eqt-bg);border:var(--eqt-border-width) solid var(--eqt-border);width:clamp(22rem,80vw,60rem);min-height:80vh;max-height:80vh;box-shadow:var(--eqt-shadow);color:var(--eqt-text);border-radius:.5rem;padding:1.25rem;font-size:13px;overflow-y:auto}.eqt-popup__field{margin-bottom:10px;position:relative}.eqt-popup__field-row{align-items:center;gap:6px;display:flex}.eqt-popup__name-input{border:var(--eqt-border-width) solid var(--line-color,var(--eqt-border));background:color-mix(in srgb, var(--line-color,var(--eqt-bg-btn)) 15%, var(--eqt-bg-btn));color:var(--eqt-text-secondary);cursor:text;white-space:nowrap;border-radius:3px;outline:none;min-width:6em;padding:2px 8px;font-size:12px;line-height:1.4;display:inline-block}.eqt-popup__name-input:empty:after{content:attr(data-placeholder);color:var(--eqt-text-hint)}.eqt-popup__name-input:has(>br:only-child):after{content:attr(data-placeholder);color:var(--eqt-text-hint)}.eqt-popup__name-input:focus{border-color:var(--eqt-border-focus)}.eqt-popup__label-row{align-items:baseline;margin-bottom:3px;font-size:12px;font-weight:700;display:flex}.eqt-popup__syntax-help{border:var(--eqt-border-width) solid var(--eqt-border);color:var(--eqt-text-hint);cursor:pointer;background:0 0;border-radius:3px;align-items:center;gap:3px;margin-left:6px;padding:4px 6px;font-size:12px;font-weight:400;line-height:1.4;text-decoration:none;display:inline-flex}.eqt-popup__syntax-help:hover{background:var(--eqt-bg-hover);color:var(--eqt-text-secondary)}.eqt-popup__add-btn{border:var(--eqt-border-width) solid var(--eqt-border);color:var(--eqt-text-hint);cursor:pointer;background:0 0;border-radius:3px;margin-left:auto;padding:4px 6px;font-size:12px;line-height:1.4}.eqt-popup__add-btn:hover{background:var(--eqt-bg-hover);color:var(--eqt-text-secondary)}.eqt-popup__label{margin-bottom:3px;font-size:12px;font-weight:700;display:block}.eqt-popup__label-row>.eqt-popup__label{margin-bottom:0}.eqt-popup__input{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-elevated);width:100%;color:var(--eqt-text);box-sizing:border-box;border-radius:3px;padding:4px 6px;font-size:13px}.eqt-popup__input:focus{border-color:var(--eqt-border-focus);outline:none}.eqt-popup__input:disabled{background:var(--eqt-bg-disabled);color:var(--eqt-text-hint)}.eqt-popup__divider{border:none;border-top:var(--eqt-border-width) solid var(--eqt-divider);margin:12px 0}.eqt-popup__tag-remove{width:24px;color:var(--eqt-text-hint);cursor:pointer;background:0 0;border:none;border-radius:3px;flex-shrink:0;justify-content:center;align-items:center;font-size:16px;display:flex}.eqt-popup__tag-remove:hover{background:var(--eqt-bg-hover);color:#8c3333}.eqt-popup__modes{gap:12px;display:flex}.eqt-popup__mode{cursor:pointer;-webkit-user-select:none;user-select:none;align-items:center;gap:4px;font-size:12px;display:flex}.eqt-popup__actions{align-items:center;gap:6px;margin-top:14px;display:flex}.eqt-popup__spacer{flex:1}.eqt-popup__kbd{opacity:.6;margin-left:6px;font-family:inherit;font-size:10px}.eqt-popup__btn{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-btn);color:var(--eqt-text);cursor:pointer;border-radius:3px;padding:4px 12px;font-size:12px}.eqt-popup__btn:hover{background:var(--eqt-bg-btn-hover)}.eqt-popup__btn--primary{color:#fff;background:#4a7c59;border-color:#3d6b4a}.eqt-popup__btn--primary:hover{background:#3d6b4a}.eqt-popup__btn--delete{color:#fff;background:#8c3333;border-color:#743030}.eqt-popup__btn--delete:hover{background:#743030}.eqt-row{border:var(--eqt-border-width) solid var(--eqt-border);border-radius:4px;margin-bottom:10px;padding:6px}.eqt-popup--url{min-height:auto}.eqt-popup__url-row{gap:6px;display:flex}.eqt-popup__url-row .eqt-popup__input{flex:1;min-width:0}.eqt-popup__url-prefix{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-elevated);color:var(--eqt-text);border-radius:3px;flex-shrink:0;padding:4px 6px;font-size:13px}.eqt-popup__url-prefix:focus{border-color:var(--eqt-border-focus);outline:none}.eqt-settings__layout{width:clamp(40rem,92vw,82rem);min-height:90vh;max-height:90vh;padding:0;display:flex}.eqt-settings__sidebar{border-right:var(--eqt-border-width) solid var(--eqt-divider);background:var(--eqt-bg);flex-direction:column;flex-shrink:0;width:7rem;padding:1.25rem .75rem;display:flex}.eqt-settings__sidebar .eqt-popup__title{margin:0 0 10px;padding:0 4px;font-size:14px;font-weight:700}.eqt-settings__sidebar-spacer{flex:1}.eqt-settings__tab{width:100%;color:var(--eqt-text);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:3px;padding:6px 8px;font-size:13px;display:block}.eqt-settings__tab:hover{background:var(--eqt-bg-hover)}.eqt-settings__tab--active{background:var(--eqt-bg-active);font-weight:700}.eqt-settings__panel{flex-direction:column;flex:1;min-width:0;padding:1.25rem;display:flex;overflow-y:auto}.eqt-settings__panel>:first-child{flex:1;min-height:0}.eqt-settings__panel .eqt-json-editor{flex-direction:column;flex:1;min-height:0;display:flex}.eqt-settings__profiles{border-left:var(--eqt-border-width) solid var(--eqt-divider);flex-shrink:0;width:15rem;padding:1.25rem .75rem;overflow-y:auto}.eqt-settings__row{cursor:pointer;align-items:center;gap:6px;font-size:13px;display:flex}.eqt-settings__label{-webkit-user-select:none;user-select:none}.eqt-settings__dblclick-row{align-items:center;gap:8px;margin-top:6px;font-size:13px;display:flex}.eqt-settings__dblclick-label{flex-shrink:0;min-width:5em}.eqt-settings__locale-row{gap:4px;margin-top:4px;display:flex}.eqt-settings__locale-btn{border:var(--eqt-border-width) solid var(--eqt-border);color:var(--eqt-text-secondary);cursor:pointer;background:0 0;border-radius:3px;padding:3px 10px;font-size:12px}.eqt-settings__locale-btn:hover{background:var(--eqt-bg-hover)}.eqt-settings__locale-btn--active{background:var(--eqt-bg-active);font-weight:700}.eqt-settings__select{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-elevated);color:var(--eqt-text);border-radius:3px;padding:3px 6px;font-size:12px}.eqt-settings__hint{color:var(--eqt-text-hint);margin:4px 0 0;font-size:11px;line-height:1.4}.eqt-settings__subtitle{align-items:center;gap:6px;margin:14px 0 4px;font-size:13px;font-weight:700;display:flex}.eqt-settings__reset-btn{color:var(--eqt-text-hint);cursor:pointer;background:0 0;border:none;border-radius:3px;align-items:center;gap:2px;padding:1px 6px;font-size:11px;line-height:1;display:inline-flex}.eqt-settings__reset-btn:hover{background:var(--eqt-bg-hover);color:var(--eqt-text)}.eqt-settings__row{align-items:center;gap:8px;display:flex}.eqt-settings__input--short{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg);width:5em;color:var(--eqt-text);border-radius:3px;padding:4px 6px;font-size:13px}.eqt-settings__refresh-btn{border:var(--eqt-border-width) solid var(--eqt-border);color:var(--eqt-text-secondary);cursor:pointer;background:0 0;border-radius:3px;align-items:center;gap:4px;padding:4px 8px;font-size:12px;display:inline-flex}.eqt-settings__refresh-btn:hover:not(:disabled){background:var(--eqt-bg-hover)}.eqt-settings__refresh-btn:disabled{opacity:.5;cursor:default}.eqt-settings__ns-list{margin:6px 0 0;padding:0;list-style:none}.eqt-settings__ns-item{border-radius:3px;align-items:center;gap:6px;min-height:30px;padding:3px 6px;font-size:13px;display:flex}.eqt-settings__ns-item:hover{background:var(--eqt-bg-hover)}.eqt-settings__ns-item--ghost{opacity:.4}.eqt-settings__ns-item--chosen{background:var(--eqt-bg-active)}.eqt-settings__ns-item--clickable{cursor:pointer}.eqt-settings__ns-item--draggable{cursor:grab}.eqt-settings__ns-label{-webkit-user-select:none;user-select:none;min-width:3em}.eqt-settings__ns-key{color:var(--eqt-text-hint);flex:1;font-size:11px}.eqt-settings__font-row{margin-top:4px}.eqt-settings__font-input{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-elevated);color:var(--eqt-text);box-sizing:border-box;border-radius:3px;padding:4px 6px;font-size:13px}.eqt-settings__font-input:focus{border-color:var(--eqt-border-focus);outline:none}.eqt-settings__font-input--full{width:100%}.eqt-settings__weight-row{align-items:center;gap:8px;margin-top:4px;display:flex}.eqt-settings__weight-slider{accent-color:var(--eqt-border-focus);flex:1}.eqt-settings__weight-value{color:var(--eqt-text-hint);text-align:right;min-width:2.5em;font-size:12px}.eqt-settings__font-preview{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg);border-radius:3px;flex-direction:column;gap:4px;margin-top:6px;padding:8px;display:flex}.eqt-settings__preview-line{flex-wrap:wrap;gap:4px;display:flex}.eqt-settings__preview-tag{border:var(--eqt-border-width) solid var(--eqt-border);color:var(--eqt-text-secondary);background:0 0;border-radius:3px;align-items:center;padding:2px 8px;font-size:12px;line-height:1.4;display:inline-flex}.eqt-settings__active-badge{color:#fff;vertical-align:middle;background:#4a7c59;border-radius:2px;margin-left:4px;padding:1px 4px;font-size:10px}.eqt-settings__item-name{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.eqt-settings__item-count{color:var(--eqt-text-hint);flex-shrink:0;font-size:11px}.eqt-settings__item-btn{width:24px;height:24px;color:var(--eqt-text-hint);cursor:pointer;background:0 0;border:none;border-radius:3px;flex-shrink:0;justify-content:center;align-items:center;display:flex}.eqt-settings__item-btn:hover{background:var(--eqt-bg-active);color:var(--eqt-text)}.eqt-settings__item-btn--purge:hover{color:#8c3333}.eqt-json-editor__header{justify-content:space-between;align-items:center;margin-bottom:8px;display:flex}.eqt-json-editor__title{margin:0;font-size:13px;font-weight:700}.eqt-json-editor__toolbar{gap:4px;display:flex}.eqt-json-editor__tool-btn{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-btn);width:28px;height:28px;color:var(--eqt-text);cursor:pointer;border-radius:3px;justify-content:center;align-items:center;display:flex}.eqt-json-editor__tool-btn:hover{background:var(--eqt-bg-btn-hover)}.eqt-json-editor__preview{background:var(--eqt-bg);font-family:var(--eqt-font-family,inherit);font-weight:var(--eqt-font-weight,inherit);flex-shrink:0;margin-bottom:8px}.eqt-json-editor__textarea{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg);min-height:0;color:var(--eqt-text);tab-size:2;resize:none;white-space:pre;box-sizing:border-box;border-radius:3px;flex:1;padding:8px;font-family:SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;font-size:12px;line-height:1.5;overflow:auto}.eqt-json-editor__textarea:focus{border-color:var(--eqt-border-focus);outline:none}.eqt-json-editor__error{color:#c33;background:#cc333314;border-radius:3px;margin:6px 0 0;padding:4px 8px;font-size:12px}.eqt-json-editor__corrupted-reason{color:#c33;flex:1;min-width:0;margin:0;font-size:12px}.eqt-json-editor__corrupted-reason~.eqt-popup__btn{flex-shrink:0}.eqt-about__hero{text-align:center;background:var(--eqt-bg-hover);border-radius:6px;margin-bottom:16px;padding:20px 16px}.eqt-about__title{color:var(--eqt-text);font-size:18px;font-weight:700}.eqt-about__version{color:var(--eqt-text-hint);margin-top:2px;font-size:11px}.eqt-about__desc{color:var(--eqt-text-hint);margin-top:4px;font-size:12px}.eqt-about__actions{justify-content:center;gap:8px;margin-top:12px;display:flex}.eqt-about__action-btn{border:var(--eqt-border-width) solid var(--eqt-border);background:var(--eqt-bg-btn);color:var(--eqt-text);cursor:pointer;border-radius:3px;align-items:center;gap:4px;padding:4px 12px;font-size:12px;text-decoration:none;display:inline-flex}.eqt-about__action-btn:hover{background:var(--eqt-bg-btn-hover)}.eqt-about__section{margin-bottom:12px}.eqt-about__section-title{color:var(--eqt-text-hint);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-size:11px;font-weight:700}.eqt-about__items{flex-direction:column;gap:2px;display:flex}.eqt-about__item{color:var(--eqt-text);border-radius:3px;align-items:center;gap:6px;padding:5px 8px;font-size:12px;text-decoration:none;display:flex}.eqt-about__item:hover{background:var(--eqt-bg-hover)}.eqt-about__item-detail{color:var(--eqt-text-hint);margin-left:auto;font-size:11px}.eqt-about__footer{border-top:var(--eqt-border-width) solid var(--eqt-divider);color:var(--eqt-text-hint);text-align:center;margin-top:16px;padding-top:12px;font-size:11px}\n/*$vite$:1*/ ");
	function makeMap(str) {
		const map = Object.create(null);
		for (const key of str.split(",")) map[key] = 1;
		return (val) => val in map;
	}
	var EMPTY_OBJ = {};
	var EMPTY_ARR = [];
	var NOOP = () => {};
	var NO = () => false;
	var isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
	var isModelListener = (key) => key.startsWith("onUpdate:");
	var extend$1 = Object.assign;
	var remove = (arr, el) => {
		const i = arr.indexOf(el);
		if (i > -1) arr.splice(i, 1);
	};
	var hasOwnProperty$1 = Object.prototype.hasOwnProperty;
	var hasOwn = (val, key) => hasOwnProperty$1.call(val, key);
	var isArray = Array.isArray;
	var isMap = (val) => toTypeString(val) === "[object Map]";
	var isSet = (val) => toTypeString(val) === "[object Set]";
	var isDate = (val) => toTypeString(val) === "[object Date]";
	var isFunction = (val) => typeof val === "function";
	var isString = (val) => typeof val === "string";
	var isSymbol = (val) => typeof val === "symbol";
	var isObject$1 = (val) => val !== null && typeof val === "object";
	var isPromise = (val) => {
		return (isObject$1(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
	};
	var objectToString = Object.prototype.toString;
	var toTypeString = (value) => objectToString.call(value);
	var toRawType = (value) => {
		return toTypeString(value).slice(8, -1);
	};
	var isPlainObject = (val) => toTypeString(val) === "[object Object]";
	var isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
	var isReservedProp = makeMap(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted");
	var cacheStringFunction$1 = (fn) => {
		const cache = Object.create(null);
		return ((str) => {
			return cache[str] || (cache[str] = fn(str));
		});
	};
	var camelizeRE$1 = /-\w/g;
	var camelize$2 = cacheStringFunction$1((str) => {
		return str.replace(camelizeRE$1, (c) => c.slice(1).toUpperCase());
	});
	var hyphenateRE$1 = /\B([A-Z])/g;
	var hyphenate$1 = cacheStringFunction$1((str) => str.replace(hyphenateRE$1, "-$1").toLowerCase());
	var capitalize = cacheStringFunction$1((str) => {
		return str.charAt(0).toUpperCase() + str.slice(1);
	});
	var toHandlerKey = cacheStringFunction$1((str) => {
		return str ? `on${capitalize(str)}` : ``;
	});
	var hasChanged = (value, oldValue) => !Object.is(value, oldValue);
	var invokeArrayFns = (fns, ...arg) => {
		for (let i = 0; i < fns.length; i++) fns[i](...arg);
	};
	var def = (obj, key, value, writable = false) => {
		Object.defineProperty(obj, key, {
			configurable: true,
			enumerable: false,
			writable,
			value
		});
	};
	var looseToNumber = (val) => {
		const n = parseFloat(val);
		return isNaN(n) ? val : n;
	};
	var toNumber = (val) => {
		const n = isString(val) ? Number(val) : NaN;
		return isNaN(n) ? val : n;
	};
	var _globalThis;
	var getGlobalThis = () => {
		return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
	};
	function normalizeStyle(value) {
		if (isArray(value)) {
			const res = {};
			for (let i = 0; i < value.length; i++) {
				const item = value[i];
				const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);
				if (normalized) for (const key in normalized) res[key] = normalized[key];
			}
			return res;
		} else if (isString(value) || isObject$1(value)) return value;
	}
	var listDelimiterRE = /;(?![^(]*\))/g;
	var propertyDelimiterRE = /:([^]+)/;
	var styleCommentRE = /\/\*[^]*?\*\//g;
	function parseStringStyle(cssText) {
		const ret = {};
		cssText.replace(styleCommentRE, "").split(listDelimiterRE).forEach((item) => {
			if (item) {
				const tmp = item.split(propertyDelimiterRE);
				tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
			}
		});
		return ret;
	}
	function normalizeClass(value) {
		let res = "";
		if (isString(value)) res = value;
		else if (isArray(value)) for (let i = 0; i < value.length; i++) {
			const normalized = normalizeClass(value[i]);
			if (normalized) res += normalized + " ";
		}
		else if (isObject$1(value)) {
			for (const name in value) if (value[name]) res += name + " ";
		}
		return res.trim();
	}
	var specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
	var isSpecialBooleanAttr = makeMap(specialBooleanAttrs);
	specialBooleanAttrs + "";
	function includeBooleanAttr(value) {
		return !!value || value === "";
	}
	function looseCompareArrays(a, b) {
		if (a.length !== b.length) return false;
		let equal = true;
		for (let i = 0; equal && i < a.length; i++) equal = looseEqual(a[i], b[i]);
		return equal;
	}
	function looseEqual(a, b) {
		if (a === b) return true;
		let aValidType = isDate(a);
		let bValidType = isDate(b);
		if (aValidType || bValidType) return aValidType && bValidType ? a.getTime() === b.getTime() : false;
		aValidType = isSymbol(a);
		bValidType = isSymbol(b);
		if (aValidType || bValidType) return a === b;
		aValidType = isArray(a);
		bValidType = isArray(b);
		if (aValidType || bValidType) return aValidType && bValidType ? looseCompareArrays(a, b) : false;
		aValidType = isObject$1(a);
		bValidType = isObject$1(b);
		if (aValidType || bValidType) {
			if (!aValidType || !bValidType) return false;
			if (Object.keys(a).length !== Object.keys(b).length) return false;
			for (const key in a) {
				const aHasKey = a.hasOwnProperty(key);
				const bHasKey = b.hasOwnProperty(key);
				if (aHasKey && !bHasKey || !aHasKey && bHasKey || !looseEqual(a[key], b[key])) return false;
			}
		}
		return String(a) === String(b);
	}
	function looseIndexOf(arr, val) {
		return arr.findIndex((item) => looseEqual(item, val));
	}
	var isRef$1 = (val) => {
		return !!(val && val["__v_isRef"] === true);
	};
	var toDisplayString = (val) => {
		return isString(val) ? val : val == null ? "" : isArray(val) || isObject$1(val) && (val.toString === objectToString || !isFunction(val.toString)) ? isRef$1(val) ? toDisplayString(val.value) : JSON.stringify(val, replacer, 2) : String(val);
	};
	var replacer = (_key, val) => {
		if (isRef$1(val)) return replacer(_key, val.value);
		else if (isMap(val)) return { [`Map(${val.size})`]: [...val.entries()].reduce((entries, [key, val2], i) => {
			entries[stringifySymbol(key, i) + " =>"] = val2;
			return entries;
		}, {}) };
		else if (isSet(val)) return { [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v)) };
		else if (isSymbol(val)) return stringifySymbol(val);
		else if (isObject$1(val) && !isArray(val) && !isPlainObject(val)) return String(val);
		return val;
	};
	var stringifySymbol = (v, i = "") => {
		var _a;
		return isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v;
	};
	var activeEffectScope;
	var EffectScope = class {
		constructor(detached = false) {
			this.detached = detached;
			this._active = true;
			this._on = 0;
			this.effects = [];
			this.cleanups = [];
			this._isPaused = false;
			this._warnOnRun = true;
			this.__v_skip = true;
			if (!detached && activeEffectScope) if (activeEffectScope.active) {
				this.parent = activeEffectScope;
				this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(this) - 1;
			} else {
				this._active = false;
				this._warnOnRun = false;
			}
		}
		get active() {
			return this._active;
		}
		pause() {
			if (this._active) {
				this._isPaused = true;
				let i, l;
				if (this.scopes) for (i = 0, l = this.scopes.length; i < l; i++) this.scopes[i].pause();
				for (i = 0, l = this.effects.length; i < l; i++) this.effects[i].pause();
			}
		}
		resume() {
			if (this._active) {
				if (this._isPaused) {
					this._isPaused = false;
					let i, l;
					if (this.scopes) for (i = 0, l = this.scopes.length; i < l; i++) this.scopes[i].resume();
					for (i = 0, l = this.effects.length; i < l; i++) this.effects[i].resume();
				}
			}
		}
		run(fn) {
			if (this._active) {
				const currentEffectScope = activeEffectScope;
				try {
					activeEffectScope = this;
					return fn();
				} finally {
					activeEffectScope = currentEffectScope;
				}
			}
		}
		on() {
			if (++this._on === 1) {
				this.prevScope = activeEffectScope;
				activeEffectScope = this;
			}
		}
		off() {
			if (this._on > 0 && --this._on === 0) {
				if (activeEffectScope === this) activeEffectScope = this.prevScope;
				else {
					let current = activeEffectScope;
					while (current) {
						if (current.prevScope === this) {
							current.prevScope = this.prevScope;
							break;
						}
						current = current.prevScope;
					}
				}
				this.prevScope = void 0;
			}
		}
		stop(fromParent) {
			if (this._active) {
				this._active = false;
				let i, l;
				for (i = 0, l = this.effects.length; i < l; i++) this.effects[i].stop();
				this.effects.length = 0;
				for (i = 0, l = this.cleanups.length; i < l; i++) this.cleanups[i]();
				this.cleanups.length = 0;
				if (this.scopes) {
					for (i = 0, l = this.scopes.length; i < l; i++) this.scopes[i].stop(true);
					this.scopes.length = 0;
				}
				if (!this.detached && this.parent && !fromParent) {
					const last = this.parent.scopes.pop();
					if (last && last !== this) {
						this.parent.scopes[this.index] = last;
						last.index = this.index;
					}
				}
				this.parent = void 0;
			}
		}
	};
	function getCurrentScope() {
		return activeEffectScope;
	}
	function onScopeDispose(fn, failSilently = false) {
		if (activeEffectScope) activeEffectScope.cleanups.push(fn);
	}
	var activeSub;
	var pausedQueueEffects = new WeakSet();
	var ReactiveEffect = class {
		constructor(fn) {
			this.fn = fn;
			this.deps = void 0;
			this.depsTail = void 0;
			this.flags = 5;
			this.next = void 0;
			this.cleanup = void 0;
			this.scheduler = void 0;
			if (activeEffectScope) if (activeEffectScope.active) activeEffectScope.effects.push(this);
			else this.flags &= -2;
		}
		pause() {
			this.flags |= 64;
		}
		resume() {
			if (this.flags & 64) {
				this.flags &= -65;
				if (pausedQueueEffects.has(this)) {
					pausedQueueEffects.delete(this);
					this.trigger();
				}
			}
		}
		notify() {
			if (this.flags & 2 && !(this.flags & 32)) return;
			if (!(this.flags & 8)) batch(this);
		}
		run() {
			if (!(this.flags & 1)) return this.fn();
			this.flags |= 2;
			cleanupEffect(this);
			prepareDeps(this);
			const prevEffect = activeSub;
			const prevShouldTrack = shouldTrack;
			activeSub = this;
			shouldTrack = true;
			try {
				return this.fn();
			} finally {
				cleanupDeps(this);
				activeSub = prevEffect;
				shouldTrack = prevShouldTrack;
				this.flags &= -3;
			}
		}
		stop() {
			if (this.flags & 1) {
				for (let link = this.deps; link; link = link.nextDep) removeSub(link);
				this.deps = this.depsTail = void 0;
				cleanupEffect(this);
				this.onStop && this.onStop();
				this.flags &= -2;
			}
		}
		trigger() {
			if (this.flags & 64) pausedQueueEffects.add(this);
			else if (this.scheduler) this.scheduler();
			else this.runIfDirty();
		}
		runIfDirty() {
			if (isDirty(this)) this.run();
		}
		get dirty() {
			return isDirty(this);
		}
	};
	var batchDepth = 0;
	var batchedSub;
	var batchedComputed;
	function batch(sub, isComputed = false) {
		sub.flags |= 8;
		if (isComputed) {
			sub.next = batchedComputed;
			batchedComputed = sub;
			return;
		}
		sub.next = batchedSub;
		batchedSub = sub;
	}
	function startBatch() {
		batchDepth++;
	}
	function endBatch() {
		if (--batchDepth > 0) return;
		if (batchedComputed) {
			let e = batchedComputed;
			batchedComputed = void 0;
			while (e) {
				const next = e.next;
				e.next = void 0;
				e.flags &= -9;
				e = next;
			}
		}
		let error;
		while (batchedSub) {
			let e = batchedSub;
			batchedSub = void 0;
			while (e) {
				const next = e.next;
				e.next = void 0;
				e.flags &= -9;
				if (e.flags & 1) try {
					e.trigger();
				} catch (err) {
					if (!error) error = err;
				}
				e = next;
			}
		}
		if (error) throw error;
	}
	function prepareDeps(sub) {
		for (let link = sub.deps; link; link = link.nextDep) {
			link.version = -1;
			link.prevActiveLink = link.dep.activeLink;
			link.dep.activeLink = link;
		}
	}
	function cleanupDeps(sub) {
		let head;
		let tail = sub.depsTail;
		let link = tail;
		while (link) {
			const prev = link.prevDep;
			if (link.version === -1) {
				if (link === tail) tail = prev;
				removeSub(link);
				removeDep(link);
			} else head = link;
			link.dep.activeLink = link.prevActiveLink;
			link.prevActiveLink = void 0;
			link = prev;
		}
		sub.deps = head;
		sub.depsTail = tail;
	}
	function isDirty(sub) {
		for (let link = sub.deps; link; link = link.nextDep) if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) return true;
		if (sub._dirty) return true;
		return false;
	}
	function refreshComputed(computed) {
		if (computed.flags & 4 && !(computed.flags & 16)) return;
		computed.flags &= -17;
		if (computed.globalVersion === globalVersion) return;
		computed.globalVersion = globalVersion;
		if (!computed.isSSR && computed.flags & 128 && (!computed.deps && !computed._dirty || !isDirty(computed))) return;
		computed.flags |= 2;
		const dep = computed.dep;
		const prevSub = activeSub;
		const prevShouldTrack = shouldTrack;
		activeSub = computed;
		shouldTrack = true;
		try {
			prepareDeps(computed);
			const value = computed.fn(computed._value);
			if (dep.version === 0 || hasChanged(value, computed._value)) {
				computed.flags |= 128;
				computed._value = value;
				dep.version++;
			}
		} catch (err) {
			dep.version++;
			throw err;
		} finally {
			activeSub = prevSub;
			shouldTrack = prevShouldTrack;
			cleanupDeps(computed);
			computed.flags &= -3;
		}
	}
	function removeSub(link, soft = false) {
		const { dep, prevSub, nextSub } = link;
		if (prevSub) {
			prevSub.nextSub = nextSub;
			link.prevSub = void 0;
		}
		if (nextSub) {
			nextSub.prevSub = prevSub;
			link.nextSub = void 0;
		}
		if (dep.subs === link) {
			dep.subs = prevSub;
			if (!prevSub && dep.computed) {
				dep.computed.flags &= -5;
				for (let l = dep.computed.deps; l; l = l.nextDep) removeSub(l, true);
			}
		}
		if (!soft && !--dep.sc && dep.map) dep.map.delete(dep.key);
	}
	function removeDep(link) {
		const { prevDep, nextDep } = link;
		if (prevDep) {
			prevDep.nextDep = nextDep;
			link.prevDep = void 0;
		}
		if (nextDep) {
			nextDep.prevDep = prevDep;
			link.nextDep = void 0;
		}
	}
	var shouldTrack = true;
	var trackStack = [];
	function pauseTracking() {
		trackStack.push(shouldTrack);
		shouldTrack = false;
	}
	function resetTracking() {
		const last = trackStack.pop();
		shouldTrack = last === void 0 ? true : last;
	}
	function cleanupEffect(e) {
		const { cleanup } = e;
		e.cleanup = void 0;
		if (cleanup) {
			const prevSub = activeSub;
			activeSub = void 0;
			try {
				cleanup();
			} finally {
				activeSub = prevSub;
			}
		}
	}
	var globalVersion = 0;
	var Link = class {
		constructor(sub, dep) {
			this.sub = sub;
			this.dep = dep;
			this.version = dep.version;
			this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
		}
	};
	var Dep = class {
		constructor(computed) {
			this.computed = computed;
			this.version = 0;
			this.activeLink = void 0;
			this.subs = void 0;
			this.map = void 0;
			this.key = void 0;
			this.sc = 0;
			this.__v_skip = true;
		}
		track(debugInfo) {
			if (!activeSub || !shouldTrack || activeSub === this.computed) return;
			let link = this.activeLink;
			if (link === void 0 || link.sub !== activeSub) {
				link = this.activeLink = new Link(activeSub, this);
				if (!activeSub.deps) activeSub.deps = activeSub.depsTail = link;
				else {
					link.prevDep = activeSub.depsTail;
					activeSub.depsTail.nextDep = link;
					activeSub.depsTail = link;
				}
				addSub(link);
			} else if (link.version === -1) {
				link.version = this.version;
				if (link.nextDep) {
					const next = link.nextDep;
					next.prevDep = link.prevDep;
					if (link.prevDep) link.prevDep.nextDep = next;
					link.prevDep = activeSub.depsTail;
					link.nextDep = void 0;
					activeSub.depsTail.nextDep = link;
					activeSub.depsTail = link;
					if (activeSub.deps === link) activeSub.deps = next;
				}
			}
			return link;
		}
		trigger(debugInfo) {
			this.version++;
			globalVersion++;
			this.notify(debugInfo);
		}
		notify(debugInfo) {
			startBatch();
			try {
				for (let link = this.subs; link; link = link.prevSub) if (link.sub.notify()) link.sub.dep.notify();
			} finally {
				endBatch();
			}
		}
	};
	function addSub(link) {
		link.dep.sc++;
		if (link.sub.flags & 4) {
			const computed = link.dep.computed;
			if (computed && !link.dep.subs) {
				computed.flags |= 20;
				for (let l = computed.deps; l; l = l.nextDep) addSub(l);
			}
			const currentTail = link.dep.subs;
			if (currentTail !== link) {
				link.prevSub = currentTail;
				if (currentTail) currentTail.nextSub = link;
			}
			link.dep.subs = link;
		}
	}
	var targetMap = new WeakMap();
	var ITERATE_KEY = Symbol("");
	var MAP_KEY_ITERATE_KEY = Symbol("");
	var ARRAY_ITERATE_KEY = Symbol("");
	function track(target, type, key) {
		if (shouldTrack && activeSub) {
			let depsMap = targetMap.get(target);
			if (!depsMap) targetMap.set(target, depsMap = new Map());
			let dep = depsMap.get(key);
			if (!dep) {
				depsMap.set(key, dep = new Dep());
				dep.map = depsMap;
				dep.key = key;
			}
			dep.track();
		}
	}
	function trigger(target, type, key, newValue, oldValue, oldTarget) {
		const depsMap = targetMap.get(target);
		if (!depsMap) {
			globalVersion++;
			return;
		}
		const run = (dep) => {
			if (dep) dep.trigger();
		};
		startBatch();
		if (type === "clear") depsMap.forEach(run);
		else {
			const targetIsArray = isArray(target);
			const isArrayIndex = targetIsArray && isIntegerKey(key);
			if (targetIsArray && key === "length") {
				const newLength = Number(newValue);
				depsMap.forEach((dep, key2) => {
					if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !isSymbol(key2) && key2 >= newLength) run(dep);
				});
			} else {
				if (key !== void 0 || depsMap.has(void 0)) run(depsMap.get(key));
				if (isArrayIndex) run(depsMap.get(ARRAY_ITERATE_KEY));
				switch (type) {
					case "add":
						if (!targetIsArray) {
							run(depsMap.get(ITERATE_KEY));
							if (isMap(target)) run(depsMap.get(MAP_KEY_ITERATE_KEY));
						} else if (isArrayIndex) run(depsMap.get("length"));
						break;
					case "delete":
						if (!targetIsArray) {
							run(depsMap.get(ITERATE_KEY));
							if (isMap(target)) run(depsMap.get(MAP_KEY_ITERATE_KEY));
						}
						break;
					case "set":
						if (isMap(target)) run(depsMap.get(ITERATE_KEY));
						break;
				}
			}
		}
		endBatch();
	}
	function getDepFromReactive(object, key) {
		const depMap = targetMap.get(object);
		return depMap && depMap.get(key);
	}
	function reactiveReadArray(array) {
		const raw = toRaw(array);
		if (raw === array) return raw;
		track(raw, "iterate", ARRAY_ITERATE_KEY);
		return isShallow(array) ? raw : raw.map(toReactive);
	}
	function shallowReadArray(arr) {
		track(arr = toRaw(arr), "iterate", ARRAY_ITERATE_KEY);
		return arr;
	}
	function toWrapped(target, item) {
		if (isReadonly(target)) return isReactive(target) ? toReadonly(toReactive(item)) : toReadonly(item);
		return toReactive(item);
	}
	var arrayInstrumentations = {
		__proto__: null,
		[Symbol.iterator]() {
			return iterator(this, Symbol.iterator, (item) => toWrapped(this, item));
		},
		concat(...args) {
			return reactiveReadArray(this).concat(...args.map((x) => isArray(x) ? reactiveReadArray(x) : x));
		},
		entries() {
			return iterator(this, "entries", (value) => {
				value[1] = toWrapped(this, value[1]);
				return value;
			});
		},
		every(fn, thisArg) {
			return apply(this, "every", fn, thisArg, void 0, arguments);
		},
		filter(fn, thisArg) {
			return apply(this, "filter", fn, thisArg, (v) => v.map((item) => toWrapped(this, item)), arguments);
		},
		find(fn, thisArg) {
			return apply(this, "find", fn, thisArg, (item) => toWrapped(this, item), arguments);
		},
		findIndex(fn, thisArg) {
			return apply(this, "findIndex", fn, thisArg, void 0, arguments);
		},
		findLast(fn, thisArg) {
			return apply(this, "findLast", fn, thisArg, (item) => toWrapped(this, item), arguments);
		},
		findLastIndex(fn, thisArg) {
			return apply(this, "findLastIndex", fn, thisArg, void 0, arguments);
		},
		forEach(fn, thisArg) {
			return apply(this, "forEach", fn, thisArg, void 0, arguments);
		},
		includes(...args) {
			return searchProxy(this, "includes", args);
		},
		indexOf(...args) {
			return searchProxy(this, "indexOf", args);
		},
		join(separator) {
			return reactiveReadArray(this).join(separator);
		},
		lastIndexOf(...args) {
			return searchProxy(this, "lastIndexOf", args);
		},
		map(fn, thisArg) {
			return apply(this, "map", fn, thisArg, void 0, arguments);
		},
		pop() {
			return noTracking(this, "pop");
		},
		push(...args) {
			return noTracking(this, "push", args);
		},
		reduce(fn, ...args) {
			return reduce(this, "reduce", fn, args);
		},
		reduceRight(fn, ...args) {
			return reduce(this, "reduceRight", fn, args);
		},
		shift() {
			return noTracking(this, "shift");
		},
		some(fn, thisArg) {
			return apply(this, "some", fn, thisArg, void 0, arguments);
		},
		splice(...args) {
			return noTracking(this, "splice", args);
		},
		toReversed() {
			return reactiveReadArray(this).toReversed();
		},
		toSorted(comparer) {
			return reactiveReadArray(this).toSorted(comparer);
		},
		toSpliced(...args) {
			return reactiveReadArray(this).toSpliced(...args);
		},
		unshift(...args) {
			return noTracking(this, "unshift", args);
		},
		values() {
			return iterator(this, "values", (item) => toWrapped(this, item));
		}
	};
	function iterator(self, method, wrapValue) {
		const arr = shallowReadArray(self);
		const iter = arr[method]();
		if (arr !== self && !isShallow(self)) {
			iter._next = iter.next;
			iter.next = () => {
				const result = iter._next();
				if (!result.done) result.value = wrapValue(result.value);
				return result;
			};
		}
		return iter;
	}
	var arrayProto = Array.prototype;
	function apply(self, method, fn, thisArg, wrappedRetFn, args) {
		const arr = shallowReadArray(self);
		const needsWrap = arr !== self && !isShallow(self);
		const methodFn = arr[method];
		if (methodFn !== arrayProto[method]) {
			const result2 = methodFn.apply(self, args);
			return needsWrap ? toReactive(result2) : result2;
		}
		let wrappedFn = fn;
		if (arr !== self) {
			if (needsWrap) wrappedFn = function(item, index) {
				return fn.call(this, toWrapped(self, item), index, self);
			};
			else if (fn.length > 2) wrappedFn = function(item, index) {
				return fn.call(this, item, index, self);
			};
		}
		const result = methodFn.call(arr, wrappedFn, thisArg);
		return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
	}
	function reduce(self, method, fn, args) {
		const arr = shallowReadArray(self);
		const needsWrap = arr !== self && !isShallow(self);
		let wrappedFn = fn;
		let wrapInitialAccumulator = false;
		if (arr !== self) {
			if (needsWrap) {
				wrapInitialAccumulator = args.length === 0;
				wrappedFn = function(acc, item, index) {
					if (wrapInitialAccumulator) {
						wrapInitialAccumulator = false;
						acc = toWrapped(self, acc);
					}
					return fn.call(this, acc, toWrapped(self, item), index, self);
				};
			} else if (fn.length > 3) wrappedFn = function(acc, item, index) {
				return fn.call(this, acc, item, index, self);
			};
		}
		const result = arr[method](wrappedFn, ...args);
		return wrapInitialAccumulator ? toWrapped(self, result) : result;
	}
	function searchProxy(self, method, args) {
		const arr = toRaw(self);
		track(arr, "iterate", ARRAY_ITERATE_KEY);
		const res = arr[method](...args);
		if ((res === -1 || res === false) && isProxy(args[0])) {
			args[0] = toRaw(args[0]);
			return arr[method](...args);
		}
		return res;
	}
	function noTracking(self, method, args = []) {
		pauseTracking();
		startBatch();
		const res = toRaw(self)[method].apply(self, args);
		endBatch();
		resetTracking();
		return res;
	}
	var isNonTrackableKeys = makeMap(`__proto__,__v_isRef,__isVue`);
	var builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol));
	function hasOwnProperty(key) {
		if (!isSymbol(key)) key = String(key);
		const obj = toRaw(this);
		track(obj, "has", key);
		return obj.hasOwnProperty(key);
	}
	var BaseReactiveHandler = class {
		constructor(_isReadonly = false, _isShallow = false) {
			this._isReadonly = _isReadonly;
			this._isShallow = _isShallow;
		}
		get(target, key, receiver) {
			if (key === "__v_skip") return target["__v_skip"];
			const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
			if (key === "__v_isReactive") return !isReadonly2;
			else if (key === "__v_isReadonly") return isReadonly2;
			else if (key === "__v_isShallow") return isShallow2;
			else if (key === "__v_raw") {
				if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) return target;
				return;
			}
			const targetIsArray = isArray(target);
			if (!isReadonly2) {
				let fn;
				if (targetIsArray && (fn = arrayInstrumentations[key])) return fn;
				if (key === "hasOwnProperty") return hasOwnProperty;
			}
			const res = Reflect.get(target, key, isRef(target) ? target : receiver);
			if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) return res;
			if (!isReadonly2) track(target, "get", key);
			if (isShallow2) return res;
			if (isRef(res)) {
				const value = targetIsArray && isIntegerKey(key) ? res : res.value;
				return isReadonly2 && isObject$1(value) ? readonly(value) : value;
			}
			if (isObject$1(res)) return isReadonly2 ? readonly(res) : reactive(res);
			return res;
		}
	};
	var MutableReactiveHandler = class extends BaseReactiveHandler {
		constructor(isShallow2 = false) {
			super(false, isShallow2);
		}
		set(target, key, value, receiver) {
			let oldValue = target[key];
			const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key);
			if (!this._isShallow) {
				const isOldValueReadonly = isReadonly(oldValue);
				if (!isShallow(value) && !isReadonly(value)) {
					oldValue = toRaw(oldValue);
					value = toRaw(value);
				}
				if (!isArrayWithIntegerKey && isRef(oldValue) && !isRef(value)) if (isOldValueReadonly) return true;
				else {
					oldValue.value = value;
					return true;
				}
			}
			const hadKey = isArrayWithIntegerKey ? Number(key) < target.length : hasOwn(target, key);
			const result = Reflect.set(target, key, value, isRef(target) ? target : receiver);
			if (target === toRaw(receiver)) {
				if (!hadKey) trigger(target, "add", key, value);
				else if (hasChanged(value, oldValue)) trigger(target, "set", key, value, oldValue);
			}
			return result;
		}
		deleteProperty(target, key) {
			const hadKey = hasOwn(target, key);
			const oldValue = target[key];
			const result = Reflect.deleteProperty(target, key);
			if (result && hadKey) trigger(target, "delete", key, void 0, oldValue);
			return result;
		}
		has(target, key) {
			const result = Reflect.has(target, key);
			if (!isSymbol(key) || !builtInSymbols.has(key)) track(target, "has", key);
			return result;
		}
		ownKeys(target) {
			track(target, "iterate", isArray(target) ? "length" : ITERATE_KEY);
			return Reflect.ownKeys(target);
		}
	};
	var ReadonlyReactiveHandler = class extends BaseReactiveHandler {
		constructor(isShallow2 = false) {
			super(true, isShallow2);
		}
		set(target, key) {
			return true;
		}
		deleteProperty(target, key) {
			return true;
		}
	};
	var mutableHandlers = new MutableReactiveHandler();
	var readonlyHandlers = new ReadonlyReactiveHandler();
	var shallowReactiveHandlers = new MutableReactiveHandler(true);
	var shallowReadonlyHandlers = new ReadonlyReactiveHandler(true);
	var toShallow = (value) => value;
	var getProto = (v) => Reflect.getPrototypeOf(v);
	function createIterableMethod(method, isReadonly2, isShallow2) {
		return function(...args) {
			const target = this["__v_raw"];
			const rawTarget = toRaw(target);
			const targetIsMap = isMap(rawTarget);
			const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
			const isKeyOnly = method === "keys" && targetIsMap;
			const innerIterator = target[method](...args);
			const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
			!isReadonly2 && track(rawTarget, "iterate", isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
			return extend$1(Object.create(innerIterator), { next() {
				const { value, done } = innerIterator.next();
				return done ? {
					value,
					done
				} : {
					value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
					done
				};
			} });
		};
	}
	function createReadonlyMethod(type) {
		return function(...args) {
			return type === "delete" ? false : type === "clear" ? void 0 : this;
		};
	}
	function createInstrumentations(readonly, shallow) {
		const instrumentations = {
			get(key) {
				const target = this["__v_raw"];
				const rawTarget = toRaw(target);
				const rawKey = toRaw(key);
				if (!readonly) {
					if (hasChanged(key, rawKey)) track(rawTarget, "get", key);
					track(rawTarget, "get", rawKey);
				}
				const { has } = getProto(rawTarget);
				const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive;
				if (has.call(rawTarget, key)) return wrap(target.get(key));
				else if (has.call(rawTarget, rawKey)) return wrap(target.get(rawKey));
				else if (target !== rawTarget) target.get(key);
			},
			get size() {
				const target = this["__v_raw"];
				!readonly && track(toRaw(target), "iterate", ITERATE_KEY);
				return target.size;
			},
			has(key) {
				const target = this["__v_raw"];
				const rawTarget = toRaw(target);
				const rawKey = toRaw(key);
				if (!readonly) {
					if (hasChanged(key, rawKey)) track(rawTarget, "has", key);
					track(rawTarget, "has", rawKey);
				}
				return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
			},
			forEach(callback, thisArg) {
				const observed = this;
				const target = observed["__v_raw"];
				const rawTarget = toRaw(target);
				const wrap = shallow ? toShallow : readonly ? toReadonly : toReactive;
				!readonly && track(rawTarget, "iterate", ITERATE_KEY);
				return target.forEach((value, key) => {
					return callback.call(thisArg, wrap(value), wrap(key), observed);
				});
			}
		};
		extend$1(instrumentations, readonly ? {
			add: createReadonlyMethod("add"),
			set: createReadonlyMethod("set"),
			delete: createReadonlyMethod("delete"),
			clear: createReadonlyMethod("clear")
		} : {
			add(value) {
				const target = toRaw(this);
				const proto = getProto(target);
				const rawValue = toRaw(value);
				const valueToAdd = !shallow && !isShallow(value) && !isReadonly(value) ? rawValue : value;
				if (!(proto.has.call(target, valueToAdd) || hasChanged(value, valueToAdd) && proto.has.call(target, value) || hasChanged(rawValue, valueToAdd) && proto.has.call(target, rawValue))) {
					target.add(valueToAdd);
					trigger(target, "add", valueToAdd, valueToAdd);
				}
				return this;
			},
			set(key, value) {
				if (!shallow && !isShallow(value) && !isReadonly(value)) value = toRaw(value);
				const target = toRaw(this);
				const { has, get } = getProto(target);
				let hadKey = has.call(target, key);
				if (!hadKey) {
					key = toRaw(key);
					hadKey = has.call(target, key);
				}
				const oldValue = get.call(target, key);
				target.set(key, value);
				if (!hadKey) trigger(target, "add", key, value);
				else if (hasChanged(value, oldValue)) trigger(target, "set", key, value, oldValue);
				return this;
			},
			delete(key) {
				const target = toRaw(this);
				const { has, get } = getProto(target);
				let hadKey = has.call(target, key);
				if (!hadKey) {
					key = toRaw(key);
					hadKey = has.call(target, key);
				}
				const oldValue = get ? get.call(target, key) : void 0;
				const result = target.delete(key);
				if (hadKey) trigger(target, "delete", key, void 0, oldValue);
				return result;
			},
			clear() {
				const target = toRaw(this);
				const hadItems = target.size !== 0;
				const oldTarget = void 0;
				const result = target.clear();
				if (hadItems) trigger(target, "clear", void 0, void 0, oldTarget);
				return result;
			}
		});
		[
			"keys",
			"values",
			"entries",
			Symbol.iterator
		].forEach((method) => {
			instrumentations[method] = createIterableMethod(method, readonly, shallow);
		});
		return instrumentations;
	}
	function createInstrumentationGetter(isReadonly2, shallow) {
		const instrumentations = createInstrumentations(isReadonly2, shallow);
		return (target, key, receiver) => {
			if (key === "__v_isReactive") return !isReadonly2;
			else if (key === "__v_isReadonly") return isReadonly2;
			else if (key === "__v_raw") return target;
			return Reflect.get(hasOwn(instrumentations, key) && key in target ? instrumentations : target, key, receiver);
		};
	}
	var mutableCollectionHandlers = { get: createInstrumentationGetter(false, false) };
	var shallowCollectionHandlers = { get: createInstrumentationGetter(false, true) };
	var readonlyCollectionHandlers = { get: createInstrumentationGetter(true, false) };
	var shallowReadonlyCollectionHandlers = { get: createInstrumentationGetter(true, true) };
	var reactiveMap = new WeakMap();
	var shallowReactiveMap = new WeakMap();
	var readonlyMap = new WeakMap();
	var shallowReadonlyMap = new WeakMap();
	function targetTypeMap(rawType) {
		switch (rawType) {
			case "Object":
			case "Array": return 1;
			case "Map":
			case "Set":
			case "WeakMap":
			case "WeakSet": return 2;
			default: return 0;
		}
	}
	function getTargetType(value) {
		return value["__v_skip"] || !Object.isExtensible(value) ? 0 : targetTypeMap(toRawType(value));
	}
	function reactive(target) {
		if (isReadonly(target)) return target;
		return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
	}
	function shallowReactive(target) {
		return createReactiveObject(target, false, shallowReactiveHandlers, shallowCollectionHandlers, shallowReactiveMap);
	}
	function readonly(target) {
		return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
	}
	function shallowReadonly(target) {
		return createReactiveObject(target, true, shallowReadonlyHandlers, shallowReadonlyCollectionHandlers, shallowReadonlyMap);
	}
	function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
		if (!isObject$1(target)) return target;
		if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) return target;
		const targetType = getTargetType(target);
		if (targetType === 0) return target;
		const existingProxy = proxyMap.get(target);
		if (existingProxy) return existingProxy;
		const proxy = new Proxy(target, targetType === 2 ? collectionHandlers : baseHandlers);
		proxyMap.set(target, proxy);
		return proxy;
	}
	function isReactive(value) {
		if (isReadonly(value)) return isReactive(value["__v_raw"]);
		return !!(value && value["__v_isReactive"]);
	}
	function isReadonly(value) {
		return !!(value && value["__v_isReadonly"]);
	}
	function isShallow(value) {
		return !!(value && value["__v_isShallow"]);
	}
	function isProxy(value) {
		return value ? !!value["__v_raw"] : false;
	}
	function toRaw(observed) {
		const raw = observed && observed["__v_raw"];
		return raw ? toRaw(raw) : observed;
	}
	function markRaw(value) {
		if (!hasOwn(value, "__v_skip") && Object.isExtensible(value)) def(value, "__v_skip", true);
		return value;
	}
	var toReactive = (value) => isObject$1(value) ? reactive(value) : value;
	var toReadonly = (value) => isObject$1(value) ? readonly(value) : value;
	function isRef(r) {
		return r ? r["__v_isRef"] === true : false;
	}
	function ref(value) {
		return createRef(value, false);
	}
	function shallowRef(value) {
		return createRef(value, true);
	}
	function createRef(rawValue, shallow) {
		if (isRef(rawValue)) return rawValue;
		return new RefImpl(rawValue, shallow);
	}
	var RefImpl = class {
		constructor(value, isShallow2) {
			this.dep = new Dep();
			this["__v_isRef"] = true;
			this["__v_isShallow"] = false;
			this._rawValue = isShallow2 ? value : toRaw(value);
			this._value = isShallow2 ? value : toReactive(value);
			this["__v_isShallow"] = isShallow2;
		}
		get value() {
			this.dep.track();
			return this._value;
		}
		set value(newValue) {
			const oldValue = this._rawValue;
			const useDirectValue = this["__v_isShallow"] || isShallow(newValue) || isReadonly(newValue);
			newValue = useDirectValue ? newValue : toRaw(newValue);
			if (hasChanged(newValue, oldValue)) {
				this._rawValue = newValue;
				this._value = useDirectValue ? newValue : toReactive(newValue);
				this.dep.trigger();
			}
		}
	};
	function unref(ref2) {
		return isRef(ref2) ? ref2.value : ref2;
	}
	function toValue$1(source) {
		return isFunction(source) ? source() : unref(source);
	}
	var shallowUnwrapHandlers = {
		get: (target, key, receiver) => key === "__v_raw" ? target : unref(Reflect.get(target, key, receiver)),
		set: (target, key, value, receiver) => {
			const oldValue = target[key];
			if (isRef(oldValue) && !isRef(value)) {
				oldValue.value = value;
				return true;
			} else return Reflect.set(target, key, value, receiver);
		}
	};
	function proxyRefs(objectWithRefs) {
		return isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
	}
	var CustomRefImpl = class {
		constructor(factory) {
			this["__v_isRef"] = true;
			this._value = void 0;
			const dep = this.dep = new Dep();
			const { get, set } = factory(dep.track.bind(dep), dep.trigger.bind(dep));
			this._get = get;
			this._set = set;
		}
		get value() {
			return this._value = this._get();
		}
		set value(newVal) {
			this._set(newVal);
		}
	};
	function customRef(factory) {
		return new CustomRefImpl(factory);
	}
	var ObjectRefImpl = class {
		constructor(_object, key, _defaultValue) {
			this._object = _object;
			this._defaultValue = _defaultValue;
			this["__v_isRef"] = true;
			this._value = void 0;
			this._key = isSymbol(key) ? key : String(key);
			this._raw = toRaw(_object);
			let shallow = true;
			let obj = _object;
			if (!isArray(_object) || isSymbol(this._key) || !isIntegerKey(this._key)) do
				shallow = !isProxy(obj) || isShallow(obj);
			while (shallow && (obj = obj["__v_raw"]));
			this._shallow = shallow;
		}
		get value() {
			let val = this._object[this._key];
			if (this._shallow) val = unref(val);
			return this._value = val === void 0 ? this._defaultValue : val;
		}
		set value(newVal) {
			if (this._shallow && isRef(this._raw[this._key])) {
				const nestedRef = this._object[this._key];
				if (isRef(nestedRef)) {
					nestedRef.value = newVal;
					return;
				}
			}
			this._object[this._key] = newVal;
		}
		get dep() {
			return getDepFromReactive(this._raw, this._key);
		}
	};
	var GetterRefImpl = class {
		constructor(_getter) {
			this._getter = _getter;
			this["__v_isRef"] = true;
			this["__v_isReadonly"] = true;
			this._value = void 0;
		}
		get value() {
			return this._value = this._getter();
		}
	};
	function toRef$1(source, key, defaultValue) {
		if (isRef(source)) return source;
		else if (isFunction(source)) return new GetterRefImpl(source);
		else if (isObject$1(source) && arguments.length > 1) return propertyToRef(source, key, defaultValue);
		else return ref(source);
	}
	function propertyToRef(source, key, defaultValue) {
		return new ObjectRefImpl(source, key, defaultValue);
	}
	var ComputedRefImpl = class {
		constructor(fn, setter, isSSR) {
			this.fn = fn;
			this.setter = setter;
			this._value = void 0;
			this.dep = new Dep(this);
			this.__v_isRef = true;
			this.deps = void 0;
			this.depsTail = void 0;
			this.flags = 16;
			this.globalVersion = globalVersion - 1;
			this.next = void 0;
			this.effect = this;
			this["__v_isReadonly"] = !setter;
			this.isSSR = isSSR;
		}
		notify() {
			this.flags |= 16;
			if (!(this.flags & 8) && activeSub !== this) {
				batch(this, true);
				return true;
			}
		}
		get value() {
			const link = this.dep.track();
			refreshComputed(this);
			if (link) link.version = this.dep.version;
			return this._value;
		}
		set value(newValue) {
			if (this.setter) this.setter(newValue);
		}
	};
	function computed$1(getterOrOptions, debugOptions, isSSR = false) {
		let getter;
		let setter;
		if (isFunction(getterOrOptions)) getter = getterOrOptions;
		else {
			getter = getterOrOptions.get;
			setter = getterOrOptions.set;
		}
		return new ComputedRefImpl(getter, setter, isSSR);
	}
	var INITIAL_WATCHER_VALUE = {};
	var cleanupMap = new WeakMap();
	var activeWatcher = void 0;
	function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
		if (owner) {
			let cleanups = cleanupMap.get(owner);
			if (!cleanups) cleanupMap.set(owner, cleanups = []);
			cleanups.push(cleanupFn);
		}
	}
	function watch$1(source, cb, options = EMPTY_OBJ) {
		const { immediate, deep, once, scheduler, augmentJob, call } = options;
		const reactiveGetter = (source2) => {
			if (deep) return source2;
			if (isShallow(source2) || deep === false || deep === 0) return traverse(source2, 1);
			return traverse(source2);
		};
		let effect;
		let getter;
		let cleanup;
		let boundCleanup;
		let forceTrigger = false;
		let isMultiSource = false;
		if (isRef(source)) {
			getter = () => source.value;
			forceTrigger = isShallow(source);
		} else if (isReactive(source)) {
			getter = () => reactiveGetter(source);
			forceTrigger = true;
		} else if (isArray(source)) {
			isMultiSource = true;
			forceTrigger = source.some((s) => isReactive(s) || isShallow(s));
			getter = () => source.map((s) => {
				if (isRef(s)) return s.value;
				else if (isReactive(s)) return reactiveGetter(s);
				else if (isFunction(s)) return call ? call(s, 2) : s();
			});
		} else if (isFunction(source)) if (cb) getter = call ? () => call(source, 2) : source;
		else getter = () => {
			if (cleanup) {
				pauseTracking();
				try {
					cleanup();
				} finally {
					resetTracking();
				}
			}
			const currentEffect = activeWatcher;
			activeWatcher = effect;
			try {
				return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
			} finally {
				activeWatcher = currentEffect;
			}
		};
		else getter = NOOP;
		if (cb && deep) {
			const baseGetter = getter;
			const depth = deep === true ? Infinity : deep;
			getter = () => traverse(baseGetter(), depth);
		}
		const scope = getCurrentScope();
		const watchHandle = () => {
			effect.stop();
			if (scope && scope.active) remove(scope.effects, effect);
		};
		if (once && cb) {
			const _cb = cb;
			cb = (...args) => {
				_cb(...args);
				watchHandle();
			};
		}
		let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
		const job = (immediateFirstRun) => {
			if (!(effect.flags & 1) || !effect.dirty && !immediateFirstRun) return;
			if (cb) {
				const newValue = effect.run();
				if (deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue))) {
					if (cleanup) cleanup();
					const currentWatcher = activeWatcher;
					activeWatcher = effect;
					try {
						const args = [
							newValue,
							oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
							boundCleanup
						];
						oldValue = newValue;
						call ? call(cb, 3, args) : cb(...args);
					} finally {
						activeWatcher = currentWatcher;
					}
				}
			} else effect.run();
		};
		if (augmentJob) augmentJob(job);
		effect = new ReactiveEffect(getter);
		effect.scheduler = scheduler ? () => scheduler(job, false) : job;
		boundCleanup = (fn) => onWatcherCleanup(fn, false, effect);
		cleanup = effect.onStop = () => {
			const cleanups = cleanupMap.get(effect);
			if (cleanups) {
				if (call) call(cleanups, 4);
				else for (const cleanup2 of cleanups) cleanup2();
				cleanupMap.delete(effect);
			}
		};
		if (cb) if (immediate) job(true);
		else oldValue = effect.run();
		else if (scheduler) scheduler(job.bind(null, true), true);
		else effect.run();
		watchHandle.pause = effect.pause.bind(effect);
		watchHandle.resume = effect.resume.bind(effect);
		watchHandle.stop = watchHandle;
		return watchHandle;
	}
	function traverse(value, depth = Infinity, seen) {
		if (depth <= 0 || !isObject$1(value) || value["__v_skip"]) return value;
		seen = seen || new Map();
		if ((seen.get(value) || 0) >= depth) return value;
		seen.set(value, depth);
		depth--;
		if (isRef(value)) traverse(value.value, depth, seen);
		else if (isArray(value)) for (let i = 0; i < value.length; i++) traverse(value[i], depth, seen);
		else if (isSet(value) || isMap(value)) value.forEach((v) => {
			traverse(v, depth, seen);
		});
		else if (isPlainObject(value)) {
			for (const key in value) traverse(value[key], depth, seen);
			for (const key of Object.getOwnPropertySymbols(value)) if (Object.prototype.propertyIsEnumerable.call(value, key)) traverse(value[key], depth, seen);
		}
		return value;
	}
	function callWithErrorHandling(fn, instance, type, args) {
		try {
			return args ? fn(...args) : fn();
		} catch (err) {
			handleError(err, instance, type);
		}
	}
	function callWithAsyncErrorHandling(fn, instance, type, args) {
		if (isFunction(fn)) {
			const res = callWithErrorHandling(fn, instance, type, args);
			if (res && isPromise(res)) res.catch((err) => {
				handleError(err, instance, type);
			});
			return res;
		}
		if (isArray(fn)) {
			const values = [];
			for (let i = 0; i < fn.length; i++) values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
			return values;
		}
	}
	function handleError(err, instance, type, throwInDev = true) {
		const contextVNode = instance ? instance.vnode : null;
		const { errorHandler, throwUnhandledErrorInProduction } = instance && instance.appContext.config || EMPTY_OBJ;
		if (instance) {
			let cur = instance.parent;
			const exposedInstance = instance.proxy;
			const errorInfo = `https://vuejs.org/error-reference/#runtime-${type}`;
			while (cur) {
				const errorCapturedHooks = cur.ec;
				if (errorCapturedHooks) {
					for (let i = 0; i < errorCapturedHooks.length; i++) if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) return;
				}
				cur = cur.parent;
			}
			if (errorHandler) {
				pauseTracking();
				callWithErrorHandling(errorHandler, null, 10, [
					err,
					exposedInstance,
					errorInfo
				]);
				resetTracking();
				return;
			}
		}
		logError(err, type, contextVNode, throwInDev, throwUnhandledErrorInProduction);
	}
	function logError(err, type, contextVNode, throwInDev = true, throwInProd = false) {
		if (throwInProd) throw err;
		else console.error(err);
	}
	var queue = [];
	var flushIndex = -1;
	var pendingPostFlushCbs = [];
	var activePostFlushCbs = null;
	var postFlushIndex = 0;
	var resolvedPromise = Promise.resolve();
	var currentFlushPromise = null;
	function nextTick(fn) {
		const p = currentFlushPromise || resolvedPromise;
		return fn ? p.then(this ? fn.bind(this) : fn) : p;
	}
	function findInsertionIndex(id) {
		let start = flushIndex + 1;
		let end = queue.length;
		while (start < end) {
			const middle = start + end >>> 1;
			const middleJob = queue[middle];
			const middleJobId = getId(middleJob);
			if (middleJobId < id || middleJobId === id && middleJob.flags & 2) start = middle + 1;
			else end = middle;
		}
		return start;
	}
	function queueJob(job) {
		if (!(job.flags & 1)) {
			const jobId = getId(job);
			const lastJob = queue[queue.length - 1];
			if (!lastJob || !(job.flags & 2) && jobId >= getId(lastJob)) queue.push(job);
			else queue.splice(findInsertionIndex(jobId), 0, job);
			job.flags |= 1;
			queueFlush();
		}
	}
	function queueFlush() {
		if (!currentFlushPromise) currentFlushPromise = resolvedPromise.then(flushJobs);
	}
	function queuePostFlushCb(cb) {
		if (!isArray(cb)) {
			if (activePostFlushCbs && cb.id === -1) activePostFlushCbs.splice(postFlushIndex + 1, 0, cb);
			else if (!(cb.flags & 1)) {
				pendingPostFlushCbs.push(cb);
				cb.flags |= 1;
			}
		} else pendingPostFlushCbs.push(...cb);
		queueFlush();
	}
	function flushPreFlushCbs(instance, seen, i = flushIndex + 1) {
		for (; i < queue.length; i++) {
			const cb = queue[i];
			if (cb && cb.flags & 2) {
				if (instance && cb.id !== instance.uid) continue;
				queue.splice(i, 1);
				i--;
				if (cb.flags & 4) cb.flags &= -2;
				cb();
				if (!(cb.flags & 4)) cb.flags &= -2;
			}
		}
	}
	function flushPostFlushCbs(seen) {
		if (pendingPostFlushCbs.length) {
			const deduped = [...new Set(pendingPostFlushCbs)].sort((a, b) => getId(a) - getId(b));
			pendingPostFlushCbs.length = 0;
			if (activePostFlushCbs) {
				activePostFlushCbs.push(...deduped);
				return;
			}
			activePostFlushCbs = deduped;
			for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
				const cb = activePostFlushCbs[postFlushIndex];
				if (cb.flags & 4) cb.flags &= -2;
				if (!(cb.flags & 8)) cb();
				cb.flags &= -2;
			}
			activePostFlushCbs = null;
			postFlushIndex = 0;
		}
	}
	var getId = (job) => job.id == null ? job.flags & 2 ? -1 : Infinity : job.id;
	function flushJobs(seen) {
		try {
			for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
				const job = queue[flushIndex];
				if (job && !(job.flags & 8)) {
					if (job.flags & 4) job.flags &= -2;
					callWithErrorHandling(job, job.i, job.i ? 15 : 14);
					if (!(job.flags & 4)) job.flags &= -2;
				}
			}
		} finally {
			for (; flushIndex < queue.length; flushIndex++) {
				const job = queue[flushIndex];
				if (job) job.flags &= -2;
			}
			flushIndex = -1;
			queue.length = 0;
			flushPostFlushCbs(seen);
			currentFlushPromise = null;
			if (queue.length || pendingPostFlushCbs.length) flushJobs(seen);
		}
	}
	var currentRenderingInstance = null;
	var currentScopeId = null;
	function setCurrentRenderingInstance(instance) {
		const prev = currentRenderingInstance;
		currentRenderingInstance = instance;
		currentScopeId = instance && instance.type.__scopeId || null;
		return prev;
	}
	function withCtx(fn, ctx = currentRenderingInstance, isNonScopedSlot) {
		if (!ctx) return fn;
		if (fn._n) return fn;
		const renderFnWithContext = (...args) => {
			if (renderFnWithContext._d) setBlockTracking(-1);
			const prevInstance = setCurrentRenderingInstance(ctx);
			let res;
			try {
				res = fn(...args);
			} finally {
				setCurrentRenderingInstance(prevInstance);
				if (renderFnWithContext._d) setBlockTracking(1);
			}
			return res;
		};
		renderFnWithContext._n = true;
		renderFnWithContext._c = true;
		renderFnWithContext._d = true;
		return renderFnWithContext;
	}
	function withDirectives(vnode, directives) {
		if (currentRenderingInstance === null) return vnode;
		const instance = getComponentPublicInstance(currentRenderingInstance);
		const bindings = vnode.dirs || (vnode.dirs = []);
		for (let i = 0; i < directives.length; i++) {
			let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i];
			if (dir) {
				if (isFunction(dir)) dir = {
					mounted: dir,
					updated: dir
				};
				if (dir.deep) traverse(value);
				bindings.push({
					dir,
					instance,
					value,
					oldValue: void 0,
					arg,
					modifiers
				});
			}
		}
		return vnode;
	}
	function invokeDirectiveHook(vnode, prevVNode, instance, name) {
		const bindings = vnode.dirs;
		const oldBindings = prevVNode && prevVNode.dirs;
		for (let i = 0; i < bindings.length; i++) {
			const binding = bindings[i];
			if (oldBindings) binding.oldValue = oldBindings[i].value;
			let hook = binding.dir[name];
			if (hook) {
				pauseTracking();
				callWithAsyncErrorHandling(hook, instance, 8, [
					vnode.el,
					binding,
					vnode,
					prevVNode
				]);
				resetTracking();
			}
		}
	}
	function provide(key, value) {
		if (currentInstance) {
			let provides = currentInstance.provides;
			const parentProvides = currentInstance.parent && currentInstance.parent.provides;
			if (parentProvides === provides) provides = currentInstance.provides = Object.create(parentProvides);
			provides[key] = value;
		}
	}
	function inject(key, defaultValue, treatDefaultAsFactory = false) {
		const instance = getCurrentInstance();
		if (instance || currentApp) {
			let provides = currentApp ? currentApp._context.provides : instance ? instance.parent == null || instance.ce ? instance.vnode.appContext && instance.vnode.appContext.provides : instance.parent.provides : void 0;
			if (provides && key in provides) return provides[key];
			else if (arguments.length > 1) return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
		}
	}
	var ssrContextKey = Symbol.for("v-scx");
	var useSSRContext = () => {
		{
			const ctx = inject(ssrContextKey);
			if (!ctx) {}
			return ctx;
		}
	};
	function watch(source, cb, options) {
		return doWatch(source, cb, options);
	}
	function doWatch(source, cb, options = EMPTY_OBJ) {
		const { immediate, deep, flush, once } = options;
		const baseWatchOptions = extend$1({}, options);
		const runsImmediately = cb && immediate || !cb && flush !== "post";
		let ssrCleanup;
		if (isInSSRComponentSetup) {
			if (flush === "sync") {
				const ctx = useSSRContext();
				ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = []);
			} else if (!runsImmediately) {
				const watchStopHandle = () => {};
				watchStopHandle.stop = NOOP;
				watchStopHandle.resume = NOOP;
				watchStopHandle.pause = NOOP;
				return watchStopHandle;
			}
		}
		const instance = currentInstance;
		baseWatchOptions.call = (fn, type, args) => callWithAsyncErrorHandling(fn, instance, type, args);
		let isPre = false;
		if (flush === "post") baseWatchOptions.scheduler = (job) => {
			queuePostRenderEffect(job, instance && instance.suspense);
		};
		else if (flush !== "sync") {
			isPre = true;
			baseWatchOptions.scheduler = (job, isFirstRun) => {
				if (isFirstRun) job();
				else queueJob(job);
			};
		}
		baseWatchOptions.augmentJob = (job) => {
			if (cb) job.flags |= 4;
			if (isPre) {
				job.flags |= 2;
				if (instance) {
					job.id = instance.uid;
					job.i = instance;
				}
			}
		};
		const watchHandle = watch$1(source, cb, baseWatchOptions);
		if (isInSSRComponentSetup) {
			if (ssrCleanup) ssrCleanup.push(watchHandle);
			else if (runsImmediately) watchHandle();
		}
		return watchHandle;
	}
	function instanceWatch(source, value, options) {
		const publicThis = this.proxy;
		const getter = isString(source) ? source.includes(".") ? createPathGetter(publicThis, source) : () => publicThis[source] : source.bind(publicThis, publicThis);
		let cb;
		if (isFunction(value)) cb = value;
		else {
			cb = value.handler;
			options = value;
		}
		const reset = setCurrentInstance(this);
		const res = doWatch(getter, cb.bind(publicThis), options);
		reset();
		return res;
	}
	function createPathGetter(ctx, path) {
		const segments = path.split(".");
		return () => {
			let cur = ctx;
			for (let i = 0; i < segments.length && cur; i++) cur = cur[segments[i]];
			return cur;
		};
	}
	var pendingMounts = new WeakMap();
	var TeleportEndKey = Symbol("_vte");
	var isTeleport = (type) => type.__isTeleport;
	var isTeleportDisabled = (props) => props && (props.disabled || props.disabled === "");
	var isTeleportDeferred = (props) => props && (props.defer || props.defer === "");
	var isTargetSVG = (target) => typeof SVGElement !== "undefined" && target instanceof SVGElement;
	var isTargetMathML = (target) => typeof MathMLElement === "function" && target instanceof MathMLElement;
	var resolveTarget = (props, select) => {
		const targetSelector = props && props.to;
		if (isString(targetSelector)) if (!select) return null;
		else return select(targetSelector);
		else return targetSelector;
	};
	var TeleportImpl = {
		name: "Teleport",
		__isTeleport: true,
		process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals) {
			const { mc: mountChildren, pc: patchChildren, pbc: patchBlockChildren, o: { insert, querySelector, createText, createComment, parentNode } } = internals;
			const disabled = isTeleportDisabled(n2.props);
			let { dynamicChildren } = n2;
			const mount = (vnode, container2, anchor2) => {
				if (vnode.shapeFlag & 16) mountChildren(vnode.children, container2, anchor2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			};
			const mountToTarget = (vnode = n2) => {
				const disabled2 = isTeleportDisabled(vnode.props);
				const target = vnode.target = resolveTarget(vnode.props, querySelector);
				const targetAnchor = prepareAnchor(target, vnode, createText, insert);
				if (target) {
					if (namespace !== "svg" && isTargetSVG(target)) namespace = "svg";
					else if (namespace !== "mathml" && isTargetMathML(target)) namespace = "mathml";
					if (parentComponent && parentComponent.isCE) (parentComponent.ce._teleportTargets || (parentComponent.ce._teleportTargets = new Set())).add(target);
					if (!disabled2) {
						mount(vnode, target, targetAnchor);
						updateCssVars(vnode, false);
					}
				}
			};
			const queuePendingMount = (vnode) => {
				const mountJob = () => {
					if (pendingMounts.get(vnode) !== mountJob) return;
					pendingMounts.delete(vnode);
					if (isTeleportDisabled(vnode.props)) {
						mount(vnode, parentNode(vnode.el) || container, vnode.anchor);
						updateCssVars(vnode, true);
					}
					mountToTarget(vnode);
				};
				pendingMounts.set(vnode, mountJob);
				queuePostRenderEffect(mountJob, parentSuspense);
			};
			if (n1 == null) {
				const placeholder = n2.el = createText("");
				const mainAnchor = n2.anchor = createText("");
				insert(placeholder, container, anchor);
				insert(mainAnchor, container, anchor);
				if (isTeleportDeferred(n2.props) || parentSuspense && parentSuspense.pendingBranch) {
					queuePendingMount(n2);
					return;
				}
				if (disabled) {
					mount(n2, container, mainAnchor);
					updateCssVars(n2, true);
				}
				mountToTarget();
			} else {
				n2.el = n1.el;
				const mainAnchor = n2.anchor = n1.anchor;
				const pendingMount = pendingMounts.get(n1);
				if (pendingMount) {
					pendingMount.flags |= 8;
					pendingMounts.delete(n1);
					queuePendingMount(n2);
					return;
				}
				n2.targetStart = n1.targetStart;
				const target = n2.target = n1.target;
				const targetAnchor = n2.targetAnchor = n1.targetAnchor;
				const wasDisabled = isTeleportDisabled(n1.props);
				const currentContainer = wasDisabled ? container : target;
				const currentAnchor = wasDisabled ? mainAnchor : targetAnchor;
				if (namespace === "svg" || isTargetSVG(target)) namespace = "svg";
				else if (namespace === "mathml" || isTargetMathML(target)) namespace = "mathml";
				if (dynamicChildren) {
					patchBlockChildren(n1.dynamicChildren, dynamicChildren, currentContainer, parentComponent, parentSuspense, namespace, slotScopeIds);
					traverseStaticChildren(n1, n2, true);
				} else if (!optimized) patchChildren(n1, n2, currentContainer, currentAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, false);
				if (disabled) {
					if (!wasDisabled) moveTeleport(n2, container, mainAnchor, internals, 1);
					else if (n2.props && n1.props && n2.props.to !== n1.props.to) n2.props.to = n1.props.to;
				} else if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
					const nextTarget = n2.target = resolveTarget(n2.props, querySelector);
					if (nextTarget) moveTeleport(n2, nextTarget, null, internals, 0);
				} else if (wasDisabled) moveTeleport(n2, target, targetAnchor, internals, 1);
				updateCssVars(n2, disabled);
			}
		},
		remove(vnode, parentComponent, parentSuspense, { um: unmount, o: { remove: hostRemove } }, doRemove) {
			const { shapeFlag, children, anchor, targetStart, targetAnchor, target, props } = vnode;
			let shouldRemove = doRemove || !isTeleportDisabled(props);
			const pendingMount = pendingMounts.get(vnode);
			if (pendingMount) {
				pendingMount.flags |= 8;
				pendingMounts.delete(vnode);
				shouldRemove = false;
			}
			if (target) {
				hostRemove(targetStart);
				hostRemove(targetAnchor);
			}
			doRemove && hostRemove(anchor);
			if (shapeFlag & 16) for (let i = 0; i < children.length; i++) {
				const child = children[i];
				unmount(child, parentComponent, parentSuspense, shouldRemove, !!child.dynamicChildren);
			}
		},
		move: moveTeleport,
		hydrate: hydrateTeleport
	};
	function moveTeleport(vnode, container, parentAnchor, { o: { insert }, m: move }, moveType = 2) {
		if (moveType === 0) insert(vnode.targetAnchor, container, parentAnchor);
		const { el, anchor, shapeFlag, children, props } = vnode;
		const isReorder = moveType === 2;
		if (isReorder) insert(el, container, parentAnchor);
		if (!pendingMounts.has(vnode) && (!isReorder || isTeleportDisabled(props))) {
			if (shapeFlag & 16) for (let i = 0; i < children.length; i++) move(children[i], container, parentAnchor, 2);
		}
		if (isReorder) insert(anchor, container, parentAnchor);
	}
	function hydrateTeleport(node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized, { o: { nextSibling, parentNode, querySelector, insert, createText } }, hydrateChildren) {
		function hydrateAnchor(target2, targetNode) {
			let targetAnchor = targetNode;
			while (targetAnchor) {
				if (targetAnchor && targetAnchor.nodeType === 8) {
					if (targetAnchor.data === "teleport start anchor") vnode.targetStart = targetAnchor;
					else if (targetAnchor.data === "teleport anchor") {
						vnode.targetAnchor = targetAnchor;
						target2._lpa = vnode.targetAnchor && nextSibling(vnode.targetAnchor);
						break;
					}
				}
				targetAnchor = nextSibling(targetAnchor);
			}
		}
		function hydrateDisabledTeleport(node2, vnode2) {
			vnode2.anchor = hydrateChildren(nextSibling(node2), vnode2, parentNode(node2), parentComponent, parentSuspense, slotScopeIds, optimized);
		}
		const target = vnode.target = resolveTarget(vnode.props, querySelector);
		const disabled = isTeleportDisabled(vnode.props);
		if (target) {
			const targetNode = target._lpa || target.firstChild;
			if (vnode.shapeFlag & 16) if (disabled) {
				hydrateDisabledTeleport(node, vnode);
				hydrateAnchor(target, targetNode);
				if (!vnode.targetAnchor) prepareAnchor(target, vnode, createText, insert, parentNode(node) === target ? node : null);
			} else {
				vnode.anchor = nextSibling(node);
				hydrateAnchor(target, targetNode);
				if (!vnode.targetAnchor) prepareAnchor(target, vnode, createText, insert);
				hydrateChildren(targetNode && nextSibling(targetNode), vnode, target, parentComponent, parentSuspense, slotScopeIds, optimized);
			}
			updateCssVars(vnode, disabled);
		} else if (disabled) {
			if (vnode.shapeFlag & 16) {
				hydrateDisabledTeleport(node, vnode);
				vnode.targetStart = node;
				vnode.targetAnchor = nextSibling(node);
			}
		}
		return vnode.anchor && nextSibling(vnode.anchor);
	}
	var Teleport = TeleportImpl;
	function updateCssVars(vnode, isDisabled) {
		const ctx = vnode.ctx;
		if (ctx && ctx.ut) {
			let node, anchor;
			if (isDisabled) {
				node = vnode.el;
				anchor = vnode.anchor;
			} else {
				node = vnode.targetStart;
				anchor = vnode.targetAnchor;
			}
			while (node && node !== anchor) {
				if (node.nodeType === 1) node.setAttribute("data-v-owner", ctx.uid);
				node = node.nextSibling;
			}
			ctx.ut();
		}
	}
	function prepareAnchor(target, vnode, createText, insert, anchor = null) {
		const targetStart = vnode.targetStart = createText("");
		const targetAnchor = vnode.targetAnchor = createText("");
		targetStart[TeleportEndKey] = targetAnchor;
		if (target) {
			insert(targetStart, target, anchor);
			insert(targetAnchor, target, anchor);
		}
		return targetAnchor;
	}
	var leaveCbKey = Symbol("_leaveCb");
	var enterCbKey$1 = Symbol("_enterCb");
	function useTransitionState() {
		const state = {
			isMounted: false,
			isLeaving: false,
			isUnmounting: false,
			leavingVNodes: new Map()
		};
		onMounted(() => {
			state.isMounted = true;
		});
		onBeforeUnmount(() => {
			state.isUnmounting = true;
		});
		return state;
	}
	var TransitionHookValidator = [Function, Array];
	var BaseTransitionPropsValidators = {
		mode: String,
		appear: Boolean,
		persisted: Boolean,
		onBeforeEnter: TransitionHookValidator,
		onEnter: TransitionHookValidator,
		onAfterEnter: TransitionHookValidator,
		onEnterCancelled: TransitionHookValidator,
		onBeforeLeave: TransitionHookValidator,
		onLeave: TransitionHookValidator,
		onAfterLeave: TransitionHookValidator,
		onLeaveCancelled: TransitionHookValidator,
		onBeforeAppear: TransitionHookValidator,
		onAppear: TransitionHookValidator,
		onAfterAppear: TransitionHookValidator,
		onAppearCancelled: TransitionHookValidator
	};
	function getLeavingNodesForType(state, vnode) {
		const { leavingVNodes } = state;
		let leavingVNodesCache = leavingVNodes.get(vnode.type);
		if (!leavingVNodesCache) {
			leavingVNodesCache = Object.create(null);
			leavingVNodes.set(vnode.type, leavingVNodesCache);
		}
		return leavingVNodesCache;
	}
	function resolveTransitionHooks(vnode, props, state, instance, postClone) {
		const { appear, mode, persisted = false, onBeforeEnter, onEnter, onAfterEnter, onEnterCancelled, onBeforeLeave, onLeave, onAfterLeave, onLeaveCancelled, onBeforeAppear, onAppear, onAfterAppear, onAppearCancelled } = props;
		const key = String(vnode.key);
		const leavingVNodesCache = getLeavingNodesForType(state, vnode);
		const callHook = (hook, args) => {
			hook && callWithAsyncErrorHandling(hook, instance, 9, args);
		};
		const callAsyncHook = (hook, args) => {
			const done = args[1];
			callHook(hook, args);
			if (isArray(hook)) {
				if (hook.every((hook2) => hook2.length <= 1)) done();
			} else if (hook.length <= 1) done();
		};
		const hooks = {
			mode,
			persisted,
			beforeEnter(el) {
				let hook = onBeforeEnter;
				if (!state.isMounted) if (appear) hook = onBeforeAppear || onBeforeEnter;
				else return;
				if (el[leaveCbKey]) el[leaveCbKey](true);
				const leavingVNode = leavingVNodesCache[key];
				if (leavingVNode && isSameVNodeType(vnode, leavingVNode) && leavingVNode.el[leaveCbKey]) leavingVNode.el[leaveCbKey]();
				callHook(hook, [el]);
			},
			enter(el) {
				if (leavingVNodesCache[key] === vnode) return;
				let hook = onEnter;
				let afterHook = onAfterEnter;
				let cancelHook = onEnterCancelled;
				if (!state.isMounted) if (appear) {
					hook = onAppear || onEnter;
					afterHook = onAfterAppear || onAfterEnter;
					cancelHook = onAppearCancelled || onEnterCancelled;
				} else return;
				let called = false;
				el[enterCbKey$1] = (cancelled) => {
					if (called) return;
					called = true;
					if (cancelled) callHook(cancelHook, [el]);
					else callHook(afterHook, [el]);
					if (hooks.delayedLeave) hooks.delayedLeave();
					el[enterCbKey$1] = void 0;
				};
				const done = el[enterCbKey$1].bind(null, false);
				if (hook) callAsyncHook(hook, [el, done]);
				else done();
			},
			leave(el, remove) {
				const key2 = String(vnode.key);
				if (el[enterCbKey$1]) el[enterCbKey$1](true);
				if (state.isUnmounting) return remove();
				callHook(onBeforeLeave, [el]);
				let called = false;
				el[leaveCbKey] = (cancelled) => {
					if (called) return;
					called = true;
					remove();
					if (cancelled) callHook(onLeaveCancelled, [el]);
					else callHook(onAfterLeave, [el]);
					el[leaveCbKey] = void 0;
					if (leavingVNodesCache[key2] === vnode) delete leavingVNodesCache[key2];
				};
				const done = el[leaveCbKey].bind(null, false);
				leavingVNodesCache[key2] = vnode;
				if (onLeave) callAsyncHook(onLeave, [el, done]);
				else done();
			},
			clone(vnode2) {
				const hooks2 = resolveTransitionHooks(vnode2, props, state, instance, postClone);
				if (postClone) postClone(hooks2);
				return hooks2;
			}
		};
		return hooks;
	}
	function setTransitionHooks(vnode, hooks) {
		if (vnode.shapeFlag & 6 && vnode.component) {
			vnode.transition = hooks;
			setTransitionHooks(vnode.component.subTree, hooks);
		} else if (vnode.shapeFlag & 128) {
			vnode.ssContent.transition = hooks.clone(vnode.ssContent);
			vnode.ssFallback.transition = hooks.clone(vnode.ssFallback);
		} else vnode.transition = hooks;
	}
	function getTransitionRawChildren(children, keepComment = false, parentKey) {
		let ret = [];
		let keyedFragmentCount = 0;
		for (let i = 0; i < children.length; i++) {
			let child = children[i];
			const key = parentKey == null ? child.key : String(parentKey) + String(child.key != null ? child.key : i);
			if (child.type === Fragment) {
				if (child.patchFlag & 128) keyedFragmentCount++;
				ret = ret.concat(getTransitionRawChildren(child.children, keepComment, key));
			} else if (keepComment || child.type !== Comment) ret.push(key != null ? cloneVNode(child, { key }) : child);
		}
		if (keyedFragmentCount > 1) for (let i = 0; i < ret.length; i++) ret[i].patchFlag = -2;
		return ret;
	}
	function defineComponent(options, extraOptions) {
		return isFunction(options) ? extend$1({ name: options.name }, extraOptions, { setup: options }) : options;
	}
	function markAsyncBoundary(instance) {
		instance.ids = [
			instance.ids[0] + instance.ids[2]++ + "-",
			0,
			0
		];
	}
	function isTemplateRefKey(refs, key) {
		let desc;
		return !!((desc = Object.getOwnPropertyDescriptor(refs, key)) && !desc.configurable);
	}
	var pendingSetRefMap = new WeakMap();
	function setRef(rawRef, oldRawRef, parentSuspense, vnode, isUnmount = false) {
		if (isArray(rawRef)) {
			rawRef.forEach((r, i) => setRef(r, oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef), parentSuspense, vnode, isUnmount));
			return;
		}
		if (isAsyncWrapper(vnode) && !isUnmount) {
			if (vnode.shapeFlag & 512 && vnode.type.__asyncResolved && vnode.component.subTree.component) setRef(rawRef, oldRawRef, parentSuspense, vnode.component.subTree);
			return;
		}
		const refValue = vnode.shapeFlag & 4 ? getComponentPublicInstance(vnode.component) : vnode.el;
		const value = isUnmount ? null : refValue;
		const { i: owner, r: ref } = rawRef;
		const oldRef = oldRawRef && oldRawRef.r;
		const refs = owner.refs === EMPTY_OBJ ? owner.refs = {} : owner.refs;
		const setupState = owner.setupState;
		const rawSetupState = toRaw(setupState);
		const canSetSetupRef = setupState === EMPTY_OBJ ? NO : (key) => {
			if (isTemplateRefKey(refs, key)) return false;
			return hasOwn(rawSetupState, key);
		};
		const canSetRef = (ref2, key) => {
			if (key && isTemplateRefKey(refs, key)) return false;
			return true;
		};
		if (oldRef != null && oldRef !== ref) {
			invalidatePendingSetRef(oldRawRef);
			if (isString(oldRef)) {
				refs[oldRef] = null;
				if (canSetSetupRef(oldRef)) setupState[oldRef] = null;
			} else if (isRef(oldRef)) {
				const oldRawRefAtom = oldRawRef;
				if (canSetRef(oldRef, oldRawRefAtom.k)) oldRef.value = null;
				if (oldRawRefAtom.k) refs[oldRawRefAtom.k] = null;
			}
		}
		if (isFunction(ref)) callWithErrorHandling(ref, owner, 12, [value, refs]);
		else {
			const _isString = isString(ref);
			const _isRef = isRef(ref);
			if (_isString || _isRef) {
				const doSet = () => {
					if (rawRef.f) {
						const existing = _isString ? canSetSetupRef(ref) ? setupState[ref] : refs[ref] : canSetRef(ref) || !rawRef.k ? ref.value : refs[rawRef.k];
						if (isUnmount) isArray(existing) && remove(existing, refValue);
						else if (!isArray(existing)) if (_isString) {
							refs[ref] = [refValue];
							if (canSetSetupRef(ref)) setupState[ref] = refs[ref];
						} else {
							const newVal = [refValue];
							if (canSetRef(ref, rawRef.k)) ref.value = newVal;
							if (rawRef.k) refs[rawRef.k] = newVal;
						}
						else if (!existing.includes(refValue)) existing.push(refValue);
					} else if (_isString) {
						refs[ref] = value;
						if (canSetSetupRef(ref)) setupState[ref] = value;
					} else if (_isRef) {
						if (canSetRef(ref, rawRef.k)) ref.value = value;
						if (rawRef.k) refs[rawRef.k] = value;
					}
				};
				if (value) {
					const job = () => {
						doSet();
						pendingSetRefMap.delete(rawRef);
					};
					job.id = -1;
					pendingSetRefMap.set(rawRef, job);
					queuePostRenderEffect(job, parentSuspense);
				} else {
					invalidatePendingSetRef(rawRef);
					doSet();
				}
			}
		}
	}
	function invalidatePendingSetRef(rawRef) {
		const pendingSetRef = pendingSetRefMap.get(rawRef);
		if (pendingSetRef) {
			pendingSetRef.flags |= 8;
			pendingSetRefMap.delete(rawRef);
		}
	}
	getGlobalThis().requestIdleCallback;
	getGlobalThis().cancelIdleCallback;
	var isAsyncWrapper = (i) => !!i.type.__asyncLoader;
	var isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
	function onActivated(hook, target) {
		registerKeepAliveHook(hook, "a", target);
	}
	function onDeactivated(hook, target) {
		registerKeepAliveHook(hook, "da", target);
	}
	function registerKeepAliveHook(hook, type, target = currentInstance) {
		const wrappedHook = hook.__wdc || (hook.__wdc = () => {
			let current = target;
			while (current) {
				if (current.isDeactivated) return;
				current = current.parent;
			}
			return hook();
		});
		injectHook(type, wrappedHook, target);
		if (target) {
			let current = target.parent;
			while (current && current.parent) {
				if (isKeepAlive(current.parent.vnode)) injectToKeepAliveRoot(wrappedHook, type, target, current);
				current = current.parent;
			}
		}
	}
	function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
		const injected = injectHook(type, hook, keepAliveRoot, true);
		onUnmounted(() => {
			remove(keepAliveRoot[type], injected);
		}, target);
	}
	function injectHook(type, hook, target = currentInstance, prepend = false) {
		if (target) {
			const hooks = target[type] || (target[type] = []);
			const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
				pauseTracking();
				const reset = setCurrentInstance(target);
				const res = callWithAsyncErrorHandling(hook, target, type, args);
				reset();
				resetTracking();
				return res;
			});
			if (prepend) hooks.unshift(wrappedHook);
			else hooks.push(wrappedHook);
			return wrappedHook;
		}
	}
	var createHook = (lifecycle) => (hook, target = currentInstance) => {
		if (!isInSSRComponentSetup || lifecycle === "sp") injectHook(lifecycle, (...args) => hook(...args), target);
	};
	var onBeforeMount = createHook("bm");
	var onMounted = createHook("m");
	var onBeforeUpdate = createHook("bu");
	var onUpdated = createHook("u");
	var onBeforeUnmount = createHook("bum");
	var onUnmounted = createHook("um");
	var onServerPrefetch = createHook("sp");
	var onRenderTriggered = createHook("rtg");
	var onRenderTracked = createHook("rtc");
	function onErrorCaptured(hook, target = currentInstance) {
		injectHook("ec", hook, target);
	}
	var COMPONENTS = "components";
	function resolveComponent(name, maybeSelfReference) {
		return resolveAsset(COMPONENTS, name, true, maybeSelfReference) || name;
	}
	var NULL_DYNAMIC_COMPONENT = Symbol.for("v-ndc");
	function resolveDynamicComponent(component) {
		if (isString(component)) return resolveAsset(COMPONENTS, component, false) || component;
		else return component || NULL_DYNAMIC_COMPONENT;
	}
	function resolveAsset(type, name, warnMissing = true, maybeSelfReference = false) {
		const instance = currentRenderingInstance || currentInstance;
		if (instance) {
			const Component = instance.type;
			if (type === COMPONENTS) {
				const selfName = getComponentName(Component, false);
				if (selfName && (selfName === name || selfName === camelize$2(name) || selfName === capitalize(camelize$2(name)))) return Component;
			}
			const res = resolve(instance[type] || Component[type], name) || resolve(instance.appContext[type], name);
			if (!res && maybeSelfReference) return Component;
			return res;
		}
	}
	function resolve(registry, name) {
		return registry && (registry[name] || registry[camelize$2(name)] || registry[capitalize(camelize$2(name))]);
	}
	function renderList(source, renderItem, cache, index) {
		let ret;
		const cached = cache && cache[index];
		const sourceIsArray = isArray(source);
		if (sourceIsArray || isString(source)) {
			const sourceIsReactiveArray = sourceIsArray && isReactive(source);
			let needsWrap = false;
			let isReadonlySource = false;
			if (sourceIsReactiveArray) {
				needsWrap = !isShallow(source);
				isReadonlySource = isReadonly(source);
				source = shallowReadArray(source);
			}
			ret = new Array(source.length);
			for (let i = 0, l = source.length; i < l; i++) ret[i] = renderItem(needsWrap ? isReadonlySource ? toReadonly(toReactive(source[i])) : toReactive(source[i]) : source[i], i, void 0, cached && cached[i]);
		} else if (typeof source === "number") {
			ret = new Array(source);
			for (let i = 0; i < source; i++) ret[i] = renderItem(i + 1, i, void 0, cached && cached[i]);
		} else if (isObject$1(source)) if (source[Symbol.iterator]) ret = Array.from(source, (item, i) => renderItem(item, i, void 0, cached && cached[i]));
		else {
			const keys = Object.keys(source);
			ret = new Array(keys.length);
			for (let i = 0, l = keys.length; i < l; i++) {
				const key = keys[i];
				ret[i] = renderItem(source[key], key, i, cached && cached[i]);
			}
		}
		else ret = [];
		if (cache) cache[index] = ret;
		return ret;
	}
	var getPublicInstance = (i) => {
		if (!i) return null;
		if (isStatefulComponent(i)) return getComponentPublicInstance(i);
		return getPublicInstance(i.parent);
	};
	var publicPropertiesMap = extend$1(Object.create(null), {
		$: (i) => i,
		$el: (i) => i.vnode.el,
		$data: (i) => i.data,
		$props: (i) => i.props,
		$attrs: (i) => i.attrs,
		$slots: (i) => i.slots,
		$refs: (i) => i.refs,
		$parent: (i) => getPublicInstance(i.parent),
		$root: (i) => getPublicInstance(i.root),
		$host: (i) => i.ce,
		$emit: (i) => i.emit,
		$options: (i) => resolveMergedOptions(i),
		$forceUpdate: (i) => i.f || (i.f = () => {
			queueJob(i.update);
		}),
		$nextTick: (i) => i.n || (i.n = nextTick.bind(i.proxy)),
		$watch: (i) => instanceWatch.bind(i)
	});
	var hasSetupBinding = (state, key) => state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key);
	var PublicInstanceProxyHandlers = {
		get({ _: instance }, key) {
			if (key === "__v_skip") return true;
			const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
			if (key[0] !== "$") {
				const n = accessCache[key];
				if (n !== void 0) switch (n) {
					case 1: return setupState[key];
					case 2: return data[key];
					case 4: return ctx[key];
					case 3: return props[key];
				}
				else if (hasSetupBinding(setupState, key)) {
					accessCache[key] = 1;
					return setupState[key];
				} else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
					accessCache[key] = 2;
					return data[key];
				} else if (hasOwn(props, key)) {
					accessCache[key] = 3;
					return props[key];
				} else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
					accessCache[key] = 4;
					return ctx[key];
				} else if (shouldCacheAccess) accessCache[key] = 0;
			}
			const publicGetter = publicPropertiesMap[key];
			let cssModule, globalProperties;
			if (publicGetter) {
				if (key === "$attrs") track(instance.attrs, "get", "");
				return publicGetter(instance);
			} else if ((cssModule = type.__cssModules) && (cssModule = cssModule[key])) return cssModule;
			else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
				accessCache[key] = 4;
				return ctx[key];
			} else if (globalProperties = appContext.config.globalProperties, hasOwn(globalProperties, key)) return globalProperties[key];
		},
		set({ _: instance }, key, value) {
			const { data, setupState, ctx } = instance;
			if (hasSetupBinding(setupState, key)) {
				setupState[key] = value;
				return true;
			} else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
				data[key] = value;
				return true;
			} else if (hasOwn(instance.props, key)) return false;
			if (key[0] === "$" && key.slice(1) in instance) return false;
			else ctx[key] = value;
			return true;
		},
		has({ _: { data, setupState, accessCache, ctx, appContext, props, type } }, key) {
			let cssModules;
			return !!(accessCache[key] || data !== EMPTY_OBJ && key[0] !== "$" && hasOwn(data, key) || hasSetupBinding(setupState, key) || hasOwn(props, key) || hasOwn(ctx, key) || hasOwn(publicPropertiesMap, key) || hasOwn(appContext.config.globalProperties, key) || (cssModules = type.__cssModules) && cssModules[key]);
		},
		defineProperty(target, key, descriptor) {
			if (descriptor.get != null) target._.accessCache[key] = 0;
			else if (hasOwn(descriptor, "value")) this.set(target, key, descriptor.value, null);
			return Reflect.defineProperty(target, key, descriptor);
		}
	};
	function normalizePropsOrEmits(props) {
		return isArray(props) ? props.reduce((normalized, p) => (normalized[p] = null, normalized), {}) : props;
	}
	var shouldCacheAccess = true;
	function applyOptions(instance) {
		const options = resolveMergedOptions(instance);
		const publicThis = instance.proxy;
		const ctx = instance.ctx;
		shouldCacheAccess = false;
		if (options.beforeCreate) callHook$1(options.beforeCreate, instance, "bc");
		const { data: dataOptions, computed: computedOptions, methods, watch: watchOptions, provide: provideOptions, inject: injectOptions, created, beforeMount, mounted, beforeUpdate, updated, activated, deactivated, beforeDestroy, beforeUnmount, destroyed, unmounted, render, renderTracked, renderTriggered, errorCaptured, serverPrefetch, expose, inheritAttrs, components, directives, filters } = options;
		const checkDuplicateProperties = null;
		if (injectOptions) resolveInjections(injectOptions, ctx, checkDuplicateProperties);
		if (methods) for (const key in methods) {
			const methodHandler = methods[key];
			if (isFunction(methodHandler)) ctx[key] = methodHandler.bind(publicThis);
		}
		if (dataOptions) {
			const data = dataOptions.call(publicThis, publicThis);
			if (!isObject$1(data)) {} else instance.data = reactive(data);
		}
		shouldCacheAccess = true;
		if (computedOptions) for (const key in computedOptions) {
			const opt = computedOptions[key];
			const c = computed({
				get: isFunction(opt) ? opt.bind(publicThis, publicThis) : isFunction(opt.get) ? opt.get.bind(publicThis, publicThis) : NOOP,
				set: !isFunction(opt) && isFunction(opt.set) ? opt.set.bind(publicThis) : NOOP
			});
			Object.defineProperty(ctx, key, {
				enumerable: true,
				configurable: true,
				get: () => c.value,
				set: (v) => c.value = v
			});
		}
		if (watchOptions) for (const key in watchOptions) createWatcher(watchOptions[key], ctx, publicThis, key);
		if (provideOptions) {
			const provides = isFunction(provideOptions) ? provideOptions.call(publicThis) : provideOptions;
			Reflect.ownKeys(provides).forEach((key) => {
				provide(key, provides[key]);
			});
		}
		if (created) callHook$1(created, instance, "c");
		function registerLifecycleHook(register, hook) {
			if (isArray(hook)) hook.forEach((_hook) => register(_hook.bind(publicThis)));
			else if (hook) register(hook.bind(publicThis));
		}
		registerLifecycleHook(onBeforeMount, beforeMount);
		registerLifecycleHook(onMounted, mounted);
		registerLifecycleHook(onBeforeUpdate, beforeUpdate);
		registerLifecycleHook(onUpdated, updated);
		registerLifecycleHook(onActivated, activated);
		registerLifecycleHook(onDeactivated, deactivated);
		registerLifecycleHook(onErrorCaptured, errorCaptured);
		registerLifecycleHook(onRenderTracked, renderTracked);
		registerLifecycleHook(onRenderTriggered, renderTriggered);
		registerLifecycleHook(onBeforeUnmount, beforeUnmount);
		registerLifecycleHook(onUnmounted, unmounted);
		registerLifecycleHook(onServerPrefetch, serverPrefetch);
		if (isArray(expose)) {
			if (expose.length) {
				const exposed = instance.exposed || (instance.exposed = {});
				expose.forEach((key) => {
					Object.defineProperty(exposed, key, {
						get: () => publicThis[key],
						set: (val) => publicThis[key] = val,
						enumerable: true
					});
				});
			} else if (!instance.exposed) instance.exposed = {};
		}
		if (render && instance.render === NOOP) instance.render = render;
		if (inheritAttrs != null) instance.inheritAttrs = inheritAttrs;
		if (components) instance.components = components;
		if (directives) instance.directives = directives;
		if (serverPrefetch) markAsyncBoundary(instance);
	}
	function resolveInjections(injectOptions, ctx, checkDuplicateProperties = NOOP) {
		if (isArray(injectOptions)) injectOptions = normalizeInject(injectOptions);
		for (const key in injectOptions) {
			const opt = injectOptions[key];
			let injected;
			if (isObject$1(opt)) if ("default" in opt) injected = inject(opt.from || key, opt.default, true);
			else injected = inject(opt.from || key);
			else injected = inject(opt);
			if (isRef(injected)) Object.defineProperty(ctx, key, {
				enumerable: true,
				configurable: true,
				get: () => injected.value,
				set: (v) => injected.value = v
			});
			else ctx[key] = injected;
		}
	}
	function callHook$1(hook, instance, type) {
		callWithAsyncErrorHandling(isArray(hook) ? hook.map((h) => h.bind(instance.proxy)) : hook.bind(instance.proxy), instance, type);
	}
	function createWatcher(raw, ctx, publicThis, key) {
		let getter = key.includes(".") ? createPathGetter(publicThis, key) : () => publicThis[key];
		if (isString(raw)) {
			const handler = ctx[raw];
			if (isFunction(handler)) watch(getter, handler);
		} else if (isFunction(raw)) watch(getter, raw.bind(publicThis));
		else if (isObject$1(raw)) if (isArray(raw)) raw.forEach((r) => createWatcher(r, ctx, publicThis, key));
		else {
			const handler = isFunction(raw.handler) ? raw.handler.bind(publicThis) : ctx[raw.handler];
			if (isFunction(handler)) watch(getter, handler, raw);
		}
	}
	function resolveMergedOptions(instance) {
		const base = instance.type;
		const { mixins, extends: extendsOptions } = base;
		const { mixins: globalMixins, optionsCache: cache, config: { optionMergeStrategies } } = instance.appContext;
		const cached = cache.get(base);
		let resolved;
		if (cached) resolved = cached;
		else if (!globalMixins.length && !mixins && !extendsOptions) resolved = base;
		else {
			resolved = {};
			if (globalMixins.length) globalMixins.forEach((m) => mergeOptions(resolved, m, optionMergeStrategies, true));
			mergeOptions(resolved, base, optionMergeStrategies);
		}
		if (isObject$1(base)) cache.set(base, resolved);
		return resolved;
	}
	function mergeOptions(to, from, strats, asMixin = false) {
		const { mixins, extends: extendsOptions } = from;
		if (extendsOptions) mergeOptions(to, extendsOptions, strats, true);
		if (mixins) mixins.forEach((m) => mergeOptions(to, m, strats, true));
		for (const key in from) if (asMixin && key === "expose") {} else {
			const strat = internalOptionMergeStrats[key] || strats && strats[key];
			to[key] = strat ? strat(to[key], from[key]) : from[key];
		}
		return to;
	}
	var internalOptionMergeStrats = {
		data: mergeDataFn,
		props: mergeEmitsOrPropsOptions,
		emits: mergeEmitsOrPropsOptions,
		methods: mergeObjectOptions,
		computed: mergeObjectOptions,
		beforeCreate: mergeAsArray,
		created: mergeAsArray,
		beforeMount: mergeAsArray,
		mounted: mergeAsArray,
		beforeUpdate: mergeAsArray,
		updated: mergeAsArray,
		beforeDestroy: mergeAsArray,
		beforeUnmount: mergeAsArray,
		destroyed: mergeAsArray,
		unmounted: mergeAsArray,
		activated: mergeAsArray,
		deactivated: mergeAsArray,
		errorCaptured: mergeAsArray,
		serverPrefetch: mergeAsArray,
		components: mergeObjectOptions,
		directives: mergeObjectOptions,
		watch: mergeWatchOptions,
		provide: mergeDataFn,
		inject: mergeInject
	};
	function mergeDataFn(to, from) {
		if (!from) return to;
		if (!to) return from;
		return function mergedDataFn() {
			return extend$1(isFunction(to) ? to.call(this, this) : to, isFunction(from) ? from.call(this, this) : from);
		};
	}
	function mergeInject(to, from) {
		return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
	}
	function normalizeInject(raw) {
		if (isArray(raw)) {
			const res = {};
			for (let i = 0; i < raw.length; i++) res[raw[i]] = raw[i];
			return res;
		}
		return raw;
	}
	function mergeAsArray(to, from) {
		return to ? [...new Set([].concat(to, from))] : from;
	}
	function mergeObjectOptions(to, from) {
		return to ? extend$1(Object.create(null), to, from) : from;
	}
	function mergeEmitsOrPropsOptions(to, from) {
		if (to) {
			if (isArray(to) && isArray(from)) return [...new Set([...to, ...from])];
			return extend$1(Object.create(null), normalizePropsOrEmits(to), normalizePropsOrEmits(from != null ? from : {}));
		} else return from;
	}
	function mergeWatchOptions(to, from) {
		if (!to) return from;
		if (!from) return to;
		const merged = extend$1(Object.create(null), to);
		for (const key in from) merged[key] = mergeAsArray(to[key], from[key]);
		return merged;
	}
	function createAppContext() {
		return {
			app: null,
			config: {
				isNativeTag: NO,
				performance: false,
				globalProperties: {},
				optionMergeStrategies: {},
				errorHandler: void 0,
				warnHandler: void 0,
				compilerOptions: {}
			},
			mixins: [],
			components: {},
			directives: {},
			provides: Object.create(null),
			optionsCache: new WeakMap(),
			propsCache: new WeakMap(),
			emitsCache: new WeakMap()
		};
	}
	var uid$1 = 0;
	function createAppAPI(render, hydrate) {
		return function createApp(rootComponent, rootProps = null) {
			if (!isFunction(rootComponent)) rootComponent = extend$1({}, rootComponent);
			if (rootProps != null && !isObject$1(rootProps)) rootProps = null;
			const context = createAppContext();
			const installedPlugins = new WeakSet();
			const pluginCleanupFns = [];
			let isMounted = false;
			const app = context.app = {
				_uid: uid$1++,
				_component: rootComponent,
				_props: rootProps,
				_container: null,
				_context: context,
				_instance: null,
				version: version$1,
				get config() {
					return context.config;
				},
				set config(v) {},
				use(plugin, ...options) {
					if (installedPlugins.has(plugin)) {} else if (plugin && isFunction(plugin.install)) {
						installedPlugins.add(plugin);
						plugin.install(app, ...options);
					} else if (isFunction(plugin)) {
						installedPlugins.add(plugin);
						plugin(app, ...options);
					}
					return app;
				},
				mixin(mixin) {
					if (!context.mixins.includes(mixin)) context.mixins.push(mixin);
					return app;
				},
				component(name, component) {
					if (!component) return context.components[name];
					context.components[name] = component;
					return app;
				},
				directive(name, directive) {
					if (!directive) return context.directives[name];
					context.directives[name] = directive;
					return app;
				},
				mount(rootContainer, isHydrate, namespace) {
					if (!isMounted) {
						const vnode = app._ceVNode || createVNode(rootComponent, rootProps);
						vnode.appContext = context;
						if (namespace === true) namespace = "svg";
						else if (namespace === false) namespace = void 0;
						if (isHydrate && hydrate) hydrate(vnode, rootContainer);
						else render(vnode, rootContainer, namespace);
						isMounted = true;
						app._container = rootContainer;
						rootContainer.__vue_app__ = app;
						return getComponentPublicInstance(vnode.component);
					}
				},
				onUnmount(cleanupFn) {
					pluginCleanupFns.push(cleanupFn);
				},
				unmount() {
					if (isMounted) {
						callWithAsyncErrorHandling(pluginCleanupFns, app._instance, 16);
						render(null, app._container);
						delete app._container.__vue_app__;
					}
				},
				provide(key, value) {
					context.provides[key] = value;
					return app;
				},
				runWithContext(fn) {
					const lastApp = currentApp;
					currentApp = app;
					try {
						return fn();
					} finally {
						currentApp = lastApp;
					}
				}
			};
			return app;
		};
	}
	var currentApp = null;
	var getModelModifiers = (props, modelName) => {
		return modelName === "modelValue" || modelName === "model-value" ? props.modelModifiers : props[`${modelName}Modifiers`] || props[`${camelize$2(modelName)}Modifiers`] || props[`${hyphenate$1(modelName)}Modifiers`];
	};
	function emit$2(instance, event, ...rawArgs) {
		if (instance.isUnmounted) return;
		const props = instance.vnode.props || EMPTY_OBJ;
		let args = rawArgs;
		const isModelListener = event.startsWith("update:");
		const modifiers = isModelListener && getModelModifiers(props, event.slice(7));
		if (modifiers) {
			if (modifiers.trim) args = rawArgs.map((a) => isString(a) ? a.trim() : a);
			if (modifiers.number) args = rawArgs.map(looseToNumber);
		}
		let handlerName;
		let handler = props[handlerName = toHandlerKey(event)] || props[handlerName = toHandlerKey(camelize$2(event))];
		if (!handler && isModelListener) handler = props[handlerName = toHandlerKey(hyphenate$1(event))];
		if (handler) callWithAsyncErrorHandling(handler, instance, 6, args);
		const onceHandler = props[handlerName + `Once`];
		if (onceHandler) {
			if (!instance.emitted) instance.emitted = {};
			else if (instance.emitted[handlerName]) return;
			instance.emitted[handlerName] = true;
			callWithAsyncErrorHandling(onceHandler, instance, 6, args);
		}
	}
	var mixinEmitsCache = new WeakMap();
	function normalizeEmitsOptions(comp, appContext, asMixin = false) {
		const cache = asMixin ? mixinEmitsCache : appContext.emitsCache;
		const cached = cache.get(comp);
		if (cached !== void 0) return cached;
		const raw = comp.emits;
		let normalized = {};
		let hasExtends = false;
		if (!isFunction(comp)) {
			const extendEmits = (raw2) => {
				const normalizedFromExtend = normalizeEmitsOptions(raw2, appContext, true);
				if (normalizedFromExtend) {
					hasExtends = true;
					extend$1(normalized, normalizedFromExtend);
				}
			};
			if (!asMixin && appContext.mixins.length) appContext.mixins.forEach(extendEmits);
			if (comp.extends) extendEmits(comp.extends);
			if (comp.mixins) comp.mixins.forEach(extendEmits);
		}
		if (!raw && !hasExtends) {
			if (isObject$1(comp)) cache.set(comp, null);
			return null;
		}
		if (isArray(raw)) raw.forEach((key) => normalized[key] = null);
		else extend$1(normalized, raw);
		if (isObject$1(comp)) cache.set(comp, normalized);
		return normalized;
	}
	function isEmitListener(options, key) {
		if (!options || !isOn(key)) return false;
		key = key.slice(2).replace(/Once$/, "");
		return hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, hyphenate$1(key)) || hasOwn(options, key);
	}
	function renderComponentRoot(instance) {
		const { type: Component, vnode, proxy, withProxy, propsOptions: [propsOptions], slots, attrs, emit, render, renderCache, props, data, setupState, ctx, inheritAttrs } = instance;
		const prev = setCurrentRenderingInstance(instance);
		let result;
		let fallthroughAttrs;
		try {
			if (vnode.shapeFlag & 4) {
				const proxyToUse = withProxy || proxy;
				const thisProxy = proxyToUse;
				result = normalizeVNode(render.call(thisProxy, proxyToUse, renderCache, props, setupState, data, ctx));
				fallthroughAttrs = attrs;
			} else {
				const render2 = Component;
				result = normalizeVNode(render2.length > 1 ? render2(props, {
					attrs,
					slots,
					emit
				}) : render2(props, null));
				fallthroughAttrs = Component.props ? attrs : getFunctionalFallthrough(attrs);
			}
		} catch (err) {
			blockStack.length = 0;
			handleError(err, instance, 1);
			result = createVNode(Comment);
		}
		let root = result;
		if (fallthroughAttrs && inheritAttrs !== false) {
			const keys = Object.keys(fallthroughAttrs);
			const { shapeFlag } = root;
			if (keys.length) {
				if (shapeFlag & 7) {
					if (propsOptions && keys.some(isModelListener)) fallthroughAttrs = filterModelListeners(fallthroughAttrs, propsOptions);
					root = cloneVNode(root, fallthroughAttrs, false, true);
				}
			}
		}
		if (vnode.dirs) {
			root = cloneVNode(root, null, false, true);
			root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs;
		}
		if (vnode.transition) setTransitionHooks(root, vnode.transition);
		result = root;
		setCurrentRenderingInstance(prev);
		return result;
	}
	var getFunctionalFallthrough = (attrs) => {
		let res;
		for (const key in attrs) if (key === "class" || key === "style" || isOn(key)) (res || (res = {}))[key] = attrs[key];
		return res;
	};
	var filterModelListeners = (attrs, props) => {
		const res = {};
		for (const key in attrs) if (!isModelListener(key) || !(key.slice(9) in props)) res[key] = attrs[key];
		return res;
	};
	function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
		const { props: prevProps, children: prevChildren, component } = prevVNode;
		const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
		const emits = component.emitsOptions;
		if (nextVNode.dirs || nextVNode.transition) return true;
		if (optimized && patchFlag >= 0) {
			if (patchFlag & 1024) return true;
			if (patchFlag & 16) {
				if (!prevProps) return !!nextProps;
				return hasPropsChanged(prevProps, nextProps, emits);
			} else if (patchFlag & 8) {
				const dynamicProps = nextVNode.dynamicProps;
				for (let i = 0; i < dynamicProps.length; i++) {
					const key = dynamicProps[i];
					if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emits, key)) return true;
				}
			}
		} else {
			if (prevChildren || nextChildren) {
				if (!nextChildren || !nextChildren.$stable) return true;
			}
			if (prevProps === nextProps) return false;
			if (!prevProps) return !!nextProps;
			if (!nextProps) return true;
			return hasPropsChanged(prevProps, nextProps, emits);
		}
		return false;
	}
	function hasPropsChanged(prevProps, nextProps, emitsOptions) {
		const nextKeys = Object.keys(nextProps);
		if (nextKeys.length !== Object.keys(prevProps).length) return true;
		for (let i = 0; i < nextKeys.length; i++) {
			const key = nextKeys[i];
			if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emitsOptions, key)) return true;
		}
		return false;
	}
	function hasPropValueChanged(nextProps, prevProps, key) {
		const nextProp = nextProps[key];
		const prevProp = prevProps[key];
		if (key === "style" && isObject$1(nextProp) && isObject$1(prevProp)) return !looseEqual(nextProp, prevProp);
		return nextProp !== prevProp;
	}
	function updateHOCHostEl({ vnode, parent, suspense }, el) {
		while (parent) {
			const root = parent.subTree;
			if (root.suspense && root.suspense.activeBranch === vnode) {
				root.suspense.vnode.el = root.el = el;
				vnode = root;
			}
			if (root === vnode) {
				(vnode = parent.vnode).el = el;
				parent = parent.parent;
			} else break;
		}
		if (suspense && suspense.activeBranch === vnode) suspense.vnode.el = el;
	}
	var internalObjectProto = {};
	var createInternalObject = () => Object.create(internalObjectProto);
	var isInternalObject = (obj) => Object.getPrototypeOf(obj) === internalObjectProto;
	function initProps(instance, rawProps, isStateful, isSSR = false) {
		const props = {};
		const attrs = createInternalObject();
		instance.propsDefaults = Object.create(null);
		setFullProps(instance, rawProps, props, attrs);
		for (const key in instance.propsOptions[0]) if (!(key in props)) props[key] = void 0;
		if (isStateful) instance.props = isSSR ? props : shallowReactive(props);
		else if (!instance.type.props) instance.props = attrs;
		else instance.props = props;
		instance.attrs = attrs;
	}
	function updateProps(instance, rawProps, rawPrevProps, optimized) {
		const { props, attrs, vnode: { patchFlag } } = instance;
		const rawCurrentProps = toRaw(props);
		const [options] = instance.propsOptions;
		let hasAttrsChanged = false;
		if ((optimized || patchFlag > 0) && !(patchFlag & 16)) {
			if (patchFlag & 8) {
				const propsToUpdate = instance.vnode.dynamicProps;
				for (let i = 0; i < propsToUpdate.length; i++) {
					let key = propsToUpdate[i];
					if (isEmitListener(instance.emitsOptions, key)) continue;
					const value = rawProps[key];
					if (options) if (hasOwn(attrs, key)) {
						if (value !== attrs[key]) {
							attrs[key] = value;
							hasAttrsChanged = true;
						}
					} else {
						const camelizedKey = camelize$2(key);
						props[camelizedKey] = resolvePropValue(options, rawCurrentProps, camelizedKey, value, instance, false);
					}
					else if (value !== attrs[key]) {
						attrs[key] = value;
						hasAttrsChanged = true;
					}
				}
			}
		} else {
			if (setFullProps(instance, rawProps, props, attrs)) hasAttrsChanged = true;
			let kebabKey;
			for (const key in rawCurrentProps) if (!rawProps || !hasOwn(rawProps, key) && ((kebabKey = hyphenate$1(key)) === key || !hasOwn(rawProps, kebabKey))) if (options) {
				if (rawPrevProps && (rawPrevProps[key] !== void 0 || rawPrevProps[kebabKey] !== void 0)) props[key] = resolvePropValue(options, rawCurrentProps, key, void 0, instance, true);
			} else delete props[key];
			if (attrs !== rawCurrentProps) {
				for (const key in attrs) if (!rawProps || !hasOwn(rawProps, key) && true) {
					delete attrs[key];
					hasAttrsChanged = true;
				}
			}
		}
		if (hasAttrsChanged) trigger(instance.attrs, "set", "");
	}
	function setFullProps(instance, rawProps, props, attrs) {
		const [options, needCastKeys] = instance.propsOptions;
		let hasAttrsChanged = false;
		let rawCastValues;
		if (rawProps) for (let key in rawProps) {
			if (isReservedProp(key)) continue;
			const value = rawProps[key];
			let camelKey;
			if (options && hasOwn(options, camelKey = camelize$2(key))) if (!needCastKeys || !needCastKeys.includes(camelKey)) props[camelKey] = value;
			else (rawCastValues || (rawCastValues = {}))[camelKey] = value;
			else if (!isEmitListener(instance.emitsOptions, key)) {
				if (!(key in attrs) || value !== attrs[key]) {
					attrs[key] = value;
					hasAttrsChanged = true;
				}
			}
		}
		if (needCastKeys) {
			const rawCurrentProps = toRaw(props);
			const castValues = rawCastValues || EMPTY_OBJ;
			for (let i = 0; i < needCastKeys.length; i++) {
				const key = needCastKeys[i];
				props[key] = resolvePropValue(options, rawCurrentProps, key, castValues[key], instance, !hasOwn(castValues, key));
			}
		}
		return hasAttrsChanged;
	}
	function resolvePropValue(options, props, key, value, instance, isAbsent) {
		const opt = options[key];
		if (opt != null) {
			const hasDefault = hasOwn(opt, "default");
			if (hasDefault && value === void 0) {
				const defaultValue = opt.default;
				if (opt.type !== Function && !opt.skipFactory && isFunction(defaultValue)) {
					const { propsDefaults } = instance;
					if (key in propsDefaults) value = propsDefaults[key];
					else {
						const reset = setCurrentInstance(instance);
						value = propsDefaults[key] = defaultValue.call(null, props);
						reset();
					}
				} else value = defaultValue;
				if (instance.ce) instance.ce._setProp(key, value);
			}
			if (opt[0]) {
				if (isAbsent && !hasDefault) value = false;
				else if (opt[1] && (value === "" || value === hyphenate$1(key))) value = true;
			}
		}
		return value;
	}
	var mixinPropsCache = new WeakMap();
	function normalizePropsOptions(comp, appContext, asMixin = false) {
		const cache = asMixin ? mixinPropsCache : appContext.propsCache;
		const cached = cache.get(comp);
		if (cached) return cached;
		const raw = comp.props;
		const normalized = {};
		const needCastKeys = [];
		let hasExtends = false;
		if (!isFunction(comp)) {
			const extendProps = (raw2) => {
				hasExtends = true;
				const [props, keys] = normalizePropsOptions(raw2, appContext, true);
				extend$1(normalized, props);
				if (keys) needCastKeys.push(...keys);
			};
			if (!asMixin && appContext.mixins.length) appContext.mixins.forEach(extendProps);
			if (comp.extends) extendProps(comp.extends);
			if (comp.mixins) comp.mixins.forEach(extendProps);
		}
		if (!raw && !hasExtends) {
			if (isObject$1(comp)) cache.set(comp, EMPTY_ARR);
			return EMPTY_ARR;
		}
		if (isArray(raw)) for (let i = 0; i < raw.length; i++) {
			const normalizedKey = camelize$2(raw[i]);
			if (validatePropName(normalizedKey)) normalized[normalizedKey] = EMPTY_OBJ;
		}
		else if (raw) for (const key in raw) {
			const normalizedKey = camelize$2(key);
			if (validatePropName(normalizedKey)) {
				const opt = raw[key];
				const prop = normalized[normalizedKey] = isArray(opt) || isFunction(opt) ? { type: opt } : extend$1({}, opt);
				const propType = prop.type;
				let shouldCast = false;
				let shouldCastTrue = true;
				if (isArray(propType)) for (let index = 0; index < propType.length; ++index) {
					const type = propType[index];
					const typeName = isFunction(type) && type.name;
					if (typeName === "Boolean") {
						shouldCast = true;
						break;
					} else if (typeName === "String") shouldCastTrue = false;
				}
				else shouldCast = isFunction(propType) && propType.name === "Boolean";
				prop[0] = shouldCast;
				prop[1] = shouldCastTrue;
				if (shouldCast || hasOwn(prop, "default")) needCastKeys.push(normalizedKey);
			}
		}
		const res = [normalized, needCastKeys];
		if (isObject$1(comp)) cache.set(comp, res);
		return res;
	}
	function validatePropName(key) {
		if (key[0] !== "$" && !isReservedProp(key)) return true;
		return false;
	}
	var isInternalKey = (key) => key === "_" || key === "_ctx" || key === "$stable";
	var normalizeSlotValue = (value) => isArray(value) ? value.map(normalizeVNode) : [normalizeVNode(value)];
	var normalizeSlot = (key, rawSlot, ctx) => {
		if (rawSlot._n) return rawSlot;
		const normalized = withCtx((...args) => {
			return normalizeSlotValue(rawSlot(...args));
		}, ctx);
		normalized._c = false;
		return normalized;
	};
	var normalizeObjectSlots = (rawSlots, slots, instance) => {
		const ctx = rawSlots._ctx;
		for (const key in rawSlots) {
			if (isInternalKey(key)) continue;
			const value = rawSlots[key];
			if (isFunction(value)) slots[key] = normalizeSlot(key, value, ctx);
			else if (value != null) {
				const normalized = normalizeSlotValue(value);
				slots[key] = () => normalized;
			}
		}
	};
	var normalizeVNodeSlots = (instance, children) => {
		const normalized = normalizeSlotValue(children);
		instance.slots.default = () => normalized;
	};
	var assignSlots = (slots, children, optimized) => {
		for (const key in children) if (optimized || !isInternalKey(key)) slots[key] = children[key];
	};
	var initSlots = (instance, children, optimized) => {
		const slots = instance.slots = createInternalObject();
		if (instance.vnode.shapeFlag & 32) {
			const type = children._;
			if (type) {
				assignSlots(slots, children, optimized);
				if (optimized) def(slots, "_", type, true);
			} else normalizeObjectSlots(children, slots);
		} else if (children) normalizeVNodeSlots(instance, children);
	};
	var updateSlots = (instance, children, optimized) => {
		const { vnode, slots } = instance;
		let needDeletionCheck = true;
		let deletionComparisonTarget = EMPTY_OBJ;
		if (vnode.shapeFlag & 32) {
			const type = children._;
			if (type) if (optimized && type === 1) needDeletionCheck = false;
			else assignSlots(slots, children, optimized);
			else {
				needDeletionCheck = !children.$stable;
				normalizeObjectSlots(children, slots);
			}
			deletionComparisonTarget = children;
		} else if (children) {
			normalizeVNodeSlots(instance, children);
			deletionComparisonTarget = { default: 1 };
		}
		if (needDeletionCheck) {
			for (const key in slots) if (!isInternalKey(key) && deletionComparisonTarget[key] == null) delete slots[key];
		}
	};
	var queuePostRenderEffect = queueEffectWithSuspense;
	function createRenderer(options) {
		return baseCreateRenderer(options);
	}
	function baseCreateRenderer(options, createHydrationFns) {
		const target = getGlobalThis();
		target.__VUE__ = true;
		const { insert: hostInsert, remove: hostRemove, patchProp: hostPatchProp, createElement: hostCreateElement, createText: hostCreateText, createComment: hostCreateComment, setText: hostSetText, setElementText: hostSetElementText, parentNode: hostParentNode, nextSibling: hostNextSibling, setScopeId: hostSetScopeId = NOOP, insertStaticContent: hostInsertStaticContent } = options;
		const patch = (n1, n2, container, anchor = null, parentComponent = null, parentSuspense = null, namespace = void 0, slotScopeIds = null, optimized = !!n2.dynamicChildren) => {
			if (n1 === n2) return;
			if (n1 && !isSameVNodeType(n1, n2)) {
				anchor = getNextHostNode(n1);
				unmount(n1, parentComponent, parentSuspense, true);
				n1 = null;
			}
			if (n2.patchFlag === -2) {
				optimized = false;
				n2.dynamicChildren = null;
			}
			const { type, ref, shapeFlag } = n2;
			switch (type) {
				case Text:
					processText(n1, n2, container, anchor);
					break;
				case Comment:
					processCommentNode(n1, n2, container, anchor);
					break;
				case Static:
					if (n1 == null) mountStaticNode(n2, container, anchor, namespace);
					break;
				case Fragment:
					processFragment(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					break;
				default: if (shapeFlag & 1) processElement(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else if (shapeFlag & 6) processComponent(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else if (shapeFlag & 64) type.process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals);
				else if (shapeFlag & 128) type.process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals);
			}
			if (ref != null && parentComponent) setRef(ref, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
			else if (ref == null && n1 && n1.ref != null) setRef(n1.ref, null, parentSuspense, n1, true);
		};
		const processText = (n1, n2, container, anchor) => {
			if (n1 == null) hostInsert(n2.el = hostCreateText(n2.children), container, anchor);
			else {
				const el = n2.el = n1.el;
				if (n2.children !== n1.children) hostSetText(el, n2.children);
			}
		};
		const processCommentNode = (n1, n2, container, anchor) => {
			if (n1 == null) hostInsert(n2.el = hostCreateComment(n2.children || ""), container, anchor);
			else n2.el = n1.el;
		};
		const mountStaticNode = (n2, container, anchor, namespace) => {
			[n2.el, n2.anchor] = hostInsertStaticContent(n2.children, container, anchor, namespace, n2.el, n2.anchor);
		};
		const moveStaticNode = ({ el, anchor }, container, nextSibling) => {
			let next;
			while (el && el !== anchor) {
				next = hostNextSibling(el);
				hostInsert(el, container, nextSibling);
				el = next;
			}
			hostInsert(anchor, container, nextSibling);
		};
		const removeStaticNode = ({ el, anchor }) => {
			let next;
			while (el && el !== anchor) {
				next = hostNextSibling(el);
				hostRemove(el);
				el = next;
			}
			hostRemove(anchor);
		};
		const processElement = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			if (n2.type === "svg") namespace = "svg";
			else if (n2.type === "math") namespace = "mathml";
			if (n1 == null) mountElement(n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			else {
				const customElement = n1.el && n1.el._isVueCE ? n1.el : null;
				try {
					if (customElement) customElement._beginPatch();
					patchElement(n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				} finally {
					if (customElement) customElement._endPatch();
				}
			}
		};
		const mountElement = (vnode, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			let el;
			let vnodeHook;
			const { props, shapeFlag, transition, dirs } = vnode;
			el = vnode.el = hostCreateElement(vnode.type, namespace, props && props.is, props);
			if (shapeFlag & 8) hostSetElementText(el, vnode.children);
			else if (shapeFlag & 16) mountChildren(vnode.children, el, null, parentComponent, parentSuspense, resolveChildrenNamespace(vnode, namespace), slotScopeIds, optimized);
			if (dirs) invokeDirectiveHook(vnode, null, parentComponent, "created");
			setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent);
			if (props) {
				for (const key in props) if (key !== "value" && !isReservedProp(key)) hostPatchProp(el, key, null, props[key], namespace, parentComponent);
				if ("value" in props) hostPatchProp(el, "value", null, props.value, namespace);
				if (vnodeHook = props.onVnodeBeforeMount) invokeVNodeHook(vnodeHook, parentComponent, vnode);
			}
			if (dirs) invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
			const needCallTransitionHooks = needTransition(parentSuspense, transition);
			if (needCallTransitionHooks) transition.beforeEnter(el);
			hostInsert(el, container, anchor);
			if ((vnodeHook = props && props.onVnodeMounted) || needCallTransitionHooks || dirs) queuePostRenderEffect(() => {
				try {
					vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
					needCallTransitionHooks && transition.enter(el);
					dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
				} finally {}
			}, parentSuspense);
		};
		const setScopeId = (el, vnode, scopeId, slotScopeIds, parentComponent) => {
			if (scopeId) hostSetScopeId(el, scopeId);
			if (slotScopeIds) for (let i = 0; i < slotScopeIds.length; i++) hostSetScopeId(el, slotScopeIds[i]);
			if (parentComponent) {
				let subTree = parentComponent.subTree;
				if (vnode === subTree || isSuspense(subTree.type) && (subTree.ssContent === vnode || subTree.ssFallback === vnode)) {
					const parentVNode = parentComponent.vnode;
					setScopeId(el, parentVNode, parentVNode.scopeId, parentVNode.slotScopeIds, parentComponent.parent);
				}
			}
		};
		const mountChildren = (children, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, start = 0) => {
			for (let i = start; i < children.length; i++) patch(null, children[i] = optimized ? cloneIfMounted(children[i]) : normalizeVNode(children[i]), container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
		};
		const patchElement = (n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			const el = n2.el = n1.el;
			let { patchFlag, dynamicChildren, dirs } = n2;
			patchFlag |= n1.patchFlag & 16;
			const oldProps = n1.props || EMPTY_OBJ;
			const newProps = n2.props || EMPTY_OBJ;
			let vnodeHook;
			parentComponent && toggleRecurse(parentComponent, false);
			if (vnodeHook = newProps.onVnodeBeforeUpdate) invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
			if (dirs) invokeDirectiveHook(n2, n1, parentComponent, "beforeUpdate");
			parentComponent && toggleRecurse(parentComponent, true);
			if (oldProps.innerHTML && newProps.innerHTML == null || oldProps.textContent && newProps.textContent == null) hostSetElementText(el, "");
			if (dynamicChildren) patchBlockChildren(n1.dynamicChildren, dynamicChildren, el, parentComponent, parentSuspense, resolveChildrenNamespace(n2, namespace), slotScopeIds);
			else if (!optimized) patchChildren(n1, n2, el, null, parentComponent, parentSuspense, resolveChildrenNamespace(n2, namespace), slotScopeIds, false);
			if (patchFlag > 0) {
				if (patchFlag & 16) patchProps(el, oldProps, newProps, parentComponent, namespace);
				else {
					if (patchFlag & 2) {
						if (oldProps.class !== newProps.class) hostPatchProp(el, "class", null, newProps.class, namespace);
					}
					if (patchFlag & 4) hostPatchProp(el, "style", oldProps.style, newProps.style, namespace);
					if (patchFlag & 8) {
						const propsToUpdate = n2.dynamicProps;
						for (let i = 0; i < propsToUpdate.length; i++) {
							const key = propsToUpdate[i];
							const prev = oldProps[key];
							const next = newProps[key];
							if (next !== prev || key === "value") hostPatchProp(el, key, prev, next, namespace, parentComponent);
						}
					}
				}
				if (patchFlag & 1) {
					if (n1.children !== n2.children) hostSetElementText(el, n2.children);
				}
			} else if (!optimized && dynamicChildren == null) patchProps(el, oldProps, newProps, parentComponent, namespace);
			if ((vnodeHook = newProps.onVnodeUpdated) || dirs) queuePostRenderEffect(() => {
				vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
				dirs && invokeDirectiveHook(n2, n1, parentComponent, "updated");
			}, parentSuspense);
		};
		const patchBlockChildren = (oldChildren, newChildren, fallbackContainer, parentComponent, parentSuspense, namespace, slotScopeIds) => {
			for (let i = 0; i < newChildren.length; i++) {
				const oldVNode = oldChildren[i];
				const newVNode = newChildren[i];
				patch(oldVNode, newVNode, oldVNode.el && (oldVNode.type === Fragment || !isSameVNodeType(oldVNode, newVNode) || oldVNode.shapeFlag & 198) ? hostParentNode(oldVNode.el) : fallbackContainer, null, parentComponent, parentSuspense, namespace, slotScopeIds, true);
			}
		};
		const patchProps = (el, oldProps, newProps, parentComponent, namespace) => {
			if (oldProps !== newProps) {
				if (oldProps !== EMPTY_OBJ) {
					for (const key in oldProps) if (!isReservedProp(key) && !(key in newProps)) hostPatchProp(el, key, oldProps[key], null, namespace, parentComponent);
				}
				for (const key in newProps) {
					if (isReservedProp(key)) continue;
					const next = newProps[key];
					const prev = oldProps[key];
					if (next !== prev && key !== "value") hostPatchProp(el, key, prev, next, namespace, parentComponent);
				}
				if ("value" in newProps) hostPatchProp(el, "value", oldProps.value, newProps.value, namespace);
			}
		};
		const processFragment = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			const fragmentStartAnchor = n2.el = n1 ? n1.el : hostCreateText("");
			const fragmentEndAnchor = n2.anchor = n1 ? n1.anchor : hostCreateText("");
			let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2;
			if (fragmentSlotScopeIds) slotScopeIds = slotScopeIds ? slotScopeIds.concat(fragmentSlotScopeIds) : fragmentSlotScopeIds;
			if (n1 == null) {
				hostInsert(fragmentStartAnchor, container, anchor);
				hostInsert(fragmentEndAnchor, container, anchor);
				mountChildren(n2.children || [], container, fragmentEndAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			} else if (patchFlag > 0 && patchFlag & 64 && dynamicChildren && n1.dynamicChildren && n1.dynamicChildren.length === dynamicChildren.length) {
				patchBlockChildren(n1.dynamicChildren, dynamicChildren, container, parentComponent, parentSuspense, namespace, slotScopeIds);
				if (n2.key != null || parentComponent && n2 === parentComponent.subTree) traverseStaticChildren(n1, n2, true);
			} else patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
		};
		const processComponent = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			n2.slotScopeIds = slotScopeIds;
			if (n1 == null) if (n2.shapeFlag & 512) parentComponent.ctx.activate(n2, container, anchor, namespace, optimized);
			else mountComponent(n2, container, anchor, parentComponent, parentSuspense, namespace, optimized);
			else updateComponent(n1, n2, optimized);
		};
		const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, namespace, optimized) => {
			const instance = initialVNode.component = createComponentInstance(initialVNode, parentComponent, parentSuspense);
			if (isKeepAlive(initialVNode)) instance.ctx.renderer = internals;
			setupComponent(instance, false, optimized);
			if (instance.asyncDep) {
				parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect, optimized);
				if (!initialVNode.el) {
					const placeholder = instance.subTree = createVNode(Comment);
					processCommentNode(null, placeholder, container, anchor);
					initialVNode.placeholder = placeholder.el;
				}
			} else setupRenderEffect(instance, initialVNode, container, anchor, parentSuspense, namespace, optimized);
		};
		const updateComponent = (n1, n2, optimized) => {
			const instance = n2.component = n1.component;
			if (shouldUpdateComponent(n1, n2, optimized)) if (instance.asyncDep && !instance.asyncResolved) {
				updateComponentPreRender(instance, n2, optimized);
				return;
			} else {
				instance.next = n2;
				instance.update();
			}
			else {
				n2.el = n1.el;
				instance.vnode = n2;
			}
		};
		const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, namespace, optimized) => {
			const componentUpdateFn = () => {
				if (!instance.isMounted) {
					let vnodeHook;
					const { el, props } = initialVNode;
					const { bm, m, parent, root, type } = instance;
					const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);
					toggleRecurse(instance, false);
					if (bm) invokeArrayFns(bm);
					if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeBeforeMount)) invokeVNodeHook(vnodeHook, parent, initialVNode);
					toggleRecurse(instance, true);
					if (el && hydrateNode) {
						const hydrateSubTree = () => {
							instance.subTree = renderComponentRoot(instance);
							hydrateNode(el, instance.subTree, instance, parentSuspense, null);
						};
						if (isAsyncWrapperVNode && type.__asyncHydrate) type.__asyncHydrate(el, instance, hydrateSubTree);
						else hydrateSubTree();
					} else {
						if (root.ce && root.ce._hasShadowRoot()) root.ce._injectChildStyle(type, instance.parent ? instance.parent.type : void 0);
						const subTree = instance.subTree = renderComponentRoot(instance);
						patch(null, subTree, container, anchor, instance, parentSuspense, namespace);
						initialVNode.el = subTree.el;
					}
					if (m) queuePostRenderEffect(m, parentSuspense);
					if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeMounted)) {
						const scopedInitialVNode = initialVNode;
						queuePostRenderEffect(() => invokeVNodeHook(vnodeHook, parent, scopedInitialVNode), parentSuspense);
					}
					if (initialVNode.shapeFlag & 256 || parent && isAsyncWrapper(parent.vnode) && parent.vnode.shapeFlag & 256) instance.a && queuePostRenderEffect(instance.a, parentSuspense);
					instance.isMounted = true;
					initialVNode = container = anchor = null;
				} else {
					let { next, bu, u, parent, vnode } = instance;
					{
						const nonHydratedAsyncRoot = locateNonHydratedAsyncRoot(instance);
						if (nonHydratedAsyncRoot) {
							if (next) {
								next.el = vnode.el;
								updateComponentPreRender(instance, next, optimized);
							}
							nonHydratedAsyncRoot.asyncDep.then(() => {
								queuePostRenderEffect(() => {
									if (!instance.isUnmounted) update();
								}, parentSuspense);
							});
							return;
						}
					}
					let originNext = next;
					let vnodeHook;
					toggleRecurse(instance, false);
					if (next) {
						next.el = vnode.el;
						updateComponentPreRender(instance, next, optimized);
					} else next = vnode;
					if (bu) invokeArrayFns(bu);
					if (vnodeHook = next.props && next.props.onVnodeBeforeUpdate) invokeVNodeHook(vnodeHook, parent, next, vnode);
					toggleRecurse(instance, true);
					const nextTree = renderComponentRoot(instance);
					const prevTree = instance.subTree;
					instance.subTree = nextTree;
					patch(prevTree, nextTree, hostParentNode(prevTree.el), getNextHostNode(prevTree), instance, parentSuspense, namespace);
					next.el = nextTree.el;
					if (originNext === null) updateHOCHostEl(instance, nextTree.el);
					if (u) queuePostRenderEffect(u, parentSuspense);
					if (vnodeHook = next.props && next.props.onVnodeUpdated) queuePostRenderEffect(() => invokeVNodeHook(vnodeHook, parent, next, vnode), parentSuspense);
				}
			};
			instance.scope.on();
			const effect = instance.effect = new ReactiveEffect(componentUpdateFn);
			instance.scope.off();
			const update = instance.update = effect.run.bind(effect);
			const job = instance.job = effect.runIfDirty.bind(effect);
			job.i = instance;
			job.id = instance.uid;
			effect.scheduler = () => queueJob(job);
			toggleRecurse(instance, true);
			update();
		};
		const updateComponentPreRender = (instance, nextVNode, optimized) => {
			nextVNode.component = instance;
			const prevProps = instance.vnode.props;
			instance.vnode = nextVNode;
			instance.next = null;
			updateProps(instance, nextVNode.props, prevProps, optimized);
			updateSlots(instance, nextVNode.children, optimized);
			pauseTracking();
			flushPreFlushCbs(instance);
			resetTracking();
		};
		const patchChildren = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized = false) => {
			const c1 = n1 && n1.children;
			const prevShapeFlag = n1 ? n1.shapeFlag : 0;
			const c2 = n2.children;
			const { patchFlag, shapeFlag } = n2;
			if (patchFlag > 0) {
				if (patchFlag & 128) {
					patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					return;
				} else if (patchFlag & 256) {
					patchUnkeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					return;
				}
			}
			if (shapeFlag & 8) {
				if (prevShapeFlag & 16) unmountChildren(c1, parentComponent, parentSuspense);
				if (c2 !== c1) hostSetElementText(container, c2);
			} else if (prevShapeFlag & 16) if (shapeFlag & 16) patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			else unmountChildren(c1, parentComponent, parentSuspense, true);
			else {
				if (prevShapeFlag & 8) hostSetElementText(container, "");
				if (shapeFlag & 16) mountChildren(c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			}
		};
		const patchUnkeyedChildren = (c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			c1 = c1 || EMPTY_ARR;
			c2 = c2 || EMPTY_ARR;
			const oldLength = c1.length;
			const newLength = c2.length;
			const commonLength = Math.min(oldLength, newLength);
			let i;
			for (i = 0; i < commonLength; i++) {
				const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
				patch(c1[i], nextChild, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
			}
			if (oldLength > newLength) unmountChildren(c1, parentComponent, parentSuspense, true, false, commonLength);
			else mountChildren(c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, commonLength);
		};
		const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
			let i = 0;
			const l2 = c2.length;
			let e1 = c1.length - 1;
			let e2 = l2 - 1;
			while (i <= e1 && i <= e2) {
				const n1 = c1[i];
				const n2 = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
				if (isSameVNodeType(n1, n2)) patch(n1, n2, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else break;
				i++;
			}
			while (i <= e1 && i <= e2) {
				const n1 = c1[e1];
				const n2 = c2[e2] = optimized ? cloneIfMounted(c2[e2]) : normalizeVNode(c2[e2]);
				if (isSameVNodeType(n1, n2)) patch(n1, n2, container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
				else break;
				e1--;
				e2--;
			}
			if (i > e1) {
				if (i <= e2) {
					const nextPos = e2 + 1;
					const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
					while (i <= e2) {
						patch(null, c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]), container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
						i++;
					}
				}
			} else if (i > e2) while (i <= e1) {
				unmount(c1[i], parentComponent, parentSuspense, true);
				i++;
			}
			else {
				const s1 = i;
				const s2 = i;
				const keyToNewIndexMap = new Map();
				for (i = s2; i <= e2; i++) {
					const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
					if (nextChild.key != null) keyToNewIndexMap.set(nextChild.key, i);
				}
				let j;
				let patched = 0;
				const toBePatched = e2 - s2 + 1;
				let moved = false;
				let maxNewIndexSoFar = 0;
				const newIndexToOldIndexMap = new Array(toBePatched);
				for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
				for (i = s1; i <= e1; i++) {
					const prevChild = c1[i];
					if (patched >= toBePatched) {
						unmount(prevChild, parentComponent, parentSuspense, true);
						continue;
					}
					let newIndex;
					if (prevChild.key != null) newIndex = keyToNewIndexMap.get(prevChild.key);
					else for (j = s2; j <= e2; j++) if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j])) {
						newIndex = j;
						break;
					}
					if (newIndex === void 0) unmount(prevChild, parentComponent, parentSuspense, true);
					else {
						newIndexToOldIndexMap[newIndex - s2] = i + 1;
						if (newIndex >= maxNewIndexSoFar) maxNewIndexSoFar = newIndex;
						else moved = true;
						patch(prevChild, c2[newIndex], container, null, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
						patched++;
					}
				}
				const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : EMPTY_ARR;
				j = increasingNewIndexSequence.length - 1;
				for (i = toBePatched - 1; i >= 0; i--) {
					const nextIndex = s2 + i;
					const nextChild = c2[nextIndex];
					const anchorVNode = c2[nextIndex + 1];
					const anchor = nextIndex + 1 < l2 ? anchorVNode.el || resolveAsyncComponentPlaceholder(anchorVNode) : parentAnchor;
					if (newIndexToOldIndexMap[i] === 0) patch(null, nextChild, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized);
					else if (moved) if (j < 0 || i !== increasingNewIndexSequence[j]) move(nextChild, container, anchor, 2);
					else j--;
				}
			}
		};
		const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
			const { el, type, transition, children, shapeFlag } = vnode;
			if (shapeFlag & 6) {
				move(vnode.component.subTree, container, anchor, moveType);
				return;
			}
			if (shapeFlag & 128) {
				vnode.suspense.move(container, anchor, moveType);
				return;
			}
			if (shapeFlag & 64) {
				type.move(vnode, container, anchor, internals);
				return;
			}
			if (type === Fragment) {
				hostInsert(el, container, anchor);
				for (let i = 0; i < children.length; i++) move(children[i], container, anchor, moveType);
				hostInsert(vnode.anchor, container, anchor);
				return;
			}
			if (type === Static) {
				moveStaticNode(vnode, container, anchor);
				return;
			}
			if (moveType !== 2 && shapeFlag & 1 && transition) if (moveType === 0) {
				transition.beforeEnter(el);
				hostInsert(el, container, anchor);
				queuePostRenderEffect(() => transition.enter(el), parentSuspense);
			} else {
				const { leave, delayLeave, afterLeave } = transition;
				const remove2 = () => {
					if (vnode.ctx.isUnmounted) hostRemove(el);
					else hostInsert(el, container, anchor);
				};
				const performLeave = () => {
					if (el._isLeaving) el[leaveCbKey](true);
					leave(el, () => {
						remove2();
						afterLeave && afterLeave();
					});
				};
				if (delayLeave) delayLeave(el, remove2, performLeave);
				else performLeave();
			}
			else hostInsert(el, container, anchor);
		};
		const unmount = (vnode, parentComponent, parentSuspense, doRemove = false, optimized = false) => {
			const { type, props, ref, children, dynamicChildren, shapeFlag, patchFlag, dirs, cacheIndex, memo } = vnode;
			if (patchFlag === -2) optimized = false;
			if (ref != null) {
				pauseTracking();
				setRef(ref, null, parentSuspense, vnode, true);
				resetTracking();
			}
			if (cacheIndex != null) parentComponent.renderCache[cacheIndex] = void 0;
			if (shapeFlag & 256) {
				parentComponent.ctx.deactivate(vnode);
				return;
			}
			const shouldInvokeDirs = shapeFlag & 1 && dirs;
			const shouldInvokeVnodeHook = !isAsyncWrapper(vnode);
			let vnodeHook;
			if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeBeforeUnmount)) invokeVNodeHook(vnodeHook, parentComponent, vnode);
			if (shapeFlag & 6) unmountComponent(vnode.component, parentSuspense, doRemove);
			else {
				if (shapeFlag & 128) {
					vnode.suspense.unmount(parentSuspense, doRemove);
					return;
				}
				if (shouldInvokeDirs) invokeDirectiveHook(vnode, null, parentComponent, "beforeUnmount");
				if (shapeFlag & 64) vnode.type.remove(vnode, parentComponent, parentSuspense, internals, doRemove);
				else if (dynamicChildren && !dynamicChildren.hasOnce && (type !== Fragment || patchFlag > 0 && patchFlag & 64)) unmountChildren(dynamicChildren, parentComponent, parentSuspense, false, true);
				else if (type === Fragment && patchFlag & 384 || !optimized && shapeFlag & 16) unmountChildren(children, parentComponent, parentSuspense);
				if (doRemove) remove(vnode);
			}
			const shouldInvalidateMemo = memo != null && cacheIndex == null;
			if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeUnmounted) || shouldInvokeDirs || shouldInvalidateMemo) queuePostRenderEffect(() => {
				vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
				shouldInvokeDirs && invokeDirectiveHook(vnode, null, parentComponent, "unmounted");
				if (shouldInvalidateMemo) vnode.el = null;
			}, parentSuspense);
		};
		const remove = (vnode) => {
			const { type, el, anchor, transition } = vnode;
			if (type === Fragment) {
				removeFragment(el, anchor);
				return;
			}
			if (type === Static) {
				removeStaticNode(vnode);
				return;
			}
			const performRemove = () => {
				hostRemove(el);
				if (transition && !transition.persisted && transition.afterLeave) transition.afterLeave();
			};
			if (vnode.shapeFlag & 1 && transition && !transition.persisted) {
				const { leave, delayLeave } = transition;
				const performLeave = () => leave(el, performRemove);
				if (delayLeave) delayLeave(vnode.el, performRemove, performLeave);
				else performLeave();
			} else performRemove();
		};
		const removeFragment = (cur, end) => {
			let next;
			while (cur !== end) {
				next = hostNextSibling(cur);
				hostRemove(cur);
				cur = next;
			}
			hostRemove(end);
		};
		const unmountComponent = (instance, parentSuspense, doRemove) => {
			const { bum, scope, job, subTree, um, m, a } = instance;
			invalidateMount(m);
			invalidateMount(a);
			if (bum) invokeArrayFns(bum);
			scope.stop();
			if (job) {
				job.flags |= 8;
				unmount(subTree, instance, parentSuspense, doRemove);
			}
			if (um) queuePostRenderEffect(um, parentSuspense);
			queuePostRenderEffect(() => {
				instance.isUnmounted = true;
			}, parentSuspense);
		};
		const unmountChildren = (children, parentComponent, parentSuspense, doRemove = false, optimized = false, start = 0) => {
			for (let i = start; i < children.length; i++) unmount(children[i], parentComponent, parentSuspense, doRemove, optimized);
		};
		const getNextHostNode = (vnode) => {
			if (vnode.shapeFlag & 6) return getNextHostNode(vnode.component.subTree);
			if (vnode.shapeFlag & 128) return vnode.suspense.next();
			const el = hostNextSibling(vnode.anchor || vnode.el);
			const teleportEnd = el && el[TeleportEndKey];
			return teleportEnd ? hostNextSibling(teleportEnd) : el;
		};
		let isFlushing = false;
		const render = (vnode, container, namespace) => {
			let instance;
			if (vnode == null) {
				if (container._vnode) {
					unmount(container._vnode, null, null, true);
					instance = container._vnode.component;
				}
			} else patch(container._vnode || null, vnode, container, null, null, null, namespace);
			container._vnode = vnode;
			if (!isFlushing) {
				isFlushing = true;
				flushPreFlushCbs(instance);
				flushPostFlushCbs();
				isFlushing = false;
			}
		};
		const internals = {
			p: patch,
			um: unmount,
			m: move,
			r: remove,
			mt: mountComponent,
			mc: mountChildren,
			pc: patchChildren,
			pbc: patchBlockChildren,
			n: getNextHostNode,
			o: options
		};
		let hydrate;
		let hydrateNode;
		if (createHydrationFns) [hydrate, hydrateNode] = createHydrationFns(internals);
		return {
			render,
			hydrate,
			createApp: createAppAPI(render, hydrate)
		};
	}
	function resolveChildrenNamespace({ type, props }, currentNamespace) {
		return currentNamespace === "svg" && type === "foreignObject" || currentNamespace === "mathml" && type === "annotation-xml" && props && props.encoding && props.encoding.includes("html") ? void 0 : currentNamespace;
	}
	function toggleRecurse({ effect, job }, allowed) {
		if (allowed) {
			effect.flags |= 32;
			job.flags |= 4;
		} else {
			effect.flags &= -33;
			job.flags &= -5;
		}
	}
	function needTransition(parentSuspense, transition) {
		return (!parentSuspense || parentSuspense && !parentSuspense.pendingBranch) && transition && !transition.persisted;
	}
	function traverseStaticChildren(n1, n2, shallow = false) {
		const ch1 = n1.children;
		const ch2 = n2.children;
		if (isArray(ch1) && isArray(ch2)) for (let i = 0; i < ch1.length; i++) {
			const c1 = ch1[i];
			let c2 = ch2[i];
			if (c2.shapeFlag & 1 && !c2.dynamicChildren) {
				if (c2.patchFlag <= 0 || c2.patchFlag === 32) {
					c2 = ch2[i] = cloneIfMounted(ch2[i]);
					c2.el = c1.el;
				}
				if (!shallow && c2.patchFlag !== -2) traverseStaticChildren(c1, c2);
			}
			if (c2.type === Text) {
				if (c2.patchFlag === -1) c2 = ch2[i] = cloneIfMounted(c2);
				c2.el = c1.el;
			}
			if (c2.type === Comment && !c2.el) c2.el = c1.el;
		}
	}
	function getSequence(arr) {
		const p = arr.slice();
		const result = [0];
		let i, j, u, v, c;
		const len = arr.length;
		for (i = 0; i < len; i++) {
			const arrI = arr[i];
			if (arrI !== 0) {
				j = result[result.length - 1];
				if (arr[j] < arrI) {
					p[i] = j;
					result.push(i);
					continue;
				}
				u = 0;
				v = result.length - 1;
				while (u < v) {
					c = u + v >> 1;
					if (arr[result[c]] < arrI) u = c + 1;
					else v = c;
				}
				if (arrI < arr[result[u]]) {
					if (u > 0) p[i] = result[u - 1];
					result[u] = i;
				}
			}
		}
		u = result.length;
		v = result[u - 1];
		while (u-- > 0) {
			result[u] = v;
			v = p[v];
		}
		return result;
	}
	function locateNonHydratedAsyncRoot(instance) {
		const subComponent = instance.subTree.component;
		if (subComponent) if (subComponent.asyncDep && !subComponent.asyncResolved) return subComponent;
		else return locateNonHydratedAsyncRoot(subComponent);
	}
	function invalidateMount(hooks) {
		if (hooks) for (let i = 0; i < hooks.length; i++) hooks[i].flags |= 8;
	}
	function resolveAsyncComponentPlaceholder(anchorVnode) {
		if (anchorVnode.placeholder) return anchorVnode.placeholder;
		const instance = anchorVnode.component;
		if (instance) return resolveAsyncComponentPlaceholder(instance.subTree);
		return null;
	}
	var isSuspense = (type) => type.__isSuspense;
	function queueEffectWithSuspense(fn, suspense) {
		if (suspense && suspense.pendingBranch) if (isArray(fn)) suspense.effects.push(...fn);
		else suspense.effects.push(fn);
		else queuePostFlushCb(fn);
	}
	var Fragment = Symbol.for("v-fgt");
	var Text = Symbol.for("v-txt");
	var Comment = Symbol.for("v-cmt");
	var Static = Symbol.for("v-stc");
	var blockStack = [];
	var currentBlock = null;
	function openBlock(disableTracking = false) {
		blockStack.push(currentBlock = disableTracking ? null : []);
	}
	function closeBlock() {
		blockStack.pop();
		currentBlock = blockStack[blockStack.length - 1] || null;
	}
	var isBlockTreeEnabled = 1;
	function setBlockTracking(value, inVOnce = false) {
		isBlockTreeEnabled += value;
		if (value < 0 && currentBlock && inVOnce) currentBlock.hasOnce = true;
	}
	function setupBlock(vnode) {
		vnode.dynamicChildren = isBlockTreeEnabled > 0 ? currentBlock || EMPTY_ARR : null;
		closeBlock();
		if (isBlockTreeEnabled > 0 && currentBlock) currentBlock.push(vnode);
		return vnode;
	}
	function createElementBlock(type, props, children, patchFlag, dynamicProps, shapeFlag) {
		return setupBlock(createBaseVNode(type, props, children, patchFlag, dynamicProps, shapeFlag, true));
	}
	function createBlock(type, props, children, patchFlag, dynamicProps) {
		return setupBlock(createVNode(type, props, children, patchFlag, dynamicProps, true));
	}
	function isVNode(value) {
		return value ? value.__v_isVNode === true : false;
	}
	function isSameVNodeType(n1, n2) {
		return n1.type === n2.type && n1.key === n2.key;
	}
	var normalizeKey = ({ key }) => key != null ? key : null;
	var normalizeRef = ({ ref, ref_key, ref_for }) => {
		if (typeof ref === "number") ref = "" + ref;
		return ref != null ? isString(ref) || isRef(ref) || isFunction(ref) ? {
			i: currentRenderingInstance,
			r: ref,
			k: ref_key,
			f: !!ref_for
		} : ref : null;
	};
	function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1, isBlockNode = false, needFullChildrenNormalization = false) {
		const vnode = {
			__v_isVNode: true,
			__v_skip: true,
			type,
			props,
			key: props && normalizeKey(props),
			ref: props && normalizeRef(props),
			scopeId: currentScopeId,
			slotScopeIds: null,
			children,
			component: null,
			suspense: null,
			ssContent: null,
			ssFallback: null,
			dirs: null,
			transition: null,
			el: null,
			anchor: null,
			target: null,
			targetStart: null,
			targetAnchor: null,
			staticCount: 0,
			shapeFlag,
			patchFlag,
			dynamicProps,
			dynamicChildren: null,
			appContext: null,
			ctx: currentRenderingInstance
		};
		if (needFullChildrenNormalization) {
			normalizeChildren(vnode, children);
			if (shapeFlag & 128) type.normalize(vnode);
		} else if (children) vnode.shapeFlag |= isString(children) ? 8 : 16;
		if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock && (vnode.patchFlag > 0 || shapeFlag & 6) && vnode.patchFlag !== 32) currentBlock.push(vnode);
		return vnode;
	}
	var createVNode = _createVNode;
	function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
		if (!type || type === NULL_DYNAMIC_COMPONENT) type = Comment;
		if (isVNode(type)) {
			const cloned = cloneVNode(type, props, true);
			if (children) normalizeChildren(cloned, children);
			if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) if (cloned.shapeFlag & 6) currentBlock[currentBlock.indexOf(type)] = cloned;
			else currentBlock.push(cloned);
			cloned.patchFlag = -2;
			return cloned;
		}
		if (isClassComponent(type)) type = type.__vccOpts;
		if (props) {
			props = guardReactiveProps(props);
			let { class: klass, style } = props;
			if (klass && !isString(klass)) props.class = normalizeClass(klass);
			if (isObject$1(style)) {
				if (isProxy(style) && !isArray(style)) style = extend$1({}, style);
				props.style = normalizeStyle(style);
			}
		}
		const shapeFlag = isString(type) ? 1 : isSuspense(type) ? 128 : isTeleport(type) ? 64 : isObject$1(type) ? 4 : isFunction(type) ? 2 : 0;
		return createBaseVNode(type, props, children, patchFlag, dynamicProps, shapeFlag, isBlockNode, true);
	}
	function guardReactiveProps(props) {
		if (!props) return null;
		return isProxy(props) || isInternalObject(props) ? extend$1({}, props) : props;
	}
	function cloneVNode(vnode, extraProps, mergeRef = false, cloneTransition = false) {
		const { props, ref, patchFlag, children, transition } = vnode;
		const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
		const cloned = {
			__v_isVNode: true,
			__v_skip: true,
			type: vnode.type,
			props: mergedProps,
			key: mergedProps && normalizeKey(mergedProps),
			ref: extraProps && extraProps.ref ? mergeRef && ref ? isArray(ref) ? ref.concat(normalizeRef(extraProps)) : [ref, normalizeRef(extraProps)] : normalizeRef(extraProps) : ref,
			scopeId: vnode.scopeId,
			slotScopeIds: vnode.slotScopeIds,
			children,
			target: vnode.target,
			targetStart: vnode.targetStart,
			targetAnchor: vnode.targetAnchor,
			staticCount: vnode.staticCount,
			shapeFlag: vnode.shapeFlag,
			patchFlag: extraProps && vnode.type !== Fragment ? patchFlag === -1 ? 16 : patchFlag | 16 : patchFlag,
			dynamicProps: vnode.dynamicProps,
			dynamicChildren: vnode.dynamicChildren,
			appContext: vnode.appContext,
			dirs: vnode.dirs,
			transition,
			component: vnode.component,
			suspense: vnode.suspense,
			ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
			ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
			placeholder: vnode.placeholder,
			el: vnode.el,
			anchor: vnode.anchor,
			ctx: vnode.ctx,
			ce: vnode.ce
		};
		if (transition && cloneTransition) setTransitionHooks(cloned, transition.clone(cloned));
		return cloned;
	}
	function createTextVNode(text = " ", flag = 0) {
		return createVNode(Text, null, text, flag);
	}
	function createCommentVNode(text = "", asBlock = false) {
		return asBlock ? (openBlock(), createBlock(Comment, null, text)) : createVNode(Comment, null, text);
	}
	function normalizeVNode(child) {
		if (child == null || typeof child === "boolean") return createVNode(Comment);
		else if (isArray(child)) return createVNode(Fragment, null, child.slice());
		else if (isVNode(child)) return cloneIfMounted(child);
		else return createVNode(Text, null, String(child));
	}
	function cloneIfMounted(child) {
		return child.el === null && child.patchFlag !== -1 || child.memo ? child : cloneVNode(child);
	}
	function normalizeChildren(vnode, children) {
		let type = 0;
		const { shapeFlag } = vnode;
		if (children == null) children = null;
		else if (isArray(children)) type = 16;
		else if (typeof children === "object") if (shapeFlag & 65) {
			const slot = children.default;
			if (slot) {
				slot._c && (slot._d = false);
				normalizeChildren(vnode, slot());
				slot._c && (slot._d = true);
			}
			return;
		} else {
			type = 32;
			const slotFlag = children._;
			if (!slotFlag && !isInternalObject(children)) children._ctx = currentRenderingInstance;
			else if (slotFlag === 3 && currentRenderingInstance) if (currentRenderingInstance.slots._ === 1) children._ = 1;
			else {
				children._ = 2;
				vnode.patchFlag |= 1024;
			}
		}
		else if (isFunction(children)) {
			children = {
				default: children,
				_ctx: currentRenderingInstance
			};
			type = 32;
		} else {
			children = String(children);
			if (shapeFlag & 64) {
				type = 16;
				children = [createTextVNode(children)];
			} else type = 8;
		}
		vnode.children = children;
		vnode.shapeFlag |= type;
	}
	function mergeProps(...args) {
		const ret = {};
		for (let i = 0; i < args.length; i++) {
			const toMerge = args[i];
			for (const key in toMerge) if (key === "class") {
				if (ret.class !== toMerge.class) ret.class = normalizeClass([ret.class, toMerge.class]);
			} else if (key === "style") ret.style = normalizeStyle([ret.style, toMerge.style]);
			else if (isOn(key)) {
				const existing = ret[key];
				const incoming = toMerge[key];
				if (incoming && existing !== incoming && !(isArray(existing) && existing.includes(incoming))) ret[key] = existing ? [].concat(existing, incoming) : incoming;
				else if (incoming == null && existing == null && !isModelListener(key)) ret[key] = incoming;
			} else if (key !== "") ret[key] = toMerge[key];
		}
		return ret;
	}
	function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
		callWithAsyncErrorHandling(hook, instance, 7, [vnode, prevVNode]);
	}
	var emptyAppContext = createAppContext();
	var uid = 0;
	function createComponentInstance(vnode, parent, suspense) {
		const type = vnode.type;
		const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
		const instance = {
			uid: uid++,
			vnode,
			type,
			parent,
			appContext,
			root: null,
			next: null,
			subTree: null,
			effect: null,
			update: null,
			job: null,
			scope: new EffectScope(true),
			render: null,
			proxy: null,
			exposed: null,
			exposeProxy: null,
			withProxy: null,
			provides: parent ? parent.provides : Object.create(appContext.provides),
			ids: parent ? parent.ids : [
				"",
				0,
				0
			],
			accessCache: null,
			renderCache: [],
			components: null,
			directives: null,
			propsOptions: normalizePropsOptions(type, appContext),
			emitsOptions: normalizeEmitsOptions(type, appContext),
			emit: null,
			emitted: null,
			propsDefaults: EMPTY_OBJ,
			inheritAttrs: type.inheritAttrs,
			ctx: EMPTY_OBJ,
			data: EMPTY_OBJ,
			props: EMPTY_OBJ,
			attrs: EMPTY_OBJ,
			slots: EMPTY_OBJ,
			refs: EMPTY_OBJ,
			setupState: EMPTY_OBJ,
			setupContext: null,
			suspense,
			suspenseId: suspense ? suspense.pendingId : 0,
			asyncDep: null,
			asyncResolved: false,
			isMounted: false,
			isUnmounted: false,
			isDeactivated: false,
			bc: null,
			c: null,
			bm: null,
			m: null,
			bu: null,
			u: null,
			um: null,
			bum: null,
			da: null,
			a: null,
			rtg: null,
			rtc: null,
			ec: null,
			sp: null
		};
		instance.ctx = { _: instance };
		instance.root = parent ? parent.root : instance;
		instance.emit = emit$2.bind(null, instance);
		if (vnode.ce) vnode.ce(instance);
		return instance;
	}
	var currentInstance = null;
	var getCurrentInstance = () => currentInstance || currentRenderingInstance;
	var internalSetCurrentInstance;
	var setInSSRSetupState;
	{
		const g = getGlobalThis();
		const registerGlobalSetter = (key, setter) => {
			let setters;
			if (!(setters = g[key])) setters = g[key] = [];
			setters.push(setter);
			return (v) => {
				if (setters.length > 1) setters.forEach((set) => set(v));
				else setters[0](v);
			};
		};
		internalSetCurrentInstance = registerGlobalSetter(`__VUE_INSTANCE_SETTERS__`, (v) => currentInstance = v);
		setInSSRSetupState = registerGlobalSetter(`__VUE_SSR_SETTERS__`, (v) => isInSSRComponentSetup = v);
	}
	var setCurrentInstance = (instance) => {
		const prev = currentInstance;
		internalSetCurrentInstance(instance);
		instance.scope.on();
		return () => {
			instance.scope.off();
			internalSetCurrentInstance(prev);
		};
	};
	var unsetCurrentInstance = () => {
		currentInstance && currentInstance.scope.off();
		internalSetCurrentInstance(null);
	};
	function isStatefulComponent(instance) {
		return instance.vnode.shapeFlag & 4;
	}
	var isInSSRComponentSetup = false;
	function setupComponent(instance, isSSR = false, optimized = false) {
		isSSR && setInSSRSetupState(isSSR);
		const { props, children } = instance.vnode;
		const isStateful = isStatefulComponent(instance);
		initProps(instance, props, isStateful, isSSR);
		initSlots(instance, children, optimized || isSSR);
		const setupResult = isStateful ? setupStatefulComponent(instance, isSSR) : void 0;
		isSSR && setInSSRSetupState(false);
		return setupResult;
	}
	function setupStatefulComponent(instance, isSSR) {
		const Component = instance.type;
		instance.accessCache = Object.create(null);
		instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
		const { setup } = Component;
		if (setup) {
			pauseTracking();
			const setupContext = instance.setupContext = setup.length > 1 ? createSetupContext(instance) : null;
			const reset = setCurrentInstance(instance);
			const setupResult = callWithErrorHandling(setup, instance, 0, [instance.props, setupContext]);
			const isAsyncSetup = isPromise(setupResult);
			resetTracking();
			reset();
			if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) markAsyncBoundary(instance);
			if (isAsyncSetup) {
				setupResult.then(unsetCurrentInstance, unsetCurrentInstance);
				if (isSSR) return setupResult.then((resolvedResult) => {
					handleSetupResult(instance, resolvedResult, isSSR);
				}).catch((e) => {
					handleError(e, instance, 0);
				});
				else instance.asyncDep = setupResult;
			} else handleSetupResult(instance, setupResult, isSSR);
		} else finishComponentSetup(instance, isSSR);
	}
	function handleSetupResult(instance, setupResult, isSSR) {
		if (isFunction(setupResult)) if (instance.type.__ssrInlineRender) instance.ssrRender = setupResult;
		else instance.render = setupResult;
		else if (isObject$1(setupResult)) instance.setupState = proxyRefs(setupResult);
		finishComponentSetup(instance, isSSR);
	}
	var compile;
	var installWithProxy;
	function finishComponentSetup(instance, isSSR, skipOptions) {
		const Component = instance.type;
		if (!instance.render) {
			if (!isSSR && compile && !Component.render) {
				const template = Component.template || resolveMergedOptions(instance).template;
				if (template) {
					const { isCustomElement, compilerOptions } = instance.appContext.config;
					const { delimiters, compilerOptions: componentCompilerOptions } = Component;
					Component.render = compile(template, extend$1(extend$1({
						isCustomElement,
						delimiters
					}, compilerOptions), componentCompilerOptions));
				}
			}
			instance.render = Component.render || NOOP;
			if (installWithProxy) installWithProxy(instance);
		}
		{
			const reset = setCurrentInstance(instance);
			pauseTracking();
			try {
				applyOptions(instance);
			} finally {
				resetTracking();
				reset();
			}
		}
	}
	var attrsProxyHandlers = { get(target, key) {
		track(target, "get", "");
		return target[key];
	} };
	function createSetupContext(instance) {
		const expose = (exposed) => {
			instance.exposed = exposed || {};
		};
		return {
			attrs: new Proxy(instance.attrs, attrsProxyHandlers),
			slots: instance.slots,
			emit: instance.emit,
			expose
		};
	}
	function getComponentPublicInstance(instance) {
		if (instance.exposed) return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
			get(target, key) {
				if (key in target) return target[key];
				else if (key in publicPropertiesMap) return publicPropertiesMap[key](instance);
			},
			has(target, key) {
				return key in target || key in publicPropertiesMap;
			}
		}));
		else return instance.proxy;
	}
	function getComponentName(Component, includeInferred = true) {
		return isFunction(Component) ? Component.displayName || Component.name : Component.name || includeInferred && Component.__name;
	}
	function isClassComponent(value) {
		return isFunction(value) && "__vccOpts" in value;
	}
	var computed = (getterOrOptions, debugOptions) => {
		return computed$1(getterOrOptions, debugOptions, isInSSRComponentSetup);
	};
	function h(type, propsOrChildren, children) {
		try {
			setBlockTracking(-1);
			const l = arguments.length;
			if (l === 2) if (isObject$1(propsOrChildren) && !isArray(propsOrChildren)) {
				if (isVNode(propsOrChildren)) return createVNode(type, null, [propsOrChildren]);
				return createVNode(type, propsOrChildren);
			} else return createVNode(type, null, propsOrChildren);
			else {
				if (l > 3) children = Array.prototype.slice.call(arguments, 2);
				else if (l === 3 && isVNode(children)) children = [children];
				return createVNode(type, propsOrChildren, children);
			}
		} finally {
			setBlockTracking(1);
		}
	}
	var version$1 = "3.5.34";
	var policy = void 0;
	var tt = typeof window !== "undefined" && window.trustedTypes;
	if (tt) try {
		policy = tt.createPolicy("vue", { createHTML: (val) => val });
	} catch (e) {}
	var unsafeToTrustedHTML = policy ? (val) => policy.createHTML(val) : (val) => val;
	var svgNS = "http://www.w3.org/2000/svg";
	var mathmlNS = "http://www.w3.org/1998/Math/MathML";
	var doc = typeof document !== "undefined" ? document : null;
	var templateContainer = doc && doc.createElement("template");
	var nodeOps = {
		insert: (child, parent, anchor) => {
			parent.insertBefore(child, anchor || null);
		},
		remove: (child) => {
			const parent = child.parentNode;
			if (parent) parent.removeChild(child);
		},
		createElement: (tag, namespace, is, props) => {
			const el = namespace === "svg" ? doc.createElementNS(svgNS, tag) : namespace === "mathml" ? doc.createElementNS(mathmlNS, tag) : is ? doc.createElement(tag, { is }) : doc.createElement(tag);
			if (tag === "select" && props && props.multiple != null) el.setAttribute("multiple", props.multiple);
			return el;
		},
		createText: (text) => doc.createTextNode(text),
		createComment: (text) => doc.createComment(text),
		setText: (node, text) => {
			node.nodeValue = text;
		},
		setElementText: (el, text) => {
			el.textContent = text;
		},
		parentNode: (node) => node.parentNode,
		nextSibling: (node) => node.nextSibling,
		querySelector: (selector) => doc.querySelector(selector),
		setScopeId(el, id) {
			el.setAttribute(id, "");
		},
		insertStaticContent(content, parent, anchor, namespace, start, end) {
			const before = anchor ? anchor.previousSibling : parent.lastChild;
			if (start && (start === end || start.nextSibling)) while (true) {
				parent.insertBefore(start.cloneNode(true), anchor);
				if (start === end || !(start = start.nextSibling)) break;
			}
			else {
				templateContainer.innerHTML = unsafeToTrustedHTML(namespace === "svg" ? `<svg>${content}</svg>` : namespace === "mathml" ? `<math>${content}</math>` : content);
				const template = templateContainer.content;
				if (namespace === "svg" || namespace === "mathml") {
					const wrapper = template.firstChild;
					while (wrapper.firstChild) template.appendChild(wrapper.firstChild);
					template.removeChild(wrapper);
				}
				parent.insertBefore(template, anchor);
			}
			return [before ? before.nextSibling : parent.firstChild, anchor ? anchor.previousSibling : parent.lastChild];
		}
	};
	var TRANSITION = "transition";
	var ANIMATION = "animation";
	var vtcKey = Symbol("_vtc");
	var DOMTransitionPropsValidators = {
		name: String,
		type: String,
		css: {
			type: Boolean,
			default: true
		},
		duration: [
			String,
			Number,
			Object
		],
		enterFromClass: String,
		enterActiveClass: String,
		enterToClass: String,
		appearFromClass: String,
		appearActiveClass: String,
		appearToClass: String,
		leaveFromClass: String,
		leaveActiveClass: String,
		leaveToClass: String
	};
	var TransitionPropsValidators = extend$1({}, BaseTransitionPropsValidators, DOMTransitionPropsValidators);
	var callHook = (hook, args = []) => {
		if (isArray(hook)) hook.forEach((h2) => h2(...args));
		else if (hook) hook(...args);
	};
	var hasExplicitCallback = (hook) => {
		return hook ? isArray(hook) ? hook.some((h2) => h2.length > 1) : hook.length > 1 : false;
	};
	function resolveTransitionProps(rawProps) {
		const baseProps = {};
		for (const key in rawProps) if (!(key in DOMTransitionPropsValidators)) baseProps[key] = rawProps[key];
		if (rawProps.css === false) return baseProps;
		const { name = "v", type, duration, enterFromClass = `${name}-enter-from`, enterActiveClass = `${name}-enter-active`, enterToClass = `${name}-enter-to`, appearFromClass = enterFromClass, appearActiveClass = enterActiveClass, appearToClass = enterToClass, leaveFromClass = `${name}-leave-from`, leaveActiveClass = `${name}-leave-active`, leaveToClass = `${name}-leave-to` } = rawProps;
		const durations = normalizeDuration(duration);
		const enterDuration = durations && durations[0];
		const leaveDuration = durations && durations[1];
		const { onBeforeEnter, onEnter, onEnterCancelled, onLeave, onLeaveCancelled, onBeforeAppear = onBeforeEnter, onAppear = onEnter, onAppearCancelled = onEnterCancelled } = baseProps;
		const finishEnter = (el, isAppear, done, isCancelled) => {
			el._enterCancelled = isCancelled;
			removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
			removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
			done && done();
		};
		const finishLeave = (el, done) => {
			el._isLeaving = false;
			removeTransitionClass(el, leaveFromClass);
			removeTransitionClass(el, leaveToClass);
			removeTransitionClass(el, leaveActiveClass);
			done && done();
		};
		const makeEnterHook = (isAppear) => {
			return (el, done) => {
				const hook = isAppear ? onAppear : onEnter;
				const resolve = () => finishEnter(el, isAppear, done);
				callHook(hook, [el, resolve]);
				nextFrame(() => {
					removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
					addTransitionClass(el, isAppear ? appearToClass : enterToClass);
					if (!hasExplicitCallback(hook)) whenTransitionEnds(el, type, enterDuration, resolve);
				});
			};
		};
		return extend$1(baseProps, {
			onBeforeEnter(el) {
				callHook(onBeforeEnter, [el]);
				addTransitionClass(el, enterFromClass);
				addTransitionClass(el, enterActiveClass);
			},
			onBeforeAppear(el) {
				callHook(onBeforeAppear, [el]);
				addTransitionClass(el, appearFromClass);
				addTransitionClass(el, appearActiveClass);
			},
			onEnter: makeEnterHook(false),
			onAppear: makeEnterHook(true),
			onLeave(el, done) {
				el._isLeaving = true;
				const resolve = () => finishLeave(el, done);
				addTransitionClass(el, leaveFromClass);
				if (!el._enterCancelled) {
					forceReflow(el);
					addTransitionClass(el, leaveActiveClass);
				} else {
					addTransitionClass(el, leaveActiveClass);
					forceReflow(el);
				}
				nextFrame(() => {
					if (!el._isLeaving) return;
					removeTransitionClass(el, leaveFromClass);
					addTransitionClass(el, leaveToClass);
					if (!hasExplicitCallback(onLeave)) whenTransitionEnds(el, type, leaveDuration, resolve);
				});
				callHook(onLeave, [el, resolve]);
			},
			onEnterCancelled(el) {
				finishEnter(el, false, void 0, true);
				callHook(onEnterCancelled, [el]);
			},
			onAppearCancelled(el) {
				finishEnter(el, true, void 0, true);
				callHook(onAppearCancelled, [el]);
			},
			onLeaveCancelled(el) {
				finishLeave(el);
				callHook(onLeaveCancelled, [el]);
			}
		});
	}
	function normalizeDuration(duration) {
		if (duration == null) return null;
		else if (isObject$1(duration)) return [NumberOf(duration.enter), NumberOf(duration.leave)];
		else {
			const n = NumberOf(duration);
			return [n, n];
		}
	}
	function NumberOf(val) {
		return toNumber(val);
	}
	function addTransitionClass(el, cls) {
		cls.split(/\s+/).forEach((c) => c && el.classList.add(c));
		(el[vtcKey] || (el[vtcKey] = new Set())).add(cls);
	}
	function removeTransitionClass(el, cls) {
		cls.split(/\s+/).forEach((c) => c && el.classList.remove(c));
		const _vtc = el[vtcKey];
		if (_vtc) {
			_vtc.delete(cls);
			if (!_vtc.size) el[vtcKey] = void 0;
		}
	}
	function nextFrame(cb) {
		requestAnimationFrame(() => {
			requestAnimationFrame(cb);
		});
	}
	var endId = 0;
	function whenTransitionEnds(el, expectedType, explicitTimeout, resolve) {
		const id = el._endId = ++endId;
		const resolveIfNotStale = () => {
			if (id === el._endId) resolve();
		};
		if (explicitTimeout != null) return setTimeout(resolveIfNotStale, explicitTimeout);
		const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
		if (!type) return resolve();
		const endEvent = type + "end";
		let ended = 0;
		const end = () => {
			el.removeEventListener(endEvent, onEnd);
			resolveIfNotStale();
		};
		const onEnd = (e) => {
			if (e.target === el && ++ended >= propCount) end();
		};
		setTimeout(() => {
			if (ended < propCount) end();
		}, timeout + 1);
		el.addEventListener(endEvent, onEnd);
	}
	function getTransitionInfo(el, expectedType) {
		const styles = window.getComputedStyle(el);
		const getStyleProperties = (key) => (styles[key] || "").split(", ");
		const transitionDelays = getStyleProperties(`${TRANSITION}Delay`);
		const transitionDurations = getStyleProperties(`${TRANSITION}Duration`);
		const transitionTimeout = getTimeout(transitionDelays, transitionDurations);
		const animationDelays = getStyleProperties(`${ANIMATION}Delay`);
		const animationDurations = getStyleProperties(`${ANIMATION}Duration`);
		const animationTimeout = getTimeout(animationDelays, animationDurations);
		let type = null;
		let timeout = 0;
		let propCount = 0;
		if (expectedType === TRANSITION) {
			if (transitionTimeout > 0) {
				type = TRANSITION;
				timeout = transitionTimeout;
				propCount = transitionDurations.length;
			}
		} else if (expectedType === ANIMATION) {
			if (animationTimeout > 0) {
				type = ANIMATION;
				timeout = animationTimeout;
				propCount = animationDurations.length;
			}
		} else {
			timeout = Math.max(transitionTimeout, animationTimeout);
			type = timeout > 0 ? transitionTimeout > animationTimeout ? TRANSITION : ANIMATION : null;
			propCount = type ? type === TRANSITION ? transitionDurations.length : animationDurations.length : 0;
		}
		const hasTransform = type === TRANSITION && /\b(?:transform|all)(?:,|$)/.test(getStyleProperties(`${TRANSITION}Property`).toString());
		return {
			type,
			timeout,
			propCount,
			hasTransform
		};
	}
	function getTimeout(delays, durations) {
		while (delays.length < durations.length) delays = delays.concat(delays);
		return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])));
	}
	function toMs(s) {
		if (s === "auto") return 0;
		return Number(s.slice(0, -1).replace(",", ".")) * 1e3;
	}
	function forceReflow(el) {
		return (el ? el.ownerDocument : document).body.offsetHeight;
	}
	function patchClass(el, value, isSVG) {
		const transitionClasses = el[vtcKey];
		if (transitionClasses) value = (value ? [value, ...transitionClasses] : [...transitionClasses]).join(" ");
		if (value == null) el.removeAttribute("class");
		else if (isSVG) el.setAttribute("class", value);
		else el.className = value;
	}
	var vShowOriginalDisplay = Symbol("_vod");
	var vShowHidden = Symbol("_vsh");
	var vShow = {
		name: "show",
		beforeMount(el, { value }, { transition }) {
			el[vShowOriginalDisplay] = el.style.display === "none" ? "" : el.style.display;
			if (transition && value) transition.beforeEnter(el);
			else setDisplay(el, value);
		},
		mounted(el, { value }, { transition }) {
			if (transition && value) transition.enter(el);
		},
		updated(el, { value, oldValue }, { transition }) {
			if (!value === !oldValue) return;
			if (transition) if (value) {
				transition.beforeEnter(el);
				setDisplay(el, true);
				transition.enter(el);
			} else transition.leave(el, () => {
				setDisplay(el, false);
			});
			else setDisplay(el, value);
		},
		beforeUnmount(el, { value }) {
			setDisplay(el, value);
		}
	};
	function setDisplay(el, value) {
		el.style.display = value ? el[vShowOriginalDisplay] : "none";
		el[vShowHidden] = !value;
	}
	var CSS_VAR_TEXT = Symbol("");
	var displayRE = /(?:^|;)\s*display\s*:/;
	function patchStyle(el, prev, next) {
		const style = el.style;
		const isCssString = isString(next);
		let hasControlledDisplay = false;
		if (next && !isCssString) {
			if (prev) if (!isString(prev)) {
				for (const key in prev) if (next[key] == null) setStyle(style, key, "");
			} else for (const prevStyle of prev.split(";")) {
				const key = prevStyle.slice(0, prevStyle.indexOf(":")).trim();
				if (next[key] == null) setStyle(style, key, "");
			}
			for (const key in next) {
				if (key === "display") hasControlledDisplay = true;
				const value = next[key];
				if (value != null) {
					if (!shouldPreserveTextareaResizeStyle(el, key, !isString(prev) && prev ? prev[key] : void 0, value)) setStyle(style, key, value);
				} else setStyle(style, key, "");
			}
		} else if (isCssString) {
			if (prev !== next) {
				const cssVarText = style[CSS_VAR_TEXT];
				if (cssVarText) next += ";" + cssVarText;
				style.cssText = next;
				hasControlledDisplay = displayRE.test(next);
			}
		} else if (prev) el.removeAttribute("style");
		if (vShowOriginalDisplay in el) {
			el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : "";
			if (el[vShowHidden]) style.display = "none";
		}
	}
	var importantRE = /\s*!important$/;
	function setStyle(style, name, val) {
		if (isArray(val)) val.forEach((v) => setStyle(style, name, v));
		else {
			if (val == null) val = "";
			if (name.startsWith("--")) style.setProperty(name, val);
			else {
				const prefixed = autoPrefix(style, name);
				if (importantRE.test(val)) style.setProperty(hyphenate$1(prefixed), val.replace(importantRE, ""), "important");
				else style[prefixed] = val;
			}
		}
	}
	var prefixes = [
		"Webkit",
		"Moz",
		"ms"
	];
	var prefixCache = {};
	function autoPrefix(style, rawName) {
		const cached = prefixCache[rawName];
		if (cached) return cached;
		let name = camelize$2(rawName);
		if (name !== "filter" && name in style) return prefixCache[rawName] = name;
		name = capitalize(name);
		for (let i = 0; i < prefixes.length; i++) {
			const prefixed = prefixes[i] + name;
			if (prefixed in style) return prefixCache[rawName] = prefixed;
		}
		return rawName;
	}
	function shouldPreserveTextareaResizeStyle(el, key, prev, next) {
		return el.tagName === "TEXTAREA" && (key === "width" || key === "height") && isString(next) && prev === next;
	}
	var xlinkNS = "http://www.w3.org/1999/xlink";
	function patchAttr(el, key, value, isSVG, instance, isBoolean = isSpecialBooleanAttr(key)) {
		if (isSVG && key.startsWith("xlink:")) if (value == null) el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
		else el.setAttributeNS(xlinkNS, key, value);
		else if (value == null || isBoolean && !includeBooleanAttr(value)) el.removeAttribute(key);
		else el.setAttribute(key, isBoolean ? "" : isSymbol(value) ? String(value) : value);
	}
	function patchDOMProp(el, key, value, parentComponent, attrName) {
		if (key === "innerHTML" || key === "textContent") {
			if (value != null) el[key] = key === "innerHTML" ? unsafeToTrustedHTML(value) : value;
			return;
		}
		const tag = el.tagName;
		if (key === "value" && tag !== "PROGRESS" && !tag.includes("-")) {
			const oldValue = tag === "OPTION" ? el.getAttribute("value") || "" : el.value;
			const newValue = value == null ? el.type === "checkbox" ? "on" : "" : String(value);
			if (oldValue !== newValue || !("_value" in el)) el.value = newValue;
			if (value == null) el.removeAttribute(key);
			el._value = value;
			return;
		}
		let needRemove = false;
		if (value === "" || value == null) {
			const type = typeof el[key];
			if (type === "boolean") value = includeBooleanAttr(value);
			else if (value == null && type === "string") {
				value = "";
				needRemove = true;
			} else if (type === "number") {
				value = 0;
				needRemove = true;
			}
		}
		try {
			el[key] = value;
		} catch (e) {}
		needRemove && el.removeAttribute(attrName || key);
	}
	function addEventListener(el, event, handler, options) {
		el.addEventListener(event, handler, options);
	}
	function removeEventListener(el, event, handler, options) {
		el.removeEventListener(event, handler, options);
	}
	var veiKey = Symbol("_vei");
	function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
		const invokers = el[veiKey] || (el[veiKey] = {});
		const existingInvoker = invokers[rawName];
		if (nextValue && existingInvoker) existingInvoker.value = nextValue;
		else {
			const [name, options] = parseName(rawName);
			if (nextValue) addEventListener(el, name, invokers[rawName] = createInvoker(nextValue, instance), options);
			else if (existingInvoker) {
				removeEventListener(el, name, existingInvoker, options);
				invokers[rawName] = void 0;
			}
		}
	}
	var optionsModifierRE = /(?:Once|Passive|Capture)$/;
	function parseName(name) {
		let options;
		if (optionsModifierRE.test(name)) {
			options = {};
			let m;
			while (m = name.match(optionsModifierRE)) {
				name = name.slice(0, name.length - m[0].length);
				options[m[0].toLowerCase()] = true;
			}
		}
		return [name[2] === ":" ? name.slice(3) : hyphenate$1(name.slice(2)), options];
	}
	var cachedNow = 0;
	var p = Promise.resolve();
	var getNow = () => cachedNow || (p.then(() => cachedNow = 0), cachedNow = Date.now());
	function createInvoker(initialValue, instance) {
		const invoker = (e) => {
			if (!e._vts) e._vts = Date.now();
			else if (e._vts <= invoker.attached) return;
			callWithAsyncErrorHandling(patchStopImmediatePropagation(e, invoker.value), instance, 5, [e]);
		};
		invoker.value = initialValue;
		invoker.attached = getNow();
		return invoker;
	}
	function patchStopImmediatePropagation(e, value) {
		if (isArray(value)) {
			const originalStop = e.stopImmediatePropagation;
			e.stopImmediatePropagation = () => {
				originalStop.call(e);
				e._stopped = true;
			};
			return value.map((fn) => (e2) => !e2._stopped && fn && fn(e2));
		} else return value;
	}
	var isNativeOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && key.charCodeAt(2) > 96 && key.charCodeAt(2) < 123;
	var patchProp = (el, key, prevValue, nextValue, namespace, parentComponent) => {
		const isSVG = namespace === "svg";
		if (key === "class") patchClass(el, nextValue, isSVG);
		else if (key === "style") patchStyle(el, prevValue, nextValue);
		else if (isOn(key)) {
			if (!isModelListener(key)) patchEvent(el, key, prevValue, nextValue, parentComponent);
		} else if (key[0] === "." ? (key = key.slice(1), true) : key[0] === "^" ? (key = key.slice(1), false) : shouldSetAsProp(el, key, nextValue, isSVG)) {
			patchDOMProp(el, key, nextValue);
			if (!el.tagName.includes("-") && (key === "value" || key === "checked" || key === "selected")) patchAttr(el, key, nextValue, isSVG, parentComponent, key !== "value");
		} else if (el._isVueCE && (shouldSetAsPropForVueCE(el, key) || el._def.__asyncLoader && (/[A-Z]/.test(key) || !isString(nextValue)))) patchDOMProp(el, camelize$2(key), nextValue, parentComponent, key);
		else {
			if (key === "true-value") el._trueValue = nextValue;
			else if (key === "false-value") el._falseValue = nextValue;
			patchAttr(el, key, nextValue, isSVG);
		}
	};
	function shouldSetAsProp(el, key, value, isSVG) {
		if (isSVG) {
			if (key === "innerHTML" || key === "textContent") return true;
			if (key in el && isNativeOn(key) && isFunction(value)) return true;
			return false;
		}
		if (key === "spellcheck" || key === "draggable" || key === "translate" || key === "autocorrect") return false;
		if (key === "sandbox" && el.tagName === "IFRAME") return false;
		if (key === "form") return false;
		if (key === "list" && el.tagName === "INPUT") return false;
		if (key === "type" && el.tagName === "TEXTAREA") return false;
		if (key === "width" || key === "height") {
			const tag = el.tagName;
			if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SOURCE") return false;
		}
		if (isNativeOn(key) && isString(value)) return false;
		return key in el;
	}
	function shouldSetAsPropForVueCE(el, key) {
		const props = el._def.props;
		if (!props) return false;
		const camelKey = camelize$2(key);
		return Array.isArray(props) ? props.some((prop) => camelize$2(prop) === camelKey) : Object.keys(props).some((prop) => camelize$2(prop) === camelKey);
	}
	var positionMap = new WeakMap();
	var newPositionMap = new WeakMap();
	var moveCbKey = Symbol("_moveCb");
	var enterCbKey = Symbol("_enterCb");
	var decorate = (t) => {
		delete t.props.mode;
		return t;
	};
	var TransitionGroup = decorate({
		name: "TransitionGroup",
		props: extend$1({}, TransitionPropsValidators, {
			tag: String,
			moveClass: String
		}),
		setup(props, { slots }) {
			const instance = getCurrentInstance();
			const state = useTransitionState();
			let prevChildren;
			let children;
			onUpdated(() => {
				if (!prevChildren.length) return;
				const moveClass = props.moveClass || `${props.name || "v"}-move`;
				if (!hasCSSTransform(prevChildren[0].el, instance.vnode.el, moveClass)) {
					prevChildren = [];
					return;
				}
				prevChildren.forEach(callPendingCbs);
				prevChildren.forEach(recordPosition);
				const movedChildren = prevChildren.filter(applyTranslation);
				forceReflow(instance.vnode.el);
				movedChildren.forEach((c) => {
					const el = c.el;
					const style = el.style;
					addTransitionClass(el, moveClass);
					style.transform = style.webkitTransform = style.transitionDuration = "";
					const cb = el[moveCbKey] = (e) => {
						if (e && e.target !== el) return;
						if (!e || e.propertyName.endsWith("transform")) {
							el.removeEventListener("transitionend", cb);
							el[moveCbKey] = null;
							removeTransitionClass(el, moveClass);
						}
					};
					el.addEventListener("transitionend", cb);
				});
				prevChildren = [];
			});
			return () => {
				const rawProps = toRaw(props);
				const cssTransitionProps = resolveTransitionProps(rawProps);
				let tag = rawProps.tag || Fragment;
				prevChildren = [];
				if (children) for (let i = 0; i < children.length; i++) {
					const child = children[i];
					if (child.el && child.el instanceof Element) {
						prevChildren.push(child);
						setTransitionHooks(child, resolveTransitionHooks(child, cssTransitionProps, state, instance));
						positionMap.set(child, getPosition(child.el));
					}
				}
				children = slots.default ? getTransitionRawChildren(slots.default()) : [];
				for (let i = 0; i < children.length; i++) {
					const child = children[i];
					if (child.key != null) setTransitionHooks(child, resolveTransitionHooks(child, cssTransitionProps, state, instance));
				}
				return createVNode(tag, null, children);
			};
		}
	});
	function callPendingCbs(c) {
		const el = c.el;
		if (el[moveCbKey]) el[moveCbKey]();
		if (el[enterCbKey]) el[enterCbKey]();
	}
	function recordPosition(c) {
		newPositionMap.set(c, getPosition(c.el));
	}
	function applyTranslation(c) {
		const oldPos = positionMap.get(c);
		const newPos = newPositionMap.get(c);
		const dx = oldPos.left - newPos.left;
		const dy = oldPos.top - newPos.top;
		if (dx || dy) {
			const el = c.el;
			const s = el.style;
			const rect = el.getBoundingClientRect();
			let scaleX = 1;
			let scaleY = 1;
			if (el.offsetWidth) scaleX = rect.width / el.offsetWidth;
			if (el.offsetHeight) scaleY = rect.height / el.offsetHeight;
			if (!Number.isFinite(scaleX) || scaleX === 0) scaleX = 1;
			if (!Number.isFinite(scaleY) || scaleY === 0) scaleY = 1;
			if (Math.abs(scaleX - 1) < .01) scaleX = 1;
			if (Math.abs(scaleY - 1) < .01) scaleY = 1;
			s.transform = s.webkitTransform = `translate(${dx / scaleX}px,${dy / scaleY}px)`;
			s.transitionDuration = "0s";
			return c;
		}
	}
	function getPosition(el) {
		const rect = el.getBoundingClientRect();
		return {
			left: rect.left,
			top: rect.top
		};
	}
	function hasCSSTransform(el, root, moveClass) {
		const clone = el.cloneNode();
		const _vtc = el[vtcKey];
		if (_vtc) _vtc.forEach((cls) => {
			cls.split(/\s+/).forEach((c) => c && clone.classList.remove(c));
		});
		moveClass.split(/\s+/).forEach((c) => c && clone.classList.add(c));
		clone.style.display = "none";
		const container = root.nodeType === 1 ? root : root.parentNode;
		container.appendChild(clone);
		const { hasTransform } = getTransitionInfo(clone);
		container.removeChild(clone);
		return hasTransform;
	}
	var getModelAssigner = (vnode) => {
		const fn = vnode.props["onUpdate:modelValue"] || false;
		return isArray(fn) ? (value) => invokeArrayFns(fn, value) : fn;
	};
	function onCompositionStart(e) {
		e.target.composing = true;
	}
	function onCompositionEnd(e) {
		const target = e.target;
		if (target.composing) {
			target.composing = false;
			target.dispatchEvent(new Event("input"));
		}
	}
	var assignKey = Symbol("_assign");
	function castValue(value, trim, number) {
		if (trim) value = value.trim();
		if (number) value = looseToNumber(value);
		return value;
	}
	var vModelText = {
		created(el, { modifiers: { lazy, trim, number } }, vnode) {
			el[assignKey] = getModelAssigner(vnode);
			const castToNumber = number || vnode.props && vnode.props.type === "number";
			addEventListener(el, lazy ? "change" : "input", (e) => {
				if (e.target.composing) return;
				el[assignKey](castValue(el.value, trim, castToNumber));
			});
			if (trim || castToNumber) addEventListener(el, "change", () => {
				el.value = castValue(el.value, trim, castToNumber);
			});
			if (!lazy) {
				addEventListener(el, "compositionstart", onCompositionStart);
				addEventListener(el, "compositionend", onCompositionEnd);
				addEventListener(el, "change", onCompositionEnd);
			}
		},
		mounted(el, { value }) {
			el.value = value == null ? "" : value;
		},
		beforeUpdate(el, { value, oldValue, modifiers: { lazy, trim, number } }, vnode) {
			el[assignKey] = getModelAssigner(vnode);
			if (el.composing) return;
			const elValue = (number || el.type === "number") && !/^0\d/.test(el.value) ? looseToNumber(el.value) : el.value;
			const newValue = value == null ? "" : value;
			if (elValue === newValue) return;
			const rootNode = el.getRootNode();
			if ((rootNode instanceof Document || rootNode instanceof ShadowRoot) && rootNode.activeElement === el && el.type !== "range") {
				if (lazy && value === oldValue) return;
				if (trim && el.value.trim() === newValue) return;
			}
			el.value = newValue;
		}
	};
	var vModelCheckbox = {
		deep: true,
		created(el, _, vnode) {
			el[assignKey] = getModelAssigner(vnode);
			addEventListener(el, "change", () => {
				const modelValue = el._modelValue;
				const elementValue = getValue(el);
				const checked = el.checked;
				const assign = el[assignKey];
				if (isArray(modelValue)) {
					const index = looseIndexOf(modelValue, elementValue);
					const found = index !== -1;
					if (checked && !found) assign(modelValue.concat(elementValue));
					else if (!checked && found) {
						const filtered = [...modelValue];
						filtered.splice(index, 1);
						assign(filtered);
					}
				} else if (isSet(modelValue)) {
					const cloned = new Set(modelValue);
					if (checked) cloned.add(elementValue);
					else cloned.delete(elementValue);
					assign(cloned);
				} else assign(getCheckboxValue(el, checked));
			});
		},
		mounted: setChecked,
		beforeUpdate(el, binding, vnode) {
			el[assignKey] = getModelAssigner(vnode);
			setChecked(el, binding, vnode);
		}
	};
	function setChecked(el, { value, oldValue }, vnode) {
		el._modelValue = value;
		let checked;
		if (isArray(value)) checked = looseIndexOf(value, vnode.props.value) > -1;
		else if (isSet(value)) checked = value.has(vnode.props.value);
		else {
			if (value === oldValue) return;
			checked = looseEqual(value, getCheckboxValue(el, true));
		}
		if (el.checked !== checked) el.checked = checked;
	}
	var vModelSelect = {
		deep: true,
		created(el, { value, modifiers: { number } }, vnode) {
			const isSetModel = isSet(value);
			addEventListener(el, "change", () => {
				const selectedVal = Array.prototype.filter.call(el.options, (o) => o.selected).map((o) => number ? looseToNumber(getValue(o)) : getValue(o));
				el[assignKey](el.multiple ? isSetModel ? new Set(selectedVal) : selectedVal : selectedVal[0]);
				el._assigning = true;
				nextTick(() => {
					el._assigning = false;
				});
			});
			el[assignKey] = getModelAssigner(vnode);
		},
		mounted(el, { value }) {
			setSelected(el, value);
		},
		beforeUpdate(el, _binding, vnode) {
			el[assignKey] = getModelAssigner(vnode);
		},
		updated(el, { value }) {
			if (!el._assigning) setSelected(el, value);
		}
	};
	function setSelected(el, value) {
		const isMultiple = el.multiple;
		const isArrayValue = isArray(value);
		if (isMultiple && !isArrayValue && !isSet(value)) return;
		for (let i = 0, l = el.options.length; i < l; i++) {
			const option = el.options[i];
			const optionValue = getValue(option);
			if (isMultiple) if (isArrayValue) {
				const optionType = typeof optionValue;
				if (optionType === "string" || optionType === "number") option.selected = value.some((v) => String(v) === String(optionValue));
				else option.selected = looseIndexOf(value, optionValue) > -1;
			} else option.selected = value.has(optionValue);
			else if (looseEqual(getValue(option), value)) {
				if (el.selectedIndex !== i) el.selectedIndex = i;
				return;
			}
		}
		if (!isMultiple && el.selectedIndex !== -1) el.selectedIndex = -1;
	}
	function getValue(el) {
		return "_value" in el ? el._value : el.value;
	}
	function getCheckboxValue(el, checked) {
		const key = checked ? "_trueValue" : "_falseValue";
		return key in el ? el[key] : checked;
	}
	var systemModifiers = [
		"ctrl",
		"shift",
		"alt",
		"meta"
	];
	var modifierGuards = {
		stop: (e) => e.stopPropagation(),
		prevent: (e) => e.preventDefault(),
		self: (e) => e.target !== e.currentTarget,
		ctrl: (e) => !e.ctrlKey,
		shift: (e) => !e.shiftKey,
		alt: (e) => !e.altKey,
		meta: (e) => !e.metaKey,
		left: (e) => "button" in e && e.button !== 0,
		middle: (e) => "button" in e && e.button !== 1,
		right: (e) => "button" in e && e.button !== 2,
		exact: (e, modifiers) => systemModifiers.some((m) => e[`${m}Key`] && !modifiers.includes(m))
	};
	var withModifiers = (fn, modifiers) => {
		if (!fn) return fn;
		const cache = fn._withMods || (fn._withMods = {});
		const cacheKey = modifiers.join(".");
		return cache[cacheKey] || (cache[cacheKey] = ((event, ...args) => {
			for (let i = 0; i < modifiers.length; i++) {
				const guard = modifierGuards[modifiers[i]];
				if (guard && guard(event, modifiers)) return;
			}
			return fn(event, ...args);
		}));
	};
	var keyNames = {
		esc: "escape",
		space: " ",
		up: "arrow-up",
		left: "arrow-left",
		right: "arrow-right",
		down: "arrow-down",
		delete: "backspace"
	};
	var withKeys = (fn, modifiers) => {
		const cache = fn._withKeys || (fn._withKeys = {});
		const cacheKey = modifiers.join(".");
		return cache[cacheKey] || (cache[cacheKey] = ((event) => {
			if (!("key" in event)) return;
			const eventKey = hyphenate$1(event.key);
			if (modifiers.some((k) => k === eventKey || keyNames[k] === eventKey)) return fn(event);
		}));
	};
	var rendererOptions = extend$1({ patchProp }, nodeOps);
	var renderer;
	function ensureRenderer() {
		return renderer || (renderer = createRenderer(rendererOptions));
	}
	var createApp = ((...args) => {
		const app = ensureRenderer().createApp(...args);
		const { mount } = app;
		app.mount = (containerOrSelector) => {
			const container = normalizeContainer(containerOrSelector);
			if (!container) return;
			const component = app._component;
			if (!isFunction(component) && !component.render && !component.template) component.template = container.innerHTML;
			if (container.nodeType === 1) container.textContent = "";
			const proxy = mount(container, false, resolveRootNamespace(container));
			if (container instanceof Element) {
				container.removeAttribute("v-cloak");
				container.setAttribute("data-v-app", "");
			}
			return proxy;
		};
		return app;
	});
	function resolveRootNamespace(container) {
		if (container instanceof SVGElement) return "svg";
		if (typeof MathMLElement === "function" && container instanceof MathMLElement) return "mathml";
	}
	function normalizeContainer(container) {
		if (isString(container)) return document.querySelector(container);
		return container;
	}
	function tryOnScopeDispose(fn, failSilently) {
		if (getCurrentScope()) {
			onScopeDispose(fn, failSilently);
			return true;
		}
		return false;
	}
	var isClient = typeof window !== "undefined" && typeof document !== "undefined";
	typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope;
	var toString = Object.prototype.toString;
	var isObject = (val) => toString.call(val) === "[object Object]";
	var noop = () => {};
	var isIOS = getIsIOS();
	function getIsIOS() {
		var _window, _window2, _window3;
		return isClient && !!((_window = window) === null || _window === void 0 || (_window = _window.navigator) === null || _window === void 0 ? void 0 : _window.userAgent) && (/iP(?:ad|hone|od)/.test(window.navigator.userAgent) || ((_window2 = window) === null || _window2 === void 0 || (_window2 = _window2.navigator) === null || _window2 === void 0 ? void 0 : _window2.maxTouchPoints) > 2 && /iPad|Macintosh/.test((_window3 = window) === null || _window3 === void 0 ? void 0 : _window3.navigator.userAgent));
	}
	function toRef(...args) {
		if (args.length !== 1) return toRef$1(...args);
		const r = args[0];
		return typeof r === "function" ? readonly(customRef(() => ({
			get: r,
			set: noop
		}))) : ref(r);
	}
	function createSingletonPromise(fn) {
		let _promise;
		function wrapper() {
			if (!_promise) _promise = fn();
			return _promise;
		}
		wrapper.reset = async () => {
			const _prev = _promise;
			_promise = void 0;
			if (_prev) await _prev;
		};
		return wrapper;
	}
	function toArray(value) {
		return Array.isArray(value) ? value : [value];
	}
	function useTimeoutFn(cb, interval, options = {}) {
		const { immediate = true, immediateCallback = false } = options;
		const isPending = shallowRef(false);
		let timer;
		function clear() {
			if (timer) {
				clearTimeout(timer);
				timer = void 0;
			}
		}
		function stop() {
			isPending.value = false;
			clear();
		}
		function start(...args) {
			if (immediateCallback) cb();
			clear();
			isPending.value = true;
			timer = setTimeout(() => {
				isPending.value = false;
				timer = void 0;
				cb(...args);
			}, toValue$1(interval));
		}
		if (immediate) {
			isPending.value = true;
			if (isClient) start();
		}
		tryOnScopeDispose(stop);
		return {
			isPending: shallowReadonly(isPending),
			start,
			stop
		};
	}
	function watchImmediate(source, cb, options) {
		return watch(source, cb, {
			...options,
			immediate: true
		});
	}
	var defaultWindow = isClient ? window : void 0;
	isClient && window.document;
	var defaultNavigator = isClient ? window.navigator : void 0;
	isClient && window.location;
	function unrefElement(elRef) {
		var _$el;
		const plain = toValue$1(elRef);
		return (_$el = plain === null || plain === void 0 ? void 0 : plain.$el) !== null && _$el !== void 0 ? _$el : plain;
	}
	function useEventListener(...args) {
		const register = (el, event, listener, options) => {
			el.addEventListener(event, listener, options);
			return () => el.removeEventListener(event, listener, options);
		};
		const firstParamTargets = computed(() => {
			const test = toArray(toValue$1(args[0])).filter((e) => e != null);
			return test.every((e) => typeof e !== "string") ? test : void 0;
		});
		return watchImmediate(() => {
			var _firstParamTargets$va, _firstParamTargets$va2;
			return [
				(_firstParamTargets$va = (_firstParamTargets$va2 = firstParamTargets.value) === null || _firstParamTargets$va2 === void 0 ? void 0 : _firstParamTargets$va2.map((e) => unrefElement(e))) !== null && _firstParamTargets$va !== void 0 ? _firstParamTargets$va : [defaultWindow].filter((e) => e != null),
				toArray(toValue$1(firstParamTargets.value ? args[1] : args[0])),
				toArray(unref(firstParamTargets.value ? args[2] : args[1])),
				toValue$1(firstParamTargets.value ? args[3] : args[2])
			];
		}, ([raw_targets, raw_events, raw_listeners, raw_options], _, onCleanup) => {
			if (!(raw_targets === null || raw_targets === void 0 ? void 0 : raw_targets.length) || !(raw_events === null || raw_events === void 0 ? void 0 : raw_events.length) || !(raw_listeners === null || raw_listeners === void 0 ? void 0 : raw_listeners.length)) return;
			const optionsClone = isObject(raw_options) ? { ...raw_options } : raw_options;
			const cleanups = raw_targets.flatMap((el) => raw_events.flatMap((event) => raw_listeners.map((listener) => register(el, event, listener, optionsClone))));
			onCleanup(() => {
				cleanups.forEach((fn) => fn());
			});
		}, { flush: "post" });
	}
	var _iOSWorkaround = false;
	function onClickOutside(target, handler, options = {}) {
		const { window = defaultWindow, ignore = [], capture = true, detectIframe = false, controls = false } = options;
		if (!window) return controls ? {
			stop: noop,
			cancel: noop,
			trigger: noop
		} : noop;
		if (isIOS && !_iOSWorkaround) {
			_iOSWorkaround = true;
			const listenerOptions = { passive: true };
			Array.from(window.document.body.children).forEach((el) => el.addEventListener("click", noop, listenerOptions));
			window.document.documentElement.addEventListener("click", noop, listenerOptions);
		}
		let shouldListen = true;
		const shouldIgnore = (event) => {
			return toValue$1(ignore).some((target) => {
				if (typeof target === "string") return Array.from(window.document.querySelectorAll(target)).some((el) => el === event.target || event.composedPath().includes(el));
				else {
					const el = unrefElement(target);
					return el && (event.target === el || event.composedPath().includes(el));
				}
			});
		};
		function hasMultipleRoots(target) {
			const vm = toValue$1(target);
			return vm && vm.$.subTree.shapeFlag === 16;
		}
		function checkMultipleRoots(target, event) {
			const vm = toValue$1(target);
			const children = vm.$.subTree && vm.$.subTree.children;
			if (children == null || !Array.isArray(children)) return false;
			return children.some((child) => child.el === event.target || event.composedPath().includes(child.el));
		}
		const listener = (event) => {
			const el = unrefElement(target);
			if (event.target == null) return;
			if (!(el instanceof Element) && hasMultipleRoots(target) && checkMultipleRoots(target, event)) return;
			if (!el || el === event.target || event.composedPath().includes(el)) return;
			if ("detail" in event && event.detail === 0) shouldListen = !shouldIgnore(event);
			if (!shouldListen) {
				shouldListen = true;
				return;
			}
			handler(event);
		};
		let isProcessingClick = false;
		const cleanup = [
			useEventListener(window, "click", (event) => {
				if (!isProcessingClick) {
					isProcessingClick = true;
					setTimeout(() => {
						isProcessingClick = false;
					}, 0);
					listener(event);
				}
			}, {
				passive: true,
				capture
			}),
			useEventListener(window, "pointerdown", (e) => {
				const el = unrefElement(target);
				shouldListen = !shouldIgnore(e) && !!(el && !e.composedPath().includes(el));
			}, { passive: true }),
			detectIframe && useEventListener(window, "blur", (event) => {
				setTimeout(() => {
					const el = unrefElement(target);
					let activeEl = window.document.activeElement;
					while (activeEl === null || activeEl === void 0 ? void 0 : activeEl.shadowRoot) activeEl = activeEl.shadowRoot.activeElement;
					if ((activeEl === null || activeEl === void 0 ? void 0 : activeEl.tagName) === "IFRAME" && !(el === null || el === void 0 ? void 0 : el.contains(window.document.activeElement))) handler(event);
				}, 0);
			}, { passive: true })
		].filter(Boolean);
		const stop = () => cleanup.forEach((fn) => fn());
		if (controls) return {
			stop,
			cancel: () => {
				shouldListen = false;
			},
			trigger: (event) => {
				shouldListen = true;
				listener(event);
				shouldListen = false;
			}
		};
		return stop;
	}
	function useMounted() {
		const isMounted = shallowRef(false);
		const instance = getCurrentInstance();
		if (instance) onMounted(() => {
			isMounted.value = true;
		}, instance);
		return isMounted;
	}
	function useSupported(callback) {
		const isMounted = useMounted();
		return computed(() => {
			isMounted.value;
			return Boolean(callback());
		});
	}
	function usePermission(permissionDesc, options = {}) {
		const { controls = false, navigator = defaultNavigator } = options;
		const isSupported = useSupported(() => navigator && "permissions" in navigator);
		const permissionStatus = shallowRef();
		const desc = typeof permissionDesc === "string" ? { name: permissionDesc } : permissionDesc;
		const state = shallowRef();
		const update = () => {
			var _permissionStatus$val, _permissionStatus$val2;
			state.value = (_permissionStatus$val = (_permissionStatus$val2 = permissionStatus.value) === null || _permissionStatus$val2 === void 0 ? void 0 : _permissionStatus$val2.state) !== null && _permissionStatus$val !== void 0 ? _permissionStatus$val : "prompt";
		};
		useEventListener(permissionStatus, "change", update, { passive: true });
		const query = createSingletonPromise(async () => {
			if (!isSupported.value) return;
			if (!permissionStatus.value) try {
				permissionStatus.value = await navigator.permissions.query(desc);
			} catch (_unused) {
				permissionStatus.value = void 0;
			} finally {
				update();
			}
			if (controls) return toRaw(permissionStatus.value);
		});
		query();
		if (controls) return {
			state,
			isSupported,
			query
		};
		else return state;
	}
	function useClipboard(options = {}) {
		const { navigator = defaultNavigator, read = false, source, copiedDuring = 1500, legacy = false } = options;
		const isClipboardApiSupported = useSupported(() => navigator && "clipboard" in navigator);
		const permissionRead = usePermission("clipboard-read");
		const permissionWrite = usePermission("clipboard-write");
		const isSupported = computed(() => isClipboardApiSupported.value || legacy);
		const text = shallowRef("");
		const copied = shallowRef(false);
		const copyPending = shallowRef(false);
		const timeout = useTimeoutFn(() => copied.value = false, copiedDuring, { immediate: false });
		let lastLegacyId = 0;
		async function updateText() {
			let useLegacy = !(isClipboardApiSupported.value && isAllowed(permissionRead.value));
			if (!useLegacy) try {
				text.value = await navigator.clipboard.readText();
			} catch (_unused) {
				useLegacy = true;
			}
			if (useLegacy) text.value = legacyRead();
		}
		if (isSupported.value && read) useEventListener(["copy", "cut"], updateText, { passive: true });
		async function copy(value) {
			const resolvedValue = value !== null && value !== void 0 ? value : toValue$1(source);
			if (isSupported.value && resolvedValue != null) {
				copyPending.value = true;
				let useLegacy = !(isClipboardApiSupported.value && isAllowed(permissionWrite.value));
				if (!useLegacy) try {
					const clipboardItem = createClipboardItem(resolvedValue);
					await navigator.clipboard.write([clipboardItem]);
				} catch (_unused2) {
					useLegacy = true;
				}
				if (useLegacy) if (typeof resolvedValue === "string") {
					text.value = resolvedValue;
					legacyCopy(resolvedValue);
				} else {
					const currentId = ++lastLegacyId;
					const resolvedText = await resolvedValue();
					if (resolvedText != null && currentId === lastLegacyId) {
						text.value = resolvedText;
						legacyCopy(resolvedText);
					}
				}
				copied.value = true;
				timeout.start();
				copyPending.value = false;
			}
		}
		function createClipboardItem(value) {
			if (typeof value === "string") {
				text.value = value;
				return new ClipboardItem({ "text/plain": value });
			} else return new ClipboardItem({ "text/plain": value().then((resolvedText = "") => {
				text.value = resolvedText;
				return new Blob([resolvedText], { type: "text/plain" });
			}) });
		}
		function legacyCopy(value) {
			const ta = document.createElement("textarea");
			ta.value = value;
			ta.style.position = "absolute";
			ta.style.opacity = "0";
			ta.setAttribute("readonly", "");
			document.body.appendChild(ta);
			ta.select();
			document.execCommand("copy");
			ta.remove();
		}
		function legacyRead() {
			var _document$getSelectio, _document, _document$getSelectio2;
			return (_document$getSelectio = (_document = document) === null || _document === void 0 || (_document$getSelectio2 = _document.getSelection) === null || _document$getSelectio2 === void 0 || (_document$getSelectio2 = _document$getSelectio2.call(_document)) === null || _document$getSelectio2 === void 0 ? void 0 : _document$getSelectio2.toString()) !== null && _document$getSelectio !== void 0 ? _document$getSelectio : "";
		}
		function isAllowed(status) {
			return status === "granted" || status === "prompt";
		}
		return {
			copyPending: shallowReadonly(copyPending),
			isSupported,
			text: shallowReadonly(text),
			copied: shallowReadonly(copied),
			copy
		};
	}
	function useResizeObserver(target, callback, options = {}) {
		const { window = defaultWindow, ...observerOptions } = options;
		let observer;
		const isSupported = useSupported(() => window && "ResizeObserver" in window);
		const cleanup = () => {
			if (observer) {
				observer.disconnect();
				observer = void 0;
			}
		};
		const stopWatch = watch(computed(() => {
			const _targets = toValue$1(target);
			return Array.isArray(_targets) ? _targets.map((el) => unrefElement(el)) : [unrefElement(_targets)];
		}), (els) => {
			cleanup();
			if (isSupported.value && window) {
				observer = new ResizeObserver(callback);
				for (const _el of els) if (_el) observer.observe(_el, observerOptions);
			}
		}, {
			immediate: true,
			flush: "post"
		});
		const stop = () => {
			cleanup();
			stopWatch();
		};
		tryOnScopeDispose(stop);
		return {
			isSupported,
			stop
		};
	}
	function resolveElement(el) {
		if (typeof Window !== "undefined" && el instanceof Window) return el.document.documentElement;
		if (typeof Document !== "undefined" && el instanceof Document) return el.documentElement;
		return el;
	}
	function checkOverflowScroll(ele) {
		const style = window.getComputedStyle(ele);
		if (style.overflowX === "scroll" || style.overflowY === "scroll" || style.overflowX === "auto" && ele.clientWidth < ele.scrollWidth || style.overflowY === "auto" && ele.clientHeight < ele.scrollHeight) return true;
		else {
			const parent = ele.parentNode;
			if (!parent || parent.tagName === "BODY") return false;
			return checkOverflowScroll(parent);
		}
	}
	function preventDefault(rawEvent) {
		const e = rawEvent || window.event;
		const _target = e.target;
		if (checkOverflowScroll(_target)) return false;
		if (e.touches.length > 1) return true;
		if (e.preventDefault) e.preventDefault();
		return false;
	}
	var elInitialOverflow = new WeakMap();
	function useScrollLock(element, initialState = false) {
		const isLocked = shallowRef(initialState);
		let stopTouchMoveListener = null;
		let initialOverflow = "";
		watch(toRef(element), (el) => {
			const target = resolveElement(toValue$1(el));
			if (target) {
				const ele = target;
				if (!elInitialOverflow.get(ele)) elInitialOverflow.set(ele, ele.style.overflow);
				if (ele.style.overflow !== "hidden") initialOverflow = ele.style.overflow;
				if (ele.style.overflow === "hidden") return isLocked.value = true;
				if (isLocked.value) return ele.style.overflow = "hidden";
			}
		}, { immediate: true });
		const lock = () => {
			const el = resolveElement(toValue$1(element));
			if (!el || isLocked.value) return;
			if (isIOS) stopTouchMoveListener = useEventListener(el, "touchmove", (e) => {
				preventDefault(e);
			}, { passive: false });
			el.style.overflow = "hidden";
			isLocked.value = true;
		};
		const unlock = () => {
			const el = resolveElement(toValue$1(element));
			if (!el || !isLocked.value) return;
			if (isIOS) stopTouchMoveListener === null || stopTouchMoveListener === void 0 || stopTouchMoveListener();
			el.style.overflow = initialOverflow;
			elInitialOverflow.delete(el);
			isLocked.value = false;
		};
		tryOnScopeDispose(unlock);
		return computed({
			get() {
				return isLocked.value;
			},
			set(v) {
				if (v) lock();
				else unlock();
			}
		});
	}
	Number.POSITIVE_INFINITY;
	function ownKeys(object, enumerableOnly) {
		var keys = Object.keys(object);
		if (Object.getOwnPropertySymbols) {
			var symbols = Object.getOwnPropertySymbols(object);
			if (enumerableOnly) symbols = symbols.filter(function(sym) {
				return Object.getOwnPropertyDescriptor(object, sym).enumerable;
			});
			keys.push.apply(keys, symbols);
		}
		return keys;
	}
	function _objectSpread2(target) {
		for (var i = 1; i < arguments.length; i++) {
			var source = arguments[i] != null ? arguments[i] : {};
			if (i % 2) ownKeys(Object(source), true).forEach(function(key) {
				_defineProperty(target, key, source[key]);
			});
			else if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
			else ownKeys(Object(source)).forEach(function(key) {
				Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
			});
		}
		return target;
	}
	function _typeof(obj) {
		"@babel/helpers - typeof";
		if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") _typeof = function(obj) {
			return typeof obj;
		};
		else _typeof = function(obj) {
			return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
		};
		return _typeof(obj);
	}
	function _defineProperty(obj, key, value) {
		if (key in obj) Object.defineProperty(obj, key, {
			value,
			enumerable: true,
			configurable: true,
			writable: true
		});
		else obj[key] = value;
		return obj;
	}
	function _extends() {
		_extends = Object.assign || function(target) {
			for (var i = 1; i < arguments.length; i++) {
				var source = arguments[i];
				for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
			}
			return target;
		};
		return _extends.apply(this, arguments);
	}
	function _objectWithoutPropertiesLoose(source, excluded) {
		if (source == null) return {};
		var target = {};
		var sourceKeys = Object.keys(source);
		var key, i;
		for (i = 0; i < sourceKeys.length; i++) {
			key = sourceKeys[i];
			if (excluded.indexOf(key) >= 0) continue;
			target[key] = source[key];
		}
		return target;
	}
	function _objectWithoutProperties(source, excluded) {
		if (source == null) return {};
		var target = _objectWithoutPropertiesLoose(source, excluded);
		var key, i;
		if (Object.getOwnPropertySymbols) {
			var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
			for (i = 0; i < sourceSymbolKeys.length; i++) {
				key = sourceSymbolKeys[i];
				if (excluded.indexOf(key) >= 0) continue;
				if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
				target[key] = source[key];
			}
		}
		return target;
	}
	var version = "1.14.0";
	function userAgent(pattern) {
		if (typeof window !== "undefined" && window.navigator) return !!navigator.userAgent.match(pattern);
	}
	var IE11OrLess = userAgent(/(?:Trident.*rv[ :]?11\.|msie|iemobile|Windows Phone)/i);
	var Edge = userAgent(/Edge/i);
	var FireFox = userAgent(/firefox/i);
	var Safari = userAgent(/safari/i) && !userAgent(/chrome/i) && !userAgent(/android/i);
	var IOS = userAgent(/iP(ad|od|hone)/i);
	var ChromeForAndroid = userAgent(/chrome/i) && userAgent(/android/i);
	var captureMode = {
		capture: false,
		passive: false
	};
	function on(el, event, fn) {
		el.addEventListener(event, fn, !IE11OrLess && captureMode);
	}
	function off(el, event, fn) {
		el.removeEventListener(event, fn, !IE11OrLess && captureMode);
	}
	function matches(el, selector) {
		if (!selector) return;
		selector[0] === ">" && (selector = selector.substring(1));
		if (el) try {
			if (el.matches) return el.matches(selector);
			else if (el.msMatchesSelector) return el.msMatchesSelector(selector);
			else if (el.webkitMatchesSelector) return el.webkitMatchesSelector(selector);
		} catch (_) {
			return false;
		}
		return false;
	}
	function getParentOrHost(el) {
		return el.host && el !== document && el.host.nodeType ? el.host : el.parentNode;
	}
	function closest(el, selector, ctx, includeCTX) {
		if (el) {
			ctx = ctx || document;
			do {
				if (selector != null && (selector[0] === ">" ? el.parentNode === ctx && matches(el, selector) : matches(el, selector)) || includeCTX && el === ctx) return el;
				if (el === ctx) break;
			} while (el = getParentOrHost(el));
		}
		return null;
	}
	var R_SPACE = /\s+/g;
	function toggleClass(el, name, state) {
		if (el && name) if (el.classList) el.classList[state ? "add" : "remove"](name);
		else el.className = ((" " + el.className + " ").replace(R_SPACE, " ").replace(" " + name + " ", " ") + (state ? " " + name : "")).replace(R_SPACE, " ");
	}
	function css(el, prop, val) {
		var style = el && el.style;
		if (style) if (val === void 0) {
			if (document.defaultView && document.defaultView.getComputedStyle) val = document.defaultView.getComputedStyle(el, "");
			else if (el.currentStyle) val = el.currentStyle;
			return prop === void 0 ? val : val[prop];
		} else {
			if (!(prop in style) && prop.indexOf("webkit") === -1) prop = "-webkit-" + prop;
			style[prop] = val + (typeof val === "string" ? "" : "px");
		}
	}
	function matrix(el, selfOnly) {
		var appliedTransforms = "";
		if (typeof el === "string") appliedTransforms = el;
		else do {
			var transform = css(el, "transform");
			if (transform && transform !== "none") appliedTransforms = transform + " " + appliedTransforms;
		} while (!selfOnly && (el = el.parentNode));
		var matrixFn = window.DOMMatrix || window.WebKitCSSMatrix || window.CSSMatrix || window.MSCSSMatrix;
		return matrixFn && new matrixFn(appliedTransforms);
	}
	function find(ctx, tagName, iterator) {
		if (ctx) {
			var list = ctx.getElementsByTagName(tagName), i = 0, n = list.length;
			if (iterator) for (; i < n; i++) iterator(list[i], i);
			return list;
		}
		return [];
	}
	function getWindowScrollingElement() {
		var scrollingElement = document.scrollingElement;
		if (scrollingElement) return scrollingElement;
		else return document.documentElement;
	}
	function getRect(el, relativeToContainingBlock, relativeToNonStaticParent, undoScale, container) {
		if (!el.getBoundingClientRect && el !== window) return;
		var elRect, top, left, bottom, right, height, width;
		if (el !== window && el.parentNode && el !== getWindowScrollingElement()) {
			elRect = el.getBoundingClientRect();
			top = elRect.top;
			left = elRect.left;
			bottom = elRect.bottom;
			right = elRect.right;
			height = elRect.height;
			width = elRect.width;
		} else {
			top = 0;
			left = 0;
			bottom = window.innerHeight;
			right = window.innerWidth;
			height = window.innerHeight;
			width = window.innerWidth;
		}
		if ((relativeToContainingBlock || relativeToNonStaticParent) && el !== window) {
			container = container || el.parentNode;
			if (!IE11OrLess) do
				if (container && container.getBoundingClientRect && (css(container, "transform") !== "none" || relativeToNonStaticParent && css(container, "position") !== "static")) {
					var containerRect = container.getBoundingClientRect();
					top -= containerRect.top + parseInt(css(container, "border-top-width"));
					left -= containerRect.left + parseInt(css(container, "border-left-width"));
					bottom = top + elRect.height;
					right = left + elRect.width;
					break;
				}
			while (container = container.parentNode);
		}
		if (undoScale && el !== window) {
			var elMatrix = matrix(container || el), scaleX = elMatrix && elMatrix.a, scaleY = elMatrix && elMatrix.d;
			if (elMatrix) {
				top /= scaleY;
				left /= scaleX;
				width /= scaleX;
				height /= scaleY;
				bottom = top + height;
				right = left + width;
			}
		}
		return {
			top,
			left,
			bottom,
			right,
			width,
			height
		};
	}
	function isScrolledPast(el, elSide, parentSide) {
		var parent = getParentAutoScrollElement(el, true), elSideVal = getRect(el)[elSide];
		while (parent) {
			var parentSideVal = getRect(parent)[parentSide], visible = void 0;
			if (parentSide === "top" || parentSide === "left") visible = elSideVal >= parentSideVal;
			else visible = elSideVal <= parentSideVal;
			if (!visible) return parent;
			if (parent === getWindowScrollingElement()) break;
			parent = getParentAutoScrollElement(parent, false);
		}
		return false;
	}
	function getChild(el, childNum, options, includeDragEl) {
		var currentChild = 0, i = 0, children = el.children;
		while (i < children.length) {
			if (children[i].style.display !== "none" && children[i] !== Sortable.ghost && (includeDragEl || children[i] !== Sortable.dragged) && closest(children[i], options.draggable, el, false)) {
				if (currentChild === childNum) return children[i];
				currentChild++;
			}
			i++;
		}
		return null;
	}
	function lastChild(el, selector) {
		var last = el.lastElementChild;
		while (last && (last === Sortable.ghost || css(last, "display") === "none" || selector && !matches(last, selector))) last = last.previousElementSibling;
		return last || null;
	}
	function index(el, selector) {
		var index = 0;
		if (!el || !el.parentNode) return -1;
		while (el = el.previousElementSibling) if (el.nodeName.toUpperCase() !== "TEMPLATE" && el !== Sortable.clone && (!selector || matches(el, selector))) index++;
		return index;
	}
	function getRelativeScrollOffset(el) {
		var offsetLeft = 0, offsetTop = 0, winScroller = getWindowScrollingElement();
		if (el) do {
			var elMatrix = matrix(el), scaleX = elMatrix.a, scaleY = elMatrix.d;
			offsetLeft += el.scrollLeft * scaleX;
			offsetTop += el.scrollTop * scaleY;
		} while (el !== winScroller && (el = el.parentNode));
		return [offsetLeft, offsetTop];
	}
	function indexOfObject(arr, obj) {
		for (var i in arr) {
			if (!arr.hasOwnProperty(i)) continue;
			for (var key in obj) if (obj.hasOwnProperty(key) && obj[key] === arr[i][key]) return Number(i);
		}
		return -1;
	}
	function getParentAutoScrollElement(el, includeSelf) {
		if (!el || !el.getBoundingClientRect) return getWindowScrollingElement();
		var elem = el;
		var gotSelf = false;
		do
			if (elem.clientWidth < elem.scrollWidth || elem.clientHeight < elem.scrollHeight) {
				var elemCSS = css(elem);
				if (elem.clientWidth < elem.scrollWidth && (elemCSS.overflowX == "auto" || elemCSS.overflowX == "scroll") || elem.clientHeight < elem.scrollHeight && (elemCSS.overflowY == "auto" || elemCSS.overflowY == "scroll")) {
					if (!elem.getBoundingClientRect || elem === document.body) return getWindowScrollingElement();
					if (gotSelf || includeSelf) return elem;
					gotSelf = true;
				}
			}
		while (elem = elem.parentNode);
		return getWindowScrollingElement();
	}
	function extend(dst, src) {
		if (dst && src) {
			for (var key in src) if (src.hasOwnProperty(key)) dst[key] = src[key];
		}
		return dst;
	}
	function isRectEqual(rect1, rect2) {
		return Math.round(rect1.top) === Math.round(rect2.top) && Math.round(rect1.left) === Math.round(rect2.left) && Math.round(rect1.height) === Math.round(rect2.height) && Math.round(rect1.width) === Math.round(rect2.width);
	}
	var _throttleTimeout;
	function throttle(callback, ms) {
		return function() {
			if (!_throttleTimeout) {
				var args = arguments, _this = this;
				if (args.length === 1) callback.call(_this, args[0]);
				else callback.apply(_this, args);
				_throttleTimeout = setTimeout(function() {
					_throttleTimeout = void 0;
				}, ms);
			}
		};
	}
	function cancelThrottle() {
		clearTimeout(_throttleTimeout);
		_throttleTimeout = void 0;
	}
	function scrollBy(el, x, y) {
		el.scrollLeft += x;
		el.scrollTop += y;
	}
	function clone$1(el) {
		var Polymer = window.Polymer;
		var $ = window.jQuery || window.Zepto;
		if (Polymer && Polymer.dom) return Polymer.dom(el).cloneNode(true);
		else if ($) return $(el).clone(true)[0];
		else return el.cloneNode(true);
	}
	var expando = "Sortable" + new Date().getTime();
	function AnimationStateManager() {
		var animationStates = [], animationCallbackId;
		return {
			captureAnimationState: function captureAnimationState() {
				animationStates = [];
				if (!this.options.animation) return;
				[].slice.call(this.el.children).forEach(function(child) {
					if (css(child, "display") === "none" || child === Sortable.ghost) return;
					animationStates.push({
						target: child,
						rect: getRect(child)
					});
					var fromRect = _objectSpread2({}, animationStates[animationStates.length - 1].rect);
					if (child.thisAnimationDuration) {
						var childMatrix = matrix(child, true);
						if (childMatrix) {
							fromRect.top -= childMatrix.f;
							fromRect.left -= childMatrix.e;
						}
					}
					child.fromRect = fromRect;
				});
			},
			addAnimationState: function addAnimationState(state) {
				animationStates.push(state);
			},
			removeAnimationState: function removeAnimationState(target) {
				animationStates.splice(indexOfObject(animationStates, { target }), 1);
			},
			animateAll: function animateAll(callback) {
				var _this = this;
				if (!this.options.animation) {
					clearTimeout(animationCallbackId);
					if (typeof callback === "function") callback();
					return;
				}
				var animating = false, animationTime = 0;
				animationStates.forEach(function(state) {
					var time = 0, target = state.target, fromRect = target.fromRect, toRect = getRect(target), prevFromRect = target.prevFromRect, prevToRect = target.prevToRect, animatingRect = state.rect, targetMatrix = matrix(target, true);
					if (targetMatrix) {
						toRect.top -= targetMatrix.f;
						toRect.left -= targetMatrix.e;
					}
					target.toRect = toRect;
					if (target.thisAnimationDuration) {
						if (isRectEqual(prevFromRect, toRect) && !isRectEqual(fromRect, toRect) && (animatingRect.top - toRect.top) / (animatingRect.left - toRect.left) === (fromRect.top - toRect.top) / (fromRect.left - toRect.left)) time = calculateRealTime(animatingRect, prevFromRect, prevToRect, _this.options);
					}
					if (!isRectEqual(toRect, fromRect)) {
						target.prevFromRect = fromRect;
						target.prevToRect = toRect;
						if (!time) time = _this.options.animation;
						_this.animate(target, animatingRect, toRect, time);
					}
					if (time) {
						animating = true;
						animationTime = Math.max(animationTime, time);
						clearTimeout(target.animationResetTimer);
						target.animationResetTimer = setTimeout(function() {
							target.animationTime = 0;
							target.prevFromRect = null;
							target.fromRect = null;
							target.prevToRect = null;
							target.thisAnimationDuration = null;
						}, time);
						target.thisAnimationDuration = time;
					}
				});
				clearTimeout(animationCallbackId);
				if (!animating) {
					if (typeof callback === "function") callback();
				} else animationCallbackId = setTimeout(function() {
					if (typeof callback === "function") callback();
				}, animationTime);
				animationStates = [];
			},
			animate: function animate(target, currentRect, toRect, duration) {
				if (duration) {
					css(target, "transition", "");
					css(target, "transform", "");
					var elMatrix = matrix(this.el), scaleX = elMatrix && elMatrix.a, scaleY = elMatrix && elMatrix.d, translateX = (currentRect.left - toRect.left) / (scaleX || 1), translateY = (currentRect.top - toRect.top) / (scaleY || 1);
					target.animatingX = !!translateX;
					target.animatingY = !!translateY;
					css(target, "transform", "translate3d(" + translateX + "px," + translateY + "px,0)");
					this.forRepaintDummy = repaint(target);
					css(target, "transition", "transform " + duration + "ms" + (this.options.easing ? " " + this.options.easing : ""));
					css(target, "transform", "translate3d(0,0,0)");
					typeof target.animated === "number" && clearTimeout(target.animated);
					target.animated = setTimeout(function() {
						css(target, "transition", "");
						css(target, "transform", "");
						target.animated = false;
						target.animatingX = false;
						target.animatingY = false;
					}, duration);
				}
			}
		};
	}
	function repaint(target) {
		return target.offsetWidth;
	}
	function calculateRealTime(animatingRect, fromRect, toRect, options) {
		return Math.sqrt(Math.pow(fromRect.top - animatingRect.top, 2) + Math.pow(fromRect.left - animatingRect.left, 2)) / Math.sqrt(Math.pow(fromRect.top - toRect.top, 2) + Math.pow(fromRect.left - toRect.left, 2)) * options.animation;
	}
	var plugins = [];
	var defaults = { initializeByDefault: true };
	var PluginManager = {
		mount: function mount(plugin) {
			for (var option in defaults) if (defaults.hasOwnProperty(option) && !(option in plugin)) plugin[option] = defaults[option];
			plugins.forEach(function(p) {
				if (p.pluginName === plugin.pluginName) throw "Sortable: Cannot mount plugin ".concat(plugin.pluginName, " more than once");
			});
			plugins.push(plugin);
		},
		pluginEvent: function pluginEvent(eventName, sortable, evt) {
			var _this = this;
			this.eventCanceled = false;
			evt.cancel = function() {
				_this.eventCanceled = true;
			};
			var eventNameGlobal = eventName + "Global";
			plugins.forEach(function(plugin) {
				if (!sortable[plugin.pluginName]) return;
				if (sortable[plugin.pluginName][eventNameGlobal]) sortable[plugin.pluginName][eventNameGlobal](_objectSpread2({ sortable }, evt));
				if (sortable.options[plugin.pluginName] && sortable[plugin.pluginName][eventName]) sortable[plugin.pluginName][eventName](_objectSpread2({ sortable }, evt));
			});
		},
		initializePlugins: function initializePlugins(sortable, el, defaults, options) {
			plugins.forEach(function(plugin) {
				var pluginName = plugin.pluginName;
				if (!sortable.options[pluginName] && !plugin.initializeByDefault) return;
				var initialized = new plugin(sortable, el, sortable.options);
				initialized.sortable = sortable;
				initialized.options = sortable.options;
				sortable[pluginName] = initialized;
				_extends(defaults, initialized.defaults);
			});
			for (var option in sortable.options) {
				if (!sortable.options.hasOwnProperty(option)) continue;
				var modified = this.modifyOption(sortable, option, sortable.options[option]);
				if (typeof modified !== "undefined") sortable.options[option] = modified;
			}
		},
		getEventProperties: function getEventProperties(name, sortable) {
			var eventProperties = {};
			plugins.forEach(function(plugin) {
				if (typeof plugin.eventProperties !== "function") return;
				_extends(eventProperties, plugin.eventProperties.call(sortable[plugin.pluginName], name));
			});
			return eventProperties;
		},
		modifyOption: function modifyOption(sortable, name, value) {
			var modifiedValue;
			plugins.forEach(function(plugin) {
				if (!sortable[plugin.pluginName]) return;
				if (plugin.optionListeners && typeof plugin.optionListeners[name] === "function") modifiedValue = plugin.optionListeners[name].call(sortable[plugin.pluginName], value);
			});
			return modifiedValue;
		}
	};
	function dispatchEvent(_ref) {
		var sortable = _ref.sortable, rootEl = _ref.rootEl, name = _ref.name, targetEl = _ref.targetEl, cloneEl = _ref.cloneEl, toEl = _ref.toEl, fromEl = _ref.fromEl, oldIndex = _ref.oldIndex, newIndex = _ref.newIndex, oldDraggableIndex = _ref.oldDraggableIndex, newDraggableIndex = _ref.newDraggableIndex, originalEvent = _ref.originalEvent, putSortable = _ref.putSortable, extraEventProperties = _ref.extraEventProperties;
		sortable = sortable || rootEl && rootEl[expando];
		if (!sortable) return;
		var evt, options = sortable.options, onName = "on" + name.charAt(0).toUpperCase() + name.substr(1);
		if (window.CustomEvent && !IE11OrLess && !Edge) evt = new CustomEvent(name, {
			bubbles: true,
			cancelable: true
		});
		else {
			evt = document.createEvent("Event");
			evt.initEvent(name, true, true);
		}
		evt.to = toEl || rootEl;
		evt.from = fromEl || rootEl;
		evt.item = targetEl || rootEl;
		evt.clone = cloneEl;
		evt.oldIndex = oldIndex;
		evt.newIndex = newIndex;
		evt.oldDraggableIndex = oldDraggableIndex;
		evt.newDraggableIndex = newDraggableIndex;
		evt.originalEvent = originalEvent;
		evt.pullMode = putSortable ? putSortable.lastPutMode : void 0;
		var allEventProperties = _objectSpread2(_objectSpread2({}, extraEventProperties), PluginManager.getEventProperties(name, sortable));
		for (var option in allEventProperties) evt[option] = allEventProperties[option];
		if (rootEl) rootEl.dispatchEvent(evt);
		if (options[onName]) options[onName].call(sortable, evt);
	}
	var _excluded = ["evt"];
	var pluginEvent = function pluginEvent(eventName, sortable) {
		var _ref = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, originalEvent = _ref.evt, data = _objectWithoutProperties(_ref, _excluded);
		PluginManager.pluginEvent.bind(Sortable)(eventName, sortable, _objectSpread2({
			dragEl,
			parentEl,
			ghostEl,
			rootEl,
			nextEl,
			lastDownEl,
			cloneEl,
			cloneHidden,
			dragStarted: moved,
			putSortable,
			activeSortable: Sortable.active,
			originalEvent,
			oldIndex,
			oldDraggableIndex,
			newIndex,
			newDraggableIndex,
			hideGhostForTarget: _hideGhostForTarget,
			unhideGhostForTarget: _unhideGhostForTarget,
			cloneNowHidden: function cloneNowHidden() {
				cloneHidden = true;
			},
			cloneNowShown: function cloneNowShown() {
				cloneHidden = false;
			},
			dispatchSortableEvent: function dispatchSortableEvent(name) {
				_dispatchEvent({
					sortable,
					name,
					originalEvent
				});
			}
		}, data));
	};
	function _dispatchEvent(info) {
		dispatchEvent(_objectSpread2({
			putSortable,
			cloneEl,
			targetEl: dragEl,
			rootEl,
			oldIndex,
			oldDraggableIndex,
			newIndex,
			newDraggableIndex
		}, info));
	}
	var dragEl, parentEl, ghostEl, rootEl, nextEl, lastDownEl, cloneEl, cloneHidden, oldIndex, newIndex, oldDraggableIndex, newDraggableIndex, activeGroup, putSortable, awaitingDragStarted = false, ignoreNextClick = false, sortables = [], tapEvt, touchEvt, lastDx, lastDy, tapDistanceLeft, tapDistanceTop, moved, lastTarget, lastDirection, pastFirstInvertThresh = false, isCircumstantialInvert = false, targetMoveDistance, ghostRelativeParent, ghostRelativeParentInitialScroll = [], _silent = false, savedInputChecked = [];
	var documentExists = typeof document !== "undefined", PositionGhostAbsolutely = IOS, CSSFloatProperty = Edge || IE11OrLess ? "cssFloat" : "float", supportDraggable = documentExists && !ChromeForAndroid && !IOS && "draggable" in document.createElement("div"), supportCssPointerEvents = function() {
		if (!documentExists) return;
		if (IE11OrLess) return false;
		var el = document.createElement("x");
		el.style.cssText = "pointer-events:auto";
		return el.style.pointerEvents === "auto";
	}(), _detectDirection = function _detectDirection(el, options) {
		var elCSS = css(el), elWidth = parseInt(elCSS.width) - parseInt(elCSS.paddingLeft) - parseInt(elCSS.paddingRight) - parseInt(elCSS.borderLeftWidth) - parseInt(elCSS.borderRightWidth), child1 = getChild(el, 0, options), child2 = getChild(el, 1, options), firstChildCSS = child1 && css(child1), secondChildCSS = child2 && css(child2), firstChildWidth = firstChildCSS && parseInt(firstChildCSS.marginLeft) + parseInt(firstChildCSS.marginRight) + getRect(child1).width, secondChildWidth = secondChildCSS && parseInt(secondChildCSS.marginLeft) + parseInt(secondChildCSS.marginRight) + getRect(child2).width;
		if (elCSS.display === "flex") return elCSS.flexDirection === "column" || elCSS.flexDirection === "column-reverse" ? "vertical" : "horizontal";
		if (elCSS.display === "grid") return elCSS.gridTemplateColumns.split(" ").length <= 1 ? "vertical" : "horizontal";
		if (child1 && firstChildCSS["float"] && firstChildCSS["float"] !== "none") {
			var touchingSideChild2 = firstChildCSS["float"] === "left" ? "left" : "right";
			return child2 && (secondChildCSS.clear === "both" || secondChildCSS.clear === touchingSideChild2) ? "vertical" : "horizontal";
		}
		return child1 && (firstChildCSS.display === "block" || firstChildCSS.display === "flex" || firstChildCSS.display === "table" || firstChildCSS.display === "grid" || firstChildWidth >= elWidth && elCSS[CSSFloatProperty] === "none" || child2 && elCSS[CSSFloatProperty] === "none" && firstChildWidth + secondChildWidth > elWidth) ? "vertical" : "horizontal";
	}, _dragElInRowColumn = function _dragElInRowColumn(dragRect, targetRect, vertical) {
		var dragElS1Opp = vertical ? dragRect.left : dragRect.top, dragElS2Opp = vertical ? dragRect.right : dragRect.bottom, dragElOppLength = vertical ? dragRect.width : dragRect.height, targetS1Opp = vertical ? targetRect.left : targetRect.top, targetS2Opp = vertical ? targetRect.right : targetRect.bottom, targetOppLength = vertical ? targetRect.width : targetRect.height;
		return dragElS1Opp === targetS1Opp || dragElS2Opp === targetS2Opp || dragElS1Opp + dragElOppLength / 2 === targetS1Opp + targetOppLength / 2;
	}, _detectNearestEmptySortable = function _detectNearestEmptySortable(x, y) {
		var ret;
		sortables.some(function(sortable) {
			var threshold = sortable[expando].options.emptyInsertThreshold;
			if (!threshold || lastChild(sortable)) return;
			var rect = getRect(sortable), insideHorizontally = x >= rect.left - threshold && x <= rect.right + threshold, insideVertically = y >= rect.top - threshold && y <= rect.bottom + threshold;
			if (insideHorizontally && insideVertically) return ret = sortable;
		});
		return ret;
	}, _prepareGroup = function _prepareGroup(options) {
		function toFn(value, pull) {
			return function(to, from, dragEl, evt) {
				var sameGroup = to.options.group.name && from.options.group.name && to.options.group.name === from.options.group.name;
				if (value == null && (pull || sameGroup)) return true;
				else if (value == null || value === false) return false;
				else if (pull && value === "clone") return value;
				else if (typeof value === "function") return toFn(value(to, from, dragEl, evt), pull)(to, from, dragEl, evt);
				else {
					var otherGroup = (pull ? to : from).options.group.name;
					return value === true || typeof value === "string" && value === otherGroup || value.join && value.indexOf(otherGroup) > -1;
				}
			};
		}
		var group = {};
		var originalGroup = options.group;
		if (!originalGroup || _typeof(originalGroup) != "object") originalGroup = { name: originalGroup };
		group.name = originalGroup.name;
		group.checkPull = toFn(originalGroup.pull, true);
		group.checkPut = toFn(originalGroup.put);
		group.revertClone = originalGroup.revertClone;
		options.group = group;
	}, _hideGhostForTarget = function _hideGhostForTarget() {
		if (!supportCssPointerEvents && ghostEl) css(ghostEl, "display", "none");
	}, _unhideGhostForTarget = function _unhideGhostForTarget() {
		if (!supportCssPointerEvents && ghostEl) css(ghostEl, "display", "");
	};
	if (documentExists) document.addEventListener("click", function(evt) {
		if (ignoreNextClick) {
			evt.preventDefault();
			evt.stopPropagation && evt.stopPropagation();
			evt.stopImmediatePropagation && evt.stopImmediatePropagation();
			ignoreNextClick = false;
			return false;
		}
	}, true);
	var nearestEmptyInsertDetectEvent = function nearestEmptyInsertDetectEvent(evt) {
		if (dragEl) {
			evt = evt.touches ? evt.touches[0] : evt;
			var nearest = _detectNearestEmptySortable(evt.clientX, evt.clientY);
			if (nearest) {
				var event = {};
				for (var i in evt) if (evt.hasOwnProperty(i)) event[i] = evt[i];
				event.target = event.rootEl = nearest;
				event.preventDefault = void 0;
				event.stopPropagation = void 0;
				nearest[expando]._onDragOver(event);
			}
		}
	};
	var _checkOutsideTargetEl = function _checkOutsideTargetEl(evt) {
		if (dragEl) dragEl.parentNode[expando]._isOutsideThisEl(evt.target);
	};
	function Sortable(el, options) {
		if (!(el && el.nodeType && el.nodeType === 1)) throw "Sortable: `el` must be an HTMLElement, not ".concat({}.toString.call(el));
		this.el = el;
		this.options = options = _extends({}, options);
		el[expando] = this;
		var defaults = {
			group: null,
			sort: true,
			disabled: false,
			store: null,
			handle: null,
			draggable: /^[uo]l$/i.test(el.nodeName) ? ">li" : ">*",
			swapThreshold: 1,
			invertSwap: false,
			invertedSwapThreshold: null,
			removeCloneOnHide: true,
			direction: function direction() {
				return _detectDirection(el, this.options);
			},
			ghostClass: "sortable-ghost",
			chosenClass: "sortable-chosen",
			dragClass: "sortable-drag",
			ignore: "a, img",
			filter: null,
			preventOnFilter: true,
			animation: 0,
			easing: null,
			setData: function setData(dataTransfer, dragEl) {
				dataTransfer.setData("Text", dragEl.textContent);
			},
			dropBubble: false,
			dragoverBubble: false,
			dataIdAttr: "data-id",
			delay: 0,
			delayOnTouchOnly: false,
			touchStartThreshold: (Number.parseInt ? Number : window).parseInt(window.devicePixelRatio, 10) || 1,
			forceFallback: false,
			fallbackClass: "sortable-fallback",
			fallbackOnBody: false,
			fallbackTolerance: 0,
			fallbackOffset: {
				x: 0,
				y: 0
			},
			supportPointer: Sortable.supportPointer !== false && "PointerEvent" in window && !Safari,
			emptyInsertThreshold: 5
		};
		PluginManager.initializePlugins(this, el, defaults);
		for (var name in defaults) !(name in options) && (options[name] = defaults[name]);
		_prepareGroup(options);
		for (var fn in this) if (fn.charAt(0) === "_" && typeof this[fn] === "function") this[fn] = this[fn].bind(this);
		this.nativeDraggable = options.forceFallback ? false : supportDraggable;
		if (this.nativeDraggable) this.options.touchStartThreshold = 1;
		if (options.supportPointer) on(el, "pointerdown", this._onTapStart);
		else {
			on(el, "mousedown", this._onTapStart);
			on(el, "touchstart", this._onTapStart);
		}
		if (this.nativeDraggable) {
			on(el, "dragover", this);
			on(el, "dragenter", this);
		}
		sortables.push(this.el);
		options.store && options.store.get && this.sort(options.store.get(this) || []);
		_extends(this, AnimationStateManager());
	}
	Sortable.prototype = {
		constructor: Sortable,
		_isOutsideThisEl: function _isOutsideThisEl(target) {
			if (!this.el.contains(target) && target !== this.el) lastTarget = null;
		},
		_getDirection: function _getDirection(evt, target) {
			return typeof this.options.direction === "function" ? this.options.direction.call(this, evt, target, dragEl) : this.options.direction;
		},
		_onTapStart: function _onTapStart(evt) {
			if (!evt.cancelable) return;
			var _this = this, el = this.el, options = this.options, preventOnFilter = options.preventOnFilter, type = evt.type, touch = evt.touches && evt.touches[0] || evt.pointerType && evt.pointerType === "touch" && evt, target = (touch || evt).target, originalTarget = evt.target.shadowRoot && (evt.path && evt.path[0] || evt.composedPath && evt.composedPath()[0]) || target, filter = options.filter;
			_saveInputCheckedState(el);
			if (dragEl) return;
			if (/mousedown|pointerdown/.test(type) && evt.button !== 0 || options.disabled) return;
			if (originalTarget.isContentEditable) return;
			if (!this.nativeDraggable && Safari && target && target.tagName.toUpperCase() === "SELECT") return;
			target = closest(target, options.draggable, el, false);
			if (target && target.animated) return;
			if (lastDownEl === target) return;
			oldIndex = index(target);
			oldDraggableIndex = index(target, options.draggable);
			if (typeof filter === "function") {
				if (filter.call(this, evt, target, this)) {
					_dispatchEvent({
						sortable: _this,
						rootEl: originalTarget,
						name: "filter",
						targetEl: target,
						toEl: el,
						fromEl: el
					});
					pluginEvent("filter", _this, { evt });
					preventOnFilter && evt.cancelable && evt.preventDefault();
					return;
				}
			} else if (filter) {
				filter = filter.split(",").some(function(criteria) {
					criteria = closest(originalTarget, criteria.trim(), el, false);
					if (criteria) {
						_dispatchEvent({
							sortable: _this,
							rootEl: criteria,
							name: "filter",
							targetEl: target,
							fromEl: el,
							toEl: el
						});
						pluginEvent("filter", _this, { evt });
						return true;
					}
				});
				if (filter) {
					preventOnFilter && evt.cancelable && evt.preventDefault();
					return;
				}
			}
			if (options.handle && !closest(originalTarget, options.handle, el, false)) return;
			this._prepareDragStart(evt, touch, target);
		},
		_prepareDragStart: function _prepareDragStart(evt, touch, target) {
			var _this = this, el = _this.el, options = _this.options, ownerDocument = el.ownerDocument, dragStartFn;
			if (target && !dragEl && target.parentNode === el) {
				var dragRect = getRect(target);
				rootEl = el;
				dragEl = target;
				parentEl = dragEl.parentNode;
				nextEl = dragEl.nextSibling;
				lastDownEl = target;
				activeGroup = options.group;
				Sortable.dragged = dragEl;
				tapEvt = {
					target: dragEl,
					clientX: (touch || evt).clientX,
					clientY: (touch || evt).clientY
				};
				tapDistanceLeft = tapEvt.clientX - dragRect.left;
				tapDistanceTop = tapEvt.clientY - dragRect.top;
				this._lastX = (touch || evt).clientX;
				this._lastY = (touch || evt).clientY;
				dragEl.style["will-change"] = "all";
				dragStartFn = function dragStartFn() {
					pluginEvent("delayEnded", _this, { evt });
					if (Sortable.eventCanceled) {
						_this._onDrop();
						return;
					}
					_this._disableDelayedDragEvents();
					if (!FireFox && _this.nativeDraggable) dragEl.draggable = true;
					_this._triggerDragStart(evt, touch);
					_dispatchEvent({
						sortable: _this,
						name: "choose",
						originalEvent: evt
					});
					toggleClass(dragEl, options.chosenClass, true);
				};
				options.ignore.split(",").forEach(function(criteria) {
					find(dragEl, criteria.trim(), _disableDraggable);
				});
				on(ownerDocument, "dragover", nearestEmptyInsertDetectEvent);
				on(ownerDocument, "mousemove", nearestEmptyInsertDetectEvent);
				on(ownerDocument, "touchmove", nearestEmptyInsertDetectEvent);
				on(ownerDocument, "mouseup", _this._onDrop);
				on(ownerDocument, "touchend", _this._onDrop);
				on(ownerDocument, "touchcancel", _this._onDrop);
				if (FireFox && this.nativeDraggable) {
					this.options.touchStartThreshold = 4;
					dragEl.draggable = true;
				}
				pluginEvent("delayStart", this, { evt });
				if (options.delay && (!options.delayOnTouchOnly || touch) && (!this.nativeDraggable || !(Edge || IE11OrLess))) {
					if (Sortable.eventCanceled) {
						this._onDrop();
						return;
					}
					on(ownerDocument, "mouseup", _this._disableDelayedDrag);
					on(ownerDocument, "touchend", _this._disableDelayedDrag);
					on(ownerDocument, "touchcancel", _this._disableDelayedDrag);
					on(ownerDocument, "mousemove", _this._delayedDragTouchMoveHandler);
					on(ownerDocument, "touchmove", _this._delayedDragTouchMoveHandler);
					options.supportPointer && on(ownerDocument, "pointermove", _this._delayedDragTouchMoveHandler);
					_this._dragStartTimer = setTimeout(dragStartFn, options.delay);
				} else dragStartFn();
			}
		},
		_delayedDragTouchMoveHandler: function _delayedDragTouchMoveHandler(e) {
			var touch = e.touches ? e.touches[0] : e;
			if (Math.max(Math.abs(touch.clientX - this._lastX), Math.abs(touch.clientY - this._lastY)) >= Math.floor(this.options.touchStartThreshold / (this.nativeDraggable && window.devicePixelRatio || 1))) this._disableDelayedDrag();
		},
		_disableDelayedDrag: function _disableDelayedDrag() {
			dragEl && _disableDraggable(dragEl);
			clearTimeout(this._dragStartTimer);
			this._disableDelayedDragEvents();
		},
		_disableDelayedDragEvents: function _disableDelayedDragEvents() {
			var ownerDocument = this.el.ownerDocument;
			off(ownerDocument, "mouseup", this._disableDelayedDrag);
			off(ownerDocument, "touchend", this._disableDelayedDrag);
			off(ownerDocument, "touchcancel", this._disableDelayedDrag);
			off(ownerDocument, "mousemove", this._delayedDragTouchMoveHandler);
			off(ownerDocument, "touchmove", this._delayedDragTouchMoveHandler);
			off(ownerDocument, "pointermove", this._delayedDragTouchMoveHandler);
		},
		_triggerDragStart: function _triggerDragStart(evt, touch) {
			touch = touch || evt.pointerType == "touch" && evt;
			if (!this.nativeDraggable || touch) if (this.options.supportPointer) on(document, "pointermove", this._onTouchMove);
			else if (touch) on(document, "touchmove", this._onTouchMove);
			else on(document, "mousemove", this._onTouchMove);
			else {
				on(dragEl, "dragend", this);
				on(rootEl, "dragstart", this._onDragStart);
			}
			try {
				if (document.selection) _nextTick(function() {
					document.selection.empty();
				});
				else window.getSelection().removeAllRanges();
			} catch (err) {}
		},
		_dragStarted: function _dragStarted(fallback, evt) {
			awaitingDragStarted = false;
			if (rootEl && dragEl) {
				pluginEvent("dragStarted", this, { evt });
				if (this.nativeDraggable) on(document, "dragover", _checkOutsideTargetEl);
				var options = this.options;
				!fallback && toggleClass(dragEl, options.dragClass, false);
				toggleClass(dragEl, options.ghostClass, true);
				Sortable.active = this;
				fallback && this._appendGhost();
				_dispatchEvent({
					sortable: this,
					name: "start",
					originalEvent: evt
				});
			} else this._nulling();
		},
		_emulateDragOver: function _emulateDragOver() {
			if (touchEvt) {
				this._lastX = touchEvt.clientX;
				this._lastY = touchEvt.clientY;
				_hideGhostForTarget();
				var target = document.elementFromPoint(touchEvt.clientX, touchEvt.clientY);
				var parent = target;
				while (target && target.shadowRoot) {
					target = target.shadowRoot.elementFromPoint(touchEvt.clientX, touchEvt.clientY);
					if (target === parent) break;
					parent = target;
				}
				dragEl.parentNode[expando]._isOutsideThisEl(target);
				if (parent) do {
					if (parent[expando]) {
						var inserted = void 0;
						inserted = parent[expando]._onDragOver({
							clientX: touchEvt.clientX,
							clientY: touchEvt.clientY,
							target,
							rootEl: parent
						});
						if (inserted && !this.options.dragoverBubble) break;
					}
					target = parent;
				} while (parent = parent.parentNode);
				_unhideGhostForTarget();
			}
		},
		_onTouchMove: function _onTouchMove(evt) {
			if (tapEvt) {
				var options = this.options, fallbackTolerance = options.fallbackTolerance, fallbackOffset = options.fallbackOffset, touch = evt.touches ? evt.touches[0] : evt, ghostMatrix = ghostEl && matrix(ghostEl, true), scaleX = ghostEl && ghostMatrix && ghostMatrix.a, scaleY = ghostEl && ghostMatrix && ghostMatrix.d, relativeScrollOffset = PositionGhostAbsolutely && ghostRelativeParent && getRelativeScrollOffset(ghostRelativeParent), dx = (touch.clientX - tapEvt.clientX + fallbackOffset.x) / (scaleX || 1) + (relativeScrollOffset ? relativeScrollOffset[0] - ghostRelativeParentInitialScroll[0] : 0) / (scaleX || 1), dy = (touch.clientY - tapEvt.clientY + fallbackOffset.y) / (scaleY || 1) + (relativeScrollOffset ? relativeScrollOffset[1] - ghostRelativeParentInitialScroll[1] : 0) / (scaleY || 1);
				if (!Sortable.active && !awaitingDragStarted) {
					if (fallbackTolerance && Math.max(Math.abs(touch.clientX - this._lastX), Math.abs(touch.clientY - this._lastY)) < fallbackTolerance) return;
					this._onDragStart(evt, true);
				}
				if (ghostEl) {
					if (ghostMatrix) {
						ghostMatrix.e += dx - (lastDx || 0);
						ghostMatrix.f += dy - (lastDy || 0);
					} else ghostMatrix = {
						a: 1,
						b: 0,
						c: 0,
						d: 1,
						e: dx,
						f: dy
					};
					var cssMatrix = "matrix(".concat(ghostMatrix.a, ",").concat(ghostMatrix.b, ",").concat(ghostMatrix.c, ",").concat(ghostMatrix.d, ",").concat(ghostMatrix.e, ",").concat(ghostMatrix.f, ")");
					css(ghostEl, "webkitTransform", cssMatrix);
					css(ghostEl, "mozTransform", cssMatrix);
					css(ghostEl, "msTransform", cssMatrix);
					css(ghostEl, "transform", cssMatrix);
					lastDx = dx;
					lastDy = dy;
					touchEvt = touch;
				}
				evt.cancelable && evt.preventDefault();
			}
		},
		_appendGhost: function _appendGhost() {
			if (!ghostEl) {
				var container = this.options.fallbackOnBody ? document.body : rootEl, rect = getRect(dragEl, true, PositionGhostAbsolutely, true, container), options = this.options;
				if (PositionGhostAbsolutely) {
					ghostRelativeParent = container;
					while (css(ghostRelativeParent, "position") === "static" && css(ghostRelativeParent, "transform") === "none" && ghostRelativeParent !== document) ghostRelativeParent = ghostRelativeParent.parentNode;
					if (ghostRelativeParent !== document.body && ghostRelativeParent !== document.documentElement) {
						if (ghostRelativeParent === document) ghostRelativeParent = getWindowScrollingElement();
						rect.top += ghostRelativeParent.scrollTop;
						rect.left += ghostRelativeParent.scrollLeft;
					} else ghostRelativeParent = getWindowScrollingElement();
					ghostRelativeParentInitialScroll = getRelativeScrollOffset(ghostRelativeParent);
				}
				ghostEl = dragEl.cloneNode(true);
				toggleClass(ghostEl, options.ghostClass, false);
				toggleClass(ghostEl, options.fallbackClass, true);
				toggleClass(ghostEl, options.dragClass, true);
				css(ghostEl, "transition", "");
				css(ghostEl, "transform", "");
				css(ghostEl, "box-sizing", "border-box");
				css(ghostEl, "margin", 0);
				css(ghostEl, "top", rect.top);
				css(ghostEl, "left", rect.left);
				css(ghostEl, "width", rect.width);
				css(ghostEl, "height", rect.height);
				css(ghostEl, "opacity", "0.8");
				css(ghostEl, "position", PositionGhostAbsolutely ? "absolute" : "fixed");
				css(ghostEl, "zIndex", "100000");
				css(ghostEl, "pointerEvents", "none");
				Sortable.ghost = ghostEl;
				container.appendChild(ghostEl);
				css(ghostEl, "transform-origin", tapDistanceLeft / parseInt(ghostEl.style.width) * 100 + "% " + tapDistanceTop / parseInt(ghostEl.style.height) * 100 + "%");
			}
		},
		_onDragStart: function _onDragStart(evt, fallback) {
			var _this = this;
			var dataTransfer = evt.dataTransfer;
			var options = _this.options;
			pluginEvent("dragStart", this, { evt });
			if (Sortable.eventCanceled) {
				this._onDrop();
				return;
			}
			pluginEvent("setupClone", this);
			if (!Sortable.eventCanceled) {
				cloneEl = clone$1(dragEl);
				cloneEl.draggable = false;
				cloneEl.style["will-change"] = "";
				this._hideClone();
				toggleClass(cloneEl, this.options.chosenClass, false);
				Sortable.clone = cloneEl;
			}
			_this.cloneId = _nextTick(function() {
				pluginEvent("clone", _this);
				if (Sortable.eventCanceled) return;
				if (!_this.options.removeCloneOnHide) rootEl.insertBefore(cloneEl, dragEl);
				_this._hideClone();
				_dispatchEvent({
					sortable: _this,
					name: "clone"
				});
			});
			!fallback && toggleClass(dragEl, options.dragClass, true);
			if (fallback) {
				ignoreNextClick = true;
				_this._loopId = setInterval(_this._emulateDragOver, 50);
			} else {
				off(document, "mouseup", _this._onDrop);
				off(document, "touchend", _this._onDrop);
				off(document, "touchcancel", _this._onDrop);
				if (dataTransfer) {
					dataTransfer.effectAllowed = "move";
					options.setData && options.setData.call(_this, dataTransfer, dragEl);
				}
				on(document, "drop", _this);
				css(dragEl, "transform", "translateZ(0)");
			}
			awaitingDragStarted = true;
			_this._dragStartId = _nextTick(_this._dragStarted.bind(_this, fallback, evt));
			on(document, "selectstart", _this);
			moved = true;
			if (Safari) css(document.body, "user-select", "none");
		},
		_onDragOver: function _onDragOver(evt) {
			var el = this.el, target = evt.target, dragRect, targetRect, revert, options = this.options, group = options.group, activeSortable = Sortable.active, isOwner = activeGroup === group, canSort = options.sort, fromSortable = putSortable || activeSortable, vertical, _this = this, completedFired = false;
			if (_silent) return;
			function dragOverEvent(name, extra) {
				pluginEvent(name, _this, _objectSpread2({
					evt,
					isOwner,
					axis: vertical ? "vertical" : "horizontal",
					revert,
					dragRect,
					targetRect,
					canSort,
					fromSortable,
					target,
					completed,
					onMove: function onMove(target, after) {
						return _onMove(rootEl, el, dragEl, dragRect, target, getRect(target), evt, after);
					},
					changed
				}, extra));
			}
			function capture() {
				dragOverEvent("dragOverAnimationCapture");
				_this.captureAnimationState();
				if (_this !== fromSortable) fromSortable.captureAnimationState();
			}
			function completed(insertion) {
				dragOverEvent("dragOverCompleted", { insertion });
				if (insertion) {
					if (isOwner) activeSortable._hideClone();
					else activeSortable._showClone(_this);
					if (_this !== fromSortable) {
						toggleClass(dragEl, putSortable ? putSortable.options.ghostClass : activeSortable.options.ghostClass, false);
						toggleClass(dragEl, options.ghostClass, true);
					}
					if (putSortable !== _this && _this !== Sortable.active) putSortable = _this;
					else if (_this === Sortable.active && putSortable) putSortable = null;
					if (fromSortable === _this) _this._ignoreWhileAnimating = target;
					_this.animateAll(function() {
						dragOverEvent("dragOverAnimationComplete");
						_this._ignoreWhileAnimating = null;
					});
					if (_this !== fromSortable) {
						fromSortable.animateAll();
						fromSortable._ignoreWhileAnimating = null;
					}
				}
				if (target === dragEl && !dragEl.animated || target === el && !target.animated) lastTarget = null;
				if (!options.dragoverBubble && !evt.rootEl && target !== document) {
					dragEl.parentNode[expando]._isOutsideThisEl(evt.target);
					!insertion && nearestEmptyInsertDetectEvent(evt);
				}
				!options.dragoverBubble && evt.stopPropagation && evt.stopPropagation();
				return completedFired = true;
			}
			function changed() {
				newIndex = index(dragEl);
				newDraggableIndex = index(dragEl, options.draggable);
				_dispatchEvent({
					sortable: _this,
					name: "change",
					toEl: el,
					newIndex,
					newDraggableIndex,
					originalEvent: evt
				});
			}
			if (evt.preventDefault !== void 0) evt.cancelable && evt.preventDefault();
			target = closest(target, options.draggable, el, true);
			dragOverEvent("dragOver");
			if (Sortable.eventCanceled) return completedFired;
			if (dragEl.contains(evt.target) || target.animated && target.animatingX && target.animatingY || _this._ignoreWhileAnimating === target) return completed(false);
			ignoreNextClick = false;
			if (activeSortable && !options.disabled && (isOwner ? canSort || (revert = parentEl !== rootEl) : putSortable === this || (this.lastPutMode = activeGroup.checkPull(this, activeSortable, dragEl, evt)) && group.checkPut(this, activeSortable, dragEl, evt))) {
				vertical = this._getDirection(evt, target) === "vertical";
				dragRect = getRect(dragEl);
				dragOverEvent("dragOverValid");
				if (Sortable.eventCanceled) return completedFired;
				if (revert) {
					parentEl = rootEl;
					capture();
					this._hideClone();
					dragOverEvent("revert");
					if (!Sortable.eventCanceled) if (nextEl) rootEl.insertBefore(dragEl, nextEl);
					else rootEl.appendChild(dragEl);
					return completed(true);
				}
				var elLastChild = lastChild(el, options.draggable);
				if (!elLastChild || _ghostIsLast(evt, vertical, this) && !elLastChild.animated) {
					if (elLastChild === dragEl) return completed(false);
					if (elLastChild && el === evt.target) target = elLastChild;
					if (target) targetRect = getRect(target);
					if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, !!target) !== false) {
						capture();
						el.appendChild(dragEl);
						parentEl = el;
						changed();
						return completed(true);
					}
				} else if (elLastChild && _ghostIsFirst(evt, vertical, this)) {
					var firstChild = getChild(el, 0, options, true);
					if (firstChild === dragEl) return completed(false);
					target = firstChild;
					targetRect = getRect(target);
					if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, false) !== false) {
						capture();
						el.insertBefore(dragEl, firstChild);
						parentEl = el;
						changed();
						return completed(true);
					}
				} else if (target.parentNode === el) {
					targetRect = getRect(target);
					var direction = 0, targetBeforeFirstSwap, differentLevel = dragEl.parentNode !== el, differentRowCol = !_dragElInRowColumn(dragEl.animated && dragEl.toRect || dragRect, target.animated && target.toRect || targetRect, vertical), side1 = vertical ? "top" : "left", scrolledPastTop = isScrolledPast(target, "top", "top") || isScrolledPast(dragEl, "top", "top"), scrollBefore = scrolledPastTop ? scrolledPastTop.scrollTop : void 0;
					if (lastTarget !== target) {
						targetBeforeFirstSwap = targetRect[side1];
						pastFirstInvertThresh = false;
						isCircumstantialInvert = !differentRowCol && options.invertSwap || differentLevel;
					}
					direction = _getSwapDirection(evt, target, targetRect, vertical, differentRowCol ? 1 : options.swapThreshold, options.invertedSwapThreshold == null ? options.swapThreshold : options.invertedSwapThreshold, isCircumstantialInvert, lastTarget === target);
					var sibling;
					if (direction !== 0) {
						var dragIndex = index(dragEl);
						do {
							dragIndex -= direction;
							sibling = parentEl.children[dragIndex];
						} while (sibling && (css(sibling, "display") === "none" || sibling === ghostEl));
					}
					if (direction === 0 || sibling === target) return completed(false);
					lastTarget = target;
					lastDirection = direction;
					var nextSibling = target.nextElementSibling, after = false;
					after = direction === 1;
					var moveVector = _onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, after);
					if (moveVector !== false) {
						if (moveVector === 1 || moveVector === -1) after = moveVector === 1;
						_silent = true;
						setTimeout(_unsilent, 30);
						capture();
						if (after && !nextSibling) el.appendChild(dragEl);
						else target.parentNode.insertBefore(dragEl, after ? nextSibling : target);
						if (scrolledPastTop) scrollBy(scrolledPastTop, 0, scrollBefore - scrolledPastTop.scrollTop);
						parentEl = dragEl.parentNode;
						if (targetBeforeFirstSwap !== void 0 && !isCircumstantialInvert) targetMoveDistance = Math.abs(targetBeforeFirstSwap - getRect(target)[side1]);
						changed();
						return completed(true);
					}
				}
				if (el.contains(dragEl)) return completed(false);
			}
			return false;
		},
		_ignoreWhileAnimating: null,
		_offMoveEvents: function _offMoveEvents() {
			off(document, "mousemove", this._onTouchMove);
			off(document, "touchmove", this._onTouchMove);
			off(document, "pointermove", this._onTouchMove);
			off(document, "dragover", nearestEmptyInsertDetectEvent);
			off(document, "mousemove", nearestEmptyInsertDetectEvent);
			off(document, "touchmove", nearestEmptyInsertDetectEvent);
		},
		_offUpEvents: function _offUpEvents() {
			var ownerDocument = this.el.ownerDocument;
			off(ownerDocument, "mouseup", this._onDrop);
			off(ownerDocument, "touchend", this._onDrop);
			off(ownerDocument, "pointerup", this._onDrop);
			off(ownerDocument, "touchcancel", this._onDrop);
			off(document, "selectstart", this);
		},
		_onDrop: function _onDrop(evt) {
			var el = this.el, options = this.options;
			newIndex = index(dragEl);
			newDraggableIndex = index(dragEl, options.draggable);
			pluginEvent("drop", this, { evt });
			parentEl = dragEl && dragEl.parentNode;
			newIndex = index(dragEl);
			newDraggableIndex = index(dragEl, options.draggable);
			if (Sortable.eventCanceled) {
				this._nulling();
				return;
			}
			awaitingDragStarted = false;
			isCircumstantialInvert = false;
			pastFirstInvertThresh = false;
			clearInterval(this._loopId);
			clearTimeout(this._dragStartTimer);
			_cancelNextTick(this.cloneId);
			_cancelNextTick(this._dragStartId);
			if (this.nativeDraggable) {
				off(document, "drop", this);
				off(el, "dragstart", this._onDragStart);
			}
			this._offMoveEvents();
			this._offUpEvents();
			if (Safari) css(document.body, "user-select", "");
			css(dragEl, "transform", "");
			if (evt) {
				if (moved) {
					evt.cancelable && evt.preventDefault();
					!options.dropBubble && evt.stopPropagation();
				}
				ghostEl && ghostEl.parentNode && ghostEl.parentNode.removeChild(ghostEl);
				if (rootEl === parentEl || putSortable && putSortable.lastPutMode !== "clone") cloneEl && cloneEl.parentNode && cloneEl.parentNode.removeChild(cloneEl);
				if (dragEl) {
					if (this.nativeDraggable) off(dragEl, "dragend", this);
					_disableDraggable(dragEl);
					dragEl.style["will-change"] = "";
					if (moved && !awaitingDragStarted) toggleClass(dragEl, putSortable ? putSortable.options.ghostClass : this.options.ghostClass, false);
					toggleClass(dragEl, this.options.chosenClass, false);
					_dispatchEvent({
						sortable: this,
						name: "unchoose",
						toEl: parentEl,
						newIndex: null,
						newDraggableIndex: null,
						originalEvent: evt
					});
					if (rootEl !== parentEl) {
						if (newIndex >= 0) {
							_dispatchEvent({
								rootEl: parentEl,
								name: "add",
								toEl: parentEl,
								fromEl: rootEl,
								originalEvent: evt
							});
							_dispatchEvent({
								sortable: this,
								name: "remove",
								toEl: parentEl,
								originalEvent: evt
							});
							_dispatchEvent({
								rootEl: parentEl,
								name: "sort",
								toEl: parentEl,
								fromEl: rootEl,
								originalEvent: evt
							});
							_dispatchEvent({
								sortable: this,
								name: "sort",
								toEl: parentEl,
								originalEvent: evt
							});
						}
						putSortable && putSortable.save();
					} else if (newIndex !== oldIndex) {
						if (newIndex >= 0) {
							_dispatchEvent({
								sortable: this,
								name: "update",
								toEl: parentEl,
								originalEvent: evt
							});
							_dispatchEvent({
								sortable: this,
								name: "sort",
								toEl: parentEl,
								originalEvent: evt
							});
						}
					}
					if (Sortable.active) {
						if (newIndex == null || newIndex === -1) {
							newIndex = oldIndex;
							newDraggableIndex = oldDraggableIndex;
						}
						_dispatchEvent({
							sortable: this,
							name: "end",
							toEl: parentEl,
							originalEvent: evt
						});
						this.save();
					}
				}
			}
			this._nulling();
		},
		_nulling: function _nulling() {
			pluginEvent("nulling", this);
			rootEl = dragEl = parentEl = ghostEl = nextEl = cloneEl = lastDownEl = cloneHidden = tapEvt = touchEvt = moved = newIndex = newDraggableIndex = oldIndex = oldDraggableIndex = lastTarget = lastDirection = putSortable = activeGroup = Sortable.dragged = Sortable.ghost = Sortable.clone = Sortable.active = null;
			savedInputChecked.forEach(function(el) {
				el.checked = true;
			});
			savedInputChecked.length = lastDx = lastDy = 0;
		},
		handleEvent: function handleEvent(evt) {
			switch (evt.type) {
				case "drop":
				case "dragend":
					this._onDrop(evt);
					break;
				case "dragenter":
				case "dragover":
					if (dragEl) {
						this._onDragOver(evt);
						_globalDragOver(evt);
					}
					break;
				case "selectstart":
					evt.preventDefault();
					break;
			}
		},
		toArray: function toArray() {
			var order = [], el, children = this.el.children, i = 0, n = children.length, options = this.options;
			for (; i < n; i++) {
				el = children[i];
				if (closest(el, options.draggable, this.el, false)) order.push(el.getAttribute(options.dataIdAttr) || _generateId(el));
			}
			return order;
		},
		sort: function sort(order, useAnimation) {
			var items = {}, rootEl = this.el;
			this.toArray().forEach(function(id, i) {
				var el = rootEl.children[i];
				if (closest(el, this.options.draggable, rootEl, false)) items[id] = el;
			}, this);
			useAnimation && this.captureAnimationState();
			order.forEach(function(id) {
				if (items[id]) {
					rootEl.removeChild(items[id]);
					rootEl.appendChild(items[id]);
				}
			});
			useAnimation && this.animateAll();
		},
		save: function save() {
			var store = this.options.store;
			store && store.set && store.set(this);
		},
		closest: function closest$1(el, selector) {
			return closest(el, selector || this.options.draggable, this.el, false);
		},
		option: function option(name, value) {
			var options = this.options;
			if (value === void 0) return options[name];
			else {
				var modifiedValue = PluginManager.modifyOption(this, name, value);
				if (typeof modifiedValue !== "undefined") options[name] = modifiedValue;
				else options[name] = value;
				if (name === "group") _prepareGroup(options);
			}
		},
		destroy: function destroy() {
			pluginEvent("destroy", this);
			var el = this.el;
			el[expando] = null;
			off(el, "mousedown", this._onTapStart);
			off(el, "touchstart", this._onTapStart);
			off(el, "pointerdown", this._onTapStart);
			if (this.nativeDraggable) {
				off(el, "dragover", this);
				off(el, "dragenter", this);
			}
			Array.prototype.forEach.call(el.querySelectorAll("[draggable]"), function(el) {
				el.removeAttribute("draggable");
			});
			this._onDrop();
			this._disableDelayedDragEvents();
			sortables.splice(sortables.indexOf(this.el), 1);
			this.el = el = null;
		},
		_hideClone: function _hideClone() {
			if (!cloneHidden) {
				pluginEvent("hideClone", this);
				if (Sortable.eventCanceled) return;
				css(cloneEl, "display", "none");
				if (this.options.removeCloneOnHide && cloneEl.parentNode) cloneEl.parentNode.removeChild(cloneEl);
				cloneHidden = true;
			}
		},
		_showClone: function _showClone(putSortable) {
			if (putSortable.lastPutMode !== "clone") {
				this._hideClone();
				return;
			}
			if (cloneHidden) {
				pluginEvent("showClone", this);
				if (Sortable.eventCanceled) return;
				if (dragEl.parentNode == rootEl && !this.options.group.revertClone) rootEl.insertBefore(cloneEl, dragEl);
				else if (nextEl) rootEl.insertBefore(cloneEl, nextEl);
				else rootEl.appendChild(cloneEl);
				if (this.options.group.revertClone) this.animate(dragEl, cloneEl);
				css(cloneEl, "display", "");
				cloneHidden = false;
			}
		}
	};
	function _globalDragOver(evt) {
		if (evt.dataTransfer) evt.dataTransfer.dropEffect = "move";
		evt.cancelable && evt.preventDefault();
	}
	function _onMove(fromEl, toEl, dragEl, dragRect, targetEl, targetRect, originalEvent, willInsertAfter) {
		var evt, sortable = fromEl[expando], onMoveFn = sortable.options.onMove, retVal;
		if (window.CustomEvent && !IE11OrLess && !Edge) evt = new CustomEvent("move", {
			bubbles: true,
			cancelable: true
		});
		else {
			evt = document.createEvent("Event");
			evt.initEvent("move", true, true);
		}
		evt.to = toEl;
		evt.from = fromEl;
		evt.dragged = dragEl;
		evt.draggedRect = dragRect;
		evt.related = targetEl || toEl;
		evt.relatedRect = targetRect || getRect(toEl);
		evt.willInsertAfter = willInsertAfter;
		evt.originalEvent = originalEvent;
		fromEl.dispatchEvent(evt);
		if (onMoveFn) retVal = onMoveFn.call(sortable, evt, originalEvent);
		return retVal;
	}
	function _disableDraggable(el) {
		el.draggable = false;
	}
	function _unsilent() {
		_silent = false;
	}
	function _ghostIsFirst(evt, vertical, sortable) {
		var rect = getRect(getChild(sortable.el, 0, sortable.options, true));
		var spacer = 10;
		return vertical ? evt.clientX < rect.left - spacer || evt.clientY < rect.top && evt.clientX < rect.right : evt.clientY < rect.top - spacer || evt.clientY < rect.bottom && evt.clientX < rect.left;
	}
	function _ghostIsLast(evt, vertical, sortable) {
		var rect = getRect(lastChild(sortable.el, sortable.options.draggable));
		var spacer = 10;
		return vertical ? evt.clientX > rect.right + spacer || evt.clientX <= rect.right && evt.clientY > rect.bottom && evt.clientX >= rect.left : evt.clientX > rect.right && evt.clientY > rect.top || evt.clientX <= rect.right && evt.clientY > rect.bottom + spacer;
	}
	function _getSwapDirection(evt, target, targetRect, vertical, swapThreshold, invertedSwapThreshold, invertSwap, isLastTarget) {
		var mouseOnAxis = vertical ? evt.clientY : evt.clientX, targetLength = vertical ? targetRect.height : targetRect.width, targetS1 = vertical ? targetRect.top : targetRect.left, targetS2 = vertical ? targetRect.bottom : targetRect.right, invert = false;
		if (!invertSwap) {
			if (isLastTarget && targetMoveDistance < targetLength * swapThreshold) {
				if (!pastFirstInvertThresh && (lastDirection === 1 ? mouseOnAxis > targetS1 + targetLength * invertedSwapThreshold / 2 : mouseOnAxis < targetS2 - targetLength * invertedSwapThreshold / 2)) pastFirstInvertThresh = true;
				if (!pastFirstInvertThresh) {
					if (lastDirection === 1 ? mouseOnAxis < targetS1 + targetMoveDistance : mouseOnAxis > targetS2 - targetMoveDistance) return -lastDirection;
				} else invert = true;
			} else if (mouseOnAxis > targetS1 + targetLength * (1 - swapThreshold) / 2 && mouseOnAxis < targetS2 - targetLength * (1 - swapThreshold) / 2) return _getInsertDirection(target);
		}
		invert = invert || invertSwap;
		if (invert) {
			if (mouseOnAxis < targetS1 + targetLength * invertedSwapThreshold / 2 || mouseOnAxis > targetS2 - targetLength * invertedSwapThreshold / 2) return mouseOnAxis > targetS1 + targetLength / 2 ? 1 : -1;
		}
		return 0;
	}
	function _getInsertDirection(target) {
		if (index(dragEl) < index(target)) return 1;
		else return -1;
	}
	function _generateId(el) {
		var str = el.tagName + el.className + el.src + el.href + el.textContent, i = str.length, sum = 0;
		while (i--) sum += str.charCodeAt(i);
		return sum.toString(36);
	}
	function _saveInputCheckedState(root) {
		savedInputChecked.length = 0;
		var inputs = root.getElementsByTagName("input");
		var idx = inputs.length;
		while (idx--) {
			var el = inputs[idx];
			el.checked && savedInputChecked.push(el);
		}
	}
	function _nextTick(fn) {
		return setTimeout(fn, 0);
	}
	function _cancelNextTick(id) {
		return clearTimeout(id);
	}
	if (documentExists) on(document, "touchmove", function(evt) {
		if ((Sortable.active || awaitingDragStarted) && evt.cancelable) evt.preventDefault();
	});
	Sortable.utils = {
		on,
		off,
		css,
		find,
		is: function is(el, selector) {
			return !!closest(el, selector, el, false);
		},
		extend,
		throttle,
		closest,
		toggleClass,
		clone: clone$1,
		index,
		nextTick: _nextTick,
		cancelNextTick: _cancelNextTick,
		detectDirection: _detectDirection,
		getChild
	};
	Sortable.get = function(element) {
		return element[expando];
	};
	Sortable.mount = function() {
		for (var _len = arguments.length, plugins = new Array(_len), _key = 0; _key < _len; _key++) plugins[_key] = arguments[_key];
		if (plugins[0].constructor === Array) plugins = plugins[0];
		plugins.forEach(function(plugin) {
			if (!plugin.prototype || !plugin.prototype.constructor) throw "Sortable: Mounted plugin must be a constructor function, not ".concat({}.toString.call(plugin));
			if (plugin.utils) Sortable.utils = _objectSpread2(_objectSpread2({}, Sortable.utils), plugin.utils);
			PluginManager.mount(plugin);
		});
	};
	Sortable.create = function(el, options) {
		return new Sortable(el, options);
	};
	Sortable.version = version;
	var autoScrolls = [], scrollEl, scrollRootEl, scrolling = false, lastAutoScrollX, lastAutoScrollY, touchEvt$1, pointerElemChangedInterval;
	function AutoScrollPlugin() {
		function AutoScroll() {
			this.defaults = {
				scroll: true,
				forceAutoScrollFallback: false,
				scrollSensitivity: 30,
				scrollSpeed: 10,
				bubbleScroll: true
			};
			for (var fn in this) if (fn.charAt(0) === "_" && typeof this[fn] === "function") this[fn] = this[fn].bind(this);
		}
		AutoScroll.prototype = {
			dragStarted: function dragStarted(_ref) {
				var originalEvent = _ref.originalEvent;
				if (this.sortable.nativeDraggable) on(document, "dragover", this._handleAutoScroll);
				else if (this.options.supportPointer) on(document, "pointermove", this._handleFallbackAutoScroll);
				else if (originalEvent.touches) on(document, "touchmove", this._handleFallbackAutoScroll);
				else on(document, "mousemove", this._handleFallbackAutoScroll);
			},
			dragOverCompleted: function dragOverCompleted(_ref2) {
				var originalEvent = _ref2.originalEvent;
				if (!this.options.dragOverBubble && !originalEvent.rootEl) this._handleAutoScroll(originalEvent);
			},
			drop: function drop() {
				if (this.sortable.nativeDraggable) off(document, "dragover", this._handleAutoScroll);
				else {
					off(document, "pointermove", this._handleFallbackAutoScroll);
					off(document, "touchmove", this._handleFallbackAutoScroll);
					off(document, "mousemove", this._handleFallbackAutoScroll);
				}
				clearPointerElemChangedInterval();
				clearAutoScrolls();
				cancelThrottle();
			},
			nulling: function nulling() {
				touchEvt$1 = scrollRootEl = scrollEl = scrolling = pointerElemChangedInterval = lastAutoScrollX = lastAutoScrollY = null;
				autoScrolls.length = 0;
			},
			_handleFallbackAutoScroll: function _handleFallbackAutoScroll(evt) {
				this._handleAutoScroll(evt, true);
			},
			_handleAutoScroll: function _handleAutoScroll(evt, fallback) {
				var _this = this;
				var x = (evt.touches ? evt.touches[0] : evt).clientX, y = (evt.touches ? evt.touches[0] : evt).clientY, elem = document.elementFromPoint(x, y);
				touchEvt$1 = evt;
				if (fallback || this.options.forceAutoScrollFallback || Edge || IE11OrLess || Safari) {
					autoScroll(evt, this.options, elem, fallback);
					var ogElemScroller = getParentAutoScrollElement(elem, true);
					if (scrolling && (!pointerElemChangedInterval || x !== lastAutoScrollX || y !== lastAutoScrollY)) {
						pointerElemChangedInterval && clearPointerElemChangedInterval();
						pointerElemChangedInterval = setInterval(function() {
							var newElem = getParentAutoScrollElement(document.elementFromPoint(x, y), true);
							if (newElem !== ogElemScroller) {
								ogElemScroller = newElem;
								clearAutoScrolls();
							}
							autoScroll(evt, _this.options, newElem, fallback);
						}, 10);
						lastAutoScrollX = x;
						lastAutoScrollY = y;
					}
				} else {
					if (!this.options.bubbleScroll || getParentAutoScrollElement(elem, true) === getWindowScrollingElement()) {
						clearAutoScrolls();
						return;
					}
					autoScroll(evt, this.options, getParentAutoScrollElement(elem, false), false);
				}
			}
		};
		return _extends(AutoScroll, {
			pluginName: "scroll",
			initializeByDefault: true
		});
	}
	function clearAutoScrolls() {
		autoScrolls.forEach(function(autoScroll) {
			clearInterval(autoScroll.pid);
		});
		autoScrolls = [];
	}
	function clearPointerElemChangedInterval() {
		clearInterval(pointerElemChangedInterval);
	}
	var autoScroll = throttle(function(evt, options, rootEl, isFallback) {
		if (!options.scroll) return;
		var x = (evt.touches ? evt.touches[0] : evt).clientX, y = (evt.touches ? evt.touches[0] : evt).clientY, sens = options.scrollSensitivity, speed = options.scrollSpeed, winScroller = getWindowScrollingElement();
		var scrollThisInstance = false, scrollCustomFn;
		if (scrollRootEl !== rootEl) {
			scrollRootEl = rootEl;
			clearAutoScrolls();
			scrollEl = options.scroll;
			scrollCustomFn = options.scrollFn;
			if (scrollEl === true) scrollEl = getParentAutoScrollElement(rootEl, true);
		}
		var layersOut = 0;
		var currentParent = scrollEl;
		do {
			var el = currentParent, rect = getRect(el), top = rect.top, bottom = rect.bottom, left = rect.left, right = rect.right, width = rect.width, height = rect.height, canScrollX = void 0, canScrollY = void 0, scrollWidth = el.scrollWidth, scrollHeight = el.scrollHeight, elCSS = css(el), scrollPosX = el.scrollLeft, scrollPosY = el.scrollTop;
			if (el === winScroller) {
				canScrollX = width < scrollWidth && (elCSS.overflowX === "auto" || elCSS.overflowX === "scroll" || elCSS.overflowX === "visible");
				canScrollY = height < scrollHeight && (elCSS.overflowY === "auto" || elCSS.overflowY === "scroll" || elCSS.overflowY === "visible");
			} else {
				canScrollX = width < scrollWidth && (elCSS.overflowX === "auto" || elCSS.overflowX === "scroll");
				canScrollY = height < scrollHeight && (elCSS.overflowY === "auto" || elCSS.overflowY === "scroll");
			}
			var vx = canScrollX && (Math.abs(right - x) <= sens && scrollPosX + width < scrollWidth) - (Math.abs(left - x) <= sens && !!scrollPosX);
			var vy = canScrollY && (Math.abs(bottom - y) <= sens && scrollPosY + height < scrollHeight) - (Math.abs(top - y) <= sens && !!scrollPosY);
			if (!autoScrolls[layersOut]) {
				for (var i = 0; i <= layersOut; i++) if (!autoScrolls[i]) autoScrolls[i] = {};
			}
			if (autoScrolls[layersOut].vx != vx || autoScrolls[layersOut].vy != vy || autoScrolls[layersOut].el !== el) {
				autoScrolls[layersOut].el = el;
				autoScrolls[layersOut].vx = vx;
				autoScrolls[layersOut].vy = vy;
				clearInterval(autoScrolls[layersOut].pid);
				if (vx != 0 || vy != 0) {
					scrollThisInstance = true;
					autoScrolls[layersOut].pid = setInterval(function() {
						if (isFallback && this.layer === 0) Sortable.active._onTouchMove(touchEvt$1);
						var scrollOffsetY = autoScrolls[this.layer].vy ? autoScrolls[this.layer].vy * speed : 0;
						var scrollOffsetX = autoScrolls[this.layer].vx ? autoScrolls[this.layer].vx * speed : 0;
						if (typeof scrollCustomFn === "function") {
							if (scrollCustomFn.call(Sortable.dragged.parentNode[expando], scrollOffsetX, scrollOffsetY, evt, touchEvt$1, autoScrolls[this.layer].el) !== "continue") return;
						}
						scrollBy(autoScrolls[this.layer].el, scrollOffsetX, scrollOffsetY);
					}.bind({ layer: layersOut }), 24);
				}
			}
			layersOut++;
		} while (options.bubbleScroll && currentParent !== winScroller && (currentParent = getParentAutoScrollElement(currentParent, false)));
		scrolling = scrollThisInstance;
	}, 30);
	var drop = function drop(_ref) {
		var originalEvent = _ref.originalEvent, putSortable = _ref.putSortable, dragEl = _ref.dragEl, activeSortable = _ref.activeSortable, dispatchSortableEvent = _ref.dispatchSortableEvent, hideGhostForTarget = _ref.hideGhostForTarget, unhideGhostForTarget = _ref.unhideGhostForTarget;
		if (!originalEvent) return;
		var toSortable = putSortable || activeSortable;
		hideGhostForTarget();
		var touch = originalEvent.changedTouches && originalEvent.changedTouches.length ? originalEvent.changedTouches[0] : originalEvent;
		var target = document.elementFromPoint(touch.clientX, touch.clientY);
		unhideGhostForTarget();
		if (toSortable && !toSortable.el.contains(target)) {
			dispatchSortableEvent("spill");
			this.onSpill({
				dragEl,
				putSortable
			});
		}
	};
	function Revert() {}
	Revert.prototype = {
		startIndex: null,
		dragStart: function dragStart(_ref2) {
			var oldDraggableIndex = _ref2.oldDraggableIndex;
			this.startIndex = oldDraggableIndex;
		},
		onSpill: function onSpill(_ref3) {
			var dragEl = _ref3.dragEl, putSortable = _ref3.putSortable;
			this.sortable.captureAnimationState();
			if (putSortable) putSortable.captureAnimationState();
			var nextSibling = getChild(this.sortable.el, this.startIndex, this.options);
			if (nextSibling) this.sortable.el.insertBefore(dragEl, nextSibling);
			else this.sortable.el.appendChild(dragEl);
			this.sortable.animateAll();
			if (putSortable) putSortable.animateAll();
		},
		drop
	};
	_extends(Revert, { pluginName: "revertOnSpill" });
	function Remove() {}
	Remove.prototype = {
		onSpill: function onSpill(_ref4) {
			var dragEl = _ref4.dragEl;
			var parentSortable = _ref4.putSortable || this.sortable;
			parentSortable.captureAnimationState();
			dragEl.parentNode && dragEl.parentNode.removeChild(dragEl);
			parentSortable.animateAll();
		},
		drop
	};
	_extends(Remove, { pluginName: "removeOnSpill" });
	Sortable.mount(new AutoScrollPlugin());
	Sortable.mount(Remove, Revert);
	function removeNode(node) {
		if (node.parentElement !== null) node.parentElement.removeChild(node);
	}
	function insertNodeAt(fatherNode, node, position) {
		const refNode = position === 0 ? fatherNode.children[0] : fatherNode.children[position - 1].nextSibling;
		fatherNode.insertBefore(node, refNode);
	}
	function getConsole() {
		if (typeof window !== "undefined") return window.console;
		return global.console;
	}
	var console$1 = getConsole();
	function cached(fn) {
		const cache = Object.create(null);
		return function cachedFn(str) {
			return cache[str] || (cache[str] = fn(str));
		};
	}
	var regex = /-(\w)/g;
	var camelize = cached((str) => str.replace(regex, (_, c) => c.toUpperCase()));
	var manageAndEmit$1 = [
		"Start",
		"Add",
		"Remove",
		"Update",
		"End"
	];
	var emit$1 = [
		"Choose",
		"Unchoose",
		"Sort",
		"Filter",
		"Clone"
	];
	var manage$1 = ["Move"];
	var eventHandlerNames = [
		manage$1,
		manageAndEmit$1,
		emit$1
	].flatMap((events) => events).map((evt) => `on${evt}`);
	var events = {
		manage: manage$1,
		manageAndEmit: manageAndEmit$1,
		emit: emit$1
	};
	function isReadOnly(eventName) {
		return eventHandlerNames.indexOf(eventName) !== -1;
	}
	var tags = [
		"a",
		"abbr",
		"address",
		"area",
		"article",
		"aside",
		"audio",
		"b",
		"base",
		"bdi",
		"bdo",
		"blockquote",
		"body",
		"br",
		"button",
		"canvas",
		"caption",
		"cite",
		"code",
		"col",
		"colgroup",
		"data",
		"datalist",
		"dd",
		"del",
		"details",
		"dfn",
		"dialog",
		"div",
		"dl",
		"dt",
		"em",
		"embed",
		"fieldset",
		"figcaption",
		"figure",
		"footer",
		"form",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"head",
		"header",
		"hgroup",
		"hr",
		"html",
		"i",
		"iframe",
		"img",
		"input",
		"ins",
		"kbd",
		"label",
		"legend",
		"li",
		"link",
		"main",
		"map",
		"mark",
		"math",
		"menu",
		"menuitem",
		"meta",
		"meter",
		"nav",
		"noscript",
		"object",
		"ol",
		"optgroup",
		"option",
		"output",
		"p",
		"param",
		"picture",
		"pre",
		"progress",
		"q",
		"rb",
		"rp",
		"rt",
		"rtc",
		"ruby",
		"s",
		"samp",
		"script",
		"section",
		"select",
		"slot",
		"small",
		"source",
		"span",
		"strong",
		"style",
		"sub",
		"summary",
		"sup",
		"svg",
		"table",
		"tbody",
		"td",
		"template",
		"textarea",
		"tfoot",
		"th",
		"thead",
		"time",
		"title",
		"tr",
		"track",
		"u",
		"ul",
		"var",
		"video",
		"wbr"
	];
	function isHtmlTag(name) {
		return tags.includes(name);
	}
	function isTransition(name) {
		return ["transition-group", "TransitionGroup"].includes(name);
	}
	function isHtmlAttribute(value) {
		return [
			"id",
			"class",
			"role",
			"style"
		].includes(value) || value.startsWith("data-") || value.startsWith("aria-") || value.startsWith("on");
	}
	function project(entries) {
		return entries.reduce((res, [key, value]) => {
			res[key] = value;
			return res;
		}, {});
	}
	function getComponentAttributes({ $attrs, componentData = {} }) {
		return {
			...project(Object.entries($attrs).filter(([key, _]) => isHtmlAttribute(key))),
			...componentData
		};
	}
	function createSortableOption({ $attrs, callBackBuilder }) {
		const options = project(getValidSortableEntries($attrs));
		Object.entries(callBackBuilder).forEach(([eventType, eventBuilder]) => {
			events[eventType].forEach((event) => {
				options[`on${event}`] = eventBuilder(event);
			});
		});
		const draggable = `[data-draggable]${options.draggable || ""}`;
		return {
			...options,
			draggable
		};
	}
	function getValidSortableEntries(value) {
		return Object.entries(value).filter(([key, _]) => !isHtmlAttribute(key)).map(([key, value]) => [camelize(key), value]).filter(([key, _]) => !isReadOnly(key));
	}
	var getHtmlElementFromNode = ({ el }) => el;
	var addContext = (domElement, context) => domElement.__draggable_context = context;
	var getContext = (domElement) => domElement.__draggable_context;
	var ComponentStructure = class {
		constructor({ nodes: { header, default: defaultNodes, footer }, root, realList }) {
			this.defaultNodes = defaultNodes;
			this.children = [
				...header,
				...defaultNodes,
				...footer
			];
			this.externalComponent = root.externalComponent;
			this.rootTransition = root.transition;
			this.tag = root.tag;
			this.realList = realList;
		}
		get _isRootComponent() {
			return this.externalComponent || this.rootTransition;
		}
		render(h, attributes) {
			const { tag, children, _isRootComponent } = this;
			return h(tag, attributes, !_isRootComponent ? children : { default: () => children });
		}
		updated() {
			const { defaultNodes, realList } = this;
			defaultNodes.forEach((node, index) => {
				addContext(getHtmlElementFromNode(node), {
					element: realList[index],
					index
				});
			});
		}
		getUnderlyingVm(domElement) {
			return getContext(domElement);
		}
		getVmIndexFromDomIndex(domIndex, element) {
			const { defaultNodes } = this;
			const { length } = defaultNodes;
			const domChildren = element.children;
			const domElement = domChildren.item(domIndex);
			if (domElement === null) return length;
			const context = getContext(domElement);
			if (context) return context.index;
			if (length === 0) return 0;
			const firstDomListElement = getHtmlElementFromNode(defaultNodes[0]);
			return domIndex < [...domChildren].findIndex((element) => element === firstDomListElement) ? 0 : length;
		}
	};
	function getSlot(slots, key) {
		const slotValue = slots[key];
		return slotValue ? slotValue() : [];
	}
	function computeNodes({ $slots, realList, getKey }) {
		const normalizedList = realList || [];
		const [header, footer] = ["header", "footer"].map((name) => getSlot($slots, name));
		const { item } = $slots;
		if (!item) throw new Error("draggable element must have an item slot");
		const defaultNodes = normalizedList.flatMap((element, index) => item({
			element,
			index
		}).map((node) => {
			node.key = getKey(element);
			node.props = {
				...node.props || {},
				"data-draggable": true
			};
			return node;
		}));
		if (defaultNodes.length !== normalizedList.length) throw new Error("Item slot must have only one child");
		return {
			header,
			footer,
			default: defaultNodes
		};
	}
	function getRootInformation(tag) {
		const transition = isTransition(tag);
		const externalComponent = !isHtmlTag(tag) && !transition;
		return {
			transition,
			externalComponent,
			tag: externalComponent ? resolveComponent(tag) : transition ? TransitionGroup : tag
		};
	}
	function computeComponentStructure({ $slots, tag, realList, getKey }) {
		return new ComponentStructure({
			nodes: computeNodes({
				$slots,
				realList,
				getKey
			}),
			root: getRootInformation(tag),
			realList
		});
	}
	function emit(evtName, evtData) {
		nextTick(() => this.$emit(evtName.toLowerCase(), evtData));
	}
	function manage(evtName) {
		return (evtData, originalElement) => {
			if (this.realList !== null) return this[`onDrag${evtName}`](evtData, originalElement);
		};
	}
	function manageAndEmit(evtName) {
		const delegateCallBack = manage.call(this, evtName);
		return (evtData, originalElement) => {
			delegateCallBack.call(this, evtData, originalElement);
			emit.call(this, evtName, evtData);
		};
	}
	var draggingElement = null;
	var draggableComponent = defineComponent({
		name: "draggable",
		inheritAttrs: false,
		props: {
			list: {
				type: Array,
				required: false,
				default: null
			},
			modelValue: {
				type: Array,
				required: false,
				default: null
			},
			itemKey: {
				type: [String, Function],
				required: true
			},
			clone: {
				type: Function,
				default: (original) => {
					return original;
				}
			},
			tag: {
				type: String,
				default: "div"
			},
			move: {
				type: Function,
				default: null
			},
			componentData: {
				type: Object,
				required: false,
				default: null
			}
		},
		emits: [
			"update:modelValue",
			"change",
			...[...events.manageAndEmit, ...events.emit].map((evt) => evt.toLowerCase())
		],
		data() {
			return { error: false };
		},
		render() {
			try {
				this.error = false;
				const { $slots, $attrs, tag, componentData, realList, getKey } = this;
				const componentStructure = computeComponentStructure({
					$slots,
					tag,
					realList,
					getKey
				});
				this.componentStructure = componentStructure;
				const attributes = getComponentAttributes({
					$attrs,
					componentData
				});
				return componentStructure.render(h, attributes);
			} catch (err) {
				this.error = true;
				return h("pre", { style: { color: "red" } }, err.stack);
			}
		},
		created() {
			if (this.list !== null && this.modelValue !== null) console$1.error("modelValue and list props are mutually exclusive! Please set one or another.");
		},
		mounted() {
			if (this.error) return;
			const { $attrs, $el, componentStructure } = this;
			componentStructure.updated();
			const sortableOptions = createSortableOption({
				$attrs,
				callBackBuilder: {
					manageAndEmit: (event) => manageAndEmit.call(this, event),
					emit: (event) => emit.bind(this, event),
					manage: (event) => manage.call(this, event)
				}
			});
			const targetDomElement = $el.nodeType === 1 ? $el : $el.parentElement;
			this._sortable = new Sortable(targetDomElement, sortableOptions);
			this.targetDomElement = targetDomElement;
			targetDomElement.__draggable_component__ = this;
		},
		updated() {
			this.componentStructure.updated();
		},
		beforeUnmount() {
			if (this._sortable !== void 0) this._sortable.destroy();
		},
		computed: {
			realList() {
				const { list } = this;
				return list ? list : this.modelValue;
			},
			getKey() {
				const { itemKey } = this;
				if (typeof itemKey === "function") return itemKey;
				return (element) => element[itemKey];
			}
		},
		watch: { $attrs: {
			handler(newOptionValue) {
				const { _sortable } = this;
				if (!_sortable) return;
				getValidSortableEntries(newOptionValue).forEach(([key, value]) => {
					_sortable.option(key, value);
				});
			},
			deep: true
		} },
		methods: {
			getUnderlyingVm(domElement) {
				return this.componentStructure.getUnderlyingVm(domElement) || null;
			},
			getUnderlyingPotencialDraggableComponent(htmElement) {
				return htmElement.__draggable_component__;
			},
			emitChanges(evt) {
				nextTick(() => this.$emit("change", evt));
			},
			alterList(onList) {
				if (this.list) {
					onList(this.list);
					return;
				}
				const newList = [...this.modelValue];
				onList(newList);
				this.$emit("update:modelValue", newList);
			},
			spliceList() {
				const spliceList = (list) => list.splice(...arguments);
				this.alterList(spliceList);
			},
			updatePosition(oldIndex, newIndex) {
				const updatePosition = (list) => list.splice(newIndex, 0, list.splice(oldIndex, 1)[0]);
				this.alterList(updatePosition);
			},
			getRelatedContextFromMoveEvent({ to, related }) {
				const component = this.getUnderlyingPotencialDraggableComponent(to);
				if (!component) return { component };
				const list = component.realList;
				const context = {
					list,
					component
				};
				if (to !== related && list) return {
					...component.getUnderlyingVm(related) || {},
					...context
				};
				return context;
			},
			getVmIndexFromDomIndex(domIndex) {
				return this.componentStructure.getVmIndexFromDomIndex(domIndex, this.targetDomElement);
			},
			onDragStart(evt) {
				this.context = this.getUnderlyingVm(evt.item);
				evt.item._underlying_vm_ = this.clone(this.context.element);
				draggingElement = evt.item;
			},
			onDragAdd(evt) {
				const element = evt.item._underlying_vm_;
				if (element === void 0) return;
				removeNode(evt.item);
				const newIndex = this.getVmIndexFromDomIndex(evt.newIndex);
				this.spliceList(newIndex, 0, element);
				const added = {
					element,
					newIndex
				};
				this.emitChanges({ added });
			},
			onDragRemove(evt) {
				insertNodeAt(this.$el, evt.item, evt.oldIndex);
				if (evt.pullMode === "clone") {
					removeNode(evt.clone);
					return;
				}
				const { index: oldIndex, element } = this.context;
				this.spliceList(oldIndex, 1);
				const removed = {
					element,
					oldIndex
				};
				this.emitChanges({ removed });
			},
			onDragUpdate(evt) {
				removeNode(evt.item);
				insertNodeAt(evt.from, evt.item, evt.oldIndex);
				const oldIndex = this.context.index;
				const newIndex = this.getVmIndexFromDomIndex(evt.newIndex);
				this.updatePosition(oldIndex, newIndex);
				const moved = {
					element: this.context.element,
					oldIndex,
					newIndex
				};
				this.emitChanges({ moved });
			},
			computeFutureIndex(relatedContext, evt) {
				if (!relatedContext.element) return 0;
				const domChildren = [...evt.to.children].filter((el) => el.style["display"] !== "none");
				const currentDomIndex = domChildren.indexOf(evt.related);
				const currentIndex = relatedContext.component.getVmIndexFromDomIndex(currentDomIndex);
				return domChildren.indexOf(draggingElement) !== -1 || !evt.willInsertAfter ? currentIndex : currentIndex + 1;
			},
			onDragMove(evt, originalEvent) {
				const { move, realList } = this;
				if (!move || !realList) return true;
				const relatedContext = this.getRelatedContextFromMoveEvent(evt);
				const futureIndex = this.computeFutureIndex(relatedContext, evt);
				const draggedContext = {
					...this.context,
					futureIndex
				};
				return move({
					...evt,
					relatedContext,
					draggedContext
				}, originalEvent);
			},
			onDragEnd() {
				draggingElement = null;
			}
		}
	});
	var isEmptyString = (value) => value === "";
	var mergeClasses = (...classes) => classes.filter((className, index, array) => {
		return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
	}).join(" ").trim();
	var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
	var toCamelCase = (string) => string.replace(/^([A-Z])|[\s-_]+(\w)/g, (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase());
	var toPascalCase = (string) => {
		const camelCase = toCamelCase(string);
		return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
	};
	var defaultAttributes = {
		xmlns: "http://www.w3.org/2000/svg",
		width: 24,
		height: 24,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		"stroke-width": 2,
		"stroke-linecap": "round",
		"stroke-linejoin": "round"
	};
	var LUCIDE_CONTEXT = Symbol("lucide-icons");
	function useLucideProps() {
		return inject(LUCIDE_CONTEXT, {});
	}
	var Icon = ({ name, iconNode, absoluteStrokeWidth, "absolute-stroke-width": absoluteStrokeWidthKebabCase, strokeWidth, "stroke-width": strokeWidthKebabCase, size, color, ...props }, { slots }) => {
		const { size: contextSize, color: contextColor, strokeWidth: contextStrokeWidth = 2, absoluteStrokeWidth: contextAbsoluteStrokeWidth = false, class: contextClass = "" } = useLucideProps();
		const calculatedStrokeWidth = computed(() => {
			const isAbsoluteStrokeWidth = isEmptyString(absoluteStrokeWidth) || isEmptyString(absoluteStrokeWidthKebabCase) || absoluteStrokeWidth === true || absoluteStrokeWidthKebabCase === true || contextAbsoluteStrokeWidth === true;
			const strokeWidthValue = strokeWidth || strokeWidthKebabCase || contextStrokeWidth || defaultAttributes["stroke-width"];
			if (isAbsoluteStrokeWidth) return Number(strokeWidthValue) * 24 / Number(size ?? contextSize ?? defaultAttributes.width);
			return strokeWidthValue;
		});
		return h("svg", {
			...defaultAttributes,
			...props,
			width: size ?? contextSize ?? defaultAttributes.width,
			height: size ?? contextSize ?? defaultAttributes.height,
			stroke: color ?? contextColor ?? defaultAttributes.stroke,
			"stroke-width": calculatedStrokeWidth.value,
			class: mergeClasses("lucide", contextClass, ...name ? [`lucide-${toKebabCase(toPascalCase(name))}-icon`, `lucide-${toKebabCase(name)}`] : ["lucide-icon"])
		}, [...iconNode.map((child) => h(...child)), ...slots.default ? [slots.default()] : []]);
	};
	var createLucideIcon = (iconName, iconNode) => (props, { slots, attrs }) => h(Icon, {
		...attrs,
		...props,
		iconNode,
		name: iconName
	}, slots.default ? { default: slots.default } : void 0);
	var Check = createLucideIcon("check", [["path", {
		d: "M20 6 9 17l-5-5",
		key: "1gmf2c"
	}]]);
	var ChevronLeft = createLucideIcon("chevron-left", [["path", {
		d: "m15 18-6-6 6-6",
		key: "1wnfg3"
	}]]);
	var ChevronRight = createLucideIcon("chevron-right", [["path", {
		d: "m9 18 6-6-6-6",
		key: "mthhwq"
	}]]);
	var CircleAlert = createLucideIcon("circle-alert", [
		["circle", {
			cx: "12",
			cy: "12",
			r: "10",
			key: "1mglay"
		}],
		["line", {
			x1: "12",
			x2: "12",
			y1: "8",
			y2: "12",
			key: "1pkeuh"
		}],
		["line", {
			x1: "12",
			x2: "12.01",
			y1: "16",
			y2: "16",
			key: "4dfq90"
		}]
	]);
	var Code = createLucideIcon("code", [["path", {
		d: "m16 18 6-6-6-6",
		key: "eg8j8"
	}], ["path", {
		d: "m8 6-6 6 6 6",
		key: "ppft3o"
	}]]);
	var Copy = createLucideIcon("copy", [["rect", {
		width: "14",
		height: "14",
		x: "8",
		y: "8",
		rx: "2",
		ry: "2",
		key: "17jyea"
	}], ["path", {
		d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
		key: "zix9uf"
	}]]);
	var Download = createLucideIcon("download", [
		["path", {
			d: "M12 15V3",
			key: "m9g1x1"
		}],
		["path", {
			d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
			key: "ih7n3h"
		}],
		["path", {
			d: "m7 10 5 5 5-5",
			key: "brsn70"
		}]
	]);
	var ExternalLink = createLucideIcon("external-link", [
		["path", {
			d: "M15 3h6v6",
			key: "1q9fwt"
		}],
		["path", {
			d: "M10 14 21 3",
			key: "gplh6r"
		}],
		["path", {
			d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
			key: "a6xqqp"
		}]
	]);
	var GripVertical = createLucideIcon("grip-vertical", [
		["circle", {
			cx: "9",
			cy: "12",
			r: "1",
			key: "1vctgf"
		}],
		["circle", {
			cx: "9",
			cy: "5",
			r: "1",
			key: "hp0tcf"
		}],
		["circle", {
			cx: "9",
			cy: "19",
			r: "1",
			key: "fkjjf6"
		}],
		["circle", {
			cx: "15",
			cy: "12",
			r: "1",
			key: "1tmaij"
		}],
		["circle", {
			cx: "15",
			cy: "5",
			r: "1",
			key: "19l28e"
		}],
		["circle", {
			cx: "15",
			cy: "19",
			r: "1",
			key: "f4zoj3"
		}]
	]);
	var Info = createLucideIcon("info", [
		["circle", {
			cx: "12",
			cy: "12",
			r: "10",
			key: "1mglay"
		}],
		["path", {
			d: "M12 16v-4",
			key: "1dtifu"
		}],
		["path", {
			d: "M12 8h.01",
			key: "e9boi3"
		}]
	]);
	var Palette = createLucideIcon("palette", [
		["path", {
			d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
			key: "e79jfc"
		}],
		["circle", {
			cx: "13.5",
			cy: "6.5",
			r: ".5",
			fill: "currentColor",
			key: "1okk4w"
		}],
		["circle", {
			cx: "17.5",
			cy: "10.5",
			r: ".5",
			fill: "currentColor",
			key: "f64h9f"
		}],
		["circle", {
			cx: "6.5",
			cy: "12.5",
			r: ".5",
			fill: "currentColor",
			key: "qy21gx"
		}],
		["circle", {
			cx: "8.5",
			cy: "7.5",
			r: ".5",
			fill: "currentColor",
			key: "fotxhn"
		}]
	]);
	var Pencil = createLucideIcon("pencil", [["path", {
		d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
		key: "1a8usu"
	}], ["path", {
		d: "m15 5 4 4",
		key: "1mk7zo"
	}]]);
	var Plus = createLucideIcon("plus", [["path", {
		d: "M5 12h14",
		key: "1ays0h"
	}], ["path", {
		d: "M12 5v14",
		key: "s699le"
	}]]);
	var RotateCcw = createLucideIcon("rotate-ccw", [["path", {
		d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
		key: "1357e3"
	}], ["path", {
		d: "M3 3v5h5",
		key: "1xhq8a"
	}]]);
	var Settings = createLucideIcon("settings", [["path", {
		d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",
		key: "1i5ecw"
	}], ["circle", {
		cx: "12",
		cy: "12",
		r: "3",
		key: "1v7zrd"
	}]]);
	var Trash2 = createLucideIcon("trash-2", [
		["path", {
			d: "M10 11v6",
			key: "nco0om"
		}],
		["path", {
			d: "M14 11v6",
			key: "outv1u"
		}],
		["path", {
			d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
			key: "miytrc"
		}],
		["path", {
			d: "M3 6h18",
			key: "d0wm0j"
		}],
		["path", {
			d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
			key: "e791ji"
		}]
	]);
	var X = createLucideIcon("x", [["path", {
		d: "M18 6 6 18",
		key: "1bl5f8"
	}], ["path", {
		d: "m6 6 12 12",
		key: "d8bk6v"
	}]]);
	var _sfc_main = defineComponent({
		__name: "contenteditable",
		props: {
			"tag": String,
			"contenteditable": {
				type: [Boolean, String],
				default: true
			},
			"modelValue": String,
			"noHtml": {
				type: Boolean,
				default: true
			},
			"noNl": {
				type: Boolean,
				default: false
			}
		},
		emits: {
			"returned": String,
			"update:modelValue": String
		},
		setup(__props, { emit }) {
			const props = __props;
			function replaceAll(str, search, replacement) {
				return str.split(search).join(replacement);
			}
			const element = ref();
			function currentContent() {
				return props.noHtml ? element.value.innerText : element.value.innerHTML;
			}
			function updateContent(newcontent) {
				if (props.noHtml) element.value.innerText = newcontent;
				else element.value.innerHTML = newcontent;
			}
			function update(event) {
				emit("update:modelValue", currentContent());
			}
			function onPaste(event) {
				event.preventDefault();
				let text = (event.originalEvent || event).clipboardData.getData("text/plain");
				if (props.noNl) {
					text = replaceAll(text, "\r\n", " ");
					text = replaceAll(text, "\n", " ");
					text = replaceAll(text, "\r", " ");
				}
				window.document.execCommand("insertText", false, text);
			}
			function onKeypress(event) {
				if (event.key == "Enter" && props.noNl) {
					event.preventDefault();
					emit("returned", currentContent());
				}
			}
			onMounted(() => {
				var _a;
				updateContent((_a = props.modelValue) != null ? _a : "");
			});
			watch(() => props.modelValue, (newval, oldval) => {
				if (newval != currentContent()) updateContent(newval != null ? newval : "");
			});
			watch(() => props.noHtml, (newval, oldval) => {
				var _a;
				updateContent((_a = props.modelValue) != null ? _a : "");
			});
			watch(() => props.tag, (newval, oldval) => {
				var _a;
				updateContent((_a = props.modelValue) != null ? _a : "");
			}, { flush: "post" });
			return (_ctx, _cache) => {
				return openBlock(), createBlock(resolveDynamicComponent(__props.tag), {
					contenteditable: __props.contenteditable,
					onInput: update,
					onBlur: update,
					onPaste,
					onKeypress,
					ref_key: "element",
					ref: element
				}, null, 40, ["contenteditable"]);
			};
		}
	});
	var min = Math.min;
	var max = Math.max;
	var round$1 = Math.round;
	var floor = Math.floor;
	var createCoords = (v) => ({
		x: v,
		y: v
	});
	var oppositeSideMap = {
		left: "right",
		right: "left",
		bottom: "top",
		top: "bottom"
	};
	function clamp$2(start, value, end) {
		return max(start, min(value, end));
	}
	function evaluate(value, param) {
		return typeof value === "function" ? value(param) : value;
	}
	function getSide(placement) {
		return placement.split("-")[0];
	}
	function getAlignment(placement) {
		return placement.split("-")[1];
	}
	function getOppositeAxis(axis) {
		return axis === "x" ? "y" : "x";
	}
	function getAxisLength(axis) {
		return axis === "y" ? "height" : "width";
	}
	function getSideAxis(placement) {
		const firstChar = placement[0];
		return firstChar === "t" || firstChar === "b" ? "y" : "x";
	}
	function getAlignmentAxis(placement) {
		return getOppositeAxis(getSideAxis(placement));
	}
	function getAlignmentSides(placement, rects, rtl) {
		if (rtl === void 0) rtl = false;
		const alignment = getAlignment(placement);
		const alignmentAxis = getAlignmentAxis(placement);
		const length = getAxisLength(alignmentAxis);
		let mainAlignmentSide = alignmentAxis === "x" ? alignment === (rtl ? "end" : "start") ? "right" : "left" : alignment === "start" ? "bottom" : "top";
		if (rects.reference[length] > rects.floating[length]) mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
		return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
	}
	function getExpandedPlacements(placement) {
		const oppositePlacement = getOppositePlacement(placement);
		return [
			getOppositeAlignmentPlacement(placement),
			oppositePlacement,
			getOppositeAlignmentPlacement(oppositePlacement)
		];
	}
	function getOppositeAlignmentPlacement(placement) {
		return placement.includes("start") ? placement.replace("start", "end") : placement.replace("end", "start");
	}
	var lrPlacement = ["left", "right"];
	var rlPlacement = ["right", "left"];
	var tbPlacement = ["top", "bottom"];
	var btPlacement = ["bottom", "top"];
	function getSideList(side, isStart, rtl) {
		switch (side) {
			case "top":
			case "bottom":
				if (rtl) return isStart ? rlPlacement : lrPlacement;
				return isStart ? lrPlacement : rlPlacement;
			case "left":
			case "right": return isStart ? tbPlacement : btPlacement;
			default: return [];
		}
	}
	function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
		const alignment = getAlignment(placement);
		let list = getSideList(getSide(placement), direction === "start", rtl);
		if (alignment) {
			list = list.map((side) => side + "-" + alignment);
			if (flipAlignment) list = list.concat(list.map(getOppositeAlignmentPlacement));
		}
		return list;
	}
	function getOppositePlacement(placement) {
		const side = getSide(placement);
		return oppositeSideMap[side] + placement.slice(side.length);
	}
	function expandPaddingObject(padding) {
		return {
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
			...padding
		};
	}
	function getPaddingObject(padding) {
		return typeof padding !== "number" ? expandPaddingObject(padding) : {
			top: padding,
			right: padding,
			bottom: padding,
			left: padding
		};
	}
	function rectToClientRect(rect) {
		const { x, y, width, height } = rect;
		return {
			width,
			height,
			top: y,
			left: x,
			right: x + width,
			bottom: y + height,
			x,
			y
		};
	}
	function computeCoordsFromPlacement(_ref, placement, rtl) {
		let { reference, floating } = _ref;
		const sideAxis = getSideAxis(placement);
		const alignmentAxis = getAlignmentAxis(placement);
		const alignLength = getAxisLength(alignmentAxis);
		const side = getSide(placement);
		const isVertical = sideAxis === "y";
		const commonX = reference.x + reference.width / 2 - floating.width / 2;
		const commonY = reference.y + reference.height / 2 - floating.height / 2;
		const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
		let coords;
		switch (side) {
			case "top":
				coords = {
					x: commonX,
					y: reference.y - floating.height
				};
				break;
			case "bottom":
				coords = {
					x: commonX,
					y: reference.y + reference.height
				};
				break;
			case "right":
				coords = {
					x: reference.x + reference.width,
					y: commonY
				};
				break;
			case "left":
				coords = {
					x: reference.x - floating.width,
					y: commonY
				};
				break;
			default: coords = {
				x: reference.x,
				y: reference.y
			};
		}
		switch (getAlignment(placement)) {
			case "start":
				coords[alignmentAxis] -= commonAlign * (rtl && isVertical ? -1 : 1);
				break;
			case "end":
				coords[alignmentAxis] += commonAlign * (rtl && isVertical ? -1 : 1);
				break;
		}
		return coords;
	}
	async function detectOverflow(state, options) {
		var _await$platform$isEle;
		if (options === void 0) options = {};
		const { x, y, platform, rects, elements, strategy } = state;
		const { boundary = "clippingAncestors", rootBoundary = "viewport", elementContext = "floating", altBoundary = false, padding = 0 } = evaluate(options, state);
		const paddingObject = getPaddingObject(padding);
		const element = elements[altBoundary ? elementContext === "floating" ? "reference" : "floating" : elementContext];
		const clippingClientRect = rectToClientRect(await platform.getClippingRect({
			element: ((_await$platform$isEle = await (platform.isElement == null ? void 0 : platform.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || await (platform.getDocumentElement == null ? void 0 : platform.getDocumentElement(elements.floating)),
			boundary,
			rootBoundary,
			strategy
		}));
		const rect = elementContext === "floating" ? {
			x,
			y,
			width: rects.floating.width,
			height: rects.floating.height
		} : rects.reference;
		const offsetParent = await (platform.getOffsetParent == null ? void 0 : platform.getOffsetParent(elements.floating));
		const offsetScale = await (platform.isElement == null ? void 0 : platform.isElement(offsetParent)) ? await (platform.getScale == null ? void 0 : platform.getScale(offsetParent)) || {
			x: 1,
			y: 1
		} : {
			x: 1,
			y: 1
		};
		const elementClientRect = rectToClientRect(platform.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform.convertOffsetParentRelativeRectToViewportRelativeRect({
			elements,
			rect,
			offsetParent,
			strategy
		}) : rect);
		return {
			top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
			bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
			left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
			right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
		};
	}
	var MAX_RESET_COUNT = 50;
	var computePosition$1 = async (reference, floating, config) => {
		const { placement = "bottom", strategy = "absolute", middleware = [], platform } = config;
		const platformWithDetectOverflow = platform.detectOverflow ? platform : {
			...platform,
			detectOverflow
		};
		const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(floating));
		let rects = await platform.getElementRects({
			reference,
			floating,
			strategy
		});
		let { x, y } = computeCoordsFromPlacement(rects, placement, rtl);
		let statefulPlacement = placement;
		let resetCount = 0;
		const middlewareData = {};
		for (let i = 0; i < middleware.length; i++) {
			const currentMiddleware = middleware[i];
			if (!currentMiddleware) continue;
			const { name, fn } = currentMiddleware;
			const { x: nextX, y: nextY, data, reset } = await fn({
				x,
				y,
				initialPlacement: placement,
				placement: statefulPlacement,
				strategy,
				middlewareData,
				rects,
				platform: platformWithDetectOverflow,
				elements: {
					reference,
					floating
				}
			});
			x = nextX != null ? nextX : x;
			y = nextY != null ? nextY : y;
			middlewareData[name] = {
				...middlewareData[name],
				...data
			};
			if (reset && resetCount < MAX_RESET_COUNT) {
				resetCount++;
				if (typeof reset === "object") {
					if (reset.placement) statefulPlacement = reset.placement;
					if (reset.rects) rects = reset.rects === true ? await platform.getElementRects({
						reference,
						floating,
						strategy
					}) : reset.rects;
					({x, y} = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
				}
				i = -1;
			}
		}
		return {
			x,
			y,
			placement: statefulPlacement,
			strategy,
			middlewareData
		};
	};
	var flip$1 = function(options) {
		if (options === void 0) options = {};
		return {
			name: "flip",
			options,
			async fn(state) {
				var _middlewareData$arrow, _middlewareData$flip;
				const { placement, middlewareData, rects, initialPlacement, platform, elements } = state;
				const { mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = true, fallbackPlacements: specifiedFallbackPlacements, fallbackStrategy = "bestFit", fallbackAxisSideDirection = "none", flipAlignment = true, ...detectOverflowOptions } = evaluate(options, state);
				if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) return {};
				const side = getSide(placement);
				const initialSideAxis = getSideAxis(initialPlacement);
				const isBasePlacement = getSide(initialPlacement) === initialPlacement;
				const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating));
				const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
				const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== "none";
				if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
				const placements = [initialPlacement, ...fallbackPlacements];
				const overflow = await platform.detectOverflow(state, detectOverflowOptions);
				const overflows = [];
				let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
				if (checkMainAxis) overflows.push(overflow[side]);
				if (checkCrossAxis) {
					const sides = getAlignmentSides(placement, rects, rtl);
					overflows.push(overflow[sides[0]], overflow[sides[1]]);
				}
				overflowsData = [...overflowsData, {
					placement,
					overflows
				}];
				if (!overflows.every((side) => side <= 0)) {
					var _middlewareData$flip2, _overflowsData$filter;
					const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
					const nextPlacement = placements[nextIndex];
					if (nextPlacement) {
						if (!(checkCrossAxis === "alignment" ? initialSideAxis !== getSideAxis(nextPlacement) : false) || overflowsData.every((d) => getSideAxis(d.placement) === initialSideAxis ? d.overflows[0] > 0 : true)) return {
							data: {
								index: nextIndex,
								overflows: overflowsData
							},
							reset: { placement: nextPlacement }
						};
					}
					let resetPlacement = (_overflowsData$filter = overflowsData.filter((d) => d.overflows[0] <= 0).sort((a, b) => a.overflows[1] - b.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;
					if (!resetPlacement) switch (fallbackStrategy) {
						case "bestFit": {
							var _overflowsData$filter2;
							const placement = (_overflowsData$filter2 = overflowsData.filter((d) => {
								if (hasFallbackAxisSideDirection) {
									const currentSideAxis = getSideAxis(d.placement);
									return currentSideAxis === initialSideAxis || currentSideAxis === "y";
								}
								return true;
							}).map((d) => [d.placement, d.overflows.filter((overflow) => overflow > 0).reduce((acc, overflow) => acc + overflow, 0)]).sort((a, b) => a[1] - b[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
							if (placement) resetPlacement = placement;
							break;
						}
						case "initialPlacement":
							resetPlacement = initialPlacement;
							break;
					}
					if (placement !== resetPlacement) return { reset: { placement: resetPlacement } };
				}
				return {};
			}
		};
	};
	var originSides = new Set(["left", "top"]);
	async function convertValueToCoords(state, options) {
		const { placement, platform, elements } = state;
		const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating));
		const side = getSide(placement);
		const alignment = getAlignment(placement);
		const isVertical = getSideAxis(placement) === "y";
		const mainAxisMulti = originSides.has(side) ? -1 : 1;
		const crossAxisMulti = rtl && isVertical ? -1 : 1;
		const rawValue = evaluate(options, state);
		let { mainAxis, crossAxis, alignmentAxis } = typeof rawValue === "number" ? {
			mainAxis: rawValue,
			crossAxis: 0,
			alignmentAxis: null
		} : {
			mainAxis: rawValue.mainAxis || 0,
			crossAxis: rawValue.crossAxis || 0,
			alignmentAxis: rawValue.alignmentAxis
		};
		if (alignment && typeof alignmentAxis === "number") crossAxis = alignment === "end" ? alignmentAxis * -1 : alignmentAxis;
		return isVertical ? {
			x: crossAxis * crossAxisMulti,
			y: mainAxis * mainAxisMulti
		} : {
			x: mainAxis * mainAxisMulti,
			y: crossAxis * crossAxisMulti
		};
	}
	var offset$1 = function(options) {
		if (options === void 0) options = 0;
		return {
			name: "offset",
			options,
			async fn(state) {
				var _middlewareData$offse, _middlewareData$arrow;
				const { x, y, placement, middlewareData } = state;
				const diffCoords = await convertValueToCoords(state, options);
				if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) return {};
				return {
					x: x + diffCoords.x,
					y: y + diffCoords.y,
					data: {
						...diffCoords,
						placement
					}
				};
			}
		};
	};
	var shift$1 = function(options) {
		if (options === void 0) options = {};
		return {
			name: "shift",
			options,
			async fn(state) {
				const { x, y, placement, platform } = state;
				const { mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = false, limiter = { fn: (_ref) => {
					let { x, y } = _ref;
					return {
						x,
						y
					};
				} }, ...detectOverflowOptions } = evaluate(options, state);
				const coords = {
					x,
					y
				};
				const overflow = await platform.detectOverflow(state, detectOverflowOptions);
				const crossAxis = getSideAxis(getSide(placement));
				const mainAxis = getOppositeAxis(crossAxis);
				let mainAxisCoord = coords[mainAxis];
				let crossAxisCoord = coords[crossAxis];
				if (checkMainAxis) {
					const minSide = mainAxis === "y" ? "top" : "left";
					const maxSide = mainAxis === "y" ? "bottom" : "right";
					const min = mainAxisCoord + overflow[minSide];
					const max = mainAxisCoord - overflow[maxSide];
					mainAxisCoord = clamp$2(min, mainAxisCoord, max);
				}
				if (checkCrossAxis) {
					const minSide = crossAxis === "y" ? "top" : "left";
					const maxSide = crossAxis === "y" ? "bottom" : "right";
					const min = crossAxisCoord + overflow[minSide];
					const max = crossAxisCoord - overflow[maxSide];
					crossAxisCoord = clamp$2(min, crossAxisCoord, max);
				}
				const limitedCoords = limiter.fn({
					...state,
					[mainAxis]: mainAxisCoord,
					[crossAxis]: crossAxisCoord
				});
				return {
					...limitedCoords,
					data: {
						x: limitedCoords.x - x,
						y: limitedCoords.y - y,
						enabled: {
							[mainAxis]: checkMainAxis,
							[crossAxis]: checkCrossAxis
						}
					}
				};
			}
		};
	};
	function hasWindow() {
		return typeof window !== "undefined";
	}
	function getNodeName(node) {
		if (isNode(node)) return (node.nodeName || "").toLowerCase();
		return "#document";
	}
	function getWindow(node) {
		var _node$ownerDocument;
		return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
	}
	function getDocumentElement(node) {
		var _ref;
		return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
	}
	function isNode(value) {
		if (!hasWindow()) return false;
		return value instanceof Node || value instanceof getWindow(value).Node;
	}
	function isElement(value) {
		if (!hasWindow()) return false;
		return value instanceof Element || value instanceof getWindow(value).Element;
	}
	function isHTMLElement(value) {
		if (!hasWindow()) return false;
		return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
	}
	function isShadowRoot(value) {
		if (!hasWindow() || typeof ShadowRoot === "undefined") return false;
		return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
	}
	function isOverflowElement(element) {
		const { overflow, overflowX, overflowY, display } = getComputedStyle$1(element);
		return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && display !== "inline" && display !== "contents";
	}
	function isTableElement(element) {
		return /^(table|td|th)$/.test(getNodeName(element));
	}
	function isTopLayer(element) {
		try {
			if (element.matches(":popover-open")) return true;
		} catch (_e) {}
		try {
			return element.matches(":modal");
		} catch (_e) {
			return false;
		}
	}
	var willChangeRe = /transform|translate|scale|rotate|perspective|filter/;
	var containRe = /paint|layout|strict|content/;
	var isNotNone = (value) => !!value && value !== "none";
	var isWebKitValue;
	function isContainingBlock(elementOrCss) {
		const css = isElement(elementOrCss) ? getComputedStyle$1(elementOrCss) : elementOrCss;
		return isNotNone(css.transform) || isNotNone(css.translate) || isNotNone(css.scale) || isNotNone(css.rotate) || isNotNone(css.perspective) || !isWebKit() && (isNotNone(css.backdropFilter) || isNotNone(css.filter)) || willChangeRe.test(css.willChange || "") || containRe.test(css.contain || "");
	}
	function getContainingBlock(element) {
		let currentNode = getParentNode(element);
		while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
			if (isContainingBlock(currentNode)) return currentNode;
			else if (isTopLayer(currentNode)) return null;
			currentNode = getParentNode(currentNode);
		}
		return null;
	}
	function isWebKit() {
		if (isWebKitValue == null) isWebKitValue = typeof CSS !== "undefined" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none");
		return isWebKitValue;
	}
	function isLastTraversableNode(node) {
		return /^(html|body|#document)$/.test(getNodeName(node));
	}
	function getComputedStyle$1(element) {
		return getWindow(element).getComputedStyle(element);
	}
	function getNodeScroll(element) {
		if (isElement(element)) return {
			scrollLeft: element.scrollLeft,
			scrollTop: element.scrollTop
		};
		return {
			scrollLeft: element.scrollX,
			scrollTop: element.scrollY
		};
	}
	function getParentNode(node) {
		if (getNodeName(node) === "html") return node;
		const result = node.assignedSlot || node.parentNode || isShadowRoot(node) && node.host || getDocumentElement(node);
		return isShadowRoot(result) ? result.host : result;
	}
	function getNearestOverflowAncestor(node) {
		const parentNode = getParentNode(node);
		if (isLastTraversableNode(parentNode)) return node.ownerDocument ? node.ownerDocument.body : node.body;
		if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) return parentNode;
		return getNearestOverflowAncestor(parentNode);
	}
	function getOverflowAncestors(node, list, traverseIframes) {
		var _node$ownerDocument2;
		if (list === void 0) list = [];
		if (traverseIframes === void 0) traverseIframes = true;
		const scrollableAncestor = getNearestOverflowAncestor(node);
		const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
		const win = getWindow(scrollableAncestor);
		if (isBody) {
			const frameElement = getFrameElement(win);
			return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
		} else return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
	}
	function getFrameElement(win) {
		return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
	}
	function getCssDimensions(element) {
		const css = getComputedStyle$1(element);
		let width = parseFloat(css.width) || 0;
		let height = parseFloat(css.height) || 0;
		const hasOffset = isHTMLElement(element);
		const offsetWidth = hasOffset ? element.offsetWidth : width;
		const offsetHeight = hasOffset ? element.offsetHeight : height;
		const shouldFallback = round$1(width) !== offsetWidth || round$1(height) !== offsetHeight;
		if (shouldFallback) {
			width = offsetWidth;
			height = offsetHeight;
		}
		return {
			width,
			height,
			$: shouldFallback
		};
	}
	function unwrapElement$1(element) {
		return !isElement(element) ? element.contextElement : element;
	}
	function getScale(element) {
		const domElement = unwrapElement$1(element);
		if (!isHTMLElement(domElement)) return createCoords(1);
		const rect = domElement.getBoundingClientRect();
		const { width, height, $ } = getCssDimensions(domElement);
		let x = ($ ? round$1(rect.width) : rect.width) / width;
		let y = ($ ? round$1(rect.height) : rect.height) / height;
		if (!x || !Number.isFinite(x)) x = 1;
		if (!y || !Number.isFinite(y)) y = 1;
		return {
			x,
			y
		};
	}
	var noOffsets = createCoords(0);
	function getVisualOffsets(element) {
		const win = getWindow(element);
		if (!isWebKit() || !win.visualViewport) return noOffsets;
		return {
			x: win.visualViewport.offsetLeft,
			y: win.visualViewport.offsetTop
		};
	}
	function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
		if (isFixed === void 0) isFixed = false;
		if (!floatingOffsetParent || isFixed && floatingOffsetParent !== getWindow(element)) return false;
		return isFixed;
	}
	function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
		if (includeScale === void 0) includeScale = false;
		if (isFixedStrategy === void 0) isFixedStrategy = false;
		const clientRect = element.getBoundingClientRect();
		const domElement = unwrapElement$1(element);
		let scale = createCoords(1);
		if (includeScale) if (offsetParent) {
			if (isElement(offsetParent)) scale = getScale(offsetParent);
		} else scale = getScale(element);
		const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
		let x = (clientRect.left + visualOffsets.x) / scale.x;
		let y = (clientRect.top + visualOffsets.y) / scale.y;
		let width = clientRect.width / scale.x;
		let height = clientRect.height / scale.y;
		if (domElement) {
			const win = getWindow(domElement);
			const offsetWin = offsetParent && isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
			let currentWin = win;
			let currentIFrame = getFrameElement(currentWin);
			while (currentIFrame && offsetParent && offsetWin !== currentWin) {
				const iframeScale = getScale(currentIFrame);
				const iframeRect = currentIFrame.getBoundingClientRect();
				const css = getComputedStyle$1(currentIFrame);
				const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
				const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
				x *= iframeScale.x;
				y *= iframeScale.y;
				width *= iframeScale.x;
				height *= iframeScale.y;
				x += left;
				y += top;
				currentWin = getWindow(currentIFrame);
				currentIFrame = getFrameElement(currentWin);
			}
		}
		return rectToClientRect({
			width,
			height,
			x,
			y
		});
	}
	function getWindowScrollBarX(element, rect) {
		const leftScroll = getNodeScroll(element).scrollLeft;
		if (!rect) return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
		return rect.left + leftScroll;
	}
	function getHTMLOffset(documentElement, scroll) {
		const htmlRect = documentElement.getBoundingClientRect();
		return {
			x: htmlRect.left + scroll.scrollLeft - getWindowScrollBarX(documentElement, htmlRect),
			y: htmlRect.top + scroll.scrollTop
		};
	}
	function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
		let { elements, rect, offsetParent, strategy } = _ref;
		const isFixed = strategy === "fixed";
		const documentElement = getDocumentElement(offsetParent);
		const topLayer = elements ? isTopLayer(elements.floating) : false;
		if (offsetParent === documentElement || topLayer && isFixed) return rect;
		let scroll = {
			scrollLeft: 0,
			scrollTop: 0
		};
		let scale = createCoords(1);
		const offsets = createCoords(0);
		const isOffsetParentAnElement = isHTMLElement(offsetParent);
		if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
			if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) scroll = getNodeScroll(offsetParent);
			if (isOffsetParentAnElement) {
				const offsetRect = getBoundingClientRect(offsetParent);
				scale = getScale(offsetParent);
				offsets.x = offsetRect.x + offsetParent.clientLeft;
				offsets.y = offsetRect.y + offsetParent.clientTop;
			}
		}
		const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
		return {
			width: rect.width * scale.x,
			height: rect.height * scale.y,
			x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
			y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
		};
	}
	function getClientRects(element) {
		return Array.from(element.getClientRects());
	}
	function getDocumentRect(element) {
		const html = getDocumentElement(element);
		const scroll = getNodeScroll(element);
		const body = element.ownerDocument.body;
		const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
		const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
		let x = -scroll.scrollLeft + getWindowScrollBarX(element);
		const y = -scroll.scrollTop;
		if (getComputedStyle$1(body).direction === "rtl") x += max(html.clientWidth, body.clientWidth) - width;
		return {
			width,
			height,
			x,
			y
		};
	}
	var SCROLLBAR_MAX = 25;
	function getViewportRect(element, strategy) {
		const win = getWindow(element);
		const html = getDocumentElement(element);
		const visualViewport = win.visualViewport;
		let width = html.clientWidth;
		let height = html.clientHeight;
		let x = 0;
		let y = 0;
		if (visualViewport) {
			width = visualViewport.width;
			height = visualViewport.height;
			const visualViewportBased = isWebKit();
			if (!visualViewportBased || visualViewportBased && strategy === "fixed") {
				x = visualViewport.offsetLeft;
				y = visualViewport.offsetTop;
			}
		}
		const windowScrollbarX = getWindowScrollBarX(html);
		if (windowScrollbarX <= 0) {
			const doc = html.ownerDocument;
			const body = doc.body;
			const bodyStyles = getComputedStyle(body);
			const bodyMarginInline = doc.compatMode === "CSS1Compat" ? parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight) || 0 : 0;
			const clippingStableScrollbarWidth = Math.abs(html.clientWidth - body.clientWidth - bodyMarginInline);
			if (clippingStableScrollbarWidth <= SCROLLBAR_MAX) width -= clippingStableScrollbarWidth;
		} else if (windowScrollbarX <= SCROLLBAR_MAX) width += windowScrollbarX;
		return {
			width,
			height,
			x,
			y
		};
	}
	function getInnerBoundingClientRect(element, strategy) {
		const clientRect = getBoundingClientRect(element, true, strategy === "fixed");
		const top = clientRect.top + element.clientTop;
		const left = clientRect.left + element.clientLeft;
		const scale = isHTMLElement(element) ? getScale(element) : createCoords(1);
		return {
			width: element.clientWidth * scale.x,
			height: element.clientHeight * scale.y,
			x: left * scale.x,
			y: top * scale.y
		};
	}
	function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
		let rect;
		if (clippingAncestor === "viewport") rect = getViewportRect(element, strategy);
		else if (clippingAncestor === "document") rect = getDocumentRect(getDocumentElement(element));
		else if (isElement(clippingAncestor)) rect = getInnerBoundingClientRect(clippingAncestor, strategy);
		else {
			const visualOffsets = getVisualOffsets(element);
			rect = {
				x: clippingAncestor.x - visualOffsets.x,
				y: clippingAncestor.y - visualOffsets.y,
				width: clippingAncestor.width,
				height: clippingAncestor.height
			};
		}
		return rectToClientRect(rect);
	}
	function hasFixedPositionAncestor(element, stopNode) {
		const parentNode = getParentNode(element);
		if (parentNode === stopNode || !isElement(parentNode) || isLastTraversableNode(parentNode)) return false;
		return getComputedStyle$1(parentNode).position === "fixed" || hasFixedPositionAncestor(parentNode, stopNode);
	}
	function getClippingElementAncestors(element, cache) {
		const cachedResult = cache.get(element);
		if (cachedResult) return cachedResult;
		let result = getOverflowAncestors(element, [], false).filter((el) => isElement(el) && getNodeName(el) !== "body");
		let currentContainingBlockComputedStyle = null;
		const elementIsFixed = getComputedStyle$1(element).position === "fixed";
		let currentNode = elementIsFixed ? getParentNode(element) : element;
		while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
			const computedStyle = getComputedStyle$1(currentNode);
			const currentNodeIsContaining = isContainingBlock(currentNode);
			if (!currentNodeIsContaining && computedStyle.position === "fixed") currentContainingBlockComputedStyle = null;
			if (elementIsFixed ? !currentNodeIsContaining && !currentContainingBlockComputedStyle : !currentNodeIsContaining && computedStyle.position === "static" && !!currentContainingBlockComputedStyle && (currentContainingBlockComputedStyle.position === "absolute" || currentContainingBlockComputedStyle.position === "fixed") || isOverflowElement(currentNode) && !currentNodeIsContaining && hasFixedPositionAncestor(element, currentNode)) result = result.filter((ancestor) => ancestor !== currentNode);
			else currentContainingBlockComputedStyle = computedStyle;
			currentNode = getParentNode(currentNode);
		}
		cache.set(element, result);
		return result;
	}
	function getClippingRect(_ref) {
		let { element, boundary, rootBoundary, strategy } = _ref;
		const clippingAncestors = [...boundary === "clippingAncestors" ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary), rootBoundary];
		const firstRect = getClientRectFromClippingAncestor(element, clippingAncestors[0], strategy);
		let top = firstRect.top;
		let right = firstRect.right;
		let bottom = firstRect.bottom;
		let left = firstRect.left;
		for (let i = 1; i < clippingAncestors.length; i++) {
			const rect = getClientRectFromClippingAncestor(element, clippingAncestors[i], strategy);
			top = max(rect.top, top);
			right = min(rect.right, right);
			bottom = min(rect.bottom, bottom);
			left = max(rect.left, left);
		}
		return {
			width: right - left,
			height: bottom - top,
			x: left,
			y: top
		};
	}
	function getDimensions(element) {
		const { width, height } = getCssDimensions(element);
		return {
			width,
			height
		};
	}
	function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
		const isOffsetParentAnElement = isHTMLElement(offsetParent);
		const documentElement = getDocumentElement(offsetParent);
		const isFixed = strategy === "fixed";
		const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
		let scroll = {
			scrollLeft: 0,
			scrollTop: 0
		};
		const offsets = createCoords(0);
		function setLeftRTLScrollbarOffset() {
			offsets.x = getWindowScrollBarX(documentElement);
		}
		if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
			if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) scroll = getNodeScroll(offsetParent);
			if (isOffsetParentAnElement) {
				const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
				offsets.x = offsetRect.x + offsetParent.clientLeft;
				offsets.y = offsetRect.y + offsetParent.clientTop;
			} else if (documentElement) setLeftRTLScrollbarOffset();
		}
		if (isFixed && !isOffsetParentAnElement && documentElement) setLeftRTLScrollbarOffset();
		const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
		return {
			x: rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x,
			y: rect.top + scroll.scrollTop - offsets.y - htmlOffset.y,
			width: rect.width,
			height: rect.height
		};
	}
	function isStaticPositioned(element) {
		return getComputedStyle$1(element).position === "static";
	}
	function getTrueOffsetParent(element, polyfill) {
		if (!isHTMLElement(element) || getComputedStyle$1(element).position === "fixed") return null;
		if (polyfill) return polyfill(element);
		let rawOffsetParent = element.offsetParent;
		if (getDocumentElement(element) === rawOffsetParent) rawOffsetParent = rawOffsetParent.ownerDocument.body;
		return rawOffsetParent;
	}
	function getOffsetParent(element, polyfill) {
		const win = getWindow(element);
		if (isTopLayer(element)) return win;
		if (!isHTMLElement(element)) {
			let svgOffsetParent = getParentNode(element);
			while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
				if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) return svgOffsetParent;
				svgOffsetParent = getParentNode(svgOffsetParent);
			}
			return win;
		}
		let offsetParent = getTrueOffsetParent(element, polyfill);
		while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) offsetParent = getTrueOffsetParent(offsetParent, polyfill);
		if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) return win;
		return offsetParent || getContainingBlock(element) || win;
	}
	var getElementRects = async function(data) {
		const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
		const getDimensionsFn = this.getDimensions;
		const floatingDimensions = await getDimensionsFn(data.floating);
		return {
			reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
			floating: {
				x: 0,
				y: 0,
				width: floatingDimensions.width,
				height: floatingDimensions.height
			}
		};
	};
	function isRTL(element) {
		return getComputedStyle$1(element).direction === "rtl";
	}
	var platform = {
		convertOffsetParentRelativeRectToViewportRelativeRect,
		getDocumentElement,
		getClippingRect,
		getOffsetParent,
		getElementRects,
		getClientRects,
		getDimensions,
		getScale,
		isElement,
		isRTL
	};
	function rectsAreEqual(a, b) {
		return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
	}
	function observeMove(element, onMove) {
		let io = null;
		let timeoutId;
		const root = getDocumentElement(element);
		function cleanup() {
			var _io;
			clearTimeout(timeoutId);
			(_io = io) == null || _io.disconnect();
			io = null;
		}
		function refresh(skip, threshold) {
			if (skip === void 0) skip = false;
			if (threshold === void 0) threshold = 1;
			cleanup();
			const elementRectForRootMargin = element.getBoundingClientRect();
			const { left, top, width, height } = elementRectForRootMargin;
			if (!skip) onMove();
			if (!width || !height) return;
			const insetTop = floor(top);
			const insetRight = floor(root.clientWidth - (left + width));
			const insetBottom = floor(root.clientHeight - (top + height));
			const insetLeft = floor(left);
			const options = {
				rootMargin: -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px",
				threshold: max(0, min(1, threshold)) || 1
			};
			let isFirstUpdate = true;
			function handleObserve(entries) {
				const ratio = entries[0].intersectionRatio;
				if (ratio !== threshold) {
					if (!isFirstUpdate) return refresh();
					if (!ratio) timeoutId = setTimeout(() => {
						refresh(false, 1e-7);
					}, 1e3);
					else refresh(false, ratio);
				}
				if (ratio === 1 && !rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) refresh();
				isFirstUpdate = false;
			}
			try {
				io = new IntersectionObserver(handleObserve, {
					...options,
					root: root.ownerDocument
				});
			} catch (_e) {
				io = new IntersectionObserver(handleObserve, options);
			}
			io.observe(element);
		}
		refresh(true);
		return cleanup;
	}
	function autoUpdate(reference, floating, update, options) {
		if (options === void 0) options = {};
		const { ancestorScroll = true, ancestorResize = true, elementResize = typeof ResizeObserver === "function", layoutShift = typeof IntersectionObserver === "function", animationFrame = false } = options;
		const referenceEl = unwrapElement$1(reference);
		const ancestors = ancestorScroll || ancestorResize ? [...referenceEl ? getOverflowAncestors(referenceEl) : [], ...floating ? getOverflowAncestors(floating) : []] : [];
		ancestors.forEach((ancestor) => {
			ancestorScroll && ancestor.addEventListener("scroll", update, { passive: true });
			ancestorResize && ancestor.addEventListener("resize", update);
		});
		const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update) : null;
		let reobserveFrame = -1;
		let resizeObserver = null;
		if (elementResize) {
			resizeObserver = new ResizeObserver((_ref) => {
				let [firstEntry] = _ref;
				if (firstEntry && firstEntry.target === referenceEl && resizeObserver && floating) {
					resizeObserver.unobserve(floating);
					cancelAnimationFrame(reobserveFrame);
					reobserveFrame = requestAnimationFrame(() => {
						var _resizeObserver;
						(_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
					});
				}
				update();
			});
			if (referenceEl && !animationFrame) resizeObserver.observe(referenceEl);
			if (floating) resizeObserver.observe(floating);
		}
		let frameId;
		let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
		if (animationFrame) frameLoop();
		function frameLoop() {
			const nextRefRect = getBoundingClientRect(reference);
			if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) update();
			prevRefRect = nextRefRect;
			frameId = requestAnimationFrame(frameLoop);
		}
		update();
		return () => {
			var _resizeObserver2;
			ancestors.forEach((ancestor) => {
				ancestorScroll && ancestor.removeEventListener("scroll", update);
				ancestorResize && ancestor.removeEventListener("resize", update);
			});
			cleanupIo?.();
			(_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
			resizeObserver = null;
			if (animationFrame) cancelAnimationFrame(frameId);
		};
	}
	var offset = offset$1;
	var shift = shift$1;
	var flip = flip$1;
	var computePosition = (reference, floating, options) => {
		const cache = new Map();
		const mergedOptions = {
			platform,
			...options
		};
		const platformWithCache = {
			...mergedOptions.platform,
			_c: cache
		};
		return computePosition$1(reference, floating, {
			...mergedOptions,
			platform: platformWithCache
		});
	};
	function isComponentPublicInstance(target) {
		return target != null && typeof target === "object" && "$el" in target;
	}
	function unwrapElement(target) {
		if (isComponentPublicInstance(target)) {
			const element = target.$el;
			return isNode(element) && getNodeName(element) === "#comment" ? null : element;
		}
		return target;
	}
	function toValue(source) {
		return typeof source === "function" ? source() : unref(source);
	}
	function getDPR(element) {
		if (typeof window === "undefined") return 1;
		return (element.ownerDocument.defaultView || window).devicePixelRatio || 1;
	}
	function roundByDPR(element, value) {
		const dpr = getDPR(element);
		return Math.round(value * dpr) / dpr;
	}
	function useFloating(reference, floating, options) {
		if (options === void 0) options = {};
		const whileElementsMountedOption = options.whileElementsMounted;
		const openOption = computed(() => {
			var _toValue;
			return (_toValue = toValue(options.open)) != null ? _toValue : true;
		});
		const middlewareOption = computed(() => toValue(options.middleware));
		const placementOption = computed(() => {
			var _toValue2;
			return (_toValue2 = toValue(options.placement)) != null ? _toValue2 : "bottom";
		});
		const strategyOption = computed(() => {
			var _toValue3;
			return (_toValue3 = toValue(options.strategy)) != null ? _toValue3 : "absolute";
		});
		const transformOption = computed(() => {
			var _toValue4;
			return (_toValue4 = toValue(options.transform)) != null ? _toValue4 : true;
		});
		const referenceElement = computed(() => unwrapElement(reference.value));
		const floatingElement = computed(() => unwrapElement(floating.value));
		const x = ref(0);
		const y = ref(0);
		const strategy = ref(strategyOption.value);
		const placement = ref(placementOption.value);
		const middlewareData = shallowRef({});
		const isPositioned = ref(false);
		const floatingStyles = computed(() => {
			const initialStyles = {
				position: strategy.value,
				left: "0",
				top: "0"
			};
			if (!floatingElement.value) return initialStyles;
			const xVal = roundByDPR(floatingElement.value, x.value);
			const yVal = roundByDPR(floatingElement.value, y.value);
			if (transformOption.value) return {
				...initialStyles,
				transform: "translate(" + xVal + "px, " + yVal + "px)",
				...getDPR(floatingElement.value) >= 1.5 && { willChange: "transform" }
			};
			return {
				position: strategy.value,
				left: xVal + "px",
				top: yVal + "px"
			};
		});
		let whileElementsMountedCleanup;
		function update() {
			if (referenceElement.value == null || floatingElement.value == null) return;
			const open = openOption.value;
			computePosition(referenceElement.value, floatingElement.value, {
				middleware: middlewareOption.value,
				placement: placementOption.value,
				strategy: strategyOption.value
			}).then((position) => {
				x.value = position.x;
				y.value = position.y;
				strategy.value = position.strategy;
				placement.value = position.placement;
				middlewareData.value = position.middlewareData;
				isPositioned.value = open !== false;
			});
		}
		function cleanup() {
			if (typeof whileElementsMountedCleanup === "function") {
				whileElementsMountedCleanup();
				whileElementsMountedCleanup = void 0;
			}
		}
		function attach() {
			cleanup();
			if (whileElementsMountedOption === void 0) {
				update();
				return;
			}
			if (referenceElement.value != null && floatingElement.value != null) {
				whileElementsMountedCleanup = whileElementsMountedOption(referenceElement.value, floatingElement.value, update);
				return;
			}
		}
		function reset() {
			if (!openOption.value) isPositioned.value = false;
		}
		watch([
			middlewareOption,
			placementOption,
			strategyOption,
			openOption
		], update, { flush: "sync" });
		watch([referenceElement, floatingElement], attach, { flush: "sync" });
		watch(openOption, reset, { flush: "sync" });
		if (getCurrentScope()) onScopeDispose(cleanup);
		return {
			x: shallowReadonly(x),
			y: shallowReadonly(y),
			strategy: shallowReadonly(strategy),
			placement: shallowReadonly(placement),
			middlewareData: shallowReadonly(middlewareData),
			isPositioned: shallowReadonly(isPositioned),
			floatingStyles,
			update
		};
	}
	var clamp$1 = (number, min = 0, max = 1) => {
		return number > max ? max : number < min ? min : number;
	};
	var round = (number, digits = 0, base = Math.pow(10, digits)) => {
		return Math.round(base * number) / base;
	};
	360 / (Math.PI * 2);
	var hexToHsva = (hex) => rgbaToHsva(hexToRgba(hex));
	var hexToRgba = (hex) => {
		if (hex[0] === "#") hex = hex.substring(1);
		if (hex.length < 6) return {
			r: parseInt(hex[0] + hex[0], 16),
			g: parseInt(hex[1] + hex[1], 16),
			b: parseInt(hex[2] + hex[2], 16),
			a: hex.length === 4 ? round(parseInt(hex[3] + hex[3], 16) / 255, 2) : 1
		};
		return {
			r: parseInt(hex.substring(0, 2), 16),
			g: parseInt(hex.substring(2, 4), 16),
			b: parseInt(hex.substring(4, 6), 16),
			a: hex.length === 8 ? round(parseInt(hex.substring(6, 8), 16) / 255, 2) : 1
		};
	};
	var hsvaToHex = (hsva) => rgbaToHex(hsvaToRgba(hsva));
	var hsvaToHsla = ({ h, s, v, a }) => {
		const hh = (200 - s) * v / 100;
		return {
			h: round(h),
			s: round(hh > 0 && hh < 200 ? s * v / 100 / (hh <= 100 ? hh : 200 - hh) * 100 : 0),
			l: round(hh / 2),
			a: round(a, 2)
		};
	};
	var hsvaToHslString = (hsva) => {
		const { h, s, l } = hsvaToHsla(hsva);
		return `hsl(${h}, ${s}%, ${l}%)`;
	};
	var hsvaToHslaString = (hsva) => {
		const { h, s, l, a } = hsvaToHsla(hsva);
		return `hsla(${h}, ${s}%, ${l}%, ${a})`;
	};
	var hsvaToRgba = ({ h, s, v, a }) => {
		h = h / 360 * 6;
		s = s / 100;
		v = v / 100;
		const hh = Math.floor(h), b = v * (1 - s), c = v * (1 - (h - hh) * s), d = v * (1 - (1 - h + hh) * s), module = hh % 6;
		return {
			r: round([
				v,
				c,
				b,
				b,
				d,
				v
			][module] * 255),
			g: round([
				d,
				v,
				v,
				c,
				b,
				b
			][module] * 255),
			b: round([
				b,
				b,
				d,
				v,
				v,
				c
			][module] * 255),
			a: round(a, 2)
		};
	};
	var format = (number) => {
		const hex = number.toString(16);
		return hex.length < 2 ? "0" + hex : hex;
	};
	var rgbaToHex = ({ r, g, b, a }) => {
		const alphaHex = a < 1 ? format(round(a * 255)) : "";
		return "#" + format(r) + format(g) + format(b) + alphaHex;
	};
	var rgbaToHsva = ({ r, g, b, a }) => {
		const max = Math.max(r, g, b);
		const delta = max - Math.min(r, g, b);
		const hh = delta ? max === r ? (g - b) / delta : max === g ? 2 + (b - r) / delta : 4 + (r - g) / delta : 0;
		return {
			h: round(60 * (hh < 0 ? hh + 6 : hh)),
			s: round(max ? delta / max * 100 : 0),
			v: round(max / 255 * 100),
			a
		};
	};
	var equalColorObjects = (first, second) => {
		if (first === second) return true;
		for (const prop in first) if (first[prop] !== second[prop]) return false;
		return true;
	};
	var equalHex = (first, second) => {
		if (first.toLowerCase() === second.toLowerCase()) return true;
		return equalColorObjects(hexToRgba(first), hexToRgba(second));
	};
	var cache = {};
	var tpl = (html) => {
		let template = cache[html];
		if (!template) {
			template = document.createElement("template");
			template.innerHTML = html;
			cache[html] = template;
		}
		return template;
	};
	var fire = (target, type, detail) => {
		target.dispatchEvent(new CustomEvent(type, {
			bubbles: true,
			detail
		}));
	};
	var hasTouched = false;
	var isTouch = (e) => "touches" in e;
	var isValid = (event) => {
		if (hasTouched && !isTouch(event)) return false;
		if (!hasTouched) hasTouched = isTouch(event);
		return true;
	};
	var pointerMove = (target, event) => {
		const pointer = isTouch(event) ? event.touches[0] : event;
		const rect = target.el.getBoundingClientRect();
		fire(target.el, "move", target.getMove({
			x: clamp$1((pointer.pageX - (rect.left + window.pageXOffset)) / rect.width),
			y: clamp$1((pointer.pageY - (rect.top + window.pageYOffset)) / rect.height)
		}));
	};
	var keyMove = (target, event) => {
		const keyCode = event.keyCode;
		if (keyCode > 40 || target.xy && keyCode < 37 || keyCode < 33) return;
		event.preventDefault();
		fire(target.el, "move", target.getMove({
			x: keyCode === 39 ? .01 : keyCode === 37 ? -.01 : keyCode === 34 ? .05 : keyCode === 33 ? -.05 : keyCode === 35 ? 1 : keyCode === 36 ? -1 : 0,
			y: keyCode === 40 ? .01 : keyCode === 38 ? -.01 : 0
		}, true));
	};
	var Slider = class {
		constructor(root, part, aria, xy) {
			const template = tpl(`<div role="slider" tabindex="0" part="${part}" ${aria}><div part="${part}-pointer"></div></div>`);
			root.appendChild(template.content.cloneNode(true));
			const el = root.querySelector(`[part=${part}]`);
			el.addEventListener("mousedown", this);
			el.addEventListener("touchstart", this);
			el.addEventListener("keydown", this);
			this.el = el;
			this.xy = xy;
			this.nodes = [el.firstChild, el];
		}
		set dragging(state) {
			const toggleEvent = state ? document.addEventListener : document.removeEventListener;
			toggleEvent(hasTouched ? "touchmove" : "mousemove", this);
			toggleEvent(hasTouched ? "touchend" : "mouseup", this);
		}
		handleEvent(event) {
			switch (event.type) {
				case "mousedown":
				case "touchstart":
					event.preventDefault();
					if (!isValid(event) || !hasTouched && event.button != 0) return;
					this.el.focus();
					pointerMove(this, event);
					this.dragging = true;
					break;
				case "mousemove":
				case "touchmove":
					event.preventDefault();
					pointerMove(this, event);
					break;
				case "mouseup":
				case "touchend":
					this.dragging = false;
					break;
				case "keydown":
					keyMove(this, event);
					break;
			}
		}
		style(styles) {
			styles.forEach((style, i) => {
				for (const p in style) this.nodes[i].style.setProperty(p, style[p]);
			});
		}
	};
	var Hue = class extends Slider {
		constructor(root) {
			super(root, "hue", "aria-label=\"Hue\" aria-valuemin=\"0\" aria-valuemax=\"360\"", false);
		}
		update({ h }) {
			this.h = h;
			this.style([{
				left: `${h / 360 * 100}%`,
				color: hsvaToHslString({
					h,
					s: 100,
					v: 100,
					a: 1
				})
			}]);
			this.el.setAttribute("aria-valuenow", `${round(h)}`);
		}
		getMove(offset, key) {
			return { h: key ? clamp$1(this.h + offset.x * 360, 0, 360) : 360 * offset.x };
		}
	};
	var Saturation = class extends Slider {
		constructor(root) {
			super(root, "saturation", "aria-label=\"Color\"", true);
		}
		update(hsva) {
			this.hsva = hsva;
			this.style([{
				top: `${100 - hsva.v}%`,
				left: `${hsva.s}%`,
				color: hsvaToHslString(hsva)
			}, { "background-color": hsvaToHslString({
				h: hsva.h,
				s: 100,
				v: 100,
				a: 1
			}) }]);
			this.el.setAttribute("aria-valuetext", `Saturation ${round(hsva.s)}%, Brightness ${round(hsva.v)}%`);
		}
		getMove(offset, key) {
			return {
				s: key ? clamp$1(this.hsva.s + offset.x * 100, 0, 100) : offset.x * 100,
				v: key ? clamp$1(this.hsva.v - offset.y * 100, 0, 100) : Math.round(100 - offset.y * 100)
			};
		}
	};
	var color_picker_default = `:host{display:flex;flex-direction:column;position:relative;width:200px;height:200px;user-select:none;-webkit-user-select:none;cursor:default}:host([hidden]){display:none!important}[role=slider]{position:relative;touch-action:none;user-select:none;-webkit-user-select:none;outline:0}[role=slider]:last-child{border-radius:0 0 8px 8px}[part$=pointer]{position:absolute;z-index:1;box-sizing:border-box;width:28px;height:28px;display:flex;place-content:center center;transform:translate(-50%,-50%);background-color:#fff;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.2)}[part$=pointer]::after{content:"";width:100%;height:100%;border-radius:inherit;background-color:currentColor}[role=slider]:focus [part$=pointer]{transform:translate(-50%,-50%) scale(1.1)}`;
	var hue_default = `[part=hue]{flex:0 0 24px;background:linear-gradient(to right,red 0,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,red 100%)}[part=hue-pointer]{top:50%;z-index:2}`;
	var saturation_default = `[part=saturation]{flex-grow:1;border-color:transparent;border-bottom:12px solid #000;border-radius:8px 8px 0 0;background-image:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,rgba(255,255,255,0));box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}[part=saturation-pointer]{z-index:3}`;
	var $isSame = Symbol("same");
	var $color = Symbol("color");
	var $hsva = Symbol("hsva");
	var $update = Symbol("update");
	var $parts = Symbol("parts");
	var $css = Symbol("css");
	var $sliders = Symbol("sliders");
	var ColorPicker = class extends HTMLElement {
		static get observedAttributes() {
			return ["color"];
		}
		get [$css]() {
			return [
				color_picker_default,
				hue_default,
				saturation_default
			];
		}
		get [$sliders]() {
			return [Saturation, Hue];
		}
		get color() {
			return this[$color];
		}
		set color(newColor) {
			if (!this[$isSame](newColor)) {
				const newHsva = this.colorModel.toHsva(newColor);
				this[$update](newHsva);
				this[$color] = newColor;
			}
		}
		constructor() {
			super();
			const template = tpl(`<style>${this[$css].join("")}</style>`);
			const root = this.attachShadow({ mode: "open" });
			root.appendChild(template.content.cloneNode(true));
			root.addEventListener("move", this);
			this[$parts] = this[$sliders].map((slider) => new slider(root));
		}
		connectedCallback() {
			if (this.hasOwnProperty("color")) {
				const value = this.color;
				delete this["color"];
				this.color = value;
			} else if (!this.color) this.color = this.colorModel.defaultColor;
		}
		attributeChangedCallback(_attr, _oldVal, newVal) {
			const color = this.colorModel.fromAttr(newVal);
			if (!this[$isSame](color)) this.color = color;
		}
		handleEvent(event) {
			const oldHsva = this[$hsva];
			const newHsva = {
				...oldHsva,
				...event.detail
			};
			this[$update](newHsva);
			let newColor;
			if (!equalColorObjects(newHsva, oldHsva) && !this[$isSame](newColor = this.colorModel.fromHsva(newHsva))) {
				this[$color] = newColor;
				fire(this, "color-changed", { value: newColor });
			}
		}
		[$isSame](color) {
			return this.color && this.colorModel.equal(color, this.color);
		}
		[$update](hsva) {
			this[$hsva] = hsva;
			this[$parts].forEach((part) => part.update(hsva));
		}
	};
	var Alpha = class extends Slider {
		constructor(root) {
			super(root, "alpha", "aria-label=\"Alpha\" aria-valuemin=\"0\" aria-valuemax=\"1\"", false);
		}
		update(hsva) {
			this.hsva = hsva;
			const colorFrom = hsvaToHslaString({
				...hsva,
				a: 0
			});
			const colorTo = hsvaToHslaString({
				...hsva,
				a: 1
			});
			const value = hsva.a * 100;
			this.style([{
				left: `${value}%`,
				color: hsvaToHslaString(hsva)
			}, { "--gradient": `linear-gradient(90deg, ${colorFrom}, ${colorTo}` }]);
			const v = round(value);
			this.el.setAttribute("aria-valuenow", `${v}`);
			this.el.setAttribute("aria-valuetext", `${v}%`);
		}
		getMove(offset, key) {
			return { a: key ? clamp$1(this.hsva.a + offset.x) : offset.x };
		}
	};
	var alpha_default = `[part=alpha]{flex:0 0 24px}[part=alpha]::after{display:block;content:"";position:absolute;top:0;left:0;right:0;bottom:0;border-radius:inherit;background-image:var(--gradient);box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}[part^=alpha]{background-color:#fff;background-image:url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"><rect x="8" width="8" height="8"/><rect y="8" width="8" height="8"/></svg>')}[part=alpha-pointer]{top:50%}`;
	var AlphaColorPicker = class extends ColorPicker {
		get [$css]() {
			return [...super[$css], alpha_default];
		}
		get [$sliders]() {
			return [...super[$sliders], Alpha];
		}
	};
	var colorModel = {
		defaultColor: "#0001",
		toHsva: hexToHsva,
		fromHsva: hsvaToHex,
		equal: equalHex,
		fromAttr: (color) => color
	};
	var HexAlphaBase = class extends AlphaColorPicker {
		get colorModel() {
			return colorModel;
		}
	};
	var HexAlphaColorPicker = class extends HexAlphaBase {};
	customElements.define("hex-alpha-color-picker", HexAlphaColorPicker);
	var MESSAGES = {
		"zh-TW": {
			"common.itemColor": "按鈕顏色",
			"tagbar.search": "搜尋",
			"tagbar.searchNewTab": "新分頁搜尋",
			"tagbar.clearSearch": "清空搜尋框",
			"tagbar.none": "無",
			"tagbar.infoTooltip": "左鍵雙擊：{left}｜右鍵雙擊：{right}",
			"tagbar.newProfile": "點擊命名新標籤組",
			"tagbar.handleTitle": "拖曳排序行",
			"tagbar.deleteLine": "刪除此行",
			"tagbar.deleteLineConfirm": "確定刪除這行嗎？此操作無法復原。",
			"tagbar.lineColor": "行顏色",
			"tagbar.lineColorClear": "清除顏色",
			"tagbar.separatorSettings": "分隔線設定",
			"tagbar.separatorLabelPlaceholder": "輸入文字",
			"tagbar.separatorStyle": "線條",
			"tagbar.separatorStyle_solid": "實線",
			"tagbar.separatorStyle_dashed": "虛線",
			"tagbar.separatorStyle_none": "無線",
			"tagbar.separatorLinePosition": "線位置",
			"tagbar.separatorLinePosition_top": "上方",
			"tagbar.separatorLinePosition_middle": "中央",
			"tagbar.separatorLinePosition_bottom": "下方",
			"tagbar.separatorTextSize": "文字大小",
			"tagbar.separatorLineThickness": "線條粗細",
			"tagbar.separatorLineLength": "線長",
			"tagbar.separatorTextAlign": "文字對齊",
			"tagbar.separatorTextAlign_left": "靠左",
			"tagbar.separatorTextAlign_center": "置中",
			"tagbar.separatorTextAlign_right": "靠右",
			"tagbar.addButtonLine": "新增行",
			"tagbar.addSeparatorLine": "新增分隔線",
			"tagbar.addTag": "新增標籤",
			"tagbar.addUrl": "新增網址",
			"tagbar.done": "完成",
			"tagbar.edit": "編輯",
			"tagbar.settings": "設定",
			"settings.title": "設定",
			"settings.close": "關閉",
			"settings.tabSearch": "搜尋",
			"settings.tabAppearance": "外觀",
			"settings.tabData": "資料",
			"settings.tabAbout": "關於",
			"settings.useNhWeight": "使用 nhentai 人氣權重排序",
			"settings.useNhWeightHint": "開啟後，搜尋建議會優先顯示 nhentai 上傳量高的標籤（top 500），其餘按預設公式排序。",
			"settings.dblClickActions": "背景雙擊動作",
			"settings.dblClickLeft": "左鍵雙擊",
			"settings.dblClickRight": "右鍵雙擊",
			"settings.actionSearchCurrent": "搜尋（當前頁面）",
			"settings.actionSearchNewTab": "搜尋（新分頁）",
			"settings.actionClear": "清空搜尋框",
			"settings.actionNone": "無",
			"settings.newTabActivate": "新分頁搜尋時切換到該分頁",
			"settings.nsOrder": "Namespace 搜尋順序",
			"settings.nsOrderHint": "調整搜尋建議中 namespace 的內部排序權重。拖曳調整順序，取消勾選可隱藏該類別。\n注意：此順序僅影響 namespace 之間的排列，匹配品質和 nhentai 人氣仍然優先。",
			"settings.reset": "重置",
			"settings.resetTitle": "重置為預設",
			"settings.nsFormat": "Namespace 格式",
			"settings.nsFormatLong": "完整（female）",
			"settings.nsFormatShort": "縮寫（f）",
			"settings.defaultExactMatch": "預設精確搜尋 ($)",
			"settings.defaultExactMatchHint": "開啟後，從建構器儲存的標籤會自動加上 $ 後綴。",
			"settings.tagDbMirror": "標籤資料庫鏡像",
			"settings.tagDbTtlDays": "標籤資料庫快取（天）",
			"settings.tagDbRefresh": "立即更新",
			"settings.tagDbRefreshing": "更新中…",
			"settings.fontFamily": "自定義字體",
			"settings.fontFamilyPlaceholder": "留空則使用頁面字體",
			"settings.fontFamilyHint": "font-family 值範例：",
			"settings.fontWeight": "字重",
			"settings.preview": "預覽",
			"settings.language": "語言 / Language",
			"settings.tagStyle": "按鈕樣式",
			"settings.tagStyleFlat": "預設",
			"settings.tagStyle3dBorder": "下方陰影",
			"settings.tagStyleOffsetShadow": "右下陰影",
			"settings.tagStylePushable": "立體按壓",
			"settings.profilesTitle": "標籤組",
			"settings.activeBadge": "目前",
			"settings.moveToTrash": "移入垃圾桶",
			"settings.trash": "回收桶",
			"settings.editorCopied": "已複製",
			"settings.editorCopy": "複製",
			"settings.editorExport": "匯出檔案",
			"settings.editorJsonError": "JSON 格式錯誤：{message}",
			"settings.editorInvalidShape": "資料格式與當前版本不相容",
			"settings.restoreProfile": "恢復標籤組",
			"settings.purgeProfile": "永久刪除",
			"settings.save": "儲存",
			"settings.purgeConfirm": "確定要永久刪除「{name}」嗎？此操作無法復原。",
			"settings.corrupted": "損壞的資料",
			"settings.corruptedReason": "原因：{reason}",
			"settings.emptyTag": "(空)",
			"tagConfig.displayName": "顯示名稱",
			"tagConfig.displayNameHint": "（留空則顯示 tag 原文）",
			"tagConfig.tagSyntax": "標籤語法",
			"tagConfig.searchPlaceholder": "輸入中文或英文搜尋…",
			"tagConfig.loadingPlaceholder": "載入中…",
			"tagConfig.removeRow": "移除",
			"tagConfig.noResult": "找不到符合的標籤",
			"tagConfig.rightClickMode": "右鍵模式",
			"tagConfig.prefix": "前綴",
			"tagConfig.colonPrefixNone": "（無）",
			"tagConfig.colonPrefixNsGroup": "Namespace",
			"tagConfig.colonPrefixQGroup": "限定詞",
			"tagConfig.nsLong": "長",
			"tagConfig.nsShort": "短",
			"tagConfig.exactMatch": "精確搜尋 ($)",
			"tagConfig.wildcard": "萬用字元 (*)",
			"tagConfig.rawSyntax": "原始語法",
			"tagConfig.explainPrefix": "前綴",
			"tagConfig.explainNs": "namespace",
			"tagConfig.explainQualifier": "限定詞",
			"tagConfig.explainTag": "標籤",
			"tagConfig.explainSuffix": "後綴",
			"tagConfig.explainError": "解析錯誤",
			"tagConfig.delete": "刪除",
			"tagConfig.cancel": "取消",
			"tagConfig.save": "儲存",
			"urlConfig.displayName": "顯示名稱",
			"urlConfig.displayNameHint": "（留空則顯示網址）",
			"urlConfig.url": "網址",
			"urlConfig.fullUrl": "完整網址",
			"urlConfig.fetching": "取得中…",
			"urlConfig.fetchTitle": "取得標題",
			"urlConfig.delete": "刪除",
			"urlConfig.cancel": "取消",
			"urlConfig.save": "儲存",
			"ns.female": "女",
			"ns.male": "男",
			"ns.mixed": "混",
			"ns.other": "其他",
			"ns.location": "地點",
			"ns.language": "語言",
			"ns.parody": "原作",
			"ns.character": "角色",
			"ns.artist": "繪師",
			"ns.cosplayer": "Coser",
			"ns.group": "團體",
			"ns.reclass": "分類",
			"ns.temp": "臨時",
			"about.desc": "E-Hentai / ExHentai 搜尋快捷標籤列",
			"about.reportIssue": "回報問題",
			"about.inspiration": "靈感來源",
			"about.techRef": "技術棧參考",
			"about.credits": "致謝",
			"about.ehttDetail": "標籤中文翻譯資料庫（CC BY-NC-SA 3.0）",
			"about.ehsyringeDetail": "搜尋排序權重邏輯參考（MIT）",
			"about.openccDetail": "繁簡轉換字表資料（Apache-2.0）",
			"default.chinese": "中文",
			"default.english": "英語",
			"default.korean": "韓語",
			"default.japanese": "日語",
			"default.fullColor": "全彩",
			"default.uncensored": "無修正",
			"default.translated": "已翻譯",
			"default.speechless": "無對話",
			"default.excludeAI": "排除AI",
			"default.excludeRoughTL": "排除機翻",
			"default.howto": "教學",
			"default.artbook": "畫集",
			"default.imageset": "圖集",
			"default.tankoubon": "單行本",
			"default.anthology": "選集",
			"default.profileName": "預設標籤組",
			"default.general": "一般"
		},
		"zh-CN": {
			"common.itemColor": "按钮颜色",
			"tagbar.search": "搜索",
			"tagbar.searchNewTab": "新标签页搜索",
			"tagbar.clearSearch": "清空搜索框",
			"tagbar.none": "无",
			"tagbar.infoTooltip": "左键双击：{left}｜右键双击：{right}",
			"tagbar.newProfile": "点击命名新标签组",
			"tagbar.handleTitle": "拖拽排序行",
			"tagbar.deleteLine": "删除此行",
			"tagbar.deleteLineConfirm": "确定删除这行吗？此操作无法撤销。",
			"tagbar.lineColor": "行颜色",
			"tagbar.lineColorClear": "清除颜色",
			"tagbar.separatorSettings": "分隔线设置",
			"tagbar.separatorLabelPlaceholder": "输入文字",
			"tagbar.separatorStyle": "线条",
			"tagbar.separatorStyle_solid": "实线",
			"tagbar.separatorStyle_dashed": "虚线",
			"tagbar.separatorStyle_none": "无线",
			"tagbar.separatorLinePosition": "线位置",
			"tagbar.separatorLinePosition_top": "上方",
			"tagbar.separatorLinePosition_middle": "中央",
			"tagbar.separatorLinePosition_bottom": "下方",
			"tagbar.separatorTextSize": "文字大小",
			"tagbar.separatorLineThickness": "线条粗细",
			"tagbar.separatorLineLength": "线长",
			"tagbar.separatorTextAlign": "文字对齐",
			"tagbar.separatorTextAlign_left": "靠左",
			"tagbar.separatorTextAlign_center": "居中",
			"tagbar.separatorTextAlign_right": "靠右",
			"tagbar.addButtonLine": "新增行",
			"tagbar.addSeparatorLine": "新增分隔线",
			"tagbar.addTag": "新增标签",
			"tagbar.addUrl": "新增网址",
			"tagbar.done": "完成",
			"tagbar.edit": "编辑",
			"tagbar.settings": "设置",
			"settings.title": "设置",
			"settings.close": "关闭",
			"settings.tabSearch": "搜索",
			"settings.tabAppearance": "外观",
			"settings.tabData": "数据",
			"settings.tabAbout": "关于",
			"settings.useNhWeight": "使用 nhentai 人气权重排序",
			"settings.useNhWeightHint": "开启后，搜索建议会优先显示 nhentai 上传量高的标签（top 500），其余按默认公式排序。",
			"settings.dblClickActions": "背景双击动作",
			"settings.dblClickLeft": "左键双击",
			"settings.dblClickRight": "右键双击",
			"settings.actionSearchCurrent": "搜索（当前页面）",
			"settings.actionSearchNewTab": "搜索（新标签页）",
			"settings.actionClear": "清空搜索框",
			"settings.actionNone": "无",
			"settings.newTabActivate": "新标签页搜索时切换到该标签页",
			"settings.nsOrder": "Namespace 搜索顺序",
			"settings.nsOrderHint": "调整搜索建议中 namespace 的内部排序权重。拖拽调整顺序，取消勾选可隐藏该类别。\n注意：此顺序仅影响 namespace 之间的排列，匹配质量和 nhentai 人气仍然优先。",
			"settings.reset": "重置",
			"settings.resetTitle": "重置为默认",
			"settings.nsFormat": "Namespace 格式",
			"settings.nsFormatLong": "完整（female）",
			"settings.nsFormatShort": "缩写（f）",
			"settings.defaultExactMatch": "默认精确搜索 ($)",
			"settings.defaultExactMatchHint": "开启后，从构建器保存的标签会自动加上 $ 后缀。",
			"settings.tagDbMirror": "标签数据库镜像",
			"settings.tagDbTtlDays": "标签数据库缓存（天）",
			"settings.tagDbRefresh": "立即更新",
			"settings.tagDbRefreshing": "更新中…",
			"settings.fontFamily": "自定义字体",
			"settings.fontFamilyPlaceholder": "留空则使用页面字体",
			"settings.fontFamilyHint": "font-family 值示例：",
			"settings.fontWeight": "字重",
			"settings.preview": "预览",
			"settings.language": "语言 / Language",
			"settings.tagStyle": "按钮样式",
			"settings.tagStyleFlat": "默认",
			"settings.tagStyle3dBorder": "下方阴影",
			"settings.tagStyleOffsetShadow": "右下阴影",
			"settings.tagStylePushable": "立体按压",
			"settings.profilesTitle": "标签组",
			"settings.activeBadge": "当前",
			"settings.moveToTrash": "移入回收站",
			"settings.trash": "回收站",
			"settings.editorCopied": "已复制",
			"settings.editorCopy": "复制",
			"settings.editorExport": "导出文件",
			"settings.editorJsonError": "JSON 格式错误：{message}",
			"settings.editorInvalidShape": "数据格式与当前版本不兼容",
			"settings.restoreProfile": "恢复标签组",
			"settings.purgeProfile": "永久删除",
			"settings.save": "保存",
			"settings.purgeConfirm": "确定要永久删除「{name}」吗？此操作无法撤销。",
			"settings.corrupted": "损坏的数据",
			"settings.corruptedReason": "原因：{reason}",
			"settings.emptyTag": "(空)",
			"tagConfig.displayName": "显示名称",
			"tagConfig.displayNameHint": "（留空则显示 tag 原文）",
			"tagConfig.tagSyntax": "标签语法",
			"tagConfig.searchPlaceholder": "输入中文或英文搜索…",
			"tagConfig.loadingPlaceholder": "加载中…",
			"tagConfig.removeRow": "移除",
			"tagConfig.noResult": "找不到符合的标签",
			"tagConfig.rightClickMode": "右键模式",
			"tagConfig.prefix": "前缀",
			"tagConfig.colonPrefixNone": "（无）",
			"tagConfig.colonPrefixNsGroup": "Namespace",
			"tagConfig.colonPrefixQGroup": "限定词",
			"tagConfig.nsLong": "长",
			"tagConfig.nsShort": "短",
			"tagConfig.exactMatch": "精确搜索 ($)",
			"tagConfig.wildcard": "通配符 (*)",
			"tagConfig.rawSyntax": "原始语法",
			"tagConfig.explainPrefix": "前缀",
			"tagConfig.explainNs": "namespace",
			"tagConfig.explainQualifier": "限定词",
			"tagConfig.explainTag": "标签",
			"tagConfig.explainSuffix": "后缀",
			"tagConfig.explainError": "解析错误",
			"tagConfig.delete": "删除",
			"tagConfig.cancel": "取消",
			"tagConfig.save": "保存",
			"urlConfig.displayName": "显示名称",
			"urlConfig.displayNameHint": "（留空则显示网址）",
			"urlConfig.url": "网址",
			"urlConfig.fullUrl": "完整网址",
			"urlConfig.fetching": "获取中…",
			"urlConfig.fetchTitle": "获取标题",
			"urlConfig.delete": "删除",
			"urlConfig.cancel": "取消",
			"urlConfig.save": "保存",
			"ns.female": "女",
			"ns.male": "男",
			"ns.mixed": "混",
			"ns.other": "其他",
			"ns.location": "地点",
			"ns.language": "语言",
			"ns.parody": "原作",
			"ns.character": "角色",
			"ns.artist": "画师",
			"ns.cosplayer": "Coser",
			"ns.group": "团体",
			"ns.reclass": "分类",
			"ns.temp": "临时",
			"about.desc": "E-Hentai / ExHentai 搜索快捷标签栏",
			"about.reportIssue": "报告问题",
			"about.inspiration": "灵感来源",
			"about.techRef": "技术栈参考",
			"about.credits": "致谢",
			"about.ehttDetail": "标签中文翻译数据库（CC BY-NC-SA 3.0）",
			"about.ehsyringeDetail": "搜索排序权重逻辑参考（MIT）",
			"about.openccDetail": "繁简转换字表数据（Apache-2.0）",
			"default.chinese": "中文",
			"default.english": "英语",
			"default.korean": "韩语",
			"default.japanese": "日语",
			"default.fullColor": "全彩",
			"default.uncensored": "无修正",
			"default.translated": "已翻译",
			"default.speechless": "无对话",
			"default.excludeAI": "排除AI",
			"default.excludeRoughTL": "排除机翻",
			"default.howto": "教程",
			"default.artbook": "画集",
			"default.imageset": "图集",
			"default.tankoubon": "单行本",
			"default.anthology": "选集",
			"default.profileName": "默认标签组",
			"default.general": "一般"
		},
		"en": {
			"common.itemColor": "Button color",
			"tagbar.search": "Search",
			"tagbar.searchNewTab": "Search in new tab",
			"tagbar.clearSearch": "Clear search",
			"tagbar.none": "None",
			"tagbar.infoTooltip": "Left double-click: {left} | Right double-click: {right}",
			"tagbar.newProfile": "Click to name new profile",
			"tagbar.handleTitle": "Drag to reorder rows",
			"tagbar.deleteLine": "Delete this row",
			"tagbar.deleteLineConfirm": "Delete this row? This cannot be undone.",
			"tagbar.lineColor": "Row color",
			"tagbar.lineColorClear": "Clear color",
			"tagbar.separatorSettings": "Separator settings",
			"tagbar.separatorLabelPlaceholder": "Enter text",
			"tagbar.separatorStyle": "Line",
			"tagbar.separatorStyle_solid": "Solid",
			"tagbar.separatorStyle_dashed": "Dashed",
			"tagbar.separatorStyle_none": "None",
			"tagbar.separatorLinePosition": "Line position",
			"tagbar.separatorLinePosition_top": "Top",
			"tagbar.separatorLinePosition_middle": "Middle",
			"tagbar.separatorLinePosition_bottom": "Bottom",
			"tagbar.separatorTextSize": "Text size",
			"tagbar.separatorLineThickness": "Line thickness",
			"tagbar.separatorLineLength": "Line length",
			"tagbar.separatorTextAlign": "Text align",
			"tagbar.separatorTextAlign_left": "Left",
			"tagbar.separatorTextAlign_center": "Center",
			"tagbar.separatorTextAlign_right": "Right",
			"tagbar.addButtonLine": "Add row",
			"tagbar.addSeparatorLine": "Add separator",
			"tagbar.addTag": "Add tag",
			"tagbar.addUrl": "Add URL",
			"tagbar.done": "Done",
			"tagbar.edit": "Edit",
			"tagbar.settings": "Settings",
			"settings.title": "Settings",
			"settings.close": "Close",
			"settings.tabSearch": "Search",
			"settings.tabAppearance": "Appearance",
			"settings.tabData": "Data",
			"settings.tabAbout": "About",
			"settings.useNhWeight": "Sort by nhentai popularity",
			"settings.useNhWeightHint": "When enabled, search suggestions prioritize tags with high nhentai upload counts (top 500). Others are sorted by the default formula.",
			"settings.dblClickActions": "Background double-click actions",
			"settings.dblClickLeft": "Left double-click",
			"settings.dblClickRight": "Right double-click",
			"settings.actionSearchCurrent": "Search (current page)",
			"settings.actionSearchNewTab": "Search (new tab)",
			"settings.actionClear": "Clear search",
			"settings.actionNone": "None",
			"settings.newTabActivate": "Switch to new tab when searching",
			"settings.nsOrder": "Namespace search order",
			"settings.nsOrderHint": "Adjust the sorting weight of namespaces in search suggestions. Drag to reorder, uncheck to hide.\nNote: This only affects ordering between namespaces. Match quality and nhentai popularity still take priority.",
			"settings.reset": "Reset",
			"settings.resetTitle": "Reset to default",
			"settings.nsFormat": "Namespace format",
			"settings.nsFormatLong": "Long (female)",
			"settings.nsFormatShort": "Short (f)",
			"settings.defaultExactMatch": "Default exact match ($)",
			"settings.defaultExactMatchHint": "When enabled, tags saved from the builder automatically get the $ suffix.",
			"settings.tagDbMirror": "Tag DB mirror",
			"settings.tagDbTtlDays": "Tag DB cache (days)",
			"settings.tagDbRefresh": "Refresh now",
			"settings.tagDbRefreshing": "Refreshing...",
			"settings.fontFamily": "Custom font",
			"settings.fontFamilyPlaceholder": "Leave empty to use page font",
			"settings.fontFamilyHint": "font-family example: ",
			"settings.fontWeight": "Font weight",
			"settings.preview": "Preview",
			"settings.language": "Language",
			"settings.tagStyle": "Button style",
			"settings.tagStyleFlat": "Default",
			"settings.tagStyle3dBorder": "Bottom shadow",
			"settings.tagStyleOffsetShadow": "Bottom-right shadow",
			"settings.tagStylePushable": "Pushable 3D",
			"settings.profilesTitle": "Profiles",
			"settings.activeBadge": "Active",
			"settings.moveToTrash": "Move to trash",
			"settings.trash": "Trash",
			"settings.editorCopied": "Copied",
			"settings.editorCopy": "Copy",
			"settings.editorExport": "Export file",
			"settings.editorJsonError": "JSON format error: {message}",
			"settings.editorInvalidShape": "Data shape incompatible with current version",
			"settings.restoreProfile": "Restore profile",
			"settings.purgeProfile": "Delete permanently",
			"settings.save": "Save",
			"settings.purgeConfirm": "Permanently delete \"{name}\"? This cannot be undone.",
			"settings.corrupted": "Corrupted data",
			"settings.corruptedReason": "Reason: {reason}",
			"settings.emptyTag": "(empty)",
			"tagConfig.displayName": "Display name",
			"tagConfig.displayNameHint": "(leave empty to show raw tag)",
			"tagConfig.tagSyntax": "Tag syntax",
			"tagConfig.searchPlaceholder": "Search tags...",
			"tagConfig.loadingPlaceholder": "Loading...",
			"tagConfig.removeRow": "Remove",
			"tagConfig.noResult": "No matching tags found",
			"tagConfig.rightClickMode": "Right-click mode",
			"tagConfig.prefix": "Prefix",
			"tagConfig.colonPrefixNone": "(none)",
			"tagConfig.colonPrefixNsGroup": "Namespaces",
			"tagConfig.colonPrefixQGroup": "Qualifiers",
			"tagConfig.nsLong": "Long",
			"tagConfig.nsShort": "Short",
			"tagConfig.exactMatch": "Exact ($)",
			"tagConfig.wildcard": "Wildcard (*)",
			"tagConfig.rawSyntax": "Raw syntax",
			"tagConfig.explainPrefix": "prefix",
			"tagConfig.explainNs": "namespace",
			"tagConfig.explainQualifier": "qualifier",
			"tagConfig.explainTag": "tag",
			"tagConfig.explainSuffix": "suffix",
			"tagConfig.explainError": "parse error",
			"tagConfig.delete": "Delete",
			"tagConfig.cancel": "Cancel",
			"tagConfig.save": "Save",
			"urlConfig.displayName": "Display name",
			"urlConfig.displayNameHint": "(leave empty to show URL)",
			"urlConfig.url": "URL",
			"urlConfig.fullUrl": "Full URL",
			"urlConfig.fetching": "Fetching...",
			"urlConfig.fetchTitle": "Fetch title",
			"urlConfig.delete": "Delete",
			"urlConfig.cancel": "Cancel",
			"urlConfig.save": "Save",
			"ns.female": "Female",
			"ns.male": "Male",
			"ns.mixed": "Mixed",
			"ns.other": "Other",
			"ns.location": "Location",
			"ns.language": "Language",
			"ns.parody": "Parody",
			"ns.character": "Character",
			"ns.artist": "Artist",
			"ns.cosplayer": "Cosplayer",
			"ns.group": "Group",
			"ns.reclass": "Reclass",
			"ns.temp": "Temp",
			"about.desc": "Quick tag bar for E-Hentai / ExHentai search",
			"about.reportIssue": "Report issue",
			"about.inspiration": "Inspiration",
			"about.techRef": "Tech stack reference",
			"about.credits": "Credits",
			"about.ehttDetail": "Tag translation database (CC BY-NC-SA 3.0)",
			"about.ehsyringeDetail": "Search ranking logic reference (MIT)",
			"about.openccDetail": "CJK character mapping data (Apache-2.0)",
			"default.chinese": "Chinese",
			"default.english": "English",
			"default.korean": "Korean",
			"default.japanese": "Japanese",
			"default.fullColor": "Full Color",
			"default.uncensored": "Uncensored",
			"default.translated": "Translated",
			"default.speechless": "Speechless",
			"default.excludeAI": "No AI",
			"default.excludeRoughTL": "No MTL",
			"default.howto": "How-to",
			"default.artbook": "Artbook",
			"default.imageset": "Image Set",
			"default.tankoubon": "Tankoubon",
			"default.anthology": "Anthology",
			"default.profileName": "Default",
			"default.general": "General"
		},
		"ja": {
			"common.itemColor": "ボタンの色",
			"tagbar.search": "検索",
			"tagbar.searchNewTab": "新しいタブで検索",
			"tagbar.clearSearch": "検索をクリア",
			"tagbar.none": "なし",
			"tagbar.infoTooltip": "左ダブルクリック：{left}｜右ダブルクリック：{right}",
			"tagbar.newProfile": "クリックして新しいプロファイルに名前を付ける",
			"tagbar.handleTitle": "ドラッグして行を並べ替え",
			"tagbar.deleteLine": "この行を削除",
			"tagbar.deleteLineConfirm": "この行を削除しますか？この操作は元に戻せません。",
			"tagbar.lineColor": "行の色",
			"tagbar.lineColorClear": "色をクリア",
			"tagbar.separatorSettings": "区切り線の設定",
			"tagbar.separatorLabelPlaceholder": "テキストを入力",
			"tagbar.separatorStyle": "線",
			"tagbar.separatorStyle_solid": "実線",
			"tagbar.separatorStyle_dashed": "破線",
			"tagbar.separatorStyle_none": "なし",
			"tagbar.separatorLinePosition": "線の位置",
			"tagbar.separatorLinePosition_top": "上",
			"tagbar.separatorLinePosition_middle": "中央",
			"tagbar.separatorLinePosition_bottom": "下",
			"tagbar.separatorTextSize": "文字サイズ",
			"tagbar.separatorLineThickness": "線の太さ",
			"tagbar.separatorLineLength": "線の長さ",
			"tagbar.separatorTextAlign": "文字揃え",
			"tagbar.separatorTextAlign_left": "左揃え",
			"tagbar.separatorTextAlign_center": "中央",
			"tagbar.separatorTextAlign_right": "右揃え",
			"tagbar.addButtonLine": "行を追加",
			"tagbar.addSeparatorLine": "区切り線を追加",
			"tagbar.addTag": "タグを追加",
			"tagbar.addUrl": "URLを追加",
			"tagbar.done": "完了",
			"tagbar.edit": "編集",
			"tagbar.settings": "設定",
			"settings.title": "設定",
			"settings.close": "閉じる",
			"settings.tabSearch": "検索",
			"settings.tabAppearance": "外観",
			"settings.tabData": "データ",
			"settings.tabAbout": "About",
			"settings.useNhWeight": "nhentai 人気順で並べ替え",
			"settings.useNhWeightHint": "有効にすると、検索候補は nhentai のアップロード数が多いタグ（上位500）を優先表示します。それ以外はデフォルトの計算式で並べ替えます。",
			"settings.dblClickActions": "背景ダブルクリック動作",
			"settings.dblClickLeft": "左ダブルクリック",
			"settings.dblClickRight": "右ダブルクリック",
			"settings.actionSearchCurrent": "検索（現在のページ）",
			"settings.actionSearchNewTab": "検索（新しいタブ）",
			"settings.actionClear": "検索をクリア",
			"settings.actionNone": "なし",
			"settings.newTabActivate": "新しいタブで検索時にそのタブへ切り替える",
			"settings.nsOrder": "Namespace 検索順序",
			"settings.nsOrderHint": "検索候補における namespace の並び順を調整します。ドラッグで順序を変更、チェックを外すと非表示にできます。\n注意：この順序は namespace 間の並びにのみ影響します。マッチ品質と nhentai 人気は引き続き優先されます。",
			"settings.reset": "リセット",
			"settings.resetTitle": "デフォルトにリセット",
			"settings.nsFormat": "Namespace 形式",
			"settings.nsFormatLong": "完全（female）",
			"settings.nsFormatShort": "省略（f）",
			"settings.defaultExactMatch": "デフォルト完全一致 ($)",
			"settings.defaultExactMatchHint": "有効にすると、ビルダーから保存されたタグに自動的に $ サフィックスが付きます。",
			"settings.tagDbMirror": "タグ DB ミラー",
			"settings.tagDbTtlDays": "タグ DB キャッシュ（日）",
			"settings.tagDbRefresh": "今すぐ更新",
			"settings.tagDbRefreshing": "更新中…",
			"settings.fontFamily": "カスタムフォント",
			"settings.fontFamilyPlaceholder": "空欄の場合はページのフォントを使用",
			"settings.fontFamilyHint": "font-family 値の例：",
			"settings.fontWeight": "フォントウェイト",
			"settings.preview": "プレビュー",
			"settings.language": "言語 / Language",
			"settings.tagStyle": "ボタンスタイル",
			"settings.tagStyleFlat": "デフォルト",
			"settings.tagStyle3dBorder": "下シャドウ",
			"settings.tagStyleOffsetShadow": "右下シャドウ",
			"settings.tagStylePushable": "プッシュ 3D",
			"settings.profilesTitle": "プロファイル",
			"settings.activeBadge": "使用中",
			"settings.moveToTrash": "ゴミ箱に移動",
			"settings.trash": "ゴミ箱",
			"settings.editorCopied": "コピーしました",
			"settings.editorCopy": "コピー",
			"settings.editorExport": "ファイルをエクスポート",
			"settings.editorJsonError": "JSON 形式エラー：{message}",
			"settings.editorInvalidShape": "データ形式が現在のバージョンと互換性がありません",
			"settings.restoreProfile": "プロファイルを復元",
			"settings.purgeProfile": "完全に削除",
			"settings.save": "保存",
			"settings.purgeConfirm": "「{name}」を完全に削除しますか？この操作は元に戻せません。",
			"settings.corrupted": "破損したデータ",
			"settings.corruptedReason": "原因：{reason}",
			"settings.emptyTag": "(空)",
			"tagConfig.displayName": "表示名",
			"tagConfig.displayNameHint": "（空欄の場合はタグ原文を表示）",
			"tagConfig.tagSyntax": "タグ構文",
			"tagConfig.searchPlaceholder": "タグを検索…",
			"tagConfig.loadingPlaceholder": "読み込み中…",
			"tagConfig.removeRow": "削除",
			"tagConfig.noResult": "一致するタグが見つかりません",
			"tagConfig.rightClickMode": "右クリックモード",
			"tagConfig.prefix": "プレフィックス",
			"tagConfig.colonPrefixNone": "（なし）",
			"tagConfig.colonPrefixNsGroup": "Namespace",
			"tagConfig.colonPrefixQGroup": "修飾子",
			"tagConfig.nsLong": "長",
			"tagConfig.nsShort": "短",
			"tagConfig.exactMatch": "完全一致 ($)",
			"tagConfig.wildcard": "ワイルドカード (*)",
			"tagConfig.rawSyntax": "生の構文",
			"tagConfig.explainPrefix": "プレフィックス",
			"tagConfig.explainNs": "namespace",
			"tagConfig.explainQualifier": "修飾子",
			"tagConfig.explainTag": "タグ",
			"tagConfig.explainSuffix": "サフィックス",
			"tagConfig.explainError": "解析エラー",
			"tagConfig.delete": "削除",
			"tagConfig.cancel": "キャンセル",
			"tagConfig.save": "保存",
			"urlConfig.displayName": "表示名",
			"urlConfig.displayNameHint": "（空欄の場合はURLを表示）",
			"urlConfig.url": "URL",
			"urlConfig.fullUrl": "完全なURL",
			"urlConfig.fetching": "取得中…",
			"urlConfig.fetchTitle": "タイトルを取得",
			"urlConfig.delete": "削除",
			"urlConfig.cancel": "キャンセル",
			"urlConfig.save": "保存",
			"ns.female": "女性",
			"ns.male": "男性",
			"ns.mixed": "混合",
			"ns.other": "その他",
			"ns.location": "場所",
			"ns.language": "言語",
			"ns.parody": "原作",
			"ns.character": "キャラ",
			"ns.artist": "作家",
			"ns.cosplayer": "コスプレイヤー",
			"ns.group": "サークル",
			"ns.reclass": "再分類",
			"ns.temp": "一時",
			"about.desc": "E-Hentai / ExHentai 検索クイックタグバー",
			"about.reportIssue": "問題を報告",
			"about.inspiration": "インスピレーション",
			"about.techRef": "技術スタック参考",
			"about.credits": "クレジット",
			"about.ehttDetail": "タグ翻訳データベース（CC BY-NC-SA 3.0）",
			"about.ehsyringeDetail": "検索ランキングロジック参考（MIT）",
			"about.openccDetail": "CJK 文字マッピングデータ（Apache-2.0）",
			"default.chinese": "中国語",
			"default.english": "英語",
			"default.korean": "韓国語",
			"default.japanese": "日本語",
			"default.fullColor": "フルカラー",
			"default.uncensored": "無修正",
			"default.translated": "翻訳済み",
			"default.speechless": "セリフなし",
			"default.excludeAI": "AI除外",
			"default.excludeRoughTL": "機械翻訳除外",
			"default.howto": "ハウツー",
			"default.artbook": "画集",
			"default.imageset": "画像集",
			"default.tankoubon": "単行本",
			"default.anthology": "アンソロジー",
			"default.profileName": "デフォルト",
			"default.general": "一般"
		}
	};
	var LOCALE_MATCH = {
		"zh-TW": "zh-TW",
		"zh-Hant": "zh-TW",
		"zh-HK": "zh-TW",
		"zh-CN": "zh-CN",
		"zh-Hans": "zh-CN",
		"zh-SG": "zh-CN",
		"zh": "zh-CN",
		"ja": "ja",
		"en": "en"
	};
	function detectLocale() {
		for (const lang of navigator.languages) {
			const exact = MESSAGES[lang] ? lang : void 0;
			if (exact) return exact;
			const mapped = LOCALE_MATCH[lang];
			if (mapped) return mapped;
			const prefixMapped = LOCALE_MATCH[lang.split("-")[0]];
			if (prefixMapped) return prefixMapped;
		}
		return "en";
	}
	var locale = ref(detectLocale());
	function setLocale(l) {
		locale.value = l;
	}
	function t(key, params) {
		const msg = MESSAGES[locale.value]?.[key] ?? MESSAGES["en"]?.[key] ?? key;
		if (!params) return msg;
		return msg.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
	}
	function isCJKLocale() {
		return locale.value === "zh-TW" || locale.value === "zh-CN";
	}
	var _hoisted_1$8 = { class: "eqt-color-picker" };
	var _hoisted_2$7 = ["color"];
	var _hoisted_3$7 = { class: "eqt-color-picker__input-row" };
	var _hoisted_4$7 = ["onKeydown"];
	var _hoisted_5$7 = ["disabled", "title"];
	var _hoisted_6$6 = { class: "eqt-color-picker__input-row" };
	var _hoisted_7$6 = ["onKeydown"];
	var _hoisted_8$6 = ["disabled", "title"];
	var ColorPicker_default = defineComponent({
		__name: "ColorPicker",
		props: { modelValue: {} },
		emits: ["update:modelValue"],
		setup(__props, { emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const hexText = ref("");
			const rgbText = ref("");
			function syncInputs(v) {
				hexText.value = v ?? "";
				rgbText.value = hexToRgbaString(v);
			}
			syncInputs(props.modelValue);
			watch(() => props.modelValue, syncInputs);
			function onPickerChange(e) {
				const detail = e.detail;
				emit("update:modelValue", detail.value);
			}
			function hexToRgbaString(v) {
				if (!v) return "";
				const m6 = /^#([0-9a-fA-F]{6})$/.exec(v);
				const m8 = /^#([0-9a-fA-F]{8})$/.exec(v);
				if (!m6 && !m8) return "";
				const hex = (m6 ?? m8)[1];
				const r = parseInt(hex.slice(0, 2), 16);
				const g = parseInt(hex.slice(2, 4), 16);
				const b = parseInt(hex.slice(4, 6), 16);
				if (m6) return `rgb(${r}, ${g}, ${b})`;
				return `rgba(${r}, ${g}, ${b}, ${+(parseInt(hex.slice(6, 8), 16) / 255).toFixed(2)})`;
			}
			function parseColor(raw) {
				const s = raw.trim();
				const hex = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(s);
				if (hex) {
					let h = hex[1].toLowerCase();
					if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + "ff";
					else if (h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
					else if (h.length === 6) h = h + "ff";
					return "#" + h;
				}
				const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
				if (rgb) {
					const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
					const r = +rgb[1], g = +rgb[2], b = +rgb[3];
					const a = rgb[4] !== void 0 ? Math.round(Math.max(0, Math.min(1, +rgb[4])) * 255) : 255;
					return "#" + toHex(r) + toHex(g) + toHex(b) + toHex(a);
				}
				return null;
			}
			function commitHex() {
				const parsed = parseColor(hexText.value);
				if (parsed) emit("update:modelValue", parsed);
				else hexText.value = props.modelValue ?? "";
			}
			function commitRgb() {
				const parsed = parseColor(rgbText.value);
				if (parsed) emit("update:modelValue", parsed);
				else rgbText.value = hexToRgbaString(props.modelValue);
			}
			const hexClip = useClipboard({ legacy: true });
			const rgbClip = useClipboard({ legacy: true });
			function onCopyHex() {
				if (hexText.value) hexClip.copy(hexText.value);
			}
			function onCopyRgb() {
				if (rgbText.value) rgbClip.copy(rgbText.value);
			}
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("div", _hoisted_1$8, [
					createBaseVNode("hex-alpha-color-picker", {
						class: "eqt-color-picker__picker",
						color: __props.modelValue ?? "#888888ff",
						onColorChanged: onPickerChange
					}, null, 40, _hoisted_2$7),
					createBaseVNode("div", _hoisted_3$7, [withDirectives(createBaseVNode("input", {
						"onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => hexText.value = $event),
						class: "eqt-color-picker__input",
						placeholder: "#rrggbbaa",
						spellcheck: "false",
						onChange: commitHex,
						onKeydown: withKeys(withModifiers(commitHex, ["prevent"]), ["enter"])
					}, null, 40, _hoisted_4$7), [[vModelText, hexText.value]]), createBaseVNode("button", {
						type: "button",
						class: "eqt-color-picker__copy",
						disabled: !hexText.value,
						title: unref(hexClip).copied.value ? unref(t)("settings.editorCopied") : unref(t)("settings.editorCopy"),
						onClick: onCopyHex
					}, [unref(hexClip).copied.value ? (openBlock(), createBlock(unref(Check), {
						key: 0,
						size: 12
					})) : (openBlock(), createBlock(unref(Copy), {
						key: 1,
						size: 12
					}))], 8, _hoisted_5$7)]),
					createBaseVNode("div", _hoisted_6$6, [withDirectives(createBaseVNode("input", {
						"onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => rgbText.value = $event),
						class: "eqt-color-picker__input",
						placeholder: "rgba(r, g, b, a)",
						spellcheck: "false",
						onChange: commitRgb,
						onKeydown: withKeys(withModifiers(commitRgb, ["prevent"]), ["enter"])
					}, null, 40, _hoisted_7$6), [[vModelText, rgbText.value]]), createBaseVNode("button", {
						type: "button",
						class: "eqt-color-picker__copy",
						disabled: !rgbText.value,
						title: unref(rgbClip).copied.value ? unref(t)("settings.editorCopied") : unref(t)("settings.editorCopy"),
						onClick: onCopyRgb
					}, [unref(rgbClip).copied.value ? (openBlock(), createBlock(unref(Check), {
						key: 0,
						size: 12
					})) : (openBlock(), createBlock(unref(Copy), {
						key: 1,
						size: 12
					}))], 8, _hoisted_8$6)])
				]);
			};
		}
	});
	var POPUP_IGNORE_KEY = Symbol("popup-register-ignore");
	function usePopupBehavior(options) {
		const ignoreList = [];
		provide(POPUP_IGNORE_KEY, (el) => {
			ignoreList.push(el);
			return () => {
				const idx = ignoreList.indexOf(el);
				if (idx >= 0) ignoreList.splice(idx, 1);
			};
		});
		onClickOutside(options.popupEl, options.onClose, { ignore: ignoreList });
		useScrollLock(document.body, true);
		useEventListener(document, "keydown", (e) => {
			if (e.key === "Escape") options.onClose();
			else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && options.onSave) {
				e.preventDefault();
				options.onSave();
			}
		});
	}
	var _hoisted_1$7 = ["title"];
	var LineColorSwatch_default = defineComponent({
		__name: "LineColorSwatch",
		props: {
			modelValue: {},
			title: {}
		},
		emits: ["update:modelValue"],
		setup(__props, { emit: __emit }) {
			const emit = __emit;
			const open = ref(false);
			const triggerEl = ref(null);
			const popupEl = ref(null);
			const { floatingStyles } = useFloating(triggerEl, popupEl, {
				placement: "bottom-start",
				middleware: [
					offset(4),
					flip(),
					shift({ padding: 8 })
				],
				whileElementsMounted: autoUpdate
			});
			onClickOutside(popupEl, () => {
				open.value = false;
			}, { ignore: [triggerEl] });
			const registerIgnore = inject(POPUP_IGNORE_KEY, void 0);
			let unregister = null;
			watch(popupEl, (el) => {
				if (unregister) {
					unregister();
					unregister = null;
				}
				if (el && registerIgnore) unregister = registerIgnore(el);
			});
			function clearColor() {
				emit("update:modelValue", void 0);
				open.value = false;
			}
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock(Fragment, null, [createBaseVNode("button", mergeProps({
					ref_key: "triggerEl",
					ref: triggerEl
				}, _ctx.$attrs, {
					type: "button",
					class: "eqt-line-color__trigger",
					style: __props.modelValue ? { color: __props.modelValue } : void 0,
					title: __props.title ?? unref(t)("tagbar.lineColor"),
					onClick: _cache[0] || (_cache[0] = ($event) => open.value = !open.value)
				}), [createVNode(unref(Palette), { size: 12 })], 16, _hoisted_1$7), (openBlock(), createBlock(Teleport, { to: "body" }, [open.value ? (openBlock(), createElementBlock("div", {
					key: 0,
					ref_key: "popupEl",
					ref: popupEl,
					class: "eqt-line-color__popup",
					style: normalizeStyle(unref(floatingStyles))
				}, [createVNode(ColorPicker_default, {
					"model-value": __props.modelValue,
					"onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => emit("update:modelValue", $event))
				}, null, 8, ["model-value"]), createBaseVNode("button", {
					type: "button",
					class: "eqt-line-color__clear",
					onClick: clearColor
				}, [createVNode(unref(X), { size: 12 }), createTextVNode(" " + toDisplayString(unref(t)("tagbar.lineColorClear")), 1)])], 4)) : createCommentVNode("", true)]))], 64);
			};
		}
	});
	var _hoisted_1$6 = ["title"];
	var _hoisted_2$6 = { class: "eqt-line-sep__row eqt-line-sep__row--col" };
	var _hoisted_3$6 = { class: "eqt-line-sep__styles" };
	var _hoisted_4$6 = ["checked", "onChange"];
	var _hoisted_5$6 = { class: "eqt-line-sep__row eqt-line-sep__row--col" };
	var _hoisted_6$5 = { class: "eqt-line-sep__styles" };
	var _hoisted_7$5 = ["checked", "onChange"];
	var _hoisted_8$5 = { class: "eqt-line-sep__row eqt-line-sep__row--col" };
	var _hoisted_9$5 = { class: "eqt-line-sep__styles" };
	var _hoisted_10$5 = ["checked", "onChange"];
	var _hoisted_11$4 = { class: "eqt-line-sep__row eqt-line-sep__row--col" };
	var _hoisted_12$4 = { class: "eqt-line-sep__slider-head" };
	var _hoisted_13$4 = { class: "eqt-line-sep__slider-value" };
	var _hoisted_14$3 = ["value"];
	var _hoisted_15$3 = { class: "eqt-line-sep__row eqt-line-sep__row--col" };
	var _hoisted_16$3 = { class: "eqt-line-sep__slider-head" };
	var _hoisted_17$2 = { class: "eqt-line-sep__slider-value" };
	var _hoisted_18$2 = ["value", "disabled"];
	var _hoisted_19$1 = { class: "eqt-line-sep__row eqt-line-sep__row--col" };
	var _hoisted_20$1 = { class: "eqt-line-sep__slider-head" };
	var _hoisted_21$1 = { class: "eqt-line-sep__slider-value" };
	var _hoisted_22$1 = ["value", "disabled"];
	var SeparatorSettingsPopup_default = defineComponent({
		__name: "SeparatorSettingsPopup",
		props: { line: {} },
		emits: ["update:line"],
		setup(__props, { emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const open = ref(false);
			const triggerEl = ref(null);
			const popupEl = ref(null);
			const { floatingStyles } = useFloating(triggerEl, popupEl, {
				placement: "bottom-start",
				middleware: [
					offset(4),
					flip(),
					shift({ padding: 8 })
				],
				whileElementsMounted: autoUpdate
			});
			onClickOutside(popupEl, () => {
				open.value = false;
			}, { ignore: [triggerEl] });
			const registerIgnore = inject(POPUP_IGNORE_KEY, void 0);
			let unregister = null;
			watch(popupEl, (el) => {
				if (unregister) {
					unregister();
					unregister = null;
				}
				if (el && registerIgnore) unregister = registerIgnore(el);
			});
			const lineStyleValue = computed(() => props.line.style?.line ?? "solid");
			const linePositionValue = computed(() => props.line.style?.linePosition ?? "middle");
			const textAlignValue = computed(() => props.line.style?.textAlign ?? "left");
			const textSizeValue = computed(() => props.line.style?.textSize ?? 10);
			const lineThicknessValue = computed(() => props.line.style?.lineThickness ?? 2);
			const lineLengthValue = computed(() => props.line.style?.lineLength ?? 100);
			function updateStyle(patch) {
				const merged = {
					...props.line.style,
					...patch
				};
				emit("update:line", {
					...props.line,
					style: Object.keys(merged).length ? merged : void 0
				});
			}
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock(Fragment, null, [createBaseVNode("button", {
					ref_key: "triggerEl",
					ref: triggerEl,
					type: "button",
					class: "eqt-line-sep__trigger",
					title: unref(t)("tagbar.separatorSettings"),
					onClick: _cache[0] || (_cache[0] = ($event) => open.value = !open.value)
				}, [createVNode(unref(Settings), { size: 12 })], 8, _hoisted_1$6), (openBlock(), createBlock(Teleport, { to: "body" }, [open.value ? (openBlock(), createElementBlock("div", {
					key: 0,
					ref_key: "popupEl",
					ref: popupEl,
					class: "eqt-line-sep__popup",
					style: normalizeStyle(unref(floatingStyles))
				}, [
					createBaseVNode("div", _hoisted_2$6, [createBaseVNode("span", null, toDisplayString(unref(t)("tagbar.separatorLinePosition")), 1), createBaseVNode("div", _hoisted_3$6, [(openBlock(), createElementBlock(Fragment, null, renderList([
						"top",
						"middle",
						"bottom"
					], (opt) => {
						return createBaseVNode("label", {
							key: opt,
							class: "eqt-line-sep__style-opt"
						}, [createBaseVNode("input", {
							type: "radio",
							checked: linePositionValue.value === opt,
							onChange: ($event) => updateStyle({ linePosition: opt })
						}, null, 40, _hoisted_4$6), createBaseVNode("span", null, toDisplayString(unref(t)(`tagbar.separatorLinePosition_${opt}`)), 1)]);
					}), 64))])]),
					createBaseVNode("div", _hoisted_5$6, [createBaseVNode("span", null, toDisplayString(unref(t)("tagbar.separatorStyle")), 1), createBaseVNode("div", _hoisted_6$5, [(openBlock(), createElementBlock(Fragment, null, renderList([
						"solid",
						"dashed",
						"none"
					], (opt) => {
						return createBaseVNode("label", {
							key: opt,
							class: "eqt-line-sep__style-opt"
						}, [createBaseVNode("input", {
							type: "radio",
							checked: lineStyleValue.value === opt,
							onChange: ($event) => updateStyle({ line: opt })
						}, null, 40, _hoisted_7$5), createBaseVNode("span", null, toDisplayString(unref(t)(`tagbar.separatorStyle_${opt}`)), 1)]);
					}), 64))])]),
					createBaseVNode("div", _hoisted_8$5, [createBaseVNode("span", null, toDisplayString(unref(t)("tagbar.separatorTextAlign")), 1), createBaseVNode("div", _hoisted_9$5, [(openBlock(), createElementBlock(Fragment, null, renderList([
						"left",
						"center",
						"right"
					], (opt) => {
						return createBaseVNode("label", {
							key: opt,
							class: "eqt-line-sep__style-opt"
						}, [createBaseVNode("input", {
							type: "radio",
							checked: textAlignValue.value === opt,
							onChange: ($event) => updateStyle({ textAlign: opt })
						}, null, 40, _hoisted_10$5), createBaseVNode("span", null, toDisplayString(unref(t)(`tagbar.separatorTextAlign_${opt}`)), 1)]);
					}), 64))])]),
					createBaseVNode("div", _hoisted_11$4, [createBaseVNode("div", _hoisted_12$4, [createBaseVNode("span", null, toDisplayString(unref(t)("tagbar.separatorTextSize")), 1), createBaseVNode("span", _hoisted_13$4, toDisplayString(textSizeValue.value) + "px", 1)]), createBaseVNode("input", {
						type: "range",
						min: "9",
						max: "20",
						step: "1",
						value: textSizeValue.value,
						onInput: _cache[1] || (_cache[1] = ($event) => updateStyle({ textSize: Number($event.target.value) }))
					}, null, 40, _hoisted_14$3)]),
					createBaseVNode("div", _hoisted_15$3, [createBaseVNode("div", _hoisted_16$3, [createBaseVNode("span", null, toDisplayString(unref(t)("tagbar.separatorLineThickness")), 1), createBaseVNode("span", _hoisted_17$2, toDisplayString(lineThicknessValue.value) + "px", 1)]), createBaseVNode("input", {
						type: "range",
						min: "1",
						max: "6",
						step: "1",
						value: lineThicknessValue.value,
						disabled: lineStyleValue.value === "none",
						onInput: _cache[2] || (_cache[2] = ($event) => updateStyle({ lineThickness: Number($event.target.value) }))
					}, null, 40, _hoisted_18$2)]),
					createBaseVNode("div", _hoisted_19$1, [createBaseVNode("div", _hoisted_20$1, [createBaseVNode("span", null, toDisplayString(unref(t)("tagbar.separatorLineLength")), 1), createBaseVNode("span", _hoisted_21$1, toDisplayString(lineLengthValue.value) + "%", 1)]), createBaseVNode("input", {
						type: "range",
						min: "1",
						max: "100",
						step: "1",
						value: lineLengthValue.value,
						disabled: lineStyleValue.value === "none",
						onInput: _cache[3] || (_cache[3] = ($event) => updateStyle({ lineLength: Number($event.target.value) === 100 ? void 0 : Number($event.target.value) }))
					}, null, 40, _hoisted_22$1)])
				], 4)) : createCommentVNode("", true)]))], 64);
			};
		}
	});
	var TagState = function(TagState) {
		TagState[TagState["Off"] = 0] = "Off";
		TagState[TagState["Include"] = 1] = "Include";
		TagState[TagState["Or"] = 2] = "Or";
		TagState[TagState["Exclude"] = 3] = "Exclude";
		return TagState;
	}({});
	var QUALIFIER_SET = new Set([
		"tag",
		"weak",
		"title",
		"uploader",
		"uploaduid",
		"gid",
		"comment",
		"favnote"
	]);
	var NS_ALIASES$1 = {
		r: "reclass",
		g: "group",
		a: "artist",
		cos: "cosplayer",
		p: "parody",
		c: "character",
		f: "female",
		m: "male",
		x: "mixed",
		l: "language",
		o: "other",
		loc: "location",
		char: "character",
		circle: "group",
		lang: "language",
		series: "parody"
	};
	var ALL_NS = new Set([
		"female",
		"male",
		"other",
		"mixed",
		"location",
		"parody",
		"character",
		"artist",
		"cosplayer",
		"group",
		"language",
		"reclass",
		"temp"
	]);
	var NS_TO_SHORT = {};
	for (const [short, full] of Object.entries(NS_ALIASES$1)) if (!NS_TO_SHORT[full] || short.length < NS_TO_SHORT[full].length) NS_TO_SHORT[full] = short;
	function resolveColonPrefix(candidate) {
		const lower = candidate.toLowerCase();
		if (QUALIFIER_SET.has(lower)) return {
			qualifier: lower,
			namespace: null,
			namespaceRaw: null
		};
		if (ALL_NS.has(lower)) return {
			qualifier: null,
			namespace: lower,
			namespaceRaw: candidate
		};
		const resolved = NS_ALIASES$1[lower];
		if (resolved) return {
			qualifier: null,
			namespace: resolved,
			namespaceRaw: candidate
		};
		return {
			qualifier: null,
			namespace: null,
			namespaceRaw: null
		};
	}
	function parseTerm(raw) {
		const token = {
			prefix: null,
			qualifier: null,
			namespace: null,
			namespaceRaw: null,
			tag: "",
			quoted: false,
			suffix: null,
			raw
		};
		let pos = 0;
		const len = raw.length;
		function peek() {
			return pos < len ? raw[pos] : "";
		}
		function advance() {
			return raw[pos++];
		}
		if (peek() === "-" || peek() === "~") token.prefix = advance();
		let colonIdx = -1;
		for (let i = pos; i < len; i++) {
			if (raw[i] === "\"") break;
			if (raw[i] === ":") {
				colonIdx = i;
				break;
			}
		}
		if (colonIdx >= 0 && colonIdx > pos) {
			const resolved = resolveColonPrefix(raw.slice(pos, colonIdx));
			if (resolved.qualifier || resolved.namespace) {
				token.qualifier = resolved.qualifier;
				token.namespace = resolved.namespace;
				token.namespaceRaw = resolved.namespaceRaw;
				pos = colonIdx + 1;
			}
		}
		if (peek() === "\"") {
			advance();
			let buf = "";
			while (pos < len && peek() !== "\"") buf += advance();
			if (peek() === "\"") advance();
			token.tag = buf;
			token.quoted = true;
		} else {
			let buf = "";
			while (pos < len) buf += advance();
			token.tag = buf;
			token.quoted = false;
		}
		if (token.quoted && token.tag.length > 0) {
			const lastChar = token.tag[token.tag.length - 1];
			if (lastChar === "$" || lastChar === "*" || lastChar === "%") {
				token.suffix = lastChar;
				token.tag = token.tag.slice(0, -1);
			}
		}
		if (pos < len) {
			const suffixChar = raw.slice(pos)[0];
			if (!token.suffix && (suffixChar === "$" || suffixChar === "*" || suffixChar === "%")) {
				token.suffix = suffixChar;
				pos++;
			}
			if (pos < len) token.parseError = `Unexpected characters after suffix: "${raw.slice(pos)}"`;
		} else if (!token.quoted && token.tag.length > 0) {
			const lastChar = token.tag[token.tag.length - 1];
			if (lastChar === "$" || lastChar === "*" || lastChar === "%") {
				token.suffix = lastChar;
				token.tag = token.tag.slice(0, -1);
			}
		}
		if (!token.tag && !token.qualifier && !token.namespace && !token.parseError) {
			token.tag = raw;
			token.parseError = "Empty tag";
		}
		return token;
	}
	function serializeTerm(token, opts) {
		if (token.parseError && token.tag === token.raw) return token.raw;
		let result = "";
		if (token.prefix) result += token.prefix;
		if (token.qualifier) result += token.qualifier + ":";
		else if (token.namespace) {
			let ns;
			if (token.namespaceRaw) ns = token.namespaceRaw;
			else ns = (opts?.nsFormat ?? "long") === "short" ? NS_TO_SHORT[token.namespace] ?? token.namespace : token.namespace;
			result += ns + ":";
		}
		if (token.tag.includes(" ")) result += "\"" + token.tag + (token.suffix ?? "") + "\"";
		else {
			result += token.tag;
			if (token.suffix) result += token.suffix;
		}
		return result;
	}
	var TERM_RE = /[^"\s]*"[^"]*"[^\s]*|[^\s"]+/g;
	function tokenize(text) {
		return text.match(TERM_RE) ?? [];
	}
	var _nsCache = new Map();
	function normalizeNs(tokenStr) {
		let result = _nsCache.get(tokenStr);
		if (result !== void 0) return result;
		const parsed = parseTerm(tokenStr);
		result = parsed.parseError ? tokenStr : serializeTerm({
			...parsed,
			namespaceRaw: null
		}, { nsFormat: "long" });
		_nsCache.set(tokenStr, result);
		return result;
	}
	function applyState(part, state) {
		const neg = part.startsWith("-");
		const or = part.startsWith("~");
		if (state === TagState.Include) return part;
		if (state === TagState.Or) return neg || or ? part : `~${part}`;
		if (state === TagState.Exclude) {
			if (neg) return part.slice(1);
			if (or) return `-${part.slice(1)}`;
			return `-${part}`;
		}
		return part;
	}
	function allForms(part) {
		const p = normalizeNs(part);
		if (p.startsWith("-")) return [p, p.slice(1)];
		if (p.startsWith("~")) return [p, `-${p.slice(1)}`];
		return [
			p,
			`~${p}`,
			`-${p}`
		];
	}
	var _normSetCache = new WeakMap();
	function normSet(tokens) {
		let norm = _normSetCache.get(tokens);
		if (norm) return norm;
		norm = new Set([...tokens].map(normalizeNs));
		_normSetCache.set(tokens, norm);
		return norm;
	}
	function detectState(part, tokens) {
		const nt = normSet(tokens);
		const p = normalizeNs(part);
		const neg = p.startsWith("-");
		const or = p.startsWith("~");
		const base = neg || or ? p.slice(1) : p;
		if (neg) {
			if (nt.has(base)) return TagState.Exclude;
			if (nt.has(p)) return TagState.Include;
		} else if (or) {
			if (nt.has(`-${base}`)) return TagState.Exclude;
			if (nt.has(p)) return TagState.Include;
		} else {
			if (nt.has(`-${p}`)) return TagState.Exclude;
			if (nt.has(`~${p}`)) return TagState.Or;
			if (nt.has(p)) return TagState.Include;
		}
		return null;
	}
	function getState(tags, tokens) {
		const [first, ...rest] = tags;
		if (!first) return TagState.Off;
		const state = detectState(first, tokens);
		if (state === null) return TagState.Off;
		if (rest.every((p) => detectState(p, tokens) === state)) return state;
		return TagState.Off;
	}
	function removeTag(text, tags) {
		const tokens = tokenize(text);
		const forms = new Set(tags.flatMap(allForms));
		return tokens.filter((t) => !forms.has(normalizeNs(t))).join(" ");
	}
	function addTag(text, tags, state) {
		const tokens = tokenize(text);
		for (const p of tags) tokens.push(applyState(p, state));
		return tokens.join(" ");
	}
	var MODE_TO_STATE = {
		or: TagState.Or,
		exclude: TagState.Exclude
	};
	function getEffectiveModifiers(tags, disabledModes) {
		const disabled = new Set((disabledModes ?? []).map((m) => MODE_TO_STATE[m]));
		const hasPrefix = tags.some((p) => p.startsWith("-") || p.startsWith("~"));
		return [TagState.Or, TagState.Exclude].filter((s) => !disabled.has(s)).filter((s) => !(hasPrefix && s === TagState.Or));
	}
	function getNextRightClickState(tags, disabledModes, currentState) {
		const modifiers = getEffectiveModifiers(tags, disabledModes);
		if (!modifiers.length) return null;
		if (currentState === TagState.Off || currentState === TagState.Include) return modifiers[0];
		const idx = modifiers.indexOf(currentState);
		if (idx === -1) return modifiers[0];
		return idx === modifiers.length - 1 ? TagState.Off : modifiers[idx + 1];
	}
	var _GM = typeof GM != "undefined" ? GM : void 0;
	var _GM_openInTab = typeof GM_openInTab != "undefined" ? GM_openInTab : void 0;
	var _GM_xmlhttpRequest = typeof GM_xmlhttpRequest != "undefined" ? GM_xmlhttpRequest : void 0;
	var hasGM = typeof _GM?.getValue === "function";
	var hasGMXHR = typeof _GM_xmlhttpRequest === "function";
	async function cacheGet(key) {
		if (hasGM) return await _GM.getValue(key, "") || null;
		return localStorage.getItem(key);
	}
	async function cacheSet(key, value) {
		if (hasGM) {
			await _GM.setValue(key, value);
			return;
		}
		try {
			localStorage.setItem(key, value);
		} catch {}
	}
	var dict_default = {
		拂: ["払"],
		奸: ["姦"],
		爱: ["愛"],
		拔: ["抜"],
		罢: ["罷"],
		霸: ["覇"],
		败: ["敗"],
		拜: ["拝"],
		颁: ["頒"],
		饱: ["飽"],
		宝: ["寶"],
		报: ["報"],
		贝: ["貝"],
		备: ["備"],
		辈: ["輩"],
		笔: ["筆"],
		币: ["幣"],
		闭: ["閉"],
		边: ["辺"],
		编: ["編"],
		变: ["変"],
		标: ["標"],
		别: ["別"],
		宾: ["賓"],
		冰: ["氷"],
		并: ["並", "併"],
		钵: ["缽"],
		补: ["補"],
		步: ["歩"],
		财: ["財"],
		参: ["參"],
		残: ["殘"],
		蚕: ["蠶"],
		惨: ["慘"],
		仓: ["倉"],
		藏: ["蔵"],
		册: ["冊"],
		侧: ["側"],
		测: ["測"],
		层: ["層"],
		插: ["挿"],
		查: ["査"],
		禅: ["禪"],
		产: ["產", "産"],
		肠: ["腸"],
		偿: ["償"],
		场: ["場"],
		巢: ["巣"],
		车: ["車"],
		彻: ["徹"],
		陈: ["陳"],
		称: ["稱"],
		诚: ["誠"],
		乘: ["乗"],
		惩: ["懲"],
		吃: ["喫"],
		痴: ["癡"],
		迟: ["遅"],
		齿: ["歯"],
		耻: ["恥"],
		敕: ["勅"],
		冲: ["沖", "衝"],
		虫: ["蟲"],
		铳: ["銃"],
		丑: ["醜"],
		础: ["礎"],
		处: ["處", "処"],
		触: ["觸"],
		传: ["伝"],
		窗: ["窓"],
		创: ["創"],
		锤: ["錘"],
		纯: ["純"],
		词: ["詞"],
		辞: ["辭"],
		赐: ["賜"],
		从: ["従"],
		粹: ["粋"],
		错: ["錯"],
		达: ["達"],
		带: ["帯"],
		贷: ["貸"],
		担: ["擔"],
		单: ["単"],
		胆: ["膽"],
		诞: ["誕"],
		弹: ["弾"],
		当: ["當"],
		党: ["黨"],
		导: ["導"],
		岛: ["島"],
		盗: ["盜"],
		稻: ["稲"],
		德: ["徳"],
		灯: ["燈"],
		敌: ["敵"],
		递: ["逓"],
		缔: ["締"],
		点: ["點"],
		电: ["電"],
		钓: ["釣"],
		叠: ["畳"],
		顶: ["頂"],
		订: ["訂"],
		锭: ["錠"],
		东: ["東"],
		动: ["動", "働"],
		冻: ["凍"],
		栋: ["棟"],
		斗: ["闘"],
		独: ["獨"],
		读: ["読"],
		笃: ["篤"],
		断: ["斷"],
		锻: ["鍛"],
		队: ["隊"],
		对: ["対"],
		钝: ["鈍"],
		夺: ["奪"],
		堕: ["墮"],
		额: ["額"],
		恶: ["悪"],
		饿: ["餓"],
		儿: ["児"],
		贰: ["弐"],
		发: ["髪", "発"],
		罚: ["罰"],
		阀: ["閥"],
		烦: ["煩"],
		饭: ["飯"],
		范: ["範"],
		贩: ["販"],
		访: ["訪"],
		纺: ["紡"],
		飞: ["飛"],
		废: ["廃"],
		费: ["費"],
		纷: ["紛"],
		氛: ["雰"],
		坟: ["墳"],
		奋: ["奮"],
		愤: ["憤"],
		风: ["風"],
		缝: ["縫"],
		佛: ["仏"],
		肤: ["膚"],
		负: ["負"],
		妇: ["婦"],
		复: ["複", "復"],
		赋: ["賦"],
		缚: ["縛"],
		该: ["該"],
		干: ["幹", "乾"],
		绀: ["紺"],
		刚: ["剛"],
		纲: ["綱"],
		钢: ["鋼"],
		阁: ["閣"],
		个: ["個", "箇"],
		给: ["給"],
		宫: ["宮"],
		贡: ["貢"],
		沟: ["溝"],
		构: ["構"],
		购: ["購"],
		谷: ["穀"],
		顾: ["顧"],
		挂: ["掛"],
		关: ["関"],
		观: ["観"],
		馆: ["館"],
		贯: ["貫"],
		惯: ["慣"],
		广: ["広"],
		归: ["帰"],
		规: ["規"],
		轨: ["軌"],
		贵: ["貴"],
		国: ["國"],
		果: ["菓"],
		过: ["過"],
		还: ["還"],
		汉: ["漢"],
		号: ["號"],
		贺: ["賀"],
		黑: ["黒"],
		红: ["紅"],
		后: ["後"],
		户: ["戸"],
		护: ["護"],
		华: ["華"],
		话: ["話"],
		怀: ["懐"],
		坏: ["壊"],
		欢: ["歓"],
		环: ["環"],
		缓: ["緩"],
		换: ["換"],
		唤: ["喚"],
		挥: ["揮"],
		辉: ["輝"],
		绘: ["絵"],
		贿: ["賄"],
		惠: ["恵"],
		货: ["貨"],
		获: ["穫", "獲"],
		祸: ["禍"],
		击: ["撃"],
		饥: ["飢"],
		机: ["機"],
		鸡: ["鶏"],
		积: ["積"],
		级: ["級"],
		极: ["極"],
		几: ["幾", "机"],
		计: ["計"],
		记: ["記"],
		纪: ["紀"],
		际: ["際"],
		剂: ["剤"],
		迹: ["跡"],
		济: ["済"],
		继: ["継"],
		绩: ["績"],
		假: ["仮"],
		价: ["価"],
		坚: ["堅"],
		间: ["間"],
		监: ["監"],
		茧: ["繭"],
		俭: ["倹"],
		检: ["検"],
		减: ["減"],
		简: ["簡"],
		见: ["見"],
		荐: ["薦"],
		剑: ["剣"],
		舰: ["艦"],
		渐: ["漸"],
		践: ["踐"],
		鉴: ["鑑", "鑑"],
		将: ["將"],
		讲: ["講"],
		奖: ["奨"],
		纟: ["糸"],
		绞: ["絞"],
		矫: ["矯"],
		觉: ["覚"],
		较: ["較"],
		阶: ["階"],
		揭: ["掲"],
		节: ["節"],
		杰: ["傑", "傑"],
		诘: ["詰"],
		洁: ["潔"],
		结: ["結"],
		届: ["屆"],
		紧: ["緊"],
		谨: ["謹"],
		尽: ["盡"],
		进: ["進"],
		经: ["経"],
		惊: ["驚"],
		鲸: ["鯨"],
		净: ["浄"],
		竞: ["競"],
		静: ["靜"],
		镜: ["鏡"],
		纠: ["糾"],
		举: ["挙"],
		剧: ["劇"],
		据: ["據", "拠"],
		卷: ["巻", "巻"],
		绢: ["絹"],
		决: ["決"],
		绝: ["絶"],
		军: ["軍"],
		开: ["開"],
		壳: ["殻"],
		渴: ["渇"],
		课: ["課"],
		垦: ["墾"],
		恳: ["懇"],
		库: ["庫"],
		夸: ["誇"],
		块: ["塊"],
		宽: ["寛"],
		况: ["況"],
		矿: ["鉱"],
		扩: ["拡"],
		来: ["來"],
		赖: ["頼"],
		濑: ["瀬"],
		栏: ["欄"],
		览: ["覧"],
		滥: ["濫"],
		劳: ["労"],
		乐: ["楽"],
		垒: ["塁"],
		泪: ["涙"],
		类: ["類"],
		离: ["離"],
		礼: ["禮"],
		里: ["裡", "裏"],
		历: ["歴", "暦"],
		丽: ["麗"],
		励: ["勵"],
		隶: ["隸", "隷"],
		连: ["連"],
		练: ["練"],
		炼: ["錬"],
		恋: ["戀"],
		凉: ["涼"],
		粮: ["糧"],
		两: ["両"],
		疗: ["療"],
		猎: ["猟"],
		邻: ["鄰", "隣"],
		临: ["臨"],
		赁: ["賃"],
		灵: ["霊"],
		铃: ["鈴"],
		龄: ["齢"],
		领: ["領"],
		泷: ["滝"],
		楼: ["樓"],
		炉: ["爐"],
		虏: ["虜"],
		陆: ["陸"],
		录: ["録"],
		乱: ["亂"],
		伦: ["倫"],
		轮: ["輪"],
		论: ["論"],
		罗: ["羅"],
		络: ["絡"],
		虑: ["慮"],
		绿: ["緑"],
		马: ["馬"],
		买: ["買"],
		麦: ["麥"],
		卖: ["売"],
		脉: ["脈"],
		蛮: ["蠻"],
		满: ["満"],
		猫: ["貓"],
		贸: ["貿"],
		没: ["沒"],
		每: ["毎"],
		门: ["門"],
		梦: ["夢"],
		绵: ["綿"],
		灭: ["滅"],
		鸣: ["鳴"],
		铭: ["銘"],
		默: ["黙"],
		谋: ["謀"],
		亩: ["畝"],
		纳: ["納"],
		难: ["難"],
		恼: ["悩"],
		脑: ["脳"],
		内: ["內"],
		拟: ["擬"],
		娘: ["嬢"],
		酿: ["醸"],
		鸟: ["鳥"],
		宁: ["寧"],
		农: ["農"],
		浓: ["濃"],
		诺: ["諾"],
		盘: ["盤"],
		赔: ["賠"],
		喷: ["噴"],
		贫: ["貧"],
		频: ["頻"],
		评: ["評"],
		扑: ["撲"],
		铺: ["舗"],
		仆: ["僕"],
		朴: ["樸"],
		谱: ["譜"],
		齐: ["斉"],
		骑: ["騎"],
		棋: ["碁"],
		启: ["啓"],
		气: ["気"],
		弃: ["棄"],
		迁: ["遷"],
		铅: ["鉛"],
		谦: ["謙"],
		钱: ["銭"],
		潜: ["潛"],
		浅: ["淺"],
		强: ["強"],
		缲: ["繰"],
		桥: ["橋"],
		窃: ["竊"],
		亲: ["親"],
		寝: ["寢"],
		轻: ["軽"],
		倾: ["傾"],
		请: ["請"],
		庆: ["慶"],
		穷: ["窮"],
		驱: ["駆"],
		圈: ["圏"],
		权: ["権"],
		劝: ["勧"],
		确: ["確"],
		壤: ["壌"],
		让: ["譲"],
		热: ["熱"],
		认: ["認"],
		荣: ["栄"],
		软: ["軟"],
		锐: ["鋭"],
		润: ["潤"],
		伞: ["傘"],
		丧: ["喪"],
		骚: ["騒"],
		扫: ["掃"],
		涩: ["渋"],
		杀: ["殺"],
		缮: ["繕"],
		伤: ["傷"],
		赏: ["賞"],
		烧: ["焼"],
		绍: ["紹"],
		舍: ["舎", "捨"],
		设: ["設"],
		涉: ["渉"],
		摄: ["摂"],
		绅: ["紳"],
		审: ["審"],
		声: ["聲"],
		绳: ["縄"],
		圣: ["聖"],
		胜: ["勝"],
		剩: ["剰"],
		师: ["師"],
		诗: ["詩"],
		湿: ["濕"],
		时: ["時"],
		识: ["識"],
		实: ["実"],
		势: ["勢"],
		饰: ["飾"],
		试: ["試"],
		视: ["視"],
		适: ["適"],
		释: ["釈"],
		收: ["収"],
		寿: ["壽"],
		兽: ["獣"],
		书: ["書"],
		枢: ["樞"],
		疏: ["疎"],
		输: ["輸"],
		属: ["屬"],
		术: ["術"],
		树: ["樹"],
		数: ["數"],
		帅: ["帥"],
		双: ["雙"],
		税: ["稅"],
		顺: ["順"],
		说: ["說", "説"],
		饲: ["飼"],
		讼: ["訟"],
		搜: ["捜"],
		诉: ["訴"],
		肃: ["粛"],
		随: ["隨"],
		髓: ["髄"],
		岁: ["歳"],
		碎: ["砕"],
		穗: ["穂"],
		孙: ["孫"],
		损: ["損"],
		缩: ["縮"],
		锁: ["鎖"],
		态: ["態"],
		坛: ["壇"],
		昙: ["曇"],
		谈: ["談"],
		叹: ["歎", "嘆"],
		汤: ["湯"],
		讨: ["討"],
		腾: ["騰"],
		誊: ["謄"],
		题: ["題"],
		条: ["條"],
		调: ["調"],
		铁: ["鐵", "鉄"],
		厅: ["庁"],
		听: ["聴"],
		铜: ["銅"],
		统: ["統"],
		头: ["頭"],
		图: ["図"],
		涂: ["塗"],
		团: ["団"],
		脱: ["脫"],
		驮: ["駄"],
		湾: ["灣"],
		顽: ["頑"],
		万: ["萬"],
		网: ["網"],
		为: ["為"],
		违: ["違"],
		围: ["囲"],
		维: ["維"],
		伟: ["偉"],
		伪: ["偽"],
		纬: ["緯"],
		卫: ["衛"],
		纹: ["紋"],
		闻: ["聞"],
		稳: ["穏"],
		问: ["問"],
		涡: ["渦"],
		污: ["汚"],
		无: ["無"],
		吴: ["呉"],
		务: ["務"],
		误: ["誤"],
		雾: ["霧"],
		溪: ["渓", "渓"],
		习: ["習"],
		袭: ["襲"],
		玺: ["璽"],
		铣: ["銑"],
		戏: ["戯"],
		系: ["係"],
		细: ["細"],
		舄: ["潟"],
		辖: ["轄"],
		吓: ["嚇"],
		纤: ["繊"],
		鲜: ["鮮"],
		闲: ["閑", "閑"],
		贤: ["賢"],
		显: ["顕"],
		险: ["険"],
		现: ["現"],
		宪: ["憲"],
		陷: ["陥"],
		缐: ["線"],
		乡: ["郷"],
		详: ["詳"],
		响: ["響"],
		项: ["項"],
		晓: ["暁"],
		笑: ["咲"],
		效: ["効"],
		协: ["協"],
		胁: ["脅"],
		写: ["寫"],
		谢: ["謝"],
		兴: ["興"],
		许: ["許"],
		叙: ["敘"],
		绪: ["緒"],
		续: ["続"],
		轩: ["軒"],
		悬: ["懸"],
		选: ["選"],
		勋: ["勲"],
		熏: ["薫"],
		寻: ["尋"],
		训: ["訓"],
		压: ["圧"],
		亚: ["亜"],
		烟: ["煙"],
		严: ["厳"],
		盐: ["塩"],
		颜: ["顔"],
		验: ["験"],
		扬: ["揚"],
		阳: ["陽"],
		养: ["養"],
		样: ["様"],
		窑: ["窯"],
		谣: ["謡"],
		摇: ["揺"],
		药: ["薬"],
		业: ["業"],
		叶: ["葉"],
		谒: ["謁"],
		壹: ["壱"],
		仪: ["儀"],
		遗: ["遺"],
		亿: ["億"],
		义: ["義"],
		忆: ["憶"],
		议: ["議"],
		异: ["異"],
		译: ["訳"],
		驿: ["駅"],
		阴: ["陰"],
		银: ["銀"],
		饮: ["飲"],
		隐: ["隠"],
		樱: ["桜"],
		萤: ["蛍"],
		营: ["営"],
		应: ["応"],
		拥: ["擁"],
		咏: ["詠"],
		踊: ["踴"],
		优: ["優"],
		忧: ["憂"],
		邮: ["郵"],
		犹: ["猶"],
		游: ["遊"],
		诱: ["誘"],
		余: ["餘"],
		鱼: ["魚"],
		娱: ["娯"],
		渔: ["漁"],
		与: ["與"],
		语: ["語"],
		狱: ["獄"],
		预: ["預"],
		谕: ["諭"],
		御: ["禦"],
		誉: ["譽"],
		园: ["園"],
		员: ["員"],
		缘: ["縁"],
		远: ["遠"],
		愿: ["願"],
		约: ["約"],
		阅: ["閲"],
		跃: ["躍"],
		云: ["雲", "伝"],
		运: ["運"],
		韵: ["韻"],
		杂: ["雑"],
		灾: ["災"],
		载: ["載"],
		暂: ["暫"],
		赞: ["贊", "賛"],
		脏: ["臓"],
		则: ["則"],
		责: ["責"],
		择: ["択"],
		泽: ["沢"],
		贼: ["賊"],
		增: ["増"],
		赠: ["贈"],
		札: ["劄"],
		诈: ["詐"],
		斋: ["斎"],
		债: ["債"],
		栈: ["桟"],
		战: ["戦"],
		张: ["張"],
		长: ["長"],
		帐: ["帳"],
		胀: ["脹"],
		诏: ["詔"],
		着: ["著"],
		贞: ["貞"],
		针: ["針"],
		侦: ["偵"],
		诊: ["診"],
		阵: ["陣"],
		镇: ["鎮"],
		争: ["爭"],
		证: ["證", "証"],
		织: ["織"],
		执: ["執"],
		值: ["値"],
		职: ["職"],
		纸: ["紙"],
		质: ["質"],
		滞: ["滯"],
		终: ["終"],
		钟: ["鐘"],
		种: ["種"],
		冢: ["塚"],
		众: ["眾", "衆"],
		轴: ["軸"],
		昼: ["晝"],
		诸: ["諸"],
		嘱: ["囑"],
		贮: ["貯"],
		驻: ["駐"],
		筑: ["築"],
		专: ["専"],
		转: ["転"],
		妆: ["妝"],
		庄: ["荘"],
		装: ["裝"],
		壮: ["壯"],
		状: ["狀"],
		坠: ["墜"],
		浊: ["濁"],
		咨: ["諮"],
		资: ["資"],
		姊: ["姉"],
		渍: ["漬"],
		总: ["総"],
		纵: ["縦"],
		组: ["組"],
		醉: ["酔"],
		闷: ["悶"],
		灌: ["浣"],
		仿: ["倣"],
		做: ["作"],
		划: ["画"],
		叛: ["反"],
		圆: ["円"],
		吊: ["弔"],
		雕: ["彫"],
		征: ["徴"],
		托: ["託"],
		采: ["採"],
		榨: ["搾"],
		拨: ["発"],
		升: ["昇"],
		晚: ["晩"],
		桌: ["卓"],
		沉: ["沈"],
		准: ["準"],
		泼: ["発"],
		滨: ["浜"],
		熔: ["溶"],
		牺: ["犠"],
		瓣: ["弁"],
		愈: ["癒"],
		炮: ["砲"],
		丝: ["糸"],
		线: ["線"],
		县: ["県"],
		缺: ["欠"],
		罐: ["缶"],
		艺: ["芸"],
		制: ["製"],
		志: ["誌"],
		讽: ["風"],
		丰: ["豊"],
		辨: ["弁"],
		辩: ["弁"],
		周: ["週"],
		醋: ["酢"],
		铸: ["鋳"],
		只: ["隻"],
		龙: ["竜"]
	};
	var t2s_default = {
		㑯: "㑔",
		㑳: "㑇",
		㑶: "㐹",
		㓨: "刾",
		㘚: "㘎",
		㜄: "㚯",
		㜏: "㛣",
		㠏: "㟆",
		㥮: "㤘",
		㩜: "㨫",
		㩳: "㧐",
		㩵: "擜",
		䁻: "䀥",
		䃮: "鿎",
		䊷: "䌶",
		䋙: "䌺",
		䋚: "䌻",
		䋹: "䌿",
		䋻: "䌾",
		䍦: "䍠",
		䎱: "䎬",
		䙡: "䙌",
		䜀: "䜧",
		䝼: "䞍",
		䥇: "䦂",
		䥑: "鿏",
		䥱: "䥾",
		䦛: "䦶",
		䦟: "䦷",
		䯀: "䯅",
		䰾: "鲃",
		䱷: "䲣",
		䱽: "䲝",
		䲁: "鳚",
		䲘: "鳤",
		䴉: "鹮",
		丟: "丢",
		並: "并",
		乾: "干",
		亂: "乱",
		亙: "亘",
		亞: "亚",
		佇: "伫",
		佈: "布",
		佔: "占",
		併: "并",
		來: "来",
		侖: "仑",
		侶: "侣",
		侷: "局",
		俁: "俣",
		係: "系",
		俔: "伣",
		俠: "侠",
		俥: "伡",
		俬: "私",
		倀: "伥",
		倆: "俩",
		倈: "俫",
		倉: "仓",
		個: "个",
		們: "们",
		倖: "幸",
		倫: "伦",
		倲: "㑈",
		偉: "伟",
		偑: "㐽",
		側: "侧",
		偵: "侦",
		偽: "伪",
		傌: "㐷",
		傑: "杰",
		傖: "伧",
		傘: "伞",
		備: "备",
		傢: "家",
		傭: "佣",
		傯: "偬",
		傳: "传",
		傴: "伛",
		債: "债",
		傷: "伤",
		傾: "倾",
		僂: "偻",
		僅: "仅",
		僉: "佥",
		僑: "侨",
		僕: "仆",
		僞: "伪",
		僥: "侥",
		僨: "偾",
		僱: "雇",
		價: "价",
		儀: "仪",
		儁: "俊",
		儂: "侬",
		億: "亿",
		儈: "侩",
		儉: "俭",
		儎: "傤",
		儐: "傧",
		儔: "俦",
		儕: "侪",
		儘: "尽",
		償: "偿",
		優: "优",
		儲: "储",
		儷: "俪",
		儸: "㑩",
		儺: "傩",
		儻: "傥",
		儼: "俨",
		兇: "凶",
		兌: "兑",
		兒: "儿",
		兗: "兖",
		內: "内",
		兩: "两",
		冊: "册",
		冑: "胄",
		冪: "幂",
		凈: "净",
		凍: "冻",
		凜: "凛",
		凱: "凯",
		別: "别",
		刪: "删",
		剄: "刭",
		則: "则",
		剋: "克",
		剎: "刹",
		剗: "刬",
		剛: "刚",
		剝: "剥",
		剮: "剐",
		剴: "剀",
		創: "创",
		剷: "铲",
		劃: "划",
		劇: "剧",
		劉: "刘",
		劊: "刽",
		劌: "刿",
		劍: "剑",
		劏: "㓥",
		劑: "剂",
		劚: "㔉",
		勁: "劲",
		動: "动",
		務: "务",
		勛: "勋",
		勝: "胜",
		勞: "劳",
		勢: "势",
		勩: "勚",
		勱: "劢",
		勳: "勋",
		勵: "励",
		勸: "劝",
		勻: "匀",
		匭: "匦",
		匯: "汇",
		匱: "匮",
		區: "区",
		協: "协",
		卹: "恤",
		卻: "却",
		卽: "即",
		厙: "厍",
		厠: "厕",
		厤: "历",
		厭: "厌",
		厲: "厉",
		厴: "厣",
		參: "参",
		叄: "叁",
		叢: "丛",
		吒: "咤",
		吳: "吴",
		吶: "呐",
		呂: "吕",
		咼: "呙",
		員: "员",
		唄: "呗",
		唸: "念",
		問: "问",
		啓: "启",
		啞: "哑",
		啟: "启",
		啢: "唡",
		喎: "㖞",
		喚: "唤",
		喪: "丧",
		喫: "吃",
		喬: "乔",
		單: "单",
		喲: "哟",
		嗆: "呛",
		嗇: "啬",
		嗊: "唝",
		嗎: "吗",
		嗚: "呜",
		嗩: "唢",
		嗶: "哔",
		嘆: "叹",
		嘍: "喽",
		嘓: "啯",
		嘔: "呕",
		嘖: "啧",
		嘗: "尝",
		嘜: "唛",
		嘩: "哗",
		嘮: "唠",
		嘯: "啸",
		嘰: "叽",
		嘵: "哓",
		嘸: "呒",
		嘽: "啴",
		噁: "恶",
		噓: "嘘",
		噚: "㖊",
		噝: "咝",
		噠: "哒",
		噥: "哝",
		噦: "哕",
		噯: "嗳",
		噲: "哙",
		噴: "喷",
		噸: "吨",
		噹: "当",
		嚀: "咛",
		嚇: "吓",
		嚌: "哜",
		嚐: "尝",
		嚕: "噜",
		嚙: "啮",
		嚥: "咽",
		嚦: "呖",
		嚨: "咙",
		嚮: "向",
		嚲: "亸",
		嚳: "喾",
		嚴: "严",
		嚶: "嘤",
		囀: "啭",
		囁: "嗫",
		囂: "嚣",
		囅: "冁",
		囈: "呓",
		囉: "啰",
		囌: "苏",
		囑: "嘱",
		囪: "囱",
		圇: "囵",
		國: "国",
		圍: "围",
		園: "园",
		圓: "圆",
		圖: "图",
		團: "团",
		垻: "坝",
		埡: "垭",
		埰: "采",
		執: "执",
		堅: "坚",
		堊: "垩",
		堖: "垴",
		堝: "埚",
		堯: "尧",
		報: "报",
		場: "场",
		塊: "块",
		塋: "茔",
		塏: "垲",
		塒: "埘",
		塗: "涂",
		塚: "冢",
		塢: "坞",
		塤: "埙",
		塵: "尘",
		塹: "堑",
		墊: "垫",
		墜: "坠",
		墮: "堕",
		墰: "坛",
		墳: "坟",
		墶: "垯",
		墻: "墙",
		墾: "垦",
		壇: "坛",
		壋: "垱",
		壎: "埙",
		壓: "压",
		壘: "垒",
		壙: "圹",
		壚: "垆",
		壜: "坛",
		壞: "坏",
		壟: "垄",
		壠: "垅",
		壢: "坜",
		壩: "坝",
		壪: "塆",
		壯: "壮",
		壺: "壶",
		壼: "壸",
		壽: "寿",
		夠: "够",
		夢: "梦",
		夥: "伙",
		夾: "夹",
		奐: "奂",
		奧: "奥",
		奩: "奁",
		奪: "夺",
		奬: "奖",
		奮: "奋",
		奼: "姹",
		妝: "妆",
		姍: "姗",
		姦: "奸",
		娛: "娱",
		婁: "娄",
		婦: "妇",
		婭: "娅",
		媧: "娲",
		媯: "妫",
		媰: "㛀",
		媼: "媪",
		媽: "妈",
		嫋: "袅",
		嫗: "妪",
		嫵: "妩",
		嫺: "娴",
		嫻: "娴",
		嫿: "婳",
		嬀: "妫",
		嬃: "媭",
		嬈: "娆",
		嬋: "婵",
		嬌: "娇",
		嬙: "嫱",
		嬡: "嫒",
		嬤: "嬷",
		嬪: "嫔",
		嬰: "婴",
		嬸: "婶",
		孃: "娘",
		孋: "㛤",
		孌: "娈",
		孫: "孙",
		學: "学",
		孿: "孪",
		宮: "宫",
		寀: "采",
		寢: "寝",
		實: "实",
		寧: "宁",
		審: "审",
		寫: "写",
		寬: "宽",
		寵: "宠",
		寶: "宝",
		將: "将",
		專: "专",
		尋: "寻",
		對: "对",
		導: "导",
		尷: "尴",
		屆: "届",
		屍: "尸",
		屓: "屃",
		屜: "屉",
		屢: "屡",
		層: "层",
		屨: "屦",
		屬: "属",
		岡: "冈",
		峯: "峰",
		峴: "岘",
		島: "岛",
		峽: "峡",
		崍: "崃",
		崑: "昆",
		崗: "岗",
		崙: "仑",
		崢: "峥",
		崬: "岽",
		嵐: "岚",
		嵗: "岁",
		嵾: "㟥",
		嶁: "嵝",
		嶄: "崭",
		嶇: "岖",
		嶔: "嵚",
		嶗: "崂",
		嶠: "峤",
		嶢: "峣",
		嶧: "峄",
		嶨: "峃",
		嶮: "崄",
		嶸: "嵘",
		嶺: "岭",
		嶼: "屿",
		嶽: "岳",
		巋: "岿",
		巒: "峦",
		巔: "巅",
		巖: "岩",
		巰: "巯",
		巹: "卺",
		帥: "帅",
		師: "师",
		帳: "帐",
		帶: "带",
		幀: "帧",
		幃: "帏",
		幓: "㡎",
		幗: "帼",
		幘: "帻",
		幟: "帜",
		幣: "币",
		幫: "帮",
		幬: "帱",
		幹: "干",
		幾: "几",
		庫: "库",
		廁: "厕",
		廂: "厢",
		廄: "厩",
		廈: "厦",
		廎: "庼",
		廕: "荫",
		廚: "厨",
		廝: "厮",
		廟: "庙",
		廠: "厂",
		廡: "庑",
		廢: "废",
		廣: "广",
		廩: "廪",
		廬: "庐",
		廳: "厅",
		弒: "弑",
		弔: "吊",
		弳: "弪",
		張: "张",
		強: "强",
		彆: "别",
		彈: "弹",
		彌: "弥",
		彎: "弯",
		彔: "录",
		彙: "汇",
		彠: "彟",
		彥: "彦",
		彫: "雕",
		彲: "彨",
		彿: "佛",
		後: "后",
		徑: "径",
		從: "从",
		徠: "徕",
		復: "复",
		徵: "征",
		徹: "彻",
		恆: "恒",
		恥: "耻",
		悅: "悦",
		悞: "悮",
		悵: "怅",
		悶: "闷",
		悽: "凄",
		惡: "恶",
		惱: "恼",
		惲: "恽",
		惻: "恻",
		愛: "爱",
		愜: "惬",
		愨: "悫",
		愴: "怆",
		愷: "恺",
		愾: "忾",
		慄: "栗",
		態: "态",
		慍: "愠",
		慘: "惨",
		慚: "惭",
		慟: "恸",
		慣: "惯",
		慤: "悫",
		慪: "怄",
		慫: "怂",
		慮: "虑",
		慳: "悭",
		慶: "庆",
		慺: "㥪",
		慼: "戚",
		慾: "欲",
		憂: "忧",
		憊: "惫",
		憐: "怜",
		憑: "凭",
		憒: "愦",
		憖: "慭",
		憚: "惮",
		憤: "愤",
		憫: "悯",
		憮: "怃",
		憲: "宪",
		憶: "忆",
		懇: "恳",
		應: "应",
		懌: "怿",
		懍: "懔",
		懞: "蒙",
		懟: "怼",
		懣: "懑",
		懤: "㤽",
		懨: "恹",
		懲: "惩",
		懶: "懒",
		懷: "怀",
		懸: "悬",
		懺: "忏",
		懼: "惧",
		懾: "慑",
		戀: "恋",
		戇: "戆",
		戔: "戋",
		戧: "戗",
		戩: "戬",
		戰: "战",
		戱: "戯",
		戲: "戏",
		戶: "户",
		拋: "抛",
		挩: "捝",
		挱: "挲",
		挾: "挟",
		捨: "舍",
		捫: "扪",
		捱: "挨",
		捲: "卷",
		掃: "扫",
		掄: "抡",
		掆: "㧏",
		掗: "挜",
		掙: "挣",
		掛: "挂",
		採: "采",
		揀: "拣",
		揚: "扬",
		換: "换",
		揮: "挥",
		揯: "搄",
		損: "损",
		搖: "摇",
		搗: "捣",
		搵: "揾",
		搶: "抢",
		摑: "掴",
		摜: "掼",
		摟: "搂",
		摯: "挚",
		摳: "抠",
		摶: "抟",
		摺: "折",
		摻: "掺",
		撈: "捞",
		撏: "挦",
		撐: "撑",
		撓: "挠",
		撝: "㧑",
		撟: "挢",
		撣: "掸",
		撥: "拨",
		撫: "抚",
		撲: "扑",
		撳: "揿",
		撻: "挞",
		撾: "挝",
		撿: "捡",
		擁: "拥",
		擄: "掳",
		擇: "择",
		擊: "击",
		擋: "挡",
		擓: "㧟",
		擔: "担",
		據: "据",
		擠: "挤",
		擣: "捣",
		擬: "拟",
		擯: "摈",
		擰: "拧",
		擱: "搁",
		擲: "掷",
		擴: "扩",
		擷: "撷",
		擺: "摆",
		擻: "擞",
		擼: "撸",
		擽: "㧰",
		擾: "扰",
		攄: "摅",
		攆: "撵",
		攏: "拢",
		攔: "拦",
		攖: "撄",
		攙: "搀",
		攛: "撺",
		攜: "携",
		攝: "摄",
		攢: "攒",
		攣: "挛",
		攤: "摊",
		攪: "搅",
		攬: "揽",
		敎: "教",
		敓: "敚",
		敗: "败",
		敘: "叙",
		敵: "敌",
		數: "数",
		斂: "敛",
		斃: "毙",
		斆: "敩",
		斕: "斓",
		斬: "斩",
		斷: "断",
		於: "于",
		旂: "旗",
		旣: "既",
		昇: "升",
		時: "时",
		晉: "晋",
		晝: "昼",
		暈: "晕",
		暉: "晖",
		暘: "旸",
		暢: "畅",
		暫: "暂",
		曄: "晔",
		曆: "历",
		曇: "昙",
		曉: "晓",
		曏: "向",
		曖: "暧",
		曠: "旷",
		曨: "昽",
		曬: "晒",
		書: "书",
		會: "会",
		朧: "胧",
		朮: "术",
		東: "东",
		枴: "拐",
		柵: "栅",
		柺: "拐",
		査: "查",
		桿: "杆",
		梔: "栀",
		梘: "枧",
		條: "条",
		梟: "枭",
		梲: "棁",
		棄: "弃",
		棊: "棋",
		棖: "枨",
		棗: "枣",
		棟: "栋",
		棡: "㭎",
		棧: "栈",
		棲: "栖",
		棶: "梾",
		椏: "桠",
		椲: "㭏",
		楊: "杨",
		楓: "枫",
		楨: "桢",
		業: "业",
		極: "极",
		榘: "矩",
		榦: "干",
		榪: "杩",
		榮: "荣",
		榲: "榅",
		榿: "桤",
		構: "构",
		槍: "枪",
		槓: "杠",
		槤: "梿",
		槧: "椠",
		槨: "椁",
		槮: "椮",
		槳: "桨",
		槶: "椢",
		槼: "椝",
		樁: "桩",
		樂: "乐",
		樅: "枞",
		樑: "梁",
		樓: "楼",
		標: "标",
		樞: "枢",
		樢: "㭤",
		樣: "样",
		樧: "榝",
		樫: "㭴",
		樳: "桪",
		樸: "朴",
		樹: "树",
		樺: "桦",
		樿: "椫",
		橈: "桡",
		橋: "桥",
		機: "机",
		橢: "椭",
		橫: "横",
		檁: "檩",
		檉: "柽",
		檔: "档",
		檜: "桧",
		檟: "槚",
		檢: "检",
		檣: "樯",
		檮: "梼",
		檯: "台",
		檳: "槟",
		檸: "柠",
		檻: "槛",
		櫃: "柜",
		櫓: "橹",
		櫚: "榈",
		櫛: "栉",
		櫝: "椟",
		櫞: "橼",
		櫟: "栎",
		櫥: "橱",
		櫧: "槠",
		櫨: "栌",
		櫪: "枥",
		櫫: "橥",
		櫬: "榇",
		櫱: "蘖",
		櫳: "栊",
		櫸: "榉",
		櫻: "樱",
		欄: "栏",
		欅: "榉",
		權: "权",
		欏: "椤",
		欒: "栾",
		欖: "榄",
		欞: "棂",
		欽: "钦",
		歎: "叹",
		歐: "欧",
		歟: "欤",
		歡: "欢",
		歲: "岁",
		歷: "历",
		歸: "归",
		歿: "殁",
		殘: "残",
		殞: "殒",
		殤: "殇",
		殨: "㱮",
		殫: "殚",
		殭: "僵",
		殮: "殓",
		殯: "殡",
		殰: "㱩",
		殲: "歼",
		殺: "杀",
		殻: "壳",
		殼: "壳",
		毀: "毁",
		毆: "殴",
		毿: "毵",
		氂: "牦",
		氈: "毡",
		氌: "氇",
		氣: "气",
		氫: "氢",
		氬: "氩",
		氳: "氲",
		氾: "泛",
		汎: "泛",
		汙: "污",
		決: "决",
		沒: "没",
		沖: "冲",
		況: "况",
		泝: "溯",
		洩: "泄",
		洶: "汹",
		浹: "浃",
		涇: "泾",
		涗: "涚",
		涼: "凉",
		淒: "凄",
		淚: "泪",
		淥: "渌",
		淨: "净",
		淩: "凌",
		淪: "沦",
		淵: "渊",
		淶: "涞",
		淺: "浅",
		渙: "涣",
		減: "减",
		渢: "沨",
		渦: "涡",
		測: "测",
		渾: "浑",
		湊: "凑",
		湞: "浈",
		湧: "涌",
		湯: "汤",
		溈: "沩",
		準: "准",
		溝: "沟",
		溫: "温",
		溮: "浉",
		溳: "涢",
		溼: "湿",
		滄: "沧",
		滅: "灭",
		滌: "涤",
		滎: "荥",
		滙: "汇",
		滬: "沪",
		滯: "滞",
		滲: "渗",
		滷: "卤",
		滸: "浒",
		滻: "浐",
		滾: "滚",
		滿: "满",
		漁: "渔",
		漊: "溇",
		漚: "沤",
		漢: "汉",
		漣: "涟",
		漬: "渍",
		漲: "涨",
		漵: "溆",
		漸: "渐",
		漿: "浆",
		潁: "颍",
		潑: "泼",
		潔: "洁",
		潙: "沩",
		潚: "㴋",
		潛: "潜",
		潤: "润",
		潯: "浔",
		潰: "溃",
		潷: "滗",
		潿: "涠",
		澀: "涩",
		澆: "浇",
		澇: "涝",
		澐: "沄",
		澗: "涧",
		澠: "渑",
		澤: "泽",
		澦: "滪",
		澩: "泶",
		澮: "浍",
		澱: "淀",
		澾: "㳠",
		濁: "浊",
		濃: "浓",
		濄: "㳡",
		濕: "湿",
		濘: "泞",
		濚: "溁",
		濛: "蒙",
		濜: "浕",
		濟: "济",
		濤: "涛",
		濧: "㳔",
		濫: "滥",
		濰: "潍",
		濱: "滨",
		濺: "溅",
		濼: "泺",
		濾: "滤",
		瀂: "澛",
		瀅: "滢",
		瀆: "渎",
		瀇: "㲿",
		瀉: "泻",
		瀋: "沈",
		瀏: "浏",
		瀕: "濒",
		瀘: "泸",
		瀝: "沥",
		瀟: "潇",
		瀠: "潆",
		瀦: "潴",
		瀧: "泷",
		瀨: "濑",
		瀰: "弥",
		瀲: "潋",
		瀾: "澜",
		灃: "沣",
		灄: "滠",
		灑: "洒",
		灕: "漓",
		灘: "滩",
		灝: "灏",
		灡: "㳕",
		灣: "湾",
		灤: "滦",
		灧: "滟",
		灩: "滟",
		災: "灾",
		為: "为",
		烏: "乌",
		烴: "烃",
		無: "无",
		煉: "炼",
		煒: "炜",
		煙: "烟",
		煢: "茕",
		煥: "焕",
		煩: "烦",
		煬: "炀",
		煱: "㶽",
		熅: "煴",
		熒: "荧",
		熗: "炝",
		熱: "热",
		熲: "颎",
		熾: "炽",
		燁: "烨",
		燈: "灯",
		燉: "炖",
		燒: "烧",
		燙: "烫",
		燜: "焖",
		營: "营",
		燦: "灿",
		燬: "毁",
		燭: "烛",
		燴: "烩",
		燶: "㶶",
		燻: "熏",
		燼: "烬",
		燾: "焘",
		爍: "烁",
		爐: "炉",
		爛: "烂",
		爭: "争",
		爲: "为",
		爺: "爷",
		爾: "尔",
		牀: "床",
		牆: "墙",
		牘: "牍",
		牽: "牵",
		犖: "荦",
		犛: "牦",
		犢: "犊",
		犧: "牺",
		狀: "状",
		狹: "狭",
		狽: "狈",
		猙: "狰",
		猶: "犹",
		猻: "狲",
		獁: "犸",
		獃: "呆",
		獄: "狱",
		獅: "狮",
		獎: "奖",
		獨: "独",
		獪: "狯",
		獫: "猃",
		獮: "狝",
		獰: "狞",
		獱: "㺍",
		獲: "获",
		獵: "猎",
		獷: "犷",
		獸: "兽",
		獺: "獭",
		獻: "献",
		獼: "猕",
		玀: "猡",
		現: "现",
		琱: "雕",
		琺: "珐",
		琿: "珲",
		瑋: "玮",
		瑒: "玚",
		瑣: "琐",
		瑤: "瑶",
		瑩: "莹",
		瑪: "玛",
		瑲: "玱",
		璉: "琏",
		璡: "琎",
		璣: "玑",
		璦: "瑷",
		璫: "珰",
		璯: "㻅",
		環: "环",
		璵: "玙",
		璸: "瑸",
		璽: "玺",
		璿: "璇",
		瓊: "琼",
		瓏: "珑",
		瓔: "璎",
		瓚: "瓒",
		甌: "瓯",
		甕: "瓮",
		產: "产",
		産: "产",
		甦: "苏",
		甯: "宁",
		畝: "亩",
		畢: "毕",
		畫: "画",
		異: "异",
		畵: "画",
		當: "当",
		疇: "畴",
		疊: "叠",
		痙: "痉",
		痠: "酸",
		痾: "疴",
		瘂: "痖",
		瘋: "疯",
		瘍: "疡",
		瘓: "痪",
		瘞: "瘗",
		瘡: "疮",
		瘧: "疟",
		瘮: "瘆",
		瘲: "疭",
		瘺: "瘘",
		瘻: "瘘",
		療: "疗",
		癆: "痨",
		癇: "痫",
		癉: "瘅",
		癒: "愈",
		癘: "疠",
		癟: "瘪",
		癡: "痴",
		癢: "痒",
		癤: "疖",
		癥: "症",
		癧: "疬",
		癩: "癞",
		癬: "癣",
		癭: "瘿",
		癮: "瘾",
		癰: "痈",
		癱: "瘫",
		癲: "癫",
		發: "发",
		皁: "皂",
		皚: "皑",
		皰: "疱",
		皸: "皲",
		皺: "皱",
		盃: "杯",
		盜: "盗",
		盞: "盏",
		盡: "尽",
		監: "监",
		盤: "盘",
		盧: "卢",
		盪: "荡",
		眞: "真",
		眥: "眦",
		眾: "众",
		睏: "困",
		睜: "睁",
		睞: "睐",
		瞘: "眍",
		瞜: "䁖",
		瞞: "瞒",
		瞶: "瞆",
		瞼: "睑",
		矇: "蒙",
		矓: "眬",
		矚: "瞩",
		矯: "矫",
		硃: "朱",
		硜: "硁",
		硤: "硖",
		硨: "砗",
		硯: "砚",
		碕: "埼",
		碩: "硕",
		碭: "砀",
		碸: "砜",
		確: "确",
		碼: "码",
		碽: "䂵",
		磑: "硙",
		磚: "砖",
		磠: "硵",
		磣: "碜",
		磧: "碛",
		磯: "矶",
		磽: "硗",
		磾: "䃅",
		礄: "硚",
		礆: "硷",
		礎: "础",
		礙: "碍",
		礦: "矿",
		礪: "砺",
		礫: "砾",
		礬: "矾",
		礱: "砻",
		祕: "秘",
		祿: "禄",
		禍: "祸",
		禎: "祯",
		禕: "祎",
		禡: "祃",
		禦: "御",
		禪: "禅",
		禮: "礼",
		禰: "祢",
		禱: "祷",
		禿: "秃",
		秈: "籼",
		稅: "税",
		稈: "秆",
		稏: "䅉",
		稜: "棱",
		稟: "禀",
		種: "种",
		稱: "称",
		穀: "谷",
		穇: "䅟",
		穌: "稣",
		積: "积",
		穎: "颖",
		穠: "秾",
		穡: "穑",
		穢: "秽",
		穩: "稳",
		穫: "获",
		穭: "穞",
		窩: "窝",
		窪: "洼",
		窮: "穷",
		窯: "窑",
		窵: "窎",
		窶: "窭",
		窺: "窥",
		竄: "窜",
		竅: "窍",
		竇: "窦",
		竈: "灶",
		竊: "窃",
		竪: "竖",
		競: "竞",
		筆: "笔",
		筍: "笋",
		筧: "笕",
		筴: "䇲",
		箇: "个",
		箋: "笺",
		箏: "筝",
		節: "节",
		範: "范",
		築: "筑",
		篋: "箧",
		篔: "筼",
		篠: "筿",
		篤: "笃",
		篩: "筛",
		篳: "筚",
		簀: "箦",
		簍: "篓",
		簑: "蓑",
		簞: "箪",
		簡: "简",
		簣: "篑",
		簫: "箫",
		簹: "筜",
		簽: "签",
		簾: "帘",
		籃: "篮",
		籌: "筹",
		籔: "䉤",
		籙: "箓",
		籛: "篯",
		籜: "箨",
		籟: "籁",
		籠: "笼",
		籤: "签",
		籩: "笾",
		籪: "簖",
		籬: "篱",
		籮: "箩",
		籲: "吁",
		粵: "粤",
		糉: "粽",
		糝: "糁",
		糞: "粪",
		糧: "粮",
		糰: "团",
		糲: "粝",
		糴: "籴",
		糶: "粜",
		糹: "纟",
		糾: "纠",
		紀: "纪",
		紂: "纣",
		約: "约",
		紅: "红",
		紆: "纡",
		紇: "纥",
		紈: "纨",
		紉: "纫",
		紋: "纹",
		納: "纳",
		紐: "纽",
		紓: "纾",
		純: "纯",
		紕: "纰",
		紖: "纼",
		紗: "纱",
		紘: "纮",
		紙: "纸",
		級: "级",
		紛: "纷",
		紜: "纭",
		紝: "纴",
		紡: "纺",
		紬: "䌷",
		紮: "扎",
		細: "细",
		紱: "绂",
		紲: "绁",
		紳: "绅",
		紵: "纻",
		紹: "绍",
		紺: "绀",
		紼: "绋",
		紿: "绐",
		絀: "绌",
		終: "终",
		絃: "弦",
		組: "组",
		絅: "䌹",
		絆: "绊",
		絎: "绗",
		結: "结",
		絕: "绝",
		絛: "绦",
		絝: "绔",
		絞: "绞",
		絡: "络",
		絢: "绚",
		給: "给",
		絨: "绒",
		絰: "绖",
		統: "统",
		絲: "丝",
		絳: "绛",
		絶: "绝",
		絹: "绢",
		綁: "绑",
		綃: "绡",
		綆: "绠",
		綈: "绨",
		綉: "绣",
		綌: "绤",
		綏: "绥",
		綐: "䌼",
		綑: "捆",
		經: "经",
		綜: "综",
		綞: "缍",
		綠: "绿",
		綢: "绸",
		綣: "绻",
		綫: "线",
		綬: "绶",
		維: "维",
		綯: "绹",
		綰: "绾",
		綱: "纲",
		網: "网",
		綳: "绷",
		綴: "缀",
		綵: "彩",
		綸: "纶",
		綹: "绺",
		綺: "绮",
		綻: "绽",
		綽: "绰",
		綾: "绫",
		綿: "绵",
		緄: "绲",
		緇: "缁",
		緊: "紧",
		緋: "绯",
		緑: "绿",
		緒: "绪",
		緓: "绬",
		緔: "绱",
		緗: "缃",
		緘: "缄",
		緙: "缂",
		線: "线",
		緝: "缉",
		緞: "缎",
		締: "缔",
		緡: "缗",
		緣: "缘",
		緦: "缌",
		編: "编",
		緩: "缓",
		緬: "缅",
		緯: "纬",
		緱: "缑",
		緲: "缈",
		練: "练",
		緶: "缏",
		緹: "缇",
		緻: "致",
		緼: "缊",
		縈: "萦",
		縉: "缙",
		縊: "缢",
		縋: "缒",
		縐: "绉",
		縑: "缣",
		縕: "缊",
		縗: "缞",
		縛: "缚",
		縝: "缜",
		縞: "缟",
		縟: "缛",
		縣: "县",
		縧: "绦",
		縫: "缝",
		縭: "缡",
		縮: "缩",
		縱: "纵",
		縲: "缧",
		縳: "䌸",
		縴: "纤",
		縵: "缦",
		縶: "絷",
		縷: "缕",
		縹: "缥",
		總: "总",
		績: "绩",
		繃: "绷",
		繅: "缫",
		繆: "缪",
		繒: "缯",
		織: "织",
		繕: "缮",
		繚: "缭",
		繞: "绕",
		繡: "绣",
		繢: "缋",
		繩: "绳",
		繪: "绘",
		繫: "系",
		繭: "茧",
		繮: "缰",
		繯: "缳",
		繰: "缲",
		繳: "缴",
		繸: "䍁",
		繹: "绎",
		繼: "继",
		繽: "缤",
		繾: "缱",
		繿: "䍀",
		纇: "颣",
		纈: "缬",
		纊: "纩",
		續: "续",
		纍: "累",
		纏: "缠",
		纓: "缨",
		纔: "才",
		纖: "纤",
		纘: "缵",
		纜: "缆",
		缽: "钵",
		罃: "䓨",
		罈: "坛",
		罌: "罂",
		罎: "坛",
		罰: "罚",
		罵: "骂",
		罷: "罢",
		羅: "罗",
		羆: "罴",
		羈: "羁",
		羋: "芈",
		羣: "群",
		羥: "羟",
		羨: "羡",
		義: "义",
		羶: "膻",
		習: "习",
		翫: "玩",
		翬: "翚",
		翹: "翘",
		翽: "翙",
		耬: "耧",
		耮: "耢",
		聖: "圣",
		聞: "闻",
		聯: "联",
		聰: "聪",
		聲: "声",
		聳: "耸",
		聵: "聩",
		聶: "聂",
		職: "职",
		聹: "聍",
		聽: "听",
		聾: "聋",
		肅: "肃",
		脅: "胁",
		脈: "脉",
		脛: "胫",
		脣: "唇",
		脩: "修",
		脫: "脱",
		脹: "胀",
		腎: "肾",
		腖: "胨",
		腡: "脶",
		腦: "脑",
		腫: "肿",
		腳: "脚",
		腸: "肠",
		膃: "腽",
		膕: "腘",
		膚: "肤",
		膞: "䏝",
		膠: "胶",
		膩: "腻",
		膽: "胆",
		膾: "脍",
		膿: "脓",
		臉: "脸",
		臍: "脐",
		臏: "膑",
		臘: "腊",
		臚: "胪",
		臟: "脏",
		臠: "脔",
		臢: "臜",
		臥: "卧",
		臨: "临",
		臺: "台",
		與: "与",
		興: "兴",
		舉: "举",
		舊: "旧",
		舘: "馆",
		艙: "舱",
		艤: "舣",
		艦: "舰",
		艫: "舻",
		艱: "艰",
		艷: "艳",
		芻: "刍",
		苧: "苎",
		茲: "兹",
		荊: "荆",
		莊: "庄",
		莖: "茎",
		莢: "荚",
		莧: "苋",
		華: "华",
		菴: "庵",
		菸: "烟",
		萇: "苌",
		萊: "莱",
		萬: "万",
		萴: "荝",
		萵: "莴",
		葉: "叶",
		葒: "荭",
		葤: "荮",
		葦: "苇",
		葯: "药",
		葷: "荤",
		蒐: "搜",
		蒓: "莼",
		蒔: "莳",
		蒕: "蒀",
		蒞: "莅",
		蒼: "苍",
		蓀: "荪",
		蓆: "席",
		蓋: "盖",
		蓮: "莲",
		蓯: "苁",
		蓴: "莼",
		蓽: "荜",
		蔔: "卜",
		蔘: "参",
		蔞: "蒌",
		蔣: "蒋",
		蔥: "葱",
		蔦: "茑",
		蔭: "荫",
		蕁: "荨",
		蕆: "蒇",
		蕎: "荞",
		蕒: "荬",
		蕓: "芸",
		蕕: "莸",
		蕘: "荛",
		蕢: "蒉",
		蕩: "荡",
		蕪: "芜",
		蕭: "萧",
		蕷: "蓣",
		薀: "蕰",
		薈: "荟",
		薊: "蓟",
		薌: "芗",
		薑: "姜",
		薔: "蔷",
		薘: "荙",
		薟: "莶",
		薦: "荐",
		薩: "萨",
		薳: "䓕",
		薴: "苧",
		薵: "䓓",
		薹: "苔",
		薺: "荠",
		藍: "蓝",
		藎: "荩",
		藝: "艺",
		藥: "药",
		藪: "薮",
		藭: "䓖",
		藴: "蕴",
		藶: "苈",
		藹: "蔼",
		藺: "蔺",
		蘀: "萚",
		蘄: "蕲",
		蘆: "芦",
		蘇: "苏",
		蘊: "蕴",
		蘋: "苹",
		蘚: "藓",
		蘞: "蔹",
		蘢: "茏",
		蘭: "兰",
		蘺: "蓠",
		蘿: "萝",
		虆: "蔂",
		處: "处",
		虛: "虚",
		虜: "虏",
		號: "号",
		虧: "亏",
		虯: "虬",
		蛺: "蛱",
		蛻: "蜕",
		蜆: "蚬",
		蝕: "蚀",
		蝟: "猬",
		蝦: "虾",
		蝨: "虱",
		蝸: "蜗",
		螄: "蛳",
		螞: "蚂",
		螢: "萤",
		螮: "䗖",
		螻: "蝼",
		螿: "螀",
		蟄: "蛰",
		蟈: "蝈",
		蟎: "螨",
		蟣: "虮",
		蟬: "蝉",
		蟯: "蛲",
		蟲: "虫",
		蟶: "蛏",
		蟻: "蚁",
		蠁: "蚃",
		蠅: "蝇",
		蠆: "虿",
		蠍: "蝎",
		蠐: "蛴",
		蠑: "蝾",
		蠔: "蚝",
		蠟: "蜡",
		蠣: "蛎",
		蠨: "蟏",
		蠱: "蛊",
		蠶: "蚕",
		蠻: "蛮",
		衆: "众",
		衊: "蔑",
		術: "术",
		衕: "同",
		衚: "胡",
		衛: "卫",
		衝: "冲",
		袞: "衮",
		裊: "袅",
		裏: "里",
		補: "补",
		裝: "装",
		裡: "里",
		製: "制",
		複: "复",
		褌: "裈",
		褘: "袆",
		褲: "裤",
		褳: "裢",
		褸: "褛",
		褻: "亵",
		襇: "裥",
		襉: "裥",
		襏: "袯",
		襖: "袄",
		襝: "裣",
		襠: "裆",
		襤: "褴",
		襪: "袜",
		襬: "摆",
		襯: "衬",
		襲: "袭",
		襴: "襕",
		覈: "核",
		見: "见",
		覎: "觃",
		規: "规",
		覓: "觅",
		視: "视",
		覘: "觇",
		覡: "觋",
		覥: "觍",
		覦: "觎",
		親: "亲",
		覬: "觊",
		覯: "觏",
		覲: "觐",
		覷: "觑",
		覺: "觉",
		覽: "览",
		覿: "觌",
		觀: "观",
		觴: "觞",
		觶: "觯",
		觸: "触",
		訁: "讠",
		訂: "订",
		訃: "讣",
		計: "计",
		訊: "讯",
		訌: "讧",
		討: "讨",
		訐: "讦",
		訒: "讱",
		訓: "训",
		訕: "讪",
		訖: "讫",
		託: "托",
		記: "记",
		訛: "讹",
		訝: "讶",
		訟: "讼",
		訢: "䜣",
		訣: "诀",
		訥: "讷",
		訩: "讻",
		訪: "访",
		設: "设",
		許: "许",
		訴: "诉",
		訶: "诃",
		診: "诊",
		註: "注",
		証: "证",
		詁: "诂",
		詆: "诋",
		詎: "讵",
		詐: "诈",
		詒: "诒",
		詔: "诏",
		評: "评",
		詖: "诐",
		詗: "诇",
		詘: "诎",
		詛: "诅",
		詞: "词",
		詠: "咏",
		詡: "诩",
		詢: "询",
		詣: "诣",
		試: "试",
		詩: "诗",
		詫: "诧",
		詬: "诟",
		詭: "诡",
		詮: "诠",
		詰: "诘",
		話: "话",
		該: "该",
		詳: "详",
		詵: "诜",
		詼: "诙",
		詿: "诖",
		誄: "诔",
		誅: "诛",
		誆: "诓",
		誇: "夸",
		誌: "志",
		認: "认",
		誑: "诳",
		誒: "诶",
		誕: "诞",
		誘: "诱",
		誚: "诮",
		語: "语",
		誠: "诚",
		誡: "诫",
		誣: "诬",
		誤: "误",
		誥: "诰",
		誦: "诵",
		誨: "诲",
		說: "说",
		説: "说",
		誰: "谁",
		課: "课",
		誶: "谇",
		誹: "诽",
		誼: "谊",
		誾: "訚",
		調: "调",
		諂: "谄",
		諄: "谆",
		談: "谈",
		諉: "诿",
		請: "请",
		諍: "诤",
		諏: "诹",
		諑: "诼",
		諒: "谅",
		論: "论",
		諗: "谂",
		諛: "谀",
		諜: "谍",
		諝: "谞",
		諞: "谝",
		諡: "谥",
		諢: "诨",
		諤: "谔",
		諦: "谛",
		諧: "谐",
		諫: "谏",
		諭: "谕",
		諮: "咨",
		諱: "讳",
		諳: "谙",
		諶: "谌",
		諷: "讽",
		諸: "诸",
		諺: "谚",
		諼: "谖",
		諾: "诺",
		謀: "谋",
		謁: "谒",
		謂: "谓",
		謄: "誊",
		謅: "诌",
		謊: "谎",
		謎: "谜",
		謐: "谧",
		謔: "谑",
		謖: "谡",
		謗: "谤",
		謙: "谦",
		謚: "谥",
		講: "讲",
		謝: "谢",
		謠: "谣",
		謡: "谣",
		謨: "谟",
		謫: "谪",
		謬: "谬",
		謭: "谫",
		謳: "讴",
		謹: "谨",
		謾: "谩",
		譁: "哗",
		證: "证",
		譎: "谲",
		譏: "讥",
		譖: "谮",
		識: "识",
		譙: "谯",
		譚: "谭",
		譜: "谱",
		譟: "噪",
		譫: "谵",
		譭: "毁",
		譯: "译",
		議: "议",
		譴: "谴",
		護: "护",
		譸: "诪",
		譽: "誉",
		譾: "谫",
		讀: "读",
		讅: "谉",
		變: "变",
		讋: "詟",
		讌: "䜩",
		讎: "雠",
		讒: "谗",
		讓: "让",
		讕: "谰",
		讖: "谶",
		讚: "赞",
		讜: "谠",
		讞: "谳",
		豈: "岂",
		豎: "竖",
		豐: "丰",
		豔: "艳",
		豬: "猪",
		豶: "豮",
		貓: "猫",
		貙: "䝙",
		貝: "贝",
		貞: "贞",
		貟: "贠",
		負: "负",
		財: "财",
		貢: "贡",
		貧: "贫",
		貨: "货",
		販: "贩",
		貪: "贪",
		貫: "贯",
		責: "责",
		貯: "贮",
		貰: "贳",
		貲: "赀",
		貳: "贰",
		貴: "贵",
		貶: "贬",
		買: "买",
		貸: "贷",
		貺: "贶",
		費: "费",
		貼: "贴",
		貽: "贻",
		貿: "贸",
		賀: "贺",
		賁: "贲",
		賂: "赂",
		賃: "赁",
		賄: "贿",
		賅: "赅",
		資: "资",
		賈: "贾",
		賊: "贼",
		賑: "赈",
		賒: "赊",
		賓: "宾",
		賕: "赇",
		賙: "赒",
		賚: "赉",
		賜: "赐",
		賞: "赏",
		賠: "赔",
		賡: "赓",
		賢: "贤",
		賣: "卖",
		賤: "贱",
		賦: "赋",
		賧: "赕",
		質: "质",
		賫: "赍",
		賬: "账",
		賭: "赌",
		賰: "䞐",
		賴: "赖",
		賵: "赗",
		賺: "赚",
		賻: "赙",
		購: "购",
		賽: "赛",
		賾: "赜",
		贄: "贽",
		贅: "赘",
		贇: "赟",
		贈: "赠",
		贊: "赞",
		贋: "赝",
		贍: "赡",
		贏: "赢",
		贐: "赆",
		贓: "赃",
		贔: "赑",
		贖: "赎",
		贗: "赝",
		贛: "赣",
		贜: "赃",
		赬: "赪",
		趕: "赶",
		趙: "赵",
		趨: "趋",
		趲: "趱",
		跡: "迹",
		踐: "践",
		踰: "逾",
		踴: "踊",
		蹌: "跄",
		蹕: "跸",
		蹟: "迹",
		蹠: "跖",
		蹣: "蹒",
		蹤: "踪",
		蹺: "跷",
		躂: "跶",
		躉: "趸",
		躊: "踌",
		躋: "跻",
		躍: "跃",
		躎: "䟢",
		躑: "踯",
		躒: "跞",
		躓: "踬",
		躕: "蹰",
		躚: "跹",
		躡: "蹑",
		躥: "蹿",
		躦: "躜",
		躪: "躏",
		軀: "躯",
		車: "车",
		軋: "轧",
		軌: "轨",
		軍: "军",
		軑: "轪",
		軒: "轩",
		軔: "轫",
		軛: "轭",
		軟: "软",
		軤: "轷",
		軫: "轸",
		軲: "轱",
		軸: "轴",
		軹: "轵",
		軺: "轺",
		軻: "轲",
		軼: "轶",
		軾: "轼",
		較: "较",
		輅: "辂",
		輇: "辁",
		輈: "辀",
		載: "载",
		輊: "轾",
		輒: "辄",
		輓: "挽",
		輔: "辅",
		輕: "轻",
		輛: "辆",
		輜: "辎",
		輝: "辉",
		輞: "辋",
		輟: "辍",
		輥: "辊",
		輦: "辇",
		輩: "辈",
		輪: "轮",
		輬: "辌",
		輯: "辑",
		輳: "辏",
		輸: "输",
		輻: "辐",
		輼: "辒",
		輾: "辗",
		輿: "舆",
		轀: "辒",
		轂: "毂",
		轄: "辖",
		轅: "辕",
		轆: "辘",
		轉: "转",
		轍: "辙",
		轎: "轿",
		轔: "辚",
		轟: "轰",
		轡: "辔",
		轢: "轹",
		轤: "轳",
		辦: "办",
		辭: "辞",
		辮: "辫",
		辯: "辩",
		農: "农",
		迴: "回",
		逕: "迳",
		這: "这",
		連: "连",
		週: "周",
		進: "进",
		遊: "游",
		運: "运",
		過: "过",
		達: "达",
		違: "违",
		遙: "遥",
		遜: "逊",
		遞: "递",
		遠: "远",
		遡: "溯",
		適: "适",
		遲: "迟",
		遷: "迁",
		選: "选",
		遺: "遗",
		遼: "辽",
		邁: "迈",
		還: "还",
		邇: "迩",
		邊: "边",
		邏: "逻",
		邐: "逦",
		郟: "郏",
		郵: "邮",
		鄆: "郓",
		鄉: "乡",
		鄒: "邹",
		鄔: "邬",
		鄖: "郧",
		鄧: "邓",
		鄭: "郑",
		鄰: "邻",
		鄲: "郸",
		鄴: "邺",
		鄶: "郐",
		鄺: "邝",
		酇: "酂",
		酈: "郦",
		醃: "腌",
		醖: "酝",
		醜: "丑",
		醞: "酝",
		醟: "蒏",
		醣: "糖",
		醫: "医",
		醬: "酱",
		醱: "酦",
		釀: "酿",
		釁: "衅",
		釃: "酾",
		釅: "酽",
		釋: "释",
		釐: "厘",
		釒: "钅",
		釓: "钆",
		釔: "钇",
		釕: "钌",
		釗: "钊",
		釘: "钉",
		釙: "钋",
		針: "针",
		釣: "钓",
		釤: "钐",
		釦: "扣",
		釧: "钏",
		釩: "钒",
		釵: "钗",
		釷: "钍",
		釹: "钕",
		釺: "钎",
		釾: "䥺",
		鈀: "钯",
		鈁: "钫",
		鈃: "钘",
		鈄: "钭",
		鈅: "钥",
		鈈: "钚",
		鈉: "钠",
		鈍: "钝",
		鈎: "钩",
		鈐: "钤",
		鈑: "钣",
		鈒: "钑",
		鈔: "钞",
		鈕: "钮",
		鈞: "钧",
		鈡: "钟",
		鈣: "钙",
		鈥: "钬",
		鈦: "钛",
		鈧: "钪",
		鈮: "铌",
		鈰: "铈",
		鈳: "钶",
		鈴: "铃",
		鈷: "钴",
		鈸: "钹",
		鈹: "铍",
		鈺: "钰",
		鈽: "钸",
		鈾: "铀",
		鈿: "钿",
		鉀: "钾",
		鉅: "巨",
		鉆: "钻",
		鉈: "铊",
		鉉: "铉",
		鉋: "铇",
		鉍: "铋",
		鉑: "铂",
		鉕: "钷",
		鉗: "钳",
		鉚: "铆",
		鉛: "铅",
		鉞: "钺",
		鉢: "钵",
		鉤: "钩",
		鉦: "钲",
		鉬: "钼",
		鉭: "钽",
		鉳: "锫",
		鉶: "铏",
		鉸: "铰",
		鉺: "铒",
		鉻: "铬",
		鉿: "铪",
		銀: "银",
		銃: "铳",
		銅: "铜",
		銍: "铚",
		銑: "铣",
		銓: "铨",
		銖: "铢",
		銘: "铭",
		銚: "铫",
		銛: "铦",
		銜: "衔",
		銠: "铑",
		銣: "铷",
		銥: "铱",
		銦: "铟",
		銨: "铵",
		銩: "铥",
		銪: "铕",
		銫: "铯",
		銬: "铐",
		銱: "铞",
		銳: "锐",
		銷: "销",
		銹: "锈",
		銻: "锑",
		銼: "锉",
		鋁: "铝",
		鋃: "锒",
		鋅: "锌",
		鋇: "钡",
		鋌: "铤",
		鋏: "铗",
		鋒: "锋",
		鋙: "铻",
		鋝: "锊",
		鋟: "锓",
		鋣: "铘",
		鋤: "锄",
		鋥: "锃",
		鋦: "锔",
		鋨: "锇",
		鋩: "铓",
		鋪: "铺",
		鋭: "锐",
		鋮: "铖",
		鋯: "锆",
		鋰: "锂",
		鋱: "铽",
		鋶: "锍",
		鋸: "锯",
		鋼: "钢",
		錁: "锞",
		錄: "录",
		錆: "锖",
		錇: "锫",
		錈: "锩",
		錏: "铔",
		錐: "锥",
		錒: "锕",
		錕: "锟",
		錘: "锤",
		錙: "锱",
		錚: "铮",
		錛: "锛",
		錟: "锬",
		錠: "锭",
		錡: "锜",
		錢: "钱",
		錦: "锦",
		錨: "锚",
		錩: "锠",
		錫: "锡",
		錮: "锢",
		錯: "错",
		録: "录",
		錳: "锰",
		錶: "表",
		錸: "铼",
		錼: "镎",
		鍀: "锝",
		鍁: "锨",
		鍃: "锪",
		鍅: "钫",
		鍆: "钔",
		鍇: "锴",
		鍈: "锳",
		鍊: "炼",
		鍋: "锅",
		鍍: "镀",
		鍔: "锷",
		鍘: "铡",
		鍚: "钖",
		鍛: "锻",
		鍠: "锽",
		鍤: "锸",
		鍥: "锲",
		鍩: "锘",
		鍬: "锹",
		鍰: "锾",
		鍵: "键",
		鍶: "锶",
		鍺: "锗",
		鍼: "针",
		鍾: "钟",
		鎂: "镁",
		鎄: "锿",
		鎇: "镅",
		鎊: "镑",
		鎌: "镰",
		鎔: "镕",
		鎖: "锁",
		鎘: "镉",
		鎚: "锤",
		鎛: "镈",
		鎡: "镃",
		鎢: "钨",
		鎣: "蓥",
		鎦: "镏",
		鎧: "铠",
		鎩: "铩",
		鎪: "锼",
		鎬: "镐",
		鎭: "镇",
		鎮: "镇",
		鎰: "镒",
		鎲: "镋",
		鎳: "镍",
		鎵: "镓",
		鎶: "鿔",
		鎸: "镌",
		鎿: "镎",
		鏃: "镞",
		鏇: "旋",
		鏈: "链",
		鏌: "镆",
		鏍: "镙",
		鏐: "镠",
		鏑: "镝",
		鏗: "铿",
		鏘: "锵",
		鏜: "镗",
		鏝: "镘",
		鏞: "镛",
		鏟: "铲",
		鏡: "镜",
		鏢: "镖",
		鏤: "镂",
		鏨: "錾",
		鏰: "镚",
		鏵: "铧",
		鏷: "镤",
		鏹: "镪",
		鏺: "䥽",
		鏽: "锈",
		鐃: "铙",
		鐋: "铴",
		鐐: "镣",
		鐒: "铹",
		鐓: "镦",
		鐔: "镡",
		鐘: "钟",
		鐙: "镫",
		鐝: "镢",
		鐠: "镨",
		鐥: "䦅",
		鐦: "锎",
		鐧: "锏",
		鐨: "镄",
		鐫: "镌",
		鐮: "镰",
		鐯: "䦃",
		鐲: "镯",
		鐳: "镭",
		鐵: "铁",
		鐶: "镮",
		鐸: "铎",
		鐺: "铛",
		鐿: "镱",
		鑄: "铸",
		鑊: "镬",
		鑌: "镔",
		鑑: "鉴",
		鑒: "鉴",
		鑔: "镲",
		鑕: "锧",
		鑞: "镴",
		鑠: "铄",
		鑣: "镳",
		鑥: "镥",
		鑭: "镧",
		鑰: "钥",
		鑱: "镵",
		鑲: "镶",
		鑷: "镊",
		鑹: "镩",
		鑼: "锣",
		鑽: "钻",
		鑾: "銮",
		鑿: "凿",
		钁: "镢",
		钂: "镋",
		長: "长",
		門: "门",
		閂: "闩",
		閃: "闪",
		閆: "闫",
		閈: "闬",
		閉: "闭",
		開: "开",
		閌: "闶",
		閎: "闳",
		閏: "闰",
		閑: "闲",
		閒: "闲",
		間: "间",
		閔: "闵",
		閘: "闸",
		閡: "阂",
		閣: "阁",
		閤: "合",
		閥: "阀",
		閨: "闺",
		閩: "闽",
		閫: "阃",
		閬: "阆",
		閭: "闾",
		閱: "阅",
		閲: "阅",
		閶: "阊",
		閹: "阉",
		閻: "阎",
		閼: "阏",
		閽: "阍",
		閾: "阈",
		閿: "阌",
		闃: "阒",
		闆: "板",
		闇: "暗",
		闈: "闱",
		闊: "阔",
		闋: "阕",
		闌: "阑",
		闍: "阇",
		闐: "阗",
		闒: "阘",
		闓: "闿",
		闔: "阖",
		闕: "阙",
		闖: "闯",
		關: "关",
		闞: "阚",
		闠: "阓",
		闡: "阐",
		闢: "辟",
		闤: "阛",
		闥: "闼",
		陘: "陉",
		陝: "陕",
		陞: "升",
		陣: "阵",
		陰: "阴",
		陳: "陈",
		陸: "陆",
		陽: "阳",
		隉: "陧",
		隊: "队",
		階: "阶",
		隕: "陨",
		際: "际",
		隨: "随",
		險: "险",
		隯: "陦",
		隱: "隐",
		隴: "陇",
		隸: "隶",
		隻: "只",
		雋: "隽",
		雖: "虽",
		雙: "双",
		雛: "雏",
		雜: "杂",
		雞: "鸡",
		離: "离",
		難: "难",
		雲: "云",
		電: "电",
		霑: "沾",
		霢: "霡",
		霧: "雾",
		霽: "霁",
		靂: "雳",
		靄: "霭",
		靆: "叇",
		靈: "灵",
		靉: "叆",
		靚: "靓",
		靜: "静",
		靝: "靔",
		靦: "腼",
		靨: "靥",
		鞏: "巩",
		鞝: "绱",
		鞦: "秋",
		鞽: "鞒",
		韁: "缰",
		韃: "鞑",
		韆: "千",
		韉: "鞯",
		韋: "韦",
		韌: "韧",
		韍: "韨",
		韓: "韩",
		韙: "韪",
		韜: "韬",
		韝: "鞲",
		韞: "韫",
		韻: "韵",
		響: "响",
		頁: "页",
		頂: "顶",
		頃: "顷",
		項: "项",
		順: "顺",
		頇: "顸",
		須: "须",
		頊: "顼",
		頌: "颂",
		頎: "颀",
		頏: "颃",
		預: "预",
		頑: "顽",
		頒: "颁",
		頓: "顿",
		頗: "颇",
		領: "领",
		頜: "颌",
		頡: "颉",
		頤: "颐",
		頦: "颏",
		頭: "头",
		頮: "颒",
		頰: "颊",
		頲: "颋",
		頴: "颕",
		頷: "颔",
		頸: "颈",
		頹: "颓",
		頻: "频",
		頽: "颓",
		顆: "颗",
		題: "题",
		額: "额",
		顎: "颚",
		顏: "颜",
		顒: "颙",
		顓: "颛",
		顔: "颜",
		願: "愿",
		顙: "颡",
		顛: "颠",
		類: "类",
		顢: "颟",
		顥: "颢",
		顧: "顾",
		顫: "颤",
		顬: "颥",
		顯: "显",
		顰: "颦",
		顱: "颅",
		顳: "颞",
		顴: "颧",
		風: "风",
		颭: "飐",
		颮: "飑",
		颯: "飒",
		颱: "台",
		颳: "刮",
		颶: "飓",
		颸: "飔",
		颺: "飏",
		颻: "飖",
		颼: "飕",
		飀: "飗",
		飄: "飘",
		飆: "飙",
		飈: "飚",
		飛: "飞",
		飠: "饣",
		飢: "饥",
		飣: "饤",
		飥: "饦",
		飩: "饨",
		飪: "饪",
		飫: "饫",
		飭: "饬",
		飯: "饭",
		飱: "飧",
		飲: "饮",
		飴: "饴",
		飼: "饲",
		飽: "饱",
		飾: "饰",
		飿: "饳",
		餃: "饺",
		餄: "饸",
		餅: "饼",
		餈: "糍",
		餉: "饷",
		養: "养",
		餌: "饵",
		餎: "饹",
		餏: "饻",
		餑: "饽",
		餒: "馁",
		餓: "饿",
		餕: "馂",
		餖: "饾",
		餘: "余",
		餚: "肴",
		餛: "馄",
		餜: "馃",
		餞: "饯",
		餡: "馅",
		館: "馆",
		餬: "糊",
		餱: "糇",
		餳: "饧",
		餵: "喂",
		餶: "馉",
		餷: "馇",
		餺: "馎",
		餼: "饩",
		餾: "馏",
		餿: "馊",
		饁: "馌",
		饃: "馍",
		饅: "馒",
		饈: "馐",
		饉: "馑",
		饊: "馓",
		饋: "馈",
		饌: "馔",
		饑: "饥",
		饒: "饶",
		饗: "飨",
		饜: "餍",
		饞: "馋",
		饢: "馕",
		馬: "马",
		馭: "驭",
		馮: "冯",
		馱: "驮",
		馳: "驰",
		馴: "驯",
		馹: "驲",
		駁: "驳",
		駐: "驻",
		駑: "驽",
		駒: "驹",
		駔: "驵",
		駕: "驾",
		駘: "骀",
		駙: "驸",
		駛: "驶",
		駝: "驼",
		駟: "驷",
		駡: "骂",
		駢: "骈",
		駭: "骇",
		駰: "骃",
		駱: "骆",
		駸: "骎",
		駿: "骏",
		騁: "骋",
		騂: "骍",
		騅: "骓",
		騌: "骔",
		騍: "骒",
		騎: "骑",
		騏: "骐",
		騖: "骛",
		騙: "骗",
		騤: "骙",
		騧: "䯄",
		騫: "骞",
		騭: "骘",
		騮: "骝",
		騰: "腾",
		騶: "驺",
		騷: "骚",
		騸: "骟",
		騾: "骡",
		驀: "蓦",
		驁: "骜",
		驂: "骖",
		驃: "骠",
		驄: "骢",
		驅: "驱",
		驊: "骅",
		驌: "骕",
		驍: "骁",
		驏: "骣",
		驕: "骄",
		驗: "验",
		驚: "惊",
		驛: "驿",
		驟: "骤",
		驢: "驴",
		驤: "骧",
		驥: "骥",
		驦: "骦",
		驪: "骊",
		驫: "骉",
		骯: "肮",
		髏: "髅",
		髒: "脏",
		體: "体",
		髕: "髌",
		髖: "髋",
		髮: "发",
		鬆: "松",
		鬍: "胡",
		鬚: "须",
		鬢: "鬓",
		鬥: "斗",
		鬧: "闹",
		鬨: "哄",
		鬩: "阋",
		鬮: "阄",
		鬱: "郁",
		鬹: "鬶",
		魎: "魉",
		魘: "魇",
		魚: "鱼",
		魛: "鱽",
		魢: "鱾",
		魨: "鲀",
		魯: "鲁",
		魴: "鲂",
		魷: "鱿",
		魺: "鲄",
		鮁: "鲅",
		鮃: "鲆",
		鮊: "鲌",
		鮋: "鲉",
		鮍: "鲏",
		鮎: "鲇",
		鮐: "鲐",
		鮑: "鲍",
		鮒: "鲋",
		鮓: "鲊",
		鮚: "鲒",
		鮜: "鲘",
		鮝: "鲞",
		鮞: "鲕",
		鮣: "䲟",
		鮦: "鲖",
		鮪: "鲔",
		鮫: "鲛",
		鮭: "鲑",
		鮮: "鲜",
		鮳: "鲓",
		鮶: "鲪",
		鮺: "鲝",
		鯀: "鲧",
		鯁: "鲠",
		鯇: "鲩",
		鯉: "鲤",
		鯊: "鲨",
		鯒: "鲬",
		鯔: "鲻",
		鯕: "鲯",
		鯖: "鲭",
		鯗: "鲞",
		鯛: "鲷",
		鯝: "鲴",
		鯡: "鲱",
		鯢: "鲵",
		鯤: "鲲",
		鯧: "鲳",
		鯨: "鲸",
		鯪: "鲮",
		鯫: "鲰",
		鯰: "鲶",
		鯴: "鲺",
		鯷: "鳀",
		鯽: "鲫",
		鯿: "鳊",
		鰁: "鳈",
		鰂: "鲗",
		鰃: "鳂",
		鰆: "䲠",
		鰈: "鲽",
		鰉: "鳇",
		鰌: "䲡",
		鰍: "鳅",
		鰏: "鲾",
		鰐: "鳄",
		鰒: "鳆",
		鰓: "鳃",
		鰛: "鳁",
		鰜: "鳒",
		鰟: "鳑",
		鰠: "鳋",
		鰣: "鲥",
		鰥: "鳏",
		鰧: "䲢",
		鰨: "鳎",
		鰩: "鳐",
		鰭: "鳍",
		鰮: "鳁",
		鰱: "鲢",
		鰲: "鳌",
		鰳: "鳓",
		鰵: "鳘",
		鰷: "鲦",
		鰹: "鲣",
		鰺: "鲹",
		鰻: "鳗",
		鰼: "鳛",
		鰾: "鳔",
		鱂: "鳉",
		鱅: "鳙",
		鱈: "鳕",
		鱉: "鳖",
		鱒: "鳟",
		鱔: "鳝",
		鱖: "鳜",
		鱗: "鳞",
		鱘: "鲟",
		鱝: "鲼",
		鱟: "鲎",
		鱠: "鲙",
		鱣: "鳣",
		鱤: "鳡",
		鱧: "鳢",
		鱨: "鲿",
		鱭: "鲚",
		鱯: "鳠",
		鱷: "鳄",
		鱸: "鲈",
		鱺: "鲡",
		鳥: "鸟",
		鳧: "凫",
		鳩: "鸠",
		鳬: "凫",
		鳲: "鸤",
		鳳: "凤",
		鳴: "鸣",
		鳶: "鸢",
		鳾: "䴓",
		鴆: "鸩",
		鴇: "鸨",
		鴉: "鸦",
		鴒: "鸰",
		鴕: "鸵",
		鴛: "鸳",
		鴝: "鸲",
		鴞: "鸮",
		鴟: "鸱",
		鴣: "鸪",
		鴦: "鸯",
		鴨: "鸭",
		鴯: "鸸",
		鴰: "鸹",
		鴴: "鸻",
		鴷: "䴕",
		鴻: "鸿",
		鴿: "鸽",
		鵁: "䴔",
		鵂: "鸺",
		鵃: "鸼",
		鵐: "鹀",
		鵑: "鹃",
		鵒: "鹆",
		鵓: "鹁",
		鵜: "鹈",
		鵝: "鹅",
		鵠: "鹄",
		鵡: "鹉",
		鵪: "鹌",
		鵬: "鹏",
		鵮: "鹐",
		鵯: "鹎",
		鵰: "雕",
		鵲: "鹊",
		鵷: "鹓",
		鵾: "鹍",
		鶄: "䴖",
		鶇: "鸫",
		鶉: "鹑",
		鶊: "鹒",
		鶓: "鹋",
		鶖: "鹙",
		鶘: "鹕",
		鶚: "鹗",
		鶡: "鹖",
		鶥: "鹛",
		鶩: "鹜",
		鶪: "䴗",
		鶬: "鸧",
		鶯: "莺",
		鶲: "鹟",
		鶴: "鹤",
		鶹: "鹠",
		鶺: "鹡",
		鶻: "鹘",
		鶼: "鹣",
		鶿: "鹚",
		鷀: "鹚",
		鷁: "鹢",
		鷂: "鹞",
		鷄: "鸡",
		鷉: "䴘",
		鷊: "鹝",
		鷓: "鹧",
		鷖: "鹥",
		鷗: "鸥",
		鷙: "鸷",
		鷚: "鹨",
		鷥: "鸶",
		鷦: "鹪",
		鷫: "鹔",
		鷯: "鹩",
		鷲: "鹫",
		鷳: "鹇",
		鷴: "鹇",
		鷸: "鹬",
		鷹: "鹰",
		鷺: "鹭",
		鷽: "鸴",
		鸂: "㶉",
		鸇: "鹯",
		鸊: "䴙",
		鸌: "鹱",
		鸏: "鹲",
		鸕: "鸬",
		鸘: "鹴",
		鸚: "鹦",
		鸛: "鹳",
		鸝: "鹂",
		鸞: "鸾",
		鹵: "卤",
		鹹: "咸",
		鹺: "鹾",
		鹼: "碱",
		鹽: "盐",
		麗: "丽",
		麥: "麦",
		麩: "麸",
		麪: "面",
		麫: "面",
		麯: "曲",
		麴: "曲",
		麵: "面",
		麼: "么",
		麽: "么",
		黃: "黄",
		黌: "黉",
		點: "点",
		黨: "党",
		黲: "黪",
		黴: "霉",
		黶: "黡",
		黷: "黩",
		黽: "黾",
		黿: "鼋",
		鼂: "鼌",
		鼉: "鼍",
		鼕: "冬",
		鼴: "鼹",
		齊: "齐",
		齋: "斋",
		齎: "赍",
		齏: "齑",
		齒: "齿",
		齔: "龀",
		齕: "龁",
		齗: "龂",
		齙: "龅",
		齜: "龇",
		齟: "龃",
		齠: "龆",
		齡: "龄",
		齣: "出",
		齦: "龈",
		齧: "啮",
		齪: "龊",
		齬: "龉",
		齲: "龋",
		齶: "腭",
		齷: "龌",
		龍: "龙",
		龎: "厐",
		龐: "庞",
		龑: "䶮",
		龔: "龚",
		龕: "龛",
		龜: "龟",
		鿁: "䜤",
		鿓: "鿒"
	};
	var cn2jp = dict_default;
	var jp2cn = Object.fromEntries(Object.entries(cn2jp).flatMap(([k, v]) => v.map((vv) => [vv, k])));
	var t2s = t2s_default;
	function isASCII(text) {
		for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) >= 128) return false;
		return true;
	}
	function toCN(text) {
		let ret = "";
		for (const ch of text) ret += t2s[ch] ?? jp2cn[ch] ?? ch;
		return ret;
	}
	var MAX_COMBINE = 16;
	function toJP(text) {
		let res = [""];
		for (const ch of text) {
			const jp = cn2jp[ch];
			if (jp) {
				if (jp.length > 1 && res.length < MAX_COMBINE) {
					const tmp = [];
					for (const r of res) for (const j of jp) tmp.push(r + j);
					res = tmp;
					continue;
				}
				const rep = jp[0];
				for (let i = 0; i < res.length; i++) res[i] += rep;
			} else for (let i = 0; i < res.length; i++) res[i] += ch;
		}
		return res;
	}
	var nh_popularity_default = {
		bigbreasts: 220570,
		solefemale: 190874,
		solemale: 170994,
		group: 119761,
		anal: 117785,
		nakadashi: 114587,
		lolicon: 109335,
		stockings: 109051,
		blowjob: 100879,
		schoolgirluniform: 88752,
		fullcolor: 79784,
		glasses: 76803,
		shotacon: 65115,
		rape: 62125,
		mosaiccensorship: 61954,
		yaoi: 60374,
		ahegao: 59465,
		bondage: 57149,
		multiworkseries: 52961,
		malesonly: 51799,
		incest: 50772,
		xray: 50005,
		milf: 49679,
		darkskin: 47874,
		paizuri: 43463,
		sextoys: 40678,
		netorare: 39801,
		futanari: 39045,
		doublepenetration: 38434,
		defloration: 37340,
		tankoubon: 37268,
		twintails: 36217,
		ffmthreesome: 35757,
		fullcensorship: 33916,
		swimsuit: 33535,
		yuri: 33443,
		femdom: 33142,
		ponytail: 33079,
		impregnation: 33041,
		collar: 32405,
		bigpenis: 31372,
		dilf: 30333,
		hairy: 29282,
		analintercourse: 29180,
		kemonomimi: 28616,
		cheating: 27093,
		muscle: 25996,
		kissing: 25877,
		pantyhose: 25846,
		bbm: 25174,
		bigass: 24108,
		tentacles: 23538,
		storyarc: 23355,
		sister: 23261,
		masturbation: 23228,
		bikini: 23153,
		mindcontrol: 22989,
		uncensored: 22881,
		sweating: 22469,
		lactation: 21760,
		crossdressing: 21522,
		mindbreak: 21025,
		tomgirl: 20793,
		mmfthreesome: 19615,
		hugebreasts: 19427,
		schoolboyuniform: 19340,
		pregnant: 19124,
		exhibitionism: 18681,
		unusualpupils: 18135,
		femalesonly: 18044,
		teacher: 17733,
		fingering: 17674,
		maid: 17305,
		gloves: 17219,
		handjob: 17070,
		beautymark: 16709,
		mother: 16499,
		condom: 16214,
		genderbender: 15766,
		harem: 15633,
		lingerie: 15597,
		verylonghair: 14960,
		cunnilingus: 14574,
		tail: 14070,
		urination: 13944,
		roughtranslation: 13931,
		horns: 13676,
		footjob: 13659,
		piercing: 12978,
		smallbreasts: 12889,
		catgirl: 12719,
		bigareolae: 12554,
		gag: 12432,
		anthology: 12256,
		demongirl: 12224,
		drugs: 12140,
		prostitution: 12026,
		extraneousads: 11992,
		filming: 11956,
		stomachdeformation: 11831,
		garterbelt: 11626,
		elf: 11518,
		bald: 11512,
		bunnygirl: 11320,
		gyaru: 10945,
		blindfold: 10777,
		blackmail: 10632,
		squirting: 10479,
		scat: 10333,
		tanlines: 10284,
		virginity: 9708,
		kimono: 9672,
		bbw: 9613,
		halo: 9607,
		bukkake: 9597,
		nipplestimulation: 9086,
		nopenetration: 9010,
		rimjob: 9001,
		inflation: 8856,
		soledickgirl: 8762,
		deepthroat: 8689,
		sleeping: 8426,
		eyecoveringbang: 8409,
		monster: 7847,
		bloomers: 7259,
		inseki: 7135,
		leotard: 7082,
		invertednipples: 7014,
		webtoon: 6913,
		breastfeeding: 6840,
		tomboy: 6710,
		businesssuit: 6702,
		corruption: 6605,
		blowjobface: 6544,
		crotchtattoo: 6469,
		monstergirl: 6446,
		thighhighboots: 6433,
		scanmark: 6324,
		wings: 6260,
		schoolswimsuit: 6176,
		slave: 5976,
		strapon: 5931,
		snuff: 5917,
		bodysuit: 5913,
		bestiality: 5911,
		daughter: 5851,
		humiliation: 5659,
		dickgirlondickgirl: 5643,
		magicalgirl: 5589,
		hairbuns: 5583,
		shemale: 5494,
		tallgirl: 5447,
		enema: 5396,
		cervixpenetration: 5335,
		urethrainsertion: 5282,
		guro: 5275,
		foxgirl: 5242,
		breastexpansion: 5169,
		bisexual: 5141,
		shibari: 5138,
		latex: 5079,
		smell: 5042,
		nurse: 5029,
		vtuber: 4992,
		oldman: 4991,
		prostatemassage: 4956,
		dickgirlonmale: 4949,
		drunk: 4912,
		ryona: 4898,
		bignipples: 4838,
		hiddensex: 4820,
		dickgrowth: 4705,
		leglock: 4680,
		hairyarmpits: 4678,
		dickgirlonfemale: 4648,
		replaced: 4645,
		transformation: 4609,
		apron: 4603,
		bdsm: 4540,
		pixiecut: 4527,
		military: 4472,
		chikan: 4307,
		oppailoli: 4269,
		nun: 4254,
		miko: 4211,
		facialhair: 4038,
		spanking: 4036,
		torture: 3965,
		tribadism: 3891,
		tailplug: 3820,
		gokkun: 3817,
		voyeurism: 3796,
		maskedface: 3791,
		incomplete: 3740,
		oyakodon: 3646,
		leash: 3645,
		possession: 3645,
		facesitting: 3612,
		multipleorgasms: 3599,
		exposedclothing: 3575,
		fisting: 3571,
		maleondickgirl: 3556,
		gyaruoh: 3541,
		cosplaying: 3469,
		bikeshorts: 3431,
		chastitybelt: 3378,
		vore: 3368,
		artbook: 3313,
		feminization: 3312,
		oni: 3312,
		eyepatch: 3289,
		birth: 3249,
		blood: 3237,
		nipplefuck: 3162,
		emotionlesssex: 3157,
		smallpenis: 3145,
		twins: 3135,
		bodymodification: 3127,
		tiara: 3080,
		cowgirl: 3019,
		focusanal: 2991,
		soloaction: 2956,
		pegging: 2954,
		hugepenis: 2931,
		tracksuit: 2916,
		cumflation: 2877,
		orgasmdenial: 2872,
		gaping: 2863,
		footlicking: 2854,
		pissdrinking: 2853,
		asphyxiation: 2816,
		hotpants: 2776,
		amputee: 2744,
		smegma: 2739,
		mesuiki: 2725,
		giantess: 2670,
		cbt: 2668,
		chloroform: 2641,
		fullpackagedfutanari: 2632,
		multimouthblowjob: 2632,
		pasties: 2612,
		yandere: 2599,
		fishnets: 2595,
		bodywriting: 2595,
		cousin: 2593,
		sumata: 2592,
		smalldom: 2561,
		largeinsertions: 2557,
		triplepenetration: 2514,
		robot: 2474,
		demon: 2462,
		thickeyebrows: 2460,
		scar: 2442,
		milking: 2426,
		aunt: 2366,
		tallman: 2362,
		brother: 2313,
		farting: 2303,
		mouthmask: 2293,
		moraldegeneration: 2282,
		frottage: 2276,
		swinging: 2251,
		shimaidon: 2215,
		paintednails: 2198,
		unusualteeth: 2194,
		soushuuhen: 2189,
		bigballs: 2189,
		cheerleader: 2187,
		vaginalbirth: 2185,
		bodyswap: 2152,
		onahole: 2146,
		eggs: 2127,
		doublevaginal: 2097,
		clothedfemalenudemale: 2079,
		ballsucking: 2078,
		chinesedress: 2058,
		miniguy: 2053,
		josouseme: 2001,
		witch: 2e3,
		freckles: 1991,
		randoseru: 1971,
		phimosis: 1962,
		gendermorph: 1958,
		petplay: 1949,
		prolapse: 1926,
		publicuse: 1921,
		niece: 1910,
		tickling: 1909,
		crying: 1886,
		bigclit: 1879,
		armpitlicking: 1878,
		labcoat: 1877,
		kunoichi: 1875,
		highheels: 1872,
		orc: 1870,
		doggirl: 1868,
		waitress: 1855,
		nosehook: 1829,
		parasite: 1822,
		clitstimulation: 1818,
		machine: 1817,
		shimapan: 1794,
		eyemask: 1789,
		nipplepiercing: 1784,
		firstpersonperspective: 1761,
		slime: 1758,
		bride: 1752,
		lowlolicon: 1751,
		doubleanal: 1748,
		dog: 1718,
		largetattoo: 1711,
		catboy: 1700,
		kodomodoushi: 1643,
		wolfgirl: 1613,
		goblin: 1613,
		forcedexposure: 1608,
		diaper: 1608,
		widow: 1598,
		christmas: 1595,
		dickgirlsonly: 1583,
		watermarked: 1575,
		tutor: 1554,
		netorase: 1527,
		longtongue: 1519,
		schoolgymuniform: 1518,
		sunglasses: 1498,
		aigenerated: 1470,
		angel: 1468,
		ghost: 1461,
		stuckinwall: 1460,
		multiplepaizuri: 1456,
		futanarization: 1455,
		shavedhead: 1441,
		compilation: 1426,
		armpitsex: 1407,
		dominationloss: 1401,
		corset: 1383,
		vomit: 1373,
		humanpet: 1362,
		coprophagia: 1355,
		allthewaythrough: 1337,
		timestop: 1336,
		unbirth: 1335,
		clothedpaizuri: 1330,
		ageregression: 1313,
		variantset: 1312,
		skinsuit: 1309,
		nudityonly: 1300,
		sundress: 1290,
		selfcest: 1286,
		insect: 1277,
		vampire: 1277,
		focusblowjob: 1274,
		drillhair: 1247,
		mmmthreesome: 1246,
		ageprogression: 1235,
		coach: 1188,
		detachedsleeves: 1165,
		mesugaki: 1164,
		minigirl: 1153,
		bandages: 1139,
		fundoshi: 1134,
		metalarmor: 1126,
		closedeyes: 1121,
		kodomoonly: 1099,
		heterochromia: 1095,
		makeup: 1088,
		darknipples: 1062,
		genderchange: 1053,
		policewoman: 1045,
		livingclothes: 1036,
		goudoushi: 1014,
		clothedmalenudefemale: 1011,
		darksclera: 995,
		omorashi: 972,
		doubleblowjob: 971,
		lowscat: 963,
		bunnyboy: 953,
		dougi: 928,
		wrestling: 926,
		pubicstubble: 913,
		shrinking: 913,
		harness: 910,
		focuspaizuri: 905,
		lowshotacon: 900,
		assjob: 892,
		horse: 874,
		slimegirl: 872,
		electricshocks: 848,
		ttfthreesome: 845,
		humancattle: 833,
		stirruplegwear: 832,
		oil: 822,
		mechagirl: 809,
		artistcg: 800,
		cumswap: 800,
		petrification: 788,
		catfight: 781,
		underwater: 779,
		snakegirl: 771,
		gymshorts: 770,
		gothiclolita: 762,
		gangrape: 756,
		comic: 747,
		clitgrowth: 738,
		outoforder: 732,
		brainfuck: 721,
		zombie: 721,
		penisenlargement: 714,
		multiplepenises: 709,
		fairy: 707,
		nonh: 706,
		layercake: 704,
		mtfthreesome: 688,
		biglips: 681,
		whip: 680,
		wetclothes: 677,
		saliva: 674,
		necrophilia: 671,
		missingcover: 669,
		fffthreesome: 665,
		wormhole: 663,
		pig: 656,
		midget: 654,
		fftthreesome: 653,
		clone: 651,
		autofellatio: 641,
		pillory: 627,
		father: 621,
		absorption: 617,
		poorgrammar: 616,
		multipanelsequence: 606,
		vaginalsticker: 574,
		weightgain: 549,
		giganticbreasts: 539,
		lowbestiality: 539,
		manga: 530,
		tube: 530,
		unusualinsertions: 529,
		sharedsenses: 528,
		crown: 527,
		invisible: 527,
		fullbodytattoo: 524,
		tights: 513,
		bodystocking: 512,
		infantilism: 508,
		growth: 505,
		personalityexcretion: 504,
		lizardgirl: 503,
		woodenhorse: 503,
		transparentclothing: 499,
		gloryhole: 497,
		tailjob: 494,
		cannibalism: 490,
		dogboy: 480,
		butler: 468,
		sketchlines: 467,
		mermaid: 466,
		defaced: 463,
		forniphilia: 463,
		oldlady: 461,
		trampling: 456,
		onsen: 451,
		classroom: 448,
		clamp: 447,
		smoking: 442,
		burping: 437,
		anorexic: 436,
		cuntboy: 435,
		hairjob: 430,
		wolfboy: 426,
		policeman: 422,
		ttmthreesome: 416,
		foxboy: 416,
		dolljoints: 412,
		genitalpiercing: 408,
		speculum: 405,
		alien: 382,
		grandmother: 382,
		cervixprolapse: 378,
		bigmuscles: 375,
		mousegirl: 372,
		dragon: 369,
		tablemasturbation: 365,
		analbirth: 362,
		apparelbukkake: 357,
		redraw: 354,
		navelfuck: 354,
		pigman: 353,
		internalurination: 350,
		syringe: 323,
		roughgrammar: 322,
		bodypainting: 320,
		insectgirl: 316,
		pantyjob: 311,
		nippleexpansion: 305,
		dicknipples: 304,
		squidgirl: 290,
		plantgirl: 290,
		ballsexpansion: 275,
		horsegirl: 273,
		beach: 270,
		centaur: 266,
		buttplug: 265,
		doujinshi: 263,
		multiplebreasts: 259,
		aliengirl: 257,
		spidergirl: 256,
		octopus: 252,
		cashier: 252,
		ninja: 251,
		bigvagina: 250,
		priest: 243,
		snake: 240,
		bathingroom: 238,
		hood: 238,
		harpy: 237,
		earfuck: 235,
		corpse: 234,
		horsecock: 226,
		stewardess: 226,
		vacbed: 224,
		minotaur: 222,
		assexpansion: 221,
		worm: 215,
		ballcaressing: 214,
		phonesex: 214,
		raccoongirl: 214,
		giant: 214,
		scrotallingerie: 213,
		objectinsertiononly: 207,
		sheepgirl: 205,
		ssbbw: 203,
		multiplearms: 201,
		blind: 196,
		cumbath: 192,
		cowman: 187,
		bandaid: 186,
		multipletails: 184,
		menstruation: 180,
		uncle: 176,
		autopaizuri: 173,
		tttthreesome: 172,
		stretching: 172,
		sockjob: 169,
		waiter: 168,
		multiplehandjob: 167,
		monkey: 166,
		headphones: 164,
		kindergartenuniform: 164,
		piggirl: 164,
		hanging: 159,
		multiplepairings: 158,
		lipstickmark: 156,
		imageset: 156,
		mmtthreesome: 155,
		granddaughter: 152,
		slug: 147,
		nipplebirth: 147,
		monoeye: 144,
		wolf: 142,
		nosefuck: 142,
		kappa: 140,
		triplevaginal: 136,
		racequeen: 136,
		tailphagia: 135,
		nijisanji: 129,
		nudism: 128,
		bitemark: 125,
		confinement: 125,
		cockring: 125,
		analphagia: 124,
		animated: 121,
		lowincest: 120,
		humanonfurry: 116,
		pirate: 116,
		sharkgirl: 113,
		frog: 111,
		analprolapse: 110,
		horseboy: 109,
		infirmary: 108,
		eyepenetration: 108,
		dismantling: 101,
		abortion: 101,
		albino: 100,
		multiplestraddling: 100,
		widower: 100,
		miyamotosmoke: 100,
		solepussyboy: 98,
		poledancing: 95,
		cumineye: 94,
		merman: 94,
		balljob: 93,
		squirrelgirl: 93,
		footinsertion: 93,
		bull: 93,
		prehensilehair: 92,
		ponygirl: 91,
		tripleanal: 89,
		headless: 88
	};
	function normalize(name) {
		return name.toLowerCase().replace(/[-_ ]/g, "");
	}
	var popularityMap = new Map(Object.entries(nh_popularity_default));
	function getNhCount(tagRaw) {
		return popularityMap.get(normalize(tagRaw));
	}
	var TAG_DB_MIRRORS = {
		jsdelivr: {
			label: "jsDelivr",
			url: "https://cdn.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.html.json"
		},
		fastly: {
			label: "jsDelivr (Fastly)",
			url: "https://fastly.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.html.json"
		},
		gcore: {
			label: "jsDelivr (Gcore)",
			url: "https://gcore.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.html.json"
		},
		github: {
			label: "GitHub Raw",
			url: "https://raw.githubusercontent.com/EhTagTranslation/DatabaseReleases/master/db.html.json"
		}
	};
	var CACHE_KEY = "eqt_tag_db";
	var CACHE_TS_KEY = "eqt_tag_db_ts";
	var entries = null;
	var _domParser = new DOMParser();
	function stripHtml(html) {
		return _domParser.parseFromString(html, "text/html").body.textContent ?? "";
	}
	function removeEmojiAndImages(html) {
		return stripHtml(html.replace(/<img[^>]*>/gi, "")).replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]/gu, "").trim();
	}
	function addSearchFields(stored) {
		const rawLow = stored.raw.toLowerCase();
		const words = rawLow.split(" ");
		return {
			...stored,
			rawLow,
			nameLow: stored.name.toLowerCase(),
			rawWords: words.length > 1 ? words.slice(1) : null
		};
	}
	function buildIndex(db) {
		const result = [];
		for (const section of db.data) {
			const ns = section.namespace;
			if (ns === "rows") continue;
			for (const [raw, info] of Object.entries(section.data)) {
				const name = removeEmojiAndImages(info.name);
				result.push(addSearchFields({
					fullTag: `${ns}:${raw}`,
					ns,
					raw,
					name
				}));
			}
		}
		return result;
	}
	async function fetchDb(mirror = "jsdelivr") {
		const url = TAG_DB_MIRRORS[mirror]?.url ?? TAG_DB_MIRRORS.jsdelivr.url;
		if (hasGMXHR) return new Promise((resolve, reject) => {
			_GM_xmlhttpRequest({
				method: "GET",
				url,
				onload: (res) => {
					if (res.status === 200) resolve(res.responseText);
					else reject(new Error(`HTTP ${res.status}`));
				},
				onerror: () => reject(new Error("Network error"))
			});
		});
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.text();
	}
	async function loadTagDb(opts = {}) {
		if (entries) return entries;
		const ttl = (opts.ttlDays ?? 7) * 24 * 60 * 60 * 1e3;
		const cachedTs = Number(await cacheGet(CACHE_TS_KEY)) || 0;
		if (Date.now() - cachedTs < ttl) {
			const cached = await cacheGet(CACHE_KEY);
			if (cached) {
				entries = JSON.parse(cached).map(addSearchFields);
				return entries;
			}
		}
		const raw = await fetchDb(opts.mirror);
		entries = buildIndex(JSON.parse(raw));
		const stored = entries.map(({ fullTag, ns, raw: r, name }) => ({
			fullTag,
			ns,
			raw: r,
			name
		}));
		await cacheSet(CACHE_KEY, JSON.stringify(stored));
		await cacheSet(CACHE_TS_KEY, String(Date.now()));
		return entries;
	}
	async function refreshTagDb(opts = {}) {
		entries = null;
		await cacheSet(CACHE_TS_KEY, "0");
		await loadTagDb(opts);
	}
	var NH_NAMESPACES = new Set([
		"female",
		"male",
		"mixed",
		"other"
	]);
	var DEFAULT_NS_ORDER = [
		"female",
		"male",
		"other",
		"mixed",
		"location",
		"parody",
		"character",
		"artist",
		"cosplayer",
		"group",
		"language",
		"reclass",
		"temp"
	];
	var ALL_NAMESPACES = DEFAULT_NS_ORDER;
	var NS_ALIASES = {
		r: "reclass",
		g: "group",
		a: "artist",
		cos: "cosplayer",
		p: "parody",
		c: "character",
		f: "female",
		m: "male",
		x: "mixed",
		l: "language",
		o: "other",
		loc: "location"
	};
	function getMatchTier(entry, search, searchIsAscii) {
		if (entry.rawLow.startsWith(search) || entry.nameLow.startsWith(search)) return 0;
		if (entry.rawWords !== null) {
			for (const word of entry.rawWords) if (word.startsWith(search)) return 1;
		}
		if (!searchIsAscii && entry.nameLow.includes(search)) return 1;
		return null;
	}
	function searchTags(query, opts = {}) {
		if (!entries || !query.trim()) return [];
		const { useNhWeight = false, nsOrder = DEFAULT_NS_ORDER } = opts;
		const nsTierMap = new Map();
		for (let i = 0; i < nsOrder.length; i++) nsTierMap.set(nsOrder[i], i);
		let q = query.toLowerCase().normalize().trim();
		let pool = entries;
		const colIdx = q.indexOf(":");
		if (colIdx >= 1) {
			const prefix = q.slice(0, colIdx);
			const resolvedNs = NS_ALIASES[prefix] ?? prefix;
			if (nsTierMap.has(resolvedNs)) {
				pool = pool.filter((e) => e.ns === resolvedNs);
				q = q.slice(colIdx + 1);
			}
		}
		if (q.startsWith("\"")) q = q.slice(1);
		if (!q) return pool;
		const qIsAscii = isASCII(q);
		let terms = [q];
		if (!qIsAscii) {
			terms.push(toCN(q), ...toJP(q));
			terms = [...new Set(terms)];
		}
		const ranked = [];
		for (const entry of pool) {
			const nsTier = nsTierMap.get(entry.ns);
			if (nsTier === void 0) continue;
			let matchTier = null;
			for (const term of terms) {
				matchTier = getMatchTier(entry, term, qIsAscii);
				if (matchTier !== null) break;
			}
			if (matchTier === null) continue;
			ranked.push({
				entry,
				matchTier,
				nhCount: useNhWeight && NH_NAMESPACES.has(entry.ns) ? getNhCount(entry.raw) ?? 0 : 0,
				nsTier
			});
		}
		ranked.sort((a, b) => a.matchTier - b.matchTier || b.nhCount - a.nhCount || a.nsTier - b.nsTier || a.entry.raw.length - b.entry.raw.length);
		return ranked.map((r) => r.entry);
	}
	var TAG_STYLE_PRESETS = [
		{
			id: "flat",
			className: "",
			labelKey: "settings.tagStyleFlat"
		},
		{
			id: "3d-border",
			className: "eqt-tag-style-3d",
			labelKey: "settings.tagStyle3dBorder"
		},
		{
			id: "offset-shadow",
			className: "eqt-tag-style-offset",
			labelKey: "settings.tagStyleOffsetShadow"
		},
		{
			id: "pushable",
			className: "eqt-tag-style-pushable",
			labelKey: "settings.tagStylePushable"
		}
	];
	var PRESETS_BY_ID = new Map(TAG_STYLE_PRESETS.map((p) => [p.id, p]));
	var currentTagStyleClass = computed(() => PRESETS_BY_ID.get(tagStylePreset.value)?.className ?? "");
	var KEYS = {
		profiles: "eqt_profiles",
		corrupted: "eqt_profiles_corrupted",
		settings: "eqt_settings"
	};
	var INITIAL_SETTINGS = {
		useNhWeight: true,
		nsOrder: [...DEFAULT_NS_ORDER],
		disabledNs: [],
		fontFamily: "",
		fontWeight: "",
		dblClickLeft: "search",
		dblClickRight: "searchNewTab",
		newTabActive: true,
		nsFormat: "long",
		defaultExactMatch: true,
		tagDbMirror: "jsdelivr",
		tagDbTtlDays: 7,
		tagStylePreset: "flat"
	};
	var refs = Object.fromEntries(Object.entries(INITIAL_SETTINGS).map(([k, v]) => [k, ref(v)]));
	var useNhWeight = refs.useNhWeight;
	var nsOrder = refs.nsOrder;
	var disabledNs = refs.disabledNs;
	var fontFamily = refs.fontFamily;
	var fontWeight = refs.fontWeight;
	var dblClickLeft = refs.dblClickLeft;
	var dblClickRight = refs.dblClickRight;
	var newTabActive = refs.newTabActive;
	var nsFormat = refs.nsFormat;
	var defaultExactMatch = refs.defaultExactMatch;
	var tagDbMirror = refs.tagDbMirror;
	var tagDbTtlDays = refs.tagDbTtlDays;
	var tagStylePreset = refs.tagStylePreset;
	function loadAllSettings(persisted) {
		for (const key of Object.keys(INITIAL_SETTINGS)) if (key in persisted) refs[key].value = persisted[key];
	}
	function serializeAllSettings() {
		return {
			...Object.fromEntries(Object.entries(refs).map(([k, r]) => [k, r.value])),
			locale: locale.value
		};
	}
	var DEFAULT_LINE_DEFS = [
		{
			kind: "separator",
			labelKey: "default.general",
			style: { textAlign: "left" }
		},
		{
			kind: "buttons",
			buttons: [
				{
					kind: "tag",
					tags: ["language:chinese$"],
					labelKey: "default.chinese"
				},
				{
					kind: "tag",
					tags: ["language:english$"],
					labelKey: "default.english"
				},
				{
					kind: "tag",
					tags: ["language:korean$"],
					labelKey: "default.korean"
				},
				{
					kind: "tag",
					tags: [
						"-language:english$",
						"-language:chinese$",
						"-language:korean$"
					],
					labelKey: "default.japanese",
					disabledModes: ["or", "exclude"]
				}
			]
		},
		{
			kind: "buttons",
			buttons: [
				{
					kind: "tag",
					tags: ["other:\"full color$\""],
					labelKey: "default.fullColor"
				},
				{
					kind: "tag",
					tags: ["other:uncensored$"],
					labelKey: "default.uncensored"
				},
				{
					kind: "tag",
					tags: ["language:translated$"],
					labelKey: "default.translated"
				},
				{
					kind: "tag",
					tags: ["language:speechless$"],
					labelKey: "default.speechless"
				},
				{
					kind: "tag",
					tags: ["-other:\"ai generated$\""],
					labelKey: "default.excludeAI",
					disabledModes: ["or", "exclude"]
				},
				{
					kind: "tag",
					tags: ["-other:\"rough translation$\""],
					labelKey: "default.excludeRoughTL",
					disabledModes: ["or", "exclude"]
				}
			]
		},
		{
			kind: "buttons",
			buttons: [
				{
					kind: "url",
					url: "?f_cats=0&f_search=other%3A%22how+to%24%22",
					labelKey: "default.howto"
				},
				{
					kind: "url",
					url: "?f_cats=0&f_search=o%3Aartbook%24",
					labelKey: "default.artbook"
				},
				{
					kind: "url",
					url: "?f_cats=991",
					labelKey: "default.imageset"
				},
				{
					kind: "url",
					url: "?f_cats=1019&f_search=o%3Atankoubon%24",
					labelKey: "default.tankoubon"
				},
				{
					kind: "url",
					url: "?f_cats=1019&f_search=o%3Aanthology%24",
					labelKey: "default.anthology"
				}
			]
		},
		{
			kind: "separator",
			style: { textAlign: "left" }
		},
		{
			kind: "buttons",
			buttons: []
		}
	];
	function getDefaultLines() {
		return DEFAULT_LINE_DEFS.map((def) => {
			if (def.kind === "separator") return {
				kind: "separator",
				...def.labelKey ? { label: t(def.labelKey) } : {},
				...def.style ? { style: def.style } : {}
			};
			return {
				kind: "buttons",
				buttons: def.buttons.map((b) => b.kind === "tag" ? {
					kind: "tag",
					tags: b.tags,
					label: t(b.labelKey),
					...b.disabledModes ? { disabledModes: b.disabledModes } : {}
				} : {
					kind: "url",
					url: b.url,
					label: t(b.labelKey)
				})
			};
		});
	}
	function splitMultiTagLegacy(tag) {
		return tag.split(",").map((s) => s.trim()).filter(Boolean);
	}
	function migrateLegacyButton(x) {
		if (!x || typeof x !== "object") return null;
		const o = x;
		if (o.kind === "tag" || o.kind === "url") return o;
		if (typeof o.url === "string" && o.url !== "") return {
			kind: "url",
			url: o.url,
			...o.label ? { label: o.label } : {},
			...o.color ? { color: o.color } : {}
		};
		if (typeof o.tag === "string" && o.tag !== "") return {
			kind: "tag",
			tags: splitMultiTagLegacy(o.tag),
			...o.label ? { label: o.label } : {},
			...o.color ? { color: o.color } : {},
			...o.disabledModes ? { disabledModes: o.disabledModes } : {}
		};
		return null;
	}
	function migrateLegacyLine(x) {
		if (!x || typeof x !== "object") return null;
		const o = x;
		if (o.kind === "buttons" || o.kind === "separator") return o;
		if (o.separator && typeof o.separator === "object") {
			const sep = o.separator;
			const style = {};
			if (typeof sep.style === "string") style.line = sep.style;
			if (typeof sep.textAlign === "string") style.textAlign = sep.textAlign;
			if (typeof sep.textSize === "number") style.textSize = sep.textSize;
			if (typeof sep.lineThickness === "number") style.lineThickness = sep.lineThickness;
			if (sep.preset === "header") style.linePosition = "bottom";
			return {
				kind: "separator",
				...sep.label ? { label: sep.label } : {},
				...Object.keys(style).length ? { style } : {},
				...o.color ? { color: o.color } : {}
			};
		}
		if (Array.isArray(o.tags)) return {
			kind: "buttons",
			buttons: o.tags.map(migrateLegacyButton).filter((b) => b !== null),
			...o.color ? { color: o.color } : {}
		};
		return null;
	}
	function isValidButton(x) {
		if (!x || typeof x !== "object") return false;
		const o = x;
		if (o.kind === "tag") return Array.isArray(o.tags) && o.tags.every((t) => typeof t === "string" && t !== "");
		if (o.kind === "url") return typeof o.url === "string" && o.url !== "";
		return false;
	}
	function isValidLine(x) {
		if (!x || typeof x !== "object") return false;
		const o = x;
		if (o.kind === "buttons") return Array.isArray(o.buttons) && o.buttons.every(isValidButton);
		if (o.kind === "separator") return true;
		return false;
	}
	function isValidProfile(x) {
		if (!x || typeof x !== "object") return false;
		const o = x;
		return typeof o.name === "string" && Array.isArray(o.lines) && o.lines.every(isValidLine);
	}
	function isValidProfilesData(x) {
		if (!x || typeof x !== "object") return false;
		const o = x;
		return typeof o.active === "number" && Array.isArray(o.profiles) && o.profiles.every(isValidProfile) && (o.deleted === void 0 || Array.isArray(o.deleted) && o.deleted.every(isValidProfile));
	}
	function migrateProfile(p) {
		if (!p || typeof p !== "object" || typeof p.name !== "string") return null;
		const rawLines = Array.isArray(p.lines) ? p.lines : Array.isArray(p.tagLines) ? p.tagLines : null;
		if (!rawLines) return null;
		const lines = rawLines.map(migrateLegacyLine).filter((l) => l !== null && isValidLine(l));
		return {
			name: p.name,
			lines,
			...p.isDefault ? { isDefault: true } : {}
		};
	}
	function migrateProfilesData(data) {
		if (!data || typeof data !== "object" || typeof data.active !== "number" || !Array.isArray(data.profiles)) return null;
		const profiles = data.profiles.map(migrateProfile).filter((p) => p !== null);
		if (!profiles.length) return null;
		const deleted = Array.isArray(data.deleted) ? data.deleted.map(migrateProfile).filter((p) => p !== null) : void 0;
		return {
			active: data.active,
			profiles,
			...deleted ? { deleted } : {}
		};
	}
	function backupCorrupted(raw, reason) {
		corruptedProfiles.push({
			raw,
			savedAt: Date.now(),
			reason
		});
		console.error(`[eqt] profiles parse failed (${reason}). Preserved in corrupted list (see SettingsPopup → 損壞的資料).`);
	}
	var profiles = reactive([]);
	var deletedProfiles = reactive([]);
	var corruptedProfiles = reactive([]);
	var activeProfileIdx = ref(0);
	var lines = reactive([]);
	async function loadStore() {
		const [savedProfiles, savedSettings, savedCorrupted] = await Promise.all([
			cacheGet(KEYS.profiles),
			cacheGet(KEYS.settings),
			cacheGet(KEYS.corrupted)
		]);
		if (savedCorrupted) try {
			const arr = JSON.parse(savedCorrupted);
			if (Array.isArray(arr)) {
				const valid = arr.filter((c) => !!c && typeof c === "object" && typeof c.raw === "string" && typeof c.savedAt === "number" && typeof c.reason === "string");
				corruptedProfiles.splice(0, corruptedProfiles.length, ...valid);
			}
		} catch {}
		let loaded = false;
		if (savedProfiles) try {
			const raw = JSON.parse(savedProfiles);
			const data = isValidProfilesData(raw) ? raw : migrateProfilesData(raw);
			if (!data) throw new Error("schema mismatch");
			profiles.splice(0, profiles.length, ...data.profiles);
			deletedProfiles.splice(0, deletedProfiles.length, ...data.deleted ?? []);
			activeProfileIdx.value = Math.min(Math.max(data.active, 0), profiles.length - 1);
			loaded = true;
		} catch (err) {
			backupCorrupted(savedProfiles, err.message);
		}
		if (!loaded) {
			profiles.splice(0, profiles.length, {
				name: t("default.profileName"),
				lines: getDefaultLines(),
				isDefault: true
			});
			activeProfileIdx.value = 0;
		}
		lines.splice(0, lines.length, ...profiles[activeProfileIdx.value].lines);
		const parsed = savedSettings ? JSON.parse(savedSettings) : {};
		loadAllSettings(parsed);
		if (!PRESETS_BY_ID.has(tagStylePreset.value)) tagStylePreset.value = "flat";
		setLocale(parsed.locale ? parsed.locale : detectLocale());
	}
	var localeChanging = false;
	function syncLinesToActiveProfile() {
		const p = profiles[activeProfileIdx.value];
		p.lines = JSON.parse(JSON.stringify(lines));
		if (p.isDefault && !localeChanging) p.isDefault = false;
	}
	function switchProfile(idx) {
		if (idx < 0 || idx >= profiles.length || idx === activeProfileIdx.value) return;
		syncLinesToActiveProfile();
		activeProfileIdx.value = idx;
		lines.splice(0, lines.length, ...profiles[idx].lines);
	}
	function renameProfile(idx, name) {
		profiles[idx].name = name;
		saveProfiles();
	}
	function createProfile(name) {
		syncLinesToActiveProfile();
		const lineCount = lines.length;
		const emptyLines = () => Array.from({ length: lineCount }, () => ({
			kind: "buttons",
			buttons: []
		}));
		profiles.push({
			name,
			lines: emptyLines()
		});
		activeProfileIdx.value = profiles.length - 1;
		lines.splice(0, lines.length, ...emptyLines());
	}
	function deleteProfile(idx) {
		if (profiles.length <= 1) return;
		syncLinesToActiveProfile();
		const [removed] = profiles.splice(idx, 1);
		deletedProfiles.push(removed);
		const active = activeProfileIdx.value;
		const newIdx = idx < active ? active - 1 : Math.min(idx, profiles.length - 1);
		activeProfileIdx.value = newIdx;
		lines.splice(0, lines.length, ...profiles[newIdx].lines);
	}
	function restoreProfile(idx) {
		const [restored] = deletedProfiles.splice(idx, 1);
		profiles.push(restored);
	}
	function purgeProfile(idx) {
		deletedProfiles.splice(idx, 1);
	}
	function purgeCorrupted(idx) {
		corruptedProfiles.splice(idx, 1);
	}
	function reorderProfiles(fromIdx, toIdx) {
		if (fromIdx === toIdx) return;
		syncLinesToActiveProfile();
		const [moved] = profiles.splice(fromIdx, 1);
		profiles.splice(toIdx, 0, moved);
		const active = activeProfileIdx.value;
		if (active === fromIdx) activeProfileIdx.value = toIdx;
		else if (fromIdx < active && toIdx >= active) activeProfileIdx.value = active - 1;
		else if (fromIdx > active && toIdx <= active) activeProfileIdx.value = active + 1;
		saveProfiles();
	}
	function updateProfileLines(idx, newLines) {
		profiles[idx].lines = newLines;
		if (profiles[idx].isDefault) profiles[idx].isDefault = false;
		if (idx === activeProfileIdx.value) lines.splice(0, lines.length, ...newLines);
		else saveProfiles();
	}
	function saveProfiles() {
		syncLinesToActiveProfile();
		cacheSet(KEYS.profiles, JSON.stringify({
			active: activeProfileIdx.value,
			profiles: profiles.map((p) => ({
				name: p.name,
				lines: p.lines,
				...p.isDefault ? { isDefault: true } : {}
			})),
			deleted: deletedProfiles.map((p) => ({
				name: p.name,
				lines: p.lines
			}))
		}));
	}
	function saveSettings() {
		cacheSet(KEYS.settings, JSON.stringify(serializeAllSettings()));
	}
	function saveCorrupted() {
		cacheSet(KEYS.corrupted, JSON.stringify(corruptedProfiles));
	}
	function startAutoSave() {
		watch([lines, deletedProfiles], saveProfiles);
		watch(corruptedProfiles, saveCorrupted, { deep: true });
		watch([...Object.values(refs), locale], saveSettings, { deep: true });
		watch(locale, async () => {
			localeChanging = true;
			for (const p of profiles) {
				if (!p.isDefault) continue;
				p.name = t("default.profileName");
				p.lines = getDefaultLines();
				if (activeProfileIdx.value === profiles.indexOf(p)) lines.splice(0, lines.length, ...p.lines);
			}
			await nextTick();
			localeChanging = false;
		});
	}
	function hideDragImage(dataTransfer) {
		const img = new Image();
		dataTransfer.setDragImage(img, 0, 0);
	}
	var baseDragOptions = {
		animation: 150,
		forceFallback: true,
		setData: hideDragImage
	};
	var _hoisted_1$5 = { class: "eqt-tag-bar__lines" };
	var _hoisted_2$5 = { class: "eqt-tag-bar__profile-row" };
	var _hoisted_3$5 = { class: "eqt-tag-bar__info" };
	var _hoisted_4$5 = { class: "eqt-tag-bar__info-text" };
	var _hoisted_5$5 = ["disabled"];
	var _hoisted_6$4 = {
		key: 1,
		class: "eqt-tag-bar__profile-split"
	};
	var _hoisted_7$4 = ["tabindex", "disabled"];
	var _hoisted_8$4 = ["disabled"];
	var _hoisted_9$4 = { class: "eqt-tag-bar__line-wrap" };
	var _hoisted_10$4 = ["title"];
	var _hoisted_11$3 = {
		key: 1,
		class: "eqt-tag-bar__separator-label"
	};
	var _hoisted_12$3 = ["href"];
	var _hoisted_13$3 = ["onClick"];
	var _hoisted_14$2 = ["onClick", "onContextmenu"];
	var _hoisted_15$2 = ["title", "onClick"];
	var _hoisted_16$2 = { class: "eqt-tag-bar__bottom-row" };
	var _hoisted_17$1 = {
		key: 0,
		class: "eqt-tag-bar__line-add"
	};
	var _hoisted_18$1 = { class: "eqt-tag-bar__controls" };
	var TagBar_default = defineComponent({
		__name: "TagBar",
		props: {
			searchText: {},
			profileName: {},
			profileIdx: {},
			profileCount: {},
			prevProfileName: {},
			nextProfileName: {}
		},
		emits: [
			"update:searchText",
			"configure",
			"add",
			"addUrl",
			"settings",
			"prevProfile",
			"nextProfile",
			"renameProfile",
			"createProfile",
			"deleteProfile",
			"search"
		],
		setup(__props, { emit: __emit }) {
			const ACTION_KEYS = {
				search: "tagbar.search",
				searchNewTab: "tagbar.searchNewTab",
				clearSearch: "tagbar.clearSearch",
				none: "tagbar.none"
			};
			const STATE_CLASS = {
				[TagState.Include]: "eqt-tag-bar__btn--include",
				[TagState.Or]: "eqt-tag-bar__btn--or",
				[TagState.Exclude]: "eqt-tag-bar__btn--exclude",
				[TagState.Off]: null
			};
			const props = __props;
			const emit = __emit;
			const editing = ref(false);
			const controlsEl = ref(null);
			const controlsWidth = ref(null);
			useResizeObserver(controlsEl, ([entry]) => {
				controlsWidth.value = entry.contentRect.width;
			});
			function captureControlsEl(el, li) {
				if (li === 0) controlsEl.value = el ?? null;
			}
			let lastRightClickTime = 0;
			function isInteractive(e) {
				return e.target.closest("button, a, input");
			}
			function onBarDblClick(e) {
				if (editing.value || isInteractive(e)) return;
				e.preventDefault();
				e.stopPropagation();
				window.getSelection()?.removeAllRanges();
				execDblClickAction(dblClickLeft.value);
			}
			function onBarContextMenu(e) {
				if (editing.value || isInteractive(e)) return;
				e.preventDefault();
				const now = Date.now();
				if (now - lastRightClickTime < 500) {
					execDblClickAction(dblClickRight.value);
					lastRightClickTime = 0;
				} else lastRightClickTime = now;
			}
			function execDblClickAction(action) {
				if (action === "none") return;
				if (action === "clearSearch") emit("update:searchText", "");
				else emit("search", action);
			}
			const onCreationPage = ref(false);
			const renamingProfile = ref(false);
			const renameValue = ref("");
			const renameInput = ref(null);
			function onPrev() {
				if (onCreationPage.value) onCreationPage.value = false;
				else emit("prevProfile");
			}
			function onNext() {
				if (props.profileIdx === props.profileCount - 1) onCreationPage.value = true;
				else emit("nextProfile");
			}
			function startRenameOrCreate() {
				renameValue.value = onCreationPage.value ? "" : props.profileName;
				renamingProfile.value = true;
				nextTick(() => renameInput.value?.select());
			}
			function finishRenameOrCreate() {
				const trimmed = renameValue.value.trim();
				if (onCreationPage.value) {
					if (trimmed) {
						emit("createProfile", trimmed);
						onCreationPage.value = false;
					}
				} else if (trimmed && trimmed !== props.profileName) emit("renameProfile", trimmed);
				renamingProfile.value = false;
			}
			let tagDragging = false;
			function onLineChange(evt) {
				if (evt.moved) {
					const [line] = lines.splice(evt.moved.oldIndex, 1);
					lines.splice(evt.moved.newIndex, 0, line);
				}
			}
			function onTagChange(lineIdx, evt) {
				const line = lines[lineIdx];
				if (line.kind !== "buttons") return;
				if (evt.added) line.buttons.splice(evt.added.newIndex, 0, evt.added.element);
				if (evt.removed) line.buttons.splice(evt.removed.oldIndex, 1);
				if (evt.moved) {
					const [item] = line.buttons.splice(evt.moved.oldIndex, 1);
					line.buttons.splice(evt.moved.newIndex, 0, item);
				}
			}
			function onTagStart() {
				tagDragging = true;
			}
			function onTagEnd() {
				setTimeout(() => {
					tagDragging = false;
				}, 0);
			}
			function onAddButtonLine() {
				lines.push({
					kind: "buttons",
					buttons: []
				});
			}
			function onAddSeparatorLine() {
				lines.push({ kind: "separator" });
			}
			function isLineEmpty(line) {
				if (line.kind === "buttons") return line.buttons.length === 0;
				return !line.label && (!line.style || Object.keys(line.style).length === 0);
			}
			function onDeleteLine(li) {
				if (!isLineEmpty(lines[li]) && !confirm(t("tagbar.deleteLineConfirm"))) return;
				lines.splice(li, 1);
			}
			function onConfigure(li, ti) {
				if (tagDragging) return;
				emit("configure", li, ti);
			}
			function buttonKey(b) {
				return b.kind === "tag" ? b.tags.join(",") : b.url;
			}
			function onUpdateLine(li, newLine) {
				lines[li] = newLine;
			}
			const lineDragOptions = {
				...baseDragOptions,
				ghostClass: "eqt-tag-bar__line-wrap--ghost"
			};
			const tagDragOptions = {
				...baseDragOptions,
				group: "eqt-tags",
				ghostClass: "eqt-tag-bar__btn--ghost",
				chosenClass: "eqt-tag-bar__btn--chosen",
				dragClass: "eqt-tag-bar__btn--drag"
			};
			const tokenSet = computed(() => new Set(tokenize(props.searchText)));
			function getState$1(b) {
				return getState(b.tags, tokenSet.value);
			}
			function onLeftClick(b) {
				const state = getState$1(b);
				const cleaned = removeTag(props.searchText, b.tags);
				emit("update:searchText", state === TagState.Off ? addTag(cleaned, b.tags, TagState.Include) : cleaned);
			}
			function onRightClick(event, b) {
				event.preventDefault();
				const state = getState$1(b);
				const next = getNextRightClickState(b.tags, b.disabledModes, state);
				if (next === null) return;
				const cleaned = removeTag(props.searchText, b.tags);
				emit("update:searchText", next === TagState.Off ? cleaned : addTag(cleaned, b.tags, next));
			}
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("div", {
					class: normalizeClass(["eqt-tag-bar", unref(currentTagStyleClass)]),
					style: normalizeStyle(controlsWidth.value !== null ? { "--eqt-controls-w": controlsWidth.value + "px" } : void 0),
					onDblclick: onBarDblClick,
					onContextmenu: onBarContextMenu
				}, [createBaseVNode("div", _hoisted_1$5, [
					createBaseVNode("div", _hoisted_2$5, [
						createBaseVNode("span", _hoisted_3$5, [createVNode(unref(Info), { size: 16 }), createBaseVNode("span", _hoisted_4$5, toDisplayString(unref(t)("tagbar.infoTooltip", {
							left: unref(t)(ACTION_KEYS[unref(dblClickLeft)]),
							right: unref(t)(ACTION_KEYS[unref(dblClickRight)])
						})), 1)]),
						createBaseVNode("button", {
							class: "eqt-tag-bar__profile-nav eqt-tag-bar__profile-nav--prev",
							type: "button",
							disabled: __props.profileIdx === 0 && !onCreationPage.value,
							onClick: onPrev
						}, [createTextVNode(toDisplayString(onCreationPage.value ? __props.profileName : __props.prevProfileName) + " ", 1), createVNode(unref(ChevronLeft), { size: 12 })], 8, _hoisted_5$5),
						renamingProfile.value ? withDirectives((openBlock(), createElementBlock("input", {
							key: 0,
							ref_key: "renameInput",
							ref: renameInput,
							"onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => renameValue.value = $event),
							class: "eqt-tag-bar__profile-input",
							onKeydown: [withKeys(finishRenameOrCreate, ["enter"]), _cache[1] || (_cache[1] = withKeys(($event) => renamingProfile.value = false, ["escape"]))],
							onBlur: finishRenameOrCreate
						}, null, 544)), [[vModelText, renameValue.value]]) : (openBlock(), createElementBlock("div", _hoisted_6$4, [createBaseVNode("button", {
							class: "eqt-tag-bar__profile-split-name",
							type: "button",
							onClick: startRenameOrCreate
						}, toDisplayString(onCreationPage.value ? unref(t)("tagbar.newProfile") : __props.profileName), 1), createBaseVNode("button", {
							class: normalizeClass(["eqt-tag-bar__profile-split-delete", { "eqt-tag-bar__profile-split-delete--hidden": !editing.value || onCreationPage.value }]),
							type: "button",
							tabindex: !editing.value || onCreationPage.value ? -1 : void 0,
							disabled: __props.profileCount <= 1,
							onClick: _cache[2] || (_cache[2] = ($event) => emit("deleteProfile"))
						}, [createVNode(unref(Trash2), { size: 12 })], 10, _hoisted_7$4)])),
						createBaseVNode("button", {
							class: "eqt-tag-bar__profile-nav eqt-tag-bar__profile-nav--next",
							type: "button",
							disabled: onCreationPage.value,
							onClick: onNext
						}, [createVNode(unref(ChevronRight), { size: 12 }), createTextVNode(" " + toDisplayString(onCreationPage.value ? "" : __props.nextProfileName), 1)], 8, _hoisted_8$4)
					]),
					onCreationPage.value ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(unref(lines).length, (n) => {
						return openBlock(), createElementBlock("div", {
							key: n,
							class: "eqt-tag-bar__line-wrap"
						}, [..._cache[7] || (_cache[7] = [createBaseVNode("div", { class: "eqt-tag-bar__line" }, null, -1)])]);
					}), 128)) : (openBlock(), createBlock(unref(draggableComponent), mergeProps({ key: 1 }, lineDragOptions, {
						"model-value": unref(lines),
						"item-key": (_, i) => i,
						handle: ".eqt-tag-bar__handle",
						disabled: !editing.value,
						class: "eqt-tag-bar__line-rows",
						onChange: onLineChange
					}), {
						item: withCtx(({ element: line, index: li }) => [createBaseVNode("div", _hoisted_9$4, [
							createBaseVNode("div", {
								ref: (el) => captureControlsEl(el, li),
								class: "eqt-tag-bar__line-controls"
							}, [createBaseVNode("div", {
								class: normalizeClass(["eqt-tag-bar__handle", { "eqt-tag-bar__handle--hidden": !editing.value }]),
								title: unref(t)("tagbar.handleTitle")
							}, [createVNode(unref(GripVertical), { size: 14 })], 10, _hoisted_10$4)], 512),
							line.kind === "separator" ? (openBlock(), createElementBlock("div", {
								key: 0,
								class: normalizeClass(["eqt-tag-bar__line eqt-tag-bar__line--separator", [
									`eqt-tag-bar__line--separator-${line.style?.line ?? "solid"}`,
									`eqt-tag-bar__line--separator-pos-${line.style?.linePosition ?? "middle"}`,
									`eqt-tag-bar__line--separator-align-${line.style?.textAlign ?? "left"}`
								]]),
								style: normalizeStyle({
									...line.color ? { "--line-color": line.color } : {},
									...line.style?.lineThickness ? { "--separator-line-thickness": `${line.style.lineThickness}px` } : {},
									...line.style?.lineLength !== void 0 ? { "--separator-line-length": `${line.style.lineLength}%` } : {},
									...line.style?.textSize ? { fontSize: `${line.style.textSize}px` } : {}
								})
							}, [editing.value ? (openBlock(), createBlock(unref(_sfc_main), {
								key: 0,
								tag: "span",
								"model-value": line.label ?? "",
								"onUpdate:modelValue": (v) => line.label = v && v !== "\n" ? v : void 0,
								contenteditable: "plaintext-only",
								class: "eqt-tag-bar__separator-label eqt-tag-bar__separator-label--editing",
								"data-placeholder": unref(t)("tagbar.separatorLabelPlaceholder"),
								spellcheck: "false",
								"no-nl": ""
							}, null, 8, [
								"model-value",
								"onUpdate:modelValue",
								"data-placeholder"
							])) : line.label ? (openBlock(), createElementBlock("span", _hoisted_11$3, toDisplayString(line.label), 1)) : createCommentVNode("", true)], 6)) : (openBlock(), createBlock(unref(draggableComponent), mergeProps({ key: 1 }, tagDragOptions, {
								"model-value": line.buttons,
								"item-key": buttonKey,
								disabled: !editing.value,
								tag: "div",
								class: "eqt-tag-bar__line",
								style: line.color ? { "--line-color": line.color } : void 0,
								onChange: ($event) => onTagChange(li, $event),
								onStart: onTagStart,
								onEnd: onTagEnd
							}), {
								item: withCtx(({ element: b, index: ti }) => [b.kind === "url" && !editing.value ? (openBlock(), createElementBlock("a", {
									key: 0,
									href: b.url,
									class: "eqt-tag-bar__btn eqt-tag-bar__btn--url",
									style: normalizeStyle(b.color ? { "--line-color": b.color } : void 0)
								}, [createVNode(unref(ExternalLink), { size: 12 }), createTextVNode(" " + toDisplayString(b.label || b.url), 1)], 12, _hoisted_12$3)) : b.kind === "url" ? (openBlock(), createElementBlock("button", {
									key: 1,
									class: "eqt-tag-bar__btn eqt-tag-bar__btn--editing",
									type: "button",
									style: normalizeStyle(b.color ? { "--line-color": b.color } : void 0),
									onClick: ($event) => onConfigure(li, ti)
								}, [createVNode(unref(ExternalLink), { size: 12 }), createTextVNode(" " + toDisplayString(b.label || b.url), 1)], 12, _hoisted_13$3)) : (openBlock(), createElementBlock("button", {
									key: 2,
									class: normalizeClass(["eqt-tag-bar__btn", editing.value ? "eqt-tag-bar__btn--editing" : STATE_CLASS[getState$1(b)]]),
									type: "button",
									style: normalizeStyle(b.color ? { "--line-color": b.color } : void 0),
									onClick: ($event) => editing.value ? onConfigure(li, ti) : onLeftClick(b),
									onContextmenu: withModifiers(($event) => !editing.value && onRightClick($event, b), ["prevent"])
								}, toDisplayString(b.label || b.tags.join(", ")), 47, _hoisted_14$2))]),
								_: 2
							}, 1040, [
								"model-value",
								"disabled",
								"style",
								"onChange"
							])),
							editing.value && line.kind === "separator" ? (openBlock(), createBlock(SeparatorSettingsPopup_default, {
								key: 2,
								line,
								"onUpdate:line": ($event) => onUpdateLine(li, $event)
							}, null, 8, ["line", "onUpdate:line"])) : createCommentVNode("", true),
							editing.value ? (openBlock(), createBlock(LineColorSwatch_default, {
								key: 3,
								"model-value": line.color,
								"onUpdate:modelValue": ($event) => line.color = $event
							}, null, 8, ["model-value", "onUpdate:modelValue"])) : createCommentVNode("", true),
							editing.value ? (openBlock(), createElementBlock("button", {
								key: 4,
								class: "eqt-tag-bar__line-delete",
								type: "button",
								title: unref(t)("tagbar.deleteLine"),
								onClick: ($event) => onDeleteLine(li)
							}, [createVNode(unref(Trash2), { size: 12 })], 8, _hoisted_15$2)) : createCommentVNode("", true)
						])]),
						_: 1
					}, 16, [
						"model-value",
						"item-key",
						"disabled"
					])),
					createBaseVNode("div", _hoisted_16$2, [editing.value ? (openBlock(), createElementBlock("div", _hoisted_17$1, [createBaseVNode("button", {
						class: "eqt-tag-bar__line-add-btn",
						type: "button",
						onClick: onAddButtonLine
					}, [createVNode(unref(Plus), { size: 12 }), createTextVNode(" " + toDisplayString(unref(t)("tagbar.addButtonLine")), 1)]), createBaseVNode("button", {
						class: "eqt-tag-bar__line-add-btn",
						type: "button",
						onClick: onAddSeparatorLine
					}, [createVNode(unref(Plus), { size: 12 }), createTextVNode(" " + toDisplayString(unref(t)("tagbar.addSeparatorLine")), 1)])])) : createCommentVNode("", true), createBaseVNode("div", _hoisted_18$1, [
						createBaseVNode("button", {
							class: "eqt-tag-bar__ctrl",
							type: "button",
							onClick: _cache[3] || (_cache[3] = ($event) => emit("add"))
						}, [createVNode(unref(Plus), { size: 12 }), createTextVNode(" " + toDisplayString(unref(t)("tagbar.addTag")), 1)]),
						createBaseVNode("button", {
							class: "eqt-tag-bar__ctrl",
							type: "button",
							onClick: _cache[4] || (_cache[4] = ($event) => emit("addUrl"))
						}, [createVNode(unref(ExternalLink), { size: 12 }), createTextVNode(" " + toDisplayString(unref(t)("tagbar.addUrl")), 1)]),
						createBaseVNode("button", {
							class: "eqt-tag-bar__ctrl eqt-tag-bar__ctrl--toggle",
							type: "button",
							onClick: _cache[5] || (_cache[5] = ($event) => editing.value = !editing.value)
						}, [createBaseVNode("span", { class: normalizeClass({ "eqt-tag-bar__ctrl-hidden": !editing.value }) }, [createVNode(unref(Check), { size: 12 }), createTextVNode(" " + toDisplayString(unref(t)("tagbar.done")), 1)], 2), createBaseVNode("span", { class: normalizeClass({ "eqt-tag-bar__ctrl-hidden": editing.value }) }, [createVNode(unref(Pencil), { size: 12 }), createTextVNode(" " + toDisplayString(unref(t)("tagbar.edit")), 1)], 2)]),
						createBaseVNode("button", {
							class: "eqt-tag-bar__ctrl",
							type: "button",
							onClick: _cache[6] || (_cache[6] = ($event) => emit("settings"))
						}, [createVNode(unref(Settings), { size: 12 }), createTextVNode(" " + toDisplayString(unref(t)("tagbar.settings")), 1)])
					])])
				])], 38);
			};
		}
	});
	function makeRow(raw) {
		return {
			id: Symbol(),
			token: parseTerm(raw),
			rawText: raw,
			undoStack: [],
			redoStack: []
		};
	}
	function getCursorOffset(el) {
		const sel = window.getSelection();
		if (!sel || !sel.rangeCount) return 0;
		const range = sel.getRangeAt(0).cloneRange();
		range.selectNodeContents(el);
		range.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
		return range.toString().length;
	}
	function setCursorOffset(el, offset) {
		const sel = window.getSelection();
		if (!sel) return;
		const range = document.createRange();
		let remaining = offset;
		let lastNode = null;
		let lastLen = 0;
		function walk(node) {
			if (node.nodeType === Node.TEXT_NODE) {
				const len = node.textContent?.length ?? 0;
				lastNode = node;
				lastLen = len;
				if (remaining <= len) {
					range.setStart(node, remaining);
					range.collapse(true);
					return true;
				}
				remaining -= len;
				return false;
			}
			for (const child of node.childNodes) if (walk(child)) return true;
			return false;
		}
		if (!walk(el) && lastNode) {
			range.setStart(lastNode, lastLen);
			range.collapse(true);
		}
		sel.removeAllRanges();
		sel.addRange(range);
	}
	var EXPLAIN_CLASSES = {
		prefix: "eqt-explain--prefix",
		ns: "eqt-explain--ns",
		qualifier: "eqt-explain--qualifier",
		tag: "eqt-explain--tag",
		suffix: "eqt-explain--suffix",
		error: "eqt-explain--error",
		punct: "eqt-explain--punct"
	};
	function buildExplain(token) {
		if (token.parseError && token.tag === token.raw) return [{
			text: token.raw,
			cls: EXPLAIN_CLASSES.error,
			label: t("tagConfig.explainError")
		}];
		const segs = [];
		if (token.prefix) segs.push({
			text: token.prefix,
			cls: EXPLAIN_CLASSES.prefix,
			label: t("tagConfig.explainPrefix")
		});
		if (token.qualifier) {
			segs.push({
				text: token.qualifier,
				cls: EXPLAIN_CLASSES.qualifier,
				label: t("tagConfig.explainQualifier")
			});
			segs.push({
				text: ":",
				cls: EXPLAIN_CLASSES.punct,
				label: ""
			});
		} else if (token.namespace) {
			const nsDisplay = token.namespaceRaw ?? token.namespace;
			segs.push({
				text: nsDisplay,
				cls: EXPLAIN_CLASSES.ns,
				label: t("tagConfig.explainNs")
			});
			segs.push({
				text: ":",
				cls: EXPLAIN_CLASSES.punct,
				label: ""
			});
		}
		if (token.tag.includes(" ")) {
			segs.push({
				text: "\"",
				cls: EXPLAIN_CLASSES.punct,
				label: ""
			});
			segs.push({
				text: token.tag,
				cls: EXPLAIN_CLASSES.tag,
				label: t("tagConfig.explainTag")
			});
			if (token.suffix) segs.push({
				text: token.suffix,
				cls: EXPLAIN_CLASSES.suffix,
				label: t("tagConfig.explainSuffix")
			});
			segs.push({
				text: "\"",
				cls: EXPLAIN_CLASSES.punct,
				label: ""
			});
		} else if (token.tag) {
			segs.push({
				text: token.tag,
				cls: EXPLAIN_CLASSES.tag,
				label: t("tagConfig.explainTag")
			});
			if (token.suffix) segs.push({
				text: token.suffix,
				cls: EXPLAIN_CLASSES.suffix,
				label: t("tagConfig.explainSuffix")
			});
		}
		return segs;
	}
	function renderHighlight(el, row) {
		if (!row.rawText) {
			el.innerHTML = "";
			return;
		}
		let segs = buildExplain(row.token);
		if (segs.map((s) => s.text).join("") !== row.rawText.trim()) segs = [{
			text: row.rawText,
			cls: EXPLAIN_CLASSES.tag,
			label: ""
		}];
		const isFocused = document.activeElement === el;
		const offset = isFocused ? getCursorOffset(el) : 0;
		el.innerHTML = "";
		for (const seg of segs) {
			const span = document.createElement("span");
			span.className = seg.cls;
			if (seg.label) span.title = seg.label;
			span.textContent = seg.text;
			el.appendChild(span);
		}
		if (isFocused) setCursorOffset(el, offset);
	}
	function cyclePrefix(current) {
		if (current === null) return "-";
		if (current === "-") return "~";
		return null;
	}
	function cycleSuffix(current) {
		if (current === null) return "$";
		if (current === "$") return "*";
		return null;
	}
	var nsToShort = (ns) => NS_TO_SHORT[ns];
	function useSearchTerm(row, rawEl, options = {}) {
		let syncing = false;
		function refreshHighlight() {
			nextTick(() => {
				if (rawEl.value) renderHighlight(rawEl.value, row);
			});
		}
		function updateFromStructured() {
			if (syncing) return;
			syncing = true;
			row.rawText = serializeTerm(row.token);
			syncing = false;
			refreshHighlight();
		}
		function updateFromRaw(text) {
			if (syncing) return;
			row.undoStack.push(row.rawText);
			row.redoStack.length = 0;
			syncing = true;
			row.rawText = text;
			row.token = parseTerm(text.trim());
			syncing = false;
			refreshHighlight();
		}
		function applyText(text) {
			syncing = true;
			row.rawText = text;
			row.token = parseTerm(text.trim());
			syncing = false;
			refreshHighlight();
			nextTick(() => {
				if (rawEl.value) setCursorOffset(rawEl.value, text.length);
			});
		}
		function undo() {
			if (!row.undoStack.length) return;
			row.redoStack.push(row.rawText);
			applyText(row.undoStack.pop());
		}
		function redo() {
			if (!row.redoStack.length) return;
			row.undoStack.push(row.rawText);
			applyText(row.redoStack.pop());
		}
		function rowPrefersShort() {
			return row.token.namespace && row.token.namespaceRaw ? row.token.namespaceRaw !== row.token.namespace : (options.nsFormat ?? "long") === "short";
		}
		function setPrefix(prefix) {
			row.token.prefix = prefix;
			updateFromStructured();
		}
		function setColonPrefix(value) {
			if (!value) {
				row.token.qualifier = null;
				row.token.namespace = null;
				row.token.namespaceRaw = null;
			} else if (value.startsWith("q:")) {
				const q = value.slice(2);
				row.token.qualifier = q;
				row.token.namespace = null;
				row.token.namespaceRaw = null;
			} else if (value.startsWith("ns:")) {
				const ns = value.slice(3);
				const prefersShort = rowPrefersShort();
				row.token.qualifier = null;
				row.token.namespace = ns;
				row.token.namespaceRaw = prefersShort ? nsToShort(ns) ?? ns : ns;
			}
			updateFromStructured();
		}
		function setTagValue(value) {
			row.token.tag = value;
			row.token.quoted = value.includes(" ");
			updateFromStructured();
		}
		function onCycleSuffix() {
			row.token.suffix = cycleSuffix(row.token.suffix);
			updateFromStructured();
		}
		function cycleNsFormat() {
			if (!row.token.namespace) return;
			const ns = row.token.namespace;
			const short = nsToShort(ns);
			if (!short) return;
			row.token.namespaceRaw = row.token.namespaceRaw === ns ? short : ns;
			updateFromStructured();
		}
		function getNsFormatLabel() {
			if (!row.token.namespace) return "";
			if (!nsToShort(row.token.namespace)) return "-";
			return row.token.namespaceRaw === row.token.namespace ? t("settings.nsFormatLong") : t("settings.nsFormatShort");
		}
		function getColonPrefixValue() {
			if (row.token.qualifier) return `q:${row.token.qualifier}`;
			if (row.token.namespace) return `ns:${row.token.namespace}`;
			return "";
		}
		function applySuggestionPick(entry) {
			const prefersShort = rowPrefersShort();
			row.token.namespace = entry.ns;
			row.token.namespaceRaw = prefersShort ? nsToShort(entry.ns) ?? entry.ns : entry.ns;
			row.token.qualifier = null;
			row.token.tag = entry.raw;
			row.token.quoted = entry.raw.includes(" ");
			if (row.token.suffix === null && (options.defaultExactMatch ?? true)) row.token.suffix = "$";
			updateFromStructured();
		}
		return {
			refreshHighlight,
			updateFromRaw,
			undo,
			redo,
			setPrefix,
			setColonPrefix,
			setTagValue,
			onCycleSuffix,
			cycleNsFormat,
			getNsFormatLabel,
			getColonPrefixValue,
			applySuggestionPick
		};
	}
	var _hoisted_1$4 = {
		key: 0,
		class: "eqt-popup__no-result"
	};
	var _hoisted_2$4 = ["onMousedown", "onMouseenter"];
	var _hoisted_3$4 = { class: "eqt-popup__suggestion-ns" };
	var _hoisted_4$4 = { class: "eqt-popup__suggestion-name" };
	var _hoisted_5$4 = { class: "eqt-popup__suggestion-tag" };
	var EST_ITEM_HEIGHT = 32;
	var OVERSCAN = 10;
	var TagAutocomplete_default = defineComponent({
		__name: "TagAutocomplete",
		props: {
			query: {},
			qualifier: {},
			useNhWeight: { type: Boolean },
			nsOrder: {},
			inputEl: {}
		},
		emits: ["pick"],
		setup(__props, { emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const dbReady = ref(false);
			const suggestions = ref([]);
			const selectedIdx = ref(-1);
			onMounted(async () => {
				await loadTagDb();
				dbReady.value = true;
				triggerSearch();
			});
			let searchTimer = 0;
			onScopeDispose(() => clearTimeout(searchTimer));
			function triggerSearch() {
				clearTimeout(searchTimer);
				if (props.qualifier) {
					suggestions.value = [];
					selectedIdx.value = -1;
					return;
				}
				if (!dbReady.value || !props.query) {
					suggestions.value = [];
					selectedIdx.value = -1;
					return;
				}
				searchTimer = window.setTimeout(() => {
					suggestions.value = searchTags(props.query, {
						useNhWeight: props.useNhWeight,
						nsOrder: props.nsOrder
					});
					selectedIdx.value = -1;
				}, 80);
			}
			watch(() => [
				props.query,
				props.qualifier,
				props.useNhWeight,
				props.nsOrder
			], triggerSearch, { deep: true });
			useEventListener(() => props.inputEl, "keydown", (e) => {
				if (!suggestions.value.length) return;
				if (e.key === "ArrowDown") {
					e.preventDefault();
					if (selectedIdx.value < suggestions.value.length - 1) selectedIdx.value++;
					scrollToSelected();
				} else if (e.key === "ArrowUp") {
					e.preventDefault();
					if (selectedIdx.value > 0) selectedIdx.value--;
					scrollToSelected();
				} else if (e.key === "Enter") {
					if (selectedIdx.value >= 0 && suggestions.value[selectedIdx.value]) {
						e.preventDefault();
						emit("pick", suggestions.value[selectedIdx.value]);
					}
				}
			});
			function scrollToSelected() {
				if (!suggestEl.value || selectedIdx.value < 0) return;
				suggestEl.value.querySelector(".eqt-popup__suggestion--active")?.scrollIntoView({ block: "nearest" });
			}
			const suggestEl = ref(null);
			const scrollTop = ref(0);
			const visibleRange = computed(() => {
				const total = suggestions.value.length;
				if (!total) return {
					start: 0,
					end: 0
				};
				const containerH = suggestEl.value?.clientHeight ?? 300;
				return {
					start: Math.max(0, Math.floor(scrollTop.value / EST_ITEM_HEIGHT) - OVERSCAN),
					end: Math.min(total, Math.ceil((scrollTop.value + containerH) / EST_ITEM_HEIGHT) + OVERSCAN)
				};
			});
			const virtualSuggestions = computed(() => suggestions.value.slice(visibleRange.value.start, visibleRange.value.end).map((data, i) => ({
				data,
				index: visibleRange.value.start + i
			})));
			const wrapperStyle = computed(() => ({
				height: `${suggestions.value.length * EST_ITEM_HEIGHT}px`,
				paddingTop: `${visibleRange.value.start * EST_ITEM_HEIGHT}px`,
				boxSizing: "border-box"
			}));
			function onSuggestScroll(e) {
				const top = e.target.scrollTop;
				if (top !== scrollTop.value) scrollTop.value = top;
			}
			watch(suggestions, () => {
				scrollTop.value = 0;
				if (suggestEl.value) suggestEl.value.scrollTop = 0;
			});
			const isCJK = computed(isCJKLocale);
			return (_ctx, _cache) => {
				return dbReady.value && __props.query.trim() && !suggestions.value.length && !__props.qualifier ? (openBlock(), createElementBlock("div", _hoisted_1$4, toDisplayString(unref(t)("tagConfig.noResult")), 1)) : suggestions.value.length ? (openBlock(), createElementBlock("div", {
					key: 1,
					ref_key: "suggestEl",
					ref: suggestEl,
					class: "eqt-popup__suggestions",
					onScroll: onSuggestScroll
				}, [createBaseVNode("div", { style: normalizeStyle(wrapperStyle.value) }, [(openBlock(true), createElementBlock(Fragment, null, renderList(virtualSuggestions.value, ({ data: entry, index: si }) => {
					return openBlock(), createElementBlock("div", {
						key: entry.fullTag,
						class: normalizeClass(["eqt-popup__suggestion", { "eqt-popup__suggestion--active": si === selectedIdx.value }]),
						onMousedown: withModifiers(($event) => emit("pick", entry), ["prevent"]),
						onMouseenter: ($event) => selectedIdx.value = si
					}, [
						createBaseVNode("span", _hoisted_3$4, toDisplayString(unref(t)("ns." + entry.ns)) + "：", 1),
						createBaseVNode("span", _hoisted_4$4, toDisplayString(isCJK.value ? entry.name : entry.raw), 1),
						createBaseVNode("span", _hoisted_5$4, toDisplayString(entry.fullTag), 1)
					], 42, _hoisted_2$4);
				}), 128))], 4)], 544)) : createCommentVNode("", true);
			};
		}
	});
	var _hoisted_1$3 = { class: "eqt-row__builder" };
	var _hoisted_2$3 = ["title"];
	var _hoisted_3$3 = { class: "eqt-row__colon-split" };
	var _hoisted_4$3 = ["disabled", "title"];
	var _hoisted_5$3 = ["value"];
	var _hoisted_6$3 = { value: "" };
	var _hoisted_7$3 = ["label"];
	var _hoisted_8$3 = ["value"];
	var _hoisted_9$3 = ["label"];
	var _hoisted_10$3 = ["value"];
	var _hoisted_11$2 = { class: "eqt-row__tag-wrap" };
	var _hoisted_12$2 = [
		"value",
		"placeholder",
		"disabled"
	];
	var _hoisted_13$2 = ["title"];
	var _hoisted_14$1 = ["title"];
	var _hoisted_15$1 = { class: "eqt-row__raw-line" };
	var _hoisted_16$1 = { class: "eqt-row__raw-label" };
	var SearchTermEditor_default = defineComponent({
		__name: "SearchTermEditor",
		props: {
			rowState: {},
			defaultExactMatch: { type: Boolean },
			nsFormat: {},
			dbReady: { type: Boolean },
			useNhWeight: { type: Boolean },
			nsOrder: {},
			active: { type: Boolean }
		},
		emits: ["update:active", "remove"],
		setup(__props, { expose: __expose, emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const rawEl = ref(null);
			const tagInputEl = ref(null);
			const term = useSearchTerm(props.rowState, rawEl, {
				defaultExactMatch: props.defaultExactMatch,
				nsFormat: props.nsFormat
			});
			onMounted(() => {
				term.refreshHighlight();
			});
			__expose({ focus: () => tagInputEl.value?.focus() });
			watch(() => props.active, (val) => {
				if (!val) tagInputEl.value?.blur();
			});
			function onPrefixCycle() {
				term.setPrefix(cyclePrefix(props.rowState.token.prefix));
			}
			function onColonPrefixChange(e) {
				term.setColonPrefix(e.target.value);
			}
			function onTagInput(e) {
				term.setTagValue(e.target.value);
			}
			function onSuffixCycle() {
				term.onCycleSuffix();
			}
			function onNsFormatToggle() {
				term.cycleNsFormat();
			}
			function onTagFocus() {
				emit("update:active", true);
			}
			function onTagBlur() {
				requestAnimationFrame(() => {
					if (document.activeElement !== tagInputEl.value) emit("update:active", false);
				});
			}
			function onPickSuggestion(entry) {
				term.applySuggestionPick(entry);
				emit("update:active", false);
			}
			let isComposing = false;
			function onRawInput(e) {
				if (isComposing) return;
				const text = e.target.textContent ?? "";
				term.updateFromRaw(text);
			}
			function onCompositionStart() {
				isComposing = true;
			}
			function onCompositionEnd(e) {
				isComposing = false;
				const text = e.target.textContent ?? "";
				term.updateFromRaw(text);
			}
			function onRawKeydown(e) {
				if (e.key === "Enter") {
					e.preventDefault();
					return;
				}
				const key = e.key.toLowerCase();
				const isUndo = (e.ctrlKey || e.metaKey) && key === "z" && !e.shiftKey;
				const isRedo = (e.ctrlKey || e.metaKey) && (key === "y" || key === "z" && e.shiftKey);
				if (!isUndo && !isRedo) return;
				e.preventDefault();
				if (isUndo) term.undo();
				else term.redo();
			}
			const nsOptions = ALL_NAMESPACES.map((ns) => {
				const short = nsToShort(ns);
				return {
					value: `ns:${ns}`,
					label: short ? `${ns} (${short})` : ns
				};
			});
			const qualifierOptions = Array.from(QUALIFIER_SET).map((q) => ({
				value: `q:${q}`,
				label: `${q}:`
			}));
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock(Fragment, null, [createBaseVNode("div", _hoisted_1$3, [
					createBaseVNode("button", {
						class: normalizeClass(["eqt-row__prefix-cycle", {
							"eqt-row__prefix-cycle--exclude": __props.rowState.token.prefix === "-",
							"eqt-row__prefix-cycle--or": __props.rowState.token.prefix === "~"
						}]),
						type: "button",
						title: unref(t)("tagConfig.prefix"),
						onClick: onPrefixCycle
					}, toDisplayString(__props.rowState.token.prefix ?? "\xA0"), 11, _hoisted_2$3),
					createBaseVNode("div", _hoisted_3$3, [createBaseVNode("button", {
						class: normalizeClass(["eqt-row__colon-toggle", { "eqt-row__colon-toggle--disabled": !__props.rowState.token.namespace || !unref(nsToShort)(__props.rowState.token.namespace) }]),
						type: "button",
						disabled: !__props.rowState.token.namespace || !unref(nsToShort)(__props.rowState.token.namespace),
						title: unref(term).getNsFormatLabel(),
						onClick: onNsFormatToggle
					}, [createBaseVNode("span", { class: normalizeClass({ "eqt-row__colon-toggle-hidden": !__props.rowState.token.namespace || !unref(nsToShort)(__props.rowState.token.namespace) || __props.rowState.token.namespaceRaw !== __props.rowState.token.namespace }) }, toDisplayString(unref(t)("tagConfig.nsLong")), 3), createBaseVNode("span", { class: normalizeClass({ "eqt-row__colon-toggle-hidden": !__props.rowState.token.namespace || !unref(nsToShort)(__props.rowState.token.namespace) || __props.rowState.token.namespaceRaw === __props.rowState.token.namespace }) }, toDisplayString(unref(t)("tagConfig.nsShort")), 3)], 10, _hoisted_4$3), createBaseVNode("select", {
						class: "eqt-row__select eqt-row__select--colon",
						value: unref(term).getColonPrefixValue(),
						onChange: onColonPrefixChange
					}, [
						createBaseVNode("option", _hoisted_6$3, toDisplayString(unref(t)("tagConfig.colonPrefixNone")), 1),
						createBaseVNode("optgroup", { label: unref(t)("tagConfig.colonPrefixNsGroup") }, [(openBlock(true), createElementBlock(Fragment, null, renderList(unref(nsOptions), (opt) => {
							return openBlock(), createElementBlock("option", {
								key: opt.value,
								value: opt.value
							}, toDisplayString(opt.label), 9, _hoisted_8$3);
						}), 128))], 8, _hoisted_7$3),
						createBaseVNode("optgroup", { label: unref(t)("tagConfig.colonPrefixQGroup") }, [(openBlock(true), createElementBlock(Fragment, null, renderList(unref(qualifierOptions), (opt) => {
							return openBlock(), createElementBlock("option", {
								key: opt.value,
								value: opt.value
							}, toDisplayString(opt.label), 9, _hoisted_10$3);
						}), 128))], 8, _hoisted_9$3)
					], 40, _hoisted_5$3)]),
					createBaseVNode("div", _hoisted_11$2, [createBaseVNode("input", {
						ref_key: "tagInputEl",
						ref: tagInputEl,
						value: __props.rowState.token.tag,
						class: "eqt-popup__input eqt-row__tag-input",
						placeholder: __props.dbReady ? unref(t)("tagConfig.searchPlaceholder") : unref(t)("tagConfig.loadingPlaceholder"),
						disabled: !__props.dbReady,
						onInput: onTagInput,
						onFocus: onTagFocus,
						onBlur: onTagBlur
					}, null, 40, _hoisted_12$2), __props.active && __props.dbReady ? (openBlock(), createBlock(TagAutocomplete_default, {
						key: 0,
						query: __props.rowState.token.tag.trim(),
						qualifier: __props.rowState.token.qualifier,
						"use-nh-weight": __props.useNhWeight,
						"ns-order": __props.nsOrder,
						"input-el": tagInputEl.value,
						onPick: onPickSuggestion
					}, null, 8, [
						"query",
						"qualifier",
						"use-nh-weight",
						"ns-order",
						"input-el"
					])) : createCommentVNode("", true)]),
					createBaseVNode("button", {
						class: normalizeClass(["eqt-row__suffix-cycle", {
							"eqt-row__suffix-cycle--exact": __props.rowState.token.suffix === "$",
							"eqt-row__suffix-cycle--wild": __props.rowState.token.suffix === "*"
						}]),
						type: "button",
						title: __props.rowState.token.suffix === "$" ? unref(t)("tagConfig.exactMatch") : __props.rowState.token.suffix === "*" ? unref(t)("tagConfig.wildcard") : "\xA0",
						onClick: onSuffixCycle
					}, toDisplayString(__props.rowState.token.suffix ?? "\xA0"), 11, _hoisted_13$2),
					createBaseVNode("button", {
						class: "eqt-popup__tag-remove",
						type: "button",
						title: unref(t)("tagConfig.removeRow"),
						onClick: _cache[0] || (_cache[0] = ($event) => emit("remove"))
					}, "×", 8, _hoisted_14$1)
				]), createBaseVNode("div", _hoisted_15$1, [createBaseVNode("label", _hoisted_16$1, toDisplayString(unref(t)("tagConfig.rawSyntax")), 1), createBaseVNode("div", {
					ref_key: "rawEl",
					ref: rawEl,
					class: "eqt-row__raw-editable",
					contenteditable: "plaintext-only",
					spellcheck: "false",
					onInput: onRawInput,
					onKeydown: onRawKeydown,
					onCompositionstart: onCompositionStart,
					onCompositionend: onCompositionEnd
				}, null, 544)])], 64);
			};
		}
	});
	var _hoisted_1$2 = { class: "eqt-popup-overlay" };
	var _hoisted_2$2 = { class: "eqt-popup__field" };
	var _hoisted_3$2 = { class: "eqt-popup__label" };
	var _hoisted_4$2 = { class: "eqt-popup__field" };
	var _hoisted_5$2 = { class: "eqt-popup__label-row" };
	var _hoisted_6$2 = { class: "eqt-popup__label" };
	var _hoisted_7$2 = ["href"];
	var _hoisted_8$2 = { class: "eqt-popup__field" };
	var _hoisted_9$2 = { class: "eqt-popup__label" };
	var _hoisted_10$2 = { class: "eqt-popup__modes" };
	var _hoisted_11$1 = { class: "eqt-popup__mode" };
	var _hoisted_12$1 = { class: "eqt-popup__mode" };
	var _hoisted_13$1 = { class: "eqt-popup__actions" };
	var TagConfigPopup_default = defineComponent({
		__name: "TagConfigPopup",
		props: {
			tag: {},
			lineColor: {},
			isAdd: { type: Boolean },
			useNhWeight: { type: Boolean },
			nsOrder: {},
			nsFormat: {},
			defaultExactMatch: { type: Boolean }
		},
		emits: [
			"save",
			"delete",
			"close"
		],
		setup(__props, { emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const label = ref("");
			const color = ref(void 0);
			const effectiveColor = computed(() => color.value ?? props.lineColor);
			const rows = reactive([]);
			const orEnabled = ref(true);
			const excludeEnabled = ref(true);
			const activeRow = ref(-1);
			const dbReady = ref(false);
			const popupEl = ref(null);
			const editorRefs = ref([]);
			watch(() => props.tag, (t) => {
				label.value = t.label ?? "";
				color.value = t.color;
				const parts = t.tags ?? [];
				rows.splice(0, rows.length, ...parts.map(makeRow));
				if (props.isAdd || !parts.length) rows.push(makeRow(""));
				const disabled = new Set(t.disabledModes ?? []);
				orEnabled.value = !disabled.has("or");
				excludeEnabled.value = !disabled.has("exclude");
			}, { immediate: true });
			function addRowAfter(idx) {
				rows.splice(idx + 1, 0, makeRow(""));
				activeRow.value = idx + 1;
				nextTick(() => editorRefs.value[idx + 1]?.focus());
			}
			function removeRow(idx) {
				if (rows.length <= 1) {
					rows[0] = makeRow("");
					return;
				}
				rows.splice(idx, 1);
				if (activeRow.value === idx) activeRow.value = -1;
				else if (activeRow.value > idx) activeRow.value--;
			}
			function onChildActive(i, val) {
				if (val) activeRow.value = i;
				else if (activeRow.value === i) activeRow.value = -1;
			}
			function handleClose() {
				if (activeRow.value >= 0) activeRow.value = -1;
				else emit("close");
			}
			usePopupBehavior({
				popupEl,
				onClose: handleClose,
				onSave
			});
			onMounted(async () => {
				await loadTagDb();
				dbReady.value = true;
				if (props.isAdd) {
					await nextTick();
					editorRefs.value[0]?.focus();
				}
			});
			function onSave() {
				const parts = rows.map((r) => r.rawText.trim()).filter(Boolean);
				if (!parts.length) return;
				const disabled = [];
				if (!orEnabled.value) disabled.push("or");
				if (!excludeEnabled.value) disabled.push("exclude");
				emit("save", {
					kind: "tag",
					tags: parts,
					label: label.value.trim() || void 0,
					color: color.value,
					disabledModes: disabled.length ? disabled : void 0
				});
			}
			const isCJK = computed(isCJKLocale);
			const syntaxHelpUrl = computed(() => isCJK.value ? "https://ehwiki.org/wiki/Gallery_Searching/Chinese" : "https://ehwiki.org/wiki/Gallery_Searching");
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("div", _hoisted_1$2, [createBaseVNode("div", {
					ref_key: "popupEl",
					ref: popupEl,
					class: "eqt-popup"
				}, [
					createBaseVNode("div", _hoisted_2$2, [createBaseVNode("label", _hoisted_3$2, toDisplayString(unref(t)("tagConfig.displayName")), 1), createBaseVNode("div", { class: normalizeClass(["eqt-popup__field-row", unref(currentTagStyleClass)]) }, [createVNode(unref(_sfc_main), {
						tag: "span",
						"model-value": label.value,
						"onUpdate:modelValue": _cache[0] || (_cache[0] = (v) => label.value = v === "\n" ? "" : v),
						contenteditable: "plaintext-only",
						class: "eqt-popup__name-input",
						spellcheck: "false",
						"data-placeholder": unref(t)("tagConfig.displayNameHint"),
						style: normalizeStyle(effectiveColor.value ? { "--line-color": effectiveColor.value } : void 0),
						"no-nl": ""
					}, null, 8, [
						"model-value",
						"data-placeholder",
						"style"
					]), createVNode(LineColorSwatch_default, {
						modelValue: color.value,
						"onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => color.value = $event),
						title: unref(t)("common.itemColor")
					}, null, 8, ["modelValue", "title"])], 2)]),
					_cache[13] || (_cache[13] = createBaseVNode("hr", { class: "eqt-popup__divider" }, null, -1)),
					createBaseVNode("div", _hoisted_4$2, [createBaseVNode("div", _hoisted_5$2, [
						createBaseVNode("label", _hoisted_6$2, toDisplayString(unref(t)("tagConfig.tagSyntax")), 1),
						createBaseVNode("a", {
							class: "eqt-popup__syntax-help",
							href: syntaxHelpUrl.value,
							target: "_blank",
							rel: "noopener"
						}, [createVNode(unref(ExternalLink), { size: 12 }), _cache[7] || (_cache[7] = createTextVNode(" Wiki", -1))], 8, _hoisted_7$2),
						createBaseVNode("button", {
							class: "eqt-popup__add-btn",
							type: "button",
							onClick: _cache[2] || (_cache[2] = ($event) => addRowAfter(rows.length - 1))
						}, "+ " + toDisplayString(unref(t)("tagbar.addTag")), 1)
					]), (openBlock(true), createElementBlock(Fragment, null, renderList(rows, (row, i) => {
						return openBlock(), createElementBlock("div", {
							key: row.id,
							class: "eqt-row"
						}, [createVNode(SearchTermEditor_default, {
							ref_for: true,
							ref_key: "editorRefs",
							ref: editorRefs,
							"row-state": row,
							"default-exact-match": __props.defaultExactMatch,
							"ns-format": __props.nsFormat,
							"db-ready": dbReady.value,
							"use-nh-weight": __props.useNhWeight ?? false,
							"ns-order": __props.nsOrder ?? [],
							active: activeRow.value === i,
							"onUpdate:active": (val) => onChildActive(i, val),
							onRemove: ($event) => removeRow(i)
						}, null, 8, [
							"row-state",
							"default-exact-match",
							"ns-format",
							"db-ready",
							"use-nh-weight",
							"ns-order",
							"active",
							"onUpdate:active",
							"onRemove"
						])]);
					}), 128))]),
					_cache[14] || (_cache[14] = createBaseVNode("hr", { class: "eqt-popup__divider" }, null, -1)),
					createBaseVNode("div", _hoisted_8$2, [createBaseVNode("label", _hoisted_9$2, toDisplayString(unref(t)("tagConfig.rightClickMode")), 1), createBaseVNode("div", _hoisted_10$2, [createBaseVNode("label", _hoisted_11$1, [withDirectives(createBaseVNode("input", {
						type: "checkbox",
						"onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => orEnabled.value = $event)
					}, null, 512), [[vModelCheckbox, orEnabled.value]]), _cache[8] || (_cache[8] = createBaseVNode("span", null, "Or（~）", -1))]), createBaseVNode("label", _hoisted_12$1, [withDirectives(createBaseVNode("input", {
						type: "checkbox",
						"onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => excludeEnabled.value = $event)
					}, null, 512), [[vModelCheckbox, excludeEnabled.value]]), _cache[9] || (_cache[9] = createBaseVNode("span", null, "Exclude（-）", -1))])])]),
					createBaseVNode("div", _hoisted_13$1, [
						!__props.isAdd ? (openBlock(), createElementBlock("button", {
							key: 0,
							class: "eqt-popup__btn eqt-popup__btn--delete",
							type: "button",
							onClick: _cache[5] || (_cache[5] = ($event) => emit("delete"))
						}, toDisplayString(unref(t)("tagConfig.delete")), 1)) : createCommentVNode("", true),
						_cache[12] || (_cache[12] = createBaseVNode("div", { class: "eqt-popup__spacer" }, null, -1)),
						createBaseVNode("button", {
							class: "eqt-popup__btn",
							type: "button",
							onClick: _cache[6] || (_cache[6] = ($event) => emit("close"))
						}, [createTextVNode(toDisplayString(unref(t)("tagConfig.cancel")) + " ", 1), _cache[10] || (_cache[10] = createBaseVNode("kbd", { class: "eqt-popup__kbd" }, "Esc", -1))]),
						createBaseVNode("button", {
							class: "eqt-popup__btn eqt-popup__btn--primary",
							type: "button",
							onClick: onSave
						}, [createTextVNode(toDisplayString(unref(t)("tagConfig.save")) + " ", 1), _cache[11] || (_cache[11] = createBaseVNode("kbd", { class: "eqt-popup__kbd" }, "Ctrl+Enter", -1))])
					])
				], 512)]);
			};
		}
	});
	var _hoisted_1$1 = { class: "eqt-popup-overlay" };
	var _hoisted_2$1 = { class: "eqt-popup__field" };
	var _hoisted_3$1 = { class: "eqt-popup__label" };
	var _hoisted_4$1 = { class: "eqt-popup__field" };
	var _hoisted_5$1 = { class: "eqt-popup__label" };
	var _hoisted_6$1 = { class: "eqt-popup__url-row" };
	var _hoisted_7$1 = { value: "full" };
	var _hoisted_8$1 = ["placeholder"];
	var _hoisted_9$1 = ["disabled"];
	var _hoisted_10$1 = { class: "eqt-popup__actions" };
	var UrlConfigPopup_default = defineComponent({
		__name: "UrlConfigPopup",
		props: {
			tag: {},
			lineColor: {},
			isAdd: { type: Boolean }
		},
		emits: [
			"save",
			"delete",
			"close"
		],
		setup(__props, { emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const label = ref("");
			const color = ref(void 0);
			const effectiveColor = computed(() => color.value ?? props.lineColor);
			const url = ref("");
			const urlMode = ref("eh");
			const fetchingTitle = ref(false);
			const popupEl = ref(null);
			const EH_DOMAINS = ["e-hentai.org", "exhentai.org"];
			function detectMode(raw) {
				if (!raw || raw.startsWith("?") || raw.startsWith("/")) return {
					mode: "eh",
					path: raw
				};
				try {
					const u = new URL(raw, "https://e-hentai.org");
					if (EH_DOMAINS.includes(u.hostname)) return {
						mode: "eh",
						path: u.pathname + u.search
					};
				} catch {}
				return {
					mode: "full",
					path: raw
				};
			}
			watch(() => props.tag, (t) => {
				label.value = t.label ?? "";
				color.value = t.color;
				const detected = detectMode(t.url ?? "");
				urlMode.value = detected.mode;
				url.value = detected.path;
			}, { immediate: true });
			let abortFetch = null;
			onScopeDispose(() => abortFetch?.abort());
			usePopupBehavior({
				popupEl,
				onClose: () => emit("close"),
				onSave
			});
			function fetchTitle() {
				const trimmed = url.value.trim();
				if (!trimmed || !hasGMXHR) return;
				abortFetch?.abort();
				fetchingTitle.value = true;
				abortFetch = _GM_xmlhttpRequest({
					method: "GET",
					url: trimmed,
					headers: { Range: "bytes=0-8191" },
					timeout: 1e4,
					onload: (res) => {
						fetchingTitle.value = false;
						abortFetch = null;
						if (res.status !== 200 && res.status !== 206) return;
						const match = res.responseText.slice(0, 8192).match(/<title[^>]*>([^<]+)<\/title>/i);
						if (match) label.value = match[1].trim();
					},
					onerror: () => {
						fetchingTitle.value = false;
						abortFetch = null;
					},
					ontimeout: () => {
						fetchingTitle.value = false;
						abortFetch = null;
					}
				});
			}
			function onSave() {
				const trimmedUrl = url.value.trim();
				if (!trimmedUrl) return;
				emit("save", {
					kind: "url",
					url: urlMode.value === "eh" ? detectMode(trimmedUrl).path : trimmedUrl,
					label: label.value.trim() || void 0,
					color: color.value
				});
			}
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("div", _hoisted_1$1, [createBaseVNode("div", {
					ref_key: "popupEl",
					ref: popupEl,
					class: "eqt-popup eqt-popup--url"
				}, [
					createBaseVNode("div", _hoisted_2$1, [createBaseVNode("label", _hoisted_3$1, toDisplayString(unref(t)("urlConfig.displayName")), 1), createBaseVNode("div", { class: normalizeClass(["eqt-popup__field-row", unref(currentTagStyleClass)]) }, [createVNode(unref(_sfc_main), {
						tag: "span",
						"model-value": label.value,
						"onUpdate:modelValue": _cache[0] || (_cache[0] = (v) => label.value = v === "\n" ? "" : v),
						contenteditable: "plaintext-only",
						class: "eqt-popup__name-input",
						spellcheck: "false",
						"data-placeholder": unref(t)("urlConfig.displayNameHint"),
						style: normalizeStyle(effectiveColor.value ? { "--line-color": effectiveColor.value } : void 0),
						"no-nl": ""
					}, null, 8, [
						"model-value",
						"data-placeholder",
						"style"
					]), createVNode(LineColorSwatch_default, {
						modelValue: color.value,
						"onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => color.value = $event),
						title: unref(t)("common.itemColor")
					}, null, 8, ["modelValue", "title"])], 2)]),
					_cache[10] || (_cache[10] = createBaseVNode("hr", { class: "eqt-popup__divider" }, null, -1)),
					createBaseVNode("div", _hoisted_4$1, [createBaseVNode("label", _hoisted_5$1, toDisplayString(unref(t)("urlConfig.url")), 1), createBaseVNode("div", _hoisted_6$1, [
						withDirectives(createBaseVNode("select", {
							"onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => urlMode.value = $event),
							class: "eqt-popup__url-prefix"
						}, [_cache[6] || (_cache[6] = createBaseVNode("option", { value: "eh" }, "e[-x]hentai.org", -1)), createBaseVNode("option", _hoisted_7$1, toDisplayString(unref(t)("urlConfig.fullUrl")), 1)], 512), [[vModelSelect, urlMode.value]]),
						withDirectives(createBaseVNode("input", {
							"onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => url.value = $event),
							class: "eqt-popup__input",
							placeholder: urlMode.value === "eh" ? "/?f_cats=991" : "https://..."
						}, null, 8, _hoisted_8$1), [[vModelText, url.value]]),
						urlMode.value === "full" ? (openBlock(), createElementBlock("button", {
							key: 0,
							class: "eqt-popup__btn",
							type: "button",
							disabled: fetchingTitle.value || !url.value.trim(),
							onClick: fetchTitle
						}, toDisplayString(fetchingTitle.value ? unref(t)("urlConfig.fetching") : unref(t)("urlConfig.fetchTitle")), 9, _hoisted_9$1)) : createCommentVNode("", true)
					])]),
					createBaseVNode("div", _hoisted_10$1, [
						!__props.isAdd ? (openBlock(), createElementBlock("button", {
							key: 0,
							class: "eqt-popup__btn eqt-popup__btn--delete",
							type: "button",
							onClick: _cache[4] || (_cache[4] = ($event) => emit("delete"))
						}, toDisplayString(unref(t)("urlConfig.delete")), 1)) : createCommentVNode("", true),
						_cache[9] || (_cache[9] = createBaseVNode("div", { class: "eqt-popup__spacer" }, null, -1)),
						createBaseVNode("button", {
							class: "eqt-popup__btn",
							type: "button",
							onClick: _cache[5] || (_cache[5] = ($event) => emit("close"))
						}, [createTextVNode(toDisplayString(unref(t)("urlConfig.cancel")) + " ", 1), _cache[7] || (_cache[7] = createBaseVNode("kbd", { class: "eqt-popup__kbd" }, "Esc", -1))]),
						createBaseVNode("button", {
							class: "eqt-popup__btn eqt-popup__btn--primary",
							type: "button",
							onClick: onSave
						}, [createTextVNode(toDisplayString(unref(t)("urlConfig.save")) + " ", 1), _cache[8] || (_cache[8] = createBaseVNode("kbd", { class: "eqt-popup__kbd" }, "Ctrl+Enter", -1))])
					])
				], 512)]);
			};
		}
	});
	var _hoisted_1 = { class: "eqt-popup-overlay" };
	var _hoisted_2 = { class: "eqt-settings__sidebar" };
	var _hoisted_3 = { class: "eqt-popup__title" };
	var _hoisted_4 = ["onClick"];
	var _hoisted_5 = { class: "eqt-settings__panel" };
	var _hoisted_6 = {
		class: "eqt-settings__row",
		style: { "margin-top": "0" }
	};
	var _hoisted_7 = ["checked"];
	var _hoisted_8 = { class: "eqt-settings__label" };
	var _hoisted_9 = { class: "eqt-settings__hint" };
	var _hoisted_10 = { class: "eqt-settings__subtitle" };
	var _hoisted_11 = { class: "eqt-settings__locale-row" };
	var _hoisted_12 = {
		class: "eqt-settings__row",
		style: { "margin-top": "10px" }
	};
	var _hoisted_13 = ["checked"];
	var _hoisted_14 = { class: "eqt-settings__label" };
	var _hoisted_15 = { class: "eqt-settings__hint" };
	var _hoisted_16 = { class: "eqt-settings__subtitle" };
	var _hoisted_17 = { class: "eqt-settings__dblclick-label" };
	var _hoisted_18 = ["value", "onChange"];
	var _hoisted_19 = { value: "search" };
	var _hoisted_20 = { value: "searchNewTab" };
	var _hoisted_21 = { value: "clearSearch" };
	var _hoisted_22 = { value: "none" };
	var _hoisted_23 = {
		class: "eqt-settings__row",
		style: { "margin-top": "6px" }
	};
	var _hoisted_24 = ["checked"];
	var _hoisted_25 = { class: "eqt-settings__label" };
	var _hoisted_26 = { class: "eqt-settings__subtitle" };
	var _hoisted_27 = ["title"];
	var _hoisted_28 = {
		class: "eqt-settings__hint",
		style: { "white-space": "pre-line" }
	};
	var _hoisted_29 = { class: "eqt-settings__ns-item eqt-settings__ns-item--draggable" };
	var _hoisted_30 = ["checked", "onChange"];
	var _hoisted_31 = { class: "eqt-settings__ns-label" };
	var _hoisted_32 = { class: "eqt-settings__ns-key" };
	var _hoisted_33 = {
		class: "eqt-settings__subtitle",
		style: { "margin-top": "0" }
	};
	var _hoisted_34 = { class: "eqt-settings__row" };
	var _hoisted_35 = ["value"];
	var _hoisted_36 = { class: "eqt-settings__subtitle" };
	var _hoisted_37 = { class: "eqt-settings__row" };
	var _hoisted_38 = ["disabled"];
	var _hoisted_39 = {
		class: "eqt-settings__subtitle",
		style: { "margin-top": "0" }
	};
	var _hoisted_40 = { class: "eqt-settings__locale-row" };
	var _hoisted_41 = ["onClick"];
	var _hoisted_42 = { class: "eqt-settings__subtitle" };
	var _hoisted_43 = { class: "eqt-settings__locale-row" };
	var _hoisted_44 = ["onClick"];
	var _hoisted_45 = { class: "eqt-settings__subtitle" };
	var _hoisted_46 = { class: "eqt-settings__font-row" };
	var _hoisted_47 = ["value", "placeholder"];
	var _hoisted_48 = { class: "eqt-settings__hint" };
	var _hoisted_49 = { class: "eqt-settings__subtitle" };
	var _hoisted_50 = { class: "eqt-settings__weight-row" };
	var _hoisted_51 = ["value"];
	var _hoisted_52 = { class: "eqt-settings__weight-value" };
	var _hoisted_53 = { class: "eqt-settings__subtitle" };
	var _hoisted_54 = {
		key: 0,
		class: "eqt-settings__preview-line"
	};
	var _hoisted_55 = { class: "eqt-settings__about" };
	var _hoisted_56 = { class: "eqt-about__hero" };
	var _hoisted_57 = { class: "eqt-about__desc" };
	var _hoisted_58 = { class: "eqt-about__actions" };
	var _hoisted_59 = {
		class: "eqt-about__action-btn",
		href: "https://github.com/Tsuyumi25/EhQuickTag",
		target: "_blank",
		rel: "noopener"
	};
	var _hoisted_60 = {
		class: "eqt-about__action-btn",
		href: "https://github.com/Tsuyumi25/EhQuickTag/issues",
		target: "_blank",
		rel: "noopener"
	};
	var _hoisted_61 = { class: "eqt-about__section" };
	var _hoisted_62 = { class: "eqt-about__section-title" };
	var _hoisted_63 = { class: "eqt-about__items" };
	var _hoisted_64 = {
		class: "eqt-about__item",
		href: "https://sleazyfork.org/scripts/454282",
		target: "_blank",
		rel: "noopener"
	};
	var _hoisted_65 = {
		class: "eqt-about__item",
		href: "https://sleazyfork.org/scripts/454209",
		target: "_blank",
		rel: "noopener"
	};
	var _hoisted_66 = {
		class: "eqt-about__item",
		href: "https://sleazyfork.org/scripts/516145",
		target: "_blank",
		rel: "noopener"
	};
	var _hoisted_67 = { class: "eqt-about__section" };
	var _hoisted_68 = { class: "eqt-about__section-title" };
	var _hoisted_69 = { class: "eqt-about__items" };
	var _hoisted_70 = {
		class: "eqt-about__item",
		href: "https://github.com/sk2589822/Exhentai-Enhancer",
		target: "_blank",
		rel: "noopener"
	};
	var _hoisted_71 = { class: "eqt-about__section" };
	var _hoisted_72 = { class: "eqt-about__section-title" };
	var _hoisted_73 = { class: "eqt-about__items" };
	var _hoisted_74 = {
		class: "eqt-about__item",
		href: "https://github.com/EhTagTranslation/Database",
		target: "_blank",
		rel: "noopener"
	};
	var _hoisted_75 = { class: "eqt-about__item-detail" };
	var _hoisted_76 = {
		class: "eqt-about__item",
		href: "https://github.com/EhTagTranslation/EhSyringe",
		target: "_blank",
		rel: "noopener"
	};
	var _hoisted_77 = { class: "eqt-about__item-detail" };
	var _hoisted_78 = {
		class: "eqt-about__item",
		href: "https://github.com/BYVoid/OpenCC",
		target: "_blank",
		rel: "noopener"
	};
	var _hoisted_79 = { class: "eqt-about__item-detail" };
	var _hoisted_80 = { class: "eqt-json-editor" };
	var _hoisted_81 = { class: "eqt-json-editor__header" };
	var _hoisted_82 = { class: "eqt-json-editor__title" };
	var _hoisted_83 = { class: "eqt-json-editor__toolbar" };
	var _hoisted_84 = ["title"];
	var _hoisted_85 = ["title"];
	var _hoisted_86 = {
		key: 0,
		class: "eqt-settings__preview-line"
	};
	var _hoisted_87 = ["readonly"];
	var _hoisted_88 = {
		key: 1,
		class: "eqt-json-editor__error"
	};
	var _hoisted_89 = {
		key: 2,
		class: "eqt-popup__actions"
	};
	var _hoisted_90 = {
		key: 0,
		class: "eqt-json-editor__corrupted-reason"
	};
	var _hoisted_91 = {
		key: 3,
		class: "eqt-popup__actions",
		style: { "justify-content": "center" }
	};
	var _hoisted_92 = {
		key: 4,
		class: "eqt-popup__actions"
	};
	var _hoisted_93 = { class: "eqt-settings__profiles" };
	var _hoisted_94 = {
		class: "eqt-settings__subtitle",
		style: { "margin-top": "0" }
	};
	var _hoisted_95 = ["onClick"];
	var _hoisted_96 = { class: "eqt-settings__item-name" };
	var _hoisted_97 = {
		key: 0,
		class: "eqt-settings__active-badge"
	};
	var _hoisted_98 = { class: "eqt-settings__item-count" };
	var _hoisted_99 = ["title", "onClick"];
	var _hoisted_100 = { class: "eqt-settings__subtitle" };
	var _hoisted_101 = { class: "eqt-settings__ns-list" };
	var _hoisted_102 = ["onClick"];
	var _hoisted_103 = { class: "eqt-settings__item-name" };
	var _hoisted_104 = { class: "eqt-settings__item-count" };
	var _hoisted_105 = { class: "eqt-settings__subtitle" };
	var _hoisted_106 = { class: "eqt-settings__ns-list" };
	var _hoisted_107 = ["onClick"];
	var _hoisted_108 = { class: "eqt-settings__item-name" };
	var SettingsPopup_default = defineComponent({
		__name: "SettingsPopup",
		props: {
			useNhWeight: { type: Boolean },
			nsOrder: {},
			disabledNs: {}
		},
		emits: [
			"update:useNhWeight",
			"update:nsOrder",
			"update:disabledNs",
			"close"
		],
		setup(__props, { emit: __emit }) {
			const props = __props;
			const emit = __emit;
			const dragOptions = {
				...baseDragOptions,
				ghostClass: "eqt-settings__ns-item--ghost",
				chosenClass: "eqt-settings__ns-item--chosen"
			};
			const tabKeys = [
				"appearance",
				"search",
				"data",
				"about"
			];
			const tabLabelKeys = {
				search: "settings.tabSearch",
				appearance: "settings.tabAppearance",
				data: "settings.tabData",
				about: "settings.tabAbout"
			};
			const activeTab = ref("appearance");
			const dblClickOptions = [{
				labelKey: "settings.dblClickLeft",
				ref: dblClickLeft
			}, {
				labelKey: "settings.dblClickRight",
				ref: dblClickRight
			}];
			const localeOptions = [
				{
					value: "zh-TW",
					label: "繁體中文"
				},
				{
					value: "zh-CN",
					label: "简体中文"
				},
				{
					value: "en",
					label: "English"
				},
				{
					value: "ja",
					label: "日本語"
				}
			];
			const previewLines = computed(() => getDefaultLines());
			function tagCount(lines) {
				return lines.reduce((sum, l) => sum + (l.kind === "buttons" ? l.buttons.length : 0), 0);
			}
			const tagCounts = computed(() => profiles.map((p, i) => tagCount(i === activeProfileIdx.value ? lines : p.lines)));
			const deletedTagCounts = computed(() => deletedProfiles.map((p) => tagCount(p.lines)));
			function onNsOrderChange(evt) {
				if (evt.moved) {
					const newOrder = [...props.nsOrder];
					const [item] = newOrder.splice(evt.moved.oldIndex, 1);
					newOrder.splice(evt.moved.newIndex, 0, item);
					emit("update:nsOrder", newOrder);
				}
			}
			function resetNsOrder() {
				emit("update:nsOrder", [...DEFAULT_NS_ORDER]);
				emit("update:disabledNs", []);
			}
			const popupEl = ref(null);
			usePopupBehavior({
				popupEl,
				onClose: () => emit("close")
			});
			const mirrorOptions = Object.entries(TAG_DB_MIRRORS).map(([k, v]) => ({
				value: k,
				label: v.label
			}));
			const refreshing = ref(false);
			async function onRefreshTagDb() {
				refreshing.value = true;
				try {
					await refreshTagDb({ mirror: tagDbMirror.value });
				} finally {
					refreshing.value = false;
				}
			}
			function toggleNs(ns) {
				const next = [...props.disabledNs];
				const idx = next.indexOf(ns);
				if (idx >= 0) next.splice(idx, 1);
				else next.push(ns);
				emit("update:disabledNs", next);
			}
			let nextUid = 0;
			const uidMap = new WeakMap();
			function profileUid(p) {
				const raw = toRaw(p);
				if (!uidMap.has(raw)) uidMap.set(raw, "p" + nextUid++);
				return uidMap.get(raw);
			}
			let profileDragging = false;
			function onProfileChange(evt) {
				if (evt.moved) {
					const from = evt.moved.oldIndex, to = evt.moved.newIndex;
					if (!editingDeleted.value && editingProfileIdx.value >= 0) {
						const ed = editingProfileIdx.value;
						if (ed === from) editingProfileIdx.value = to;
						else if (from < ed && to >= ed) editingProfileIdx.value = ed - 1;
						else if (from > ed && to <= ed) editingProfileIdx.value = ed + 1;
					}
					reorderProfiles(from, to);
				}
			}
			function onProfileStart() {
				profileDragging = true;
			}
			function onProfileEnd() {
				setTimeout(() => {
					profileDragging = false;
				}, 0);
			}
			const editingProfileIdx = ref(-1);
			const editingDeleted = ref(false);
			const editingCorrupted = ref(false);
			const editorText = ref("");
			const editorError = ref("");
			const editorCopied = ref(false);
			const { copy: clipboardCopy } = useClipboard({ legacy: true });
			const { start: startCopiedTimer } = useTimeoutFn(() => {
				editorCopied.value = false;
			}, 1500, { immediate: false });
			const editorPreview = computed(() => {
				try {
					const parsed = JSON.parse(editorText.value);
					if (!Array.isArray(parsed) || !parsed.every(isValidLine)) return null;
					return parsed;
				} catch {
					return null;
				}
			});
			const editingName = computed(() => {
				const idx = editingProfileIdx.value;
				if (idx < 0) return "";
				if (editingCorrupted.value) {
					const c = corruptedProfiles[idx];
					return c ? new Date(c.savedAt).toLocaleString() : "";
				}
				return editingDeleted.value ? deletedProfiles[idx]?.name : profiles[idx]?.name;
			});
			function adjustEditorIdxOnRemove(removedIdx, fromDeleted) {
				if (editingDeleted.value !== fromDeleted || editingCorrupted.value) return;
				if (editingProfileIdx.value === removedIdx) editingProfileIdx.value = -1;
				else if (editingProfileIdx.value > removedIdx) editingProfileIdx.value--;
			}
			function adjustEditorIdxOnCorruptedRemove(removedIdx) {
				if (!editingCorrupted.value) return;
				if (editingProfileIdx.value === removedIdx) editingProfileIdx.value = -1;
				else if (editingProfileIdx.value > removedIdx) editingProfileIdx.value--;
			}
			function onDelete(idx) {
				adjustEditorIdxOnRemove(idx, false);
				deleteProfile(idx);
			}
			function onRestore(idx) {
				adjustEditorIdxOnRemove(idx, true);
				restoreProfile(idx);
			}
			function onPurge(idx) {
				const name = deletedProfiles[idx]?.name ?? "";
				if (!confirm(t("settings.purgeConfirm", { name }))) return;
				adjustEditorIdxOnRemove(idx, true);
				purgeProfile(idx);
			}
			function onPurgeCorrupted(idx) {
				const c = corruptedProfiles[idx];
				const name = c ? new Date(c.savedAt).toLocaleString() : "";
				if (!confirm(t("settings.purgeConfirm", { name }))) return;
				adjustEditorIdxOnCorruptedRemove(idx);
				purgeCorrupted(idx);
			}
			function openEditor(idx, deleted = false) {
				if (profileDragging) return;
				activeTab.value = null;
				editingProfileIdx.value = idx;
				editingDeleted.value = deleted;
				editingCorrupted.value = false;
				editorError.value = "";
				const data = deleted ? deletedProfiles[idx].lines : idx === activeProfileIdx.value ? lines : profiles[idx].lines;
				editorText.value = JSON.stringify(data, null, 2);
			}
			function openCorrupted(idx) {
				activeTab.value = null;
				editingProfileIdx.value = idx;
				editingDeleted.value = false;
				editingCorrupted.value = true;
				editorError.value = "";
				editorText.value = corruptedProfiles[idx]?.raw ?? "";
			}
			function onEditorSave() {
				if (editingDeleted.value) return;
				try {
					const parsed = JSON.parse(editorText.value);
					if (!Array.isArray(parsed) || !parsed.every(isValidLine)) {
						editorError.value = t("settings.editorInvalidShape");
						return;
					}
					editorError.value = "";
					updateProfileLines(editingProfileIdx.value, parsed);
				} catch (err) {
					editorError.value = err.message;
				}
			}
			async function onEditorCopy() {
				await clipboardCopy(editorText.value);
				editorCopied.value = true;
				startCopiedTimer();
			}
			function onEditorExport() {
				const blob = new Blob([editorText.value], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `EhQuickTag-${editingName.value}-${new Date().toISOString().slice(0, 10)}.json`;
				a.click();
				URL.revokeObjectURL(url);
			}
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock("div", _hoisted_1, [createBaseVNode("div", {
					ref_key: "popupEl",
					ref: popupEl,
					class: "eqt-popup eqt-settings__layout"
				}, [
					createBaseVNode("nav", _hoisted_2, [
						createBaseVNode("h3", _hoisted_3, toDisplayString(unref(t)("settings.title")), 1),
						(openBlock(), createElementBlock(Fragment, null, renderList(tabKeys, (key) => {
							return createBaseVNode("button", {
								key,
								type: "button",
								class: normalizeClass(["eqt-settings__tab", { "eqt-settings__tab--active": activeTab.value === key }]),
								onClick: ($event) => {
									activeTab.value = key;
									editingProfileIdx.value = -1;
								}
							}, toDisplayString(unref(t)(tabLabelKeys[key])), 11, _hoisted_4);
						}), 64)),
						_cache[14] || (_cache[14] = createBaseVNode("div", { class: "eqt-settings__sidebar-spacer" }, null, -1)),
						createBaseVNode("button", {
							class: "eqt-popup__btn eqt-popup__btn--primary",
							type: "button",
							onClick: _cache[0] || (_cache[0] = ($event) => emit("close"))
						}, toDisplayString(unref(t)("settings.close")), 1)
					]),
					createBaseVNode("div", _hoisted_5, [withDirectives(createBaseVNode("div", null, [
						withDirectives(createBaseVNode("div", null, [
							createBaseVNode("label", _hoisted_6, [createBaseVNode("input", {
								type: "checkbox",
								checked: props.useNhWeight,
								onChange: _cache[1] || (_cache[1] = ($event) => emit("update:useNhWeight", $event.target.checked))
							}, null, 40, _hoisted_7), createBaseVNode("span", _hoisted_8, toDisplayString(unref(t)("settings.useNhWeight")), 1)]),
							createBaseVNode("p", _hoisted_9, toDisplayString(unref(t)("settings.useNhWeightHint")), 1),
							createBaseVNode("h4", _hoisted_10, toDisplayString(unref(t)("settings.nsFormat")), 1),
							createBaseVNode("div", _hoisted_11, [createBaseVNode("button", {
								type: "button",
								class: normalizeClass(["eqt-settings__locale-btn", { "eqt-settings__locale-btn--active": unref(nsFormat) === "long" }]),
								onClick: _cache[2] || (_cache[2] = ($event) => nsFormat.value = "long")
							}, toDisplayString(unref(t)("settings.nsFormatLong")), 3), createBaseVNode("button", {
								type: "button",
								class: normalizeClass(["eqt-settings__locale-btn", { "eqt-settings__locale-btn--active": unref(nsFormat) === "short" }]),
								onClick: _cache[3] || (_cache[3] = ($event) => nsFormat.value = "short")
							}, toDisplayString(unref(t)("settings.nsFormatShort")), 3)]),
							createBaseVNode("label", _hoisted_12, [createBaseVNode("input", {
								type: "checkbox",
								checked: unref(defaultExactMatch),
								onChange: _cache[4] || (_cache[4] = ($event) => defaultExactMatch.value = $event.target.checked)
							}, null, 40, _hoisted_13), createBaseVNode("span", _hoisted_14, toDisplayString(unref(t)("settings.defaultExactMatch")), 1)]),
							createBaseVNode("p", _hoisted_15, toDisplayString(unref(t)("settings.defaultExactMatchHint")), 1),
							createBaseVNode("h4", _hoisted_16, toDisplayString(unref(t)("settings.dblClickActions")), 1),
							(openBlock(), createElementBlock(Fragment, null, renderList(dblClickOptions, ({ labelKey, ref: r }) => {
								return createBaseVNode("div", {
									key: labelKey,
									class: "eqt-settings__dblclick-row"
								}, [createBaseVNode("label", _hoisted_17, toDisplayString(unref(t)(labelKey)), 1), createBaseVNode("select", {
									class: "eqt-settings__select",
									value: r.value,
									onChange: ($event) => r.value = $event.target.value
								}, [
									createBaseVNode("option", _hoisted_19, toDisplayString(unref(t)("settings.actionSearchCurrent")), 1),
									createBaseVNode("option", _hoisted_20, toDisplayString(unref(t)("settings.actionSearchNewTab")), 1),
									createBaseVNode("option", _hoisted_21, toDisplayString(unref(t)("settings.actionClear")), 1),
									createBaseVNode("option", _hoisted_22, toDisplayString(unref(t)("settings.actionNone")), 1)
								], 40, _hoisted_18)]);
							}), 64)),
							createBaseVNode("label", _hoisted_23, [createBaseVNode("input", {
								type: "checkbox",
								checked: unref(newTabActive),
								onChange: _cache[5] || (_cache[5] = ($event) => newTabActive.value = $event.target.checked)
							}, null, 40, _hoisted_24), createBaseVNode("span", _hoisted_25, toDisplayString(unref(t)("settings.newTabActivate")), 1)]),
							createBaseVNode("h4", _hoisted_26, [createTextVNode(toDisplayString(unref(t)("settings.nsOrder")) + " ", 1), createBaseVNode("button", {
								class: "eqt-settings__reset-btn",
								type: "button",
								title: unref(t)("settings.resetTitle"),
								onClick: resetNsOrder
							}, [createVNode(unref(RotateCcw), { size: 12 }), createTextVNode(" " + toDisplayString(unref(t)("settings.reset")), 1)], 8, _hoisted_27)]),
							createBaseVNode("p", _hoisted_28, toDisplayString(unref(t)("settings.nsOrderHint")), 1),
							createVNode(unref(draggableComponent), mergeProps(dragOptions, {
								"model-value": __props.nsOrder,
								"item-key": (ns) => ns,
								filter: "input",
								"prevent-on-filter": false,
								tag: "ul",
								class: "eqt-settings__ns-list",
								onChange: onNsOrderChange
							}), {
								item: withCtx(({ element: ns }) => [createBaseVNode("li", _hoisted_29, [
									createBaseVNode("input", {
										type: "checkbox",
										checked: !__props.disabledNs.includes(ns),
										onChange: ($event) => toggleNs(ns)
									}, null, 40, _hoisted_30),
									createBaseVNode("span", _hoisted_31, toDisplayString(unref(t)("ns." + ns)), 1),
									createBaseVNode("span", _hoisted_32, toDisplayString(ns), 1)
								])]),
								_: 1
							}, 16, ["model-value", "item-key"])
						], 512), [[vShow, activeTab.value === "search"]]),
						withDirectives(createBaseVNode("div", null, [
							createBaseVNode("h4", _hoisted_33, toDisplayString(unref(t)("settings.tagDbMirror")), 1),
							createBaseVNode("div", _hoisted_34, [withDirectives(createBaseVNode("select", {
								class: "eqt-settings__select",
								"onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => isRef(tagDbMirror) ? tagDbMirror.value = $event : null)
							}, [(openBlock(true), createElementBlock(Fragment, null, renderList(unref(mirrorOptions), (opt) => {
								return openBlock(), createElementBlock("option", {
									key: opt.value,
									value: opt.value
								}, toDisplayString(opt.label), 9, _hoisted_35);
							}), 128))], 512), [[vModelSelect, unref(tagDbMirror)]])]),
							createBaseVNode("h4", _hoisted_36, toDisplayString(unref(t)("settings.tagDbTtlDays")), 1),
							createBaseVNode("div", _hoisted_37, [withDirectives(createBaseVNode("input", {
								class: "eqt-settings__input eqt-settings__input--short",
								type: "number",
								min: "1",
								max: "30",
								"onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => isRef(tagDbTtlDays) ? tagDbTtlDays.value = $event : null)
							}, null, 512), [[
								vModelText,
								unref(tagDbTtlDays),
								void 0,
								{ number: true }
							]]), createBaseVNode("button", {
								class: "eqt-settings__refresh-btn",
								type: "button",
								disabled: refreshing.value,
								onClick: onRefreshTagDb
							}, [createVNode(unref(RotateCcw), { size: 12 }), createTextVNode(" " + toDisplayString(refreshing.value ? unref(t)("settings.tagDbRefreshing") : unref(t)("settings.tagDbRefresh")), 1)], 8, _hoisted_38)])
						], 512), [[vShow, activeTab.value === "data"]]),
						withDirectives(createBaseVNode("div", null, [
							createBaseVNode("h4", _hoisted_39, toDisplayString(unref(t)("settings.language")), 1),
							createBaseVNode("div", _hoisted_40, [(openBlock(), createElementBlock(Fragment, null, renderList(localeOptions, (opt) => {
								return createBaseVNode("button", {
									key: opt.value,
									type: "button",
									class: normalizeClass(["eqt-settings__locale-btn", { "eqt-settings__locale-btn--active": unref(locale) === opt.value }]),
									onClick: ($event) => unref(setLocale)(opt.value)
								}, toDisplayString(opt.label), 11, _hoisted_41);
							}), 64))]),
							createBaseVNode("h4", _hoisted_42, toDisplayString(unref(t)("settings.tagStyle")), 1),
							createBaseVNode("div", _hoisted_43, [(openBlock(true), createElementBlock(Fragment, null, renderList(unref(TAG_STYLE_PRESETS), (preset) => {
								return openBlock(), createElementBlock("button", {
									key: preset.id,
									type: "button",
									class: normalizeClass(["eqt-settings__locale-btn", { "eqt-settings__locale-btn--active": unref(tagStylePreset) === preset.id }]),
									onClick: ($event) => tagStylePreset.value = preset.id
								}, toDisplayString(unref(t)(preset.labelKey)), 11, _hoisted_44);
							}), 128))]),
							createBaseVNode("h4", _hoisted_45, toDisplayString(unref(t)("settings.fontFamily")), 1),
							createBaseVNode("div", _hoisted_46, [createBaseVNode("input", {
								value: unref(fontFamily),
								class: "eqt-settings__font-input eqt-settings__font-input--full",
								placeholder: unref(t)("settings.fontFamilyPlaceholder"),
								onInput: _cache[8] || (_cache[8] = ($event) => fontFamily.value = $event.target.value)
							}, null, 40, _hoisted_47)]),
							createBaseVNode("p", _hoisted_48, [createTextVNode(toDisplayString(unref(t)("settings.fontFamilyHint")), 1), _cache[15] || (_cache[15] = createBaseVNode("code", null, "\"Noto Sans TC\", sans-serif", -1))]),
							createBaseVNode("h4", _hoisted_49, toDisplayString(unref(t)("settings.fontWeight")), 1),
							createBaseVNode("div", _hoisted_50, [createBaseVNode("input", {
								type: "range",
								min: "100",
								max: "900",
								step: "100",
								value: unref(fontWeight) || "400",
								class: "eqt-settings__weight-slider",
								onInput: _cache[9] || (_cache[9] = ($event) => fontWeight.value = $event.target.value)
							}, null, 40, _hoisted_51), createBaseVNode("span", _hoisted_52, toDisplayString(unref(fontWeight) || "400"), 1)]),
							createBaseVNode("h4", _hoisted_53, toDisplayString(unref(t)("settings.preview")), 1),
							createBaseVNode("div", {
								class: normalizeClass(["eqt-settings__font-preview", unref(currentTagStyleClass)]),
								style: normalizeStyle({
									fontFamily: unref(fontFamily) || "inherit",
									fontWeight: unref(fontWeight) || "inherit"
								})
							}, [(openBlock(true), createElementBlock(Fragment, null, renderList(previewLines.value, (line, li) => {
								return openBlock(), createElementBlock(Fragment, { key: li }, [line.kind === "buttons" && line.buttons.length ? (openBlock(), createElementBlock("div", _hoisted_54, [(openBlock(true), createElementBlock(Fragment, null, renderList(line.buttons, (b, ti) => {
									return openBlock(), createElementBlock("span", {
										key: ti,
										class: normalizeClass(["eqt-settings__preview-tag", { "eqt-settings__preview-tag--url": b.kind === "url" }])
									}, toDisplayString(b.label || (b.kind === "tag" ? b.tags.join(", ") : b.url)), 3);
								}), 128))])) : createCommentVNode("", true)], 64);
							}), 128))], 6)
						], 512), [[vShow, activeTab.value === "appearance"]]),
						withDirectives(createBaseVNode("div", _hoisted_55, [
							createBaseVNode("div", _hoisted_56, [
								_cache[17] || (_cache[17] = createBaseVNode("div", { class: "eqt-about__title" }, "EH Quick Tag", -1)),
								_cache[18] || (_cache[18] = createBaseVNode("div", { class: "eqt-about__version" }, "v0.1.0", -1)),
								createBaseVNode("div", _hoisted_57, toDisplayString(unref(t)("about.desc")), 1),
								createBaseVNode("div", _hoisted_58, [createBaseVNode("a", _hoisted_59, [createVNode(unref(Code), { size: 14 }), _cache[16] || (_cache[16] = createTextVNode(" GitHub", -1))]), createBaseVNode("a", _hoisted_60, [createVNode(unref(CircleAlert), { size: 14 }), createTextVNode(" " + toDisplayString(unref(t)("about.reportIssue")), 1)])])
							]),
							createBaseVNode("div", _hoisted_61, [createBaseVNode("div", _hoisted_62, toDisplayString(unref(t)("about.inspiration")), 1), createBaseVNode("div", _hoisted_63, [
								createBaseVNode("a", _hoisted_64, [createVNode(unref(ExternalLink), { size: 12 }), _cache[19] || (_cache[19] = createTextVNode(" Add button on exhentai searchbox ", -1))]),
								createBaseVNode("a", _hoisted_65, [createVNode(unref(ExternalLink), { size: 12 }), _cache[20] || (_cache[20] = createTextVNode(" ExAdvancedSearchMemo ", -1))]),
								createBaseVNode("a", _hoisted_66, [createVNode(unref(ExternalLink), { size: 12 }), _cache[21] || (_cache[21] = createTextVNode(" Lolicon E-Hentai/ExHentai Enhancer ", -1))])
							])]),
							createBaseVNode("div", _hoisted_67, [createBaseVNode("div", _hoisted_68, toDisplayString(unref(t)("about.techRef")), 1), createBaseVNode("div", _hoisted_69, [createBaseVNode("a", _hoisted_70, [createVNode(unref(Code), { size: 12 }), _cache[22] || (_cache[22] = createTextVNode(" Exhentai-Enhancer ", -1))])])]),
							createBaseVNode("div", _hoisted_71, [createBaseVNode("div", _hoisted_72, toDisplayString(unref(t)("about.credits")), 1), createBaseVNode("div", _hoisted_73, [
								createBaseVNode("a", _hoisted_74, [
									createVNode(unref(Code), { size: 12 }),
									_cache[23] || (_cache[23] = createTextVNode(" EhTagTranslation ", -1)),
									createBaseVNode("span", _hoisted_75, toDisplayString(unref(t)("about.ehttDetail")), 1)
								]),
								createBaseVNode("a", _hoisted_76, [
									createVNode(unref(Code), { size: 12 }),
									_cache[24] || (_cache[24] = createTextVNode(" EhSyringe ", -1)),
									createBaseVNode("span", _hoisted_77, toDisplayString(unref(t)("about.ehsyringeDetail")), 1)
								]),
								createBaseVNode("a", _hoisted_78, [
									createVNode(unref(Code), { size: 12 }),
									_cache[25] || (_cache[25] = createTextVNode(" OpenCC ", -1)),
									createBaseVNode("span", _hoisted_79, toDisplayString(unref(t)("about.openccDetail")), 1)
								])
							])]),
							_cache[26] || (_cache[26] = createBaseVNode("div", { class: "eqt-about__footer" }, "MIT License", -1))
						], 512), [[vShow, activeTab.value === "about"]])
					], 512), [[vShow, editingProfileIdx.value < 0]]), withDirectives(createBaseVNode("div", _hoisted_80, [
						createBaseVNode("div", _hoisted_81, [createBaseVNode("h4", _hoisted_82, toDisplayString(editingName.value), 1), createBaseVNode("div", _hoisted_83, [createBaseVNode("button", {
							class: "eqt-json-editor__tool-btn",
							type: "button",
							title: editorCopied.value ? unref(t)("settings.editorCopied") : unref(t)("settings.editorCopy"),
							onClick: onEditorCopy
						}, [editorCopied.value ? (openBlock(), createBlock(unref(Check), {
							key: 0,
							size: 14
						})) : (openBlock(), createBlock(unref(Copy), {
							key: 1,
							size: 14
						}))], 8, _hoisted_84), createBaseVNode("button", {
							class: "eqt-json-editor__tool-btn",
							type: "button",
							title: unref(t)("settings.editorExport"),
							onClick: onEditorExport
						}, [createVNode(unref(Download), { size: 14 })], 8, _hoisted_85)])]),
						editorPreview.value ? (openBlock(), createElementBlock("div", {
							key: 0,
							class: normalizeClass(["eqt-settings__font-preview eqt-json-editor__preview", unref(currentTagStyleClass)])
						}, [(openBlock(true), createElementBlock(Fragment, null, renderList(editorPreview.value, (line, li) => {
							return openBlock(), createElementBlock(Fragment, { key: li }, [line.kind === "buttons" && line.buttons.length ? (openBlock(), createElementBlock("div", _hoisted_86, [(openBlock(true), createElementBlock(Fragment, null, renderList(line.buttons, (b, ti) => {
								return openBlock(), createElementBlock("span", {
									key: ti,
									class: normalizeClass(["eqt-settings__preview-tag", { "eqt-settings__preview-tag--url": b.kind === "url" }])
								}, toDisplayString(b.label || (b.kind === "tag" ? b.tags.join(", ") : b.url) || unref(t)("settings.emptyTag")), 3);
							}), 128))])) : createCommentVNode("", true)], 64);
						}), 128))], 2)) : createCommentVNode("", true),
						withDirectives(createBaseVNode("textarea", {
							"onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => editorText.value = $event),
							class: "eqt-json-editor__textarea",
							spellcheck: "false",
							autocomplete: "off",
							readonly: editingDeleted.value || editingCorrupted.value
						}, null, 8, _hoisted_87), [[vModelText, editorText.value]]),
						editorError.value ? (openBlock(), createElementBlock("p", _hoisted_88, toDisplayString(unref(t)("settings.editorJsonError", { message: editorError.value })), 1)) : createCommentVNode("", true),
						editingCorrupted.value ? (openBlock(), createElementBlock("div", _hoisted_89, [unref(corruptedProfiles)[editingProfileIdx.value] ? (openBlock(), createElementBlock("p", _hoisted_90, toDisplayString(unref(t)("settings.corruptedReason", { reason: unref(corruptedProfiles)[editingProfileIdx.value].reason })), 1)) : createCommentVNode("", true), createBaseVNode("button", {
							class: "eqt-popup__btn eqt-popup__btn--delete",
							type: "button",
							onClick: _cache[11] || (_cache[11] = ($event) => onPurgeCorrupted(editingProfileIdx.value))
						}, toDisplayString(unref(t)("settings.purgeProfile")), 1)])) : editingDeleted.value ? (openBlock(), createElementBlock("div", _hoisted_91, [createBaseVNode("button", {
							class: "eqt-popup__btn eqt-popup__btn--primary",
							type: "button",
							onClick: _cache[12] || (_cache[12] = ($event) => onRestore(editingProfileIdx.value))
						}, toDisplayString(unref(t)("settings.restoreProfile")), 1), createBaseVNode("button", {
							class: "eqt-popup__btn eqt-popup__btn--delete",
							type: "button",
							onClick: _cache[13] || (_cache[13] = ($event) => onPurge(editingProfileIdx.value))
						}, toDisplayString(unref(t)("settings.purgeProfile")), 1)])) : (openBlock(), createElementBlock("div", _hoisted_92, [_cache[27] || (_cache[27] = createBaseVNode("div", { class: "eqt-popup__spacer" }, null, -1)), createBaseVNode("button", {
							class: "eqt-popup__btn eqt-popup__btn--primary",
							type: "button",
							onClick: onEditorSave
						}, toDisplayString(unref(t)("settings.save")), 1)]))
					], 512), [[vShow, editingProfileIdx.value >= 0]])]),
					createBaseVNode("aside", _hoisted_93, [
						createBaseVNode("h4", _hoisted_94, toDisplayString(unref(t)("settings.profilesTitle")), 1),
						createVNode(unref(draggableComponent), mergeProps(dragOptions, {
							"model-value": unref(profiles),
							"item-key": profileUid,
							filter: ".eqt-settings__item-btn",
							"prevent-on-filter": false,
							tag: "ul",
							class: "eqt-settings__ns-list",
							onChange: onProfileChange,
							onStart: onProfileStart,
							onEnd: onProfileEnd
						}), {
							item: withCtx(({ element: p, index: i }) => [createBaseVNode("li", {
								class: normalizeClass(["eqt-settings__ns-item eqt-settings__ns-item--clickable", { "eqt-settings__ns-item--chosen": editingProfileIdx.value === i && !editingDeleted.value && !editingCorrupted.value }]),
								onClick: ($event) => openEditor(i)
							}, [
								createBaseVNode("span", _hoisted_96, [createTextVNode(toDisplayString(p.name) + " ", 1), i === unref(activeProfileIdx) ? (openBlock(), createElementBlock("span", _hoisted_97, toDisplayString(unref(t)("settings.activeBadge")), 1)) : createCommentVNode("", true)]),
								createBaseVNode("span", _hoisted_98, toDisplayString(tagCounts.value[i]), 1),
								unref(profiles).length > 1 ? (openBlock(), createElementBlock("button", {
									key: 0,
									class: "eqt-settings__item-btn eqt-settings__item-btn--purge",
									type: "button",
									title: unref(t)("settings.moveToTrash"),
									onClick: withModifiers(($event) => onDelete(i), ["stop"])
								}, [createVNode(unref(Trash2), { size: 12 })], 8, _hoisted_99)) : createCommentVNode("", true)
							], 10, _hoisted_95)]),
							_: 1
						}, 16, ["model-value"]),
						unref(deletedProfiles).length ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [createBaseVNode("h4", _hoisted_100, toDisplayString(unref(t)("settings.trash")), 1), createBaseVNode("ul", _hoisted_101, [(openBlock(true), createElementBlock(Fragment, null, renderList(unref(deletedProfiles), (p, i) => {
							return openBlock(), createElementBlock("li", {
								key: i,
								class: normalizeClass(["eqt-settings__ns-item eqt-settings__ns-item--clickable", { "eqt-settings__ns-item--chosen": editingProfileIdx.value === i && editingDeleted.value }]),
								onClick: ($event) => openEditor(i, true)
							}, [createBaseVNode("span", _hoisted_103, toDisplayString(p.name), 1), createBaseVNode("span", _hoisted_104, toDisplayString(deletedTagCounts.value[i]), 1)], 10, _hoisted_102);
						}), 128))])], 64)) : createCommentVNode("", true),
						unref(corruptedProfiles).length ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [createBaseVNode("h4", _hoisted_105, toDisplayString(unref(t)("settings.corrupted")), 1), createBaseVNode("ul", _hoisted_106, [(openBlock(true), createElementBlock(Fragment, null, renderList(unref(corruptedProfiles), (c, i) => {
							return openBlock(), createElementBlock("li", {
								key: i,
								class: normalizeClass(["eqt-settings__ns-item eqt-settings__ns-item--clickable", { "eqt-settings__ns-item--chosen": editingProfileIdx.value === i && editingCorrupted.value }]),
								onClick: ($event) => openCorrupted(i)
							}, [createBaseVNode("span", _hoisted_108, toDisplayString(new Date(c.savedAt).toLocaleString()), 1)], 10, _hoisted_107);
						}), 128))])], 64)) : createCommentVNode("", true)
					])
				], 512)]);
			};
		}
	});
	var App_default = defineComponent({
		__name: "App",
		setup(__props) {
			const effectiveNsOrder = computed(() => {
				const disabled = new Set(disabledNs.value);
				return nsOrder.value.filter((ns) => !disabled.has(ns));
			});
			watch([fontFamily, fontWeight], () => {
				const root = document.documentElement;
				if (fontFamily.value) root.style.setProperty("--eqt-font-family", fontFamily.value);
				else root.style.removeProperty("--eqt-font-family");
				if (fontWeight.value) root.style.setProperty("--eqt-font-weight", fontWeight.value);
				else root.style.removeProperty("--eqt-font-weight");
			}, { immediate: true });
			const prevProfileName = computed(() => {
				const idx = activeProfileIdx.value - 1;
				return idx >= 0 ? profiles[idx].name : "";
			});
			const nextProfileName = computed(() => {
				const idx = activeProfileIdx.value + 1;
				return idx < profiles.length ? profiles[idx].name : "";
			});
			function onPrevProfile() {
				switchProfile(activeProfileIdx.value - 1);
			}
			function onNextProfile() {
				switchProfile(activeProfileIdx.value + 1);
			}
			function onRenameProfile(name) {
				renameProfile(activeProfileIdx.value, name);
			}
			function onCreateProfile(name) {
				createProfile(name);
			}
			function onDeleteProfile() {
				deleteProfile(activeProfileIdx.value);
			}
			const searchText = ref("");
			const anchorReady = ref(false);
			let searchInput = null;
			const editingLine = ref(-1);
			const editingIdx = ref(-1);
			const pendingAdd = ref(false);
			const showTagPopup = ref(false);
			const showUrlPopup = ref(false);
			const draftTagButton = ref({
				kind: "tag",
				tags: []
			});
			const draftUrlButton = ref({
				kind: "url",
				url: ""
			});
			function onConfigure(lineIdx, tagIdx) {
				editingLine.value = lineIdx;
				editingIdx.value = tagIdx;
				pendingAdd.value = false;
				const line = lines[lineIdx];
				if (line.kind !== "buttons") return;
				if (line.buttons[tagIdx].kind === "url") showUrlPopup.value = true;
				else showTagPopup.value = true;
			}
			function onAdd(type = "tag") {
				if (type === "url") draftUrlButton.value = {
					kind: "url",
					url: "",
					label: ""
				};
				else draftTagButton.value = {
					kind: "tag",
					tags: [],
					label: ""
				};
				const last = lines[lines.length - 1];
				if (!last || last.kind !== "buttons") lines.push({
					kind: "buttons",
					buttons: []
				});
				editingLine.value = lines.length - 1;
				pendingAdd.value = true;
				if (type === "url") showUrlPopup.value = true;
				else showTagPopup.value = true;
			}
			function onSave(updated) {
				const line = lines[editingLine.value];
				if (line.kind !== "buttons") return;
				if (pendingAdd.value) line.buttons.push(updated);
				else line.buttons[editingIdx.value] = updated;
				pendingAdd.value = false;
				showTagPopup.value = false;
				showUrlPopup.value = false;
			}
			function onDelete() {
				const line = lines[editingLine.value];
				if (line.kind === "buttons") line.buttons.splice(editingIdx.value, 1);
				pendingAdd.value = false;
				showTagPopup.value = false;
				showUrlPopup.value = false;
			}
			function onClose() {
				pendingAdd.value = false;
				showTagPopup.value = false;
				showUrlPopup.value = false;
			}
			const tagPopupValue = computed(() => {
				if (!showTagPopup.value) return null;
				if (pendingAdd.value) return draftTagButton.value;
				const line = lines[editingLine.value];
				if (!line || line.kind !== "buttons") return null;
				const b = line.buttons[editingIdx.value];
				return b && b.kind === "tag" ? b : null;
			});
			const urlPopupValue = computed(() => {
				if (!showUrlPopup.value) return null;
				if (pendingAdd.value) return draftUrlButton.value;
				const line = lines[editingLine.value];
				if (!line || line.kind !== "buttons") return null;
				const b = line.buttons[editingIdx.value];
				return b && b.kind === "url" ? b : null;
			});
			const editingLineColor = computed(() => {
				const line = lines[editingLine.value];
				return line?.kind === "buttons" ? line.color : void 0;
			});
			const showSettings = ref(false);
			function onSearch(action) {
				if (!searchInput?.form) return;
				if (action === "searchNewTab") {
					const url = new URL(searchInput.form.action || window.location.href);
					new FormData(searchInput.form).forEach((v, k) => url.searchParams.set(k, v));
					_GM_openInTab(url.href, { active: newTabActive.value });
				} else searchInput.form.submit();
			}
			onMounted(() => {
				loadTagDb({
					mirror: tagDbMirror.value,
					ttlDays: tagDbTtlDays.value
				});
				searchInput = document.querySelector("#f_search");
				if (!searchInput) return;
				searchText.value = searchInput.value;
				searchInput.addEventListener("input", () => {
					searchText.value = searchInput.value;
				});
				const anchor = document.createElement("div");
				anchor.id = "eqt-bar-anchor";
				searchInput.parentElement.appendChild(anchor);
				anchorReady.value = true;
			});
			watch(searchText, (val) => {
				if (searchInput && searchInput.value !== val) searchInput.value = val;
			});
			return (_ctx, _cache) => {
				return openBlock(), createElementBlock(Fragment, null, [
					anchorReady.value ? (openBlock(), createBlock(Teleport, {
						key: 0,
						to: "#eqt-bar-anchor"
					}, [createVNode(TagBar_default, {
						"profile-name": unref(profiles)[unref(activeProfileIdx)]?.name ?? "",
						"profile-idx": unref(activeProfileIdx),
						"profile-count": unref(profiles).length,
						"prev-profile-name": prevProfileName.value,
						"next-profile-name": nextProfileName.value,
						"search-text": searchText.value,
						"onUpdate:searchText": _cache[0] || (_cache[0] = ($event) => searchText.value = $event),
						onConfigure,
						onAdd: _cache[1] || (_cache[1] = ($event) => onAdd("tag")),
						onAddUrl: _cache[2] || (_cache[2] = ($event) => onAdd("url")),
						onPrevProfile,
						onNextProfile,
						onRenameProfile,
						onCreateProfile,
						onDeleteProfile,
						onSettings: _cache[3] || (_cache[3] = ($event) => showSettings.value = true),
						onSearch
					}, null, 8, [
						"profile-name",
						"profile-idx",
						"profile-count",
						"prev-profile-name",
						"next-profile-name",
						"search-text"
					])])) : createCommentVNode("", true),
					tagPopupValue.value ? (openBlock(), createBlock(TagConfigPopup_default, {
						key: 1,
						tag: tagPopupValue.value,
						"line-color": editingLineColor.value,
						"is-add": pendingAdd.value,
						"use-nh-weight": unref(useNhWeight),
						"ns-order": effectiveNsOrder.value,
						"ns-format": unref(nsFormat),
						"default-exact-match": unref(defaultExactMatch),
						onSave,
						onDelete,
						onClose
					}, null, 8, [
						"tag",
						"line-color",
						"is-add",
						"use-nh-weight",
						"ns-order",
						"ns-format",
						"default-exact-match"
					])) : createCommentVNode("", true),
					urlPopupValue.value ? (openBlock(), createBlock(UrlConfigPopup_default, {
						key: 2,
						tag: urlPopupValue.value,
						"line-color": editingLineColor.value,
						"is-add": pendingAdd.value,
						onSave,
						onDelete,
						onClose
					}, null, 8, [
						"tag",
						"line-color",
						"is-add"
					])) : createCommentVNode("", true),
					showSettings.value ? (openBlock(), createBlock(SettingsPopup_default, {
						key: 3,
						"use-nh-weight": unref(useNhWeight),
						"onUpdate:useNhWeight": _cache[4] || (_cache[4] = ($event) => isRef(useNhWeight) ? useNhWeight.value = $event : null),
						"ns-order": unref(nsOrder),
						"disabled-ns": unref(disabledNs),
						"onUpdate:nsOrder": _cache[5] || (_cache[5] = ($event) => nsOrder.value = $event),
						"onUpdate:disabledNs": _cache[6] || (_cache[6] = ($event) => disabledNs.value = $event),
						onClose: _cache[7] || (_cache[7] = ($event) => showSettings.value = false)
					}, null, 8, [
						"use-nh-weight",
						"ns-order",
						"disabled-ns"
					])) : createCommentVNode("", true)
				], 64);
			};
		}
	});
	_css("#eqt-bar-anchor{font-family:var(--eqt-font-family,inherit);font-weight:var(--eqt-font-weight,inherit);line-height:1.4}#eqt-app{font-family:var(--eqt-font-family,inherit);line-height:1.4}#eqt-app button,#eqt-app a,#eqt-bar-anchor button,#eqt-bar-anchor a{font-family:inherit;font-weight:inherit;line-height:inherit}:root{--eqt-row-h:24px;--eqt-bg:#edebdf;--eqt-bg-elevated:#fff;--eqt-bg-hover:#0000000f;--eqt-bg-active:#ddd8c8;--eqt-bg-btn:#edeada;--eqt-bg-btn-hover:#e2dfcf;--eqt-bg-disabled:#e8e6da;--eqt-text:#34353b;--eqt-text-secondary:#5c0d12;--eqt-text-hint:#8a8271;--eqt-border:#b5a4a4;--eqt-border-width:2px;--eqt-border-focus:#4a7c59;--eqt-divider:#c5c0b0;--eqt-overlay:#0006;--eqt-shadow:0 4px 16px #00000040;--eqt-grip:#b0a89a;--eqt-status-include:#4a7c59;--eqt-status-or:#f5c518;--eqt-status-exclude:#8c3333}:root.eqt-dark{--eqt-bg:#34353b;--eqt-bg-elevated:#2b2c31;--eqt-bg-hover:#ffffff0f;--eqt-bg-active:#4a4b52;--eqt-bg-btn:#34353b;--eqt-bg-btn-hover:#3e3f45;--eqt-bg-disabled:#2b2c31;--eqt-text:#ddd;--eqt-text-secondary:#ddd;--eqt-text-hint:#8a8a8a;--eqt-border:#8d8d8d;--eqt-border-width:2px;--eqt-border-focus:#5a9a6a;--eqt-divider:#4f535b;--eqt-overlay:#0009;--eqt-shadow:0 4px 16px #00000080;--eqt-grip:#6a6b70;--eqt-status-include:#4a7c59;--eqt-status-or:#f5c518;--eqt-status-exclude:#8c3333}");
	_css(".eqt-tag-bar__btn.eqt-tag-bar__btn--include{background:color-mix(in srgb, var(--line-color,var(--eqt-status-include)) 55%, transparent)}.eqt-tag-bar__btn.eqt-tag-bar__btn--include:hover{background:color-mix(in srgb, var(--line-color,var(--eqt-status-include)) 70%, transparent)}.eqt-tag-bar__btn.eqt-tag-bar__btn--or{background:color-mix(in srgb, var(--eqt-status-or) 55%, transparent)}.eqt-tag-bar__btn.eqt-tag-bar__btn--or:hover{background:color-mix(in srgb, var(--eqt-status-or) 70%, transparent)}.eqt-tag-bar__btn.eqt-tag-bar__btn--exclude{background:color-mix(in srgb, var(--eqt-status-exclude) 55%, transparent);text-decoration:line-through;text-decoration-thickness:2px}.eqt-tag-bar__btn.eqt-tag-bar__btn--exclude:hover{background:color-mix(in srgb, var(--eqt-status-exclude) 70%, transparent)}.eqt-tag-style-3d .eqt-tag-bar__btn,.eqt-tag-style-3d .eqt-settings__preview-tag,.eqt-tag-style-3d .eqt-popup__name-input{border-color:var(--line-color,var(--eqt-border));box-shadow:0 2px 0 0 var(--line-color,var(--eqt-border));background:color-mix(in srgb, var(--line-color,transparent) 15%, transparent);color:var(--eqt-text-secondary);transition:background .15s,border-color .15s,color .15s,transform .1s,box-shadow .1s}.eqt-tag-style-3d .eqt-tag-bar__btn:hover{background:var(--eqt-bg-hover);box-shadow:0 3px 0 0 var(--line-color,var(--eqt-border));transform:translateY(-1px)}.eqt-tag-style-3d .eqt-tag-bar__btn:active{box-shadow:none;transform:translateY(2px)}.eqt-tag-style-3d .eqt-tag-bar__btn.eqt-tag-bar__btn--include{background:color-mix(in srgb, var(--line-color,var(--eqt-status-include)) 55%, transparent)}.eqt-tag-style-3d .eqt-tag-bar__btn.eqt-tag-bar__btn--include:hover{background:color-mix(in srgb, var(--line-color,var(--eqt-status-include)) 70%, transparent)}.eqt-tag-style-3d .eqt-tag-bar__btn.eqt-tag-bar__btn--or{background:color-mix(in srgb, var(--eqt-status-or) 55%, transparent)}.eqt-tag-style-3d .eqt-tag-bar__btn.eqt-tag-bar__btn--or:hover{background:color-mix(in srgb, var(--eqt-status-or) 70%, transparent)}.eqt-tag-style-3d .eqt-tag-bar__btn.eqt-tag-bar__btn--exclude{background:color-mix(in srgb, var(--eqt-status-exclude) 55%, transparent);text-decoration:line-through;text-decoration-thickness:2px}.eqt-tag-style-3d .eqt-tag-bar__btn.eqt-tag-bar__btn--exclude:hover{background:color-mix(in srgb, var(--eqt-status-exclude) 70%, transparent)}.eqt-tag-style-3d .eqt-tag-bar__btn.eqt-tag-bar__btn--editing{transition:background .15s,border-color .15s,color .15s}.eqt-tag-style-3d .eqt-tag-bar__btn.eqt-tag-bar__btn--editing:hover{background:var(--eqt-bg-hover);box-shadow:0 2px 0 0 var(--line-color,var(--eqt-border));transform:none}.eqt-tag-style-3d .eqt-tag-bar__btn.eqt-tag-bar__btn--drag{box-shadow:0 2px 0 0 var(--line-color,var(--eqt-border)), 0 2px 8px #0003}.eqt-tag-style-pushable .eqt-tag-bar__btn,.eqt-tag-style-pushable .eqt-settings__preview-tag,.eqt-tag-style-pushable .eqt-popup__name-input{border-color:var(--line-color,var(--eqt-border));background:color-mix(in srgb, var(--line-color,var(--eqt-bg-btn)) 15%, var(--eqt-bg-btn));color:var(--eqt-text-secondary);transform-style:preserve-3d;border-radius:.5em;transition:background .15s ease-out,transform .15s ease-out;position:relative}.eqt-tag-style-pushable .eqt-tag-bar__btn:before,.eqt-tag-style-pushable .eqt-settings__preview-tag:before,.eqt-tag-style-pushable .eqt-popup__name-input:before{content:\"\";background:color-mix(in srgb, var(--line-color,var(--eqt-bg-active)) 70%, var(--eqt-bg-active));border-radius:inherit;width:100%;height:100%;box-shadow:0 0 0 2px var(--line-color,var(--eqt-border));transition:transform .15s ease-out;position:absolute;top:0;left:0;transform:translate3d(0,.3em,-1em)}.eqt-tag-style-pushable .eqt-tag-bar__btn:hover{background:var(--eqt-bg-hover);transform:translateY(.1em)}.eqt-tag-style-pushable .eqt-tag-bar__btn:hover:before{transform:translate3d(0,.2em,-1em)}.eqt-tag-style-pushable .eqt-tag-bar__btn:active{background:var(--eqt-bg-hover);transform:translateY(.3em)}.eqt-tag-style-pushable .eqt-tag-bar__btn:active:before{transform:translateZ(-1em)}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--include{background:color-mix(in srgb, var(--line-color,var(--eqt-status-include)) 55%, transparent)}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--include:hover{background:color-mix(in srgb, var(--line-color,var(--eqt-status-include)) 70%, transparent)}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--or{background:color-mix(in srgb, var(--eqt-status-or) 55%, transparent)}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--or:hover{background:color-mix(in srgb, var(--eqt-status-or) 70%, transparent)}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--exclude{background:color-mix(in srgb, var(--eqt-status-exclude) 55%, transparent);text-decoration:line-through;text-decoration-thickness:2px}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--exclude:hover{background:color-mix(in srgb, var(--eqt-status-exclude) 70%, transparent)}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--editing{transition:background .15s,border-color .15s,color .15s}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--editing:hover{background:var(--eqt-bg-hover);transform:none}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--editing:hover:before{transform:translate3d(0,.3em,-1em)}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--drag{box-shadow:0 2px 8px #0003}.eqt-tag-style-pushable .eqt-tag-bar__btn.eqt-tag-bar__btn--drag:before{display:none}.eqt-tag-style-offset .eqt-tag-bar__btn,.eqt-tag-style-offset .eqt-settings__preview-tag,.eqt-tag-style-offset .eqt-popup__name-input{border-color:var(--line-color,var(--eqt-border));background:color-mix(in srgb, var(--line-color,transparent) 15%, transparent);color:var(--eqt-text-secondary);box-shadow:1.5px 1.5px 0 0 var(--line-color,var(--eqt-border));border-radius:5px;transition:background .15s,border-color .15s,color .15s,transform .1s,box-shadow .1s}.eqt-tag-style-offset .eqt-tag-bar__btn:hover{background:var(--eqt-bg-hover)}.eqt-tag-style-offset .eqt-tag-bar__btn:active{transform:translate(1.5px,1.5px);box-shadow:0 0 #0000}.eqt-tag-style-offset .eqt-tag-bar__btn.eqt-tag-bar__btn--include{background:color-mix(in srgb, var(--line-color,var(--eqt-status-include)) 55%, transparent)}.eqt-tag-style-offset .eqt-tag-bar__btn.eqt-tag-bar__btn--include:hover{background:color-mix(in srgb, var(--line-color,var(--eqt-status-include)) 70%, transparent)}.eqt-tag-style-offset .eqt-tag-bar__btn.eqt-tag-bar__btn--or{background:color-mix(in srgb, var(--eqt-status-or) 55%, transparent)}.eqt-tag-style-offset .eqt-tag-bar__btn.eqt-tag-bar__btn--or:hover{background:color-mix(in srgb, var(--eqt-status-or) 70%, transparent)}.eqt-tag-style-offset .eqt-tag-bar__btn.eqt-tag-bar__btn--exclude{background:color-mix(in srgb, var(--eqt-status-exclude) 55%, transparent);text-decoration:line-through;text-decoration-thickness:2px}.eqt-tag-style-offset .eqt-tag-bar__btn.eqt-tag-bar__btn--exclude:hover{background:color-mix(in srgb, var(--eqt-status-exclude) 70%, transparent)}.eqt-tag-style-offset .eqt-tag-bar__btn.eqt-tag-bar__btn--editing{transition:background .15s,border-color .15s,color .15s}.eqt-tag-style-offset .eqt-tag-bar__btn.eqt-tag-bar__btn--editing:hover{background:var(--eqt-bg-hover);box-shadow:1.5px 1.5px 0 0 var(--line-color,var(--eqt-border));transform:none}.eqt-tag-style-offset .eqt-tag-bar__btn.eqt-tag-bar__btn--drag{box-shadow:1.5px 1.5px 0 0 var(--line-color,var(--eqt-border)), 0 2px 8px #0003}");
	(async () => {
		await loadStore();
		createApp(App_default).mount((() => {
			if (location.hostname === "exhentai.org") document.documentElement.classList.add("eqt-dark");
			const container = document.createElement("div");
			container.id = "eqt-app";
			container.setAttribute("translate", "no");
			document.body.append(container);
			return container;
		})());
		startAutoSave();
	})();
})();
