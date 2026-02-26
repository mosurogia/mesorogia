/*======================================================
  1) 冒頭：定数・初期設定・起動処理
======================================================*/
//#region 1. 初期設定・定数定義（DOMContentLoaded など）

// GAS設定（共通定義を利用）
const GAS_POST_ENDPOINT =window.DECKPOST_API_BASE || window.GAS_API_BASE;

// ローカル判定
const IS_LOCAL = location.hostname === '127.0.0.1' || location.hostname === 'localhost';




// 投稿者名バリデーション
function looksLikeEmail_(s){
  const t = String(s || '').trim();
  if (!t) return false;
  // メールっぽい（ゆるめ）
  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  return re.test(t);
}

function validatePosterNameOrThrow_(name){
  const t = String(name || '').trim();

  // まず @ を禁止（メール/連絡先混入を強く抑止）
  if (/[＠@]/.test(t) || looksLikeEmail_(t)) {
    throw new Error('投稿者名にメールアドレス（または@）は入れられません。表示名だけにしてください。');
  }
  // ついでに連絡先っぽいのを軽く抑止（任意）
  if (/https?:\/\//i.test(t)) {
    throw new Error('投稿者名にURLは入れられません。表示名だけにしてください。');
  }

  return t;


}


// === デッキ名 入出力（情報タブ/投稿タブ 共通）===
// グローバル公開してどこからでも使えるようにする
window.readDeckNameInput = function () {
  const info = $id('info-deck-name')?.value?.trim() || '';
  const post = $id('post-deck-name')?.value?.trim() || '';
  return post || info || '';
};

window.writeDeckNameInput = function (name) {
  const v = name || '';
  const info = $id('info-deck-name');
  const post = $id('post-deck-name');
  if (info) info.value = v;
  if (post) post.value = v;
};

// 念のため：同期関数が未定義なら軽量版を用意
if (typeof window.syncDeckNameFields !== 'function') {
  window.syncDeckNameFields = function () {
    // 今は write で双方に入れているので実質 no-op
  };
}

//#endregion



/*======================================================
  2) カードデータ生成・一覧表示
======================================================*/
//#region 2. カードデータ生成・一覧表示

/**
 * カード操作モーダルの効果リストを構築
 * - info はカード情報オブジェクト（cardMap[cd] の形式を想定）
 */
function buildCardOpEffects(info) {
  const wrap = document.getElementById('cardOpEffects');
  if (!wrap) return;
  wrap.innerHTML = '';

  let items = [];

  // 1) 統一形式（{name,text}[]）
  if (Array.isArray(info.effects)) {
    items = info.effects.map(e =>
      (typeof e === 'string')
        ? { name: '効果', text: e }
        : { name: e.name || '効果', text: e.text || '' }
    );

  // 2) 旧形式（effectNames/effectTexts）
  } else if (Array.isArray(info.effectNames) || Array.isArray(info.effectTexts)) {
    const names = info.effectNames || [];
    const texts = info.effectTexts || [];
    const len = Math.max(names.length, texts.length);
    for (let i = 0; i < len; i++) items.push({ name: names[i] || '効果', text: texts[i] || '' });

  // 3) cards_latest 系（effect_name1/effect_text1...）←★追加
  } else {
    const n1 = info.effect_name1 ?? info.effectName1 ?? '';
    const t1 = info.effect_text1 ?? info.effectText1 ?? '';
    const n2 = info.effect_name2 ?? info.effectName2 ?? '';
    const t2 = info.effect_text2 ?? info.effectText2 ?? '';
    if (n1 || t1) items.push({ name: n1 || '効果', text: t1 || '' });
    if (n2 || t2) items.push({ name: n2 || '効果', text: t2 || '' });
  }

  // 4) 最終フォールバック（effect/text）
  if (items.length === 0 && (info.effect || info.text)) {
    items = [{ name: info.effect || '効果', text: info.text || '' }];
  }

  if (items.length === 0) {
    const d = document.createElement('div');
    d.className = 'eff';
    d.innerHTML = '<div class="eff-name">効果</div><div class="eff-text">（効果情報なし）</div>';
    wrap.appendChild(d);
    return;
  }

  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'eff';
    d.innerHTML =
      `<div class="eff-name">${escapeHtml_(it.name || '効果')}</div>` +
      `<div class="eff-text">${escapeHtml_(it.text || '')}</div>`;
    wrap.appendChild(d);
  }
}



/*======================================================
  スクショ画像：最小パネル（スマホのみ）
  ✅ 画像選択 → 別モーダルでトリミング調整（ドラッグ）→ 決定後にパネルへ反映
  - object-fit: contain の表示領域を考慮して、ドラッグ位置と実際の切り抜きがズレないように補正
======================================================*/
// 起動処理のどこか（DOMContentLoaded内が安全）
window.addEventListener('DOMContentLoaded', () => {
  // deckmaker用として初期化
  window.initScreenshotPanel?.({ keyPrefix: 'deckmaker' });
});
//#endregion



/* ===== デッキバー操作（右クリックメニュー抑制） ===== */
//#region deckbar
document.addEventListener("contextmenu", e => {
  const deckBarTop = document.getElementById("deckBarTop");
  if (deckBarTop && deckBarTop.contains(e.target)) e.preventDefault();
});
//#endregion deckbar


/* ===== 分析＆投稿タブ → デッキ投稿 まで一気に移動 ===== */
//#region goToAnalyze
function goToAnalyzeTab() {
  // まず上段タブを「💾 分析＆投稿（edit）」に切り替え
  const tab2 = document.querySelector('#tab2');
  if (tab2 && typeof switchTab === 'function') {
    switchTab('edit', tab2);
  }

  // 次に、分析＆投稿内のサブタブを「デッキ投稿」に切り替え
  // （ボタンに class="post-tab-bar" を付けておく前提）
  const postTabBtn =
    document.querySelector('#deck-info .post-tab-bar') ||
    document.querySelector('#deck-info [onclick*="post-tab"]');

  if (postTabBtn && typeof switchTab === 'function') {
    switchTab('post-tab', postTabBtn);
  }

  // デッキリスト・分析・交換サマリーを更新
  if (typeof renderDeckList === 'function') renderDeckList();
  if (typeof updateDeckAnalysis === 'function') updateDeckAnalysis();
  if (typeof updateExchangeSummary === 'function') updateExchangeSummary();
}
window.goToAnalyzeTab = goToAnalyzeTab;
//#endregion goToAnalyze



/* ===== デッキ情報開閉（ボタン表記同期） ===== */
//#region deckSummary
/*


document.addEventListener('DOMContentLoaded', () => {
  const deckSummary = document.getElementById('deck-summary');
  const toggleBtn = document.querySelector('.deck-summary-toggle');
  if (!deckSummary || !toggleBtn) return;

  deckSummary.classList.add('open');
  toggleBtn.textContent = '▶';
  toggleBtn.removeAttribute('onclick'); // inline重複防止
  toggleBtn.addEventListener('click', toggleDeckSummary);
});
*/

//#endregion deckSummary

//#endregion 3. フィルター・検索・メニューバー



/*======================================================
  4) デッキ構築（追加・削除・オートセーブ）
======================================================*/
//#region 4. デッキ構築処理

// === オートセーブ（ローカル保存） ===
const DeckAutosave = (() => { // オートセーブ機能の名前空間
  const AUTOSAVE_KEY = 'deck_autosave_v1';
  let __autosaveDirty = false;          // 初期はクリーン
  let __autosaveJustLoaded = true;      // ロード直後ガード

  window.addEventListener('load', () => {
  // 初期描画やオートフィルが落ち着くまで保存抑止（必要なら 2000〜5000ms で調整）
  setTimeout(() => { __autosaveJustLoaded = false; }, 3000);
  });

  let __autosaveTimer = 0;

  function isDeckEmpty() {// デッキが空か判定
    return !deck || Object.keys(deck).length === 0;
  }

  // 保存用ペイロード生成
  function buildAutosavePayload(){
    const payload = {
      cardCounts: { ...deck },
      m: representativeCd || null,
      name: readDeckNameInput(),
      note: readPostNote(),   // デッキ解説（本文）
      poster: $id('poster-name')?.value?.trim() || '',
      // 貼り付けコード（有効なら保存）
      shareCode: ($id('post-share-code')?.value?.trim() || ''),
      date: window.formatYmd()
    };

    // --- ユーザータグ ---
    try{
      if (typeof readUserTags === 'function'){
        const tags = readUserTags();
        if (Array.isArray(tags)) payload.userTags = tags;
      }
    }catch(_){}

  // --- 選択タグ（select-tags） ---
  // ※ サイト共通の保持先（localStorage: dm_post_select_tags_v1）を正として取得する
  try{
    if (typeof window.readSelectedTags === 'function'){
      // readSelectedTags() は Set を返す実装なので Array に直す
      payload.selectTags = Array.from(window.readSelectedTags());
    } else if (typeof __fallbackReadSelectTags === 'function'){
      payload.selectTags = __fallbackReadSelectTags();
    }
  }catch(_){}

    // --- カード解説（post-card-notes） ---
    // 取得元の都合で '[]' といった文字列が来る場合があるので空扱い/配列化を統一
    try {
      let notes = null;
      if (typeof readCardNotes === 'function') {
        notes = readCardNotes();
      } else if (typeof __fallbackReadCardNotes === 'function') {
        notes = __fallbackReadCardNotes();
      }

      if (Array.isArray(notes)) {
        payload.cardNotes = notes;
      } else if (typeof notes === 'string') {
        const s = notes.trim();
        if (!s || s === '[]') {
          payload.cardNotes = [];
        } else {
          try {
            const parsed = JSON.parse(s);
            payload.cardNotes = Array.isArray(parsed) ? parsed : [];
          } catch {
            // テキスト1本だけが入っていた場合などは非配列→空扱い
            payload.cardNotes = [];
          }
        }
      } else {
        payload.cardNotes = [];
      }
    } catch(_) {
      payload.cardNotes = [];
    }

    return payload;
  }

// ===============================
// ★ GAS: 他ユーザーの userTags 候補取得 API
// ===============================
async function fetchUserTagCandidatesFromGAS(keyword = '') {
  const base = window.DECKPOST_API_BASE || window.GAS_API_BASE;
  if (!base) return [];
  try {
    const base = window.DECKPOST_API_BASE || window.GAS_API_BASE;
    const params = new URLSearchParams({
      mode: 'userTags',
      q: keyword,
      limit: 20
    });

    const res = await fetch(`${base}?${params.toString()}`, { method: 'GET' });
    const json = await res.json();
    if (!json || !json.ok) return [];
    return json.tags || [];  // [{tag, count}]
  } catch (e) {
    console.warn('userTags 候補取得に失敗', e);
    return [];
  }
}

// ===============================
// ★ 候補ボックスを再描画する
// ===============================
function renderUserTagSuggestions(localHistory, gasList, usedTags) {
  const box = document.getElementById('user-tag-suggest-box');
  if (!box) return;

  box.innerHTML = '';

  const merged = [];

  // 1. ローカル履歴（あなたが以前使ったタグ）
  localHistory.forEach(t => {
    if (!usedTags.has(t)) {
      merged.push({ tag: t, type: 'recent' });
    }
  });

  // 2. GAS 候補（他ユーザーの人気タグ）
  gasList.forEach(obj => {
    const t = obj.tag;
    if (!usedTags.has(t) && !merged.some(m => m.tag === t)) {
      merged.push({ tag: t, type: 'gas', count: obj.count });
    }
  });

  // ★ 表示する候補は最大5件まで
  const MAX_SUGGEST = 5;
  const list = merged.slice(0, MAX_SUGGEST);

  if (list.length === 0) {
    box.style.display = 'none';
    return;
  }

  // 見出し
  const head = document.createElement('div');
  head.className = 'user-tag-suggest-head';
  // 「最大3個」は“持てるユーザータグ数”なので文言はそのまま
  head.textContent = '候補（クリックで追加・最大3個まで）';
  box.appendChild(head);

  // リスト本体
  list.forEach(obj => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'user-tag-suggest-item';

    const label = document.createElement('span');
    label.className = 'user-tag-suggest-label';
    label.textContent = obj.tag;

    const meta = document.createElement('span');
    meta.className = 'user-tag-suggest-meta';
    meta.textContent =
      obj.type === 'recent'
        ? '最近使ったタグ'
        : (obj.count ? `使用回数 ${obj.count}` : 'みんなのタグ');

    row.appendChild(label);
    row.appendChild(meta);

    row.addEventListener('click', () => {
      const now = readUserTags();
      if (now.length >= 3) return;
      if (now.includes(obj.tag)) return;

      now.push(obj.tag);
      writeUserTags(now);

      if (typeof window.onUserTagAdded === 'function') {
        window.onUserTagAdded(obj.tag);
      }

      const inputEl = document.getElementById('user-tag-input');
      if (inputEl) inputEl.value = '';

      box.style.display = 'none';
      scheduleAutosave?.();
    });

    box.appendChild(row);
  });

  box.style.display = 'block';
}



// ===============================
// ★ 候補ボタンの挙動
// ===============================
async function onUserTagSuggestClicked() {
  const box   = document.getElementById('user-tag-suggest-box');
  const input = document.getElementById('user-tag-input');
  if (!box) return;

  const keyword = (input?.value || '').trim();

  // すでに開いていて、今ロード中でなければ閉じる
  if (box.style.display === 'block' && box.dataset.loading !== '1') {
    box.style.display = 'none';
    return;
  }

  // --- ローディング表示 ---
  box.dataset.loading = '1';
  box.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'user-tag-suggest-loading';
  loading.textContent = '候補を検索中…';
  box.appendChild(loading);
  box.style.display = 'block';

  try {
    // --- ローカル履歴 ---
    const localHistory = typeof getUserTagHistory === 'function'
      ? getUserTagHistory()
      : [];

    // --- GAS から取得 ---
    const gasList = await fetchUserTagCandidatesFromGAS(keyword);

    // --- 既に使っているタグを除外 ---
    const used = new Set(readUserTags());

    // ローディングフラグ解除して描画
    delete box.dataset.loading;
    renderUserTagSuggestions(localHistory, gasList, used);
  } catch (e) {
    console.warn(e);
    delete box.dataset.loading;
    box.innerHTML = '<div class="user-tag-suggest-loading">候補を取得できませんでした</div>';
  }
}


// ===============================
// ★ DOMContentLoaded で候補ボタンにイベントをつける
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('user-tag-suggest');
  if (btn) {
    btn.addEventListener('click', onUserTagSuggestClicked);
  }

  // 入力中でも候補を更新（リアルタイム検索）
  const input = document.getElementById('user-tag-input');
  if (input) {
    input.addEventListener('input', () => {
      const box = document.getElementById('user-tag-suggest-box');
      if (box.style.display === 'block') {
        // 候補が開いているときは随時更新
        onUserTagSuggestClicked();
      }
    });
  }
});


// ==== ユーザータグ：入力・追加のみ（候補は別ハンドラで制御） ====
(function bindUserTagUIOnce(){
  if (window.__bindUserTagUIOnce) return;
  window.__bindUserTagUIOnce = true;

  window.addEventListener('DOMContentLoaded', () => {
    const box    = document.getElementById('user-tags');
    const input  = document.getElementById('user-tag-input');
    const addBtn = document.getElementById('user-tag-add');
    if (!box || !input || !addBtn) return;

    const addTag = (raw) => {
      const v = (raw != null ? String(raw) : input.value).trim();
      if (!v) return;

      const now = new Set(readUserTags());
      if (now.has(v)) {
        input.value = '';
        return;
      }

      now.add(v);
      writeUserTags(Array.from(now));
      if (typeof window.onUserTagAdded === 'function') {
        window.onUserTagAdded(v);
      }

      input.value = '';
      scheduleAutosave?.();
    };

    addBtn.addEventListener('click', () => addTag());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag();
      }
    });
  });
})();




// 変更点：実質「空」のペイロードか判定
function isTrulyEmpty(payload){
  if (!payload || typeof payload !== 'object') return true;

  // デッキが空？
  const cc = payload.cardCounts || {};
  const deckEmpty = !cc || Object.keys(cc).length === 0;

  // 補助: 文字列ベースの "空" 判定（'[]', '{}' も空扱い）
  function _isBlankLike(v) {
    const s = String(v ?? '').trim();
    if (!s) return true;
    if (s === '[]' || s === '{}') return true;
    return false;
  }

  // 代表カード・デッキ名・本文・ポスター名・カード解説・選択/ユーザータグが空？
  const noName   = _isBlankLike(payload.name);
  const noNote   = _isBlankLike(payload.note);
  const noPoster = _isBlankLike(payload.poster);
  const noM      = !payload.m;

  // cardNotes が配列以外（例: '[]' 文字列）の時は空扱いに補正
  let noCardNotes = true;
  if (Array.isArray(payload.cardNotes)) {
    noCardNotes = payload.cardNotes.length === 0;
  } else {
    noCardNotes = _isBlankLike(payload.cardNotes);
  }

  // 選択タグ/ユーザータグ
  const noSelTags  = !(Array.isArray(payload.selectTags) && payload.selectTags.length);
  const noUserTags = !(Array.isArray(payload.userTags)  && payload.userTags.length);

  return deckEmpty && noName && noNote && noPoster && noM && noCardNotes && noSelTags && noUserTags;

}

  //即時保存（空→非空の既存データを潰さない）
  function saveAutosaveNow() {
    try {
      const next = buildAutosavePayload();

// --- 保存条件チェック（変更なしなら上書きしない） ---
const prevRaw = localStorage.getItem(AUTOSAVE_KEY);
let prev = null;
if (prevRaw) {
  try { prev = JSON.parse(prevRaw); } catch(_) {}
}

// 初回ロード直後やユーザー操作なし → 保存しない
if (!__autosaveDirty) return;

// 生成データが空かつ既存が非空 → 上書き抑止
if (isTrulyEmpty(next) && prev && !isTrulyEmpty(prev)) return;

// 既存データと完全一致なら上書き不要（＝変更なし）
if (prev && JSON.stringify(prev) === JSON.stringify(next)) return;

// ここで初めて上書き
localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(next));

    } catch (e) {
      console.warn('autosave failed', e);
    }
  }



   // クリア
  function clearAutosave() {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
  }

  // 再読込時復元コード
  function loadAutosave(data){
    if (!data || !data.cardCounts) return;

    // デッキ入れ替え
    Object.keys(deck).forEach(k => delete deck[k]);
    Object.entries(data.cardCounts).forEach(([cd, n]) => { deck[cd] = n|0; });

    // 代表カード・デッキ名
    representativeCd = (data.m && deck[data.m]) ? data.m : null;
    writeDeckNameInput(data.name || '');

    // 解説ノート（本文）
    writePostNote(data.note || '');

  // 選択タグ（localStorage に書き込んでから UI を再描画）
  if (Array.isArray(data.selectTags)) {
    // まず DOM 上の選択状態を完全クリア
    const box = document.getElementById('select-tags');
    if (box){
      box.querySelectorAll('.chip').forEach(ch => {
        ch.setAttribute('aria-pressed', 'false');
        ch.classList.remove('selected','active','on');
      });
    }
    // 正規ストレージへ書き込み → 再描画（サイト共通APIがあればそれを使う）
    if (typeof window.writeSelectedTags === 'function') {
      window.writeSelectedTags(data.selectTags);
    } else if (typeof __fallbackWriteSelectTags === 'function') {
      __fallbackWriteSelectTags(data.selectTags);
    }
    // 再描画と装飾
    if (typeof window.renderPostSelectTags === 'function') window.renderPostSelectTags();
    if (typeof window.applySelectTagWrap === 'function')   window.applySelectTagWrap();
  }

  // ユーザータグ
  if (Array.isArray(data.userTags)) {
    if (typeof writeUserTags === 'function') writeUserTags(data.userTags);
  }

  // 貼り付けコード
  if (data.shareCode) {
    try {
      if (typeof window.writePastedDeckCode === 'function') {
        window.writePastedDeckCode(String(data.shareCode || ''));
      } else {
        const hid = document.getElementById('post-share-code');
        if (hid) hid.value = String(data.shareCode || '');
      }
    } catch(_) {}
  }

  // 投稿者名
  try {
    const nameEl = document.getElementById('poster-name');
    const restoredName = (typeof data.poster === 'string')
      ? data.poster
      : (data.poster?.name || '');
    if (nameEl && restoredName) {
      nameEl.value = restoredName; // 復元時は常に上書き
      try { localStorage.setItem('dm_poster_name', restoredName); } catch {}
    }
  } catch(_) {}

// カード解説（復元）
if (data.cardNotes) {
  CardNotes.replace(Array.isArray(data.cardNotes) ? data.cardNotes : []);
}


// ==== カード解説 ====
    // デッキ名（3タブ同期）
    if (typeof window.syncDeckNameFields === 'function') window.syncDeckNameFields();

    // UI更新（スクロール保持）
    withDeckBarScrollKept(() => {
      updateDeck();
      renderDeckList();
    });
    updateDeckSummaryDisplay();
    updateExchangeSummary();
  }




  // 復元トーストUI
  function showToast(message, opts={}){
    const toast = document.createElement('div');
    toast.id = 'restore-toast';

    const msgSpan = document.createElement('span');
    msgSpan.className = 'msg';
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (opts.action) {
      const btn = document.createElement('button');
      btn.textContent = opts.action.label;
      btn.onclick = () => { opts.action.onClick?.(); toast.remove(); };
      toast.appendChild(btn);
    }
    if (opts.secondary) {
      const btn2 = document.createElement('button');
      btn2.textContent = opts.secondary.label;
      btn2.onclick = () => { opts.secondary.onClick?.(); toast.remove(); };
      toast.appendChild(btn2);
    }

    document.body.appendChild(toast);
    setTimeout(()=>toast.remove(), 15000);
  }

  // 外部公開
  return {
    saveAutosaveNow,
    clearAutosave,
  };
})();

