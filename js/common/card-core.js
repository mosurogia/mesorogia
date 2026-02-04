/* =========================
 * common/card-core.js
 * - cards_latest / packs / 検索index など「カードデータ基盤」
 * ========================= */

//#region

//　カードマスタ全体（cd → card オブジェクト）
window.allCardsMap = window.allCardsMap || {};

// デッキ情報 / カード情報を保持するオブジェクト
window.deck = window.deck || {};
window.cardMap = window.cardMap || {};

// ---- 参照URL（ページごとにズレても拾えるように候補を持つ） ----
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

// ---- 最初に取れたJSONを返す（404/HTML混入も弾く）----
async function fetchJsonFirstOk_(urls) {
    let lastErr = null;

    for (const url of urls) {
        try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;

        // content-type が怪しくても text→JSON.parse で判定する
        const text = await res.text();

        // 404 HTML を JSON として読んで落ちるのを防ぐ
        if (/^\s*</.test(text)) continue;

        return JSON.parse(text);
        } catch (e) {
        lastErr = e;
        continue;
        }
    }

    throw lastErr || new Error('JSON not found');
}

// =========================
// cards_latest.json
// =========================
async function fetchLatestCards() {
    const allCards = await fetchJsonFirstOk_(window.CARDS_JSON_CANDIDATES);
    if (!Array.isArray(allCards)) return [];
    return allCards.filter(card => card && card.is_latest === true);
    }

    // グローバル公開（ここが重要：common-page124.js がこれを呼ぶ）
    window.fetchLatestCards = window.fetchLatestCards || fetchLatestCards;

    // =========================
    // cardMap 構築
    // =========================
    function buildCardMapFromCards_(cards) {
    if (!Array.isArray(cards)) return;

    for (const card of cards) {
        const cdRaw = card.cd ?? card.id ?? '';
        const cd5 = String(cdRaw || '').trim().padStart(5, '0');
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
  if (window.cardMap && Object.keys(window.cardMap).length > 0) {
    return window.cardMap;
  }
  try {
    const cards = await window.fetchLatestCards();
    buildCardMapFromCards_(cards);
  } catch (e) {
    console.error('ensureCardMapLoaded: カードマスタ読み込み失敗', e);
  }
  return window.cardMap;
}
window.ensureCardMapLoaded = window.ensureCardMapLoaded || ensureCardMapLoaded;

  //#endregion

// =========================
// packs.json
// =========================
  //#region
window.__PackCatalog = window.__PackCatalog || null;

function splitPackName(name = '') {
    const s = String(name);
    if (s.includes('「')) {
        const i = s.indexOf('「');
        return { en: s.slice(0, i).trim(), jp: s.slice(i).trim() };
    }
    if (s.includes('／')) {
        const [en, jp = ''] = s.split('／');
        return { en: en.trim(), jp: jp.trim() ? `「${jp.trim()}」` : '' };
    }
    return { en: s.trim(), jp: '' };
}

function makePackSlug(en = '') {
    const base = String(en || '').trim();
    const ascii = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return ascii || base;
}

async function loadPackCatalog() {
    if (window.__PackCatalog) return window.__PackCatalog;

    try {
        const raw = await fetchJsonFirstOk_(window.PACKS_JSON_CANDIDATES);

        const arr = Array.isArray(raw.packs) ? raw.packs : (Array.isArray(raw.list) ? raw.list : []);
        const order = Array.isArray(raw.order) ? raw.order : null;

        const list = arr.map(p => {
        const enRaw = (p.en ?? '').trim();
        const jpRaw = (p.jp ?? '').trim();
        const en = enRaw || (jpRaw ? jpRaw.replace(/[「」]/g, '') : '');
        const jp = jpRaw || '';
        const slug = p.slug || makePackSlug(en);
        const key = p.key || slug;
        return { key, en, jp, slug, labelTwoLine: `${en}${jp ? `\n${jp}` : ''}` };
        });

        const byEn = new Map(list.map(x => [x.en, x]));
        const ord = order && order.length ? order : list.map(x => x.en);

        window.__PackCatalog = { list, byEn, order: ord };
        return window.__PackCatalog;

    } catch (e) {
        console.warn('packs.json 読み込み失敗→cards_latest.jsonから検出にフォールバック', e);

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

        window.__PackCatalog = { list, byEn: new Map(list.map(x => [x.en, x])), order: list.map(x => x.en) };
        return window.__PackCatalog;
    }
}

window.splitPackName = window.splitPackName || splitPackName;
window.makePackSlug = window.makePackSlug || makePackSlug;
window.loadPackCatalog = window.loadPackCatalog || loadPackCatalog;

  //#endregion

// =========================
// cards.html 用：ソート（グローバル公開）
// =========================
(function(){
    if (window.sortCards) return;

    function getTypeOrder_(type) {
        if (type === "チャージャー") return 0;
        if (type === "アタッカー") return 1;
        if (type === "ブロッカー") return 2;
        return 3;
    }

    window.sortCards = function sortCards() {
    const grid = document.getElementById("grid");
    if (!grid) return;

    const sortEl = document.getElementById("sort-select");
    const sortValue = sortEl?.value || "default"; // ✅ sort-select 無くても動く

    const cards = Array.from(grid.children).filter(el => el.classList.contains("card"));

    cards.sort((a, b) => {
        const typeA = getTypeOrder_(a.dataset.type);
        const typeB = getTypeOrder_(b.dataset.type);
        const costA = parseInt(a.dataset.cost, 10) || 0;
        const costB = parseInt(b.dataset.cost, 10) || 0;
        const powerA = parseInt(a.dataset.power, 10) || 0;
        const powerB = parseInt(b.dataset.power, 10) || 0;
        const cdA = String(a.dataset.cd || '').padStart(5,'0');
        const cdB = String(b.dataset.cd || '').padStart(5,'0');

        const catA = (window.getCategoryOrder ? window.getCategoryOrder(a.dataset.category) : 9999);
        const catB = (window.getCategoryOrder ? window.getCategoryOrder(b.dataset.category) : 9999);

        switch (sortValue) {
        case "cost-asc":
            return costA - costB || typeA - typeB || powerA - powerB || cdA.localeCompare(cdB);
        case "cost-desc":
            return costB - costA || typeA - typeB || powerA - powerB || cdA.localeCompare(cdB);
        case "power-asc":
            return powerA - powerB || typeA - typeB || costA - costB || cdA.localeCompare(cdB);
        case "power-desc":
            return powerB - powerA || typeA - typeB || costA - costB || cdA.localeCompare(cdB);
        case "category-order":
            return catA - catB || typeA - typeB || costA - costB || powerA - powerB || cdA.localeCompare(cdB);
        case "rarity-order": {
            const rarityOrder = { "レジェンド": 0, "ゴールド": 1, "シルバー": 2, "ブロンズ": 3 };
            const rA = rarityOrder[a.dataset.rarity] ?? 99;
            const rB = rarityOrder[b.dataset.rarity] ?? 99;
            return rA - rB || costA - costB || powerA - powerB || cdA.localeCompare(cdB);
        }
        default:
            return typeA - typeB || costA - costB || powerA - powerB || cdA.localeCompare(cdB);
        }
    });

    cards.forEach(el => grid.appendChild(el));
    };
})();
