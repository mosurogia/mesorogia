/**
 * common/card-core.js
 * - cards_latest / packs / 検索index など「カードデータ基盤」
 *
 * 役割（このファイルに置くもの）
 * - JSON取得の共通ヘルパ（複数候補URL対応）
 * - cards_latest の取得（latest抽出）＋ cardMap 構築
 * - packs カタログ読み込み（packs.json → フォールバック）
 * - pack 名分解 / slug 生成 / 略称キー判定
 * - （暫定）カードソート（将来は features に分離推奨）
 */
(function () {
  'use strict';

  // =====================================================
  // 0) グローバル基盤（互換のため window に保持）
  // =====================================================

  // カードマスタ全体（cd → card オブジェクト）※現状未使用でも互換維持
  window.allCardsMap = window.allCardsMap || {};

  // デッキ情報 / カード情報を保持するオブジェクト（互換維持）
  window.deck = window.deck || {};
  window.cardMap = window.cardMap || {};

  // ---- 参照URL（ページごとにズレても拾えるように候補を持つ）----
  window.CARDS_JSON_CANDIDATES = window.CARDS_JSON_CANDIDATES || [
    'public/cards_latest.json',
    './public/cards_latest.json',
    'cards_latest.json',
    './cards_latest.json',
  ];

  window.PACKS_JSON_CANDIDATES = window.PACKS_JSON_CANDIDATES || [
    'public/packs.json',
    './public/packs.json',
    'packs.json',
    './packs.json',
  ];

  // =====================================================
  // 1) JSON取得：最初に成功したものを返す（404/HTML混入も弾く）
  // =====================================================

  async function fetchJsonFirstOk_(urls) {
    let lastErr = null;

    for (const url of (urls || [])) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;

        // content-type が怪しくても text→JSON.parse で判定
        const text = await res.text();

        // 404 HTML を JSON として読んで落ちるのを防ぐ
        if (/^\s*</.test(text)) continue;

        return JSON.parse(text);
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error('JSON not found');
  }

  // =====================================================
  // 2) cards_latest.json：latest抽出
  // =====================================================

  async function fetchLatestCards() {
    const allCards = await fetchJsonFirstOk_(window.CARDS_JSON_CANDIDATES);
    if (!Array.isArray(allCards)) return [];
    return allCards.filter(card => card && card.is_latest === true);
  }

  // グローバル公開（common-page124.js 等が呼ぶ）
  window.fetchLatestCards = window.fetchLatestCards || fetchLatestCards;

  // =====================================================
  // 3) cardMap 構築（cd5正規化）
  // =====================================================

  function normalizeCd5_(cdRaw) {
    const cd5 = String(cdRaw ?? '').trim().padStart(5, '0');
    return cd5 && cd5 !== '00000' ? cd5 : '';
  }

  function buildCardMapFromCards_(cards) {
    if (!Array.isArray(cards)) return;

    for (const card of cards) {
      const cd5 = normalizeCd5_(card.cd ?? card.id);
      if (!cd5) continue;

      window.cardMap[cd5] = {
        cd: cd5,
        name: card.name || '',
        race: card.race || '',
        type: card.type || '',
        cost: Number(card.cost ?? 0) || 0,
        power: Number(card.power ?? 0) || 0,
        rarity: card.rarity || '',
        packName: card.pack_name || '',
        category: card.category || '',
        effect_name1: card.effect_name1 || '',
        effect_text1: card.effect_text1 || '',
        effect_name2: card.effect_name2 || '',
        effect_text2: card.effect_text2 || '',
      };
    }
  }

  async function ensureCardMapLoaded() {
    if (window.cardMap && Object.keys(window.cardMap).length > 0) return window.cardMap;

    try {
      const cards = await window.fetchLatestCards();
      buildCardMapFromCards_(cards);
    } catch (e) {
      console.error('[card-core] ensureCardMapLoaded: カードマスタ読み込み失敗', e);
    }
    return window.cardMap;
  }

  window.ensureCardMapLoaded = window.ensureCardMapLoaded || ensureCardMapLoaded;

  // =====================================================
  // 4) packs.json：カタログ（packs.json → フォールバック）
  // =====================================================

  window.__PackCatalog = window.__PackCatalog || null;

  function splitPackName(name = '') {
    const s = String(name || '');

    // 英名 + 「日本語」形式
    if (s.includes('「')) {
      const i = s.indexOf('「');
      return { en: s.slice(0, i).trim(), jp: s.slice(i).trim() };
    }

    // 英名／日本語 形式（「」に寄せる）
    if (s.includes('／')) {
      const [en, jp = ''] = s.split('／');
      return { en: en.trim(), jp: jp.trim() ? `「${jp.trim()}」` : '' };
    }

    return { en: s.trim(), jp: '' };
  }

  function makePackSlug(en = '') {
    const base = String(en || '').trim();
    const ascii = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return ascii || base;
  }

  async function loadPackCatalog() {
    if (window.__PackCatalog) return window.__PackCatalog;

    try {
      const raw = await fetchJsonFirstOk_(window.PACKS_JSON_CANDIDATES);

      const arr = Array.isArray(raw?.packs) ? raw.packs
                : Array.isArray(raw?.list) ? raw.list
                : [];

      const order = Array.isArray(raw?.order) ? raw.order : null;

      const list = arr.map(p => {
        const enRaw = String(p?.en ?? '').trim();
        const jpRaw = String(p?.jp ?? '').trim();

        const en = enRaw || (jpRaw ? jpRaw.replace(/[「」]/g, '') : '');
        const jp = jpRaw || '';

        const slug = p?.slug || makePackSlug(en);
        const key = p?.key || slug;

        return {
          key,
          en,
          jp,
          slug,
          labelTwoLine: `${en}${jp ? `\n${jp}` : ''}`,
        };
      });

      const byEn = new Map(list.map(x => [x.en, x]));
      const ord = (order && order.length) ? order : list.map(x => x.en);

      window.__PackCatalog = { list, byEn, order: ord };
      return window.__PackCatalog;

    } catch (e) {
      console.warn('[card-core] packs.json 読み込み失敗 → cards_latest.json から検出にフォールバック', e);

      const cards = await window.fetchLatestCards();
      const byEn = new Map();

      cards.forEach(c => {
        const { en, jp } = splitPackName(c.pack_name || '');
        if (en && !byEn.has(en)) byEn.set(en, { en, jp, slug: makePackSlug(en) });
      });

      const list = [...byEn.values()].sort((a, b) => a.en.localeCompare(b.en, 'ja'));
      list.forEach(x => {
        x.key = x.slug;
        x.labelTwoLine = `${x.en}${x.jp ? `\n${x.jp}` : ''}`;
      });

      window.__PackCatalog = {
        list,
        byEn: new Map(list.map(x => [x.en, x])),
        order: list.map(x => x.en),
      };
      return window.__PackCatalog;
    }
  }

  window.splitPackName = window.splitPackName || splitPackName;
  window.makePackSlug = window.makePackSlug || makePackSlug;
  window.loadPackCatalog = window.loadPackCatalog || loadPackCatalog;

  // =====================================================
  // 5) パック略称キー（A〜E / SPECIAL / COLLAB / ''）
  // =====================================================

  window.packKeyFromAbbr = window.packKeyFromAbbr || function packKeyFromAbbr(abbr) {
    // 「」や空白を除去してから判定
    const s = String(abbr || '').replace(/[「」\s]/g, '');

    if (/^([A-E])パック/.test(s)) return s[0]; // A〜E
    if (s.includes('特殊')) return 'SPECIAL';
    if (s.includes('コラボ')) return 'COLLAB';
    return '';
  };

  // =====================================================
  // 6) カードソート（grid/list 両対応）
  // ※将来は js/features/ に分離推奨（今は互換のためここに残す）
  // =====================================================

  (function installSortCards_() {
    if (window.sortCards) return;

    function getTypeOrder_(type) {
      if (type === 'チャージャー') return 0;
      if (type === 'アタッカー') return 1;
      if (type === 'ブロッカー') return 2;
      return 3;
    }

    function getSortValue_() {
      const sortEl = document.getElementById('sort-select');
      return sortEl?.value || 'default';
    }

    function getKeyFromCardEl_(cardEl) {
      const type = getTypeOrder_(cardEl.dataset.type);
      const cost = parseInt(cardEl.dataset.cost, 10) || 0;
      const power = parseInt(cardEl.dataset.power, 10) || 0;
      const cd = String(cardEl.dataset.cd || '').padStart(5, '0');

      const cat = (typeof window.getCategoryOrder === 'function')
        ? window.getCategoryOrder(cardEl.dataset.category)
        : 9999;

      const rarityOrder = { 'レジェンド': 0, 'ゴールド': 1, 'シルバー': 2, 'ブロンズ': 3 };
      const rarity = rarityOrder[cardEl.dataset.rarity] ?? 99;

      return { type, cost, power, cd, cat, rarity };
    }

    window.sortCards = function sortCards() {
      const grid = document.getElementById('grid');
      if (!grid) return;

      const sortValue = getSortValue_();

      // list表示かどうか（#grid 直下が .list-row になる）
      const isList = grid.classList.contains('is-list') || !!grid.querySelector(':scope > .list-row');

      // 並び替え対象：grid=.card / list=.list-row
      const items = isList
        ? Array.from(grid.querySelectorAll(':scope > .list-row'))
        : Array.from(grid.querySelectorAll(':scope > .card'));

      if (!items.length) return;

      items.sort((A, B) => {
        const aCard = isList ? A.querySelector('.card') : A;
        const bCard = isList ? B.querySelector('.card') : B;
        if (!aCard || !bCard) return 0;

        const a = getKeyFromCardEl_(aCard);
        const b = getKeyFromCardEl_(bCard);

        switch (sortValue) {
          case 'cost-asc':
            return a.cost - b.cost || a.type - b.type || a.power - b.power || a.cd.localeCompare(b.cd);
          case 'cost-desc':
            return b.cost - a.cost || a.type - b.type || a.power - b.power || a.cd.localeCompare(b.cd);
          case 'power-asc':
            return a.power - b.power || a.type - b.type || a.cost - b.cost || a.cd.localeCompare(b.cd);
          case 'power-desc':
            return b.power - a.power || a.type - b.type || a.cost - b.cost || a.cd.localeCompare(b.cd);
          case 'category-order':
            return a.cat - b.cat || a.type - b.type || a.cost - b.cost || a.power - b.power || a.cd.localeCompare(b.cd);
          case 'rarity-order':
            return a.rarity - b.rarity || a.cost - b.cost || a.power - b.power || a.cd.localeCompare(b.cd);
          default:
            return a.type - b.type || a.cost - b.cost || a.power - b.power || a.cd.localeCompare(b.cd);
        }
      });

      // DOM反映
      for (const el of items) grid.appendChild(el);
    };
  })();

})();