// ==== オートセーブのグローバル別名（後方互換） ====
window.scheduleAutosave  = DeckAutosave.scheduleAutosave;
window.clearAutosave     = DeckAutosave.clearAutosave;
window.saveAutosaveNow   = DeckAutosave.saveAutosaveNow;

/* ====== 選択タグ / カード解説 のフォールバック Reader/Writer ====== */

// 選択タグ（select-tags）フォールバック読取：.chip の data-key かテキストを収集
function __fallbackReadSelectTags(){
  const box = document.getElementById('select-tags');
  if (!box) return [];
  const chips = Array.from(box.querySelectorAll('.chip'));
  const onChips = chips.filter(ch =>
    ch.getAttribute('aria-pressed') === 'true' ||
    ch.classList.contains('selected') ||
    ch.classList.contains('active') ||
    ch.classList.contains('on')
  );
  return onChips.map(ch => ch.dataset.key?.trim() || ch.textContent.trim()).filter(Boolean);
}

// 選択タグフォールバック書込：一致する .chip をON状態に
function __fallbackWriteSelectTags(keys){
  const box = document.getElementById('select-tags');
  if (!box || !Array.isArray(keys)) return;
  const keyset = new Set(keys.map(k=>String(k).trim()));
  box.querySelectorAll('.chip').forEach(ch => {
    const id = ch.dataset.key?.trim() || ch.textContent.trim();
    const on = id && keyset.has(id);
    ch.setAttribute('aria-pressed', on ? 'true' : 'false');
    ch.classList.toggle('selected', on);
    ch.classList.toggle('active', on);
    ch.classList.toggle('on', on);
  });
}

// カード解説フォールバック読取：hidden にJSONがあればそれを使う
function __fallbackReadCardNotes(){
  const hid = document.getElementById('post-card-notes-hidden');
  if (hid && hid.value){
    try{
      const v = JSON.parse(hid.value);
      return v;
    }catch(_){
      return hid.value; // 生文字列でも保存しておく
    }
  }
  // DOMから拾う簡易版（クラスは実装に依存するため最小限）
  const wrap = document.getElementById('post-card-notes');
  if (!wrap) return [];
  const rows = Array.from(wrap.querySelectorAll('[data-cd]'));
  return rows.map(r => ({
    cd: r.dataset.cd,
    text: (r.querySelector('textarea')?.value || '').trim()
  })).filter(it => it.cd || it.text);
}

// カード解説フォールバック書込：hidden 優先、無ければ最低限の再描画
function __fallbackWriteCardNotes(val){
  const hid = document.getElementById('post-card-notes-hidden');
  // 文字列/配列をJSON化してhiddenに反映（既存の描画関数が拾う前提）
  try{
    if (hid){
      if (typeof val === 'string') hid.value = val;
      else hid.value = JSON.stringify(val);
    }
  }catch(_){}
}
// ==== カード解説の Reader/Writer（無ければ用意） ====
window.readCardNotes ??= function(){
  if (typeof __fallbackReadCardNotes === 'function') return __fallbackReadCardNotes();
  const hid = document.getElementById('post-card-notes-hidden');
  try { return hid?.value ? JSON.parse(hid.value) : []; } catch { return []; }
};

window.writeCardNotes ??= function(val){
  // hidden にミラー
  const hid = document.getElementById('post-card-notes-hidden');
  if (hid){
    try { hid.value = (typeof val === 'string') ? val : JSON.stringify(val); } catch {}
  }
  // 最低限：#post-card-notes を直接再描画（簡易）
  const wrap = document.getElementById('post-card-notes');
  if (!wrap) return;
  const arr = Array.isArray(val) ? val : [];
  wrap.innerHTML = '';
  for (const it of arr){
    const row = document.createElement('div');
    row.className = 'card-note-row';
    row.dataset.cd = String(it.cd || '');
    row.innerHTML = `
      <div class="cn-title">CD:${String(it.cd || '')}</div>
      <textarea class="cn-text" rows="2">${(it.text || '').replace(/</g,'&lt;')}</textarea>
    `;
    wrap.appendChild(row);
  }
};


// デッキリスト描画
function renderDeckList() {
  const container    = document.getElementById('deck-card-list');
  const emptyMessage = document.getElementById('deckcard-empty-message');
  if (!container) return;

  // クリア & 空プレースホルダ差し戻し
  container.innerHTML = '';
  if (emptyMessage) container.appendChild(emptyMessage);

  // [cd, count] へ変換 & 並び替え（タイプ→コスト→パワー→cd）
  const entries = Object.entries(deck || {});

  //デッキから代表カードが消えていたら強制リセット
  if (representativeCd && !deck[representativeCd]) {
    representativeCd = null;
    window.representativeCd = null;
  }

  // 並び替えルール定義
  const typeOrder = { 'チャージャー': 0, 'アタッカー': 1, 'ブロッカー': 2 };
  entries.sort((a, b) => {
    const [cdA] = a, [cdB] = b;
    const A = cardMap[cdA], B = cardMap[cdB];
    if (!A || !B) return 0;
    const tA = typeOrder[A.type] ?? 99, tB = typeOrder[B.type] ?? 99;
    if (tA !== tB) return tA - tB;
    const cA = (+A.cost || 0), cB = (+B.cost || 0); if (cA !== cB) return cA - cB;
    const pA = (+A.power|| 0), pB = (+B.power|| 0); if (pA !== pB) return pA - pB;
    return String(cdA).localeCompare(String(cdB));
  });

  // 代表カードの整合性を確定
  // - 今の representativeCd がデッキ内にあればそのまま
  // - デッキから消えていたら「未選択」（null）に戻す
  const representativeExists = entries.some(([cd]) => cd === representativeCd);
  let nextRepresentative = representativeExists ? representativeCd : null;

  // 空表示制御
  if (emptyMessage) emptyMessage.style.display = entries.length === 0 ? 'flex' : 'none';
  if (entries.length === 0) {
    representativeCd = null;
    window.representativeCd = null;
    updateDeckSummaryDisplay?.();
    return;
  }


  // 行DOM生成（代表カードはクラス付与）
  for (const [cd, count] of entries) {
    const card = cardMap[cd];
    if (!card) continue;

    const cardEl = document.createElement('div');
    cardEl.className = 'deck-entry';
    cardEl.dataset.cd     = cd;
    cardEl.dataset.race   = card.race || '';
    cardEl.dataset.type   = card.type || '';
    cardEl.dataset.rarity = card.rarity || '';
    if (cd === nextRepresentative) cardEl.classList.add('representative');

    const img = document.createElement('img');
    img.src = `img/${String(cd).slice(0,5)}.webp`;
    img.alt = card.name || '';
    img.onerror = () => {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = '1';
      img.src = 'img/00000.webp';
    };
    cardEl.appendChild(img);

    const badge = document.createElement('div');
    badge.className = 'count-badge';
    badge.textContent = `×${count}`;
    cardEl.appendChild(badge);

    container.appendChild(cardEl);
    // ※ 外部ヘルパ：枚数表示の可読サイズ調整
    autoscaleBadgeForCardEl?.(cardEl);
  }

  // 代表カードの最終確定
  representativeCd = nextRepresentative;
  window.representativeCd = representativeCd;

  updateDeckSummaryDisplay?.();     // デッキ情報の表示同期
  updateDeckCardListBackground?.(); // リスト背景（種族等）同期
  updateRepresentativeHighlight();  // 代表カードのハイライト更新
}




// 閉じる（0枚 key 残存時は削除確認）
function closeCardOpModal(){
  const modal = document.getElementById('cardOpModal');
  if (!modal?.classList.contains('show')) return true;

  const n = (window.deck?.[_cardOpCurrentCd] ?? 0);
  if (n === 0 && _cardOpCurrentCd && (_cardOpCurrentCd in (window.deck||{}))) {
    const ok = confirm('このカードをデッキから削除しますか？');
    if (ok) {
      delete deck[_cardOpCurrentCd];
      updateDeck?.();
      renderDeckList?.();
      updateDeckSummaryDisplay?.();
      scheduleAutosave?.();
      // 続行して閉じる
    } else {
      // 削除しない → 1枚に戻して閉じキャンセル
      deck[_cardOpCurrentCd] = 1;
      updateDeck?.();
      renderDeckList?.();
      updateDeckSummaryDisplay?.();
      scheduleAutosave?.();
      updateCardOpCountBadge?.();
      return false;
    }
  }

  modal.classList.remove('show');
  modal.style.display = 'none';
  _cardOpCurrentCd = null;
  return true;
}

// 枚数バッジの同期（リスト側のバッジも即時更新）
function updateCardOpCountBadge(){
  const badge = document.getElementById('cardOpCountBadge');
  const n = window.deck?.[_cardOpCurrentCd] ?? 0;
  if (badge) badge.textContent = '×' + n;

  updateCardOpButtons();

  // デッキリスト（右の縦リスト）
  if (_cardOpCurrentCd) {
    const listBadge = document.querySelector(
      `#deck-card-list .deck-entry[data-cd="${_cardOpCurrentCd}"] .count-badge`
    );
    if (listBadge) listBadge.textContent = '×' + n;

    // ★ デッキバー（上の横スクロール）も同期
    const barBadge = document.querySelector(
      `#deckBarTop .deck-card[data-cd="${_cardOpCurrentCd}"] .count-badge`
    );
    if (barBadge) {
      barBadge.textContent = String(n);
      // サイズ再計算（任意）
      const cardEl = barBadge.closest('.deck-card');
      if (cardEl && typeof autoscaleBadgeForCardEl === 'function') {
        autoscaleBadgeForCardEl(cardEl);
      }
    }
  }
}


// ＋／－／代表ボタン活性（旧神は1枚まで、通常は3枚まで）
function updateCardOpButtons(){
  const plusBtn  = document.getElementById('cardOpInc');
  const minusBtn = document.getElementById('cardOpDec');
  const repBtn   = document.getElementById('cardOpSetRep');

  if (!_cardOpCurrentCd) {
    if (plusBtn)  plusBtn.disabled  = true;
    if (minusBtn) minusBtn.disabled = true;
    if (repBtn)   repBtn.disabled   = true;
    return;
  }
  const info = cardMap[_cardOpCurrentCd];
  const n = deck?.[_cardOpCurrentCd] ?? 0;

  if (plusBtn)  plusBtn.disabled  = (info?.race === '旧神') ? (n >= 1) : (n >= 3);
  if (minusBtn) minusBtn.disabled = (n <= 0);
  if (repBtn)   repBtn.disabled   = !(n > 0);
}

// 0枚でも key は残す（閉じ時に削除判断）
function removeCardSoft(cd){
  const cur  = (+deck?.[cd] || 0);
  const next = Math.max(0, cur - 1);
  deck[cd] = next;
  updateDeckSummaryDisplay?.();
  scheduleAutosave?.();
}

//#endregion



/*======================================================
  5) デッキ情報・デッキリスト
======================================================*/
//#region

//前回メイン種族
let lastMainRace = null;
// #deck-card-list の背景をメイン種族色に
function updateDeckCardListBackground(){
  const listEl = document.getElementById('deck-card-list');
  if (!listEl) return;

  // デッキが空かどうか
  const hasCards = Object.keys(deck).length > 0;

  if (!hasCards){
    lastMainRace = null;
    // 一度リセットしてからデフォルト画像
    listEl.style.removeProperty('backgroundImage');
    listEl.style.removeProperty('backgroundColor');
    listEl.style.backgroundImage = 'url("./img/cardlist.webp")';
    return;

  }

  const mainRace = getMainRace();
  if (mainRace) {
  if (mainRace !== lastMainRace) {
    lastMainRace = mainRace;
    const color = RACE_BG[mainRace] || 'transparent';
    listEl.style.backgroundImage = 'none';
    listEl.style.backgroundColor = color;
  }
  } else {
  // カードはあるがメイン種族が無い場合 → デフォ背景に戻す
  lastMainRace = null;
  listEl.style.removeProperty('backgroundImage');
    listEl.style.removeProperty('backgroundColor');
    listEl.style.backgroundImage = 'url("./img/cardlist.webp")';
  }
}

//枚数表示サイズ調整
function autoscaleBadgeForCardEl(cardEl){
  const img   = cardEl.querySelector('img');
  const badge = cardEl.querySelector('.count-badge');
  if (!img || !badge) return;

  const apply = () => {
    const W   = img.clientWidth || img.naturalWidth || 220; // カードの表示幅
    // ← 好みで係数調整（初期: 幅18% / 高さ12% / 文字7%）
    const bW  = Math.max(20, Math.round(W * 0.18)); // バッジ幅
    const bH  = Math.max(14, Math.round(W * 0.18)); // バッジ高
    const fz  = Math.max(10, Math.round(W * 0.12)); // フォント
    const gap = Math.max(2,  Math.round(W * 0.02)); // 右上の余白

    Object.assign(badge.style, {
      width:        `${bW}px`,
      height:       `${bH}px`,
      fontSize:     `${fz}px`,
      borderRadius: `${Math.round(bH * 0.6)}px`,
      padding:      `0 ${Math.round(bW * 0.15)}px`,
      display:      'flex',
      alignItems:   'center',
      justifyContent:'center',
      top:          `${gap}px`,
      right:        `${gap}px`,
    });
  };

  if (img.complete) apply();
  else img.addEventListener('load', apply, { once: true });
}

function autoscaleAllBadges(){
  document.querySelectorAll('.deck-entry, .deck-card').forEach(autoscaleBadgeForCardEl);
}

// リサイズやレイアウト変化で再計算
window.addEventListener('resize', () => requestAnimationFrame(autoscaleAllBadges));
if (window.ResizeObserver) {
  const target = document.getElementById('deck-card-list');
  if (target) {
    new ResizeObserver(() => requestAnimationFrame(autoscaleAllBadges))
      .observe(target);
  }
}

//#region 代表カード選択モーダル

//代表カード初期化処理
document.addEventListener('DOMContentLoaded', () => {
  ['deck-representative', 'post-representative'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('tap-target');
    el.style.cursor = 'pointer';
    el.title = 'タップして代表カードを選択';
    el.addEventListener('click', openRepSelectModal);
  });

  document.getElementById('repSelectClose')?.addEventListener('click', closeRepSelectModal);
  document.getElementById('repSelectModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'repSelectModal') closeRepSelectModal();
  });
});


//代表カードクラス付与
function updateRepresentativeHighlight() {
  const rep = String(representativeCd || '').padStart(5,'0').slice(0,5);
  const targets = document.querySelectorAll(".deck-card, .deck-entry"); // 両対応

  targets.forEach(el => {
    el.classList.remove("representative");
    const raw = el.dataset.cd || el.getAttribute('data-cd') || '';
    const cd  = String(raw).padStart(5,'0').slice(0,5);
    if (rep && cd === rep) el.classList.add("representative");
  });
}


// page2.js（代表カードUI更新フックだけ残す）
window.updateRepresentativeHighlight ??= function updateRepresentativeHighlight(cd5, name){
  // cd5/name が渡ってこない呼び方にも耐える
  const repCd = (cd5 || window.representativeCd || null);

  // 表示名補完（必要なら）
  let resolvedName = name || '';
  if (!resolvedName && repCd) {
    const map = window.cardMap || window.allCardsMap || {};
    resolvedName = map?.[repCd]?.name || '';
  }

  // 表示更新（page2旧setRepresentativeCardがやってた部分）
  const infoEl = document.getElementById('deck-representative');
  const postEl = document.getElementById('post-representative');
  if (infoEl) infoEl.textContent = resolvedName || '';
  if (postEl) postEl.textContent = resolvedName || '';

  // hidden validator を更新したいならここで（page2旧実装互換）
  const repValidator = document.getElementById('post-rep-validator');
  if (repValidator) {
    repValidator.value = repCd || '';
    if (typeof repValidator.setCustomValidity === 'function') repValidator.setCustomValidity('');
  }
};


//#endregion 代表カード選択モーダル

// 状態
let _cardOpCurrentCd = null;
let _cardOpDrag = { active:false, startX:0, startY:0, startLeft:0, startTop:0 };

