// js/pages/deckmaker/deck.js
/**
 * DeckMaker / Deck Core (page-only)
 *
 * 【役割】
 * - deck（{cd:count}）の管理（追加/削除/更新）
 * - デッキバー（上部横スクロール）の描画
 * - 一覧（.card）側の「使用中」「グレースケール」反映
 * - PC：ホバーでカード画像プレビュー
 * - Mobile：上フリック追加 / 下フリック削除 / 長押しでプレビュー
 * - オートセーブ（localStorage: deck_autosave_v1）
 * - デッキサマリー開閉ボタン（#deck-summary）
 *
 * 【依存（存在すれば使う）】
 * - window.cardMap
 * - window.applyGrayscaleFilter
 * - window.updateDeckSummary / updateDeckAnalysis / updateExchangeSummary / updateDeckCardListBackground / updateAutoTags
 * - window.renderPostSelectTags
 * - window.readDeckNameInput / writeDeckNameInput
 * - window.readPostNote / writePostNote
 * - window.formatYmd
 * - autoscaleBadgeForCardEl / autoscaleAllBadges（表示補助）
 *
 * 【公開API】
 * - window.deck
 * - window.addCard / removeCard / updateDeck / updateCardDisabling
 * - window.MAIN_RACES / getMainRacesInDeck / computeMainRace / getMainRace / getRaceType
 * - window.withDeckBarScrollKept / scheduleAutosave / maybeRestoreFromStorage
 * - window.toggleDeckSummary
 */
