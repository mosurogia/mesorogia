/* =========================
 * common/owned.js
 * 所持データ（OwnedStore）＋所持マークUI（owned-mark）共通
 * - page1（カード一覧） / page3（所持率チェッカー） / 統合ページで共有
 * ========================= */

// ▼ どのページでも安全に所持データを読むヘルパ
function readOwnedDataSafe() {
    // OwnedStore 優先
    try {
        if (window.OwnedStore?.getAll) {
        const s = window.OwnedStore.getAll();
        if (s && typeof s === 'object') return s;
        }
    } catch {}
    // localStorage フォールバック
    try {
        const raw = localStorage.getItem('ownedCards');
        const obj = raw ? JSON.parse(raw) : {};
        if (obj && typeof obj === 'object') return obj;
    } catch {}
    return {};
}

(function () {
    const LS_KEY = 'ownedCards';

    /* ---------- OwnedStore（既にあれば尊重） ---------- */
    function ensureOwnedStore_() {
        if (window.OwnedStore && typeof window.OwnedStore.getAll === 'function') return;

        // 最小実装：localStorage を裏に持つ
        let map = readOwnedMap_();
        const listeners = new Set();

        window.OwnedStore = {
        get(cd) {
            cd = String(cd);
            return map[cd] || { normal: 0, shine: 0, premium: 0 };
        },
        set(cd, obj) {
            cd = String(cd);
            map[cd] = {
            normal: Number(obj?.normal || 0),
            shine: Number(obj?.shine || 0),
            premium: Number(obj?.premium || 0),
            };
            writeOwnedMap_(map);
            listeners.forEach(fn => {
            try { fn(); } catch (e) {}
            });
        },
        getAll() {
            return map;
        },
        replaceAll(next) {
            map = sanitizeOwnedMap_(next);
            writeOwnedMap_(map);
            listeners.forEach(fn => {
            try { fn(); } catch (e) {}
            });
        },
        onChange(fn) {
            if (typeof fn === 'function') listeners.add(fn);
        }
        };
    }

    /* ---------- 所持データ read/write ---------- */
    function sanitizeOwnedMap_(obj) {
        if (!obj || typeof obj !== 'object') return {};
        const out = {};
        for (const [cd, v] of Object.entries(obj)) {
        const e = v && typeof v === 'object' ? v : {};
        out[String(cd)] = {
            normal: Number(e.normal || 0),
            shine: Number(e.shine || 0),
            premium: Number(e.premium || 0),
        };
        }
        return out;
    }

    function readOwnedMap_() {
        // OwnedStore 優先
        try {
        if (window.OwnedStore?.getAll) {
            const s = window.OwnedStore.getAll();
            if (s && typeof s === 'object') return sanitizeOwnedMap_(s);
        }
        } catch {}

        // localStorage fallback
        try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? sanitizeOwnedMap_(JSON.parse(raw)) : {};
        } catch {
        return {};
        }
    }

    function writeOwnedMap_(map) {
        try {
        localStorage.setItem(LS_KEY, JSON.stringify(map || {}));
        } catch {}
    }

    /* ---------- 上限枚数（旧神=1 / その他=3） ---------- */
    function maxAllowedCount(cd, raceHint) {
        if (raceHint === '旧神') return 1;

        let race = raceHint || '';
        if (!race && typeof cd !== 'undefined') {
        // cardsCache があればそこから
        try {
            if (Array.isArray(window.__cardsCache)) {
            const hit = window.__cardsCache.find(c => String(c.cd) === String(cd));
            if (hit?.race) race = hit.race;
            }
        } catch {}
        // DOMからも拾える
        if (!race) {
            const el = document.querySelector(`.card[data-cd="${cd}"]`);
            race = el?.dataset?.race || '';
        }
        }
        return (race === '旧神') ? 1 : 3;
    }

    /* ---------- 見た目反映（owned-mark / grayscale） ---------- */
    function paintCard(cardEl, total) {
    const count = Math.max(0, Math.min(3, total | 0));

    // ✅ 0も含めて段階クラスを一旦全部剥がす
    cardEl.classList.remove('owned-0', 'owned-1', 'owned-2', 'owned-3', 'owned', 'grayscale');

    // ✅ 0でも owned-0 を付ける（CSSを統一できる）
    cardEl.classList.add(`owned-${count}`);
    cardEl.classList.add('owned'); // 既存CSS互換（必要なら）

    // owned-mark は常に表示、0 も明示
    const mark = cardEl.querySelector('.owned-mark');
    if (mark) {
        mark.textContent = String(count);   // ★ 0 を表示
        mark.style.display = 'flex';
    }

    cardEl.dataset.count = String(count);
    }

    // ---------- 一括同期 ---------- */
    function syncOwnedMarks(rootSelector = '#packs-root') {
        const owned = readOwnedMap_();
        const root = document.querySelector(rootSelector);
        if (!root) return;

        const cards = root.querySelectorAll('.card');
        cards.forEach((el) => {
        const cd = String(el.dataset.cd || '');
        const e = owned[cd] || { normal: 0, shine: 0, premium: 0 };
        const total = (e.normal | 0) + (e.shine | 0) + (e.premium | 0);
        paintCard(el, total);
        });

        // page3 側にあれば追従（無ければ何もしない）
        try { window.updateSummary?.(); } catch {}
        try { window.updateOwnedTotal?.(); } catch {}
    }

    function waitForCardsAndSync(rootSelector = '#packs-root') {
        const root = document.querySelector(rootSelector);
        if (!root) return;

        if (root.querySelector('.card')) {
        syncOwnedMarks(rootSelector);
        return;
        }
        const mo = new MutationObserver(() => {
        if (root.querySelector('.card')) {
            mo.disconnect();
            syncOwnedMarks(rootSelector);
        }
        });
        mo.observe(root, { childList: true, subtree: true });
    }

    /* ---------- 操作系（ボタン/クリック用） ---------- */
    function totalOf(cd) {
        ensureOwnedStore_();
        const e = window.OwnedStore.get(String(cd));
        return (e.normal|0) + (e.shine|0) + (e.premium|0);
    }

    function setTotal(cd, n, raceHint) {
        ensureOwnedStore_();
        const max = maxAllowedCount(cd, raceHint);
        const count = Math.max(0, Math.min(max, n|0));
        window.OwnedStore.set(String(cd), { normal: count, shine: 0, premium: 0 });
    }

    function bumpOwnership(el, times = 1) {
        const cd = el?.dataset?.cd;
        if (!cd) return;
        const race = el?.dataset?.race || '';
        const now = totalOf(cd);
        const max = maxAllowedCount(cd, race);
        setTotal(cd, Math.min(max, now + (times|0)), race);
    }

    function setOwnership(el, count) {
        const cd = el?.dataset?.cd;
        if (!cd) return;
        const race = el?.dataset?.race || '';
        setTotal(cd, count, race);
    }

    function clearOwnership(el) {
        const cd = el?.dataset?.cd;
        if (!cd) return;
        const race = el?.dataset?.race || '';
        setTotal(cd, 0, race);
    }

    function toggleOwnership(el) {
        try {
        if (!el || !el.dataset) return;
        const cd = String(el.dataset.cd || '');
        if (!cd) return;

        ensureOwnedStore_();

        const race = el.dataset.race || '';
        const max = maxAllowedCount(cd, race);

        const now = totalOf(cd);
        const next = (now >= max) ? 0 : (now + 1);

        window.OwnedStore.set(cd, { normal: next, shine: 0, premium: 0 });
        } catch (err) {
        console.error('toggleOwnership failed:', err);
        }
    }

    /* ---------- 公開I/F ---------- */
    window.OwnedUI = {
        bind(rootSelector = '#packs-root') {
        ensureOwnedStore_();

        // 初回同期（描画待ち）
        waitForCardsAndSync(rootSelector);

        // OwnedStore 変更で再反映
        if (typeof window.OwnedStore?.onChange === 'function') {
            window.OwnedStore.onChange(() => syncOwnedMarks(rootSelector));
        }

        // 既存互換：フィルタ後に applyGrayscaleFilter() が呼ばれる前提ならここを乗っ取る
        window.applyGrayscaleFilter = () => syncOwnedMarks(rootSelector);
        },
        sync: syncOwnedMarks,
        paintCard,
        maxAllowedCount,
    };

    // 既存互換（古いコードが window.* を探しに来る）
    window.maxAllowedCount = maxAllowedCount;
    window.bumpOwnership = bumpOwnership;
    window.setOwnership = setOwnership;
    window.clearOwnership = clearOwnership;
    window.toggleOwnership = toggleOwnership;

    // 初期化だけは即時
    ensureOwnedStore_();
})();


