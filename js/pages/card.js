/*==================================================
  1. 初期設定
==================================================*/
//#region 1. 初期設定

// カード呼び出し
window.addEventListener('DOMContentLoaded', () => {
    loadCards();

    // owned-mark sync (card list)
    window.OwnedUI?.bind?.("#grid");

    // 長押し（画像ズーム）
    setTimeout(() => window.__bindLongPressForCards?.('list'), 0);
});

//#endregion


/*==================================================
  2. 一覧カード生成（詳細HTML生成）
==================================================*/
//#region 2. 一覧カード生成（詳細HTML生成）

// 展開詳細生成（HTML文字列でOK）
function generateDetailHtml(card) {
    const typeClass = `type-${card.type}`;
    const raceClass = `race-${card.race}`;
    const detailId  = `detail-${card.cd}`;

    const effectParts = [];

    if (card.effect_name1) {
        effectParts.push(`<div><strong class="effect-name">${card.effect_name1}</strong></div>`);
    }
    if (card.effect_text1) {
        effectParts.push(`<div>${card.effect_text1}</div>`);
    }
    if (card.effect_name2) {
        effectParts.push(`<div><strong class="effect-name">${card.effect_name2}</strong></div>`);
    }
    if (card.effect_text2) {
        effectParts.push(`<div>${card.effect_text2}</div>`);
    }

    const effectHtml = effectParts.join('\n');

    return `
        <div class="card-detail ${typeClass} ${raceClass}" data-name="${card.name}" id="${detailId}">
            <div class="card-name">${card.name}</div>

            <div class="card-meta card-pack">
                ${card.pack_name || ''}
            </div>

            <div class="card-meta">
                <span class="card-race">${card.race}</span> /
                <span class="card-category">${card.category}</span>
            </div>

            <div class="card-effect">
                ${effectHtml}
            </div>
        </div>
    `;
}

//#endregion


/*==================================================
  3. デッキ情報
==================================================*/
//#region 3. デッキ情報

// デッキ内のカード枚数を管理するマップ
// キー: カードの cd（番号）、値: 枚数
const deckMap = {};

//#endregion


/*==================================================
  4. 表示切替（グリッド ⇔ リスト）
==================================================*/
//#region 4. 表示切替（グリッド ⇔ リスト）