(function () {
  'use strict';

  // =========================
  // 定数
  // =========================
  const IMG_DIR = 'img/';
  const FALLBACK_IMG = IMG_DIR + '00000.webp';

  const TYPE_ORDER = { 'チャージャー': 0, 'アタッカー': 1, 'ブロッカー': 2 };

  // メイン種族（統一版）
  const MAIN_RACES = ['ドラゴン', 'アンドロイド', 'エレメンタル', 'ルミナス', 'シェイド'];

  // =========================
  // 状態
  // =========================
  const deck = window.deck || (window.deck = {});
  let representativeCd = null; // 今は保存に載せるだけ（表示/変更は別ファイル想定）

  // =========================
  // ユーティリティ
  // =========================
  function normCd5(cd) {
    return String(cd ?? '').padStart(5, '0').slice(0, 5);
  }

  function imgSrcOf(cd) {
    return IMG_DIR + normCd5(cd) + '.webp';
  }

  function getCard(cd) {
    return window.cardMap?.[normCd5(cd)] || window.cardMap?.[String(cd)] || null;
  }

  function getDeckEntriesSorted() {
    return Object.entries(deck).sort((a, b) => {
      const cdA = a[0], cdB = b[0];
      const A = getCard(cdA), B = getCard(cdB);
      if (!A || !B) return String(cdA).localeCompare(String(cdB));

      const tA = TYPE_ORDER[A.type] ?? 99;
      const tB = TYPE_ORDER[B.type] ?? 99;
      if (tA !== tB) return tA - tB;

      const cA = (parseInt(A.cost, 10) || 0);
      const cB = (parseInt(B.cost, 10) || 0);
      if (cA !== cB) return cA - cB;

      const pA = (parseInt(A.power, 10) || 0);
      const pB = (parseInt(B.power, 10) || 0);
      if (pA !== pB) return pA - pB;

      return String(cdA).localeCompare(String(cdB));
    });
  }

  // デッキ更新時にスクロール位置を保つ補助
  function withDeckBarScrollKept(fn) {
    const wrapper = document.querySelector('.deck-bar-scroll');
    const x = wrapper ? wrapper.scrollLeft : 0;
    try {
      fn();
    } finally {
      if (wrapper) wrapper.scrollLeft = x;
    }
  }

  document.getElementById('shortage-toggle-btn')
    ?.addEventListener('click', () => window.CardPreview?.hide?.());

  document.addEventListener('deckTabSwitched', () => window.CardPreview?.hide?.());

  // =========================
  // 種族ユーティリティ（公開）
  // =========================
  function getMainRacesInDeck() {
    const races = Object.keys(deck)
      .map(cd => getCard(cd)?.race)
      .filter(r => MAIN_RACES.includes(r));
    return [...new Set(races)];
  }

  function computeMainRace() {
    const arr = getMainRacesInDeck();
    if (arr.length <= 1) return arr[0] || null;
    for (const r of MAIN_RACES) if (arr.includes(r)) return r;
    return arr[0] || null;
  }

  function getMainRace() {
    return getMainRacesInDeck()[0] || null;
  }

  function getRaceType(race) {
    if (!race) return '';
    if (race === '旧神') return 'old';
    if (race === 'イノセント') return 'sub';
    if (MAIN_RACES.includes(race)) return 'main';
    return 'sub';
  }

  // =========================
  // 追加/削除（制約チェック含む）
  // =========================
  function canAddCard_(cd) {
    const card = getCard(cd);
    if (!card) return false;

    // 最大枚数判定（旧神は1枚、それ以外は最大3枚。ただしリンクカードは共有）
    const groupKey = card.link ? String(card.linkCd) : String(normCd5(cd));
    let totalGroupCount = 0;

    for (const [id, count] of Object.entries(deck)) {
      const other = getCard(id);
      if (!other) continue;
      const otherGroup = other.link ? String(other.linkCd) : String(normCd5(id));
      if (otherGroup === groupKey) totalGroupCount += count;
    }
    if (totalGroupCount >= 3) return false;

    // 旧神は1種1枚まで
    if (card.race === '旧神') {
      if ((deck[normCd5(cd)] || 0) >= 1) return false;
      const hasOtherOldGod = Object.keys(deck).some(id => getCard(id)?.race === '旧神' && normCd5(id) !== normCd5(cd));
      if (hasOtherOldGod) return false;
    }

    // メイン種族は1種類のみ（イノセント/旧神は含めない）
    if (getRaceType(card.race) === 'main') {
      const currentMainRaces = getMainRacesInDeck();
      const unique = new Set([...currentMainRaces, card.race]);
      if (unique.size > 1) return false;
    }

    return true;
  }

  function addCard(cd) {
    const cd5 = normCd5(cd);
    if (!canAddCard_(cd5)) return;

    deck[cd5] = (deck[cd5] || 0) + 1;

    withDeckBarScrollKept(updateDeck);
    window.applyGrayscaleFilter?.();
    scheduleAutosave();
  }

  function removeCard(cd, { soft = false } = {}) {
    const cd5 = normCd5(cd);
    const cur = Number(deck[cd5] || 0);
    const next = Math.max(0, cur - 1);

    if (!soft && next === 0) delete deck[cd5];
    else deck[cd5] = next;

    withDeckBarScrollKept(updateDeck);
    window.applyGrayscaleFilter?.();
    scheduleAutosave();
  }

  // =========================
  // デッキバー描画（上部横スクロール）
  // =========================
  function buildDeckCardsForAnalysis_() {
    const deckCards = [];
    for (const [cd, count] of Object.entries(deck)) {
      const card = getCard(cd);
      if (!card) continue;
      for (let i = 0; i < count; i++) deckCards.push({ 種族: card.race, タイプ: card.type });
    }
    return deckCards;
  }

  function syncAfterDeckUpdate_(deckCards) {

    updateCardDisabling();
    window.updateDeckSummary?.(deckCards);
    window.updateDeckAnalysis?.();
    window.updateExchangeSummary?.();
    window.updateDeckCardListBackground?.();
    window.updateAutoTags?.();

    if (document.getElementById('select-tags')) window.renderPostSelectTags?.();
  }

  function renderDeckSummaryInline_(total, races, hasOldGod, typeCount) {
    const summary = document.getElementById('deck-summary');
    if (!summary) return;

    const info = summary.querySelector('.deck-info') || (() => {
      const el = document.createElement('div');
      el.className = 'deck-info';
      summary.insertBefore(el, summary.firstChild);
      return el;
    })();

    info.innerHTML = `
      デッキ枚数：${total}/30~40<br>
      使用種族：${races.size > 0 ? Array.from(races).join('/') : 'なし'}<br>
      旧神：${hasOldGod ? '採用中' : '未採用'}<br>
      🔵 ${(typeCount['チャージャー']|0)} 🟣 ${(typeCount['アタッカー']|0)} ⚪️ ${(typeCount['ブロッカー']|0)}
    `;
  }

  function renderDeckEmptyState_(deckBarTop) {
    deckBarTop.innerHTML = `
      <div id="deck-empty-text">
        <div style="font-size: .7rem;">カード操作</div>
        <div class="deck-help" id="deckHelp">
          <div>【PC】<br>・左クリック：追加<br>・右クリック：削除</div>
          <div>【スマホ】<br>・タップ,上フリック：追加<br>・下フリック：削除<br>・長押し：拡大表示</div>
        </div>
      </div>
    `;

    // 既存の他UIも空で同期
    window.updateCardDisabling?.();
    window.updateDeckSummary?.([]);
    window.updateExchangeSummary?.();

    if (typeof window.autoscaleAllBadges === 'function') {
      requestAnimationFrame(window.autoscaleAllBadges);
    } else if (typeof autoscaleAllBadges === 'function') {
      requestAnimationFrame(autoscaleAllBadges);
    }
  }

  function attachHoverPreview_(el, cd) {
    const canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (!canHover) return;

    let lastX = 0, lastY = 0;
    const onMove = (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
      showCardPreviewAt(lastX, lastY, cd);
    };

    el.addEventListener('mouseenter', (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
      showCardPreviewAt(lastX, lastY, cd);
      el.addEventListener('mousemove', onMove);
    });

    el.addEventListener('mouseleave', () => {
      el.removeEventListener('mousemove', onMove);
      hideCardPreview();
    });
  }

  function attachTouchControls_(el, cd) {
    let startX = 0, startY = 0;

    let lpTimer = 0;
    let lpFired = false;
    const LP_MS = 450;
    const LP_MOVE = 10;

    const THRESHOLD = 20;
    const MAX_SHIFT = 40;

    const cancelLongPress = () => { if (lpTimer) clearTimeout(lpTimer); lpTimer = 0; };
    const cleanUp = () => { el.style.transform = 'translateY(0)'; el.style.zIndex = ''; };

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;

      el.style.transition = '';
      el.style.zIndex = '2000';

      lpFired = false;
      cancelLongPress();
      lpTimer = setTimeout(() => {
        lpFired = true;
        showCardPreviewAt(startX, startY, cd);
      }, LP_MS);
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!lpFired && (Math.abs(dx) > LP_MOVE || Math.abs(dy) > LP_MOVE)) cancelLongPress();
      if (lpFired) return;

      // 横操作優先は無視
      if (Math.abs(dx) > Math.abs(dy)) return;

      const limited = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, dy));
      el.style.transform = `translateY(${limited}px)`;
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      cancelLongPress();

      if (lpFired) {
        lpFired = false;
        hideCardPreview();
        cleanUp();
        return;
      }

      const endY = e.changedTouches[0].clientY;
      const diffY = startY - endY; // 上=正, 下=負

      el.style.transition = 'transform .2s ease';

      if (Math.abs(diffY) <= THRESHOLD) {
        setTimeout(() => { el.style.transition = ''; cleanUp(); }, 200);
        return;
      }

      const to = diffY > 0 ? -MAX_SHIFT : MAX_SHIFT;
      el.style.transform = `translateY(${to}px)`;

      setTimeout(() => {
        el.style.transition = '';
        cleanUp();
        if (diffY > 0) addCard(cd);
        else removeCard(cd);
      }, 200);
    }, { passive: true });

    el.addEventListener('touchcancel', () => {
      cancelLongPress();
      lpFired = false;
      hideCardPreview();
      cleanUp();
    }, { passive: true });
  }

  function updateDeck() {
    const deckBarTop = document.getElementById('deckBarTop');
    if (!deckBarTop) return;

    deckBarTop.innerHTML = '';

    // --- サマリー集計 ---
    let total = 0;
    const typeCount = { 'チャージャー': 0, 'アタッカー': 0, 'ブロッカー': 0 };
    const races = new Set();
    let hasOldGod = false;

    for (const [cd, count] of Object.entries(deck)) {
      const card = getCard(cd);
      if (!card) continue;

      total += count;
      typeCount[card.type] = (typeCount[card.type] || 0) + count;

      if (card.race !== 'イノセント' && card.race !== '旧神') races.add(card.race);
      if (card.race === '旧神') hasOldGod = true;
    }

    renderDeckSummaryInline_(total, races, hasOldGod, typeCount);

    // --- 空デッキ ---
    if (Object.keys(deck).length === 0) {
      renderDeckEmptyState_(deckBarTop);
      return;
    }

    // --- 並び替え済みエントリ ---
    const entries = getDeckEntriesSorted();

    // --- デッキバーへ要素追加 ---
    for (const [cd, count] of entries) {
      const card = getCard(cd);
      if (!card) continue;

      const cardEl = document.createElement('div');
      cardEl.className = 'deck-card';
      cardEl.dataset.cd = normCd5(cd);
      cardEl.dataset.race = card.race || '';

      const img = document.createElement('img');
      img.src = imgSrcOf(cd);
      img.alt = card.name || '';
      img.onerror = () => {
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = '1';
        img.src = FALLBACK_IMG;
      };
      cardEl.appendChild(img);

      const badge = document.createElement('div');
      badge.className = 'count-badge';
      badge.textContent = String(count);
      cardEl.appendChild(badge);

      // PC: 左追加 / 右削除
      cardEl.addEventListener('mousedown', (e) => {
        if (e.button === 2) { e.preventDefault(); removeCard(cd); }
        else if (e.button === 0) { e.preventDefault(); addCard(cd); }
      });
      cardEl.addEventListener('contextmenu', e => e.preventDefault());

      // PC: ホバーでカード画像プレビュー
      attachHoverPreview_(cardEl, cd);

      // Mobile: 上下フリック / 長押しプレビュー
      attachTouchControls_(cardEl, cd);

      deckBarTop.appendChild(cardEl);

      if (typeof window.autoscaleBadgeForCardEl === 'function') {
        window.autoscaleBadgeForCardEl(cardEl);
      } else if (typeof autoscaleBadgeForCardEl === 'function') {
        autoscaleBadgeForCardEl(cardEl);
      }
    }

    // --- 解析用の配列化 & 各種同期 ---
    const deckCards = buildDeckCardsForAnalysis_();
    syncAfterDeckUpdate_(deckCards);
  }

  // =========================
  // 一覧（.card）側：使用状況の見た目を更新
  // =========================
  function updateCardDisabling() {
    const deckRaces = new Set();
    let currentOldGod = null;

    // デッキ内の採用種族＆旧神を集計
    for (const cd of Object.keys(deck)) {
      const c = getCard(cd);
      if (!c) continue;

      if (c.race !== 'イノセント' && c.race !== '旧神') deckRaces.add(c.race);
      if (c.race === '旧神') currentOldGod = c.name;
    }

    document.querySelectorAll('.card').forEach(cardEl => {
      const cd = normCd5(cardEl.dataset.cd);
      const c = getCard(cd);
      if (!c) return;

      // 使用種族以外（イノセント/旧神は除外）をグレースケール
      const isUnselectedRace = (
        deckRaces.size > 0 &&
        c.race !== 'イノセント' &&
        c.race !== '旧神' &&
        !deckRaces.has(c.race)
      );
      cardEl.classList.toggle('grayscale', !!isUnselectedRace);

      // 使用中ラベル
      let label = cardEl.querySelector('.used-label');
      if (!label) {
        label = document.createElement('div');
        label.className = 'used-label';
        cardEl.appendChild(label);
      }
      label.textContent = '';

      if (c.race === '旧神') {
        if (deck[cd]) label.textContent = '旧神使用';
        else if (currentOldGod) label.textContent = '他の旧神を使用中';
      } else {
        const n = deck[cd] || 0;
        if (n > 0) label.textContent = `使用中 ×${n}`;
      }

      // クリック/右クリックで±1（1回だけバインド）
      if (!label.dataset.listenerAttached) {
        label.addEventListener('contextmenu', (e) => {
          e.preventDefault(); e.stopPropagation(); removeCard(cd);
        });
        label.addEventListener('click', (e) => {
          e.stopPropagation(); addCard(cd);
        });
        label.dataset.listenerAttached = 'true';
      }
    });
  }

  // =========================
  // オートセーブ
  // =========================
  let autosaveDirty = false;

  function scheduleAutosave() {
    autosaveDirty = true;
    clearTimeout(scheduleAutosave.timer);

    scheduleAutosave.timer = setTimeout(() => {
      if (!autosaveDirty) return;

      const payload = {
        cardCounts: { ...deck },

        // 互換のため両方持つ（page2.js は m を使っていた）
        representativeCd,
        m: representativeCd || null,

        name: window.readDeckNameInput?.() || '',
        note: window.readPostNote?.() || '',
        poster: document.getElementById('poster-name')?.value?.trim() || '',
        shareCode: document.getElementById('post-share-code')?.value?.trim() || '',
        date: window.formatYmd?.(),
      };

      // userTags も保存（readUserTags が居るなら）
      try {
        if (typeof window.readUserTags === 'function') {
          const tags = window.readUserTags();
          if (Array.isArray(tags)) payload.userTags = tags;
        }
      } catch (_) {}

      try {
        localStorage.setItem('deck_autosave_v1', JSON.stringify(payload));
        autosaveDirty = false;
      } catch (e) {
        console.error('デッキのオートセーブに失敗:', e);
      }
    }, 1000);
  }

  // タグ/解説の変更を監視して保存（1回だけ）
  (function bindAutosaveForTagsAndNotes() {
    if (window.__autosaveBound) return;
    window.__autosaveBound = true;

    document.addEventListener('DOMContentLoaded', () => {
      // 選択タグ：クリック/変更で保存
      const sel = document.getElementById('select-tags');
      if (sel) {
        sel.addEventListener('click', scheduleAutosave);
        sel.addEventListener('change', scheduleAutosave);
      }

      // ユーザタグ：クリック/入力で保存
      const userTagsBox = document.getElementById('user-tags');
      const userTagInput = document.getElementById('user-tag-input');
      const userTagAdd = document.getElementById('user-tag-add');

      userTagsBox?.addEventListener('click', scheduleAutosave);
      userTagInput?.addEventListener('input', scheduleAutosave);
      userTagInput?.addEventListener('change', scheduleAutosave);
      userTagAdd?.addEventListener('click', scheduleAutosave);
    });
  })();

  // =========================
  // 復元トーストUI（移植前互換）
  // =========================
  function showRestoreToast_(message, opts = {}) {
    // 既存があれば消す
    document.getElementById('restore-toast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'restore-toast';

    const msgSpan = document.createElement('span');
    msgSpan.className = 'msg';
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (opts.action) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opts.action.label;
      btn.onclick = () => { opts.action.onClick?.(); toast.remove(); };
      toast.appendChild(btn);
    }
    if (opts.secondary) {
      const btn2 = document.createElement('button');
      btn2.type = 'button';
      btn2.textContent = opts.secondary.label;
      btn2.onclick = () => { opts.secondary.onClick?.(); toast.remove(); };
      toast.appendChild(btn2);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 15000);
  }

  function clearAutosave_() {
    try { localStorage.removeItem('deck_autosave_v1'); } catch (_) {}
  }

  function loadAutosave_(data) {
    if (!data || !data.cardCounts) return;

    // deck 入れ替え
    Object.keys(deck).forEach(k => delete deck[k]);
    Object.assign(deck, data.cardCounts || {});

    // 代表カード
    const rep = data.m ? normCd5(data.m) : (data.representativeCd ? normCd5(data.representativeCd) : null);
    representativeCd = (rep && deck[rep]) ? rep : null;
    window.representativeCd = representativeCd;

    // 入力復元
    window.writeDeckNameInput?.(data.name || '');
    window.writePostNote?.(data.note || '');

    // 投稿者名
    try {
      const nameEl = document.getElementById('poster-name');
      const restoredName = (typeof data.poster === 'string') ? data.poster : (data.poster?.name || '');
      if (nameEl) nameEl.value = restoredName || '';
    } catch(_) {}

    // 貼り付けコード
    try {
      const v = String(data.shareCode || '');
      const el = document.getElementById('post-share-code');
      if (el) el.value = v;
      // もし専用 writer が居ればそっちも
      window.writePastedDeckCode?.(v);
    } catch(_) {}

    // selectTags / userTags / cardNotes は「存在するAPIがあれば」復元
    try {
      if (Array.isArray(data.selectTags)) {
        // 正規ストレージに反映するAPIがあるなら使う
        if (typeof window.writeSelectedTags === 'function') window.writeSelectedTags(data.selectTags);
        // UI再描画（存在すれば）
        window.renderPostSelectTags?.();
        window.applySelectTagWrap?.();
      }
    } catch(_) {}

    try {
      if (Array.isArray(data.userTags) && typeof window.writeUserTags === 'function') {
        window.writeUserTags(data.userTags);
      }
    } catch(_) {}

    try {
      if (data.cardNotes != null) {
        // 既存の CardNotes モジュールがあるならそれを使う
        if (window.CardNotes?.replace) {
          window.CardNotes.replace(Array.isArray(data.cardNotes) ? data.cardNotes : []);
        } else if (typeof window.writeCardNotes === 'function') {
          window.writeCardNotes(Array.isArray(data.cardNotes) ? data.cardNotes : []);
        }
      }
    } catch(_) {}

    // UI同期（deckBarTopなど）
    withDeckBarScrollKept(updateDeck);

    // deck-card-list もあるなら更新（移植後に未実装なら何もしない）
    window.renderDeckList?.();

    window.updateDeckSummaryDisplay?.();
    window.updateExchangeSummary?.();
    window.updateRepresentativeHighlight?.();
  }

  function maybeRestoreFromStorage() {
    // URLで fresh=1 のときは復元導線を出さない（移植前互換）
    if (window.location.search.includes('fresh=1')) return;

    const raw = localStorage.getItem('deck_autosave_v1');
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      const saved = data?.cardCounts || {};
      if (!Object.keys(saved).length) return;

      // 今の deck と同一なら出さない（ざっくり比較）
      const now = window.deck || {};
      const sameSize = Object.keys(now).length === Object.keys(saved).length;
      let same = sameSize;
      if (same) {
        for (const k in saved) {
          if ((now[k] | 0) !== (saved[k] | 0)) { same = false; break; }
        }
      }
      if (same) return;

      showRestoreToast_('以前のデータを復元しますか？', {
        action: { label: '復元する', onClick: () => loadAutosave_(data) },
        secondary: { label: '削除する', onClick: () => clearAutosave_() },
      });
    } catch (e) {
      // パース失敗などは黙って無視
    }
  }

  // =========================
  // デッキ情報開閉（ボタン表記同期）
  // =========================
  function toggleDeckSummary() {
    const summary = document.getElementById('deck-summary');
    const btn = document.querySelector('.deck-summary-toggle');
    if (!summary || !btn) return;

    const isOpen = summary.classList.toggle('open');
    btn.textContent = isOpen ? '▶' : '◀';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const deckSummary = document.getElementById('deck-summary');
    const toggleBtn = document.querySelector('.deck-summary-toggle');
    if (!deckSummary || !toggleBtn) return;

    deckSummary.classList.add('open');
    toggleBtn.textContent = '▶';
    toggleBtn.removeAttribute('onclick'); // inline重複防止
    toggleBtn.addEventListener('click', toggleDeckSummary);
  });

  // =========================
  // 代表カード（投稿連携）
  // - post.js が参照する互換API
  //   - window.setRepresentativeCard(cd, name?)
  //   - window.buildCardsForPost_() -> {cd:count}
  //   - window.representativeCd
  // =========================
  function setRepresentativeCard(cd, name = '') {
    const cd5 = normCd5(cd);

    // deckに無いカードは代表にできない（空にする）
    if (!deck?.[cd5]) {
      representativeCd = null;
      window.representativeCd = null;
      return;
    }

    representativeCd = cd5;
    window.representativeCd = cd5;

    // UI更新用フック（存在すれば）
    try { window.updateRepresentativeHighlight?.(cd5, name); } catch (_) {}
    try { scheduleAutosave?.(); } catch (_) {}
  }

  // デッキ内のカード枚数を {cd: count} 形式で返す（投稿用）
  function buildCardsForPost_() {
    const out = {};
    for (const [cd, nRaw] of Object.entries(deck || {})) {
      const n = Number(nRaw) || 0;
      if (n > 0) out[normCd5(cd)] = n;
    }
    return out;
  }

  // =========================
  // 保存（ダウンロード）
  // - JSON保存 / 画像保存（html2canvasがある場合のみ動く）
  // =========================
  function saveDeckAsJson() {
    const payload = {
      cards: { ...deck },
      representativeCd: representativeCd || null,
      name: window.readDeckNameInput?.() || '',
      note: window.readPostNote?.() || '',
      date: window.formatYmd?.(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${payload.name || 'deck'}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  async function saveDeckAsImage() {
    const target = document.getElementById('deck-card-list');
    if (!target) return;

    if (typeof html2canvas !== 'function') {
      console.warn('[saveDeckAsImage] html2canvas が見つかりません');
      return;
    }

    try {
      const canvas = await html2canvas(target, { backgroundColor: null });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'deck.png';
        a.click();

        URL.revokeObjectURL(url);
      });
    } catch (e) {
      console.error('デッキ画像の作成に失敗:', e);
    }
  }

  // =========================
  // 公開API（他ファイルから使う前提）
  // =========================

  // deck state
  window.deck = deck;

  // races / rules
  window.MAIN_RACES = MAIN_RACES;
  window.getMainRacesInDeck = getMainRacesInDeck;
  window.computeMainRace = computeMainRace;
  window.getMainRace = getMainRace;
  window.getRaceType = getRaceType;

  // deck operations
  window.addCard = addCard;
  window.removeCard = removeCard;
  window.updateDeck = updateDeck;
  window.updateCardDisabling = updateCardDisabling;

  // representative (post integration)
  window.setRepresentativeCard = window.setRepresentativeCard || setRepresentativeCard;
  window.buildCardsForPost_ = window.buildCardsForPost_ || buildCardsForPost_;
  window.representativeCd = window.representativeCd ?? representativeCd;

  // autosave / restore
  window.withDeckBarScrollKept = withDeckBarScrollKept;
  window.scheduleAutosave = scheduleAutosave;
  window.maybeRestoreFromStorage = maybeRestoreFromStorage;

  // UI toggles
  window.toggleDeckSummary = toggleDeckSummary;

  // save helpers
  window.saveDeckAsJson = window.saveDeckAsJson || saveDeckAsJson;
  window.saveDeckAsImage = window.saveDeckAsImage || saveDeckAsImage;

  // 代表カード関連は post.js からも参照する想定で互換APIを提供（移植後に post.js を更新してこれらを直接呼ぶようにすれば、ここは非公開にできる）
  window.setRepresentativeCard ??= setRepresentativeCard;
  window.buildCardsForPost_    ??= buildCardsForPost_;
  window.representativeCd      ??= representativeCd || null;

})();