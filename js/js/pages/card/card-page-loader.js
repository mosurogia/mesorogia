/**
 * js/pages/card/card-page-loader.js
 * - cardページ専用ローダー：js/pages/card 配下を「依存順」で順番読み込み
 * - HTML は「共通（common/ui/features）」＋「このローダー1本」だけ置けばOK
 *
 * 読み込み順ルール:
 * 1) 一覧（card-list）→ 2) 表示切替（view mode）
 * 3) checker（owned ops → page wiring → render）
 * 4) 保存フロー（owned-save-flow）
 * 読み込み完了後に window イベント 'card-page:ready' を dispatch する
 */

(function () {
  'use strict';

  const BASE = 'js/pages/card/';
  const FILES = [
    'card-list.js',
    'cardsViewMode.js',

    // checker
    'card-checker-owned-ops.js',
    'card-checker-page.js',
    'card-checker-render.js',
    'owned-save-flow.js',
  ];

  function loadSequential(i) {
        if (i >= FILES.length) {
        fireReady_();
            return;
        }
    const s = document.createElement('script');
    s.src = BASE + FILES[i];
    s.async = false;
    s.onload = () => loadSequential(i + 1);
    s.onerror = () => console.error('[card-page-loader] failed:', s.src);
    document.head.appendChild(s);
  }

  loadSequential(0);
})();

function fireReady_(){
  // DOMがまだなら待つ
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fireReady_, { once: true });
    return;
  }
  // ✅ “後から読み込まれたJS”でも拾える合図
  window.dispatchEvent(new Event('card-page:ready'));
}