// モーダルオープン（anchorRect 近傍に配置）
function openCardOpModal(cd, anchorRect){
  _cardOpCurrentCd = String(cd);
  const info = (window.cardMap || window.allCardsMap || {})[_cardOpCurrentCd];
  if (!info) return;

  const imgEl = document.getElementById('cardOpImg');
  if (imgEl) {
    imgEl.src = `img/${_cardOpCurrentCd.slice(0,5)}.webp`;
    imgEl.alt = info.name || '';
  }
  const titleEl = document.getElementById('cardOpTitle');
  if (titleEl) titleEl.textContent = info.name || 'カード操作';

  updateCardOpCountBadge();
  buildCardOpEffects(info);

  const modal = document.getElementById('cardOpModal');
  const box   = document.getElementById('cardOpModalContent');
  if (!modal || !box) return;

  modal.style.display = 'block';
  modal.classList.add('show');

  // 位置：クリック元の右横（画面内にクランプ）
  const vw = window.innerWidth, vh = window.innerHeight;
  const r = anchorRect || { left: vw/2, right: vw/2, top: vh/2, bottom: vh/2, width:0, height:0 };
  const desiredLeft = (r.right ?? r.left) + 8;
  const desiredTop  = (r.top ?? r.bottom) + 0;
  const left = Math.min(Math.max(8, desiredLeft), vw - box.offsetWidth  - 8);
  const top  = Math.min(Math.max(8, desiredTop ), vh - box.offsetHeight - 8);

  box.style.transform = 'none';
  box.style.left = left + 'px';
  box.style.top  = top  + 'px';
}

// ドラッグ移動（トップライン）
(function initCardOpDrag(){
  const box  = document.getElementById('cardOpModalContent');
  // ドラッグ開始要素を「cardOpHeader 内の .cardop-topline」に限定
  const head = document.querySelector('#cardOpHeader .cardop-topline')
            || document.getElementById('cardOpHeader');
  if (!box || !head) return;

  const onDown = (e)=>{
    // ×ボタン上ではドラッグ開始しない
    if (e.target.closest('#cardOpCloseBtn')) return;
    _cardOpDrag.active = true;
    const rect = box.getBoundingClientRect();
    const pt   = e.touches?.[0] || e;
    _cardOpDrag.startX = pt.clientX;
    _cardOpDrag.startY = pt.clientY;
    _cardOpDrag.startLeft = rect.left;
    _cardOpDrag.startTop  = rect.top;
    box.style.transform = 'none';
    e.preventDefault();
  };

  const onMove = (e)=>{
    if (!_cardOpDrag.active) return;
    const pt = e.touches?.[0] || e;
    const left = _cardOpDrag.startLeft + (pt.clientX - _cardOpDrag.startX);
    const top  = _cardOpDrag.startTop  + (pt.clientY - _cardOpDrag.startY);
    const vw = innerWidth, vh = innerHeight, w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.min(Math.max(left, 8 - w*0.9), vw - 8) + 'px';
    box.style.top  = Math.min(Math.max(top , 8 - h*0.9), vh - 8) + 'px';
  };

  const onUp = ()=>{ _cardOpDrag.active = false; };

  head.addEventListener('mousedown', onDown);
  addEventListener('mousemove', onMove);
  addEventListener('mouseup', onUp);
  head.addEventListener('touchstart', onDown, {passive:false});
  addEventListener('touchmove', onMove, {passive:false});
  addEventListener('touchend', onUp);
})();


// ×ボタン
document.getElementById('cardOpCloseBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  closeCardOpModal();
  renderDeckList?.(); // 画面反映
});


// タブ/サブタブ遷移時は自動クローズ（0枚・削除拒否時は遷移キャンセル）
document.addEventListener('click', (e)=>{
  const t = e.target;
  if (!t) return;
  if (t.closest?.('.tab') || t.closest?.('.subtab-bar .tab')) {
    const ok = closeCardOpModal();
    if (ok === false) { e.preventDefault(); e.stopPropagation(); }
  }
});

// デッキリスト（委譲）：画像タップでモーダル
document.addEventListener('click', (e)=>{
  const cell = e.target.closest?.('.deck-entry');
  if (!cell) return;
  const cd = cell.dataset.cd || cell.getAttribute('data-cd');
  if (!cd) return;
  openCardOpModal(cd, cell.getBoundingClientRect());
});



/* イベント：ボタン群 */
// ===== カード操作モーダル：共通参照 =====
const cardOpModal     = document.getElementById('cardOpModal');
const cardOpContent   = document.getElementById('cardOpModalContent');
const cardOpHeader    = document.getElementById('cardOpHeader');
const cardOpCloseBtn  = document.getElementById('cardOpCloseBtn');

const cardOpTitle        = document.getElementById('cardOpTitle');
const cardOpImg          = document.getElementById('cardOpImg');
const cardOpCountBadge   = document.getElementById('cardOpCountBadge');



/* －／＋／代表登録：ボタン結線 */
const cardOpDecBtn   = document.getElementById('cardOpDec');
const cardOpIncBtn   = document.getElementById('cardOpInc');
const cardOpSetRepBtn= document.getElementById('cardOpSetRep');

function refreshCardOpControls(){
  // 枚数バッジとボタン活性を同期
  updateCardOpCountBadge();   // バッジ更新
  updateCardOpButtons();
  refreshPostSummary();
}

cardOpIncBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!_cardOpCurrentCd) return;
  addCard(_cardOpCurrentCd);  // 既存の上限・種族・旧神チェックは addCard 内で実施
  refreshCardOpControls();
});

cardOpDecBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!_cardOpCurrentCd) return;
  removeCardSoft(_cardOpCurrentCd);
  refreshCardOpControls();

});

cardOpSetRepBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!_cardOpCurrentCd) return;

  try {
    const infoMap = window.cardMap || window.allCardsMap || {};
    const info = infoMap[_cardOpCurrentCd] || {};
    setRepresentativeCard(_cardOpCurrentCd, info.name || '');
  } catch (_) {
    setRepresentativeCard(_cardOpCurrentCd, '');
  }

  if (typeof scheduleAutosave === 'function') window.scheduleAutosave?.();// オートセーブ
  closeCardOpModal();// モーダル閉じる
});




//#endregion



/*======================================================
  6) デッキ情報・分析タブ
======================================================*/
//#region 6. デッキ情報・分析

/*======= デッキメイン種族判別（必要最小限） =====*/
//#region Mainraces

// メイン種族背景色
const RACE_BG = {
  'ドラゴン':     'rgba(255, 100, 100, 0.16)',
  'アンドロイド': 'rgba(100, 200, 255, 0.16)',
  'エレメンタル': 'rgba(100, 255, 150, 0.16)',
  'ルミナス':     'rgba(255, 250, 150, 0.16)',
  'シェイド':     'rgba(200, 150, 255, 0.16)',
};
//#regionデッキ情報処理

//デッキ分析用変数
let costChart = null;
let powerChart = null;


/*デッキ情報欄*/
/*説明
 * デッキ情報欄（枚数・種族・旧神・タイプ内訳）の更新。
 * 引数 deckCards は { 種族: ..., タイプ: ... } の配列。
 */
function updateDeckSummary(deckCards) {
  // 枚数
  document.getElementById("deck-count").textContent = deckCards.length;

  // メイン種族（イノセント・旧神を除外）
  const races = [...new Set(deckCards.map(c => c.種族))].filter(
    r => r !== "イノセント" && r !== "旧神"
  );
  document.getElementById("deck-races").textContent = races[0] || "未選択";

  // 旧神の表示
  const oldGods = deckCards.filter(c => c.種族 === "旧神");
  if (oldGods.length === 0) {
    document.getElementById("deck-eldergod").textContent = "未採用";
  } else {
    // デッキに採用されている旧神1種類のみ表示
    const cd = Object.keys(deck).find(cd => cardMap[cd]?.race === "旧神");
    const name = cd ? cardMap[cd]?.name || "旧神" : "旧神";
    document.getElementById("deck-eldergod").textContent = name;
  }

  // タイプごとのカウント
  const countByType = type => deckCards.filter(c => c.タイプ === type).length;

  const nChg = countByType("チャージャー");
  const nAtk = countByType("アタッカー");
  const nBlk = countByType("ブロッカー");

  // 既存の数字だけ表示するスパン（互換のため残す）
  document.getElementById("count-charger") && (document.getElementById("count-charger").textContent = nChg);
  document.getElementById("count-attacker") && (document.getElementById("count-attacker").textContent = nAtk);
  document.getElementById("count-blocker") && (document.getElementById("count-blocker").textContent = nBlk);

  // 🆕 チップUI（type-summary があればそちらに描画）
  const typeWrap = document.getElementById("type-summary");
    if (typeWrap) {
      typeWrap.innerHTML = `
        <span class="type-chip" data-type="チャージャー">チャージャー ${nChg}枚</span>
        <span class="type-chip" data-type="アタッカー">アタッカー ${nAtk}枚</span>
        <span class="type-chip" data-type="ブロッカー">ブロッカー ${nBlk}枚</span>
      `;
    }


  updateAutoTags();//自動タグ
}


/* =========================
   交換ポイント計算と表示（パック別集計版）
   - 未所持枚数 = デッキ要求 - 所持合計(normal+shine+premium)
   - 不足分のみをポイント/ダイヤ/砂に換算
   - ポイントは「パック別の内訳」を表示、ダイヤは合計のみ
========================= */

// 交換レート（既存値）
const EXCHANGE_RATE = {
  point:   { LEGEND: 300,  GOLD: 150,  SILVER: 20,  BRONZE: 10 },
  diamond: { LEGEND: 4000, GOLD: 1000, SILVER: 250, BRONZE: 150 },
  sand:    { LEGEND: 300,  GOLD: 150,  SILVER: 20,  BRONZE: 10 },
};

// レアリティ → キー
function rarityToKeyJP(r) {
  if (!r) return null;
  if (r.includes('レジェ'))  return 'LEGEND';
  if (r.includes('ゴールド')) return 'GOLD';
  if (r.includes('シルバー')) return 'SILVER';
  if (r.includes('ブロンズ')) return 'BRONZE';
  return null;
}

/* ============= packs.json 読み込み（順序ラベル） ============= */
// packs.json の順序・ラベルを共通関数から取得して使う版（common.js の loadPackCatalog を利用）
var __PACK_ORDER = null;
var __PACK_LABELS = {};

async function ensurePacksLoaded(){
  if (__PACK_ORDER) return;

  // 1) まず同階層の packs.json を探す
  const tryUrls = ['./public/packs.json'];
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();

      // order（表示順）と labels（表示名）を構築
      __PACK_ORDER = Array.isArray(data.order) ? data.order.slice() : [];
      __PACK_LABELS = {};
      if (Array.isArray(data.packs)) {
        data.packs.forEach(p => {
          if (p?.en) __PACK_LABELS[p.en] = p.en; // 今は EN 表示で統一
        });
      }

      return; // 成功
    } catch(e) {
      // 次の候補へ
    }
  }

  // 2) どれも読めなかった場合のフォールバック（最小限）
  console.warn('packs.json を読み込めませんでした。アルファベット順で表示します。');
  __PACK_ORDER = [];     // ← 無順序（render 側で dict のキーを並べ替え）
  __PACK_LABELS = {};

  // 表示順の補完：orderが無い/不足なら末尾に足す
  const mustHave = ['Awaking The Oracle', 'Beyond the Sanctuary', 'Creeping Souls', 'Drawn Sword', 'その他カード', 'コラボカード'];
  __PACK_ORDER = Array.isArray(__PACK_ORDER) ? __PACK_ORDER : [];
  for (const k of mustHave) if (!__PACK_ORDER.includes(k)) __PACK_ORDER.push(k);
}

function getPackLabel(en){ return __PACK_LABELS[en] || en || 'その他カード'; }


/* EN名をカードの pack_name / pack / pack_en から抽出
   例: "Awaking The Oracle「神託者の覚醒」" → "Awaking The Oracle"
   例: "Beyond the Sanctuary／聖域の先へ"   → "Beyond the Sanctuary"
   ※ 無指定や不明な場合は 'その他カード' を返す（'Unknown'は使わない）
*/
function getPackEnName(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'その他カード';
  const i = s.indexOf('「');                 // EN「JP」
  if (i >= 0) return s.slice(0, i).trim() || 'その他カード';
  const slash = s.indexOf('／');            // EN／JP
  if (slash >= 0) return s.slice(0, slash).trim() || 'その他カード';
  return s; // すでに EN 単体（例: "Drawn Sword" / "コラボカード" など）
}

/* ---------- 不足・通貨計算（完成版：この1つだけ残す） ---------- */
function computeExchangeNeeds(){
  const owned = window.readOwnedMapForDeckmaker?.() || {};
  const sand  = { LEGEND:0, GOLD:0, SILVER:0, BRONZE:0 };
  const packPoint = {};  // パック別のポイント（※コラボは内訳に含めない）
  const shortages = [];  // 未所持カードリスト { cd, name, shortage }
  let pointTotal = 0;
  let diamondTotal = 0;

  for (const [cd, needRaw] of Object.entries(window.deck || {})) {
    // pack_name を確実に拾うため allCardsMap をフォールバックに使う
    const info = (window.cardMap?.[cd]) || (window.allCardsMap?.[cd]);
    if (!info) continue;

    const key = rarityToKeyJP(info.rarity);
    if (!key) continue;

    const v = owned[cd] || { normal:0, shine:0, premium:0 };
    const have = (v.normal|0) + (v.shine|0) + (v.premium|0);
    const shortage = Math.max(0, (needRaw|0) - have);
    if (!shortage) continue;

    // 未所持カード情報を記録
    shortages.push({ cd, name: info.name || cd, shortage });

    // 合計（ポイント・ダイヤ・砂）
    const pt = (EXCHANGE_RATE.point[key]   || 0) * shortage;
    const dm = (EXCHANGE_RATE.diamond[key] || 0) * shortage;
    const sd = (EXCHANGE_RATE.sand[key]    || 0) * shortage;

    pointTotal   += pt;
    diamondTotal += dm;
    sand[key]    += sd;

    // パック別（ポイントのみ集計）— コラボカードは除外
    const packEn = getPackEnName(info.packName || info.pack_name || info.pack || '');
    if (packEn !== 'コラボカード') {
      packPoint[packEn] = (packPoint[packEn] || 0) + pt;
    }
  }

  // packPoints は packPoint のエイリアスとする。shortages も返す。
  const packPoints = packPoint;
  return { pointTotal, diamondTotal, sand, packPoint, packPoints, shortages };
}


/* ---------- パック別ポイントの描画（ポイントのみ） ---------- */
function renderPointByPack(dict){
  const box = document.getElementById('point-by-pack');
  if (!box) return;

  // dict が空 or すべて 0 なら非表示
  const keys = Object.keys(dict || {}).filter(k => (dict[k] | 0) > 0);
  if (!keys.length) {
    box.innerHTML = '';
    box.style.display = 'none';
    return;
  }

  // 1) __PACK_ORDER に載っていて、かつ dict に実データがあるもの（順序は packs.json の order）
  const orderedInDict = Array.isArray(__PACK_ORDER)
    ? __PACK_ORDER.filter(en => (dict[en] | 0) > 0)
    : [];

  // 2) __PACK_ORDER に無いが dict に存在するもの（アルファベット順）
  const extras = keys.filter(en => !orderedInDict.includes(en))
                     .sort((a,b)=> a.localeCompare(b));

  const finalOrder = [...orderedInDict, ...extras];

  const html = [];
  for (const en of finalOrder) {
    const val = dict[en] | 0;
    if (!val) continue;
    html.push(`<li>${getPackLabel(en)}：<strong>${val}ポイント</strong></li>`);
  }

  box.innerHTML = `<ul class="by-pack-list-ul">${html.join('')}</ul>`;
  box.style.display = ''; // 表示
}
// ▼ 追加（renderPointByPack の直後でOK）
let __latestPackPoint = null;
function tryRenderPointByPack(dict){
  // dict が来たら更新、来なければ前回値で描画だけ試みる
  if (dict) __latestPackPoint = dict;

  const box = document.getElementById('point-by-pack');
  if (!box || !__latestPackPoint) return;

  // 既存の描画ロジックに委譲
  renderPointByPack(__latestPackPoint);

  // 現在モードがポイント以外なら非表示にして整合
  if (__exchangeModeCompact !== 'point') {
    box.style.display = 'none';
  }
}


/*
 * パック別ポイントの描画（新UI用）
 *
 * computeExchangeNeeds() から取得した packPoint を元にポイント一覧を描画します。
 * 旧UIコードでは未定義の renderByPackList() を呼び出しており、
 * その結果パックごとのポイントが正しく表示されない不具合がありました。
 * 新UIでは本関数を経由して packPoint を取得し、既存の renderPointByPack() へ委譲します。
 */
/*
function renderByPackList() {
  // 最新の交換ポイント情報を取得
  const { packPoint } = computeExchangeNeeds();
  // packPoint を用いて描画
  renderPointByPack(packPoint);
}
*/

/* =========================
   パック内訳の再計算をデッキ更新に追従させるフック
   - 追加/削除/並び替え/復元など、代表的な関数の後に再計算を挿入
   ========================= */
(function wirePackPointAutoRecalc(){
  function recalc(){ try{ updateExchangeSummary(); }catch(e){} }

  function hook(name){
    const fn = window[name];
    if (typeof fn === 'function' && !fn.__packPointHooked){
      const orig = fn;
      window[name] = function(...args){
        const r = orig.apply(this, args);
        try{ recalc(); }catch(e){}
        return r;
      };
      window[name].__packPointHooked = true;
    }
  }

  // よく呼ばれる描画系・読込系の関数をカバー（存在すればフック）
  [
    'renderDeckList',
    'updateDeckAnalysis',
    'updateDeckSummaryDisplay',
    'loadDeckFromStorage',
    'loadDeckFromLocal',
    'restoreDeckFromLocal',
    'applyDeckCode',
    'loadDeckByCode',
  ].forEach(hook);

  // カードロード完了 or 任意の復元イベントにも追従
  window.onCardsLoaded = (function(prev){
    return function(...args){
      if (typeof prev === 'function') prev.apply(this, args);
      recalc();
    };
  })(window.onCardsLoaded);

  window.onDeckRestored = (function(prev){
    return function(...args){
      if (typeof prev === 'function') prev.apply(this, args);
      recalc();
    };
  })(window.onDeckRestored);

  // 最後に一度だけ実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', recalc, { once:true });
  } else {
    recalc();
  }
})();


/* ---------- 合計表示＋パック別（ポイント）を反映 ---------- */
async function updateExchangeSummary(){
  await ensurePacksLoaded();

  const els = {
    point:    document.getElementById('point-cost'),
    diamond:  document.getElementById('diamond-cost'),
    sandLeg:  document.getElementById('sand-leg'),
    sandGld:  document.getElementById('sand-gld'),
    sandSil:  document.getElementById('sand-sil'),
    sandBro:  document.getElementById('sand-bro'),
  };
  if (!els.point) return;

  const { pointTotal, diamondTotal, sand, packPoint } = computeExchangeNeeds();

  els.point.textContent   = String(pointTotal || 0);
  els.diamond.textContent = String(diamondTotal || 0);
  els.sandLeg.textContent = String(sand.LEGEND || 0);
  els.sandGld.textContent = String(sand.GOLD   || 0);
  els.sandSil.textContent = String(sand.SILVER || 0);
  els.sandBro.textContent = String(sand.BRONZE || 0);

  // パック別（ポイントのみ）
  tryRenderPointByPack(packPoint);

  // ★ 追加：コンパクト行も“現在モードのまま”上書き同期しておく
  if (document.getElementById('exchange-values-compact')) {
    setExchangeCompact({
      point: pointTotal,
      diamond: diamondTotal,
      sand,
      packPoint
    });
  }
}

