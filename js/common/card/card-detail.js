/* =========================
 * js/common/card/card-detail.js
 * - カード詳細の展開
 * - 詳細内の所持数UI
 * - 詳細内の拡大ボタン付与
 * ========================= */
(function () {
  'use strict';

  function buildDetailElementFallback_(cd, cardEl) {
    const cd5 = String(cd).padStart(5, '0');
    const m = window.cardMap?.[cd5];
    const d = cardEl?.dataset || {};

    const card = {
      cd: cd5,
      name: (m?.name ?? d.name ?? ''),
      type: (m?.type ?? d.type ?? ''),
      race: (m?.race ?? d.race ?? ''),
      category: (m?.category ?? d.category ?? ''),
      packName: (m?.packName ?? d.pack ?? ''),
      pack_name: (m?.pack_name ?? d.pack ?? ''),
      effect_name1: (m?.effect_name1 ?? d.effect1 ?? ''),
      effect_text1: (m?.effect_text1 ?? d.effecttext1 ?? ''),
      effect_name2: (m?.effect_name2 ?? d.effect2 ?? ''),
      effect_text2: (m?.effect_text2 ?? d.effecttext2 ?? ''),
    };

    const html = window.CardDetailTemplate?.generate
      ? window.CardDetailTemplate.generate(card)
      : (window.generateDetailHtml ? window.generateDetailHtml(card) : '');

    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();

    const el = wrap.firstElementChild || document.createElement('div');
    el.id = el.id || `detail-${cd5}`;
    el.setAttribute('data-cd', el.getAttribute('data-cd') || cd5);
    return el;
  }

  function expandCard(clickedCard) {
    const cd = clickedCard?.getAttribute?.('data-cd');
    if (!cd) return;

    const grid = document.getElementById('grid');
    if (!grid) return;
    if (grid.classList.contains('is-list')) return;

    const existing = document.querySelector('.card-detail.active');
    if (existing && existing.getAttribute('data-cd') === cd) {
      existing.remove();
      return;
    }
    if (existing) existing.remove();

    let detail = document.getElementById(`detail-${cd}`);
    if (!detail) detail = buildDetailElementFallback_(cd, clickedCard);
    if (!detail) return;

    const cloned = detail.cloneNode(true);
    cloned.style.display = 'block';
    cloned.classList.add('active');
    cloned.classList.add('card-detail');
    cloned.setAttribute('data-cd', cd);

    attachOwnedEditor_(cloned, cd);

    const cards = Array.from(grid.querySelectorAll('.card')).filter((card) => {
      if (!card.offsetParent) return false;
      const cs = window.getComputedStyle ? getComputedStyle(card) : null;
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
      return true;
    });

    const clickedIndex = cards.indexOf(clickedCard);
    if (clickedIndex < 0) return;

    let columns = 7;
    if (grid.clientWidth < 768) columns = 4;
    else if (grid.clientWidth < 1024) columns = 5;

    const rowStart = Math.floor(clickedIndex / columns) * columns;
    const rowEnd = Math.min(rowStart + columns - 1, cards.length - 1);
    const insertAfter = cards[rowEnd];
    if (!insertAfter) return;

    insertAfter.insertAdjacentElement('afterend', cloned);
  }

  function handleZoomClick(event, el) {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    const cardEl = el?.closest ? el.closest('.card') : null;
    if (!cardEl) return;
    expandCard(cardEl);
  }

  function attachOwnedEditor_(detailEl, cd) {
    if (detailEl.querySelector('.owned-editor')) return;

    const nameEl = detailEl.querySelector('.card-name');
    const hostFallback =
      detailEl.querySelector('.detail-header')
      || detailEl.querySelector('.card-detail-header')
      || detailEl;

    let titleRow = detailEl.querySelector('.card-title-row');
    if (!titleRow) {
      titleRow = document.createElement('div');
      titleRow.className = 'card-title-row';

      if (nameEl && nameEl.parentNode) {
        const parent = nameEl.parentNode;
        parent.insertBefore(titleRow, nameEl);
        titleRow.appendChild(nameEl);
      } else {
        hostFallback.insertBefore(titleRow, hostFallback.firstChild);
      }
    }

    const wrap = document.createElement('div');
    wrap.className = 'owned-editor is-locked';

    const label = document.createElement('span');
    label.className = 'owned-editor-label';
    label.textContent = '所持数';

    const num = document.createElement('span');
    num.className = 'owned-editor-num';
    num.setAttribute('aria-label', '所持数');

    const btnMinus = document.createElement('button');
    btnMinus.type = 'button';
    btnMinus.className = 'owned-editor-btn owned-editor-minus';
    btnMinus.textContent = '-';
    btnMinus.disabled = true;

    const btnPlus = document.createElement('button');
    btnPlus.type = 'button';
    btnPlus.className = 'owned-editor-btn owned-editor-plus';
    btnPlus.textContent = '+';
    btnPlus.disabled = true;

    const btnToggle = document.createElement('button');
    btnToggle.type = 'button';
    btnToggle.className = 'owned-editor-toggle';
    btnToggle.textContent = '編集';
    btnToggle.setAttribute('aria-pressed', 'false');

    wrap.append(label, btnMinus, num, btnPlus, btnToggle);
    titleRow.appendChild(wrap);

    attachZoomBtnToDetail_(detailEl, cd);

    const readTotal = () => {
      try {
        const e = window.OwnedStore?.get?.(String(cd)) || { normal: 0, shine: 0, premium: 0 };
        return (e.normal | 0) + (e.shine | 0) + (e.premium | 0);
      } catch {
        return 0;
      }
    };

    const writeTotal = (n) => {
      const max = (typeof window.maxAllowedCount === 'function')
        ? window.maxAllowedCount(String(cd), detailEl.dataset?.race || '')
        : 3;

      const next = Math.max(0, Math.min(max, n | 0));
      try {
        window.OwnedStore?.set?.(String(cd), { normal: next, shine: 0, premium: 0 });
      } catch {}
      try {
        window.OwnedUI?.sync?.('#grid');
      } catch {}
      num.textContent = String(next);
      updateBtnState();
    };

    const updateBtnState = () => {
      const cur = readTotal();
      const max = (typeof window.maxAllowedCount === 'function')
        ? window.maxAllowedCount(String(cd), detailEl.dataset?.race || '')
        : 3;

      const atMin = cur <= 0;
      btnMinus.disabled = atMin;
      btnMinus.classList.toggle('is-disabled', atMin);

      const atMax = cur >= max;
      btnPlus.disabled = atMax;
      btnPlus.classList.toggle('is-disabled', atMax);
    };

    num.textContent = String(readTotal());
    updateBtnState();

    const setLocked = (locked) => {
      wrap.classList.toggle('is-locked', locked);
      btnMinus.disabled = locked;
      btnPlus.disabled = locked;
      btnToggle.setAttribute('aria-pressed', locked ? 'false' : 'true');
      btnToggle.textContent = locked ? '編集' : '編集中';
      if (!locked) updateBtnState();
    };

    btnToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setLocked(!wrap.classList.contains('is-locked'));
    });

    btnMinus.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      writeTotal(readTotal() - 1);
    });

    btnPlus.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      writeTotal(readTotal() + 1);
    });

    try {
      window.OwnedStore?.onChange?.(() => {
        num.textContent = String(readTotal());
        updateBtnState();
      });
    } catch {}
  }

  function attachZoomBtnToDetail_(detailEl, cd) {
    if (!detailEl) return;
    const cd5 = String(cd || detailEl.getAttribute('data-cd') || '').padStart(5, '0');
    if (!cd5 || cd5 === '00000') return;
    if (detailEl.querySelector('.detail-zoom-btn')) return;

    const titleRow = detailEl.querySelector('.card-title-row');
    const nameEl = detailEl.querySelector('.card-name');
    if (!titleRow || !nameEl) return;

    const left = titleRow.querySelector('.card-title-left');
    if (left) {
      const n = left.querySelector('.card-name');
      if (n) titleRow.insertBefore(n, left);
      left.remove();
    }

    if (nameEl.parentElement !== titleRow) {
      titleRow.insertBefore(nameEl, titleRow.firstChild);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'detail-zoom-btn';
    btn.setAttribute('aria-label', '画像を拡大');
    btn.title = '画像を拡大';
    btn.innerHTML = `
      <img
        class="zoom-ic"
        src="./img/zoom_in_24.svg"
        alt=""
        aria-hidden="true"
        decoding="async"
      >
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.CardZoomModal?.open?.(cd5);
    });

    titleRow.insertBefore(btn, nameEl);
  }

  function observeCardDetailsForZoomBtn_() {
    document.querySelectorAll('.card-detail').forEach((el) => {
      attachZoomBtnToDetail_(el, el.getAttribute('data-cd'));
    });

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          if (node.classList?.contains('card-detail')) {
            attachZoomBtnToDetail_(node, node.getAttribute('data-cd'));
          }

          const details = node.querySelectorAll?.('.card-detail');
          if (details && details.length) {
            details.forEach((el) => attachZoomBtnToDetail_(el, el.getAttribute('data-cd')));
          }
        }
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
  }

  function ensureCardZoomModal_() {
    return window.CardZoomModal?.ensure?.();
  }

  function openCardZoom_(cd) {
    return window.CardZoomModal?.open?.(cd);
  }

  function closeCardZoom_() {
    return window.CardZoomModal?.close?.();
  }

  function bindLongPressForCards(rootSelector = '#grid') {
    return window.CardZoomModal?.bindLongPressForCards?.(rootSelector);
  }

  window.CardDetailUI = {
    expandCard,
    handleZoomClick,
    openCardZoom: openCardZoom_,
    closeCardZoom: closeCardZoom_,
    attachOwnedEditor: attachOwnedEditor_,
    attachZoomBtn: attachZoomBtnToDetail_,
    bindLongPressForCards,
  };

  window.handleZoomClick = handleZoomClick;

  if (!window.__detailZoomBtnObserverBound) {
    window.__detailZoomBtnObserverBound = true;
    observeCardDetailsForZoomBtn_();
  }
})();
