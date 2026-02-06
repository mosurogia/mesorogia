/**
 * js/pages/card/owned-save-flow.js
 * - 所持データの未保存検知 / 退避 / 保存確認（ページ遷移ガード）
 * - window.__ownedDirty / window.revertOwnedToSaved / window.saveOwnedIfDirty を提供
 */
(function () {
  'use strict';

  // 起動時：OwnedStore自動保存OFF（このページは手動保存モード）
  if (window.OwnedStore?.setAutosave) {
    window.OwnedStore.setAutosave(false);
  }

  // ===== 所持データ保存フロー（未保存検知 & 退避） =====
  (function setupOwnershipSaveFlow() {
    // 未保存フラグ（このページ限定）
    window.__ownedDirty = false;

    // ---- OwnedStoreのスナップショット管理 ----
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

    // 変更監視：OwnedStore.set が呼ばれたら dirty にする（OwnedStore実装に依存しないよう軽く）
    const _origSet = window.OwnedStore?.set?.bind(window.OwnedStore);
    if (_origSet) {
      window.OwnedStore.set = function (cd, obj) {
        window.__ownedDirty = true;
        return _origSet(cd, obj);
      };
    }

    // Aへ巻き戻し
    window.revertOwnedToSaved = function revertOwnedToSaved() {
      if (!window.__ownedSnapshotInited) takeOwnedSnapshotFromPersist();
      applyOwnedMapToStore(window.__ownedSnapshot || {});
      window.__ownedDirty = false;
    };

    // 保存（A更新）
    window.commitOwnedSnapshot = function commitOwnedSnapshot() {
      takeOwnedSnapshotFromPersist();
      window.__ownedDirty = false;
    };

    // 未保存なら保存確認（OKなら保存 / NGなら巻き戻し）
    window.saveOwnedIfDirty = function saveOwnedIfDirty(reason = '') {
      if (!window.__ownedDirty) return true;
      const ok = confirm(`未保存の所持データがあります。保存しますか？\n(${reason})`);
      if (ok) {
        try { window.OwnedStore?.save?.(); } catch {}
        try { window.commitOwnedSnapshot?.(); } catch {}
        return true;
      }
      // 保存しない → 巻き戻し
      try { window.revertOwnedToSaved?.(); } catch {}
      return false;
    };

    // ページ離脱
    window.addEventListener('beforeunload', (e) => {
      if (!window.__ownedDirty) return;
      e.preventDefault();
      e.returnValue = '';
    });

    // ページ内リンク遷移（同一originのみ）でガード
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || a.target === '_blank') return;
      try { const u = new URL(href, location.href); if (u.origin !== location.origin) return; } catch {}
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
