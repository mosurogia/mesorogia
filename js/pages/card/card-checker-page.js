/**
 * js/pages/card/card-checker-page.js
 * - card-checker（所持率チェッカー）ページ固有の初期化/配線
 * - 共有リンク系（X intent等）はここでは持たない（削除方針）
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // ✅ summary.js 側に寄せた場合でも落ちない
    if (typeof window.updateSummary === 'function') window.updateSummary();
    else if (window.Summary?.updateSummary) window.Summary.updateSummary();
  });

  // グローバル初期値（未定義エラー防止）
  window.PACK_ORDER = window.PACK_ORDER || [];
  window.packs      = window.packs || [];

  // packs が未設定なら packs.json から埋める
  (async () => {
    try {
      if (!Array.isArray(window.packs) || !window.packs.length) {
        const res = await fetch('public/packs.json');
        const packs = await res.json();
        window.packs = packs;
      }
    } catch (e) {
      console.warn('packs.json の読み込みに失敗', e);
    }
  })();

  /*===================
      3.メニューボタン
  ====================*/

  // 所持率データ保存（保存後は未保存フラグをクリア & A更新）
  window.saveOwnership = function saveOwnership() {
    if (!window.OwnedStore?.save) { alert('保存機能が初期化されていません'); return; }
    try {
      window.OwnedStore.save();
      // A更新
      try { window.commitOwnedSnapshot?.(); } catch {}
    } catch (e) {
      console.warn(e);
      alert('保存に失敗しました');
    }
  };

  // （必要なら）モバイルのパック選択 → ジャンプ
  window.selectMobilePack = function selectMobilePack(value) {
    const sel = document.getElementById('pack-selector');
    if (sel) sel.value = value;
    window.jumpToSelectedPack();
  };

  // ✅ HTML の onclick="jumpToSelectedPack()" から呼ばれるので window に公開
  window.jumpToSelectedPack = function jumpToSelectedPack() {
    const sel = document.getElementById('pack-selector');
    const key = sel?.value;
    if (!key || key === 'all') return;

    const target = document.querySelector(`#pack-${key}`);
    if (!target) return;

    const headerEl = document.querySelector('.top-summary');
    const offset   = headerEl ? headerEl.getBoundingClientRect().height : 0;

    const rect = target.getBoundingClientRect();
    const y = window.scrollY + rect.top - offset - 10;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };
})();
