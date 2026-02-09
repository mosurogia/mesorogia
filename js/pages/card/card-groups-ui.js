    /**
     * js/pages/card/card-groups-ui.js
     * - グループUI（PCサイドバー中心）
     * - モーダルは当面使わない（将来の大改修に備えて依存しない）
     *
     * 仕様：
     * - ☑（編集）を押したら編集モードに入る（フィルターは掛けない）
     * - グループ名クリックでフィルター適用/解除（トグル）
     * - 編集終了ボタンはサイドバー上部に配置
     * - 新規作成は createGroupAndEdit で “1回更新” にまとめて固まり回避
     */
    (function () {
    'use strict';

    function qs(sel, root = document) { return root.querySelector(sel); }

    function ensureReady_() {
        return !!(window.CardGroups && document.getElementById('cards-groups-list') && document.getElementById('grid'));
    }

    // rAFで重い処理を“1回だけ”にまとめる（固まり対策）
    let rafQueued = false;
    function scheduleHeavySync_() {
        if (rafQueued) return;
        rafQueued = true;
        requestAnimationFrame(() => {
        rafQueued = false;
        try { renderSidebar_(); } catch {}
        try { applyEditVisual_(); } catch {}
        try { window.applyFilters?.(); } catch {} // group filter反映（activeIdがある時だけ）
        });
    }

    function escapeHtml_(s) {
        return String(s ?? '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    }

    function renderSidebar_() {
        const host = document.getElementById('cards-groups-list');
        if (!host) return;

        const st = window.CardGroups.getState();
        const groups = st.order.map(id => st.groups[id]).filter(Boolean);

        // 上部：整理されたヘッダ＋状態＋操作行
        host.innerHTML = `
        <div class="cg-head">
            <div class="cg-head-row cg-head-row-title">
            <div class="cg-head-title">🗂️ カードグループ</div>
            </div>

            <div class="cg-head-row cg-head-row-status">
            <div class="cg-current">
                ${st.editingId
                ? `編集中：<b>${escapeHtml_(st.groups[st.editingId]?.name || '')}</b>`
                : (st.activeId
                    ? `適用中：<b>${escapeHtml_(st.groups[st.activeId]?.name || '')}</b>`
                    : '（全カード表示）')}
            </div>
            </div>

            <div class="cg-head-row cg-head-row-ops">
            <button type="button" class="cg-head-btn" id="cg-exit-edit"
                style="display:${st.editingId ? '' : 'none'};">編集完了</button>

            <button type="button" class="cg-head-btn" id="cg-clear-filter"
                style="display:${st.activeId ? '' : 'none'};">フィルター解除</button>
            </div>
        </div>

        <div class="cg-list" id="cg-sidebar-list">
            ${groups.map(g => rowHtml_(g, st)).join('')}
        </div>

        <button type="button" class="cg-add" id="cg-sidebar-add">＋ グループを追加</button>
        <div class="cg-limit" id="cg-sidebar-limit" style="display:none;"></div>
        `;

        // 編集終了
        qs('#cg-exit-edit', host)?.addEventListener('click', () => {
        window.CardGroups.stopEditing();
        scheduleHeavySync_();
        });

        // フィルター解除（＝全カード表示）
        qs('#cg-clear-filter', host)?.addEventListener('click', () => {
        window.CardGroups.setActive('');
        scheduleHeavySync_();
        });

        // 追加（固まり対策：createGroupAndEditで1回更新）
        qs('#cg-sidebar-add', host)?.addEventListener('click', () => {
        if (!window.CardGroups.canCreate()) {
            showLimit_('#cg-sidebar-limit');
            return;
        }
        window.CardGroups.createGroupAndEdit();
        // onChangeでまとめて更新される
        });

        bindRowEvents_(host);
        bindPointerReorder_(host);
    }

    function rowHtml_(g, st) {
    const isActive = st.activeId === g.id;
    const isEditing = st.editingId === g.id;
    const fixed = !!g.fixed;

    // ミニ表示：先頭5枚（幅が狭い時はCSSで3枚に減る）
    const allCds = Object.keys(g.cards || {});
    const cds = allCds.slice(0, 7).map(cd => String(cd).padStart(5, '0'));
    const more = Math.max(0, allCds.length - cds.length);

    const canDrag = !!st.editingId;

    return `
        <div class="cg-row ${isActive ? 'is-active' : ''} ${isEditing ? 'is-editing' : ''}" data-gid="${g.id}">
        <div class="cg-row-top">
            <div class="cg-name" title="${escapeHtml_(g.name)}">${escapeHtml_(g.name)}</div>
            <button type="button" class="cg-rename" ${fixed ? 'disabled' : ''} title="名前変更">✏️</button>
        </div>

        <div class="cg-row-bot">
            <button type="button" class="cg-show" title="このグループを表示（フィルター）">表示</button>
            <button type="button" class="cg-edit" title="このグループを編集">編集</button>
            <button type="button" class="cg-del" ${fixed ? 'disabled' : ''} title="削除">🗑</button>
        </div>

        <!-- ✅ 3段目：サムネ -->
        <div class="cg-mini" aria-label="グループ内カードの簡易表示">
            ${cds.map((cd, i) => `
            <span class="cg-mini-card" style="--i:${i}">
                <img src="img/${escapeHtml_(cd)}.webp" alt="" loading="lazy" decoding="async"
                    onerror="this.onerror=null;this.src='img/00000.webp';" />
            </span>
            `).join('')}
            ${more ? `<span class="cg-mini-more">+${more}</span>` : ``}
        </div>

        <!-- ✅ ハンドルは cg-row の右端に固定（overlay） -->
            <span class="cg-handle"
            title="${canDrag ? '並び替え' : '編集モード中のみ並び替えできます'}"
            aria-disabled="${canDrag ? 'false' : 'true'}">≣</span>
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
    // ✅ 再描画で何度も addEventListener しない
    if (root.dataset.cgRowBound) return;
    root.dataset.cgRowBound = '1';

    root.addEventListener('click', (e) => {
        const row = e.target.closest('.cg-row');
        if (!row) return;
        const gid = row.dataset.gid;
        if (!gid) return;

        // 表示（フィルター適用/解除）
        if (e.target.closest('.cg-show')) {
        const st = window.CardGroups.getState();
        if (st.editingId) return; // 編集中は表示切替しない
        window.CardGroups.toggleActive(gid);
        scheduleHeavySync_();
        return;
        }

        // 編集（フィルターは掛けない）
        if (e.target.closest('.cg-edit')) {
        window.CardGroups.startEditing(gid);
        scheduleHeavySync_();
        return;
        }

        // 名前変更
        if (e.target.closest('.cg-rename')) {
        const st = window.CardGroups.getState();
        const g = st.groups[gid];
        if (!g || g.fixed) return;

        const next = prompt('グループ名を入力', g.name);
        if (next == null) return;
        window.CardGroups.renameGroup(gid, next);
        return; // onChangeで反映
        }

        // 削除
        if (e.target.closest('.cg-del')) {
        const st = window.CardGroups.getState();
        const g = st.groups[gid];
        if (!g || g.fixed) return;

        const count = Object.keys(g.cards || {}).length;
        const ok = confirm(`「${g.name}」を削除しますか？\n（登録カード：${count}枚）`);
        if (!ok) return;
        window.CardGroups.deleteGroup(gid);
        return; // onChangeで反映
        }
    });
    }

    // 並び替え（簡易D&D）— 行間ライン版
    function bindPointerReorder_(root){
    if (root.dataset.cgPointerReorderBound) return;
    root.dataset.cgPointerReorderBound = '1';

    let dragging = null; // { fromId, fromIndex, rowEl }

    function isEditing_(){
        return !!window.CardGroups?.getState?.().editingId;
    }

    function clearMarks_(){
        root.querySelectorAll('.cg-row.drop-before, .cg-row.drop-after, .cg-row.is-dragging, .cg-row.is-dragover')
        .forEach(el => el.classList.remove('drop-before','drop-after','is-dragging','is-dragover'));
    }

    function pickRowFromPoint_(clientY){
        const rows = Array.from(root.querySelectorAll('.cg-row'));
        if (!rows.length) return null;
        let best = null;
        let bestDist = Infinity;
        for (const r of rows) {
        const rect = r.getBoundingClientRect();
        const cy = rect.top + rect.height / 2;
        const d = Math.abs(clientY - cy);
        if (d < bestDist) { bestDist = d; best = r; }
        }
        return best;
    }

    function getDropInfo_(clientY){
        const row = pickRowFromPoint_(clientY);
        if (!row) return null;
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const pos = (clientY < midY) ? 'before' : 'after';
        return { row, pos };
    }

    root.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest('.cg-handle');
        if (!handle) return;
        if (!isEditing_()) return;

        const row = handle.closest('.cg-row');
        if (!row) return;

        const fromId = row.dataset.gid;
        if (!fromId) return;

        // クリックやスクロール暴発を抑える
        e.preventDefault();

        const st = window.CardGroups.getState();
        const fromIndex = st.order.indexOf(fromId);
        if (fromIndex < 0) return;

        dragging = { fromId, fromIndex, rowEl: row };

        row.classList.add('is-dragging');
        handle.setPointerCapture?.(e.pointerId);
    });

    root.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        if (!isEditing_()) { dragging = null; clearMarks_(); return; }

        const info = getDropInfo_(e.clientY);
        if (!info) return;

        clearMarks_();
        info.row.classList.add('is-dragover');
        info.row.classList.add(info.pos === 'before' ? 'drop-before' : 'drop-after');
    });

    root.addEventListener('pointerup', (e) => {
        if (!dragging) return;

        const info = getDropInfo_(e.clientY);
        if (!info) { dragging = null; clearMarks_(); return; }

        const st = window.CardGroups.getState();
        const fromId = dragging.fromId;
        const toId = info.row.dataset.gid;

        if (!fromId || !toId || fromId === toId) {
        dragging = null;
        clearMarks_();
        return;
        }

        const fromIndex = st.order.indexOf(fromId);
        const baseIndex = st.order.indexOf(toId);
        if (fromIndex < 0 || baseIndex < 0) {
        dragging = null;
        clearMarks_();
        return;
        }

        let toIndex = baseIndex + (info.pos === 'after' ? 1 : 0);
        if (toIndex > fromIndex) toIndex -= 1;
        toIndex = Math.max(0, Math.min(st.order.length - 1, toIndex));

        dragging = null;
        clearMarks_();
        window.CardGroups.moveGroup(fromId, toIndex);
    });

    root.addEventListener('pointercancel', () => {
        dragging = null;
        clearMarks_();
    });
    }

    // 編集モード：視覚反映（zoom-btnは cardGrid.js が持ってるので “見せるだけ”）
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

        // zoom-btn は CSS で表示される（常設）
        // ここでは追加もしない（重くなるので）
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

        // 🔎は通常処理（cardGrid.jsのzoom-btn）
        if (e.target.closest('.zoom-btn')) return;

        const cardEl = e.target.closest('.card');
        if (!cardEl || !grid.contains(cardEl)) return;

        // 既存の “カードタップ＝ズーム” を止めて、グループ追加/削除にする
        e.preventDefault();
        e.stopPropagation();

        const cd = String(cardEl.dataset.cd || '').padStart(5, '0');
        window.CardGroups.toggleCardInGroup(editingId, cd);

        // 最小限の見た目だけ即反映（全体再描画しない）
        cardEl.classList.toggle('group-picked', window.CardGroups.hasCard(editingId, cd));
        }, { capture: true });
    }

    function init() {
        if (!ensureReady_()) return;

        // 変更 → 重い処理は rAFで1回にまとめる
        window.CardGroups.onChange(() => scheduleHeavySync_());

        // 初回
        renderSidebar_();
        applyEditVisual_();
        bindCardTapOverride_();
    }

    window.addEventListener('DOMContentLoaded', init);
    window.addEventListener('card-page:ready', init);
    })();
