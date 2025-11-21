/* =========================
   DeckPosts 一覧ページ制御（新規）
   - 全体一覧（ページネーション）
   - マイ投稿（全画面・ログイン必須）
========================= */
const DeckPostApp = (() => {
  const GAS_BASE = window.DECKPOST_API_BASE || 'https://script.google.com/macros/s/AKfycbxFj5HABSLGJaghas5MR56k-pW1QIef2kw_Z_wXvcQ-Nzq0_VMkxAW76GwKuOojK50/exec';

  const state = {
    list: { items: [], nextOffset: 0, loading: false },
    mine: { items: [], nextOffset: 0, loading: false },
    token: '', // ログイン済みなら共通Authから拾う
  };

  // 環境からtokenを取得（共通Authがあれば拝借）
  function resolveToken(){
    try{
      const A = window.Auth || {};
      if (A.token) return String(A.token);
    }catch(_){}
    try{
      const t = localStorage.getItem('auth_token');
      if (t) return String(t);
    }catch(_){}
    return '';
  }

  async function apiList({ limit=24, offset=0, mine=false }){
    const qs = new URLSearchParams();
    qs.set('mode','list');
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    if (mine){
      qs.set('mine','1');
      const tk = state.token || resolveToken();
      if (tk) qs.set('token', tk);
    }
    const url = `${GAS_BASE}?${qs.toString()}`;
    const res = await fetch(url);
    return res.json();
  }

  // ===== 画面遷移（一覧↔マイ投稿） =====
  function showList(){
    document.getElementById('pageList')?.removeAttribute('hidden');
    document.getElementById('pageMine')?.setAttribute('hidden','');
  }
  function showMine(){
    document.getElementById('pageMine')?.removeAttribute('hidden');
    document.getElementById('pageList')?.setAttribute('hidden','');
  }

  // ===== レンダリング =====
  function el(html){
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  // ===== タグ／種族まわり =====

  // メイン種族 → 背景色
  const RACE_BG_MAP = {
    'ドラゴン':     'rgba(255, 100, 100, 0.16)',
    'アンドロイド': 'rgba(100, 200, 255, 0.16)',
    'エレメンタル': 'rgba(100, 255, 150, 0.16)',
    'ルミナス':     'rgba(255, 250, 150, 0.16)',
    'シェイド':     'rgba(200, 150, 255, 0.16)',
  };

  function getMainRace(races){
    const s = String(races || '');
    if (!s) return '';
    return s.split(/[,+]/)[0].trim();  // 「シェイド,イノセント…」などを想定
  }


  function raceBg(races){
    const main = getMainRace(races);
    return RACE_BG_MAP[main] || '';
  }

  // 自動タグ＋選択タグ（上段・ピンク系）
  function tagChipsMain(tagsAuto, tagsPick){
    const s = [tagsAuto, tagsPick].filter(Boolean).join(',');
    if (!s) return '';
    return s.split(',')
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => `<span class="chip">${escapeHtml(x)}</span>`)
      .join('');
  }

  // ユーザータグ（下段・青系）
  function tagChipsUser(tagsUser){
    const s = String(tagsUser || '');
    if (!s) return '';
    return s.split(',')
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => `<span class="chip">${escapeHtml(x)}</span>`)
      .join('');
  }

  function cardThumb(src, title){
    const safe = src ? src : 'img/noimage.webp';
    const alt  = title ? escapeHtml(title) : '';
    return `<div class="thumb-box"><img loading="lazy" src="${safe}" alt="${alt}"></div>`;
  }

// ===== 詳細用：デッキリスト（5列固定） =====
function buildDeckListHtml(item){
  console.log('buildDeckListHtml:', item.postId, item.cardsJSON);
  let deck = null;

  // 1) item.cards（配列）があれば優先
  if (Array.isArray(item.cards) && item.cards.length){
    deck = {};
    for (const c of item.cards){
      const cd = String(c.cd || '').trim();
      if (!cd) continue;
      const n = Number(c.count || 0) || 0;
      if (n <= 0) continue;
      deck[cd] = (deck[cd] || 0) + n;
    }
  }
  // 2) なければ cardsJSON（{cd:count}）を使う
  else if (item.cardsJSON){
    try{
      const obj = JSON.parse(item.cardsJSON);
      if (obj && typeof obj === 'object'){
        deck = {};
        for (const [cd, nRaw] of Object.entries(obj)){
          const key = String(cd || '').trim();
          if (!key) continue;
          const n = Number(nRaw || 0) || 0;
          if (n <= 0) continue;
          deck[key] = (deck[key] || 0) + n;
        }
      }
    }catch(_){}
  }

  if (!deck || !Object.keys(deck).length){
    return `<div class="post-decklist post-decklist-empty">デッキリスト未登録</div>`;
  }

  const entries = Object.entries(deck);
  const cardMap = window.cardMap || {};
  const TYPE_ORDER = { 'チャージャー':0, 'アタッカー':1, 'ブロッカー':2 };

  // page24 の並び方をざっくり踏襲
  entries.sort((a, b) => {
    const A = cardMap[a[0]] || {};
    const B = cardMap[b[0]] || {};
    const tA = TYPE_ORDER[A.type] ?? 99;
    const tB = TYPE_ORDER[B.type] ?? 99;
    if (tA !== tB) return tA - tB;

    const cA = parseInt(A.cost)  || 0;
    const cB = parseInt(B.cost)  || 0;
    if (cA !== cB) return cA - cB;

    const pA = parseInt(A.power) || 0;
    const pB = parseInt(B.power) || 0;
    if (pA !== pB) return pA - pB;

    return String(a[0]).localeCompare(String(b[0]));
  });

  const tiles = entries.map(([cd, n]) => {
    const card = cardMap[cd] || {};
    const name = card.name || cd;
    const src  = `img/${cd}.webp`;
    return `
      <div class="deck-entry">
        <img src="${src}" alt="${escapeHtml(name)}" loading="lazy">
        <div class="count-badge">x${n}</div>
      </div>
    `;
  }).join('');

  return `<div class="post-decklist">${tiles}</div>`;
}

// ===== 1枚カードレンダリング（PC用） =====
function buildCardPc(item){
  const time     = item.updatedAt || item.createdAt || '';
  const mainRace = getMainRace(item.races);
  const bg       = raceBg(item.races);
  const code     = item.code || '';           // デッキコード
  const oldGod   = item.oldGodName || '';     // 旧神カード名

  const deckNote = item.deckNote || item.comment || '';
  const deckNoteHtml = escapeHtml(deckNote).replace(/\n/g, '<br>');

  const tagsMain = tagChipsMain(item.tagsAuto, item.tagsPick);
  const tagsUser = tagChipsUser(item.tagsUser);
  const deckList = buildDeckListHtml(item);

  return el(`
    <article class="post-card post-card--pc" data-postid="${item.postId}" style="${bg ? `--race-bg:${bg};` : ''}">
      ${cardThumb(item.repImg, item.title)}

      <div class="post-meta">
        <div class="title-wrap">
          <div>
              <div class="title">
                ${escapeHtml(item.title || '(無題)')}
              </div>
            <div class="sub">
              ${escapeHtml(item.posterName || item.username || '')}
              ${item.posterX ? '　/　@' + escapeHtml(item.posterX) : ''}
              ${fmtDate(time) ? '　' + fmtDate(time) : ''}
            </div>
          </div>
        </div>
        <button class="fav-btn" type="button" aria-label="お気に入り">☆</button>
      </div>

      <!-- タグ：上段=自動/選択, 下段=ユーザー -->
      <div class="post-tags-wrap">
        <div class="post-tags post-tags-main">${tagsMain}</div>
        <div class="post-tags post-tags-user">${tagsUser}</div>
      </div>

      <!-- アクション -->
      <div class="post-actions">
        <button type="button" class="btn-detail">詳細</button>
        <button type="button" class="btn-add-compare">比較に追加</button>
      </div>

      <!-- 詳細（折りたたみ） -->
      <div class="post-detail" hidden>
        <div class="post-detail-section">
          <div class="post-detail-heading">デッキリスト</div>
          ${deckList}
        </div>

        <div class="post-detail-row post-detail-code">
          <span>デッキコード</span>
          <button type="button" class="btn-copy-code" data-code="${escapeHtml(code)}">コピー</button>
        </div>

        <div class="post-detail-row">
          <span>メイン種族：${escapeHtml(mainRace || '')}</span>
        </div>

        <div class="post-detail-row">
          <span>枚数：${item.count || 0}枚</span>
        </div>

        <div class="post-detail-row">
          <span>旧神：${escapeHtml(oldGod || 'なし')}</span>
        </div>

        <div class="post-detail-section">
          <div class="post-detail-heading">デッキ解説</div>
          <div class="post-detail-body">${deckNoteHtml}</div>
        </div>

        <div class="post-detail-section">
          <div class="post-detail-heading">カード解説</div>
          <div class="post-detail-body">
            （カード解説は後で cardNotes などから差し込み）
          </div>
        </div>

        <div class="post-detail-footer">
          <button type="button" class="btn-detail-close">閉じる</button>
        </div>
      </div>
    </article>
  `);
}

// ===== 1枚カードレンダリング（スマホ用） =====
function buildCardSp(item){
  const time     = item.updatedAt || item.createdAt || '';
  const mainRace = getMainRace(item.races);
  const bg       = raceBg(item.races);
  const code     = item.code || '';
  const oldGod   = item.oldGodName || '';
  const deckNote = item.deckNote || item.comment || '';
  const deckNoteHtml = escapeHtml(deckNote).replace(/\n/g, '<br>');

  const tagsMain = tagChipsMain(item.tagsAuto, item.tagsPick);
  const tagsUser = tagChipsUser(item.tagsUser);
  const deckList = buildDeckListHtml(item);

  return el(`
    <article class="post-card post-card--sp" data-postid="${item.postId}" style="${bg ? `--race-bg:${bg};` : ''}">

      <!-- 上段：代表カード + 情報 -->
      <div class="sp-head">
        <div class="sp-head-left">
          ${cardThumb(item.repImg, item.title)}
        </div>
        <div class="sp-head-right">
            <div class="sp-title">
              ${escapeHtml(item.title || '(無題)')}
            </div>
          <div class="sp-meta">
            ${escapeHtml(item.posterName || item.username || '')}
            ${item.posterX ? ' / ' + escapeHtml(item.posterX) : ''}
            ${fmtDate(time) ? ' / ' + fmtDate(time) : ''}
          </div>
          <button class="fav-btn sp-fav" type="button" aria-label="お気に入り">☆</button>
        </div>
      </div>

      <!-- タグ（ヘッダーの下にまとめて） -->
      <div class="post-tags-wrap">
        <div class="post-tags post-tags-main">${tagsMain}</div>
        <div class="post-tags post-tags-user">${tagsUser}</div>
      </div>

      <!-- アクション -->
      <div class="post-actions sp-actions">
        <button type="button" class="btn-detail">詳細</button>
        <button type="button" class="btn-add-compare">比較に追加</button>
      </div>

      <!-- 詳細（折りたたみ） -->
      <div class="post-detail" hidden>
        <div class="post-detail-section">
          <div class="post-detail-heading">デッキリスト</div>
          ${deckList}
        </div>

        <div class="post-detail-row post-detail-code">
          <span>デッキコード</span>
          <button type="button" class="btn-copy-code" data-code="${escapeHtml(code)}">コピー</button>
        </div>

        <div class="post-detail-row">
          <span>メイン種族：${escapeHtml(mainRace || '')}</span>
        </div>

        <div class="post-detail-row">
          <span>  枚数：${item.count || 0}枚</span>
        </div>

        <div class="post-detail-row">
          <span>旧神：${escapeHtml(oldGod || 'なし')}</span>
        </div>

        <div class="post-detail-section">
          <div class="post-detail-heading">デッキ解説</div>
          <div class="post-detail-body">${deckNoteHtml}</div>
        </div>

        <div class="post-detail-section">
          <div class="post-detail-heading">カード解説</div>
          <div class="post-detail-body">（カード解説は後で追加）</div>
        </div>

        <div class="post-detail-footer">
          <button type="button" class="btn-detail-close">閉じる</button>
        </div>
      </div>

    </article>
  `);
}



// ===== 1枚カードレンダリング（PC/SP切り替え） =====
function oneCard(item){
  const isSp = window.matchMedia('(max-width: 768px)').matches;
  return isSp ? buildCardSp(item) : buildCardPc(item);
}

  // 一覧レンダリング
  function renderList(items, targetId){
    const wrap = document.getElementById(targetId);
    if (!wrap) return;
    const frag = document.createDocumentFragment();
    for (const it of items) frag.appendChild(oneCard(it));
    wrap.appendChild(frag);
  }

  // ===== 小物 =====
  function fmtDate(v){
    if (!v) return '';
    try{
      const d = new Date(v);
      const y = d.getFullYear(), m = (d.getMonth()+1).toString().padStart(2,'0'), da = d.getDate().toString().padStart(2,'0');
      return `${y}/${m}/${da}`;
    }catch(_){ return ''; }
  }
  function escapeHtml(s){
    return String(s||'')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ===== イベント配線 =====
  // ===== イベント配線 =====
  function wireCardEvents(root){
    root.addEventListener('click', (e) => {
      const art = e.target.closest('.post-card');
      if (!art) return;

      // 詳細（開く／トグル）
      if (e.target.classList.contains('btn-detail')){
        const d = art.querySelector('.post-detail');
        if (d) d.hidden = !d.hidden;
      }

      // 詳細内の「閉じる」
      if (e.target.classList.contains('btn-detail-close')){
        const d = art.querySelector('.post-detail');
        if (d) d.hidden = true;
        art.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      // デッキコードをコピー
      if (e.target.classList.contains('btn-copy-code')){
        const code = e.target.dataset.code || art.dataset.code || '';
        if (!code) return;
        if (navigator.clipboard){
          navigator.clipboard.writeText(code).catch(()=>{});
        }
      }

      // 比較に追加（今はプレースホルダ）
      if (e.target.classList.contains('btn-add-compare')){
        // TODO: 比較タブとの連携を実装
        alert('比較タブに追加する機能は準備中です。');
      }

      // 旧仕様の ID コピー（ボタン自体は今は出していないが、互換として残す）
      if (e.target.classList.contains('btn-copyid')){
        const id = art.dataset.postid || '';
        if (id && navigator.clipboard){
          navigator.clipboard.writeText(id).catch(()=>{});
        }
      }
    });
  }


  // ===== 初期化 =====
  async function init(){
    // トークン
    state.token = resolveToken();

    // 一覧 初回
    await loadMoreList();

    // もっと見る
    document.getElementById('btnLoadMore')?.addEventListener('click', loadMoreList);

    // マイ投稿へ
    document.getElementById('btnOpenMine')?.addEventListener('click', async () => {
      showMine();
      if (state.mine.items.length === 0){
        await loadMoreMine(true);
      }
    });

    // マイ投稿：戻る／さらに読む
    document.getElementById('btnBackList')?.addEventListener('click', showList);
    document.getElementById('btnMineMore')?.addEventListener('click', () => loadMoreMine(false));

    // デリゲートイベント
    wireCardEvents(document);
  }

  async function loadMoreList(){
    if (state.list.loading) return;
    state.list.loading = true;
    try{
      const res = await apiList({ limit: 24, offset: state.list.nextOffset, mine: false });
      if (res?.ok){
        state.list.items.push(...res.items);
        state.list.nextOffset = (res.nextOffset ?? null);
        renderList(res.items, 'postList');
        // ボタン表示制御
        const btn = document.getElementById('btnLoadMore');
        if (btn) btn.disabled = (state.list.nextOffset === null);
      }
    }finally{
      state.list.loading = false;
    }
  }

  async function loadMoreMine(reset){
    if (state.mine.loading) return;
    state.mine.loading = true;
    try{
      const offset = reset ? 0 : (state.mine.nextOffset || 0);
      const res = await apiList({ limit: 24, offset, mine: true });
      const info = document.getElementById('mineInfo');
      if (res?.ok){
        if (reset){
          state.mine.items = [];
          state.mine.nextOffset = 0;
          document.getElementById('mineList')?.replaceChildren();
        }
        state.mine.items.push(...res.items);
        state.mine.nextOffset = (res.nextOffset ?? null);
        renderList(res.items, 'mineList');

        // 文言
        if (info){
          if (res.total === 0) info.textContent = 'まだ投稿はありません。デッキメーカーから投稿してみましょう。';
          else info.textContent = `あなたの投稿：${res.total}件`;
        }

        // ボタン制御
        const btn = document.getElementById('btnMineMore');
        if (btn) btn.disabled = (state.mine.nextOffset === null);
      } else {
        if (info) info.textContent = 'ログインが必要です。デッキメーカーのログイン欄からサインインしてください。';
      }
    }finally{
      state.mine.loading = false;
    }
  }

  // DOMReady
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();


// デッキ投稿 API のエンドポイント（GAS 側の Web アプリ URL）
const GAS_POST_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxFj5HABSLGJaghas5MR56k-pW1QIef2kw_Z_wXvcQ-Nzq0_VMkxAW76GwKuOojK50/exec';

// ① 生 API のレスポンスを確認
(async () => {
  const url = GAS_POST_ENDPOINT + '?mode=list&limit=3';
  const res = await fetch(url);
  const json = await res.json();
  console.log(json);                // 全体確認
  console.log(json.items?.[0]);     // 1件目
})();
