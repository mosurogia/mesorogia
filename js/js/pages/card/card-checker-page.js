/**
 * js/pages/card/card-checker-page.js
 * - 所持率チェッカー（カードページ統合）の「ページ配線」
 * - HTMLの onclick から呼ばれる関数を window に公開
 *
 * このファイルの役割:
 * - 保存ボタン（saveOwnership）
 * - モバイルpackセレクト→ジャンプ（selectMobilePack / jumpToSelectedPack）
 * - packs が未初期化のときのフォールバック読み込み（public/packs.json）
 *
 * 方針:
 * - デッキメーカー共有用のカスタムリンク生成は持たない（削除済み/今後も追加しない）
 */
(function () {
  'use strict';

  // =====================================================
  // 1) 初期化（summaryの更新だけ軽く）
  // =====================================================

  function initCheckerPage_(){
    if (typeof window.updateSummary === 'function') window.updateSummary();
    else if (window.Summary?.updateSummary) window.Summary.updateSummary();
  }
  window.addEventListener('DOMContentLoaded', initCheckerPage_);
  window.addEventListener('card-page:ready', initCheckerPage_);

  // =====================================================
  // 2) packs のフォールバック読み込み（未設定なら public/packs.json）
  // =====================================================

  window.PACK_ORDER = window.PACK_ORDER || [];
  window.packs      = window.packs || [];

  function normalizePacks_(raw){
    // 旧: 配列
    if (Array.isArray(raw)) return raw;

    // {list:[...]} 形式
    if (raw && Array.isArray(raw.list)) {
      return raw.list.map(x => ({
        key: x.key || x.slug || x.en,
        nameMain: x.en || x.nameMain || '',
        nameSub:  x.jp || x.nameSub || '',
        selector: x.selector || `#pack-${x.slug || x.key || ''}`,
      }));
    }

    // {packs:[...]} 形式
    if (raw && Array.isArray(raw.packs)) {
      return raw.packs.map(x => ({
        key: x.key || x.slug || x.en,
        nameMain: x.en || x.nameMain || '',
        nameSub:  x.jp || x.nameSub || '',
        selector: x.selector || `#pack-${x.slug || x.key || ''}`,
      }));
    }

    return [];
  }

  (async () => {
    try {
      // 既にpacksが配列で埋まっているなら何もしない
      if (Array.isArray(window.packs) && window.packs.length) return;

      const res = await fetch('public/packs.json', { cache: 'no-store' });
      const raw = await res.json();
      const arr = normalizePacks_(raw);

      if (arr.length) window.packs = arr;
      else console.warn('[card-checker-page] packs.json は読み込めたが配列に正規化できませんでした', raw);
    } catch (e) {
      console.warn('[card-checker-page] packs.json の読み込みに失敗', e);
    }
  })();

  // =====================================================
  // 3) メニューボタン（HTML onclick から呼ばれる）
  // =====================================================

  // 所持率データ保存（保存後は未保存フラグをクリア & スナップショット更新）
  window.saveOwnership = function saveOwnership() {
    if (!window.OwnedStore?.save) { alert('保存機能が初期化されていません'); return; }
    try {
      window.OwnedStore.save();
      try { window.commitOwnedSnapshot?.(); } catch {}
    } catch (e) {
      console.warn(e);
      alert('保存に失敗しました');
    }
  };

  // モバイルのパック選択 → ジャンプ
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
