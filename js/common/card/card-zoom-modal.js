/* =========================
 * js/common/card/card-zoom-modal.js
 * - カード画像拡大モーダルの共通処理
 * - 一覧/詳細/デッキ投稿から再利用する
 * ========================= */
(function () {
  'use strict';

  function ensureModal_() {
    let modal = document.getElementById('cardZoomModal');
    if (modal) {
      if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
      }
    } else {
      modal = document.createElement('div');
      modal.id = 'cardZoomModal';
      modal.className = 'modal';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }

    modal.className = 'modal';
    modal.style.display = modal.style.display || 'none';
    modal.innerHTML = `
      <div class="modal-content card-zoom" style="position:relative">
        <button id="cardZoomClose" aria-label="閉じる" class="modal-close-x" type="button">×</button>
        <img id="zoomImage" alt=""
          style="max-width:90vw;max-height:85vh;object-fit:contain;display:block;margin:auto;" />
      </div>
    `;

    if (!window.__cardZoomBound) {
      window.__cardZoomBound = true;

      document.addEventListener('click', (e) => {
        const current = document.getElementById('cardZoomModal');
        if (!current || current.style.display !== 'flex') return;
        if (e.target === current) closeCardZoom_();
      });

      document.addEventListener('keydown', (e) => {
        const current = document.getElementById('cardZoomModal');
        if (!current || current.style.display !== 'flex') return;
        if (e.key === 'Escape') closeCardZoom_();
      });

      document.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('#cardZoomClose');
        if (!btn) return;
        const current = document.getElementById('cardZoomModal');
        if (!current || current.style.display !== 'flex') return;
        e.preventDefault();
        e.stopPropagation();
        closeCardZoom_();
      }, true);
    }

    return modal;
  }

  function openCardZoom_(cd) {
    const cd5 = String(cd || '').trim().padStart(5, '0');
    if (!cd5) return;

    const modal = ensureModal_();
    const img = document.getElementById('zoomImage');
    if (!modal || !img) return;

    delete img.dataset.fallbackApplied;
    img.src = `img/${cd5}.webp`;
    img.onerror = function () {
      if (this.dataset.fallbackApplied) return;
      this.dataset.fallbackApplied = '1';
      this.src = 'img/00000.webp';
    };

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeCardZoom_() {
    const modal = document.getElementById('cardZoomModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function bindLongPressForCards_(rootSelector = '#grid', options = {}) {
    const root = typeof rootSelector === 'string'
      ? document.querySelector(rootSelector)
      : rootSelector;
    if (!root || root.dataset.cardZoomLongpressBound === '1') return;

    const itemSelector = options.itemSelector || '.card';
    const cdResolver = typeof options.cdResolver === 'function'
      ? options.cdResolver
      : (el) => el?.dataset?.cd;
    const longMs = Number(options.longMs || 380);
    const moveTol = Number(options.moveTol || 8);

    let timer = null;
    let startX = 0;
    let startY = 0;

    root.dataset.cardZoomLongpressBound = '1';

    root.addEventListener('touchstart', (ev) => {
      const target = ev.target.closest(itemSelector);
      if (!target) return;

      const touch = ev.touches[0];
      if (!touch) return;

      startX = touch.clientX;
      startY = touch.clientY;

      const cd = String(cdResolver(target) || '').trim();
      clearTimeout(timer);
      if (!cd) return;

      timer = setTimeout(() => {
        openCardZoom_(cd);
      }, longMs);
    }, { passive: true });

    root.addEventListener('touchmove', (ev) => {
      const touch = ev.touches[0];
      if (!touch) return;
      if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > moveTol) {
        clearTimeout(timer);
      }
    }, { passive: true });

    root.addEventListener('touchend', () => clearTimeout(timer), { passive: true });
    root.addEventListener('touchcancel', () => clearTimeout(timer), { passive: true });
  }

  window.CardZoomModal = window.CardZoomModal || {};
  window.CardZoomModal.ensure = ensureModal_;
  window.CardZoomModal.open = openCardZoom_;
  window.CardZoomModal.close = closeCardZoom_;
  window.CardZoomModal.bindLongPressForCards = bindLongPressForCards_;
  window.__bindLongPressForCards = window.__bindLongPressForCards || function (target) {
    const selector = (typeof target === 'string' && target.trim() && target.trim().startsWith('#'))
      ? target.trim()
      : '#grid';
    return bindLongPressForCards_(selector);
  };
})();
