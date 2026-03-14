/* =========================
 * js/external/deck-post-api.js
 * - DeckPost: GAS API 通信レイヤ（fetch / JSONP fallback）
 *
 * 役割：
 * - token 解決（DeckPostAuth / AuthDeckPost / window.Auth）
 * - POST（doPost）: gasPost_（mode 対応）
 * - GET（doGet） : apiList / apiCampaignTags / apiGetPost
 * - 互換：window.gasPost_ / window.gasPostDeckPost_
 *
 * 依存（存在すれば使う）：
 * - window.DECKPOST_API_BASE / window.GAS_API_BASE
 * - window.Auth.token（共通Authがいる場合）
 * ========================= */
(function () {
  'use strict';

  // =========================
  // 0) 設定
  // =========================

  // 共通定義からベースURLを取得
  const GAS_BASE = window.DECKPOST_API_BASE || window.GAS_API_BASE || '';

  // apiList のデフォルト（page4 側が PAGE_LIMIT を持っていても壊れない）
  const DEFAULT_PAGE_LIMIT = 20;

  // =========================
  // 1) token 解決
  // =========================
  function resolveToken() {
    // DeckPostAuth（正式）優先
    try {
      const raw = localStorage.getItem('DeckPostAuth');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.token) return String(obj.token);
      }
    } catch (_) {}

    // 古い名前
    try {
      const raw = localStorage.getItem('AuthDeckPost');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.token) return String(obj.token);
      }
    } catch (_) {}

    // 共通Auth も一応チェック
    try {
      const A = window.Auth;
      if (A && A.token) return String(A.token);
    } catch (_) {}

    return '';
  }

  // =========================
  // 2) doPost: 共通POST
  // =========================
    async function gasPost_(payload) {
        const base = window.DECKPOST_API_BASE || window.GAS_API_BASE || '';
        if (!base) return { ok: false, error: 'api base not set' };

        // ✅ mode 付きで叩けるようにする（post / like / updateDeckCode 等）
        const mode = String(payload?.mode || 'post');
        const url = base + '?mode=' + encodeURIComponent(mode);

        try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload || {}),
        });
        const json = await res.json().catch(() => null);
        return json || { ok: false, error: 'invalid response' };
        } catch (err) {
        return { ok: false, error: 'network' };
        }
    }

  // 互換：クリック委任などが window.gasPost_ を見ている場合がある
  window.gasPost_ = gasPost_;
  window.gasPostDeckPost_ = gasPost_;

  // =========================
  // 3) doGet: JSONP フォールバック
  // =========================
    function jsonpRequest(url) {
        return new Promise((resolve, reject) => {
        const cbName =
            '__deckpost_jsonp_' +
            Date.now().toString(36) +
            Math.random().toString(36).slice(2);

        const sep = url.includes('?') ? '&' : '?';
        const script = document.createElement('script');
        script.src = url + sep + 'callback=' + cbName;
        script.async = true;

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
            if (script.parentNode) script.parentNode.removeChild(script);
            if (timer) clearTimeout(timer);
        };

        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP timeout'));
        }, 10000);

        window[cbName] = (data) => {
            cleanup();
            resolve(data);
        };

        script.onerror = () => {
            cleanup();
            reject(new Error('JSONP script error'));
        };

        document.body.appendChild(script);
        });
    }

  // =========================
  // 4) doGet: APIラッパ（一覧）
  // =========================
    async function apiList(opts = {}) {
        const limit = Number(opts.limit ?? DEFAULT_PAGE_LIMIT);
        const offset = Number(opts.offset ?? 0);
        const mine = !!opts.mine;

        if (!GAS_BASE) return { ok: false, error: 'api base not set' };

        const qs = new URLSearchParams();
        qs.set('mode', 'list');
        qs.set('limit', String(limit));
        qs.set('offset', String(offset));

        if (mine) qs.set('mine', '1');

        // ログインしていれば token を付ける（一覧/マイ投稿 共通）
        const tk = (window.Auth && window.Auth.token) || opts.token || resolveToken();
        if (tk) qs.set('token', String(tk));

        const url = `${GAS_BASE}?${qs.toString()}`;

        // 1) まず fetch(JSON) を試す
        try {
        const res = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store',
        });

        if (!res.ok) {
            console.warn('apiList: fetch status not ok:', res.status, res.statusText);
        } else {
            const data = await res.json();

            // 期待している形式かざっくりチェック
            if (data && (Array.isArray(data.items) || data.ok !== undefined || data.error)) {
            return data;
            }
            console.warn('apiList: unexpected JSON format, fallback to JSONP', data);
        }
        } catch (err) {
        console.warn('apiList: fetch failed, fallback to JSONP', err);
        }

        // 2) ダメなら JSONP
        try {
        const resJsonp = await jsonpRequest(url);
        return resJsonp;
        } catch (e) {
        return { ok: false, error: 'jsonp failed' };
        }
    }

  // =========================
  // 5) doGet: キャンペーンタグ一覧
  // =========================
  async function apiCampaignTags() {
    if (!GAS_BASE) return { ok: false, error: 'api base not set' };

    const qs = new URLSearchParams();
    qs.set('mode', 'campaignTags');
    const url = `${GAS_BASE}?${qs.toString()}`;

    // 基本は fetch
    try {
      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (data) return data;
    } catch (_) {}

    // フォールバック：JSONP
    try {
      return await jsonpRequest(url);
    } catch (_) {
      return { ok: false, error: 'campaignTags failed' };
    }
  }

  // =========================
  // 6) doGet: 投稿1件取得（共有pid用）
  // =========================
  async function apiGetPost(opts = {}) {
    const postId = String(opts.postId || opts.pid || '').trim();
    if (!postId) return { ok: false, error: 'postId required' };
    if (!GAS_BASE) return { ok: false, error: 'api base not set' };

    const qs = new URLSearchParams();
    qs.set('mode', 'get');
    qs.set('postId', postId);

    const tk = (window.Auth && window.Auth.token) || opts.token || resolveToken();
    if (tk) qs.set('token', String(tk));

    const url = `${GAS_BASE}?${qs.toString()}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (data) return data;
    } catch (_) {}

    try {
      return await jsonpRequest(url);
    } catch (_) {
      return { ok: false, error: 'get failed' };
    }
  }

  // =========================
  // 7) doPost: いいね（将来/既存UI用）
  // =========================
  async function apiToggleLike(opts = {}) {
    const postId = String(opts.postId || '').trim();
    if (!postId) return { ok: false, error: 'postId required' };

    const tk = (window.Auth && window.Auth.token) || opts.token || resolveToken();

    // like: true/false（省略時は toggle 想定でもOKだが、ここは明示推奨）
    const like = (opts.like === undefined) ? null : !!opts.like;

    const payload = {
      mode: 'like',
      postId,
      token: tk || '',
    };
    if (like !== null) payload.like = like ? 1 : 0;

    return await gasPost_(payload);
  }

  // =========================
  // 公開API
  // =========================
  window.DeckPostApi = window.DeckPostApi || {
    // base
    getBase() { return GAS_BASE; },

    // token
    resolveToken,

    // doPost
    gasPost_,
    apiToggleLike,

    // doGet
    jsonpRequest,
    apiList,
    apiCampaignTags,
    apiGetPost,
  };
})();