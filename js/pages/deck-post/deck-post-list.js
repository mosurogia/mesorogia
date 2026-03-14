/* ==================================================
   投稿フィルター：タグ候補UI（統合版）
   - buildPostFilterTagUI_ / getAllPostTagsFromState_ / classifyTag_ / sortTags_ / renderTagButtons_
   - キャンペーンタグ：開催中の「今回タグ」だけ候補に含める
================================================== */

// =========================
// キャンペーンタグ判定
// =========================
function isCampaignTag_(t){
  try{
    const set = window.__campaignTagSet;
    if (!(set instanceof Set)) return false;
    return set.has(String(t||'').trim());
  }catch(_){
    return false;
  }
}

function allowCampaignTag_(t){
  const running = !!window.__isCampaignRunning;
  const active  = String(window.__activeCampaignTag || '').trim();
  if (!running || !active) return false;
  return String(t||'').trim() === active;
}

// ★ 表示制御：今は空だけ弾く（キャンペーンでも非表示にしない）
function shouldShowTag_(tag){
  const t = String(tag || '').trim();
  return !!t;
}

// =========================
// タグ候補の収集（state → Set → Array）
// =========================
function getAllPostTagsFromState_(){
  const items =
    (window.__DeckPostState?.list?.allItems) ||
    (window.__DeckPostState?.list?.filteredItems) ||
    [];

  const set = new Set();

  // 投稿の tagsAuto / tagsPick から収集
  (items || []).forEach(it => {
    const all = [it?.tagsAuto, it?.tagsPick].filter(Boolean).join(',');
    if (!all) return;

    all.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(t => {
        // ✅ キャンペーンタグは「開催中の今回タグ」以外は候補に入れない
        if (isCampaignTag_(t) && !allowCampaignTag_(t)) return;
        set.add(t);
      });
  });

  // よく使う候補は常に出す（ただしキャンペーンは例外）
  (window.POST_TAG_CANDIDATES || []).forEach(t => {
    if (isCampaignTag_(t) && !allowCampaignTag_(t)) return;
    set.add(t);
  });
  (window.RACE_ORDER || []).forEach(t => set.add(t));
  (window.CATEGORY_LIST || []).forEach(t => set.add(t));

  // キャンペーンタグ（開催中の今回分だけ）を候補に含める
  try{
    const active = String(window.__activeCampaignTag || '').trim();
    if (active && allowCampaignTag_(active)) set.add(active);
  }catch(_){}

  return Array.from(set);
}

// =========================
// 分類 / ソート
// =========================
function classifyTag_(t){
  const s = String(t||'').trim();
  if (!s) return 'other';

  // 種族
  if ((window.RACE_ORDER || []).includes(s)) return 'race';

  // カテゴリ（テーマ）
  const isCat = (typeof window.getCategoryOrder === 'function')
    ? (window.getCategoryOrder(s) < 9999)
    : ((window.CATEGORY_LIST || []).includes(s));
  if (isCat) return 'category';

  // それ以外はデッキ情報
  return 'deckinfo';
}

