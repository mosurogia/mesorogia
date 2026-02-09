/**
 * js/pages/card/card-page-loader.js
 * - cardページ専用ローダー：js/pages/card 配下を「依存順」で順番読み込み
 * - HTML は「共通（common/ui/features）」＋「このローダー1本」だけ置けばOK
 *
 * 読み込み順ルール:
 * 1) 一覧（card-list）→ 2) 表示切替（view mode）
 * 3) checker（owned ops → page wiring → render）
 * 読み込み完了後に window イベント 'card-page:ready' を dispatch する
 */

(function () {
  'use strict';

  const BASE = 'js/pages/card/';
  const FILES = [
    'card-list.js',
    'cardsViewMode.js',
    'card-groups-ui.js',

    // checker
    'card-checker-owned-ops.js',
    'card-checker-render.js',
    'card-checker-page.js',
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

/* =====================================================
 * hash(#checker / #pack-xxx) に応じてタブを自動切替
 * - cards.html#checker
 * - cards.html#pack-awaking-the-oracle 等
 * ===================================================== */
(function () {
  'use strict';

  function handleHashJump_() {
    const hash = location.hash || '';
    if (!hash) return;

    const needChecker =
      hash === '#checker' ||
      hash.startsWith('#pack-') ||
      hash.startsWith('#race-') ||
      hash === '#packs-root';

    if (!needChecker) return;

    const tab2 = document.getElementById('tab2');

    // checkerタブへ切替
    if (typeof window.switchTab === 'function' && tab2) {
      window.switchTab('checker', tab2);
    } else {
      // フォールバック（最低限）
      document.getElementById('cards')?.classList.remove('active');
      document.getElementById('checker')?.classList.add('active');
      tab2?.classList.add('active');
      document.getElementById('tab1')?.classList.remove('active');
    }

    // 描画反映後にスクロール
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target =
          document.getElementById(hash.slice(1)) ||
          document.querySelector(hash);
        if (target) {
          target.scrollIntoView({ block: 'start' });
        }
      });
    });
  }

  // 初回ロード：card-page が全部準備できてから
  window.addEventListener('card-page:ready', handleHashJump_);

  // hash変更（Xリンクを踏んだ直後など）
  window.addEventListener('hashchange', handleHashJump_);
})();
