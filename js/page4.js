/* =========================
   DeckPosts 一覧ページ制御（新規）
   - 全体一覧（ページネーション）
   - マイ投稿（全画面・ログイン必須）
========================= */
const DeckPostApp = (() => {
  const GAS_BASE = window.DECKPOST_API_BASE || 'https://script.google.com/macros/s/AKfycbxvrzefFMwi7H1EYiOLuhtakG64VCiKivIP4ZiRN0HWX3syVVmv01KWhgU6esq8SWGz/exec';

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

// ===== 詳細用：カード解説（cardNotes） =====
function buildCardNotesHtml(item){
  const srcList = Array.isArray(item.cardNotes) ? item.cardNotes : [];
  const list = srcList
    .map(r => ({ cd: String(r.cd || ''), text: String(r.text || '') }))
    .filter(r => r.cd || r.text);

  if (!list.length){
    return `<div class="post-cardnotes-empty">投稿者によるカード解説はまだ登録されていません。</div>`;
  }

  const cardMap = window.cardMap || {};

  const rows = list.map(r => {
    const cdRaw = String(r.cd || '').trim();
    const cd5   = cdRaw.padStart(5, '0');   // ★ 必須：5桁化
    const card  = cardMap[cd5] || {};
    const name  = card.name || 'カード名未登録';
    const img   = `img/${cd5}.webp`;

    const textHtml = escapeHtml(r.text || '').replace(/\n/g, '<br>');

    return `
      <div class="post-cardnote">
        <div class="post-cardnote-thumb">
          <img src="${img}"
               alt="${escapeHtml(name)}"
               loading="lazy"
               onerror="this.onerror=null;this.src='img/00000.webp';">
        </div>
        <div class="post-cardnote-body">
          <div class="post-cardnote-title">${escapeHtml(name)}</div>
          <div class="post-cardnote-text">${textHtml}</div>
        </div>
      </div>
    `;
  }).join('');

  return `<div class="post-cardnotes">${rows}</div>`;
}


// ===== 1枚カードレンダリング（PC用） =====
function buildCardPc(item){
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
  const cardNotesHtml = buildCardNotesHtml(item);

  const posterXRaw   = (item.posterX || '').trim();
  const posterXLabel = posterXRaw;
  const posterXUser  = posterXRaw.startsWith('@') ? posterXRaw.slice(1) : posterXRaw;


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
                ${posterXUser ? `
                  　/　<a class="meta-x"
                          href="https://x.com/${encodeURIComponent(posterXUser)}"
                          target="_blank"
                          rel="noopener noreferrer">
                        ${escapeHtml(posterXLabel)}
                      </a>
                ` : ''}
                ${fmtDate(time) ? '　/　' + fmtDate(time) : ''}
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
          <div class="post-detail-body post-detail-body--notes">
            ${cardNotesHtml}
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
  const cardNotesHtml = buildCardNotesHtml(item);

  const posterXRaw   = (item.posterX || '').trim();
  const posterXLabel = posterXRaw;
  const posterXUser  = posterXRaw.startsWith('@') ? posterXRaw.slice(1) : posterXRaw;

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
            <div class="sp-meta-name">
              ${escapeHtml(item.posterName || item.username || '')}
            </div>

            ${posterXUser ? `
              <a class="sp-meta-x"
                href="https://x.com/${encodeURIComponent(posterXUser)}"
                target="_blank"
                rel="noopener noreferrer">
                ${escapeHtml(posterXLabel)}
              </a>
            ` : ''}

            <div class="sp-meta-date">
              ${fmtDate(time)}
            </div>
          </div>

          <button class="fav-btn sp-fav" type="button" aria-label="お気に入り">☆</button>
        </div>
      </div> <!-- ← ★ sp-head-right の閉じタグ、sp-head の閉じタグ -->

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
          <div class="post-detail-body post-detail-body--notes">
            ${cardNotesHtml}
          </div>
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

    // 指定 postId の投稿オブジェクトを state から探す
  function findPostItemById(postId){
    const id = String(postId);
    const pick = (arr) => (arr || []).find(it => String(it.postId) === id);
    return pick(state.list.items) || pick(state.mine.items) || null;
  }

  // スマホ版：代表カード長押しでデッキリスト簡易表示
  // スマホ版：代表カード長押しでデッキリスト簡易表示
  function setupDeckPeekOnSp(){
    const isSp = () => window.matchMedia('(max-width: 768px)').matches;

    function ensureOverlay(){
      let pane = document.getElementById('post-deckpeek-overlay');
      if (!pane){
        pane = document.createElement('div');
        pane.id = 'post-deckpeek-overlay';
        pane.innerHTML = `
          <div class="post-deckpeek-inner">
            <div class="post-deckpeek-body"></div>
          </div>
        `;
        document.body.appendChild(pane);
      }
      return pane;
    }

    function hideOverlay(){
      const pane = document.getElementById('post-deckpeek-overlay');
      if (pane){
        pane.style.display = 'none';
      }
    }

    // ★ 代表カードの「右横」に出すように座標計算
    function showForArticle(art, thumbEl){
      if (!isSp()) return;
      if (!art) return;

      const postId = art.dataset.postid;
      if (!postId) return;

      const item = findPostItemById(postId);
      if (!item) return;

      const html = buildDeckListHtml(item);

      const pane  = ensureOverlay();
      const body  = pane.querySelector('.post-deckpeek-body');
      if (!body) return;

      body.innerHTML = html;

      // 一旦表示してサイズを取る
      pane.style.display = 'block';
      pane.style.width   = '';     // 一度リセット
      pane.style.right   = 'auto';
      pane.style.bottom  = 'auto';

      // 幅は画面の 70% までにして、代表カード横に収まるように
      const maxW = Math.min(window.innerWidth * 0.7, 460);
      pane.style.width = maxW + 'px';

      if (thumbEl){
        const r = thumbEl.getBoundingClientRect();
        const margin = 8;

        const paneW = pane.offsetWidth;
        const paneH = pane.offsetHeight;

        // 基本位置：代表カードの右横
        let left = r.right + margin;
        let top  = r.top;

        // 右にはみ出す場合は左にずらす
        if (left + paneW > window.innerWidth - margin){
          left = window.innerWidth - margin - paneW;
          if (left < margin) left = margin;
        }

        // 下にはみ出す場合は上にずらす
        if (top + paneH > window.innerHeight - margin){
          top = window.innerHeight - margin - paneH;
          if (top < margin) top = margin;
        }

        pane.style.left = left + 'px';
        pane.style.top  = top  + 'px';
      }
    }

    const root = document.getElementById('postList');
    if (!root) return;

    let pressing = false;

    const startHandler = (e) => {
      if (!isSp()) return;

      // 代表カード部分（thumb-box）だけ反応させる
      const thumb = e.target.closest('.thumb-box');
      if (!thumb) return;

      const art = thumb.closest('.post-card.post-card--sp');
      if (!art) return;

      pressing = true;
      showForArticle(art, thumb);
    };

    const endHandler = () => {
      if (!pressing) return;
      pressing = false;
      hideOverlay();
    };

    // PointerEvent 優先
    if (window.PointerEvent){
      root.addEventListener('pointerdown', startHandler);
      window.addEventListener('pointerup', endHandler);
      window.addEventListener('pointercancel', endHandler);
    } else {
      // 古い環境向けフォールバック
      root.addEventListener('touchstart', startHandler, { passive: true });
      window.addEventListener('touchend', endHandler);
      window.addEventListener('touchcancel', endHandler);
    }

    // スクロールや画面タップでも閉じる
    window.addEventListener('scroll', hideOverlay, { passive: true });
    document.addEventListener('click', (e) => {
      const pane = document.getElementById('post-deckpeek-overlay');
      if (!pane || pane.style.display === 'none') return;
      if (e.target.closest('#post-deckpeek-overlay')) return; // オーバーレイ内クリックは無視
      hideOverlay();
    });
  }



// ===== 初期化 =====
async function init(){
  // ① カードマスタ読み込み（デッキリスト・カード解説で使う）
  try {
    await ensureCardMapLoaded();
    console.log('cardMap loaded, size =', Object.keys(window.cardMap || {}).length);
  } catch (e) {
    console.error('カードマスタ読み込みに失敗しました', e);
  }

  // ② トークン
  state.token = resolveToken();

  // ③ 一覧 初回
  await loadMoreList();

  // ④ もっと見る
  document.getElementById('btnLoadMore')?.addEventListener('click', loadMoreList);

  // ⑤ マイ投稿へ
  document.getElementById('btnOpenMine')?.addEventListener('click', async () => {
    showMine();
    if (state.mine.items.length === 0){
      await loadMoreMine(true);
    }
  });

  // ⑥ マイ投稿：戻る／さらに読む
  document.getElementById('btnBackList')?.addEventListener('click', showList);
  document.getElementById('btnMineMore')?.addEventListener('click', () => loadMoreMine(false));

  // ⑦ デリゲートイベント
  wireCardEvents(document);
  // スマホ版：代表カード長押しでデッキリスト簡易表示
  setupDeckPeekOnSp();
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
const GAS_POST_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxvrzefFMwi7H1EYiOLuhtakG64VCiKivIP4ZiRN0HWX3syVVmv01KWhgU6esq8SWGz/exec';

// ① 生 API のレスポンスを確認
(async () => {
  const url = GAS_POST_ENDPOINT + '?mode=list&limit=3';
  const res = await fetch(url);
  const json = await res.json();
  console.log(json);                // 全体確認
  console.log(json.items?.[0]);     // 1件目
})();
