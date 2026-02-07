/*==================
      1.初期設定
===================*/


// ▼ どのページでも安全に所持データを読むヘルパ
function readOwnedDataSafe() {
  // OwnedStore 優先
  try {
    if (window.OwnedStore?.getAll) {
      const s = window.OwnedStore.getAll();
      if (s && typeof s === 'object') return s;
    }
  } catch {}
  // localStorage フォールバック
  try {
    const raw = localStorage.getItem('ownedCards');
    const obj = raw ? JSON.parse(raw) : {};
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  return {};
}




//全カード情報
const allCardsMap = {};
window.allCardsMap = allCardsMap;

/*====================
      2.カード詳細
====================*/
/*
//カード詳細情報🔎ボタン
  function handleZoomClick(event, el) {
    event.stopPropagation();
    event.preventDefault();
    const cardEl = el.closest('.card');
    expandCard(cardEl);
  }

//カード詳細展開
function expandCard(clickedCard) {
  const cd = clickedCard.getAttribute('data-cd');
  const grid = document.getElementById('grid');
  const existing = document.querySelector('.card-detail.active');

  if (existing && existing.getAttribute('data-cd') === cd) {
    existing.remove();
    return;
  }

  if (existing) existing.remove();

  const detail = document.getElementById('detail-' + cd);
  if (!detail) return;

  const cloned = detail.cloneNode(true);
  cloned.style.display = 'block';
  cloned.classList.add('active');
  cloned.setAttribute('data-cd', cd);

  const cards = Array.from(grid.children).filter((c) => {
    if (!c.classList?.contains('card')) return false;
    if (!c.offsetParent) return false; // display:none の場合 null
    const cs = window.getComputedStyle ? getComputedStyle(c) : null;
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
    return true;
  });
  const clickedIndex = cards.indexOf(clickedCard);

  let columns = 7;
  if (grid.clientWidth < 768) columns = 4;
  else if (grid.clientWidth < 1024) columns = 5;

  const rowStart = Math.floor(clickedIndex / columns) * columns;
  const rowEnd = Math.min(rowStart + columns - 1, cards.length - 1);
  const insertAfter = cards[rowEnd];
  insertAfter.insertAdjacentElement('afterend', cloned);
}

//カード拡大モーダル（長押し）
(function(){
  const modal = () => document.getElementById('cardZoomModal');
  const $ = (id) => document.getElementById(id);

  // cd→カード情報を探す（page1.js は allCardsMap、page2.js は cardMap）
  function findCardByCd(cd){
    cd = String(cd);
    if (window.allCardsMap && window.allCardsMap[cd]) return window.allCardsMap[cd];
    if (window.cardMap && window.cardMap[cd]) return { cd, ...window.cardMap[cd] };
    return null;
  }

// （IIFE内）画像のみ版
function openCardZoom(cd){
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


  function closeCardZoom(){
    const m = modal(); if (!m) return;
    m.style.display = 'none';
    document.body.style.overflow = '';
  }

  // 背景タップ/×/ESCで閉じる
  document.addEventListener('click', (e)=>{
    const m = modal(); if (!m || m.style.display !== 'flex') return;
    if (e.target === m) closeCardZoom();
  });
  document.addEventListener('keydown', (e)=>{
    const m = modal(); if (!m || m.style.display !== 'flex') return;
    if (e.key === 'Escape') closeCardZoom();
  });
  const closeBtn = document.getElementById('cardZoomClose');
  if (closeBtn) closeBtn.addEventListener('click', closeCardZoom);

  // #grid 配下の .card に長押しをバインド
  function bindLongPressForCards(context){
    const root = document.getElementById('grid');
    if (!root) return;

    let timer = null, startX=0, startY=0, moved=false;
    const LONG_MS = 380;   // 体感よいしきい値（350〜450ms 推奨）
    const MOVE_TOL = 8;    // 長押し中の許容移動

    root.addEventListener('touchstart', (ev)=>{
      const t = ev.target.closest('.card');
      if (!t) return;
      const touch = ev.touches[0];
      startX = touch.clientX; startY = touch.clientY; moved = false;

      const cd = t.dataset.cd;
      clearTimeout(timer);
      timer = setTimeout(()=>{ openCardZoom(cd, context); }, LONG_MS);
    }, {passive:true});

    root.addEventListener('touchmove', (ev)=>{
      const touch = ev.touches[0];
      if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > MOVE_TOL){
        moved = true; clearTimeout(timer);
      }
    }, {passive:true});

    root.addEventListener('touchend', ()=>{
      if (!moved){
      // タップは既存のonclick(=行間展開)へ任せる  }
      clearTimeout(timer);
    }, {passive:true});

    root.addEventListener('touchcancel', ()=> clearTimeout(timer), {passive:true});

  }

  // 公開（各ページで呼ぶ）
  window.__bindLongPressForCards = bindLongPressForCards;
})();
*/

// 実行関数
async function loadCards() {
  const cards = await fetchLatestCards();
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  cards.forEach(card => {
    // 一覧用カード生成
    const cardElement = generateCardListElement(card);
    grid.appendChild(cardElement);

    // 詳細パネル生成
    const detailHtml = generateDetailHtml(card);
    grid.insertAdjacentHTML('beforeend', detailHtml);

    // ← カードをマップに登録
    allCardsMap[card.cd] = card;
  });

  sortCards(); // 任意：並び替え
  if (typeof window.rebuildCardMap === 'function') {
    rebuildCardMap(); //カード一覧再読み込み
  }
  // カード読み込み完了後に deckmaker 側へ通知
if (typeof window.onCardsLoaded === 'function') {
  window.onCardsLoaded();
}
}

// ✅ 詳細UI（行間展開/長押しズーム）の初期化
// grid があるページだけで動く
document.addEventListener('DOMContentLoaded', ()=>{
  try { window.CardDetailUI?.bindLongPressForCards?.('#grid'); } catch {}
});
