/* =========================
 * js/common/account/account-match-results.js
 * - 保存デッキ戦績APIのクライアント
 * - GASの matchResultAdd / matchResultsList / matchResultDelete / matchResultsSummary を呼び出す
 * ========================= */
(function () {
  'use strict';

  const API = window.API || window.AUTH_API_BASE || window.GAS_API_BASE;
  const Auth = window.Auth;
  const postJSON = window.postJSON;
  const MATCH_MEMO_MAX_LENGTH = 200;

  function isLoggedIn_() {
    return !!(Auth?.user && Auth?.token && Auth?.verified);
  }

  function buildPayload_(data) {
    const body = data && typeof data === 'object' ? Object.assign({}, data) : {};
    if (Auth?.attachToken) return Auth.attachToken(body);
    body.token = Auth?.token || body.token || '';
    return body;
  }

  async function request_(mode, data) {
    if (!API || !postJSON) return { ok: false, error: 'api unavailable' };
    if (!isLoggedIn_()) return { ok: false, error: 'auth required' };

    const res = await postJSON(`${API}?mode=${encodeURIComponent(mode)}`, buildPayload_(data));
    return res && typeof res === 'object' ? res : { ok: false, error: 'invalid response' };
  }

  function normalizeResult_(value) {
    const v = String(value || '').trim().toLowerCase();
    return (v === 'win' || v === 'lose') ? v : '';
  }

  function normalizePriority_(value) {
    const v = String(value || '').trim().toLowerCase();
    return (v === 'self' || v === 'opponent') ? v : '';
  }

  function normalizeRating_(value) {
    const s = String(value || '').trim();
    return /^\d{5}$/.test(s) ? s : '';
  }

  function normalizeAddInput_(data = {}) {
    return {
      deckId: String(data.deckId || '').trim(),
      playedAt: data.playedAt || '',
      result: normalizeResult_(data.result),
      opponentDeck: String(data.opponentDeck || '').trim(),
      rating: normalizeRating_(data.rating),
      priority: normalizePriority_(data.priority),
      memo: String(data.memo || '').trim().slice(0, MATCH_MEMO_MAX_LENGTH),
    };
  }

  async function add(data) {
    const payload = normalizeAddInput_(data);
    return request_('matchResultAdd', payload);
  }

  async function list(opts = {}) {
    return request_('matchResultsList', {
      deckId: String(opts.deckId || '').trim(),
      limit: opts.limit,
    });
  }

  async function remove(matchId) {
    return request_('matchResultDelete', {
      matchId: String(matchId || '').trim(),
    });
  }

  async function summary(opts = {}) {
    return request_('matchResultsSummary', {
      deckId: String(opts.deckId || '').trim(),
      limit: opts.limit,
    });
  }

  window.AccountMatchResults = window.AccountMatchResults || {
    add,
    list,
    delete: remove,
    remove,
    summary,
    isReady: isLoggedIn_,
  };
})();
