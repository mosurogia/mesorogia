/**
 * js/common/card-groups.js
 * - カードグループのデータ/保存（localStorage）
 * - 最大10個
 * - 初期：お気に入り / メタカード（固定名）
 * - 複数所属OK
 */
(function () {
  'use strict';

  const LS_KEY = 'cardGroupsV1';
  const MAX_GROUPS = 10;

  const FIXED = [
    { id: 'fav',  name: 'お気に入り', fixed: true },
    { id: 'meta', name: 'メタカード', fixed: true },
  ];

  function nowId_() {
    return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function read_() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const obj = raw ? JSON.parse(raw) : null;
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    } catch {
      return null;
    }
  }

  function write_(st) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch {}
  }

  function ensureDefault_() {
    let st = read_();
    if (!st) {
      st = {
        v: 1,
        order: FIXED.map(g => g.id),
        groups: {
          fav:  { id: 'fav',  name: 'お気に入り', fixed: true,  cards: {} },
          meta: { id: 'meta', name: 'メタカード', fixed: true,  cards: {} },
        },
        activeId: '',     // フィルターとして使うグループ（通常時）
        editingId: '',    // 編集モード中のグループ
      };
      write_(st);
      return st;
    }

    // 固定2グループが消えてたら復旧
    st.groups = st.groups || {};
    st.order = Array.isArray(st.order) ? st.order : [];
    for (const g of FIXED) {
      if (!st.groups[g.id]) st.groups[g.id] = { ...g, cards: {} };
      if (!st.order.includes(g.id)) st.order.unshift(g.id);
    }

    // 余計なIDを order から掃除
    st.order = st.order.filter(id => st.groups[id]);

    // 上限超えてたら末尾を落とす（安全策）
    while (st.order.length > MAX_GROUPS) {
      const dropId = st.order.pop();
      if (dropId && !st.groups[dropId]?.fixed) delete st.groups[dropId];
    }

    write_(st);
    return st;
  }

  let state = ensureDefault_();
  const listeners = new Set();
  function emit_() { listeners.forEach(fn => { try { fn(state); } catch {} }); }

  function getState() {
    state = ensureDefault_();
    return JSON.parse(JSON.stringify(state));
  }
  function setState_(next) {
    state = next;
    write_(state);
    emit_();
  }

  function listGroups() {
    const st = getState();
    return st.order.map(id => st.groups[id]).filter(Boolean);
  }

  function canCreate() {
    const st = getState();
    return st.order.length < MAX_GROUPS;
  }

  function createGroup(name = '新しいグループ') {
    const st = getState();
    if (st.order.length >= MAX_GROUPS) return { ok: false, reason: 'limit' };

    const id = nowId_();
    // 同名OK、空は防ぐ（バグ回避）
    const safeName = String(name || '').trim() || `グループ${st.order.length + 1}`;

    st.groups[id] = { id, name: safeName, fixed: false, cards: {} };
    st.order.push(id);
    setState_(st);
    return { ok: true, id };
  }

  function renameGroup(id, name) {
    const st = getState();
    const g = st.groups[id];
    if (!g) return { ok: false };
    if (g.fixed) return { ok: false, reason: 'fixed' };

    const safeName = String(name || '').trim() || `グループ${st.order.indexOf(id) + 1}`;
    g.name = safeName;
    setState_(st);
    return { ok: true };
  }

  function deleteGroup(id) {
    const st = getState();
    const g = st.groups[id];
    if (!g) return { ok: false };
    if (g.fixed) return { ok: false, reason: 'fixed' };

    delete st.groups[id];
    st.order = st.order.filter(x => x !== id);
    if (st.activeId === id) st.activeId = '';
    if (st.editingId === id) st.editingId = '';
    setState_(st);
    return { ok: true };
  }

  function moveGroup(id, toIndex) {
    const st = getState();
    const from = st.order.indexOf(id);
    if (from < 0) return { ok: false };
    toIndex = Math.max(0, Math.min(st.order.length - 1, toIndex));

    st.order.splice(from, 1);
    st.order.splice(toIndex, 0, id);
    setState_(st);
    return { ok: true };
  }

  function setActive(id) {
    const st = getState();
    st.activeId = (id && st.groups[id]) ? id : '';
    setState_(st);
    return { ok: true };
  }

  // ✅ active（フィルター）をトグル：同じなら解除
  function toggleActive(id){
    const st = getState();
    const next = (id && st.groups[id]) ? id : '';
    st.activeId = (st.activeId === next) ? '' : next;
    setState_(st);
    return { ok: true };
  }

  function startEditing(id) {
    const st = getState();
    st.editingId = (id && st.groups[id]) ? id : '';
    // 編集中は “通常フィルター” を止めたいので activeId は保持しつつ、
    // CardGroupsUI 側で applyFilters を「編集中はgroup filter無効」にする
    setState_(st);
    return { ok: true };
  }


  // ✅ 新規作成→編集開始を “1回の保存” で行う（固まり対策）
  function createGroupAndEdit(name = '新しいグループ'){
    const st = getState();
    if (st.order.length >= MAX_GROUPS) return { ok:false, reason:'limit' };

    const id = nowId_();
    const safeName = String(name || '').trim() || `グループ${st.order.length + 1}`;
    st.groups[id] = { id, name: safeName, fixed:false, cards:{} };
    st.order.push(id);

    // ✅ 編集だけ開始（active=フィルターは触らない）
    st.editingId = id;
    setState_(st);
    return { ok:true, id };
  }

  function stopEditing() {
    const st = getState();
    st.editingId = '';
    setState_(st);
    return { ok: true };
  }

  function toggleCardInGroup(groupId, cd) {
    const st = getState();
    const g = st.groups[groupId];
    if (!g) return { ok: false };
    cd = String(cd || '').padStart(5, '0');

    g.cards = g.cards || {};
    if (g.cards[cd]) delete g.cards[cd];
    else g.cards[cd] = 1;

    setState_(st);
    return { ok: true };
  }

  function hasCard(groupId, cd) {
    const st = getState();
    const g = st.groups[groupId];
    if (!g) return false;
    cd = String(cd || '').padStart(5, '0');
    return !!(g.cards && g.cards[cd]);
  }

  function getActiveFilterSet() {
    const st = getState();
    // ✅ 編集中はフィルター無効（全カード見せる）
    if (st.editingId) return null;

    const id = st.activeId;
    if (!id || !st.groups[id]) return null;

    const cards = st.groups[id].cards || {};
    const set = new Set(Object.keys(cards));
    return set.size ? set : null;
  }

  function getEditingId() {
    const st = getState();
    return st.editingId || '';
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
  }

  window.CardGroups = {
    MAX_GROUPS,
    getState,
    listGroups,
    canCreate,
    createGroup,
    renameGroup,
    deleteGroup,
    moveGroup,
    setActive,
    toggleActive,
    startEditing,
    createGroupAndEdit,
    stopEditing,
    toggleCardInGroup,
    hasCard,
    getActiveFilterSet,
    getEditingId,
    onChange,
  };
})();