(function () {

    const VIEW_KEY = 'cards_view_mode'; // localStorage key

    /*------------------------------
      4.0 detailテンプレ退避場所（グリッド復帰時に戻す）
    ------------------------------*/
    function getDetailBank_(){
    let bank = document.getElementById('detail-bank');
    if (!bank){
        bank = document.createElement('div');
        bank.id = 'detail-bank';
        bank.style.display = 'none';
        document.body.appendChild(bank);
    }
    return bank;
    }


    /*------------------------------
      4.1 トグルUI
    ------------------------------*/
    function setActiveBtn_(mode) {
        const root = document.getElementById('viewToggle');
        if (!root) return;

        root.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.view === mode);
        });
    }

    /*------------------------------
      4.2 リスト行を構築
    ------------------------------*/
    function buildListRows_() {
    const grid = document.getElementById('grid');
    if (!grid) return;

    // 既に list-row なら二重生成しない
    if (grid.querySelector('.list-row')) return;

    const bank = getDetailBank_();

    // ✅ 先に「グリッド用detailテンプレ（#detail-xxxxx）」を退避
    Array.from(grid.children)
        .filter(el => el.classList?.contains('card-detail') && /^detail-/.test(el.id || ''))
        .forEach(el => bank.appendChild(el));

    // 現在の .card を集める（順序維持）
    const cards = Array.from(grid.children)
        .filter(el => el.classList?.contains('card'));

    // いったん空にして、rowを積む
    grid.innerHTML = '';

    for (const cardEl of cards) {
        const cd = String(cardEl.dataset.cd || '').padStart(5, '0');

        const row = document.createElement('div');
        row.className = 'list-row';

        // 左：カード
        row.appendChild(cardEl);

        // 右：詳細（テンプレがbankにあるなら clone）
        let detailNode = null;

        const detailTpl = bank.querySelector('#detail-' + cd);
        if (detailTpl) {
        detailNode = detailTpl.cloneNode(true);
        detailNode.style.display = 'block';
        detailNode.classList.remove('active');
        detailNode.setAttribute('data-cd', cd);
        } else {
            const card = window.cardMap?.[cd] || {
            cd,
            name: cardEl.dataset.name || '',
            pack_name: cardEl.dataset.pack || '',
            race: cardEl.dataset.race || '',
            category: cardEl.dataset.category || '',
            type: cardEl.dataset.type || '',
            effect_name1: cardEl.dataset.effect1 || '',
            effect_text1: cardEl.dataset.effecttext1 || '',
            effect_name2: cardEl.dataset.effect2 || '',
            effect_text2: cardEl.dataset.effecttext2 || '',
            };

            if (!card.pack_name && card.packName) card.pack_name = card.packName;

            const html = generateDetailHtml(card);
            const tmp = document.createElement('div');
            tmp.innerHTML = html.trim();
            detailNode = tmp.firstElementChild;

            if (detailNode) {
            detailNode.style.display = 'block';
            detailNode.setAttribute('data-cd', cd);
            }
        }

        if (detailNode) {
            try {
                window.CardDetailUI?.attachOwnedEditor?.(detailNode, cd);
            } catch (e) {
                console.warn('attachOwnedEditor failed', e);
            }

        row.appendChild(detailNode);
        }
        grid.appendChild(row);
    }
    }

    /*------------------------------
      4.3 グリッドへ戻す
    ------------------------------*/
    function restoreGrid_() {
    const grid = document.getElementById('grid');
    if (!grid) return;

    const rows = Array.from(grid.querySelectorAll('.list-row'));
    if (!rows.length) return;

    const bank = getDetailBank_();

    // 行から card を取り出す
    const cards = [];
    rows.forEach(row => {
        const c = row.querySelector('.card');
        if (c) cards.push(c);
    });

    // ✅ まず grid を空に
    grid.innerHTML = '';

    // ✅ card を戻しつつ、bankの detailテンプレも「隠しで」戻す
    cards.forEach(cardEl => {
        const cd = String(cardEl.dataset.cd || '').padStart(5, '0');
        grid.appendChild(cardEl);

        const tpl = bank.querySelector('#detail-' + cd);
        if (tpl) {
        // テンプレは表示しない（expandCard が clone する元）
        tpl.style.display = 'none';
        tpl.classList.remove('active');
        tpl.removeAttribute('data-cd');
        grid.appendChild(tpl);
        }
    });
    }


    /*------------------------------
      4.4 適用（mode）
    ------------------------------*/
    function applyViewMode_(mode) {
        const grid = document.getElementById('grid');
        if (!grid) return;

        if (mode === 'list') {
            grid.classList.add('is-list');
            buildListRows_();
        } else {
            grid.classList.remove('is-list');
            restoreGrid_();
        }

        setActiveBtn_(mode);
        try { localStorage.setItem(VIEW_KEY, mode); } catch {}

        if (typeof window.applyFilters === 'function') {
                window.applyFilters();
            }
    }

    /*------------------------------
      4.5 イベント登録
    ------------------------------*/
    function bindViewToggle_() {
        const root = document.getElementById('viewToggle');
        if (!root) return;

        root.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-btn');
            if (!btn) return;

            const mode = btn.dataset.view;
            applyViewMode_(mode);
        });
    }

    /*------------------------------
      4.6 初期化
    ------------------------------*/
    window.addEventListener('DOMContentLoaded', () => {
        bindViewToggle_();

    // ✅ 初期は常にグリッド固定（中途半端表示を防止）
    const init = 'grid';
    setActiveBtn_(init);
    applyViewMode_('grid');           // ← 明示的に適用
    try { localStorage.setItem(VIEW_KEY, 'grid'); } catch {}
    });

    // 外からも呼べるように
    window.applyCardsViewMode = applyViewMode_;

})();

//#endregion



/*==================================================
    5. カード読み込み＆表示
==================================================*/
//#region 5. カード読み込み＆表示

async function loadCards() {
  const cards = await fetchLatestCards();

  const grid = document.getElementById('grid');
  if (!grid) return;

  // ✅ 既存DOMクリア
  grid.innerHTML = '';

  // ✅ detailは grid に積まず bank に退避（初期表示を軽くする）
  const bank = getOrCreateDetailBank_();

  // bank もいったんクリア（必要なら）
  bank.innerHTML = '';

  const fragCards = document.createDocumentFragment();
  const fragDetails = document.createDocumentFragment();

  for (const card of cards) {
    // 一覧用カード生成（画像がここ）
    const cardElement = generateCardListElement(card);
    fragCards.appendChild(cardElement);

    // detail は bank へ（グリッドに入れない）
    const html = generateDetailHtml(card);
    const tmp = document.createElement('div');
    tmp.innerHTML = html.trim();
    const detailEl = tmp.firstElementChild;
    if (detailEl) {
      // テンプレとして隠す
      detailEl.style.display = 'none';
      fragDetails.appendChild(detailEl);
    }

    // map登録
    allCardsMap[card.cd] = card;
  }

  grid.appendChild(fragCards);
  bank.appendChild(fragDetails);

  // 並び替え/再構築は “描画後” に回す（体感改善）
  requestAnimationFrame(() => {
    try { sortCards(); } catch {}
    try { window.rebuildCardMap?.(); } catch {}
    try { window.onCardsLoaded?.(); } catch {}
    // 所持オーバーレイ等があるならここで
    try { window.OwnedUI?.bind?.("#grid"); } catch {}
  });
}

function getOrCreateDetailBank_(){
  let bank = document.getElementById('detail-bank');
  if (!bank){
    bank = document.createElement('div');
    bank.id = 'detail-bank';
    bank.style.display = 'none';
    document.body.appendChild(bank);
  }
  return bank;
}

//#endregion