/* ---------- コンパクト行（トグルは合計のみ切替＋ポイント時は内訳） ---------- */
let __exchangeModeCompact = 'point'; // 'point'|'diamond'|'sand'
function setExchangeCompact(values){
  const wrap = document.getElementById('exchange-values-compact');
  const btn  = document.getElementById('exchange-toggle-btn-compact');
  // ポイントの時だけパック内訳を出す、それ以外は消す
  const packBox = document.getElementById('point-by-pack');
  if (packBox) {
    packBox.style.display = (__exchangeModeCompact === 'point') ? '' : 'none';
  }
  if (!wrap || !btn) return;

  const { point, diamond, sand, packPoint } = values;

  if (__exchangeModeCompact === 'point') {
    // ポイントモード：合計は小さめ、内訳リストを別領域に描画
    wrap.innerHTML = `🟢 必要ポイント：`;
    tryRenderPointByPack(packPoint);
    if (packBox) packBox.style.display = ''; // 見せる
  } else if (__exchangeModeCompact === 'diamond') {
    wrap.innerHTML = `💎 必要ダイヤ：<strong>${diamond|0}個</strong>`;
    if (packBox) { packBox.innerHTML = ''; packBox.style.display = 'none'; }
  } else { // sand
    wrap.innerHTML =
      `🪨 必要砂：
      <div class="point-sand">
        <span class="rar-item">🌈レジェンド${sand?.LEGEND|0}個</span>
        <span class="rar-item">🟡ゴールド${sand?.GOLD|0}個</span>
        <span class="rar-item">⚪️シルバー${sand?.SILVER|0}個</span>
        <span class="rar-item">🟤ブロンズ${sand?.BRONZE|0}個</span>
      </div>`;
    if (packBox) { packBox.innerHTML = ''; packBox.style.display = 'none'; }
  }

  btn.textContent =
    (__exchangeModeCompact === 'point')   ? '🟢 ポイント' :
    (__exchangeModeCompact === 'diamond') ? '💎 ダイヤ'   : '🪨 砂';
}


function toggleExchangeCompact(){
  __exchangeModeCompact =
    (__exchangeModeCompact === 'point')   ? 'diamond' :
    (__exchangeModeCompact === 'diamond') ? 'sand'    : 'point';
  const { pointTotal, diamondTotal, sand, packPoint } = computeExchangeNeeds();
  setExchangeCompact({
    point: pointTotal,
    diamond: diamondTotal,
    sand,
    packPoint
  });
}
window.toggleExchangeCompact = toggleExchangeCompact;

/* ---------- 初期化（DOMContentLoaded） ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  updateExchangeSummary();
  const { pointTotal, diamondTotal, sand, packPoint } = computeExchangeNeeds();
  setExchangeCompact({
    point: pointTotal,
    diamond: diamondTotal,
    sand,
    packPoint
  });
    // 要素の生成順に負けないよう、最後にもう一度だけ描画を試みる
  tryRenderPointByPack();

});



/* =========================
   🆕 マリガン練習ロジック
   ========================= */

   const RARITY_ICON = { LEGEND:'🌈', GOLD:'🟡', SILVER:'⚪️', BRONZE:'🟤' };
