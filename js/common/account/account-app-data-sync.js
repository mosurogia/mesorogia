/* =========================
 * js/common/account/account-app-data-sync.js
 * - アカウント連携用のアプリ内データ同期
 * - ownedCards / cardGroups のアカウント同期を行う
 * ========================= */
(function(){
    'use strict';

    const API = window.API || window.AUTH_API_BASE || window.GAS_API_BASE;
    const Auth = window.Auth;
    const postJSON = window.postJSON;

    const LS_LAST_SYNC = 'appDataAccountLastSync';
    const LS_OWNED = 'ownedCards';
    const LS_GUEST_OWNED = 'ownedCardsGuestLocal';
    const LS_GUEST_CARD_GROUPS = 'cardGroupsGuestLocal';
    const LS_ACTIVE_SOURCE = 'ownedCardsActiveSource';
    const LS_CARD_GROUPS = 'cardGroupsV1';
    const EMPTY_ERRORS = new Set(['unknown mode', 'not implemented', 'unsupported mode']);

    let syncing = false;
    let cachedAppData = null;
    let lastSavedJson = '';
    let accountOwnedLinkEnabled = false;
    let authCheckPending = true;
    let pendingCardGroupsSync = null;
    let pendingCardGroupsProcessing = false;
    let cardsTabSwitchSeen = false;
    const syncStatus = {
        source: 'local',
        state: 'local',
        syncing: false,
        lastSync: '',
        message: 'ローカル保存',
    };

    function updateStatus_(patch){
        Object.assign(syncStatus, patch || {});
        try {
            window.dispatchEvent(new CustomEvent('account-owned-sync:status', {
                detail: Object.assign({}, syncStatus),
            }));
        } catch(_) {}
    }

    function notifyReady_(){
        try {
            window.dispatchEvent(new CustomEvent('account-owned-sync:ready', {
                detail: { ready: !authCheckPending && !syncing },
            }));
        } catch(_) {}
    }

    function isLoginSyncReason_(reason){
        return ['login', 'signup', 'auto-login', 'whoami', 'init'].includes(String(reason || ''));
    }

    function refreshOwnedDisplay_(reason){
        const run = () => {
            try {
                window.dispatchEvent(new CustomEvent('owned-data:replaced', {
                    detail: { reason: reason || 'account-sync' },
                }));
            } catch(_) {}

            try {
                window.OwnedUI?.sync?.('#packs-root', {
                    grayscale: true,
                    skipSummary: true,
                    skipOwnedTotal: true,
                });
            } catch(_) {}

            try {
                if (typeof window.updateSummary === 'function') window.updateSummary();
                else window.Summary?.updateSummary?.();
            } catch(_) {}

            try { window.__syncCheckerMeters?.(); } catch(_) {}
        };

        run();
        setTimeout(run, 0);
        setTimeout(run, 150);
        setTimeout(run, 500);
    }

    function normalizeEntry_(entry){
        return {
            normal: Math.max(0, Number(entry?.normal || 0) | 0),
            shine: Math.max(0, Number(entry?.shine || 0) | 0),
            premium: Math.max(0, Number(entry?.premium || 0) | 0),
        };
    }

    function normalizeOwnedMap_(map){
        if (!map || typeof map !== 'object') return {};

        const out = {};
        Object.entries(map).forEach(([cd, entry]) => {
            const raw = String(cd || '').trim();
            if (!raw) return;

            const key = raw.padStart(5, '0');
            const normalized = normalizeEntry_(entry);
            const total = normalized.normal + normalized.shine + normalized.premium;
            if (total <= 0) return;

            out[key] = normalized;
        });

        return out;
    }

    function normalizeAppData_(data){
        const src = (data && typeof data === 'object') ? data : {};

        return {
            schema: 1,
            ownedCards: normalizeOwnedMap_(src.ownedCards || src.ownedData || {}),
            cardGroups: normalizeCardGroups_(src.cardGroups),
            savedDecks: Array.isArray(src.savedDecks) ? src.savedDecks.slice(0, 100) : [],
            updatedAt: String(src.updatedAt || ''),
        };
    }

    function hasOwnedData_(map){
        return Object.keys(normalizeOwnedMap_(map)).length > 0;
    }

    function ownedDataKey_(map){
        const normalized = normalizeOwnedMap_(map);
        return JSON.stringify(Object.keys(normalized).sort().map(cd => [cd, normalized[cd]]));
    }

    function isSameOwnedData_(a, b){
        return ownedDataKey_(a) === ownedDataKey_(b);
    }

    function normalizeCardGroups_(groups){
        const src = (groups && typeof groups === 'object') ? groups : {};
        let out = {};
        try {
            out = JSON.parse(JSON.stringify(src));
        } catch(_) {
            out = {};
        }

        out.activeId = '';
        out.editingId = '';
        out._editBase = null;
        return out;
    }

    function hasCardGroupsData_(groups){
        const normalized = normalizeCardGroups_(groups);

        try {
            if (window.CardGroups?.hasUserData) return window.CardGroups.hasUserData(normalized);
        } catch(_) {}

        const groupMap = normalized.groups || {};
        const order = Array.isArray(normalized.order) ? normalized.order : Object.keys(groupMap);
        if (order.some(id => id !== 'fav' && id !== 'meta' && groupMap[id])) return true;
        if (Object.keys(groupMap.fav?.cards || {}).length > 0) return true;
        if (normalized.sys?.fav?.touched || normalized.sys?.fav?.deleted) return true;
        if (normalized.sys?.meta?.touched || normalized.sys?.meta?.deleted) return true;
        return false;
    }

    function confirmCardGroupsSync_(message){
        if (typeof window.confirm !== 'function') return true;
        return window.confirm(message);
    }

    function isCardsPage_(){
        return !!(
            document.getElementById('cards') &&
            document.getElementById('checker') &&
            document.getElementById('tab1')
        );
    }

    function isCheckerHash_(){
        const hash = location.hash || '';
        return hash === '#checker' ||
            hash.startsWith('#pack-') ||
            hash.startsWith('#race-') ||
            hash === '#packs-root';
    }

    function isCardsTabOpen_(){
        if (!isCardsPage_()) return false;
        if (isCheckerHash_() && !cardsTabSwitchSeen) return false;

        const cards = document.getElementById('cards');
        const checker = document.getElementById('checker');
        const tab = document.getElementById('tab1');
        return !!(
            cards?.classList?.contains('active') &&
            tab?.classList?.contains('active') &&
            !checker?.classList?.contains('active')
        );
    }

    function getCardGroupsSyncConfirmMessage_(){
        return 'この端末のカードグループをアカウントに移行しますか？\nOK: この端末のカードグループをアカウントへ保存\nキャンセル: アカウント側のカードグループを使う';
    }

    function queueCardGroupsSync_(remoteGroups, reason){
        pendingCardGroupsSync = {
            remoteGroups: normalizeCardGroups_(remoteGroups),
            reason: reason || 'card-groups-sync',
        };
    }

    async function flushPendingCardGroupsSync_(){
        if (!pendingCardGroupsSync || pendingCardGroupsProcessing) return;
        if (!isCardsTabOpen_()) return;

        pendingCardGroupsProcessing = true;
        const pending = pendingCardGroupsSync;
        pendingCardGroupsSync = null;

        try {
            const localGroups = readLocalCardGroups_();
            const hasLocalGroups = hasCardGroupsData_(localGroups);
            const ok = hasLocalGroups && confirmCardGroupsSync_(getCardGroupsSyncConfirmMessage_());

            if (ok) {
                await saveAccountAppData_({ cardGroups: localGroups }, { confirmed: true });
                return;
            }

            writeLocalCardGroups_(pending.remoteGroups);
            refreshCardGroupsDisplay_('account-card-groups-empty');
        } finally {
            pendingCardGroupsProcessing = false;
        }
    }

    function confirmOwnedSync_(message){
        if (typeof window.confirm !== 'function') return true;
        return window.confirm(message);
    }

    function isOwnedInteractionReady_(){
        return !authCheckPending && !syncing;
    }

    const ACCOUNT_LINKED_MESSAGE = '\u30a2\u30ab\u30a6\u30f3\u30c8\u9023\u643a\u4e2d';

    function setAccountLinked_(message){
        const syncedAt = new Date().toISOString();
        accountOwnedLinkEnabled = true;
        try { localStorage.setItem(LS_LAST_SYNC, syncedAt); } catch(_) {}
        try { localStorage.setItem(LS_ACTIVE_SOURCE, 'account'); } catch(_) {}
        updateStatus_({
            source: 'account',
            state: 'account',
            syncing: false,
            lastSync: syncedAt,
            message: ACCOUNT_LINKED_MESSAGE,
        });
    }

    function setLocalOnly_(message){
        accountOwnedLinkEnabled = false;
        try { localStorage.setItem(LS_ACTIVE_SOURCE, 'local'); } catch(_) {}
        try { localStorage.removeItem(LS_LAST_SYNC); } catch(_) {}
        updateStatus_({
            source: 'local',
            state: 'local',
            syncing: false,
            lastSync: '',
            message: message || 'ローカル保存',
        });
    }

    function readLocalOwned_(){
        try {
            if (window.OwnedStore?.getAll) return normalizeOwnedMap_(window.OwnedStore.getAll());
        } catch(_) {}

        try {
            return normalizeOwnedMap_(JSON.parse(localStorage.getItem(LS_OWNED) || '{}'));
        } catch(_) {
            return {};
        }
    }

    function readGuestOwned_(){
        try {
            return normalizeOwnedMap_(JSON.parse(localStorage.getItem(LS_GUEST_OWNED) || '{}'));
        } catch(_) {
            return {};
        }
    }

    function saveGuestOwnedSnapshot_(){
        try {
            localStorage.setItem(LS_GUEST_OWNED, JSON.stringify(readLocalOwned_()));
        } catch(_) {}
    }

    function saveGuestCardGroupsSnapshot_(){
        const localGroups = readLocalCardGroups_();
        if (!hasCardGroupsData_(localGroups)) return;

        try {
            localStorage.setItem(LS_GUEST_CARD_GROUPS, JSON.stringify(localGroups));
        } catch(_) {}
    }

    function restoreGuestOwned_(){
        accountOwnedLinkEnabled = false;
        writeLocalOwned_(readGuestOwned_());
        restoreGuestCardGroups_();
        setLocalOnly_('ローカル保存');
        refreshOwnedDisplay_('logout-restore-local');
    }

    function writeLocalOwned_(map){
        const normalized = normalizeOwnedMap_(map);

        if (window.OwnedStore?.replaceAll) {
            window.OwnedStore.replaceAll(normalized);
            return;
        }

        try {
            localStorage.setItem(LS_OWNED, JSON.stringify(normalized));
        } catch(e) {
            console.error('所持データのローカル反映に失敗:', e);
        }
    }

    function readLocalCardGroups_(){
        try {
            if (window.CardGroups?.exportState) return normalizeCardGroups_(window.CardGroups.exportState());
            if (window.CardGroups?.getState) return normalizeCardGroups_(window.CardGroups.getState());
        } catch(_) {}

        try {
            const raw = localStorage.getItem(LS_CARD_GROUPS);
            const obj = raw ? JSON.parse(raw) : {};
            return normalizeCardGroups_(obj);
        } catch(_) {
            return {};
        }
    }

    function readGuestCardGroups_(){
        try {
            const raw = localStorage.getItem(LS_GUEST_CARD_GROUPS);
            return raw ? normalizeCardGroups_(JSON.parse(raw)) : {};
        } catch(_) {
            return {};
        }
    }

    function writeLocalCardGroups_(groups){
        const normalized = normalizeCardGroups_(groups);

        try {
            if (window.CardGroups?.replaceAll) {
                window.CardGroups.replaceAll(normalized);
                return;
            }
        } catch(_) {}

        try {
            localStorage.setItem(LS_CARD_GROUPS, JSON.stringify(normalized));
        } catch(e) {
            console.error('カードグループのローカル反映に失敗:', e);
        }
    }

    function restoreGuestCardGroups_(){
        const guestGroups = readGuestCardGroups_();
        writeLocalCardGroups_(hasCardGroupsData_(guestGroups) ? guestGroups : {});
        refreshCardGroupsDisplay_('logout-restore-local');
    }

    function refreshCardGroupsDisplay_(reason){
        try {
            window.dispatchEvent(new CustomEvent('card-groups:data-replaced', {
                detail: { reason: reason || 'account-sync' },
            }));
        } catch(_) {}

        try { window.applyFilters?.(); } catch(_) {}
    }

    function resolveCardGroupsSync_(remoteAppData, opts = {}){
        const isLoginSync = !!opts.isLoginSync;
        const isManual = !!opts.isManual;
        const localGroups = readLocalCardGroups_();
        const remoteGroups = normalizeCardGroups_(remoteAppData?.cardGroups);
        const hasLocalGroups = hasCardGroupsData_(localGroups);
        const hasRemoteGroups = hasCardGroupsData_(remoteGroups);

        if (hasRemoteGroups) {
            writeLocalCardGroups_(remoteGroups);
            refreshCardGroupsDisplay_('account-card-groups-restored');
            return { groups: remoteGroups, saveRemote: false, restored: true };
        }

        if (hasLocalGroups) {
            if (isLoginSync || isManual) {
                if (!isCardsTabOpen_()) {
                    queueCardGroupsSync_(remoteGroups, isLoginSync ? 'login' : 'manual');
                    return { groups: localGroups, saveRemote: false, pending: true };
                }

                const ok = confirmCardGroupsSync_(getCardGroupsSyncConfirmMessage_());
                if (ok) {
                    return { groups: localGroups, saveRemote: true, migrated: true };
                }
            }

            writeLocalCardGroups_(remoteGroups);
            refreshCardGroupsDisplay_('account-card-groups-empty');
            return { groups: remoteGroups, saveRemote: false, skipped: true };
        }

        return { groups: localGroups, saveRemote: true, empty: true };
    }

    function readLocalSavedDecks_(){
        try {
            if (window.SavedDeckStore?.list) return window.SavedDeckStore.list();
        } catch(_) {}

        try {
            const raw = localStorage.getItem('savedDecks');
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch(_) {
            return [];
        }
    }

    function readLocalAppData_(){
        return normalizeAppData_({
            ownedCards: readLocalOwned_(),
            cardGroups: readLocalCardGroups_(),
            savedDecks: readLocalSavedDecks_(),
        });
    }

    function isLoggedIn_(){
        return !!(Auth?.user && Auth?.token && Auth?.verified);
    }

    function refreshStatusFromAuth_(){
        let lastSync = '';
        try { lastSync = localStorage.getItem(LS_LAST_SYNC) || ''; } catch(_) {}

        if (!isLoggedIn_()) {
            accountOwnedLinkEnabled = false;
            updateStatus_({
                source: 'local',
                state: 'local',
                syncing: false,
                lastSync: '',
                message: 'ローカル保存',
            });
            return;
        }

        updateStatus_({
            source: accountOwnedLinkEnabled ? 'account' : 'local',
            state: accountOwnedLinkEnabled ? 'account' : 'local',
            syncing: false,
            lastSync,
            message: accountOwnedLinkEnabled ? 'アカウント連携中' : '未連携・ローカル保存',
        });
    }

    function isUnsupportedResponse_(res){
        if (!res || res.ok) return false;

        const error = String(res.error || res.message || '').toLowerCase();
        return Array.from(EMPTY_ERRORS).some(key => error.includes(key));
    }

    async function fetchAccountAppData_(){
        if (!API || !postJSON || !Auth?.token) return { ok: false, unsupported: true };

        try {
            const payload = Auth.attachToken ? Auth.attachToken({}) : { token: Auth.token };
            const res = await postJSON(`${API}?mode=appDataGet`, payload);

            if (isUnsupportedResponse_(res)) return { ok: false, unsupported: true };
            if (!res?.ok) return { ok: false, error: res?.error || 'appDataGet failed' };

            cachedAppData = normalizeAppData_(res.appData || {});

            return {
                ok: true,
                appData: cachedAppData,
                updatedAt: res.updatedAt || cachedAppData.updatedAt || '',
            };
        } catch(e) {
            return { ok: false, error: e?.message || 'appDataGet failed' };
        }
    }

    async function saveAccountAppData_(patch, opts = {}){
        if (!API || !postJSON || !Auth?.token) return { ok: false };
        if (!accountOwnedLinkEnabled && !opts.confirmed) {
            updateStatus_({
                source: 'local',
                state: 'local',
                syncing: false,
                message: '未連携・ローカル保存',
            });
            return { ok: false, skipped: true, reason: 'account-write-not-confirmed' };
        }

        const base = normalizeAppData_(cachedAppData || readLocalAppData_());
        const next = normalizeAppData_(Object.assign({}, base, patch || {}));
        const json = JSON.stringify(next);

        if (json === lastSavedJson) return { ok: false, skipped: true };

        try {
            const payload = Auth.attachToken
                ? Auth.attachToken({ appData: next })
                : { token: Auth.token, appData: next };

            const res = await postJSON(`${API}?mode=appDataSave`, payload);

            if (isUnsupportedResponse_(res)) {
                accountOwnedLinkEnabled = false;
                updateStatus_({
                    source: 'local',
                    state: 'error',
                    syncing: false,
                    message: '連携未対応・ローカル保存',
                });
                return { ok: false, unsupported: true };
            }
            if (!res?.ok) {
                accountOwnedLinkEnabled = false;
                updateStatus_({
                    source: 'local',
                    state: 'error',
                    syncing: false,
                    message: '連携失敗・ローカル保存',
                });
                return { ok: false, error: res?.error || 'appDataSave failed' };
            }

            cachedAppData = normalizeAppData_(Object.assign({}, next, { updatedAt: res.updatedAt || next.updatedAt }));
            lastSavedJson = JSON.stringify(next);
            setAccountLinked_('アカウント連携中');

            return { ok: true };
        } catch(e) {
            accountOwnedLinkEnabled = false;
            updateStatus_({
                source: 'local',
                state: 'error',
                syncing: false,
                message: '連携失敗・ローカル保存',
            });
            return { ok: false, error: e?.message || 'appDataSave failed' };
        }
    }

    async function saveOwnedToAccount_(){
        if (!accountOwnedLinkEnabled) {
            return { ok: false, skipped: true, reason: 'account-link-disabled' };
        }
        return saveAccountAppData_({ ownedCards: readLocalOwned_() });
    }

    async function saveCardGroupsToAccount_(){
        if (!accountOwnedLinkEnabled) {
            return { ok: false, skipped: true, reason: 'account-link-disabled' };
        }
        return saveAccountAppData_({ cardGroups: readLocalCardGroups_() });
    }

    function isCardGroupsEditable_(){
        return isLoggedIn_() && !syncing && accountOwnedLinkEnabled;
    }

    async function syncAppDataWithAccount(reason = 'manual'){
        if (syncing) return { ok: false, skipped: true };
        if (!isLoggedIn_()) {
            refreshStatusFromAuth_();
            notifyReady_();
            return { ok: false, skipped: true };
        }

        const isManual = String(reason || '') === 'manual-badge-click';
        const isLoginSync = isLoginSyncReason_(reason);
        if (!accountOwnedLinkEnabled) {
            saveGuestOwnedSnapshot_();
            saveGuestCardGroupsSnapshot_();
        }

        syncing = true;
        notifyReady_();
        updateStatus_({
            state: 'syncing',
            syncing: true,
            message: 'アカウント確認中',
        });
        try {
            const localOwned = readLocalOwned_();
            const hasLocalOwned = hasOwnedData_(localOwned);
            const remoteRes = await fetchAccountAppData_();

            if (remoteRes.unsupported) {
                accountOwnedLinkEnabled = false;
                updateStatus_({
                    source: 'local',
                    state: 'error',
                    syncing: false,
                    message: '連携未対応・ローカル保存',
                });
                return { ok: false, unsupported: true };
            }
            if (!remoteRes.ok) {
                accountOwnedLinkEnabled = false;
                updateStatus_({
                    source: 'local',
                    state: 'error',
                    syncing: false,
                    message: '連携失敗・ローカル保存',
                });
                return remoteRes;
            }

            const remoteAppData = normalizeAppData_(remoteRes.appData);
            const remoteOwned = normalizeOwnedMap_(remoteAppData.ownedCards);
            const hasRemoteOwned = hasOwnedData_(remoteOwned);
            const cardGroupsSync = resolveCardGroupsSync_(remoteAppData, { isLoginSync, isManual });
            const cardGroupsPatch = cardGroupsSync.saveRemote ? { cardGroups: cardGroupsSync.groups } : {};

            if (!hasRemoteOwned && hasLocalOwned) {
                if (!isManual && !isLoginSync) {
                    setLocalOnly_('未連携・ローカル保存');
                    return { ok: false, skipped: true, reason: 'local-to-account-requires-manual-confirm' };
                }

                if (isLoginSync) {
                    const ok = confirmOwnedSync_(
                        '\u3053\u306e\u7aef\u672b\u306e\u6240\u6301\u7387\u30c7\u30fc\u30bf\u3092\u30a2\u30ab\u30a6\u30f3\u30c8\u306b\u9023\u643a\u3057\u307e\u3059\u304b\uff1f\nOK: \u3053\u306e\u7aef\u672b\u306e\u6240\u6301\u7387\u30c7\u30fc\u30bf\u3092\u30a2\u30ab\u30a6\u30f3\u30c8\u3078\u4fdd\u5b58\n\u30ad\u30e3\u30f3\u30bb\u30eb: \u9023\u643a\u305b\u305a\u3001\u3053\u306e\u7aef\u672b\u3060\u3051\u3067\u4fdd\u5b58'
                    );
                    if (!ok) {
                        setLocalOnly_('local');
                        return { ok: false, skipped: true, reason: 'user-cancelled-local-to-account' };
                    }
                    return await saveAccountAppData_(Object.assign({ ownedCards: localOwned }, cardGroupsPatch), { confirmed: true });
                }

                const ok = confirmOwnedSync_(
                    'この端末の所持データをアカウントに連携しますか？\nOK: ローカルの所持データをアカウントへ保存\nキャンセル: 連携せず、この端末だけで保存'
                );
                if (!ok) {
                    setLocalOnly_('未連携・ローカル保存');
                    return { ok: false, skipped: true, reason: 'user-cancelled-local-to-account' };
                }
                return await saveAccountAppData_(Object.assign({ ownedCards: localOwned }, cardGroupsPatch), { confirmed: true });
            }

            if (hasRemoteOwned && !hasLocalOwned) {
                if (!isManual && !isLoginSync) {
                    setLocalOnly_('未連携・ローカル保存');
                    return { ok: false, skipped: true, reason: 'account-to-local-requires-login-or-manual' };
                }

                if (isLoginSync) {
                    writeLocalOwned_(remoteOwned);
                    refreshOwnedDisplay_('account-owned-restored');
                    if (cardGroupsSync.saveRemote) {
                        return await saveAccountAppData_(Object.assign({ ownedCards: remoteOwned }, cardGroupsPatch), { confirmed: true });
                    }
                    lastSavedJson = JSON.stringify(normalizeAppData_(remoteAppData));
                    setAccountLinked_('アカウント連携中');
                    return { ok: true, restored: true, reason };
                }

                const ok = confirmOwnedSync_(
                    'アカウントに保存済みの所持データがあります。この端末に反映しますか？\nOK: アカウントの所持データを読み込み\nキャンセル: 連携せず、この端末だけで保存'
                );
                if (!ok) {
                    setLocalOnly_('未連携・ローカル保存');
                    return { ok: false, skipped: true, reason: 'user-cancelled-account-to-local' };
                }

                writeLocalOwned_(remoteOwned);
                refreshOwnedDisplay_('account-owned-restored');
                if (cardGroupsSync.saveRemote) {
                    return await saveAccountAppData_(Object.assign({ ownedCards: remoteOwned }, cardGroupsPatch), { confirmed: true });
                }
                lastSavedJson = JSON.stringify(normalizeAppData_(remoteAppData));
                setAccountLinked_('アカウント連携中');
                return { ok: true, restored: true };
            }

            if (hasRemoteOwned && hasLocalOwned) {
                if (isLoginSync) {
                    writeLocalOwned_(remoteOwned);
                    refreshOwnedDisplay_('account-owned-restored');
                    if (cardGroupsSync.saveRemote) {
                        return await saveAccountAppData_(Object.assign({ ownedCards: remoteOwned }, cardGroupsPatch), { confirmed: true });
                    }
                    lastSavedJson = JSON.stringify(normalizeAppData_(remoteAppData));
                    setAccountLinked_('アカウント連携中');
                    return { ok: true, restored: true, reason };
                }

                if (isSameOwnedData_(localOwned, remoteOwned)) {
                    if (cardGroupsSync.saveRemote) {
                        return await saveAccountAppData_(Object.assign({ ownedCards: remoteOwned }, cardGroupsPatch), { confirmed: true });
                    }
                    lastSavedJson = JSON.stringify(normalizeAppData_(remoteAppData));
                    setAccountLinked_('アカウント連携中');
                    return { ok: true, same: true, reason };
                }

                if (!isManual) {
                    setLocalOnly_('未連携・ローカル保存');
                    return { ok: false, skipped: true, reason: 'conflict-requires-manual-confirm' };
                }

                const useLocal = confirmOwnedSync_(
                    'この端末とアカウントに別の所持データがあります。\nOK: この端末の所持データをアカウントに保存\nキャンセル: 次の確認へ'
                );
                if (useLocal) {
                    return await saveAccountAppData_(Object.assign({ ownedCards: localOwned }, cardGroupsPatch), { confirmed: true });
                }

                const useAccount = confirmOwnedSync_(
                    'アカウントの所持データをこの端末に読み込みますか？\nOK: アカウントの所持データを読み込み\nキャンセル: 連携せず、この端末だけで保存'
                );
                if (useAccount) {
                    writeLocalOwned_(remoteOwned);
                    refreshOwnedDisplay_('account-owned-restored');
                    if (cardGroupsSync.saveRemote) {
                        return await saveAccountAppData_(Object.assign({ ownedCards: remoteOwned }, cardGroupsPatch), { confirmed: true });
                    }
                    lastSavedJson = JSON.stringify(normalizeAppData_(remoteAppData));
                    setAccountLinked_('アカウント連携中');
                    return { ok: true, restored: true, reason };
                }

                setLocalOnly_('未連携・ローカル保存');
                return { ok: false, skipped: true, reason: 'user-cancelled-conflict' };
            }

            if (cardGroupsSync.saveRemote) {
                return await saveAccountAppData_(cardGroupsPatch, { confirmed: true });
            }
            setAccountLinked_('アカウント連携中');
            return { ok: true, empty: true };
        } finally {
            syncing = false;
            notifyReady_();
        }
    }

    function bindOwnedAutosave_(){
        if (!window.OwnedStore?.onChange) return;

        window.OwnedStore.onChange(() => {
            if (!isLoggedIn_() || syncing || !accountOwnedLinkEnabled) return;

            clearTimeout(bindOwnedAutosave_._timer);
            bindOwnedAutosave_._timer = setTimeout(() => {
                saveOwnedToAccount_();
            }, 1200);
        });
    }

    function bindCardGroupsAutosave_(){
        if (!window.CardGroups?.onChange) return;
        if (bindCardGroupsAutosave_._bound) return;
        bindCardGroupsAutosave_._bound = true;

        window.CardGroups.onChange(() => {
            if (!isLoggedIn_() || syncing || !accountOwnedLinkEnabled) return;

            clearTimeout(bindCardGroupsAutosave_._timer);
            bindCardGroupsAutosave_._timer = setTimeout(() => {
                saveCardGroupsToAccount_();
            }, 1200);
        });
    }

    function wrapAuthMethod_(name){
        if (!Auth || typeof Auth[name] !== 'function' || Auth[name].__appDataSyncWrapped) return;

        const original = Auth[name].bind(Auth);
        const wrapped = async function(){
            if (name === 'logout') {
                try {
                    return await original.apply(Auth, arguments);
                } finally {
                    authCheckPending = false;
                    restoreGuestOwned_();
                    notifyReady_();
                }
            }

            if (name === 'init') {
                authCheckPending = true;
                notifyReady_();
            }

            try {
                const result = await original.apply(Auth, arguments);
                if (isLoggedIn_() && (name === 'login' || name === 'signup' || (name === 'whoami' && authCheckPending))) {
                    await syncAppDataWithAccount(name === 'whoami' ? 'auto-login' : name);
                } else {
                    refreshStatusFromAuth_();
                }
                return result;
            } finally {
                if (name === 'init') {
                    authCheckPending = false;
                    notifyReady_();
                }
            }
        };

        wrapped.__appDataSyncWrapped = true;
        Auth[name] = wrapped;
    }

    window.AccountAppDataSync = window.AccountAppDataSync || {
        sync: syncAppDataWithAccount,
        save: saveOwnedToAccount_,
        saveCardGroups: saveCardGroupsToAccount_,
        readLocal: readLocalAppData_,
        isReady: isOwnedInteractionReady_,
        getStatus: () => Object.assign({}, syncStatus),
    };

    window.AccountOwnedSync = window.AccountOwnedSync || {
        sync: syncAppDataWithAccount,
        save: saveOwnedToAccount_,
        readLocal: readLocalOwned_,
        isReady: isOwnedInteractionReady_,
        getStatus: () => Object.assign({}, syncStatus),
    };

    window.AccountCardGroupsSync = window.AccountCardGroupsSync || {
        sync: syncAppDataWithAccount,
        save: saveCardGroupsToAccount_,
        readLocal: readLocalCardGroups_,
        isReady: isOwnedInteractionReady_,
        isEditable: isCardGroupsEditable_,
        getStatus: () => Object.assign({}, syncStatus),
    };

    wrapAuthMethod_('init');
    wrapAuthMethod_('login');
    wrapAuthMethod_('signup');
    wrapAuthMethod_('whoami');
    wrapAuthMethod_('logout');

    window.addEventListener('DOMContentLoaded', () => {
        refreshStatusFromAuth_();
        bindOwnedAutosave_();
        bindCardGroupsAutosave_();
        flushPendingCardGroupsSync_();
    });

    document.addEventListener('tab:switched', (e) => {
        if (e?.detail?.targetId === 'cards') cardsTabSwitchSeen = true;
        flushPendingCardGroupsSync_();
    });
})();
