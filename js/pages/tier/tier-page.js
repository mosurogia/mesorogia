/* =========================
 * js/pages/tier/tier-page.js
 * - Tier表ページの最新データ反映
 * ========================= */
(function () {
    'use strict';

    const TIER_API_URL = 'https://script.google.com/macros/s/AKfycbyQ4DrQBXGDN035XOGjro9r7-nyarVPTJI-0_BifxiijvrPoH4iGnpONfPtj0VVz7UOjw/exec';
    const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'E'];
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
        prefetchedPostPages: new Set(),
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
        status.classList.remove('is-error');
    }

    function setStatusError(text) {
        const status = document.querySelector('.tier-board-status');
        if (!status) return;

        status.textContent = text;
        status.classList.add('is-error');
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

    function getPostDetailHref(postUrl) {
        const postId = getPostIdFromUrl(postUrl);
        return postId ? `deck-post.html?pid=${encodeURIComponent(postId)}` : String(postUrl || '').trim();
    }

    function prefetchPostDetailPage(href) {
        const url = String(href || '').trim();
        if (!url || !document.head || state.prefetchedPostPages.has(url)) return;

        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        link.dataset.tierPrefetch = url;
        document.head.append(link);
        state.prefetchedPostPages.add(url);
    }

    function storePostTransfer(postId) {
        const pid = String(postId || '').trim();
        const item = pid ? state.postCache.get(pid) : null;
        if (!pid || !item || typeof sessionStorage === 'undefined') return;

        try {
            sessionStorage.setItem(`deck-post-transfer:${pid}`, JSON.stringify({
                expiresAt: Date.now() + 5 * 60 * 1000,
                item
            }));
        } catch (_) {
            // sessionStorage が使えない環境では通常遷移に任せる。
        }
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

        title.textContent = `${index === 0 ? '最新Tier表' : 'Tier表'}（最終更新${getEnvironmentName(environment, index)}）`;
        setStatus(`${index === 0 ? '最新' : '表示中'}：${getEnvironmentName(environment, index)}`);
    }

    function setGuideEnvironmentLabel(environment, index) {
        const title = document.getElementById('tierDeckGuideTitle');
        if (title) {
            title.textContent = `デッキ紹介（最終更新${getEnvironmentName(environment, index)}）`;
        }

        document.querySelectorAll('[data-tier-guide-environment]').forEach((label) => {
            label.textContent = `${index === 0 ? '最新' : '表示中'}：${getEnvironmentName(environment, index)}`;
            label.classList.remove('is-error');
        });
    }

    function setGuideEnvironmentStatus(text, isError) {
        document.querySelectorAll('[data-tier-guide-environment]').forEach((label) => {
            label.textContent = text;
            label.classList.toggle('is-error', !!isError);
        });
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
        const prevButtons = document.querySelectorAll('[data-tier-env-prev]');
        const nextButtons = document.querySelectorAll('[data-tier-env-next]');
        const hasMultipleEnvironments = state.environments.length > 1;

        prevButtons.forEach((prevButton) => {
            prevButton.disabled = !hasMultipleEnvironments || state.currentEnvironmentIndex >= state.environments.length - 1;
        });

        nextButtons.forEach((nextButton) => {
            nextButton.disabled = !hasMultipleEnvironments || state.currentEnvironmentIndex <= 0;
        });
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
        const detailHref = getPostDetailHref(postUrl);
        const card = document.createElement(detailHref ? 'a' : 'article');

        card.className = 'tier-card';
        card.dataset.guideId = getDeckGuideId(item);
        if (detailHref) {
            card.href = detailHref;
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
        setGuideEnvironmentStatus('デッキリスト切り替え中', false);

        try {
            const item = await fetchPostById(postId);
            applyGuideDeckRace(guideCard, item);
            setGuideDeckCodeButton(guideCard, getDeckCode(item));
            const rendered = await renderDeckList(item, list);
            guideCard.dataset.loaded = rendered ? '1' : '0';
            setGuideDeckStatus(guideCard, rendered ? '' : 'デッキリスト未登録', !rendered);
            if (rendered) {
                setGuideEnvironmentLabel(state.environments[state.currentEnvironmentIndex], state.currentEnvironmentIndex);
            } else {
                setGuideEnvironmentStatus('デッキリスト未登録', true);
            }
        } catch (error) {
            console.warn('[tier] デッキリストを取得できませんでした。', error);
            setGuideDeckStatus(guideCard, 'デッキリストの取得に失敗しました。投稿リンクから確認してください。', true);
            setGuideEnvironmentStatus('デッキリスト取得失敗', true);
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
        const targetCards = guideCards.filter((card) => card.dataset.loaded !== '1');
        const postIds = targetCards.map((card) => String(card.dataset.postId || '').trim()).filter(Boolean);
        if (!targetCards.length) {
            if (guideCards.length) {
                setGuideEnvironmentLabel(state.environments[state.currentEnvironmentIndex], state.currentEnvironmentIndex);
            } else {
                setGuideEnvironmentStatus('デッキリストなし', false);
            }
            return;
        }
        if (!postIds.length) return;

        state.triedBatchLoad = true;
        setGuideEnvironmentStatus('デッキリスト切り替え中', false);

        try {
            await fetchPostsByIds(postIds);
            await Promise.all(targetCards.map(renderGuideDeckFromCache));
            setGuideEnvironmentLabel(state.environments[state.currentEnvironmentIndex], state.currentEnvironmentIndex);
        } catch (error) {
            console.warn('[tier] デッキリストの一括取得に失敗しました。個別取得へ切り替えます。', error);
            setGuideEnvironmentStatus('デッキリスト切り替え待ち', false);
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
        const detailHref = getPostDetailHref(postUrl);
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
        if (detailHref) {
            detailLink.href = detailHref;
            detailLink.rel = 'noopener';
            if (postId) detailLink.dataset.postId = postId;
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
        status.textContent = postId ? '' : 'まだ参考デッキがありません';

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

    function guideMatchesItems(items) {
        const guideCards = Array.from(document.querySelectorAll('.tier-guide-deck[data-guide-id]'));
        const nextIds = (items || []).map(getDeckGuideId);
        if (!guideCards.length || guideCards.length !== nextIds.length) return false;

        return nextIds.every((guideId, index) => String(guideCards[index].dataset.guideId || '') === String(guideId));
    }

    function renderDeckGuide(items, environment, index) {
        const guide = document.querySelector('[data-tier-deck-guide]');
        const body = document.querySelector('[data-tier-deck-guide-body]');
        if (!guide || !body) return;
        setGuideEnvironmentStatus('最新リスト確認中', false);

        const groups = groupItemsByTier(items);
        const orderedTiers = getOrderedTiers(groups);
        const sections = orderedTiers
            .map((tier) => createGuideTierSection(tier, groups.get(tier) || []))
            .filter(Boolean);

        guide.hidden = !sections.length;
        if (!guideMatchesItems(items)) {
            body.replaceChildren(...sections);
        }
        setGuideEnvironmentLabel(environment, index);
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
        renderDeckGuide(items, environment, index);
        updateEnvironmentControls();
    }


    function bindEnvironmentControls() {
        document.querySelectorAll('[data-tier-env-prev]').forEach((prevButton) => {
            if (prevButton.dataset.tierEnvBound) return;
            prevButton.dataset.tierEnvBound = '1';
            prevButton.addEventListener('click', () => {
                renderEnvironment(Math.min(state.currentEnvironmentIndex + 1, state.environments.length - 1));
            });
        });

        document.querySelectorAll('[data-tier-env-next]').forEach((nextButton) => {
            if (nextButton.dataset.tierEnvBound) return;
            nextButton.dataset.tierEnvBound = '1';
            nextButton.addEventListener('click', () => {
                renderEnvironment(Math.max(state.currentEnvironmentIndex - 1, 0));
            });
        });

        updateEnvironmentControls();
    }

    function getTierImageFileName() {
        const environment = state.environments[state.currentEnvironmentIndex];
        const name = getEnvironmentName(environment, state.currentEnvironmentIndex).replace(/[\\/:*?"<>|]/g, '_');
        return `tier-list-${name || 'latest'}.png`;
    }

    function closeTierImageModal(modal) {
        if (modal) modal.remove();
        document.body.style.overflow = '';
    }

    function createTierImageButton(label) {
        const button = document.createElement('a');
        button.textContent = label;
        Object.assign(button.style, {
            flex: '1 1 0',
            display: 'inline-block',
            padding: '10px 12px',
            borderRadius: '10px',
            background: '#fff',
            color: '#111',
            fontSize: '14px',
            fontWeight: '800',
            textAlign: 'center',
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,.25)'
        });
        return button;
    }

    function showTierImagePreview(canvas, fileName) {
        const dataUrl = canvas.toDataURL('image/png');
        document.getElementById('tier-image-preview-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'tier-image-preview-modal';
        Object.assign(modal.style, {
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            overflowY: 'auto',
            padding: '40px 0',
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif'
        });

        document.body.style.overflow = 'hidden';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = '×';
        closeButton.setAttribute('aria-label', '閉じる');
        Object.assign(closeButton.style, {
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '36px',
            height: '36px',
            border: 'none',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            color: '#111',
            fontSize: '22px',
            fontWeight: '700',
            lineHeight: '1',
            cursor: 'pointer',
            boxShadow: '0 0 6px rgba(0,0,0,0.3)'
        });
        closeButton.addEventListener('click', () => closeTierImageModal(modal));

        const hint = document.createElement('div');
        const ua = String(navigator.userAgent || '').toLowerCase();
        if (/iphone|ipad|ipod/.test(ua)) {
            hint.textContent = '長押しで「写真に追加」や「共有（画像保存）」ができます';
        } else if (/android/.test(ua)) {
            hint.textContent = '長押しで「画像をダウンロード」や「共有（画像保存）」ができます';
        } else {
            hint.textContent = '右クリックで「名前を付けて保存」できます';
        }
        Object.assign(hint.style, {
            margin: '15px',
            fontSize: 'clamp(14px, 2vw, 18px)',
            textAlign: 'center'
        });

        const buttonBar = document.createElement('div');
        Object.assign(buttonBar.style, {
            display: 'flex',
            gap: '8px',
            width: 'min(92vw, 760px)',
            maxWidth: 'min(92vw, 760px)',
            margin: '8px auto 12px'
        });

        const saveButton = createTierImageButton('ダウンロード');
        saveButton.href = dataUrl;
        saveButton.download = fileName;

        const shareButton = createTierImageButton('共有（画像保存）');
        shareButton.href = 'javascript:void(0)';
        const isIOS = /iphone|ipad|ipod/.test(ua) || (ua.includes('macintosh') && (navigator.maxTouchPoints || 0) >= 2);
        const isAndroid = /android/.test(ua);
        if (!isIOS && !isAndroid) {
            shareButton.style.display = 'none';
        } else {
            shareButton.addEventListener('click', async () => {
                try {
                    const blob = await (await fetch(dataUrl)).blob();
                    const file = new File([blob], fileName, { type: 'image/png' });
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file] });
                    } else {
                        alert('この端末では共有に対応していません。ダウンロードをご利用ください。');
                    }
                } catch (error) {
                    console.warn('[tier] Tier表画像を共有できませんでした。', error);
                }
            });
        }

        const image = document.createElement('img');
        image.src = dataUrl;
        image.alt = 'Tier表画像プレビュー';
        Object.assign(image.style, {
            maxWidth: 'min(92vw, 760px)',
            height: 'auto',
            borderRadius: '12px',
            boxShadow: '0 0 24px rgba(0,0,0,0.6)',
            objectFit: 'contain'
        });

        const note = document.createElement('div');
        note.textContent = '※ここで生成した画像はXやDiscordなどに自由に投稿して構いません。';
        Object.assign(note.style, {
            width: 'min(92vw, 760px)',
            maxWidth: 'min(92vw, 760px)',
            margin: '10px auto 16px',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 'clamp(12px, 1.8vw, 14px)',
            textAlign: 'center'
        });

        buttonBar.append(saveButton, shareButton);
        modal.append(closeButton, hint, buttonBar, image, note);
        modal.addEventListener('click', (event) => {
            if (event.target === modal && event.clientY < window.innerHeight * 0.9) {
                closeTierImageModal(modal);
            }
        });
        document.body.append(modal);
    }

    async function exportTierBoardImage(button) {
        const target = document.getElementById('tierBoard');
        if (!target) return;
        if (typeof html2canvas !== 'function') {
            alert('画像生成機能を読み込めませんでした。ページを再読み込みしてください。');
            return;
        }

        const previousText = button ? button.textContent : '';
        if (button) {
            button.disabled = true;
            button.classList.add('is-loading');
        }

        try {
            await Promise.all(Array.from(target.querySelectorAll('img')).map((image) => {
                if (image.complete) return Promise.resolve();
                return new Promise((resolve) => {
                    image.addEventListener('load', resolve, { once: true });
                    image.addEventListener('error', resolve, { once: true });
                    setTimeout(resolve, 1500);
                });
            }));
            const canvas = await html2canvas(target, {
                useCORS: true,
                backgroundColor: '#fff',
                scale: Math.max(2, Math.min(3, window.devicePixelRatio || 1))
            });
            showTierImagePreview(canvas, getTierImageFileName());
        } catch (error) {
            console.error('[tier] Tier表画像の生成に失敗しました。', error);
            alert('Tier表画像の生成に失敗しました。ページを再読み込みしてください。');
        } finally {
            if (button) {
                button.disabled = false;
                button.classList.remove('is-loading');
                button.textContent = previousText || '📷';
            }
        }
    }

    function bindTierImageExport() {
        document.querySelectorAll('[data-tier-board-image]').forEach((button) => {
            if (button.dataset.tierImageBound) return;
            button.dataset.tierImageBound = '1';
            button.addEventListener('click', () => exportTierBoardImage(button));
        });
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

                const detailLink = event.target.closest('.tier-guide-detail-link[data-post-id]');
                if (detailLink) {
                    storePostTransfer(detailLink.dataset.postId);
                    prefetchPostDetailPage(detailLink.href);
                    return;
                }

                const guideCard = event.target.closest('.tier-guide-deck[data-post-id]');
                if (!guideCard || event.target.closest('a')) return;
                enqueueGuideDeckLoad(guideCard);
            });

            guide.addEventListener('pointerover', (event) => {
                const detailLink = event.target.closest('.tier-guide-detail-link[href]');
                if (!detailLink) return;
                prefetchPostDetailPage(detailLink.getAttribute('href'));
            });

            guide.addEventListener('focusin', (event) => {
                const detailLink = event.target.closest('.tier-guide-detail-link[href]');
                if (!detailLink) return;
                prefetchPostDetailPage(detailLink.getAttribute('href'));
            });
        }
    }

    async function fetchLatestTier() {
        setStatus('最新リスト確認中');
        setGuideEnvironmentStatus('最新リスト確認中', false);

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
        } catch (error) {
            console.warn('[tier] 最新Tierデータを取得できませんでした。', error);
            setStatusError('保存済みリスト表示中');
            updateEnvironmentControls();
        }
    }

    function init() {
        setStatus('最新リスト確認中');
        setGuideEnvironmentStatus('最新リスト確認中', false);
        bindEnvironmentControls();
        bindTierImageExport();
        bindPostDetailEvents();
        fetchLatestTier();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