(() => {
  const HAND_SIZE = 4;
  const OUTCOME_LIMIT = 5;

  // 例①〜例⑳（それ以上は例21みたいに数字で）
  function formatExampleLabel_(n){
    const circled = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
                    '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
    return '例' + (circled[n-1] || String(n));
  }

  // 手札タイプスロットの初期値取得（現在の手札並びをテンプレにする）
  function getInitialHandTypeSlots(){
  const map = window.cardMap || window.allCardsMap || {};
  // 今の state.hand の並び（= 画面の並び）をテンプレにする
  return state.hand.map(h => map[String(h.cd)]?.type || '');
  }

    // 要素取得
    const els = {
    trainer:   document.getElementById('mulligan-trainer'),
    warning:   document.getElementById('mull-warning'),
    hand:      document.getElementById('mull-hand'),
    btn:       document.getElementById('btn-mull-or-reset'),
    remainList:document.getElementById('mull-remaining-by-type'),
    outcomeBox: document.getElementById('mull-outcome-probs'),
  };

  if (!els.trainer) return; // 他ページ安全化

  // 「確率表示」箱が無ければ生成（残り山札の下に入れる）
if (!els.outcomeBox) {
  const host = els.remainList?.closest?.('.mull-remaining') || els.trainer;
  const box = document.createElement('div');
  box.id = 'mull-outcome-probs';
  box.className = 'mull-outcome';
  host.appendChild(box);
  els.outcomeBox = box;
}


   // 共有（common.js）
  const getDeckObject = () => (window.deck || {});
  const getCardInfo   = (cd) => (window.cardMap?.[String(cd)] || window.allCardsMap?.[String(cd)]);

    // 状態
  const state = {
    pool: [],  // 山札（手札４枚以外のデッキリスト）
    hand: [],  // { cd, selected }
    outcomeExpanded: false, // 確率表示の展開状態
    outcomeMode: '',
  };

   // 「もっと見る」/「閉じる」
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.mull-outcome-more');
    if (!btn) return;
    state.outcomeExpanded = !state.outcomeExpanded;
    refreshUI(); // 再描画（rowsは軽いので再計算でOK）
  });

  // cd→枚数 のMapを作る
  function buildDeckCountMap(){
    const deckObj = getDeckObject();
    const map = {};
    for (const cd in deckObj) map[String(cd)] = (deckObj[cd]|0);
    return map;
  }


  // countMap を実カード配列に展開
  function expandFromCountMap(counts){
    const arr = [];
    for (const cd in counts) {
      for (let i=0;i<(counts[cd]|0);i++) arr.push(String(cd));
    }
    return arr;
  }
  // 「現在の手札4枚を除いた山」を作る
  function buildPoolExcludingCurrentHand(){
    const counts = buildDeckCountMap();
    // 手札分を引いて除外（同名が複数あればその枚数ぶん引く）
    state.hand.forEach(h => {
      const cd = String(h.cd);
      if (counts[cd] > 0) counts[cd]--;
    });
    return shuffleInPlace(expandFromCountMap(counts));
  }

    // シャッフル＆1枚引く
  function shuffleInPlace(arr){
    for (let i=arr.length-1; i>0; i--){
      const j = (Math.random()* (i+1))|0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function drawOne(){
    // state.pool から1枚引く
    if (!state.pool.length) return null;
    return state.pool.pop();
  }

  // 初期配り（※毎回の「手札リセット」でdiscardedはリセット）
  function dealInitialHand(){
    ensureMullHandChips();// chips確保
    // 初期はデッキ全体から引く
    state.pool = shuffleInPlace(expandFromCountMap(buildDeckCountMap()));
    state.hand = [];

    for (let i=0; i<HAND_SIZE; i++){
      const cd = drawOne();
      if (!cd) break;
      state.hand.push({ cd, selected:false });
    }
    renderHand();
    refreshUI();
  }

  // 手札描画
  function ensureMullHandChips(){
    const layout = els.trainer?.querySelector?.('.mull-layout');
    if (!layout) return null;

    let chips = layout.querySelector('.mull-hand-chips');
    if (!chips){
      chips = document.createElement('div');
      chips.className = 'mull-hand-chips';
      chips.setAttribute('aria-label', '残りの山札（タイプ別）');

      const ul = document.createElement('ul');
      ul.id = 'mull-remaining-by-type';
      ul.className = 'mull-remaining-list';

      chips.appendChild(ul);

      // ✅ hand-area の “直前” に入れる（上に出る）
      const hand = layout.querySelector('#mull-hand');
      layout.insertBefore(chips, hand || layout.firstChild);
    }
    return chips;
  }


function renderHand(){
  els.hand.innerHTML = ''; // クリア

  state.hand.forEach((slot) => {
    const wrap = document.createElement('div');
    wrap.className = 'card-thumb';
    wrap.dataset.selected = slot.selected ? 'true' : 'false';

    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.loading  = 'lazy';
    img.src      = `img/${slot.cd}.webp`;
    img.onerror  = function(){
      this.remove();
      const title = document.createElement('div');
      title.className = 'title-fallback';
      const info = getCardInfo(slot.cd);
      title.textContent = info?.name
        ? `${info.name}（${slot.cd}）`
        : `No Image (${slot.cd})`;
      wrap.appendChild(title);
    };

    wrap.addEventListener('click', () => {
      slot.selected = !slot.selected;
      wrap.dataset.selected = slot.selected ? 'true' : 'false';
      refreshUI();
    });

    wrap.appendChild(img);
    els.hand.appendChild(wrap);
  });
}

// タイプ別：デッキ内枚数
function tallyDeckByType(){
  const counts = { 'チャージャー': 0, 'アタッカー': 0, 'ブロッカー': 0 };
  const deckObj = getDeckObject();
  const map = window.cardMap || window.allCardsMap || {};

  for (const cd in deckObj){
    const n = deckObj[cd] | 0;
    if (!n) continue;
    const t = map[String(cd)]?.type;
    if (t === 'チャージャー' || t === 'アタッカー' || t === 'ブロッカー') {
      counts[t] += n;
    }
  }
  return counts;
}
  // タイプ別：残り山枚数
function tallyPoolByType() {
  // 手札を除いた最新の山で集計
  const livePool = buildPoolExcludingCurrentHand();
  const counts = { 'チャージャー': 0, 'アタッカー': 0, 'ブロッカー': 0 };
  const map = window.cardMap || window.allCardsMap || {};
  for (const cd of livePool) {
    const t = map[String(cd)]?.type;
    if (t === 'チャージャー' || t === 'アタッカー' || t === 'ブロッカー') counts[t]++;
  }
  return counts;
}

// 組み合わせ計算 nCk
function comb(n, k){
  n = n|0; k = k|0;
  if (k < 0 || n < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  if (k === 0) return 1;
  let num = 1, den = 1;
  for (let i=1; i<=k; i++){
    num *= (n - (k - i));
    den *= i;
  }
  return num / den;
}
// タイプ別：キープ分
function tallyKeptByType(){
  const counts = { 'チャージャー':0, 'アタッカー':0, 'ブロッカー':0 };
  const map = window.cardMap || window.allCardsMap || {};
  for (const h of state.hand){
    if (h.selected) continue; // ←キープ分だけ数える
    const t = map[String(h.cd)]?.type;
    if (t === 'チャージャー' || t === 'アタッカー' || t === 'ブロッカー') counts[t]++;
  }
  return counts;
}
//「もっと見る」ボタン生成
function renderOutcomeMoreButton_(rowsLen){
  const moreHost = els.outcomeBox;
  const needMore = rowsLen > OUTCOME_LIMIT;
  if (!moreHost) return;

  let btn = moreHost.querySelector('.mull-outcome-more');

  if (!needMore) {
    if (btn) btn.remove();
    return;
  }

  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mull-outcome-more';
    moreHost.appendChild(btn);
  }

  btn.textContent = state.outcomeExpanded
    ? '閉じる'
    : `もっと見る（残り${rowsLen - OUTCOME_LIMIT}件）`;
}


//初期手札タイプ構成表示
function renderInitialHandOutcome() {
  const grid = document.querySelector('.mull-outcome-grid');
  const note = document.querySelector('.mull-outcome-note');
  if (!grid || !note) return;

  // 初期手札のタイプ配列（すでにある state.hand を使用）
  const map = window.cardMap || window.allCardsMap || {};
  const types = state.hand.map(h => map[String(h.cd)]?.type || '');

  // grid 初期化
  grid.innerHTML = '';

  // 1行だけ作る（確率100%）
  const row = document.createElement('div');
  row.className = 'mull-outcome-row2';

  const hand = document.createElement('div');
  hand.className = 'mull-outcome-hand';

  types.forEach(t => {
    const card = document.createElement('div');
    card.className = 'mull-outcome-card';
    card.dataset.type = t;
    hand.appendChild(card);
  });

  const pct = document.createElement('div');
  pct.className = 'mull-outcome-pct';
  pct.textContent = '100%';

  row.appendChild(hand);
  row.appendChild(pct);
  grid.appendChild(row);

  // 文言
  note.textContent = '初期手札のタイプ構成です';
}

// 初期手札タイプ構成確率計算＆表示
function renderInitialHandOutcomeProbs(){
  if (!els.outcomeBox) return;

  const grid = els.outcomeBox.querySelector('.mull-outcome-grid');
  if (!grid) return;

  const pool = tallyDeckByType();
  const C = pool['チャージャー']|0;
  const A = pool['アタッカー']|0;
  const B = pool['ブロッカー']|0;
  const N = C + A + B;

  const k = HAND_SIZE; // 4枚固定
  const denom = comb(N, k);
  if (!denom){
    grid.innerHTML = `<div class="mull-outcome-note">※ デッキのタイプ情報が不足しています</div>`;
    return;
  }

  const rows = [];
  for (let c=0; c<=k; c++){
    for (let a=0; a<=k-c; a++){
      const b = k - c - a;
      if (c > C || a > A || b > B) continue;

      const p = (comb(C,c) * comb(A,a) * comb(B,b)) / denom;

      // 表示用：色カード4枚（順序は固定でOK：C→A→B）
      const typeArr = [];
      for (let i=0;i<c;i++) typeArr.push('チャージャー');
      for (let i=0;i<a;i++) typeArr.push('アタッカー');
      for (let i=0;i<b;i++) typeArr.push('ブロッカー');

      rows.push({ typeArr, p });
    }
  }

  rows.sort((x,y)=> y.p - x.p);

  const limit = state.outcomeExpanded ? rows.length : OUTCOME_LIMIT;
  const shown = rows.slice(0, limit);

  grid.innerHTML = shown.map((r, idx) => `
    <div class="mull-outcome-row2">
      <div style="display:flex; align-items:center;">
        <span class="mull-outcome-rank">${formatExampleLabel_(idx+1)}</span>
        <div class="mull-outcome-hand">
          ${(r.typeArr||[]).map(t => `
            <div class="mull-outcome-card" data-type="${t}"></div>
          `).join('')}
        </div>
      </div>
      <div class="mull-outcome-pct">${(r.p*100).toFixed(2)}%</div>
    </div>
  `).join('');

  // 共通の「もっと見る」ボタン（初期手札でも表示制御）
  renderOutcomeMoreButton_(rows.length);
}

// マリガン後の手札タイプ構成確率計算＆表示
function renderMulliganOutcomeProbs(){
  if (!els.outcomeBox) return;

  const k = state.hand.filter(h => h.selected).length;

  // 引き直し枚数0なら初期手札表示
  if (k <= 0){
    els.outcomeBox.innerHTML = `
      <div class="mull-remaining-title">マリガン後の手札</div>
      <div class="mull-outcome-note">初期手札のタイプ構成です</div>
      <div class="mull-outcome-grid"></div>
    `;
    renderInitialHandOutcome(); // ★ここで初期手札を描画
    return;
  }

  // 母集団＝「手札4枚を除いた残り山札（タイプ別）」
  const pool = tallyPoolByType();
  const C = pool['チャージャー']|0;
  const A = pool['アタッカー']|0;
  const B = pool['ブロッカー']|0;
  const N = C + A + B;

  const denom = comb(N, k);
  if (!denom){
    els.outcomeBox.innerHTML = `
      <div class="mull-remaining-title">マリガン後の手札</div>
      <div class="mull-outcome-note">※ 引き直し枚数に対して山札が不足しています</div>
    `;
    return;
  }

  const kept = tallyKeptByType();// キープ分タイプ数
  const baseSlots = getInitialHandTypeSlots();// 手札タイプスロットの初期値取得

  const rows = [];
  for (let c=0; c<=k; c++){
    for (let a=0; a<=k-c; a++){
      const b = k - c - a;
      if (c > C || a > A || b > B) continue;

      const p = (comb(C,c) * comb(A,a) * comb(B,b)) / denom;

      const finC = kept['チャージャー'] + c;
      const finA = kept['アタッカー'] + a;
      const finB = kept['ブロッカー'] + b;

      // 4枚ぶんのタイプ配列（初期スロット順を維持して、マリガン枠だけ埋める）
      const typeArr = baseSlots.slice();

      // マリガンした枚数 = k なので、テンプレ上で「selectedだった位置」を空けて埋めたい。
      // ただ renderMulliganOutcomeProbs は“確率一覧”なので、実際の selected 位置を使うのが自然。
      const targets = [];
      for (let i=0;i<state.hand.length;i++){
        if (state.hand[i].selected) targets.push(i);
      }

      // この確率行で引けるタイプの“内訳”を配列化（順序はどれでもOK。ここでは C→A→B）
      const drawTypes = [];
      for (let i=0;i<c;i++) drawTypes.push('チャージャー');
      for (let i=0;i<a;i++) drawTypes.push('アタッカー');
      for (let i=0;i<b;i++) drawTypes.push('ブロッカー');

      // 空きスロットに順番に差し込む
      for (let j=0; j<targets.length; j++){
        const pos = targets[j];
        typeArr[pos] = drawTypes[j] || typeArr[pos] || '';
      }

      rows.push({ typeArr, p });
    }
  }

  // 確率高い順
  rows.sort((x,y)=> y.p - x.p);

  const limit = state.outcomeExpanded ? rows.length : OUTCOME_LIMIT;
  const shown = rows.slice(0, limit);
  // 上位10件まで
  //rows.length = Math.min(rows.length, 10);

  // 表示
  els.outcomeBox.innerHTML = `
    <div class="mull-remaining-title">マリガン後の手札</div>
    <div class="mull-outcome-grid">
      ${shown.map((r, idx) => `
        <div class="mull-outcome-row2">
          <div style="display:flex; align-items:center;">
            <span class="mull-outcome-rank">${formatExampleLabel_(idx+1)}</span>
              <div class="mull-outcome-hand">
                ${(r.typeArr || []).map((t, i) => {
                  const h = state.hand[i];
                  const isKept = h && !h.selected; // 選択してない＝キープ枠
                  const cd = isKept ? String(h.cd) : '';
                  const imgHtml = isKept
                    ? `<img alt="" loading="lazy" decoding="async"
                            src="img/${cd}.webp"
                            onerror="this.src='img/00000.webp'">`
                    : '';

                  return `
                    <div class="mull-outcome-card"
                        data-type="${t || ''}"
                        data-fixed="${isKept ? '1' : '0'}">
                      ${imgHtml}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          <div class="mull-outcome-pct">${(r.p*100).toFixed(2)}%</div>
        </div>
      `).join('')}
    </div>
  `;
  renderOutcomeMoreButton_(rows.length);
}



// タイプ別：残り山枚数表示更新
function renderRemainingByType() {
  if (!els.remainList) return;
  const types = [
    { key: 'チャージャー', label: 'チャージャー' },
    { key: 'アタッカー',   label: 'アタッカー' },
    { key: 'ブロッカー',   label: 'ブロッカー' },
  ];
  const counts = tallyPoolByType();
  els.remainList.innerHTML = '';

  for (const t of types) {
    const n = counts[t.key] ?? 0;
    const li = document.createElement('li');
    li.className = 'mrt-chip compact';
    li.dataset.type = t.key;

    // ← 文字と数字を分けて入れる（数字は常に見える）
    li.innerHTML = `<span class="mrt-name">${t.label}</span><span class="mrt-count">${n}</span>`;

    els.remainList.appendChild(li);
  }
}



// ウィンドウサイズ変更時にも更新
window.addEventListener('resize', () => {
  if (typeof renderRemainingByType === 'function') {
    renderRemainingByType();
  }
});


  // UI活性とボタン文言切替（単一ボタン仕様）
  function refreshUI(){
    const deckSize = Object.values(getDeckObject()).reduce((a,b)=>a+(b|0),0);
    const hasDeck  = deckSize >= 30;
    const anySelected = state.hand.some(h => h.selected);
    const canReset    = hasDeck && deckSize >= HAND_SIZE;
    const selN = state.hand.filter(h => h.selected).length;
    const livePoolLen = buildPoolExcludingCurrentHand().length;
    const canMull = hasDeck && selN > 0 && livePoolLen >= selN;
    const mode = (selN === 0) ? 'initial' : 'mull';

    // 警告
      if (!hasDeck) {
    if (els.hand) els.hand.innerHTML = '';      // 手札のカードを消す
    if (els.hand) els.hand.style.display = 'none'; // 非表示
    if (els.warning) els.warning.hidden = false;   // 警告ON
  } else {
    if (els.hand) els.hand.style.display = '';     // 通常表示
    if (els.warning) els.warning.hidden = true;    // 警告OFF
  }

    // 文言
    if (els.btn) {
      els.btn.textContent = anySelected
        ? `${state.hand.filter(h => h.selected).length}枚マリガンする`
        : '手札リセット';
      // 活性
      els.btn.disabled = anySelected ? !canMull : !canReset;
    }

    renderRemainingByType();

    // ✅ モードが変わった時だけ「閉じる」に戻す
    if (state.outcomeMode !== mode) {
      state.outcomeExpanded = false;
      state.outcomeMode = mode;
    }

    if (selN === 0) {
      if (els.outcomeBox) {
        els.outcomeBox.innerHTML = `
          <div class="mull-remaining-title">初期手札パターンの目安</div>
          <div class="mull-outcome-grid"></div>
        `;
      }
      renderInitialHandOutcomeProbs();
    } else {
      renderMulliganOutcomeProbs();
    }
  }


  // マリガン（“今回”返したカードだけ抽選から除外）
  function doMulligan(){
    // 現在手札を除いた山を作り直す
  let pool = buildPoolExcludingCurrentHand();
  // 置き換え対象のインデックスを先に列挙
  const targets = [];
  for (let i=0;i<state.hand.length;i++) if (state.hand[i].selected) targets.push(i);
  // 選択枚数ぶん、poolから順番に補充（同一回の重複を避けるためpop）
  for (const pos of targets) {
    const next = pool.pop(); // 無ければ undefined
    if (!next) break;        // 引けなければそこで終了（見た目は据え置き）
    state.hand[pos].cd = next;
    state.hand[pos].selected = false;
  }

    renderHand();
    refreshUI();
  }

  // 手札リセット（discardedをクリア → デッキから再配り）
  function resetHand(){ dealInitialHand(); }

  // 単一ボタン：選択0→リセット / 1〜4→マリガン
  els.btn?.addEventListener('click', () => {
    const anySelected = state.hand.some(h => h.selected);
    if (anySelected) doMulligan();
    else resetHand();
  });

  // デッキ側の更新に追従
  const hookOnce = (name, wrapper) => {
    const fn = window[name];
    if (typeof fn === 'function' && !fn.__mull_hooked){
      const orig = fn;
      window[name] = function(...args){
        const r = orig.apply(this, args);
        try { wrapper(); } catch {}
        return r;
      };
      window[name].__mull_hooked = true;
    }
  };
  hookOnce('renderDeckList',        () => dealInitialHand());
  hookOnce('updateDeckAnalysis',    () => dealInitialHand());
  hookOnce('updateDeckSummaryDisplay', () => dealInitialHand());

  // カードロード完了時
  window.onCardsLoaded = (function(prev){
    return function(...args){
      if (typeof prev === 'function') prev.apply(this, args);
      dealInitialHand();
    };
  })(window.onCardsLoaded);

  // タブ移動（情報タブに入ったら更新）
  const origAfter = window.afterTabSwitched;
  window.afterTabSwitched = function(targetId){
    if (typeof origAfter === 'function') origAfter(targetId);
    if (targetId === 'info-tab' || targetId === 'edit') {
      dealInitialHand();
    }
  };

  // 初回
  dealInitialHand();
})();


/* =========================
    🆕 不足カード集計＋表示ロジック
    ========================= */

// 所持データが変わったら自動で再計算（OwnedStore.onChange があるので利用）
if (window.OwnedStore?.onChange) {
  window.OwnedStore.onChange(() => updateExchangeSummary());
}

// ===== 不足カードをレアリティ別に集計 =====
function groupShortageByRarity(shortages){
  const sum = { LEGEND:0, GOLD:0, SILVER:0, BRONZE:0 };
  if (!Array.isArray(shortages)) return sum;
  shortages.forEach(s=>{
    const info = cardMap[s.cd] || {};
    const key = rarityToKeyJP(info.rarity);
    if (key) sum[key] += (s.shortage|0);
  });
  return sum;
}

// ===== 不足カードをレアリティ別に集計（保険：未定義ならここで生やす）=====
window.groupShortageByRarity = window.groupShortageByRarity || function(shortages){
  const sum = { LEGEND:0, GOLD:0, SILVER:0, BRONZE:0 };
  if (!Array.isArray(shortages)) return sum;

  const cardMapLocal = window.cardMap || window.allCardsMap || {};
  const rarityToKeyJPLocal = window.rarityToKeyJP || function(r){
    // ここはあなたの既存の変換に合わせてください（最低限の保険）
    if (r === 'レジェンド' || r === 'LEGEND') return 'LEGEND';
    if (r === 'ゴールド'   || r === 'GOLD')   return 'GOLD';
    if (r === 'シルバー'   || r === 'SILVER') return 'SILVER';
    if (r === 'ブロンズ'   || r === 'BRONZE') return 'BRONZE';
    return null;
  };

  shortages.forEach(s=>{
    const info = cardMapLocal[String(s.cd)] || {};
    const key = rarityToKeyJPLocal(info.rarity);
    if (key) sum[key] += (s.shortage|0);
  });
  return sum;
};


/** コンパクト不足UIの描画 */
function renderShortageCompact(shortages){
  const line  = document.getElementById('shortage-summary-line');
  const list  = document.getElementById('shortage-collapsible');
  if (!line || !list) return;

  const sum = window.groupShortageByRarity(shortages);

  // リスト描画
  line.innerHTML = `
    <span class="rar-item">${RARITY_ICON.LEGEND}レジェンド${sum.LEGEND}枚</span>
    <span class="rar-item">${RARITY_ICON.GOLD}ゴールド${sum.GOLD}枚</span>
    <span class="rar-item">${RARITY_ICON.SILVER}シルバー${sum.SILVER}枚</span>
    <span class="rar-item">${RARITY_ICON.BRONZE}ブロンズ${sum.BRONZE}枚</span>
  `;

    // 🔽🔽 ここを追加：リストを毎回リセットしてから描画
    list.innerHTML = '';

  // 空ならメッセージだけを 1 回だけ表示
  if (!shortages.length) {
  list.textContent = '不足はありません';
  return;
  }

  // 空でないときだけヒントを入れる
  const hint = document.createElement('div');
  hint.className = 'shortage-hint';
  hint.textContent = 'タップ/クリックでカード表示';
  list.appendChild(hint);


  const typeOrder = { 'チャージャー':0, 'アタッカー':1, 'ブロッカー':2 };
  const sorted = shortages.slice().sort((a,b)=>{
    const A = cardMap[a.cd] || {}, B = cardMap[b.cd] || {};
    const tA = typeOrder[A.type] ?? 99, tB = typeOrder[B.type] ?? 99;
    if (tA !== tB) return tA - tB;
    const cA = (parseInt(A.cost)||0), cB = (parseInt(B.cost)||0); if (cA !== cB) return cA - cB;
    const pA = (parseInt(A.power)||0), pB = (parseInt(B.power)||0); if (pA !== pB) return pA - pB;
    return String(a.cd).localeCompare(String(b.cd));
  });

  sorted.forEach(({cd, name, shortage}) => {
  const info = cardMap[cd] || {};
  const rkey = rarityToKeyJP(info.rarity);
  const icon = rkey ? RARITY_ICON[rkey] : '';
  const row  = document.createElement('div');
  row.className = 'shortage-item';
  row.dataset.cd = cd; // ← 5桁cdで画像を出すためココに保持
    row.innerHTML = `
    <span class="rar">${icon}</span>
    <span class="title" role="button" tabindex="0">${name || cd}</span>
    <span class="need">×${shortage}</span>
  `;
  list.appendChild(row);
});

  // ==== 画像プレビュー（デリゲーションで一度だけ結線）====

  const pop = document.getElementById('card-preview-pop');

  if (!window.__shortagePreviewWired) {
  window.__shortagePreviewWired = true;

  // クリックは「.title」だけをトリガー
  list.addEventListener('click', (e) => {
    // ★ クリック元が .title かどうかを厳密に判定
    const titleEl = e.target.closest('.title');
    if (!titleEl) return;

    e.stopPropagation();

    const item = titleEl.closest('.shortage-item');
    const cd = item?.dataset.cd;
    if (!cd) return;

    const x = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const y = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;

    showCardPreviewAt(x, y, cd);
  }, { passive: true });

  // キーボード操作（Enter/Space）でも .title から開けるように
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const titleEl = e.target.closest('.title');
    if (!titleEl) return;

    e.preventDefault();
    e.stopPropagation();

    const item = titleEl.closest('.shortage-item');
    const cd = item?.dataset.cd;
    if (!cd) return;

    // キー操作時はタイトル要素の位置周辺に出す
    const rect = titleEl.getBoundingClientRect();
    const x = rect.right;
    const y = rect.bottom;
    showCardPreviewAt(x, y, cd);
    const vw = window.innerWidth, vh = window.innerHeight, r = pop.getBoundingClientRect();
    let nx = Math.min(Math.max(x, 8), vw - r.width - 8);
    let ny = Math.min(Math.max(y, 8), vh - r.height - 8);
    pop.style.left = nx + 'px'; pop.style.top = ny + 'px';
  });
}

}



// ==== 未所持カード画像プレビュー共通層 ====
/*
function ensureCardPreviewLayer() {
  if (document.getElementById('card-preview-pop')) return;
  const el = document.createElement('div');
  el.id = 'card-preview-pop';
  el.style.position = 'fixed';
  el.style.display = 'none';
  el.style.zIndex = 3000;
  el.innerHTML = `<img style="max-width:200px;border-radius:6px;box-shadow:0 0 8px rgba(0,0,0,.5);" />`;
  document.body.appendChild(el);
}


function showCardPreviewAt(x, y, cd) {
  ensureCardPreviewLayer();
  const box = document.getElementById('card-preview-pop');
  const img = box.querySelector('img');

  // 画像セット（5桁→webp、なければ 00000 へフォールバック）
  const src = `img/${String(cd).slice(0,5)}.webp`;
  img.onload = null;
  img.onerror = () => { img.onerror = null; img.src = 'img/00000.webp'; };
  img.src = src;

  // 位置計算（はみ出し防止）
  const PAD = 8;
  const vw = window.innerWidth, vh = window.innerHeight;
  const W  = 200, H = 280; // だいたいの最大想定
  let left = x + PAD, top = y + PAD;
  if (left + W > vw) left = Math.max(PAD, x - W - PAD);
  if (top + H > vh) top = Math.max(PAD, vh - H - PAD);

  box.style.left = `${left}px`;
  box.style.top  = `${top}px`;
  box.style.display = 'block';
}
function hideCardPreview() {
  const box = document.getElementById('card-preview-pop');
  if (box) box.style.display = 'none';
}
*/

// 画面のどこかをクリックしたら閉じる（プレビュー上のクリックは除外）
document.addEventListener('click', (e) => {
  const pop = document.getElementById('card-preview-pop');
  if (pop && pop.style.display !== 'none' && !e.target.closest('#card-preview-pop')) {
    hideCardPreview();
  }
});


/*未所持リスト閉じるorタブ切り替え時にプレビュー閉じる*/
document.getElementById('shortage-toggle-btn')?.addEventListener('click', ()=> hideCardPreview());
document.addEventListener('deckTabSwitched', ()=> hideCardPreview()); // 既存フックが無ければ afterTabSwitched 内で直接呼んでもOK




/** まとめ：計算→新UI描画 */
function renderOwnedInfoCompact(){
  const ownedBox = document.getElementById('owned-info');
  if (!ownedBox) return;

  const { pointTotal, diamondTotal, sand, shortages, packPoint } = computeExchangeNeeds();

  // 未所持リスト（レアリティ枚数サマリ＋カード行）
  renderShortageCompact(shortages);
  // 合計のコンパクト表示（ポイント/ダイヤ/砂）
  // ★ ポイント時の内訳描画に必要な packPoint も渡す
  setExchangeCompact({ point: pointTotal, diamond: diamondTotal, sand, packPoint });
}


// 所持データがあるか？（OwnedStore優先、なければ localStorage）
function hasOwnedData() {
  // 1) OwnedStore
  if (window.OwnedStore?.getAll) {
    const all = window.OwnedStore.getAll() || {};
    for (const cd in all) {
      const v = all[cd] || {};
      const total = (v.normal|0) + (v.shine|0) + (v.premium|0);
      if (total > 0) return true;
    }
  }
  // 2) localStorage フォールバック
  try {
    const raw = JSON.parse(localStorage.getItem('ownedCards') || '{}') || {};
    for (const cd in raw) {
      const v = raw[cd];
      if (typeof v === 'object') {
        if ((v.normal|0) + (v.shine|0) + (v.premium|0) > 0) return true;
      } else if ((v|0) > 0) {
        return true;
      }
    }
  } catch {}
  return false;
}

/** 所持データの有無に合わせた表示制御 */
function updateOwnedInfoVisibility(){
  const box = document.getElementById('owned-info');
  if (!box) return;
  const show = hasOwnedData();   // ← ownedOverlayOn ではなく所持データの有無で判定
  box.style.display = show ? '' : 'none';
}

/* 初期化：ボタンイベントと初期描画 */
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('shortage-toggle-btn')?.addEventListener('click', ()=>{
    const area = document.getElementById('shortage-collapsible');
    if (!area) return;
    const now = area.hasAttribute('hidden');
    if (now) area.removeAttribute('hidden'); else area.setAttribute('hidden','');
  });
  document.getElementById('exchange-toggle-btn-compact')?.addEventListener('click', toggleExchangeCompact);

  // 初期表示
  renderOwnedInfoCompact();
  updateOwnedInfoVisibility();
});

/* 所持ON/OFF・計算更新のたびに同期 */
const _oldToggleOwned = window.toggleOwned;
window.toggleOwned = function(){
  _oldToggleOwned?.();
  renderOwnedInfoCompact();
  updateOwnedInfoVisibility();
};
const _oldUpdateExchangeSummary = window.updateExchangeSummary;
window.updateExchangeSummary = function(){
  _oldUpdateExchangeSummary?.();
  renderOwnedInfoCompact();
  updateOwnedInfoVisibility();
};

/* 分析タブへ移動したときも同期 */
const _goToAnalyzeTab = window.goToAnalyzeTab;
window.goToAnalyzeTab = function(){
  _goToAnalyzeTab?.();
  renderOwnedInfoCompact();
  updateOwnedInfoVisibility();
};

/* 所持データ変更イベント（OwnedStoreがあれば） */
if (window.OwnedStore?.onChange) {
  window.OwnedStore.onChange(()=>{
    renderOwnedInfoCompact();
    updateOwnedInfoVisibility();
  });
}




// グローバル公開（HTMLの onclick から使う）

window.updateExchangeSummary = updateExchangeSummary;


// deck & cardMap から並び順に展開（タイプ→コスト→パワー→cd）
function getDeckCardsArray(){
  const entries = Object.entries(deck);
  const TYPE_ORDER = {'チャージャー':0,'アタッカー':1,'ブロッカー':2};
  entries.sort((a,b)=>{
    const A = cardMap[a[0]]||{}, B = cardMap[b[0]]||{};
    const tA = TYPE_ORDER[A.type] ?? 99, tB = TYPE_ORDER[B.type] ?? 99;
    if (tA !== tB) return tA - tB;
    const cA = (A.cost|0), cB = (B.cost|0); if (cA !== cB) return cA - cB;
    const pA = (A.power|0), pB = (B.power|0); if (pA !== pB) return pA - pB;
    return String(a[0]).localeCompare(String(b[0]));
  });
  const out = [];
  for (const [cd, count] of entries) for (let i=0;i<count;i++) out.push(cd);
  return out;
}


/*デッキ名同期
* デッキ情報のデッキ名とデッキ投稿のデッキ名が同じになるようにする
* 未設定時は「デッキリスト」を既定表示
*/
(function () {
  const $ = (id) => document.getElementById(id);
  const infoNameEl = $('info-deck-name');
  const postNameEl = $('post-deck-name');
  const titleEl    = $('note-side-title');

  // 双方向同期：info/post → 両方、タイトルは空なら空のまま（CSSで“デッキリスト”表示）
  function setBoth(val) {
    const v = val ?? '';
    if (infoNameEl && infoNameEl.value !== v) infoNameEl.value = v;
    if (postNameEl && postNameEl.value !== v) postNameEl.value = v;
    if (titleEl) {
      titleEl.textContent = v; // 空の時は空文字 → :empty::before で“デッキリスト”が出る
    }
  }

  // 入力欄→相互反映
  infoNameEl?.addEventListener('input', () => { setBoth(infoNameEl.value.trim()); scheduleAutosave?.(); });
  postNameEl?.addEventListener('input', () => { setBoth(postNameEl.value.trim()); scheduleAutosave?.(); });

  // ===== タイトルをその場編集 =====
  function selectAll(el){
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  function beginEdit(){
    if (!titleEl || titleEl.isContentEditable) return;
    titleEl.dataset.prev = titleEl.textContent.trim();
    titleEl.contentEditable = 'true';
    titleEl.focus();
    selectAll(titleEl);
  }
  function commitEdit(ok=true){
    if (!titleEl || !titleEl.isContentEditable) return;
    titleEl.contentEditable = 'false';
    const next = ok ? titleEl.textContent.trim() : (titleEl.dataset.prev || '');
    // commit: 両入力にも反映。空ならタイトルは空文字（見た目は“デッキリスト”）
    setBoth(next);
    scheduleAutosave?.();
  }

  // クリックで編集開始
  titleEl?.addEventListener('click', (e) => {
    // 既に編集中なら無視
    if (titleEl.isContentEditable) return;
    beginEdit();
  });

  // Enterで確定 / Escでキャンセル / フォーカス外れたら確定
  titleEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(true); }
    else if (e.key === 'Escape') { e.preventDefault(); commitEdit(false); }
  });
  titleEl?.addEventListener('blur', () => commitEdit(true));

  // 外部からの同期（復元トーストの“復元する”押下時などで呼ぶ）
  window.syncDeckNameFields = function () {
    const name = (postNameEl?.value?.trim()) || (infoNameEl?.value?.trim()) || '';
    setBoth(name);
  };

  // 初期同期：読み込み直後に一度（空ならタイトルは空＝“デッキリスト”表示）
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => window.syncDeckNameFields?.(), { once: true });
  } else {
    window.syncDeckNameFields?.();
  }
})();



// ===== deck-code-controls が画面に見えていない時だけ、画面下に“浮遊バー”を出す（モバイル用） =====
(function setupFloatingDeckControls(){
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  // ★ 現在のタブ状態を判定（afterTabSwitchedの仕様と一致させる）
  function isDeckAnalysisInfoOpen() {
    const analysisTab = document.getElementById('edit');
    const infoTab = document.getElementById('info-tab');
    return (
      analysisTab?.classList.contains('active') &&
      infoTab?.classList.contains('active')
    );
  }

  function ensureFloating() {
    let float = document.getElementById('deck-code-controls-float');
    if (float) return float;
    const original = document.querySelector('.deck-code-controls');
    if (!original) return null;

    float = document.createElement('div');
    float.id = 'deck-code-controls-float';
    float.className = 'deck-code-controls floating';
    float.innerHTML = original.innerHTML;
    document.body.appendChild(float);

    float.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.preventDefault();

      const floatBtns = Array.from(float.querySelectorAll('button'));
      const idx = floatBtns.indexOf(btn);
      if (idx < 0) return;

      const origBtns = Array.from(original.querySelectorAll('button'));
      if (origBtns[idx]) origBtns[idx].click();
    });
    return float;
  }

  function installObserver() {
    const original = document.querySelector('.deck-code-controls');
    const float = ensureFloating();
    if (!original || !float) return;

    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];

      // ★ 新しい条件：モバイル＆「デッキ分析」＋「デッキ情報」タブが開いている時のみ有効
      if (!isMobile() || !isDeckAnalysisInfoOpen()) {
        float.style.display = 'none';
        return;
      }

      // 元のコントロールが画面内に見えていない時だけ出す
      if (entry.isIntersecting) {
        float.style.display = 'none';
      } else {
        float.style.display = 'flex';
      }
    }, { root: null, threshold: 0.01 });

    io.observe(original);

    // タブ切替時にも即座に状態更新
    document.addEventListener('click', (e) => {
      if (e.target.closest('.tab')) {
        setTimeout(() => {
          const rect = original.getBoundingClientRect();
          const visible = rect.top < window.innerHeight && rect.bottom > 0;
          float.style.display = (isMobile() && !visible && isDeckAnalysisInfoOpen()) ? 'flex' : 'none';
        }, 200);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installObserver, { once: true });
  } else {
    installObserver();
  }
})();



//#endregion


// ===== Deck Peek：モバイルで分析中にデッキリストが見えていない時、左上のボタン長押しでミニリストを表示 =====
(function setupDeckPeek(){
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  // 「デッキ分析」タブが開いているか（ info/post サブタブは不問）
  function isEditTabOpen() {
    const analysisTab = document.getElementById('edit');
    return !!analysisTab?.classList.contains('active');
  }

  // 要素生成（1回だけ）
  function ensureNodes(){
    let btn = document.getElementById('deckpeek-button');
    let pane = document.getElementById('deckpeek-overlay');

    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'deckpeek-button';
      btn.type = 'button';
      btn.textContent = 'デッキ表示';
      document.body.appendChild(btn);
    }
    if (!pane) {
      pane = document.createElement('div');
      pane.id = 'deckpeek-overlay';
      pane.innerHTML = `<div class="deckpeek-grid" id="deckpeek-grid"></div>`;
      document.body.appendChild(pane);
    }
    return { btn, pane };
  }

  // いまの deck を最小DOMでレンダリング（軽量）
  function renderDeckPeek(){
    const grid = document.getElementById('deckpeek-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // 並び順は「タイプ→コスト→パワー→cd」（既存の getDeckCardsArray に合わせる）
    const cds = (typeof getDeckCardsArray === 'function') ? getDeckCardsArray() : [];
    if (!cds.length) {
      grid.innerHTML = '<div style="padding:6px;color:#666;font-size:12px;">デッキが空です</div>';
      return;
    }

    // 枚数を出すため、cd→枚数マップを作る
    const counts = {};
    for (const [cd, n] of Object.entries(window.deck || {})) counts[String(cd)] = n|0;

    // 代表カード強調は負荷増を避けて省略（必要なら角枠など追加可）
    const unique = Array.from(new Set(cds)); // 画像は1枚でOK（×Nはバッジに）
    unique.forEach(cd => {
      const wrap = document.createElement('div');
      wrap.className = 'deckpeek-card';

      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = `img/${String(cd).slice(0,5)}.webp`;
      img.onerror = () => { img.onerror=null; img.src='img/00000.webp'; };

      const badge = document.createElement('div');
      badge.className = 'count-badge';
      badge.textContent = `×${counts[String(cd)] || 1}`;

      wrap.appendChild(img);
      wrap.appendChild(badge);
      grid.appendChild(wrap);
    });
  }

  // 表示制御：モバイル && editタブ && deck-card-list が画面内に無い → ボタン表示
  let io = null;
  function installObserver(){
    const { btn, pane } = ensureNodes();
    const list  = document.getElementById('deck-card-list');
    const modal = document.getElementById('noteFullModal');
    if (!list || !modal) return;

    // ▼ 表示状態を一元的に更新する関数
    const updateDeckpeekVisibility = (visibleEntry) => {
      const visible = !!visibleEntry?.isIntersecting; // deck-card-list が画面内か
      const modalOpen = getComputedStyle(modal).display === 'flex'; // ←ご指定の条件

      // 通常条件（モバイル + 編集タブ + リストが画面外） or モーダル開
      const show = (isMobile() && isEditTabOpen() && !visible) || modalOpen;

      btn.style.display = show ? 'inline-flex' : 'none';
      if (modalOpen) btn.classList.add('onModal'); else btn.classList.remove('onModal');

      if (!show) pane.style.display = 'none';
    };

    // ▼ 既存の IntersectionObserver（リストの出入り監視）
    if (window._deckpeekIO) window._deckpeekIO.disconnect();
    window._deckpeekIO = new IntersectionObserver((entries)=>{
      updateDeckpeekVisibility(entries[0]);
    }, { root: null, threshold: 0.05 });
    window._deckpeekIO.observe(list);

    // ▼ 追加：モーダルの display/class 変化を監視（開閉に即応）
    if (window._noteFullMO) window._noteFullMO.disconnect();
    window._noteFullMO = new MutationObserver(()=>{
      // エントリが無いとき用に visible=false 相当で評価
      updateDeckpeekVisibility({ isIntersecting: false });
    });
    window._noteFullMO.observe(modal, { attributes: true, attributeFilter: ['style','class'] });

    // 初期反映
    // IntersectionObserver の初回発火を待たずに即評価
    updateDeckpeekVisibility({ isIntersecting: false });
  }




    // ===== メイン種族カラー反映 =====
  function updateDeckPeekButtonColor() {
    const btn = document.getElementById('deckpeek-button');
    if (!btn) return;

    const mainRace = getMainRace?.();  // 既存関数
    const color = RACE_BG[mainRace] || 'rgba(255, 255, 255, .9)';
    btn.style.background = color;
  }

  // デッキ更新・リスト再描画・タブ切替時に色更新
  const hookColorOnce = (name) => {
    const fn = window[name];
    if (typeof fn === 'function' && !fn.__colorHooked) {
      const orig = fn;
      window[name] = function(...args){
        const r = orig.apply(this, args);
        try { updateDeckPeekButtonColor(); } catch {}
        return r;
      };
      window[name].__colorHooked = true;
    }
  };
  hookColorOnce('updateDeck');
  hookColorOnce('renderDeckList');

  document.addEventListener('click', (e)=>{
    if (e.target.closest('.tab')) {
      setTimeout(updateDeckPeekButtonColor, 200);
    }
  });

  // 初期化後にも一度呼ぶ
  document.addEventListener('DOMContentLoaded', updateDeckPeekButtonColor);


  // 長押しで表示（押している間だけ）
  function bindPressHold(){
    const { btn, pane } = ensureNodes();

    const show = () => {
      renderDeckPeek();
      pane.style.display = 'block';
    };
    const hide = () => {
      pane.style.display = 'none';
    };

    // タッチ系
    btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); show(); }, {passive:false});
    btn.addEventListener('touchend',   hide, {passive:true});
    btn.addEventListener('touchcancel',hide, {passive:true});

    // マウス系（デバッグ/エミュ用）
    btn.addEventListener('mousedown', (e)=>{ e.preventDefault(); show(); });
    window.addEventListener('mouseup', hide);
    // 指が外に出ても確実に閉じる
    window.addEventListener('blur', hide);
    window.addEventListener('scroll', hide, { passive: true });
  }

  // タブ切替時にも状態更新
  document.addEventListener('click', (e)=>{
    if (e.target.closest('.tab')) {
      setTimeout(installObserver, 200);
    }
  });

  // デッキ更新のたびにミニ描画を更新（軽量なので都度OK）
  const hookOnce = (name, wrapper) => {
    const fn = window[name];
    if (typeof fn === 'function' && !fn.__deckpeek_hooked){
      const orig = fn;
      window[name] = function(...args){
        const r = orig.apply(this, args);
        try { wrapper(); } catch {}
        return r;
      };
      window[name].__deckpeek_hooked = true;
    }
  };
  hookOnce('updateDeck', renderDeckPeek);
  hookOnce('renderDeckList', renderDeckPeek);

  // 初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=>{ installObserver(); bindPressHold(); }, {once:true});
  } else {
    installObserver();
    bindPressHold();
  }
})();


// ===== マナ効率 ヘルプモーダル =====
(function(){
  window.addEventListener('DOMContentLoaded', () => {
    const btn   = document.getElementById('mana-help-btn');
    const modal = document.getElementById('manaHelpModal');
    const close = document.getElementById('mana-help-close');

    if (btn && modal) {
      btn.addEventListener('click', () => {
        modal.style.display = 'flex'; // 他のmodalと揃える
      });
    }

    if (close && modal) {
      close.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }

    // 背景クリックで閉じる（任意だけど便利）
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }
  });
})();




//#endregion 6. デッキ情報・分析


/*======================================================
  7) デッキ保存
======================================================*/
//#region 7. デッキ画像出力

// 保存デッキリスト確認
function updateSavedDeckList() {
  const container = document.getElementById("savedDeckList");
  const counter   = document.getElementById("savedDeckCount");
  if (!container) return;

  container.innerHTML = "";

  const multiSaved = JSON.parse(localStorage.getItem("savedDecks") || "[]");

  if (counter) {
    counter.textContent = `保存デッキ数：${multiSaved.length} / 20`;
  }

  if (multiSaved.length > 0) {
    let mutated = false;
    multiSaved.forEach((deckData, index) => {
      if (!deckData.date) {
        deckData.date = window.formatYmd();
        mutated = true;
      }
      const html = generateDeckLayout(deckData, index);
      container.insertAdjacentHTML("beforeend", html);
    });
    if (mutated) {
      try {
        localStorage.setItem("savedDecks", JSON.stringify(multiSaved));
      } catch (e) {
        console.warn("保存データの読み込みに失敗:", e);
      }
    }
    return;
  }

  // 空表示
  container.innerHTML = `
    <div class="saved-deck-empty">
      <p>保存されたデッキはまだありません。</p>
    </div>
  `;
}


// 保存デッキ1件のカード集計からメイン種族を決定（イノセント・旧神を除外）
function pickMainRaceFromCounts(cardCounts) {
  const tally = {};
  for (const cd in cardCounts || {}) {
    const info = cardMap[cd];
    if (!info) continue;
    const r = info.race;
    if (r === "イノセント" || r === "旧神") continue;
    tally[r] = (tally[r] || 0) + (cardCounts[cd] || 0);
  }
  let best = "未選択", bestCnt = -1;
  for (const r in tally) {
    if (tally[r] > bestCnt) {
      best = r;
      bestCnt = tally[r];
    }
  }
  return bestCnt > 0 ? best : "未選択";
}

// 保存デッキ表示
function generateDeckLayout(deckData, index) {
  let cardImg   = "img/10001.webp";
  let deckName  = "名称未設定";
  let race      = "未選択";
  let count     = "0/30~40";
  let typeCount = "🔵0🟣0⚪️0";
  let savedDate = "";

  if (deckData && deckData.cardCounts) {
    // 集計
    let total = 0, charge = 0, attack = 0, block = 0;
    for (const cd in deckData.cardCounts) {
      const n = deckData.cardCounts[cd] || 0;
      if (n <= 0) continue;
      total += n;
      const info = cardMap[cd];
      if (!info) continue;
      if (info.type === "チャージャー") charge += n;
      if (info.type === "アタッカー")  attack += n;
      if (info.type === "ブロッカー")  block  += n;
    }
    count     = `${total}/30~40`;
    typeCount = `🔵${charge}🟣${attack}⚪️${block}`;
    deckName  = deckData.name || "名称未設定";
    race      = pickMainRaceFromCounts(deckData.cardCounts);

    if (deckData.m) {
      cardImg = "img/" + String(deckData.m).padStart(5, "0") + ".webp";
    }
    savedDate = deckData.date ? deckData.date : "";
  }

  const loadBtn   = `<button onclick="loadDeckFromIndex(${index})">🔄 読み込む</button>`;
  const deleteBtn = `<button onclick="deleteDeckFromIndex(${index})">🗑 削除</button>`;
  return `
    <div class="saved-deck-item">
      <img src="${cardImg}" alt="代表カード" />
      <div class="saved-deck-info">
        <div class="row">
          <strong>${deckName}</strong>
          <span>使用種族：${race}</span>
        </div>
        <div class="row">
          <span>${count}</span>
          <span>${typeCount}</span>
        </div>
        ${savedDate ? `<div class="row"><small>保存日時: ${savedDate}</small></div>` : ""}
      </div>
      <div class="deck-buttons">
        ${loadBtn}
        ${deleteBtn}
      </div>
    </div>
  `;
}



// 💾 現在のデッキを一時保存（複数対応）
function saveDeckToLocalStorage() {
  const saved = JSON.parse(localStorage.getItem("savedDecks") || "[]");

  // デッキオブジェクトが空なら保存しない
  if (Object.keys(deck).length === 0) {
    alert("デッキが空です");
    return;
  }

  // 代表カードとメイン種族コード算出
  const m = (representativeCd && deck[representativeCd]) ? representativeCd : (Object.keys(deck)[0] || "10001");

  const raceCodeMap = { "ドラゴン": 1, "アンドロイド": 2, "エレメンタル": 3, "ルミナス": 4, "シェイド": 5 };

  const g = raceCodeMap[getMainRace()] || 1;

  // 🔤 デッキ名（info/post どちらでもOK）を取得
  let deckNameInput = (typeof readDeckNameInput === 'function')
    ? readDeckNameInput()
    : (document.getElementById("info-deck-name")?.value?.trim() || '');

  // 未入力なら「デッキ〇」で採番し、両タブへ即時反映
  if (!deckNameInput) {
    let num = 1;
    const existingNames = saved.map(d => d.name).filter(Boolean);
    while (existingNames.includes(`デッキ${num}`)) num++;
    deckNameInput = `デッキ${num}`;
    if (typeof writeDeckNameInput === 'function') writeDeckNameInput(deckNameInput);
    if (typeof window.syncDeckNameFields === 'function') window.syncDeckNameFields(); // 念のため
  }

  // 同名が存在する場合は上書き確認
  const existingIndex = saved.findIndex(d => d.name === deckNameInput);
  if (existingIndex !== -1) {
    if (!confirm(`同名のデッキ「${deckNameInput}」があります。上書きしますか？`)) {
      return; // キャンセル時は保存しない
    }
    // 上書き
    saved[existingIndex] = {
      name: deckNameInput,
      cardCounts: { ...deck },
      m,
      g,
      date: window.formatYmd()
    };
    //データをアプリに保存
    localStorage.setItem("savedDecks", JSON.stringify(saved));
    updateSavedDeckList();//保存デッキ表示更新
    return;
  }

  // 新規保存（上限20）
  if (saved.length >= 20) {
    alert("保存できるデッキは20件までです");
    return;
  }

  saved.push({
    name: deckNameInput,
    cardCounts: { ...deck },
    m,
    g,
    date: window.formatYmd()
  });
  localStorage.setItem("savedDecks", JSON.stringify(saved));
  updateSavedDeckList();
}

// 🔄 インデックス指定で読み込み
function loadDeckFromIndex(index) {
  const saved = JSON.parse(localStorage.getItem("savedDecks") || "[]");
  if (!saved[index]) return;
  const data = saved[index];

  // 現在のデッキをクリアして読み込み
  Object.keys(deck).forEach(k => delete deck[k]);
  Object.entries(data.cardCounts).forEach(([cd, n]) => {
    deck[cd] = n;
  });

  // 代表カード復元
  representativeCd = data.m && deck[data.m] ? data.m : null;

  // 🔽 デッキ名は両タブへ同時反映
  writeDeckNameInput(data.name || "");

  withDeckBarScrollKept(() => {
  updateDeck(); // デッキ欄更新
  renderDeckList();//デッキリスト画像更新
  });
  updateDeckSummaryDisplay();//代表カードデッキ情報表示
  updateExchangeSummary();//交換ポイント数更新
  window.scheduleAutosave?.();  //オートセーブ
  updateExchangeSummary(); // ★ 合計やパック別の再計算＆描画

  // ★ さらに現在モードのままコンパクト行も上書き
  const { pointTotal, diamondTotal, sand, packPoint } = computeExchangeNeeds();
  setExchangeCompact({
    point: pointTotal,
    diamond: diamondTotal,
    sand,
    packPoint
  });
}

// 🗑 インデックス指定で削除
function deleteDeckFromIndex(index) {
  const saved = JSON.parse(localStorage.getItem("savedDecks") || "[]");
  if (!saved[index]) return;
  saved.splice(index, 1);
  localStorage.setItem("savedDecks", JSON.stringify(saved));
  updateSavedDeckList();
  renderDeckList();//デッキリスト画像更新
}

// デッキリセット（委譲で拾う：再描画に強い）
document.addEventListener('click', (e) => {
  // どちらのボタンでも拾う（下部/上部）
  const btn = e.target.closest('#resetDeckButton, #resetDeckButtonTop');
  if (!btn) return;

  if (!confirm('現在のデッキを全てリセットします。よろしいですか？')) return;

  // =====================
  // データ初期化
  // =====================
  Object.keys(deck).forEach(k => delete deck[k]);

  // 代表カード状態を完全にリセット
  setRepresentativeCard(null, '');

  // デッキ名（情報タブ＆投稿タブ）も空に
  writeDeckNameInput('');
  const postNameEl = document.getElementById('post-deck-name');
  if (postNameEl) postNameEl.value = '';
  if (typeof window.syncDeckNameFields === 'function') {
    window.syncDeckNameFields();
  }

  // 🔁 オートセーブも消して復活しないように
  clearAutosave();

  // =====================
  // UI更新
  // =====================
  withDeckBarScrollKept(() => {
    updateDeck();
    renderDeckList();
  });

  updateDeckSummaryDisplay();
  updateExchangeSummary();

  // --- デッキ解説 ---
  const noteMain = document.getElementById('post-note');
  const noteFull = document.getElementById('note-full-text');

  if (noteMain) {
    noteMain.value = '';
    noteMain.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (noteFull) {
    noteFull.value = '';
  }

  // --- カード解説 ---
  if (window.CardNotes?.replace) {
    // 初期状態：空1行（今の仕様と一致）
    window.CardNotes.replace([{ cd: '', text: '' }]);
  }

  const hidden = document.getElementById('post-card-notes-hidden');
  if (hidden) hidden.value = '[]';

  // 最後にオートセーブ再開
  window.scheduleAutosave?.();
});


//#endregion



/*======================================================
  8) デッキ投稿フォーム関連
======================================================*/
//#region 8. デッキ投稿フォーム

// ===== サブタブの active を単一化（追加追記） =====
(function(){
  function setupExclusiveTabs(){
    // タブボタンとコンテンツの親を特定（ページ構造に合わせて調整可能）
    const tabRoot = document.getElementById('post-tab') || document; // 投稿タブ内優先で検索

    // ボタンクリックで active を排他的に付け直す
    tabRoot.querySelectorAll('[data-subtab-target]').forEach(btn => {
      if (btn.__exclusiveBound) return;
      btn.__exclusiveBound = true;

      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-subtab-target');
        if (!targetId) return;

        // ボタン側の active を単一化
        const allBtns = tabRoot.querySelectorAll('[data-subtab-target]');
        allBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // コンテンツ側の active を単一化
        const allPanels = tabRoot.querySelectorAll('.tab-content');
        allPanels.forEach(p => p.classList.remove('active'));

        const panel = tabRoot.querySelector(`#${CSS.escape(targetId)}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  window.addEventListener('DOMContentLoaded', setupExclusiveTabs);
})();


//タグ配列
window.autoTagList     ??= []; // updateAutoTags()
window.selectedTagList ??= []; // renderPostSelectTags()
const userTagInput = document.getElementById('user-tag-input')?.value || '';


// ===== デッキ投稿で使う簡易ヘルパー =====
function getDeckCount() {
  try { return Object.values(deck || {}).reduce((a, b) => a + (b|0), 0); }
  catch { return 0; }
}

function getDeckAsArray() {
  // [{cd, count}] 形式
  return Object.entries(deck || {}).map(([cd, n]) => ({ cd, count: n|0 }));
}

function getRepresentativeImageUrl() {
  return representativeCd ? `img/${String(representativeCd).slice(0,5)}.webp` : '';
}

function exportDeckCode() {
  // まずは簡易：デッキmapをBase64化（後で独自コードに差し替え可）
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(deck || {})))); }
  catch { return ''; }
}


