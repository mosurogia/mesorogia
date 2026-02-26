/**
 * js/pages/deckmaker/card-display.js
 *
 * 【役割】
 * デッキメーカー画面専用の表示補助ロジック。
 *
 * - 操作モーダル（cardOpModal）内の「効果リスト」表示を構築する
 *
 * 【設計方針】
 * - カードデータ取得・cardMap 構築は common/card-core.js に委譲（cards_latest.json を読む）
 * - 詳細HTML生成は ui/card-detail-template.js（window.generateDetailHtml）に委譲
 * - このファイルは deckmaker 固有の「操作モーダル表示」だけ担当する
 */
(function () {
  'use strict';

  /**
   * 操作モーダルに効果リストを描画する（deckmaker用）
   * @param {object} info - cardMapのカード情報 or dataset由来の情報
   */
  function buildCardOpEffects(info) {
    const wrap = document.getElementById('cardOpEffects');
    if (!wrap) return;

    wrap.innerHTML = '';

    const items = [];

    // effect_name1 が無いカードでも effect_name2 が入る可能性を潰す
    const names = [info.effect_name1, info.effect_name2].filter(Boolean);
    const texts = [info.effect_text1, info.effect_text2].filter(Boolean);

    for (let i = 0; i < Math.max(names.length, texts.length); i++) {
      items.push({
        name: names[i] || '効果',
        text: texts[i] || ''
      });
    }

    // 旧互換（page2由来）
    if (!items.length && (info.effect || info.text)) {
      items.push({ name: info.effect || '効果', text: info.text || '' });
    }

    // 何も無ければ「効果情報なし」
    if (!items.length) {
      const d = document.createElement('div');
      d.className = 'eff';
      d.innerHTML = '<div class="eff-name">効果</div><div class="eff-text">（効果情報なし）</div>';
      wrap.appendChild(d);
      return;
    }

    for (const it of items) {
      const d = document.createElement('div');
      d.className = 'eff';
      d.innerHTML =
        `<div class="eff-name">${window.escapeHtml_(it.name || '効果')}</div>` +
        `<div class="eff-text">${window.escapeHtml_(it.text || '')}</div>`;
      wrap.appendChild(d);
    }
  }

  // グローバル公開（deckmakerの既存呼び出し互換）
  window.buildCardOpEffects = window.buildCardOpEffects || buildCardOpEffects;
})();
