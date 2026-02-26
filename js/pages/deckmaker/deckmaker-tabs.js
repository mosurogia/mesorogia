/* =========================
 * pages/deckmaker/deckmaker-tabs.js
 * - デッキメーカーのタブ切替後処理
 * - ✅ どのタブでも共通同期（renderDeckList等）を必ず通す
 * ========================= */
(function () {
  'use strict';

  // ✅ 互換：tabs.js が afterTabSwitched を呼ぶ場合でも受けられるようにしておく
  // （page2.js が定義しているなら上書きしない）
  window.afterTabSwitched ??= function (targetId) {};

  document.addEventListener('tab:switched', (e) => {
    const id = e?.detail?.targetId;

    // ----------------------------
    // 1) タブ固有処理（returnしない）
    // ----------------------------
    if (id === 'edit') {
      // page2.js 側で window.updateDeckAnalysis / updateExchangeSummary を公開している想定
      if (typeof window.updateDeckAnalysis === 'function') window.updateDeckAnalysis();
      if (typeof window.updateExchangeSummary === 'function') window.updateExchangeSummary();

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (id === 'build') {
      // 所持オーバーレイ同期
      if (typeof window.refreshOwnedOverlay === 'function') window.refreshOwnedOverlay();

      // hideInvalidRace ONの時だけ hidden-by-grayscale を反映
      if (window.DeckmakerFilter?.applyHideInvalidRaceView) {
        window.DeckmakerFilter.applyHideInvalidRaceView();
      }
      // ✅ 旧互換：デッキ種族に応じたモノクロ/使用中ラベルを再適用
    if (typeof window.updateCardDisabling === 'function') window.updateCardDisabling();
    if (typeof window.applyGrayscaleFilter === 'function') window.applyGrayscaleFilter();
    }

    if (id === 'info-tab') {
      if (typeof window.updateDeckSummaryDisplay === 'function') window.updateDeckSummaryDisplay();
      if (typeof window.updateExchangeSummary === 'function') window.updateExchangeSummary();
    }

    if (id === 'info-tab' || id === 'post-tab') {
      if (typeof window.syncDeckNameFields === 'function') window.syncDeckNameFields();
    }
    if (id === 'post-tab') {
      // 投稿タブ初期化（旧 afterTabSwitched 相当）
      if (typeof window.initDeckPostTab === 'function') window.initDeckPostTab();
    }

    // ----------------------------
    // 2) ✅ 共通同期（どのタブでも必ずやる）
    // ----------------------------
    // デッキリストの×Nバッジ同期
    if (typeof window.renderDeckList === 'function' && document.getElementById('deck-card-list')) {
      window.renderDeckList();
      if (typeof window.autoscaleAllBadges === 'function') {
        requestAnimationFrame(window.autoscaleAllBadges);
      }
    }

    // 既存互換：他コードがこのイベントでプレビューを閉じる等
    document.dispatchEvent(new Event('deckTabSwitched'));
  });
})();