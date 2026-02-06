/**
 * js/pages/card/card-page-loader.js
 * - cardページで使う js/pages/card 配下のスクリプトを順番に読み込むローダー
 * - HTML にはこの1本だけ置けばOK
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
    if (i >= FILES.length) return;
    const s = document.createElement('script');
    s.src = BASE + FILES[i];
    s.async = false;
    s.onload = () => loadSequential(i + 1);
    s.onerror = () => console.error('[card-page-loader] failed:', s.src);
    document.head.appendChild(s);
  }

  loadSequential(0);
})();
