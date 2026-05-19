/* =========================
 * js/pages/tier/tier-page.js
 * - Tier表ページの最新データ反映
 * ========================= */
(function () {
    'use strict';

    const TIER_API_URL = 'https://script.google.com/macros/s/AKfycbzF_QBJc_wKd_vJ7vyBzhRUB_SYV87J5QhJ4RJaXHDJbCET_seQD5Q92ABfvE0wmFyvXg/exec';
    const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'E'];
    const STATIC_TIER_ENVIRONMENTS = [
        {
            environmentId: '2026_05_w3',
            environmentName: '5月第3週',
            tierComment: 'モルゲンが…',
            items: [
                { deckName: '歪祝', imageFile: '歪祝', tierScore: 53, tier: 'S', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=7361c806', postId: '7361c806' },
                { deckName: '鬼刹衆', imageFile: '鬼刹衆', tierScore: 55, tier: 'S', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=62c3185c', postId: '62c3185c' },
                { deckName: '秘饗', imageFile: '秘饗', tierScore: 58, tier: 'S', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=67c94079', postId: '67c94079' },
                { deckName: 'アストロＬＯ', imageFile: 'アストロLO', tierScore: 60, tier: 'S', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=eb8bc6d6', postId: 'eb8bc6d6' },
                { deckName: '蒼ノ刀', imageFile: '蒼ノ刀', tierScore: 65, tier: 'S', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=f56ca0fb', postId: 'f56ca0fb' },
                { deckName: '電竜', imageFile: '電竜', tierScore: 95, tier: 'S', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=033c3e39', postId: '033c3e39' },
                { deckName: '白騎士', imageFile: '白騎士', tierScore: 105, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=cd85bfeb', postId: 'cd85bfeb' },
                { deckName: 'アドミラルシップ', imageFile: 'アドミラルシップ', tierScore: 110, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=1c12861e', postId: '1c12861e' },
                { deckName: 'メイドロボ', imageFile: 'メイドロボ', tierScore: 120, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=6897371f', postId: '6897371f' },
                { deckName: '炎閻魔', imageFile: '炎閻魔', tierScore: 125, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=ba1b8840', postId: 'ba1b8840' },
                { deckName: 'バトメイ', imageFile: 'バトメイ', tierScore: 130, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=68efa151', postId: '68efa151' },
                { deckName: '星装', imageFile: '星装', tierScore: 140, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=df04e5bd', postId: 'df04e5bd' },
                { deckName: 'ヴァントム', imageFile: 'ヴァントム', tierScore: 150, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=7294bfa7', postId: '7294bfa7' },
                { deckName: '白騎士ＬＯ', imageFile: '白騎士LO', tierScore: 168, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=f0d2d7ee', postId: 'f0d2d7ee' },
                { deckName: 'ゴーゴン', imageFile: 'ゴーゴン', tierScore: 170, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=c55fbae9', postId: 'c55fbae9' },
                { deckName: 'テックノイズ', imageFile: 'テックノイズ', tierScore: 180, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=096f8c1a', postId: '096f8c1a' },
                { deckName: 'アグドラ', imageFile: 'アグドラ', tierScore: 193, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=c7ee61a1', postId: 'c7ee61a1' },
                { deckName: '愚者愚者', imageFile: '愚者愚者', tierScore: 195, tier: 'A', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=90b6518f', postId: '90b6518f' },
                { deckName: '火鞠', imageFile: '火鞠', tierScore: 200, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=d7074e1f', postId: 'd7074e1f' },
                { deckName: 'ルミナス１０スタン', imageFile: 'ルミナス10スタン', tierScore: 220, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=fd63930c', postId: 'fd63930c' },
                { deckName: 'アルケミ', imageFile: 'アルケミ', tierScore: 230, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=8cf8900b', postId: '8cf8900b' },
                { deckName: '燃焼ドラゴン', imageFile: '燃焼ドラゴン', tierScore: 240, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=255a5361', postId: '255a5361' },
                { deckName: 'バーントム', imageFile: 'バーントム', tierScore: 245, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=412967d5', postId: '412967d5' },
                { deckName: 'ナチュリア', imageFile: 'ナチュリア', tierScore: 250, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=1cec2c50', postId: '1cec2c50' },
                { deckName: 'ユノLO', imageFile: 'ユノLO', tierScore: 260, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=80ebdf24', postId: '80ebdf24' },
                { deckName: 'ロスリス', imageFile: 'ロスリス', tierScore: 265, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=55e3e2c2', postId: '55e3e2c2' },
                { deckName: 'メロウディア', imageFile: 'メロウディア', tierScore: 270, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=00511a7f', postId: '00511a7f' },
                { deckName: '聖焔龍', imageFile: '聖焔龍', tierScore: 275, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=a35e0a8f', postId: 'a35e0a8f' },
                { deckName: 'ジークフリート', imageFile: 'ジークフリート', tierScore: 280, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=d26eaa10', postId: 'd26eaa10' },
                { deckName: 'マディスキア', imageFile: 'マディスキア', tierScore: 285, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=da1a021d', postId: 'da1a021d' },
                { deckName: '神翼騎士', imageFile: '神翼騎士', tierScore: 290, tier: 'B', comment: '', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=4856170d', postId: '4856170d' },
                { deckName: '風花森', imageFile: '風花森', tierScore: 300, tier: 'C', comment: 'B弾から健在の強さ…', postUrl: 'https://mosurogia.github.io/mesorogia-cards/deck-post.html?pid=39395bf7', postId: '39395bf7' }
            ]
        }
    ];
    const MAIN_RACES = ['ドラゴン', 'アンドロイド', 'エレメンタル', 'ルミナス', 'シェイド'];
    const RACE_BG_CLASS_NAMES = [
        ...MAIN_RACES.map((race) => `race-bg-${race}`),
        'race-bg-イノセント',
        'race-bg-旧神'
    ];
    const state = {
        environments: [],
        currentEnvironmentIndex: 0,
        postCache: new Map(),
        guideObserver: null,
        guideLoadQueue: [],
        guideActiveLoads: 0,
        triedBatchLoad: false
    };
    const GUIDE_LOAD_CONCURRENCY = 2;

    function setStatus(text) {
        const status = document.querySelector('.tier-board-status');
        if (!status) return;

        status.textContent = text;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[ch]);
    }

    function normalizeTier(tier) {
        const value = String(tier || '').trim().toUpperCase();
        return value || 'その他';
    }

    function getTierClassName(tier) {
        const normalized = normalizeTier(tier).toLowerCase();
        return /^[a-z0-9_-]+$/.test(normalized) ? normalized : 'other';
    }

    function getTierScore(item) {
        const score = Number(item && item.tierScore);
        return Number.isFinite(score) ? score : Number.MAX_SAFE_INTEGER;
    }

    function getPostIdFromUrl(url) {
        try {
            const parsed = new URL(String(url || ''), location.href);
            return String(parsed.searchParams.get('pid') || parsed.searchParams.get('postId') || '').trim();
        } catch (_) {
            const match = String(url || '').match(/[?&](?:pid|postId)=([^&]+)/);
            return match ? decodeURIComponent(match[1]) : '';
        }
    }

    function getMainRaceFromRaces(races) {
        const values = Array.isArray(races)
            ? races
            : String(races || '').split(/[,\s、/／]+/);
        const normalized = values.map((race) => String(race || '').trim()).filter(Boolean);
        const mainRace = MAIN_RACES.find((race) => normalized.includes(race));
        return mainRace || normalized.find((race) => race === '旧神' || race === 'イノセント') || '';
    }

    function applyGuideDeckRace(guideCard, item) {
        if (!guideCard) return;

        const race = getMainRaceFromRaces(item && item.races);
        guideCard.classList.remove(...RACE_BG_CLASS_NAMES);
        guideCard.dataset.race = race;
        if (race) guideCard.classList.add(`race-bg-${race}`);
    }

    function getDeckGuideId(item) {
        const postUrl = String(item && item.postUrl || '').trim();
        const postId = getPostIdFromUrl(postUrl);
        if (postId) return `post-${postId}`;

        const tier = normalizeTier(item && item.tier);
        const deckName = String(item && item.deckName || 'deck').trim();
        const score = String(item && item.tierScore || '').trim();
        return `deck-${encodeURIComponent(`${tier}-${score}-${deckName}`)}`;
    }

    function getDeckCode(item) {
        return String(item && (item.shareCode || item.deckCode || item.code) || '').trim();
    }

    function getEnvironmentItems(environment) {
        return Array.isArray(environment && environment.items) ? environment.items : [];
    }

    function getEnvironmentName(environment, index) {
        const name = String(environment && environment.environmentName || '').trim();
        return name || `環境${index + 1}`;
    }

    function setBoardTitle(environment, index) {
        const title = document.getElementById('tierBoardTitle');
        if (!title || !environment) return;

        title.textContent = `${index === 0 ? '最新Tier' : 'Tier'}（${getEnvironmentName(environment, index)}）`;
    }

    function setEnvironmentComment(environment) {
        const commentSection = document.querySelector('.tier-environment-comment');
        const commentText = document.querySelector('[data-tier-environment-comment]');
        if (!commentSection || !commentText) return;

        const comment = String(environment && environment.tierComment || '').trim();
        commentSection.hidden = !comment;
        commentText.textContent = comment;
    }

    function updateEnvironmentControls() {
        const prevButton = document.querySelector('[data-tier-env-prev]');
        const nextButton = document.querySelector('[data-tier-env-next]');
        const hasMultipleEnvironments = state.environments.length > 1;

        if (prevButton) {
            prevButton.disabled = !hasMultipleEnvironments || state.currentEnvironmentIndex >= state.environments.length - 1;
        }

        if (nextButton) {
            nextButton.disabled = !hasMultipleEnvironments || state.currentEnvironmentIndex <= 0;
        }
    }

    function groupItemsByTier(items) {
        return items.reduce((groups, item) => {
            const tier = normalizeTier(item.tier);
            if (!groups.has(tier)) groups.set(tier, []);
            groups.get(tier).push(item);
            return groups;
        }, new Map());
    }

    function getOrderedTiers(groups) {
        const knownTiers = TIER_ORDER.filter((tier) => groups.has(tier));
        const otherTiers = Array.from(groups.keys())
            .filter((tier) => !TIER_ORDER.includes(tier))
            .sort((a, b) => a.localeCompare(b, 'ja'));

        return [...knownTiers, ...otherTiers];
    }

    function createDeckCard(item) {
        const deckName = String(item.deckName || '名称未設定').trim() || '名称未設定';
        const imageFile = String(item.imageFile || '').trim();
        const postUrl = String(item.postUrl || '').trim();
        const card = document.createElement(postUrl ? 'a' : 'article');

        card.className = 'tier-card';
        card.dataset.guideId = getDeckGuideId(item);
        if (postUrl) {
            card.href = postUrl;
            card.rel = 'noopener';
            card.dataset.postUrl = postUrl;
            card.dataset.postId = getPostIdFromUrl(postUrl);
        }

        const imageWrap = document.createElement('div');
        imageWrap.className = 'tier-card-image-wrap';

        if (imageFile) {
            const image = document.createElement('img');
            image.src = `img/${imageFile}.webp`;
            image.alt = deckName;
            image.loading = 'lazy';
            image.addEventListener('error', () => {
                if (!image.dataset.triedFallback) {
                    image.dataset.triedFallback = 'true';
                    image.src = `img/${imageFile}_.webp`;
                    return;
                }

                image.hidden = true;
                imageWrap.classList.add('is-image-missing');
            });
            imageWrap.append(image);
        } else {
            imageWrap.classList.add('is-image-missing');
        }

        const name = document.createElement('span');
        name.className = 'tier-card-name';
        name.textContent = deckName;

        card.append(imageWrap, name);

        return card;
    }

    function normalizeCd5(cd) {
        if (typeof window.normCd5 === 'function') return window.normCd5(cd);
        const value = String(cd ?? '').trim();
        return value ? value.padStart(5, '0').slice(0, 5) : '';
    }

    function parseJsonObject(value) {
        if (!value) return null;
        if (typeof value === 'object') return value;
        try {
            const parsed = JSON.parse(String(value));
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    function extractDeckMap(item) {
        let deck = null;

        if (Array.isArray(item && item.cards) && item.cards.length) {
            deck = {};
            item.cards.forEach((card) => {
                const cd = String(card && (card.cd || card.id || card.cardId || card.code) || '').trim();
                const count = Number(card && (card.count ?? card.num ?? card.n ?? 1)) || 0;
                if (cd && count > 0) deck[cd] = (deck[cd] || 0) + count;
            });
        } else if (item && item.cards && typeof item.cards === 'object') {
            deck = item.cards;
        } else {
            deck =
                parseJsonObject(item && item.cardsJSON) ||
                parseJsonObject(item && item.deck) ||
                parseJsonObject(item && item.codeNorm);
        }

        if (!deck || typeof deck !== 'object') return null;

        const normalized = {};
        Object.entries(deck).forEach(([cd, countRaw]) => {
            const cd5 = normalizeCd5(cd);
            const count = Number(countRaw || 0) || 0;
            if (cd5 && count > 0) normalized[cd5] = (normalized[cd5] || 0) + count;
        });

        return Object.keys(normalized).length ? normalized : null;
    }

    function normalizeFetchedPost(data, postId) {
        const src = data && (data.item || data.post || data.data) || data || {};
        const payload = parseJsonObject(src.payload || src.payloadJSON || src.rawPayload);
        const item = { ...(payload || {}), ...src };
        item.postId = String(item.postId || postId || '').trim();
        return item.postId ? item : null;
    }

    function getCardName(cd) {
        const card = window.cardMap && window.cardMap[cd];
        return card && card.name ? card.name : cd;
    }

    function getCardImageSrc(cd) {
        const card = window.cardMap && window.cardMap[cd];
        if (typeof window.getCardImageSrc === 'function') {
            return window.getCardImageSrc(card || cd);
        }
        return `img/${cd}.webp`;
    }

    function createDeckListCard(cd, count) {
        const item = document.createElement('div');
        item.className = 'tier-post-card';

        const image = document.createElement('img');
        image.src = getCardImageSrc(cd);
        image.alt = getCardName(cd);
        image.loading = 'lazy';
        image.addEventListener('error', () => {
            image.src = 'img/00000.webp';
        }, { once: true });

        const badge = document.createElement('span');
        badge.className = 'tier-post-card-count';
        badge.textContent = `x${count}`;

        item.append(image, badge);
        return item;
    }

    async function renderDeckList(item, list) {
        if (!list) return false;

        if (typeof window.ensureCardMapLoaded === 'function') {
            await window.ensureCardMapLoaded().catch(() => null);
        }

        const deck = extractDeckMap(item);
        if (!deck) {
            list.innerHTML = '<div class="tier-post-detail-empty">デッキリスト未登録</div>';
            return false;
        }

        const entries = typeof window.sortCardEntries === 'function'
            ? window.sortCardEntries(Object.entries(deck), window.cardMap || {})
            : Object.entries(deck);

        list.replaceChildren(...entries.map(([cd, count]) => createDeckListCard(normalizeCd5(cd), count)));
        return true;
    }

    function setGuideDeckStatus(card, text, isError) {
        const status = card && card.querySelector('[data-tier-guide-status]');
        if (!status) return;

        status.textContent = text;
        status.classList.toggle('is-error', !!isError);
    }

    function setGuideDeckCodeButton(card, code) {
        const button = card && card.querySelector('[data-tier-guide-copy-code]');
        const codeValue = String(code || '').trim();
        if (!button) return;

        button.dataset.code = codeValue;
        button.disabled = !codeValue;
        button.textContent = codeValue ? 'デッキコードをコピー' : 'デッキコードなし';
        button.setAttribute('aria-disabled', codeValue ? 'false' : 'true');
    }

    async function copyGuideDeckCode(button) {
        const code = String(button && button.dataset.code || '').trim();
        if (!button || !code || button.disabled) return;

        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(code);
                if (typeof window.showMiniToast_ === 'function') {
                    window.showMiniToast_('デッキコードをコピーしました');
                }
                return;
            }
        } catch (error) {
            console.warn('[tier] デッキコードをコピーできませんでした。', error);
        }

        alert('デッキコードをコピーできませんでした');
    }

    async function fetchPostById(postId) {
        if (state.postCache.has(postId)) return state.postCache.get(postId);

        const base = window.DECKPOST_API_BASE || window.GAS_API_BASE || '';
        if (!base) throw new Error('デッキ投稿APIが設定されていません');

        const url = new URL(base);
        url.searchParams.set('mode', 'get');
        url.searchParams.set('postId', postId);

        const data = await fetchPostJson(url.toString());
        if (!data || data.ok === false) throw new Error(data && (data.reason || data.error) || 'デッキ投稿を取得できませんでした');

        const item = normalizeFetchedPost(data, postId);
        if (!item) throw new Error('デッキ投稿の形式が不正です');

        state.postCache.set(postId, item);
        return item;
    }

    async function fetchPostsByIds(postIds) {
        const ids = Array.from(new Set((postIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
        if (!ids.length) return [];

        const missingIds = ids.filter((id) => !state.postCache.has(id));
        if (!missingIds.length) return ids.map((id) => state.postCache.get(id)).filter(Boolean);

        const base = window.DECKPOST_API_BASE || window.GAS_API_BASE || '';
        if (!base) throw new Error('デッキ投稿APIが設定されていません');

        const url = new URL(base);
        url.searchParams.set('mode', 'batchGetPosts');
        url.searchParams.set('postIds', missingIds.join(','));

        const data = await fetchPostJson(url.toString());
        if (!data || data.ok === false) throw new Error(data && (data.reason || data.error) || 'デッキ投稿を一括取得できませんでした');

        const rows = Array.isArray(data.items)
            ? data.items
            : (Array.isArray(data.posts) ? data.posts : []);

        rows.forEach((row) => {
            const postId = String(row && row.postId || '').trim();
            const item = normalizeFetchedPost(row, postId);
            if (postId && item) state.postCache.set(postId, item);
        });

        return ids.map((id) => state.postCache.get(id)).filter(Boolean);
    }

    function jsonpRequest(url) {
        return new Promise((resolve, reject) => {
            const callbackName = `__tier_post_jsonp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
            const separator = url.includes('?') ? '&' : '?';
            const script = document.createElement('script');
            let timer = null;

            function cleanup() {
                if (timer) clearTimeout(timer);
                if (script.parentNode) script.parentNode.removeChild(script);
                try {
                    delete window[callbackName];
                } catch (_) {
                    window[callbackName] = undefined;
                }
            }

            window[callbackName] = (data) => {
                cleanup();
                resolve(data);
            };

            script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}`;
            script.async = true;
            script.onerror = () => {
                cleanup();
                reject(new Error('JSONPでデッキ投稿を取得できませんでした'));
            };
            timer = setTimeout(() => {
                cleanup();
                reject(new Error('デッキ投稿APIがタイムアウトしました'));
            }, 30000);

            document.head.append(script);
        });
    }

    async function fetchPostJson(url) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data) return data;
        } catch (error) {
            console.warn('[tier] fetchでデッキ投稿を取得できませんでした。JSONPへ切り替えます。', error);
        }

        return jsonpRequest(url);
    }

    async function handleTierCardClick(event) {
        const card = event.target.closest('.tier-card[data-post-id]');
        if (!card) return;

        const postId = String(card.dataset.postId || '').trim();
        if (!postId) return;

        event.preventDefault();
        const guideCard = jumpToGuideCard(card.dataset.guideId);
        if (!guideCard) return;

        loadGuideDeckList(guideCard);
    }

    function jumpToGuideCard(guideId) {
        if (!guideId) return null;

        const guideCard = Array.from(document.querySelectorAll('.tier-guide-deck'))
            .find((card) => String(card.dataset.guideId || '') === String(guideId));
        if (!guideCard) return null;

        guideCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        guideCard.classList.add('is-focused');
        setTimeout(() => guideCard.classList.remove('is-focused'), 1200);
        return guideCard;
    }

    async function loadGuideDeckList(guideCard) {
        const postId = String(guideCard && guideCard.dataset.postId || '').trim();
        const list = guideCard && guideCard.querySelector('[data-tier-guide-list]');
        if (!guideCard || !postId || !list) return;
        if (guideCard.dataset.loaded === '1') return;

        guideCard.dataset.loading = '1';
        setGuideDeckStatus(guideCard, 'デッキリストを読み込み中…', false);
        list.replaceChildren();

        try {
            const item = await fetchPostById(postId);
            applyGuideDeckRace(guideCard, item);
            setGuideDeckCodeButton(guideCard, getDeckCode(item));
            const rendered = await renderDeckList(item, list);
            guideCard.dataset.loaded = rendered ? '1' : '0';
            setGuideDeckStatus(guideCard, rendered ? '' : 'デッキリスト未登録', !rendered);
        } catch (error) {
            console.warn('[tier] デッキリストを取得できませんでした。', error);
            setGuideDeckStatus(guideCard, 'デッキリストの取得に失敗しました。投稿リンクから確認してください。', true);
        } finally {
            delete guideCard.dataset.loading;
        }
    }

    async function renderGuideDeckFromCache(guideCard) {
        const postId = String(guideCard && guideCard.dataset.postId || '').trim();
        const list = guideCard && guideCard.querySelector('[data-tier-guide-list]');
        const item = postId ? state.postCache.get(postId) : null;
        if (!guideCard || !list || !item) return false;

        applyGuideDeckRace(guideCard, item);
        setGuideDeckCodeButton(guideCard, getDeckCode(item));
        const rendered = await renderDeckList(item, list);
        guideCard.dataset.loaded = rendered ? '1' : '0';
        setGuideDeckStatus(guideCard, rendered ? '' : 'デッキリスト未登録', !rendered);
        return rendered;
    }

    async function preloadGuideDeckLists() {
        const guideCards = Array.from(document.querySelectorAll('.tier-guide-deck[data-post-id]'));
        const postIds = guideCards.map((card) => String(card.dataset.postId || '').trim()).filter(Boolean);
        if (!postIds.length) return;

        state.triedBatchLoad = true;
        guideCards.forEach((card) => setGuideDeckStatus(card, 'デッキリストを一括読み込み中…', false));

        try {
            await fetchPostsByIds(postIds);
            await Promise.all(guideCards.map(renderGuideDeckFromCache));
        } catch (error) {
            console.warn('[tier] デッキリストの一括取得に失敗しました。個別取得へ切り替えます。', error);
            guideCards.forEach((card) => setGuideDeckStatus(card, 'デッキリスト読み込み待ち', false));
            observeGuideDeckCards();
        }
    }

    function enqueueGuideDeckLoad(guideCard) {
        if (!guideCard || guideCard.dataset.loaded === '1' || guideCard.dataset.loading === '1') return;
        if (state.guideLoadQueue.includes(guideCard)) return;

        state.guideLoadQueue.push(guideCard);
        processGuideLoadQueue();
    }

    function processGuideLoadQueue() {
        while (state.guideActiveLoads < GUIDE_LOAD_CONCURRENCY && state.guideLoadQueue.length) {
            const guideCard = state.guideLoadQueue.shift();
            if (!guideCard || !guideCard.isConnected || guideCard.dataset.loaded === '1') continue;

            state.guideActiveLoads += 1;
            loadGuideDeckList(guideCard).finally(() => {
                state.guideActiveLoads = Math.max(0, state.guideActiveLoads - 1);
                processGuideLoadQueue();
            });
        }
    }

    function observeGuideDeckCards() {
        if (state.guideObserver) {
            state.guideObserver.disconnect();
            state.guideObserver = null;
        }

        const cards = Array.from(document.querySelectorAll('.tier-guide-deck[data-post-id]'));
        if (!cards.length) return;

        if (typeof IntersectionObserver !== 'function') {
            cards.slice(0, 4).forEach(enqueueGuideDeckLoad);
            return;
        }

        state.guideObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                state.guideObserver.unobserve(entry.target);
                enqueueGuideDeckLoad(entry.target);
            });
        }, {
            root: null,
            rootMargin: '320px 0px',
            threshold: 0.01
        });

        cards.forEach((card) => state.guideObserver.observe(card));
    }

    function createTierRow(tier, items) {
        const rowEl = document.createElement('div');
        rowEl.className = 'tier-row';

        const label = document.createElement('div');
        label.className = `tier-label is-${getTierClassName(tier)}`;
        label.textContent = tier;

        const itemList = document.createElement('div');
        itemList.className = 'tier-items';

        if (items.length) {
            items
                .slice()
                .sort((a, b) => getTierScore(a) - getTierScore(b))
                .forEach((item) => itemList.append(createDeckCard(item)));
        } else {
            const empty = document.createElement('div');
            empty.className = 'tier-empty';
            empty.textContent = '現在掲載デッキはありません';
            itemList.append(empty);
        }

        rowEl.append(label, itemList);
        return rowEl;
    }

    function renderTierBoard(items) {
        const board = document.getElementById('tierBoard');
        if (!board) return;

        const groups = groupItemsByTier(items);
        const orderedTiers = getOrderedTiers(groups);

        if (!orderedTiers.length) {
            board.replaceChildren(...TIER_ORDER.map((tier) => createTierRow(tier, [])));
            return;
        }

        board.replaceChildren(...orderedTiers.map((tier) => createTierRow(tier, groups.get(tier) || [])));
    }

    function createGuideDeckCard(item) {
        const deckName = String(item.deckName || '名称未設定').trim() || '名称未設定';
        const comment = String(item.comment || '').trim();
        const postUrl = String(item.postUrl || '').trim();
        const postId = getPostIdFromUrl(postUrl);
        const deckCode = getDeckCode(item);
        const card = document.createElement('article');

        card.className = 'tier-guide-deck';
        card.dataset.guideId = getDeckGuideId(item);
        if (postId) card.dataset.postId = postId;

        const head = document.createElement('div');
        head.className = 'tier-guide-deck-head';

        const title = document.createElement('h5');
        title.className = 'tier-guide-deck-title';
        title.textContent = deckName;

        head.append(title);
        card.append(head);

        const wideActions = document.createElement('div');
        wideActions.className = 'tier-guide-deck-actions-wide';

        const detailLink = document.createElement('a');
        detailLink.className = 'tier-guide-detail-link';
        detailLink.textContent = 'デッキを詳しく見る';
        if (postUrl) {
            detailLink.href = postUrl;
            detailLink.target = '_blank';
            detailLink.rel = 'noopener';
        } else {
            detailLink.setAttribute('aria-disabled', 'true');
            detailLink.tabIndex = -1;
        }

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'tier-guide-copy-code-button btn-copy-code-wide';
        copyButton.dataset.tierGuideCopyCode = '1';
        setGuideDeckCodeButton({ querySelector: () => copyButton }, deckCode);

        wideActions.append(detailLink, copyButton);
        card.append(wideActions);

        const status = document.createElement('div');
        status.className = 'tier-guide-deck-status';
        status.dataset.tierGuideStatus = '1';
        status.textContent = postId ? 'デッキリスト読み込み待ち' : 'まだ参考デッキがありません';

        const list = document.createElement('div');
        list.className = 'tier-post-decklist';
        list.dataset.tierGuideList = '1';

        card.append(status, list);

        if (comment) {
            const deckComment = document.createElement('p');
            deckComment.className = 'tier-guide-deck-list-comment';
            deckComment.textContent = comment;
            card.append(deckComment);
        }

        return card;
    }

    function createGuideTierSection(tier, items) {
        const section = document.createElement('section');
        section.className = 'tier-guide-rank';

        const title = document.createElement('h4');
        title.className = `tier-guide-rank-title is-${getTierClassName(tier)}`;
        title.textContent = `${tier} ランク`;

        const list = document.createElement('div');
        list.className = 'tier-guide-rank-list';

        items
            .slice()
            .sort((a, b) => getTierScore(a) - getTierScore(b))
            .forEach((item) => list.append(createGuideDeckCard(item)));

        section.append(title, list);
        return section;
    }

    function renderDeckGuide(items) {
        const guide = document.querySelector('[data-tier-deck-guide]');
        const body = document.querySelector('[data-tier-deck-guide-body]');
        if (!guide || !body) return;

        const groups = groupItemsByTier(items);
        const orderedTiers = getOrderedTiers(groups);
        const sections = orderedTiers
            .map((tier) => createGuideTierSection(tier, groups.get(tier) || []))
            .filter(Boolean);

        guide.hidden = !sections.length;
        body.replaceChildren(...sections);
        state.guideLoadQueue = [];
        state.guideActiveLoads = 0;
        state.triedBatchLoad = false;
        preloadGuideDeckLists();
    }

    function renderEnvironment(index) {
        const environment = state.environments[index];
        if (!environment) return;

        state.currentEnvironmentIndex = index;
        setBoardTitle(environment, index);
        setEnvironmentComment(environment);
        const items = getEnvironmentItems(environment);
        renderTierBoard(items);
        renderDeckGuide(items);
        updateEnvironmentControls();
    }

    function renderStaticTierData() {
        state.environments = STATIC_TIER_ENVIRONMENTS;
        renderEnvironment(0);
        setStatus('保存済みTierを表示中');
    }

    function bindEnvironmentControls() {
        const prevButton = document.querySelector('[data-tier-env-prev]');
        const nextButton = document.querySelector('[data-tier-env-next]');

        if (prevButton) {
            prevButton.addEventListener('click', () => {
                renderEnvironment(Math.min(state.currentEnvironmentIndex + 1, state.environments.length - 1));
            });
        }

        if (nextButton) {
            nextButton.addEventListener('click', () => {
                renderEnvironment(Math.max(state.currentEnvironmentIndex - 1, 0));
            });
        }

        updateEnvironmentControls();
    }

    function bindPostDetailEvents() {
        const board = document.getElementById('tierBoard');
        const guide = document.querySelector('[data-tier-deck-guide]');

        if (board) {
            board.addEventListener('click', handleTierCardClick);
        }

        if (guide) {
            guide.addEventListener('click', (event) => {
                const copyButton = event.target.closest('[data-tier-guide-copy-code]');
                if (copyButton) {
                    copyGuideDeckCode(copyButton);
                    return;
                }

                const guideCard = event.target.closest('.tier-guide-deck[data-post-id]');
                if (!guideCard || event.target.closest('a')) return;
                enqueueGuideDeckLoad(guideCard);
            });
        }
    }

    async function fetchLatestTier() {
        setStatus('最新データ確認中');

        try {
            const url = new URL(TIER_API_URL);
            url.searchParams.set('mode', 'tierList');

            const response = await fetch(url.toString(), { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (!data || data.ok !== true || !Array.isArray(data.items)) {
                throw new Error('Tierデータの形式が不正です');
            }

            if (Array.isArray(data.environments) && data.environments.length) {
                state.environments = data.environments;
                renderEnvironment(0);
            } else {
                state.environments = [{
                    environmentName: '最新',
                    tierComment: '',
                    items: data.items
                }];
                renderEnvironment(0);
            }

            setStatus('最新データ反映済み');
        } catch (error) {
            if (!state.environments.length) renderStaticTierData();
            console.warn('[tier] 最新Tierデータを取得できませんでした。', error);
            setStatus('保存済みTierを表示中');
            updateEnvironmentControls();
        }
    }

    function init() {
        setStatus('表示中');
        bindEnvironmentControls();
        bindPostDetailEvents();
        renderStaticTierData();
        fetchLatestTier();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
