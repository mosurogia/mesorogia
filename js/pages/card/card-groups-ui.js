/**
 * js/pages/card/card-groups-ui.js
 * - グループUI（PCサイドバー中心）
 * - モーダルは当面使わない
 *
 * 新仕様：
 * - セクション選択（rowクリック）→ ヘッダの操作が有効化
 * - グループ名クリック → インラインで名前編集（Enter確定 / Escキャンセル）
 * - ヘッダ操作（3列）
 *   1列目：編集 / 削除
 *   2列目：↑ / ↓（未選択時はdisabled）
 *   3列目：選択完了（編集中のみ表示）
 */
(function () {
'use strict';

function qs(sel, root = document) { return root.querySelector(sel); }
function escapeHtml_(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

function ensureReady_() {
    return !!(window.CardGroups && document.getElementById('cards-groups-list') && document.getElementById('grid'));
}

// UI上の「選択中グループ」（activeId/editingIdとは別）
let uiSelectedId = '';

// UI側の選択解除を外部から呼べるようにする（cardFilter から使う）
window.__CardGroupsUI = window.__CardGroupsUI || {};
window.__CardGroupsUI.clearSelected = function () {
  uiSelectedId = '';
};

// rAFで重い処理を“1回だけ”にまとめる（固まり対策）
let rafQueued = false;
function scheduleHeavySync_() {
    if (rafQueued) return;
    rafQueued = true;
    requestAnimationFrame(() => {
    rafQueued = false;
    try { renderSidebar_(); } catch {}
    try { applyEditVisual_(); } catch {}
    try { window.applyFilters?.(); } catch {}
    });
}

function renderSidebar_() {
    const host = document.getElementById('cards-groups-list');
    if (!host) return;

    const st = window.CardGroups.getState();
    const groups = st.order.map(id => st.groups[id]).filter(Boolean);

    // 選択が消えてたらクリア
    if (uiSelectedId && !st.groups[uiSelectedId]) uiSelectedId = '';

    // status（未選択時は warn のみ＋案内文を下に出す）
    let baseStatus = '';
    if (st.editingId) {
    baseStatus = `編集中：<b>${escapeHtml_(st.groups[st.editingId]?.name || '')}</b>`;
    } else if (st.activeId) {
    baseStatus = `適用中：<b>${escapeHtml_(st.groups[st.activeId]?.name || '')}</b>`;
    }

    // status：表示文字列を1本化（全部同じ場所に出す）
    let statusLine = '';
    let helpLine = '';

    // 優先度：編集中 > 適用中 > 選択中 > 未選択
    if (st.editingId) {
    statusLine = `編集中：<b>${escapeHtml_(st.groups[st.editingId]?.name || '')}</b>`;
    } else if (st.activeId) {
    statusLine = `適用中：<b>${escapeHtml_(st.groups[st.activeId]?.name || '')}</b>`;
    } else if (uiSelectedId) {
    statusLine = `選択：<b>${escapeHtml_(st.groups[uiSelectedId]?.name || '')}</b>`;
    } else {
    statusLine = `<span class="cg-warn">グループ未選択</span>`;
    helpLine = `<div class="cg-help">タップしてグループを選択してください</div>`;
    }

    host.innerHTML = `
    <div class="cg-head">
        <div class="cg-head-row cg-head-row-title">
        <div class="cg-head-title">🗂️ カードグループ</div>
        </div>

        <div class="cg-head-row cg-head-row-status">
        <div class="cg-current">${statusLine}${helpLine}</div>
        </div>

        <div class="cg-head-row cg-head-row-ops cg-ops-grid">
        <!-- 1列目：編集/削除 -->
        <div class="cg-ops-col">
            <button type="button" class="cg-icon-btn" id="cg-op-edit" title="グループカード編集">✏️</button>
            <button type="button" class="cg-icon-btn" id="cg-op-del"  title="グループ削除">🗑</button>
        </div>

        <!-- 2列目：↑/↓ -->
        <div class="cg-ops-col">
            <button type="button" class="cg-icon-btn" id="cg-op-up"   title="上へ">↑</button>
            <button type="button" class="cg-icon-btn" id="cg-op-down" title="下へ">↓</button>
        </div>

        <!-- 3列目：完了（編集中のみ） -->
        <div class="cg-ops-col cg-ops-col-right">
            <button type="button" class="cg-head-btn" id="cg-exit-edit"
            style="display:${st.editingId ? '' : 'none'};">選択完了</button>
        </div>
        </div>
    </div>

    <div class="cg-list" id="cg-sidebar-list">
        ${groups.map(g => rowHtml_(g, st)).join('')}
    </div>

    <button type="button" class="cg-add" id="cg-sidebar-add">＋ グループを追加</button>
    <div class="cg-limit" id="cg-sidebar-limit" style="display:none;"></div>
    `;

    // --- ヘッダ操作 enable/disable
    const hasSel = !!uiSelectedId;
    const isEditing = !!st.editingId;

    // 普段は押せない（未選択時）
    ['#cg-op-edit', '#cg-op-del', '#cg-op-up', '#cg-op-down'].forEach(sel => {
    const b = qs(sel, host);
    if (!b) return;
    b.disabled = (!hasSel) || (isEditing && sel !== '#cg-op-del'); // 編集中は「削除」以外触らせないならここで制御
    b.classList.toggle('is-disabled', b.disabled);
    });

    // 選択完了
    qs('#cg-exit-edit', host)?.addEventListener('click', () => {
    window.CardGroups.stopEditing();
    scheduleHeavySync_();
    });

    // 編集（= startEditing）
    qs('#cg-op-edit', host)?.addEventListener('click', () => {
    const st2 = window.CardGroups.getState();
    if (!uiSelectedId) return showSelectWarn_();
    if (st2.editingId) return; // すでに編集中
    window.CardGroups.startEditing(uiSelectedId);
    scheduleHeavySync_();
    });

    // 削除（confirm）
    qs('#cg-op-del', host)?.addEventListener('click', () => {
    const st2 = window.CardGroups.getState();
    if (!uiSelectedId) return showSelectWarn_();

    const g = st2.groups[uiSelectedId];
    if (!g || g.fixed) return;

    const count = Object.keys(g.cards || {}).length;
    const ok = confirm(`「${g.name}」を削除しますか？\n（登録カード：${count}枚）`);
    if (!ok) return;

    window.CardGroups.deleteGroup(uiSelectedId);
    uiSelectedId = '';
    scheduleHeavySync_();
    });

    // ↑/↓（1つだけ移動）
    qs('#cg-op-up', host)?.addEventListener('click', () => moveSelectedBy_(-1));
    qs('#cg-op-down', host)?.addEventListener('click', () => moveSelectedBy_(+1));

    // 追加
    qs('#cg-sidebar-add', host)?.addEventListener('click', () => {
    if (!window.CardGroups.canCreate()) {
        showLimit_('#cg-sidebar-limit');
        return;
    }
    window.CardGroups.createGroupAndEdit();
    // createGroupAndEdit が editingId に入る想定：選択も追従
    try {
        const st3 = window.CardGroups.getState();
        uiSelectedId = st3.editingId || uiSelectedId;
    } catch {}
    // onChange → scheduleHeavySync_
    });

    bindRowEvents_(host);
}

function showSelectWarn_() {
    // status行に出す方針：再描画せずに簡易表示
    const cur = document.querySelector('#cards-groups-list .cg-current');
    if (!cur) return;
    cur.classList.add('cg-pulse-warn');
    setTimeout(() => { try { cur.classList.remove('cg-pulse-warn'); } catch {} }, 650);
}

function moveSelectedBy_(delta) {
    const st = window.CardGroups.getState();
    if (!uiSelectedId) return showSelectWarn_();
    if (st.editingId) return; // 編集中は移動禁止

    const fromIndex = st.order.indexOf(uiSelectedId);
    if (fromIndex < 0) return;

    const toIndex = Math.max(0, Math.min(st.order.length - 1, fromIndex + delta));
    if (toIndex === fromIndex) return;

    window.CardGroups.moveGroup(uiSelectedId, toIndex);
    // onChangeで再描画される
}

function rowHtml_(g, st) {
    const isActive = st.activeId === g.id;
    const isEditing = st.editingId === g.id;
    const isSelected = uiSelectedId === g.id;

    // ✅ 合計枚数（cd->count 形式も、cd->true 形式も吸収）
    const cardsObj = g.cards || {};
    const total = Object.values(cardsObj).reduce((sum, v) => {
    if (typeof v === 'number') return sum + (v | 0);
    // boolean / null / {} などは “1枚扱い” に寄せる
    return sum + 1;
    }, 0);

    // サムネ：先頭8枚（必要なら9）
    const allCds = Object.keys(cardsObj);
    const cds = allCds.slice(0, 8).map(cd => String(cd).padStart(5, '0'));
    const more = Math.max(0, allCds.length - cds.length);

    // 0枚時の表示文言（編集状態なら文言変えてもOK）
    const emptyLabel = st.editingId === g.id
    ? 'カード未選択（カードをタップして追加）'
    : 'ここにカードが表示されます';

    return `
        <div class="cg-row ${isActive ? 'is-active' : ''} ${isEditing ? 'is-editing' : ''} ${isSelected ? 'is-selected' : ''}"
        data-gid="${g.id}" data-fixed="${g.fixed ? '1' : ''}">
        <div class="cg-row-top">
            <button type="button" class="cg-name-btn" title="グループ名をクリックで編集">
            <span class="cg-name-text">${escapeHtml_(g.name)}</span>
            </button>
            <input class="cg-name-input" type="text" value="${escapeHtml_(g.name)}"
            aria-label="グループ名を編集" />
            <!-- 枚数表示 -->
            <span class="cg-count" title="このグループの枚数">${total}枚</span>

        </div>

        <div class="cg-mini" aria-label="グループ内カードの簡易表示">
            ${
            allCds.length === 0
                ? `<div class="cg-mini-empty">${escapeHtml_(emptyLabel)}</div>`
                : `
                ${cds.map((cd, i) => `
                    <span class="cg-mini-card" style="--i:${i}">
                    <img src="img/${escapeHtml_(cd)}.webp" alt="" loading="lazy" decoding="async"
                        onerror="this.onerror=null;this.src='img/00000.webp';" />
                    </span>
                `).join('')}
                ${more ? `<span class="cg-mini-more">+${more}</span>` : ``}
                `
            }
        </div>
        </div>
    `.trim();
}

function showLimit_(sel) {
    const el = qs(sel);
    if (!el) return;
    el.style.display = '';
    el.textContent = 'グループは最大10個まで作成できます。';
    setTimeout(() => { try { el.style.display = 'none'; } catch {} }, 2200);
}

function bindRowEvents_(root) {
  if (root.dataset.cgRowBound) return;
  root.dataset.cgRowBound = '1';

  root.addEventListener('click', (e) => {
    const row = e.target.closest('.cg-row');
    if (!row) return;
    const gid = row.dataset.gid;
    if (!gid) return;

    const st = window.CardGroups.getState();

    // ① グループ名クリック → 名前編集モードへ（固定グループは除外）
    const nameText = e.target.closest('.cg-name-text');
    if (nameText) {
    e.preventDefault();
    e.stopPropagation();

    // ✅ fixed（お気に入り / メタカード）は rename に入らない
    const g = st.groups?.[gid];
    if (g?.fixed) {
        uiSelectedId = gid;          // 選択だけはする（好みで）
        scheduleHeavySync_();        // 見た目更新（任意）
        return;
    }

    uiSelectedId = gid;
    const input = row.querySelector('.cg-name-input');
    if (!input) return;

    row.classList.add('is-renaming');
    input.style.display = '';
    input.focus();
    input.select();
    return;
    }

    // ② それ以外の部分 → 行選択（※解除時は後で外す）
    uiSelectedId = gid;

    // ✅ ③ クリック1回で「選択＋絞り込み（active）」、同じグループ再タップで解除
    //    ※ 編集中は “フィルター適用しない” 方針なので active は触らない
    if (!st.editingId) {
    const isSame = (st.activeId === gid);

    if (isSame) {
        // ✅ 再タップ解除：active解除 + UI選択も解除（= グループ未選択）
        window.CardGroups?.setActive?.('');
        uiSelectedId = '';
    } else {
        // 選択適用：activeにして、UI選択もそのまま
        window.CardGroups?.setActive?.(gid);
        uiSelectedId = gid;

        // ✅ SPドロワー：必要なら「選択後に閉じる」（ユーザー設定ON時のみ）
        try { window.__SpGroupDrawer?.onGroupSelected?.(); } catch {}
    }
    }

    // 再描画 + applyFilters（scheduleHeavySync_ 内でまとめて実行）
    scheduleHeavySync_();
  });

  // rename: Enter確定 / Escキャンセル / blur確定
  root.addEventListener('keydown', (e) => {
    const input = e.target.closest('.cg-name-input');
    if (!input) return;

    const row = input.closest('.cg-row');
    const gid = row?.dataset.gid;
    if (!gid) return;

    if (e.key === 'Escape') {
      const st = window.CardGroups.getState();
      input.value = st.groups[gid]?.name || input.value;
      row.classList.remove('is-renaming');
      input.style.display = 'none';
      e.stopPropagation();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });

  root.addEventListener('blur', (e) => {
    const input = e.target.closest('.cg-name-input');
    if (!input) return;

    const row = input.closest('.cg-row');
    const gid = row?.dataset.gid;
    if (!gid) return;

    const st = window.CardGroups.getState();
    const g = st.groups[gid];
    if (!g || g.fixed) {
      row.classList.remove('is-renaming');
      input.style.display = 'none';
      return;
    }

    const next = String(input.value || '').trim();
    if (next && next !== g.name) {
      window.CardGroups.renameGroup(gid, next);
    }

    row.classList.remove('is-renaming');
    input.style.display = 'none';

    const btn = row.querySelector('.cg-name-btn');
    if (btn && next) btn.textContent = next;

  }, true);
}

// 編集モード：カード側の視覚反映
function applyEditVisual_() {
    const st = window.CardGroups.getState();
    const editingId = st.editingId || '';
    document.body.classList.toggle('is-group-editing', !!editingId);

    const grid = document.getElementById('grid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.card'));
    if (!editingId) {
    cards.forEach(el => el.classList.remove('group-picked'));
    return;
    }

    cards.forEach(el => {
    const cd = String(el.dataset.cd || '').padStart(5, '0');
    const picked = window.CardGroups.hasCard(editingId, cd);
    el.classList.toggle('group-picked', picked);
    });
}

// 編集中：カードクリックを「追加/削除」に差し替え（zoom-btnは除外）
function bindCardTapOverride_() {
    const grid = document.getElementById('grid');
    if (!grid || grid.dataset.groupTapBound) return;
    grid.dataset.groupTapBound = '1';

    grid.addEventListener('click', (e) => {
    const st = window.CardGroups.getState();
    const editingId = st.editingId || '';
    if (!editingId) return;

    if (e.target.closest('.zoom-btn')) return;

    const cardEl = e.target.closest('.card');
    if (!cardEl || !grid.contains(cardEl)) return;

    e.preventDefault();
    e.stopPropagation();

    const cd = String(cardEl.dataset.cd || '').padStart(5, '0');
    window.CardGroups.toggleCardInGroup(editingId, cd);
    cardEl.classList.toggle('group-picked', window.CardGroups.hasCard(editingId, cd));
    }, { capture: true });
}

function init() {
  if (!ensureReady_()) return;

  // ✅ 再読込時はグループフィルターを解除
  try {
    window.CardGroups?.clearActiveOnBoot?.();
  } catch {}

window.CardGroups.onChange(() => {
  try {
    const st = window.CardGroups.getState();
    if (st.editingId) {
      uiSelectedId = st.editingId;
    } else if (!st.activeId) {
      // ✅ 外部解除（チップ解除など）で「選択中」が残るのを防ぐ
      uiSelectedId = '';
    }
  } catch {}
  scheduleHeavySync_();
});

  renderSidebar_();
  applyEditVisual_();
  bindCardTapOverride_();
}


window.addEventListener('DOMContentLoaded', init);
window.addEventListener('card-page:ready', init);
})();
