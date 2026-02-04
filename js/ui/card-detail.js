/* =========================
 * ui/card-detail.js
 * - 行間詳細（expandCard）
 * - 画像拡大モーダル（長押し）
 * - 詳細内の所持編集（+/- / 0リセット）
 * ========================= */
(function(){
    'use strict';

    // ✅ card.js を読んでないページ（デッキメーカー）でも詳細を生成できるフォールバック
    function buildDetailElementFallback_(cd, cardEl){
        // 1) cardMap（card-core）優先
        const m = window.cardMap?.[String(cd).padStart(5,'0')];

        // 2) 取れなければ DOM dataset から復元
        const d = cardEl?.dataset || {};

        const name = (m?.name ?? d.name ?? '');
        const type = (m?.type ?? d.type ?? '');
        const race = (m?.race ?? d.race ?? '');
        const category = (m?.category ?? d.category ?? '');
        const packName = (m?.packName ?? d.pack ?? '');

        const en1 = (m?.effect_name1 ?? d.effect1 ?? '');
        const et1 = (m?.effect_text1 ?? d.effecttext1 ?? '');
        const en2 = (m?.effect_name2 ?? d.effect2 ?? '');
        const et2 = (m?.effect_text2 ?? d.effecttext2 ?? '');

        const effectParts = [];
        if (en1) effectParts.push(`<div><strong class="effect-name">${en1}</strong></div>`);
        if (et1) effectParts.push(`<div>${et1}</div>`);
        if (en2) effectParts.push(`<div><strong class="effect-name">${en2}</strong></div>`);
        if (et2) effectParts.push(`<div>${et2}</div>`);
        const effectHtml = effectParts.join('\n') || `<div>（効果情報なし）</div>`;

        const typeClass = type ? `type-${type}` : '';
        const raceClass = race ? `race-${race}` : '';

        const el = document.createElement('div');
        el.className = `card-detail ${typeClass} ${raceClass}`.trim();
        el.id = `detail-${String(cd).padStart(5,'0')}`;
        el.setAttribute('data-cd', String(cd).padStart(5,'0'));
        el.setAttribute('data-name', name);

        el.innerHTML = `
            <div class="card-name">${name}</div>
            <div class="card-meta card-pack">${packName || ''}</div>
            <div class="card-meta">
            <span class="card-race">${race || ''}</span> /
            <span class="card-category">${category || ''}</span>
            </div>
            <div class="card-effect">${effectHtml}</div>
        `.trim();

        return el;
    }


    // 既存HTMLの detail-xxxx を行間に挿入する
    function expandCard(clickedCard){
    const cd = clickedCard?.getAttribute?.('data-cd');
    if (!cd) return;

    const grid = document.getElementById('grid');
    if (!grid) return;

    // ✅ リスト表示中は「行間詳細」を使わない（右側に詳細があるため）
    //    ここで止めれば insertAdjacentElement のエラーも出ない
    if (grid.classList.contains('is-list')) return;

    const existing = document.querySelector('.card-detail.active');
    if (existing && existing.getAttribute('data-cd') === cd) {
        existing.remove();
        return;
    }
    if (existing) existing.remove();

    let detail = document.getElementById('detail-' + cd);

    // ✅ card.js を読んでないページ（デッキメーカー）でも動くようにフォールバック生成
    if (!detail) {
    detail = buildDetailElementFallback_(cd, clickedCard);
    }
    if (!detail) return;

    const cloned = detail.cloneNode(true);
    cloned.style.display = 'block';
    cloned.classList.add('active');
    cloned.classList.add('card-detail'); // 念のため
    cloned.setAttribute('data-cd', cd);

    // ✅ 所持編集UIを詳細内へ差し込み（図鑑ページ用）
    attachOwnedEditor_(cloned, cd);

    // ✅ 「表示中カードだけ」で行計算（直下 children に限定しない）
    const cards = Array.from(grid.querySelectorAll('.card')).filter((c) => {
        if (!c.offsetParent) return false;
        const cs = window.getComputedStyle ? getComputedStyle(c) : null;
        if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
        return true;
    });

    const clickedIndex = cards.indexOf(clickedCard);
    // ✅ 保険：見つからないなら中断（insertAfter が undefined にならない）
    if (clickedIndex < 0) return;

    let columns = 7;
    if (grid.clientWidth < 768) columns = 4;
    else if (grid.clientWidth < 1024) columns = 5;

    const rowStart = Math.floor(clickedIndex / columns) * columns;
    const rowEnd = Math.min(rowStart + columns - 1, cards.length - 1);
    const insertAfter = cards[rowEnd];
    if (!insertAfter) return; // ✅ さらに保険

    insertAfter.insertAdjacentElement('afterend', cloned);
    }

    // クリックから呼ばれる互換I/F（既存のonclick維持）
    function handleZoomClick(event, el){
        event?.stopPropagation?.();
        event?.preventDefault?.();
        const cardEl = el?.closest ? el.closest('.card') : null;
        if (!cardEl) return;
        expandCard(cardEl);
    }

    // -------------------------
    // 所持編集（詳細内）
    // - 0リセット無し
    // - 「編集」押下でのみ +/- 操作可能（誤タップ防止）
    // - 表示位置：カード名の右（狭いと下に落ちる）
    // -------------------------
    function attachOwnedEditor_(detailEl, cd){
        // すでにあるなら二重生成しない
        if (detailEl.querySelector('.owned-editor')) return;

        // 置き場：カード名の右（無ければ detail 先頭）
        const nameEl = detailEl.querySelector('.card-name');
        const hostFallback =
            detailEl.querySelector('.detail-header')
            || detailEl.querySelector('.card-detail-header')
            || detailEl;

        // タイトル行のコンテナを作る（既にあれば流用）
        let titleRow = detailEl.querySelector('.card-title-row');
        if (!titleRow) {
            titleRow = document.createElement('div');
            titleRow.className = 'card-title-row';

            if (nameEl && nameEl.parentNode) {
            // card-name を titleRow に入れて、元の場所に差し戻す
            const parent = nameEl.parentNode;
            parent.insertBefore(titleRow, nameEl);
            titleRow.appendChild(nameEl);
            } else {
            hostFallback.insertBefore(titleRow, hostFallback.firstChild);
            }
        }

        // editor本体
        const wrap = document.createElement('div');
        wrap.className = 'owned-editor is-locked'; // 初期はロック

        const label = document.createElement('span');
        label.className = 'owned-editor-label';
        label.textContent = '所持枚数';

        const num = document.createElement('span');
        num.className = 'owned-editor-num';
        num.setAttribute('aria-label', '所持数');

        const btnMinus = document.createElement('button');
        btnMinus.type = 'button';
        btnMinus.className = 'owned-editor-btn owned-editor-minus';
        btnMinus.textContent = '−';
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

        const readTotal = () => {
            try {
            const e = window.OwnedStore?.get?.(String(cd)) || { normal:0, shine:0, premium:0 };
            return (e.normal|0) + (e.shine|0) + (e.premium|0);
            } catch { return 0; }
        };

        const writeTotal = (n) => {
            const max = (typeof window.maxAllowedCount === 'function')
            ? window.maxAllowedCount(String(cd), detailEl.dataset?.race || '')
            : 3;

            const next = Math.max(0, Math.min(max, n|0));
            try {
            window.OwnedStore?.set?.(String(cd), { normal: next, shine:0, premium:0 });
            } catch {}
            // owned.js 側の listener が効けば自動反映、無ければ手動同期
            try { window.OwnedUI?.sync?.('#grid'); } catch {}
            num.textContent = String(next);
            updateBtnState();
        };

        const updateBtnState = () => {
            const cur = readTotal();
            const max = (typeof window.maxAllowedCount === 'function')
                ? window.maxAllowedCount(String(cd), detailEl.dataset?.race || '')
                : 3;

            // 下限
            const atMin = cur <= 0;
            btnMinus.disabled = atMin;
            btnMinus.classList.toggle('is-disabled', atMin);

            // 上限
            const atMax = cur >= max;
            btnPlus.disabled = atMax;
            btnPlus.classList.toggle('is-disabled', atMax);
        };

        // 初期表示
        num.textContent = String(readTotal());
        updateBtnState();

        // ロック切り替え
        const setLocked = (locked) => {
            wrap.classList.toggle('is-locked', locked);
            btnMinus.disabled = locked;
            btnPlus.disabled  = locked;
            btnToggle.setAttribute('aria-pressed', locked ? 'false' : 'true');
            btnToggle.textContent = locked ? '編集' : '編集中';
        };

        btnToggle.addEventListener('click', (e)=>{
            e.preventDefault();
            e.stopPropagation();
            setLocked(!btnMinus.disabled ? true : false);
        });

        // +/- 操作（ロック中は disabled で押せない）
        btnMinus.addEventListener('click', (e)=>{
            e.preventDefault(); e.stopPropagation();
            writeTotal(readTotal() - 1);
        });
        btnPlus.addEventListener('click', (e)=>{
            e.preventDefault(); e.stopPropagation();
            writeTotal(readTotal() + 1);
        });

        // OwnedStore 変更時に数字も追従
        try {
            window.OwnedStore?.onChange?.(()=>{ num.textContent = String(readTotal());
            updateBtnState();
            });
        } catch {}
    }


  // -------------------------
  // 画像ズーム（長押し）
  // -------------------------
    function openCardZoom_(cd){
        const m = document.getElementById('cardZoomModal'); if (!m) return;
        const img = document.getElementById('zoomImage');   if (!img) return;

        img.src = `img/${cd}.webp`;
        img.onerror = function(){
        if (this.dataset.fallbackApplied) return;
        this.dataset.fallbackApplied = '1';
        this.src = 'img/00000.webp';
        };

        m.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeCardZoom_(){
        const m = document.getElementById('cardZoomModal'); if (!m) return;
        m.style.display = 'none';
        document.body.style.overflow = '';
    }

    function bindLongPressForCards(rootSelector = '#grid'){
        const root = document.querySelector(rootSelector);
        if (!root) return;

        let timer = null, startX=0, startY=0, moved=false;
        const LONG_MS = 380;
        const MOVE_TOL = 8;

        root.addEventListener('touchstart', (ev)=>{
        const t = ev.target.closest('.card');
        if (!t) return;
        const touch = ev.touches[0];
        startX = touch.clientX; startY = touch.clientY; moved = false;

        const cd = t.dataset.cd;
        clearTimeout(timer);
        timer = setTimeout(()=>{ openCardZoom_(cd); }, LONG_MS);
        }, {passive:true});

        root.addEventListener('touchmove', (ev)=>{
        const touch = ev.touches[0];
        if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > MOVE_TOL){
            moved = true; clearTimeout(timer);
        }
        }, {passive:true});

        root.addEventListener('touchend', ()=> clearTimeout(timer), {passive:true});
        root.addEventListener('touchcancel', ()=> clearTimeout(timer), {passive:true});

        // 背景/×/ESCで閉じる（1回だけ）
        if (!window.__cardZoomBound){
        window.__cardZoomBound = true;
        document.addEventListener('click', (e)=>{
            const m = document.getElementById('cardZoomModal');
            if (!m || m.style.display !== 'flex') return;
            if (e.target === m) closeCardZoom_();
        });
        document.addEventListener('keydown', (e)=>{
            const m = document.getElementById('cardZoomModal');
            if (!m || m.style.display !== 'flex') return;
            if (e.key === 'Escape') closeCardZoom_();
        });
        const closeBtn = document.getElementById('cardZoomClose');
        if (closeBtn) closeBtn.addEventListener('click', closeCardZoom_);
        }
    }

    // ↓こうする（attachOwnedEditor を追加）
    window.CardDetailUI = {
    expandCard,
    handleZoomClick,
    openCardZoom: openCardZoom_,
    closeCardZoom: closeCardZoom_,
    attachOwnedEditor: attachOwnedEditor_,
    };

    // 既存互換（onclick="handleZoomClick(...)" 対策）
    window.handleZoomClick = handleZoomClick;

})();