// === 入力監視: 解説/ユーザータグでオートセーブを走らせる ===
document.addEventListener('DOMContentLoaded', ()=>{
  const note = document.getElementById('post-note');
  if (note) note.addEventListener('input', scheduleAutosave);

  const userTagInput = document.getElementById('user-tag-input');
  const addBtn = document.getElementById('user-tag-add');
  if (userTagInput && addBtn){
    addBtn.addEventListener('click', ()=>{ setTimeout(scheduleAutosave, 0); });
    userTagInput.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') setTimeout(scheduleAutosave, 0);
    });
  }
});

// === ユーザータグ履歴（最近使ったタグ） ===
const USER_TAG_HISTORY_KEY = 'dm_user_tag_history_v1';

// 履歴読み込み
function getUserTagHistory() {
  try {
    const raw = localStorage.getItem(USER_TAG_HISTORY_KEY) || '[]';
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(s => String(s || '').trim()).filter(Boolean);
    return [];
  } catch {
    return [];
  }
}

// 履歴に1つ追加（先頭に詰め、重複除去、最大20件）
function pushUserTagHistory(tag) {
  const t = String(tag || '').trim();
  if (!t) return;

  let list = getUserTagHistory();
  list = list.filter(x => x !== t);
  list.unshift(t);
  if (list.length > 20) list = list.slice(0, 20);

  try {
    localStorage.setItem(USER_TAG_HISTORY_KEY, JSON.stringify(list));
  } catch {}
}