function sortTags_(tags, kind){
  const arr = (tags || []).map(s=>String(s||'').trim()).filter(Boolean);

  if (kind === 'race'){
    const order = window.RACE_ORDER || [];
    return arr.sort((a,b)=>order.indexOf(a) - order.indexOf(b));
  }

  if (kind === 'category'){
    if (typeof window.getCategoryOrder === 'function'){
      return arr.sort((a,b)=>window.getCategoryOrder(a)-window.getCategoryOrder(b));
    }
    const order = window.CATEGORY_LIST || [];
    return arr.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  }

  // deckinfo: POST_TAG_CANDIDATES 優先 → 残りはあいうえお順
  const cand = window.POST_TAG_CANDIDATES || [];
  const candSet = new Set(cand);

  const head = cand.filter(t=>arr.includes(t));
  const tail = arr.filter(t=>!candSet.has(t)).sort((a,b)=>a.localeCompare(b,'ja'));

  // キャンペーンタグは最後へ寄せる（候補には active のみ入ってる想定だが念のため）
  const isCamp = (t)=>{
    const set = window.__campaignTagSet;
    return (set instanceof Set) && set.size && set.has(t);
  };
  const tailNormal = tail.filter(t=>!isCamp(t));
  const tailCamp   = tail.filter(t=> isCamp(t));

  // 重複除去しつつ結合
  const out = [];
  for (const t of [...head, ...tailNormal, ...tailCamp]){
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

// =========================
// モーダル内：ボタン描画（draftを見る）
// =========================
function renderTagButtons_(rootEl, tags){
  if (!rootEl) return;
  rootEl.replaceChildren();

  const sel = window.PostFilterDraft?.selectedTags;

  (tags || []).forEach(tag => {
    const t = String(tag||'').trim();
    if (!t) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-btn post-filter-tag-btn';
    btn.dataset.tag = t;

    // ✅ 枠線リング（種族 / カテゴリ）
    const kind = classifyTag_(t);
    if (kind === 'race') {
      btn.classList.add('is-ring');
      btn.dataset.race = t; // data-race="ドラゴン" など
    } else if (kind === 'category') {
      btn.classList.add('is-ring');
      const r = (typeof window.getCategoryRace === 'function')
        ? window.getCategoryRace(t)
        : null;
      btn.dataset.catRace = r || 'none'; // data-cat-race="ドラゴン" 等
    }

    // キャンペーンタグは専用クラス（存在する実装があれば使う）
    try{
      const ccls = (typeof campaignTagClass_ === 'function') ? campaignTagClass_(t) : '';
      if (ccls) btn.classList.add(...ccls.split(/\s+/).filter(Boolean));
    }catch(_){}

    // カテゴリ改行（（ の前で改行）
    if (kind === 'category' && t.includes('（')) {
      btn.innerHTML = t.replace('（', '<br>（');
    } else {
      btn.textContent = t;
    }

    // 選択状態（CSSは .selected）
    if (sel?.has(t)) btn.classList.add('selected');

    btn.addEventListener('click', ()=>{
      const draft = window.PostFilterDraft;
      draft.selectedTags ??= new Set();

      if (draft.selectedTags.has(t)){
        draft.selectedTags.delete(t);
        btn.classList.remove('selected');
      }else{
        draft.selectedTags.add(t);
        btn.classList.add('selected');
      }
    });

    rootEl.appendChild(btn);
  });
}

// =========================
// モーダル内：タグエリア全構築（state→分類→描画）
// =========================
function buildPostFilterTagUI_(){
  const all = getAllPostTagsFromState_();
  const deckinfo = [];
  const race = [];
  const category = [];

  all.forEach(t => {
    // ★ キャンペーンタグ表示制御をフィルター候補にも適用
    if (!shouldShowTag_(t)) return;

    const k = classifyTag_(t);
    if (k === 'race') race.push(t);
    else if (k === 'category') category.push(t);
    else if (k === 'deckinfo') deckinfo.push(t);
  });

  // v2 期待：3エリア
  const deckEl = document.getElementById('postFilterDeckInfoArea');
  const raceEl = document.getElementById('postFilterRaceArea');
  const catEl  = document.getElementById('postFilterCategoryArea');

  renderTagButtons_(deckEl, sortTags_(deckinfo, 'deckinfo'));
  renderTagButtons_(raceEl, sortTags_(race, 'race'));
  renderTagButtons_(catEl,  sortTags_(category, 'category'));
}

// =========================
// ユーザータグ：頻度インデックス（Map<tag,count>）
// =========================
function buildUserTagIndex_(){
  const items = window.__DeckPostState?.list?.allItems || [];
  const freq = new Map();

  for (const it of items){
    const raw = String(it?.tagsUser || '').trim();
    if (!raw) continue;

    const arr = raw.split(',').map(s=>s.trim()).filter(Boolean);
    for (const t of arr){
      freq.set(t, (freq.get(t) || 0) + 1);
    }
  }
  return freq;
}