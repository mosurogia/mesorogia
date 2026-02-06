/**
 * js/pages/card/owned-save-flow.js
 * - 所持データの未保存検知 / 退避 / 保存確認（ページ遷移ガード）
 *
 * このページは「手動保存モード」:
 * - OwnedStore.autosave をOFF
 * - OwnedStore.set が呼ばれたら dirty にする
 * - 保存したら snapshot(A) を更新して dirty を戻す
 *
 * 公開API（window）:
 * - __ownedDirty : 未保存フラグ
 * - revertOwnedToSaved() : snapshot(A) へ巻き戻し
 * - commitOwnedSnapshot(): snapshot(A) を更新（保存後に呼ぶ）
 * - saveOwnedIfDirty(reason): 未保存ならconfirm→保存 or 巻き戻し
 */
(function () {
  'use strict';

  // =====================================================
  // 0) 前提：このページは手動保存（autosave OFF）
  // =====================================================

  if (window.OwnedStore?.setAutosave) {
    window.OwnedStore.setAutosave(false);
  }

  // =====================================================
  // 1) スナップショット（A）管理
  // =====================================================

  (function setupOwnershipSaveFlow() {
    window.__ownedDirty = false;

    function normalizeOwnedMap(src = {}) {
      const out = {};
      for (const cd in src) {
        const v = src[cd];
        out[cd] = (v && typeof v === 'object')
          ? { normal: v.normal|0, shine: v.shine|0, premium: v.premium|0 }
          : { normal: v|0,      shine: 0,           premium: 0 };
      }
      return out;
    }

    function readPersistedOwned() {
      try { return JSON.parse(localStorage.getItem('ownedCards') || '{}') || {}; }
      catch { return {}; }
    }

    function takeOwnedSnapshotFromPersist() {
      window.__ownedSnapshot = normalizeOwnedMap(readPersistedOwned());
      window.__ownedSnapshotInited = true;
    }

    function applyOwnedMapToStore(map) {
      if (!window.OwnedStore?.set) return;
      const current = (window.OwnedStore.getAll && window.OwnedStore.getAll()) || {};
      const keys = new Set([...Object.keys(current), ...Object.keys(map)]);
      keys.forEach(cd => {
        const v = map[cd] || { normal: 0, shine: 0, premium: 0 };
        window.OwnedStore.set(cd, v);
      });
    }

    // 初期スナップショット（A）
    takeOwnedSnapshotFromPersist();

    // =====================================================
    // 2) dirty化：OwnedStore.set をフック（軽量）
    // =====================================================

    const _origSet = window.OwnedStore?.set?.bind(window.OwnedStore);
    if (_origSet) {
      window.OwnedStore.set = function (cd, obj) {
        window.__ownedDirty = true;
        return _origSet(cd, obj);
      };
    }

    // =====================================================
    // 3) 公開API：巻き戻し / snapshot更新 / 保存確認
    // =====================================================

    window.revertOwnedToSaved = function revertOwnedToSaved() {
      if (!window.__ownedSnapshotInited) takeOwnedSnapshotFromPersist();
      applyOwnedMapToStore(window.__ownedSnapshot || {});
      window.__ownedDirty = false;
    };

    window.commitOwnedSnapshot = function commitOwnedSnapshot() {
      takeOwnedSnapshotFromPersist();
      window.__ownedDirty = false;
    };

    window.saveOwnedIfDirty = function saveOwnedIfDirty(reason = '') {
      if (!window.__ownedDirty) return true;
      const ok = confirm(`未保存の所持データがあります。保存しますか？\n(${reason})`);
      if (ok) {
        try { window.OwnedStore?.save?.(); } catch {}
        try { window.commitOwnedSnapshot?.(); } catch {}
        return true;
      }
      try { window.revertOwnedToSaved?.(); } catch {}
      return false;
    };

    // =====================================================
    // 4) 遷移ガード：beforeunload / 同一originリンク / タブ切替
    // =====================================================

    window.addEventListener('beforeunload', (e) => {
      if (!window.__ownedDirty) return;
      e.preventDefault();
      e.returnValue = '';
    });

    document.addEventListener('click', (ev) => {
      const a = ev.target.closest('a[href]');
      if (!a) return;

      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || a.target === '_blank') return;

      try { const u = new URL(href, location.href); if (u.origin !== location.origin) return; } catch {}

      // このページ（checker/owned）以外では走らせない
      if (!document.getElementById('checker') && !document.getElementById('owned')) return;

      const ok = window.saveOwnedIfDirty('link');
      if (!ok) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    });

    // タブ切替フック（存在すれば）
    window.__onTabSwitch = window.__onTabSwitch || function () {};
    const prev = window.__onTabSwitch;
    window.__onTabSwitch = function (fromId, toId) {
      try { prev(fromId, toId); } catch {}
      const leavingOwnedPages =
        (fromId === 'checker' && toId !== 'checker') ||
        (fromId === 'owned'   && toId !== 'owned');
      if (leavingOwnedPages) {
        window.saveOwnedIfDirty(`tab:${fromId}->${toId}`);
      }
    };
  })();
})();