// どこからでも呼べるフック
window.onUserTagAdded = function(tag){
  pushUserTagHistory(tag);
};



/* ✅ 保存キー（選択状態を保持） */
const SELECT_TAGS_KEY = 'dm_post_select_tags_v1';



// ===== カード読み込み完了後のフック =====
window.onCardsLoaded = function() {
  if (typeof rebuildCardMap === 'function') rebuildCardMap();
  if (document.getElementById('select-tags')) renderPostSelectTags();
};


// ===== ユーザータグ =====
const USER_TAGS_KEY = 'dm_post_user_tags_v1';
const USER_TAG_MAX = 10;
const USER_TAG_LEN = 20;

// その後に通常の定数定義（必要なら）
const POST_TAG_CANDIDATES = window.POST_TAG_CANDIDATES || [];

/* cards データの取得（既にグローバルがあればそれを使う / なければ fetch） */
async function getAllCardsForTags() {
  // グローバルに置いてあるケースを広めに拾う
  const candidates = [window.cards, window.allCards, window.cardData, window.CARDS];
  for (const c of candidates) if (Array.isArray(c) && c.length) return c;

  // それでも無ければJSONから読む（配置場所に合わせて候補を用意）
  const tryUrls = [
    './public/cards_latest.json',
    './cards_latest.json',
    '../public/cards_latest.json',
    '../cards_latest.json',
  ];

  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();

      // is_latest がある前提なら最新のみ
      const latest = Array.isArray(data) ? data.filter(x => x?.is_latest !== false) : [];
      return latest.length ? latest : (Array.isArray(data) ? data : []);
    } catch (e) {
      // 次の候補へ
    }
  }

  console.warn('[getAllCardsForTags] cards_latest.json が見つかりませんでした');
  return [];
}
//デッキ名同期
async function initDeckPostTab() {

  // デッキ名を反映
  const srcName = document.getElementById('info-deck-name')?.value || "";
  const nameInput = document.getElementById('post-deck-name');
  if (nameInput && !nameInput.value) nameInput.value = srcName;

  // サマリー同期
  updateDeckAnalysis();
  refreshPostSummary();
  renderPostSelectTags();


}

//デッキ投稿情報表示
function refreshPostSummary() {
  const count = typeof getDeckCount === 'function'
  ? getDeckCount()
  : Object.values(deck || {}).reduce((a, b) => a + (b|0), 0);

  const races = typeof getMainRacesInDeck==='function' ? getMainRacesInDeck() : [];
  const rep = document.getElementById('deck-representative')?.textContent || '未選択';
  const rLegend = document.getElementById('rarity-legend')?.textContent ?? '0';
  const rGold   = document.getElementById('rarity-gold')?.textContent   ?? '0';
  const rSilver = document.getElementById('rarity-silver')?.textContent ?? '0';
  const rBronze = document.getElementById('rarity-bronze')?.textContent ?? '0';

  document.getElementById('post-deck-count')?.replaceChildren(document.createTextNode(count));
  document.getElementById('post-deck-races')?.replaceChildren(document.createTextNode(races.join(' / ') || '-'));
  document.getElementById('post-representative')?.replaceChildren(document.createTextNode(rep));

  // 隠し値（送信用）
  document.getElementById('post-deck-code')?.setAttribute('value', typeof exportDeckCode==='function' ? exportDeckCode() : '');
  document.getElementById('post-races-hidden')?.setAttribute('value', races.join(','));
  // 代表カードの画像URLなど（あなたの実装に合わせて取得）
  const repImg = typeof getRepresentativeImageUrl==='function' ? getRepresentativeImageUrl() : '';
  document.getElementById('post-rep-img')?.setAttribute('value', repImg);
}

// ---- デッキ解説：プリセットボタン → 文章挿入 ----
function insertAtCursor(el, text) {
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end   = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after  = el.value.slice(end);
  el.value = before + text + after;

  const pos = start + text.length;
  try {
    el.selectionStart = el.selectionEnd = pos;
  } catch (e) {}
  // 入力更新を他ロジックに通知
  el.dispatchEvent(new Event('input'));
}


// === cardOpModal open from note-side ===
(function attachNoteSideOpenCardOp(){
  const list = document.getElementById('note-side-list');
  if (!list) return;
  list.addEventListener('click', (e)=>{
    const row = e.target.closest('.note-card-row');
    if (!row) return;
    const cardId = row.dataset.cardId || row.getAttribute('data-card-id');
    if (!cardId) return;

    // 既存の起動関数に合わせて順にトライ
    if (typeof window.openCardOpModal === 'function') {
      window.openCardOpModal(cardId);
      return;
    }
    if (typeof window.showCardOpModal === 'function') {
      window.showCardOpModal(cardId);
      return;
    }
    if (typeof window.openCardOperationModal === 'function') {
      window.openCardOperationModal(cardId);
      return;
    }
    // 最終手段: カスタムイベント（受け側があれば拾える）
    document.dispatchEvent(new CustomEvent('open-cardop', { detail: { cardId }}));
  });
})();


  /* =========================
   カード解説モジュール（統一版）
   - 表示：要求レイアウト（thumb/↑↓/削除/ピックボタン/textarea）
   - 保存：#post-card-notes-hidden に JSON を常にミラー
   - 追加/削除/上下移動/カード選択モーダル対応
========================= */
const CardNotes = (() => {
  const MAX = 20;
  let cardNotes = [];       // [{cd, text}]
  let pickingIndex = -1;

  // --- 要素取得ヘルパ ---
  const elWrap       = () => document.getElementById('post-card-notes');
  const elHidden     = () => document.getElementById('post-card-notes-hidden');
  const elModal      = () => document.getElementById('cardNoteSelectModal');   // 既存の候補モーダル
  const elCandidates = () => document.getElementById('cardNoteCandidates');    // ↑内のグリッド

  const cdToImg = (cd) => `img/${String(cd||'').slice(0,5) || '00000'}.webp`;
  const cdToName = (cd) => (window.cardMap?.[cd]?.name) || '';

  // --- 外部へ渡すAPI（loadAutosave等から使う） ---
  function replace(arr){
    cardNotes = Array.isArray(arr) ? arr.map(r => ({cd:String(r.cd||''), text:String(r.text||'')})) : [];
    renderRows();
  }
  function get(){ return cardNotes.slice(); }

  // --- 描画 ---
  function renderRows(){
    const root = elWrap(); if (!root) return;
    root.innerHTML = '';

    cardNotes.forEach((row, i) => {
      const cd = String(row.cd||'');
      const item = document.createElement('div');
      item.className = 'post-card-note';
      item.dataset.index = String(i);
      const cardName = cdToName(cd) || 'カードを選択';

      item.innerHTML = `
        <div class="left">
          <div class="thumb">
            <img alt="" src="${cdToImg(cd)}" onerror="this.src='img/00000.webp'">
          </div>
          <div class="actions">
            <button type="button" class="note-move" data-dir="-1">↑</button>
            <button type="button" class="note-move" data-dir="1">↓</button>
            <button type="button" class="note-remove">削除</button>
          </div>
        </div>
        <button type="button" class="pick-btn">${cardName}</button>
        <textarea class="note" placeholder="このカードの採用理由・使い方など"></textarea>
      `;

      // テキスト反映 & 入力で保存
      const ta = item.querySelector('textarea.note');
      ta.value = row.text || '';
      ta.addEventListener('input', () => {
        // ★まずモデルへ反映（これが無いとrenderRowsで消える）
        if (cardNotes[i]) cardNotes[i].text = ta.value;
        syncHidden();
      });

      // 画像クリックでもピッカー
      item.querySelector('.thumb img')?.addEventListener('click', () => openPickerFor(i));

      root.appendChild(item);
    });

    syncHidden();
  }

  function syncHidden(){
    const out = Array.from(elWrap().querySelectorAll('.post-card-note')).map(n => {
      const i = Number(n.dataset.index || 0);
      const text = n.querySelector('.note')?.value ?? '';
      if (cardNotes[i]) cardNotes[i].text = text; // ★モデルへ反映（trimするならここで）
      const cd   = String(cardNotes[i]?.cd || '');
      const t    = String(text).trim();
      return (cd || t) ? { cd, text: t } : null;
    }).filter(Boolean);

    if (elHidden()) elHidden().value = JSON.stringify(out);
    if (typeof window.scheduleAutosave === 'function') window.window.scheduleAutosave?.();
  }

  // --- 行操作 ---
  function addRow(initial={cd:'', text:''}){
    if (cardNotes.length >= MAX) { alert(`カード解説は最大 ${MAX} 件までです`); return; }
    cardNotes.push({ cd:String(initial.cd||''), text:String(initial.text||'') });
    renderRows();
  }
  function removeRow(index){
    cardNotes.splice(index,1);
    renderRows();
  }
  function moveRow(index, dir){
    const j = index + dir;
    if (j < 0 || j >= cardNotes.length) return;
    [cardNotes[index], cardNotes[j]] = [cardNotes[j], cardNotes[index]];
    renderRows();
  }

  // --- ピッカー ---
  function currentDeckUniqueCds(){
    // デッキ内ユニークCD（表示の並びはあなたの既存規則に合わせる）
    const set = new Set(Object.keys(window.deck || {}));
    return Array.from(set);
  }

function ensureImg(img, cd){ img.src = cdToImg(cd); img.onerror = () => img.src = 'img/00000.webp'; }

const sortByRule = (arr) => {
  const map = window.cardMap || {};
  const TYPE_ORDER = { 'チャージャー':0, 'アタッカー':1, 'ブロッカー':2 };

  return arr.slice().sort((a,b)=>{
    const A = map[a] || {};
    const B = map[b] || {};

    const tA = TYPE_ORDER[A.type] ?? 99;
    const tB = TYPE_ORDER[B.type] ?? 99;
    if (tA !== tB) return tA - tB;

    const cA = +A.cost  || 0, cB = +B.cost  || 0;
    if (cA !== cB) return cA - cB;

    const pA = +A.power || 0, pB = +B.power || 0;
    if (pA !== pB) return pA - pB;

    return String(a).localeCompare(String(b));
  });
};


  function addRow(initial={cd:'', text:''}){
    syncHidden(); // ★いまの入力を確定してから
    if (cardNotes.length >= MAX) { alert(`カード解説は最大 ${MAX} 件までです`); return; }
    cardNotes.push({ cd:String(initial.cd||''), text:String(initial.text||'') });
    renderRows();
  }

  function removeRow(index){
    syncHidden();
    cardNotes.splice(index,1);
    renderRows();
  }

  function moveRow(index, dir){
    syncHidden();
    const j = index + dir;
    if (j < 0 || j >= cardNotes.length) return;
    [cardNotes[index], cardNotes[j]] = [cardNotes[j], cardNotes[index]];
    renderRows();
  }

  function openPickerFor(index){
    syncHidden();
    pickingIndex = index|0;

    const list = currentDeckUniqueCds();
    if (!list.length){ alert('デッキが空です。先にカードを追加してください。'); return; }

    const used = new Set(cardNotes.filter((_,i)=>i!==pickingIndex).map(r=>String(r.cd)).filter(Boolean));
    const grid = elCandidates(); if (!grid) return;
    grid.innerHTML = '';
    sortByRule(list.slice()).forEach(cd=>{
      const wrap = document.createElement('div');
      wrap.className = 'item' + (used.has(cd) ? ' disabled' : '');
      wrap.dataset.cd = cd;
      const img = document.createElement('img'); ensureImg(img, cd); wrap.appendChild(img);
      if (!used.has(cd)) wrap.addEventListener('click', ()=>pickCard(cd));
      grid.appendChild(wrap);
    });
    showPickerModal(true);
  }
  function showPickerModal(open){ const m = elModal(); if (m) m.style.display = open ? 'block' : 'none'; }
  function pickCard(cd){
    if (pickingIndex < 0) return;
    cardNotes[pickingIndex].cd = String(cd);
    renderRows(); showPickerModal(false); pickingIndex = -1;
  }


  // --- 初期化：hiddenから読んで描画（ページ初回表示用） ---
  (function initOnce(){
    try{
      const raw = (elHidden()?.value || '[]');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        cardNotes = arr.map(r => ({cd:String(r.cd||''), text:String(r.text||'')}));
      }
    }catch(_){}
    if (!cardNotes.length) cardNotes = [{ cd:'', text:'' }]; // ★空なら1行作る
    renderRows();
  })();

  // --- クリック委任（追加/削除/上下/ピッカー/閉じる） ---
  document.addEventListener('click', (e)=>{
    if (e.target.id === 'add-card-note') { // ★HTMLのidと一致
      e.preventDefault();
      addRow();
      return;
    }
    const row = e.target.closest('.post-card-note');
    if (row){
      const idx = row.dataset.index|0;
      if (e.target.matches('.note-remove')) { removeRow(idx); return; }
      if (e.target.matches('.note-move')) {
        const dir = parseInt(e.target.dataset.dir,10)||0; moveRow(idx, dir); return;
      }
      if (e.target.matches('.pick-btn, .thumb img')) { openPickerFor(idx); return; }
    }
    if (e.target.id === 'cardNoteClose' ||
        (e.target.id === 'cardNoteSelectModal' && e.target === elModal())) {
      showPickerModal(false); pickingIndex = -1;
    }
  });

  return { replace, get, getList: get, addRow };
})();

window.CardNotes = CardNotes;

// =========================
// カード解説ノート：フォールバック & 追加ボタン結線
// =========================

// ▼ note本文のフォールバック（未定義なら用意）
window.readPostNote ??= function () {
  const el = document.getElementById('post-note');
  return (el?.value || '').trim();
};
window.writePostNote ??= function (val) {
  const el = document.getElementById('post-note');
  if (el) el.value = val || '';
};

// ▼ ノート行の最小レンダラ（既存の writeCardNotes があれば使う）
function __appendNoteRow(cd, text = '') {
  // 既存の描画APIがあるならそれを使う
  if (typeof window.readCardNotes === 'function' &&
      typeof window.writeCardNotes === 'function') {
    const curr = window.readCardNotes() || [];
    curr.push({ cd: String(cd || ''), text: String(text || '') });
    window.writeCardNotes(curr);
    return;
  }

  // フォールバック描画：#post-card-notes に1行追加
  const wrap = document.getElementById('post-card-notes');
  if (!wrap) return;
  const row = document.createElement('div');
  row.className = 'card-note-row';
  row.dataset.cd = String(cd || '');
  row.innerHTML = `
    <div class="cn-title">CD:${cd ? String(cd) : ''}</div>
    <textarea class="cn-text" rows="2"></textarea>
  `;
  wrap.appendChild(row);
}

// ▼ 代表カード or 最初のデッキカードを候補にするヘルパ
function __pickNoteTargetCd() {
  if (window.representativeCd) return String(window.representativeCd);
  const ids = Object.keys(window.deck || {});
  return ids.length ? String(ids[0]) : '';
}

// ▼ 「追加」ボタン配線
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('add-note-btn');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();

    // どのカードのノートか選ぶ：代表カード→無ければ先頭→無ければ空行
    const targetCd = __pickNoteTargetCd();

    if (!targetCd) {
      // デッキが空：空行だけ追加（後で手入力でCDを書ける構成でもOK）
      __appendNoteRow('', '');
    } else {
      __appendNoteRow(targetCd, '');
    }

    // 入力フォーカス（最後に追加した行）
    const wrap = document.getElementById('post-card-notes');
    const last = wrap?.querySelector('.card-note-row:last-child .cn-text');
    last?.focus();

    // オートセーブ
    window.scheduleAutosave?.();
  });
});


/** タブ遷移時に同期（既に afterTabSwitched があるなら post-tab を足す）
if (typeof window.afterTabSwitched === 'function') {
  const _orig = window.afterTabSwitched;
  window.afterTabSwitched = function(targetId){
    _orig(targetId);
    if (targetId === 'post-tab') initDeckPostTab();
  };
} else {
  // 念のため
  window.afterTabSwitched = function(targetId){
    if (targetId === 'post-tab') initDeckPostTab();
  };
}
*/

// =====ユーザータグ =====
/*ユーザータグ*/
(() => {
  // DOM が無ければ何もしない
  const wrap = document.getElementById('user-tags');
  const input = document.getElementById('user-tag-input');
  const addBtn = document.getElementById('user-tag-add');
  if (!wrap || !input || !addBtn) return;

  // グローバルにぶつからないよう window 下に専用名前で載せます
  window.PostUserTags = window.PostUserTags || [];

  const MAX_TAGS = 3;

  function normalize(s) {
    // 前後空白を削除、全角スペースも潰す、空文字を弾く
    return (s || '')
      .replace(/\s+/g, ' ')
      .replace(/　+/g, ' ')
      .trim();
  }

  function render() {
    wrap.innerHTML = '';
    window.PostUserTags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip active'; // 自由タグと同じ形で色はCSSの .user-tags に任せる
      chip.textContent = tag;

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'rm';
      rm.setAttribute('aria-label', `${tag} を削除`);
      rm.textContent = '×';
      rm.onclick = () => {
        window.PostUserTags.splice(i, 1);
        render();
      };

      chip.appendChild(rm);
      wrap.appendChild(chip);
    });
  }

  function addTagFromInput() {
    const raw = input.value;
    const v = normalize(raw);
    if (!v) return;

    if (window.PostUserTags.length >= MAX_TAGS) {
      alert('ユーザータグは最大3個までです');
      return;
    }
    if (window.PostUserTags.includes(v)) {
      // 重複は先頭に寄せるなど好みで
      // ここでは何もしない
      input.value = '';
      return;
    }
    window.PostUserTags.push(v);

    // ★ 追加：履歴に登録（定義されていれば）
    if (typeof window.onUserTagAdded === 'function') {
      window.onUserTagAdded(v);
    }

    input.value = '';
    render();
  }

  // Enter で追加
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTagFromInput();
    }
  });
  // 追加ボタン
  addBtn.addEventListener('click', addTagFromInput);

  // 初期描画
  render();
})();


// ===== 投稿タブ初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  const postTab = document.getElementById('post-tab');
  if (!postTab) return;

  // ★ 追加：キャンペーンミニ通知（開催中のみ表示）
  try { renderDeckmakerCampaignMiniNotice(); } catch(e){ console.warn('campaign mini error', e); }

  // ★ 追加：キャンペーンバナー（開催中のみ表示）
  try { renderDeckmakerCampaignBanner(); } catch(e){ console.warn('campaign banner error', e); }
});


// ★ Auth から安全に値を取る小ヘルパ（共通JSで定義していない場合の保険）
function getAuthSafe(){
  const A = window.Auth || {};
  return {
    token: A.token || '',
    user : (A.user || null)
  };
}

//#endregion



/*======================================================
  10) 代表カード選択モーダル
======================================================*/
//#region 10. 代表カードモーダル
/* ==================================================
   3) 代表カード選択モーダル
   - 代表名をタップ → デッキから候補グリッド生成 → 選択で代表更新
   - 並び順はデッキリストと同一ルール
   ================================================== */

// 開閉
function openRepSelectModal() {
  if (!deck || Object.keys(deck).length === 0) {
    try { showToast?.('デッキが空です'); } catch {}
    return;
  }
  buildRepSelectGrid();
  const modal = document.getElementById('repSelectModal');
  if (modal) modal.style.display = 'block';
}
function closeRepSelectModal() {
  const modal = document.getElementById('repSelectModal');
  if (modal) modal.style.display = 'none';
}

// グリッド生成（renderDeckList と同じ並び順）
function buildRepSelectGrid() {
  const grid = document.getElementById('repSelectGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const typeOrder = { 'チャージャー': 0, 'アタッカー': 1, 'ブロッカー': 2 };
  const entries = Object.entries(deck || {}).sort((a, b) => {
    const [cdA] = a, [cdB] = b;
    const A = cardMap[cdA], B = cardMap[cdB];
    if (!A || !B) return 0;
    const tA = typeOrder[A.type] ?? 99, tB = typeOrder[B.type] ?? 99;
    if (tA !== tB) return tA - tB;
    const cA = (+A.cost || 0), cB = (+B.cost || 0); if (cA !== cB) return cA - cB;
    const pA = (+A.power || 0), pB = (+B.power || 0); if (pA !== pB) return pA - pB;
    return String(cdA).localeCompare(String(cdB));
  });

  for (const [cd] of entries) {
    const info = cardMap[cd];
    if (!info) continue;

    const wrap = document.createElement('div');
    wrap.className = 'item';
    wrap.style.cursor = 'pointer';
    wrap.dataset.cd = String(cd);

    const img = document.createElement('img');
    img.alt = info.name || '';
    img.loading = 'lazy';
    img.src = `img/${String(cd).slice(0,5)}.webp`;
    img.onerror = () => { img.onerror = null; img.src = 'img/00000.webp'; };

    const name = document.createElement('div');
    name.className = 'cardnote-name';
    name.textContent = info.name || '';

    wrap.appendChild(img);
    wrap.appendChild(name);

    // ★ クリックで代表カードに設定
    wrap.addEventListener('click', () => {
      const newCd = String(cd);
      // カード情報から名前を取得し、統一関数で代表カードを更新
      try {
        const info = cardMap && cardMap[newCd] ? cardMap[newCd] : null;
        setRepresentativeCard(newCd, info && info.name ? info.name : '');
      } catch (_) {
        setRepresentativeCard(newCd, '');
      }
      // オートセーブ
      if (typeof scheduleAutosave === 'function') window.scheduleAutosave?.();
      // モーダルを閉じる
      closeRepSelectModal();
    });

    grid.appendChild(wrap);
  }
}


// 代表名タップでモーダル起動／外側タップで閉じる
document.addEventListener('DOMContentLoaded', () => {
  ['deck-representative', 'post-representative'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('tap-target');
    el.style.cursor = 'pointer';
    el.title = 'タップして代表カードを選択';
    el.addEventListener('click', openRepSelectModal);
  });
  document.getElementById('repSelectClose')?.addEventListener('click', closeRepSelectModal);
  document.getElementById('repSelectModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'repSelectModal') closeRepSelectModal();
  });
});



//#endregion


/*======================================================
  12) キャンペーン関連
======================================================*/
//#region 12. キャンペーン関連（条件チェック・参加確認）
  // // ここに：キャンペーン関連の処理
// ===== キャンペーン（ミニ告知：タブバー直下） =====
async function renderDeckmakerCampaignMiniNotice(){
  const box  = document.getElementById('campaign-mini');
  const text = document.getElementById('campaign-mini-text');
  if (!box || !text) return;

  let camp = null;
  try {
    camp = await (window.fetchActiveCampaign?.() || Promise.resolve(null));
  } catch(_) {}

  const isActive =
    camp &&
    (camp.isActive === true || String(camp.isActive) === 'true') &&
    String(camp.campaignId || '');

  if (!isActive) {
    box.style.display = 'none';
    return;
  }

  const title = String(camp.title || '').trim();

  // ★「入りきらない時だけ」改行される
  const msg = title
    ? `${escapeHtml_(title)}開催中！<wbr>デッキ投稿募集中！`
    : `キャンペーン開催中！<wbr>デッキ投稿募集中！`;

  text.innerHTML = msg;
  box.style.display = '';
}


// ===== キャンペーンバナー（デッキメーカー：投稿ボタン上） =====
async function renderDeckmakerCampaignBanner(){
  const box = document.getElementById('campaign-banner');
  const titleEl = document.getElementById('campaign-banner-title');
  const textEl  = document.getElementById('campaign-banner-text');
  const rangeEl = document.getElementById('campaign-banner-range');
  if (!box || !titleEl || !textEl) return;

  let camp = null;
  try { camp = await (window.fetchActiveCampaign?.() || Promise.resolve(null)); } catch(_){ camp = null; }

  const isActive =
    camp && (camp.isActive === true || String(camp.isActive) === 'true') && String(camp.campaignId||'');

  if (!isActive) {
    box.style.display = 'none';
    return;
  }

  const rawTitle = String(camp.title || 'キャンペーン');
  const start = camp.startAt ? new Date(camp.startAt) : null;
  const end   = camp.endAt   ? new Date(camp.endAt)   : null;

  const fmt = (d)=> (d && !isNaN(d)) ? window.formatYmd(d) : '';
  const computedRange = (start||end) ? `${fmt(start)}〜${fmt(end)}` : '';

  const titleHasRange = /[（(]\s*\d{4}\/\d{1,2}\/\d{1,2}\s*〜\s*\d{4}\/\d{1,2}\/\d{1,2}\s*[)）]/.test(rawTitle);
  const cleanTitle = rawTitle
    .replace(/[（(]\s*\d{4}\/\d{1,2}\/\d{1,2}\s*〜\s*\d{4}\/\d{1,2}\/\d{1,2}\s*[)）]\s*/g, '')
    .trim();

  titleEl.textContent = cleanTitle || 'キャンペーン';
  if (rangeEl) rangeEl.textContent = (!titleHasRange && computedRange) ? computedRange : '';

  // 文言（基本形）
  textEl.textContent =
    'デッキを投稿して、キャンペーンに参加しよう！ 詳しい参加条件や報酬は、詳細をチェック！';

  box.style.display = '';

// --- ここから追記：キャンペーンタグをグローバル共有（1キャンペーン前提） ---
window.__activeCampaign = camp;
window.__activeCampaignTag = (cleanTitle || 'キャンペーン').trim();

  // バナーUI（対象タグ行）
  const tagRow  = document.getElementById('campaign-banner-tagrow');
  const tagBtn  = document.getElementById('campaign-tag-toggle');

  // ★ 毎回ここで最新のログイン状態を取る（固定しない）
  const getAuthState = ()=>{
    const A = window.Auth;
    const loggedIn = !!(A?.user && A?.token && A?.verified);

    // ★ Auth.user.x ではなく入力欄を参照
    const xRaw = document.getElementById('auth-x')?.value || '';
    const xAccount = String(xRaw).trim().replace(/^@+/, ''); // @ありでもOK
    const hasX = !!xAccount;

    return { loggedIn, hasX, xAccount };
  };


    // ===== 対象判定：チェックリスト更新 =====
  const criteriaRoot = box.querySelector('.campaign-criteria');

  function updateCriteriaUI({ isLoggedIn, hasX, hasTag }){
    if (!criteriaRoot) return;
    const map = { login: !!isLoggedIn, x: !!hasX, tag: !!hasTag };

    criteriaRoot.querySelectorAll('.criteria-item').forEach(el=>{
      const key = el.dataset.criteria;
      const ok = !!map[key];
      el.classList.toggle('is-ok', ok);
      el.classList.toggle('is-ng', !ok);
    });
  }

  window.updateCampaignBannerEligibility_ = function(){
    const st = getAuthState();
    updateCriteriaUI({
      isLoggedIn: st.loggedIn,
      hasX: st.hasX,
      hasTag: isCampaignTagSelected(),
    });
  };


  // ===== キャンペーンタグ（選択タグと同期・ログイン前でも操作OK） =====
  const campTag = ()=> String(window.__activeCampaignTag || '').trim();

  const isCampaignTagSelected = ()=>{
    const tag = campTag();
    if (!tag) return false;
    try {
      const set = window.__dmReadSelectedTags?.();
      return !!(set && set.has && set.has(tag));
    } catch(_) { return false; }
  };

  const setCampaignTagSelected = (on)=>{
    const tag = campTag();
    if (!tag) return;

    // 1) データ更新（これが正）
    try{
      const set = window.__dmReadSelectedTags?.() || new Set();
      if (on) set.add(tag); else set.delete(tag);
      window.__dmWriteSelectedTags?.(set);
    }catch(_){}

    // 2) #select-tags 側の見た目同期（あれば）
    const wrap = document.getElementById('select-tags');
    if (wrap){
      const chip = wrap.querySelector(`.chip[data-label="${CSS.escape(tag)}"]`);
      if (chip) chip.classList.toggle('active', !!on);
    }

    // 3) バナー側タグ自体も active 同期
    if (tagBtn){
      tagBtn.classList.toggle('active', !!on);
      tagBtn.setAttribute('aria-pressed', String(!!on));
    }

    // 4) チェック更新
    try{ window.updateCampaignBannerEligibility_?.(); }catch(_){}
  };

  const refreshCampaignTagUI = ()=>{
    if (!tagRow || !tagBtn) return;
    tagRow.style.display = '';
    tagBtn.textContent = campTag() || 'キャンペーン';
    tagBtn.disabled = false;              // ★ ログイン前でも押せる
    setCampaignTagSelected(isCampaignTagSelected()); // 見た目だけ同期
  };

  if (tagRow && tagBtn){
    tagBtn.onclick = ()=>{
      const next = !isCampaignTagSelected(); // ★ auth関係なくトグル
      setCampaignTagSelected(next);
    };
    refreshCampaignTagUI();
  }


  // ★ ログイン/ログアウト/プロフィール更新のたびに再描画（既存hookに追記）
  if (!window.__campaignTagHooked) {
    window.__campaignTagHooked = true;

    const orig = window.onDeckPostAuthChanged;
    window.onDeckPostAuthChanged = function(...args){
      try { orig?.apply(this, args); } catch(_) {}
      try { refreshCampaignTagUI(); } catch(_) {}
    };
  }

  // 初回判定
  window.updateCampaignBannerEligibility_();

}

// ===== 選択タグ（post.js）とのブリッジ：campaign banner から参照する =====
(function ensureDmSelectedTagsBridge(){
  const KEY = 'dm_post_select_tags_v1';

  window.__dmReadSelectedTags ??= function(){
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
    catch { return new Set(); }
  };

  window.__dmWriteSelectedTags ??= function(setOrArray){
    try{
      const arr = Array.isArray(setOrArray) ? setOrArray : Array.from(setOrArray || []);
      localStorage.setItem(KEY, JSON.stringify(arr));
    }catch(_){}
  };
})();


// 選択タグチップを押したら「tag条件」を即更新（イベント委譲）
document.addEventListener('click', (e) => {
  const chip = e.target?.closest?.('#select-tags .chip');
  if (!chip) return;

  // post.js 側の click で localStorage 更新後に読むため、1tick遅らせる
  setTimeout(() => {
    window.updateCampaignBannerEligibility_?.();
  }, 0);
});

document.getElementById('auth-x')?.addEventListener('input', () => {
  window.updateCampaignBannerEligibility_?.();
});

// ===== キャンペーン確認モーダル =====
async function onClickPostButton(){
  const posterInp = document.getElementById('auth-display-name');
  const posterName = (posterInp?.value || '').trim();

  const camp = await (window.fetchActiveCampaign?.() || Promise.resolve(null));

  const isActive =
    camp &&
    (camp.isActive === true || String(camp.isActive) === 'true');

  // キャンペーンが無ければ即投稿
  if (!isActive) {
    submitPost({ joinCampaign: false });
    return;
  }

  const result = checkCampaignEligibility_(camp);

  // 条件OK
  if (result.ok) {
    openCampaignConfirmModal({
      mode: 'ok',
      onJoin: () => submitPost({ joinCampaign: true }),
      onSkip: () => submitPost({ joinCampaign: false })
    });
  }
  // 条件NG
  else {
    openCampaignConfirmModal({
      mode: 'ng',
      reasons: result.reasons,
      onProceed: () => submitPost({ joinCampaign: false })
    });
  }
}

// ===== submitPost：onClickPostButton() → submitDeckPost() の橋渡し =====
function submitPost({ joinCampaign }) {
  // joinCampaign の意思決定だけ submitDeckPost に渡す
  window.__joinCampaign = !!joinCampaign;

  // submitDeckPost は form submit 経由でも direct call でもOK
  submitDeckPost(null, { joinCampaign: window.__joinCampaign });
}


// ===== キャンペーン参加条件チェック =====
function checkCampaignEligibility_(camp) {
  const reasons = [];

  // ログイン必須（バナーと同条件に揃えるなら token/verified も見る）
  const A = window.Auth;
  const loggedIn = !!(A?.user && A?.token && A?.verified);
  if (!loggedIn) reasons.push('ログインが必要です');

  // Xアカウント必須（入力欄を参照、@ありでもOK）
  const xRaw = document.getElementById('auth-x')?.value || '';
  const x = String(xRaw).trim().replace(/^@+/, '');
  if (!x) reasons.push('Xアカウントが未入力です');

  // ★ 対象タグ必須（バナーと同じ：window.__activeCampaignTag を選択しているか）
  const needTag = String(window.__activeCampaignTag || '').trim();
  let hasTag = false;
  try {
    const set = readSelectedTags?.() || new Set(); // page2.js内で使ってるやつ
    hasTag = !!(needTag && set.has(needTag));
  } catch (_) {}
  if (!hasTag) reasons.push('キャンペーンタグが未選択です');

  return { ok: reasons.length === 0, reasons };
}
window.checkCampaignEligibility_ = checkCampaignEligibility_;


// グローバルから使えるように
window.checkCampaignEligibility_ = checkCampaignEligibility_;

function openCampaignConfirmModal({ mode, reasons = [], onJoin, onSkip, onProceed }) {
  const modal = document.createElement('div');
  modal.className = 'campaign-confirm-modal';

  const body =
    mode === 'ok'
      ? `
        <h3>🎉 キャンペーン開催中！</h3>
        <p>このデッキはキャンペーン条件を満たしています。</p>
        <p>キャンペーンに参加して投稿しますか？</p>
      `
      : `
        <h3>⚠ キャンペーン開催中</h3>
        <p>以下の条件を満たしていません：</p>
        <ul>${reasons.map(r => `<li>${r}</li>`).join('')}</ul>
        <p>キャンペーンには参加できませんが、投稿は可能です。</p>
      `;

  modal.innerHTML = `
    <div class="modal-content">
      ${body}
      <div class="modal-actions">
        ${
          mode === 'ok'
            ? `
              <button class="primary">参加して投稿</button>
              <button class="ghost">参加せず投稿</button>
            `
            : `<button class="primary">投稿する</button>`
        }
        <button class="cancel">キャンセル</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const btns = modal.querySelectorAll('button');
  btns.forEach(btn => {
    btn.onclick = () => {
      modal.remove();
      if (btn.classList.contains('primary')) {
        mode === 'ok' ? onJoin?.() : onProceed?.();
      }
      if (btn.classList.contains('ghost')) onSkip?.();
    };
  });
}

//#endregion


