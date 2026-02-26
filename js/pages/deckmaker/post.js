// js/pages/deckmaker/post.js
/**
 * DeckMaker / Post (page-only)
 *
 * 【役割】
 * - 投稿フォーム制御（submit / validation）
 * - 投稿タグ（選択タグ・ユーザータグ・自動カテゴリタグ）
 * - payload生成（ビルダー群：buildDeckPostPayload / buildDeckFeaturesForPost）
 * - 成功/失敗UI（toast, success-check, success-modal）
 *
 * 【やらないこと】
 * - キャンペーンの可否判定・確認モーダル（campaign.js に集約）
 */
(function(){
  'use strict';

  const GAS_POST_ENDPOINT = window.DECKPOST_API_BASE || window.GAS_API_BASE;
  let isPostingDeck = false;

  // =====================================================
  // 0) 小物：Xハンドル正規化・タグ読み書き
  // =====================================================
  function normalizeHandle(v=''){
    let s = String(v || '').trim();
    if (!s) return '';
    try { s = s.normalize('NFKC'); } catch(_) {}
    s = s.replace(/\s+/g, '');
    s = s.replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, '');
    s = s.split(/[/?#]/)[0];
    s = s.replace(/[＠@]/g, '');
    if (!s) return '';
    return '@' + s;
  }

  function isValidXHandle(norm){
    const user = String(norm || '').replace(/^@/, '');
    return /^[A-Za-z0-9_]{1,15}$/.test(user);
  }

  // X入力を正規化して input に反映（共通化）
  function normalizeXInput_(){
    const xEl = document.getElementById('auth-x');
    if (!xEl) return '';
    const norm = normalizeHandle(xEl.value || '');
    if (norm) xEl.value = norm;
    return norm;
  }

  // =====================================================
  // 追記： 投稿フロー ヘルプモーダル / サブタブ排他
  // =====================================================
  function openPostFlowHelp(){
    const modal = document.getElementById('postFlowHelpModal');
    if (modal) modal.style.display = 'flex';
  }
  function closePostFlowHelp(){
    const modal = document.getElementById('postFlowHelpModal');
    if (modal) modal.style.display = 'none';
  }

  // 互換公開
  window.openPostFlowHelp = window.openPostFlowHelp || openPostFlowHelp;

  function setupPostFlowHelpModal_(){
    const btnTop   = document.getElementById('post-flow-help-btn-top');
    const btnForm  = document.getElementById('post-flow-help-btn-form');
    const btnClose = document.getElementById('post-flow-help-close');
    const modal    = document.getElementById('postFlowHelpModal');

    btnTop?.addEventListener('click', openPostFlowHelp);
    btnForm?.addEventListener('click', openPostFlowHelp);
    btnClose?.addEventListener('click', closePostFlowHelp);

    // 背景クリックで閉じる
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closePostFlowHelp();
    });
  }

  function setupExclusiveSubtabs_(){
    const tabRoot = document.getElementById('post-tab') || document;

    tabRoot.querySelectorAll('[data-subtab-target]').forEach(btn => {
      if (btn.__exclusiveBound) return;
      btn.__exclusiveBound = true;

      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-subtab-target');
        if (!targetId) return;

        // btn active 排他
        tabRoot.querySelectorAll('[data-subtab-target]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // panel active 排他
        tabRoot.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
        const panel = tabRoot.querySelector(`#${CSS.escape(targetId)}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  // =====================================================
  // 1) read/write payload用のタグ・ノート読み書き
  // =====================================================
  function readPostNote(){
    return document.getElementById('post-note')?.value || '';
  }
  function writePostNote(v){
    const el = document.getElementById('post-note');
    if (el) el.value = v || '';
  }

  // =====================================================
  // 1.5) デッキ解説プリセット（page2から移植）
  // =====================================================

  const NOTE_PRESETS = {
    "deck-overview":
`【デッキ概要】
どんなコンセプトで作ったか、狙いの動きなど。
例
このデッキは〇〇を軸に△△を狙う構築です。□□とのシナジーが強力で、序盤から中盤にかけて盤面を制圧し、終盤は☆☆でフィニッシュを狙います。

【キーカード】
主軸となるカード・シナジー解説。
※詳しい解説はカード解説欄でも可
例
- 〇〇：このデッキのエースカード。□□とのコンボで大ダメージを狙えます。

【リーサルプラン】
ライフ30点をどのように削るか、代表的な勝ち筋など。
例
8-8-8-6,10-10-10,8-10-10(+2) など。
`,

    "play-guide":
`【マリガン基準】
初手で意識するカード、キープ基準など。
例
序盤使う→キープ
終盤、メタカード→マリガン

【試合の立ち回り】
試合の全体的な流れや意識するポイントなど。
〈序盤〉

〈中盤〉

〈終盤〉

【プレイのコツ】
状況判断やよくあるミスなど。
例
- △△を使うタイミングは重要。□□がある場合は早めに展開すること。
`,

    "matchup":
`
【相性一覧】
〈有利対面〉
〈不利対面〉

【採用候補、対策カード】
今回採用しなかったカードについて。
環境・メタに合わせた検討予知など。
例
- △△：強力だが、□□とのシナジーが薄いため見送り。環境に○○が増えたら再検討。
`,

    "results":
`【使用環境】
使用期間・レート帯・環境など（例：シーズン〇〇／レート1600帯）

【戦績】
総試合数・勝敗（ざっくりでもOK）

【課題・改善点】
苦手な対面や構築上の弱点、今後調整したい点。

【まとめ】
使ってみた全体の印象、成果や気づきなど。`,
  };

    // =====================================================
  // D) デッキ解説：全画面モーダル（noteFullModal）
  // =====================================================
  function openNoteFull_(){
    const modal = document.getElementById('noteFullModal');
    const src = document.getElementById('post-note');
    const dst = document.getElementById('note-full-text');
    if (!modal || !src || !dst) return;

    dst.value = src.value || '';

    // 右ペイン：デッキ一覧を軽量レンダリング
    const side = document.getElementById('note-side-list');
    if (side){
      side.innerHTML = '';
      const entries = Object.entries(window.deck || {});
      entries.sort(([a],[b]) => String(a).localeCompare(String(b)));

      for (const [cd, n] of entries){
        const row = document.createElement('div');
        row.className = 'note-card-row';
        row.dataset.cardId = cd;
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '56px 1fr auto';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.margin = '4px 0';

        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.src = `img/${String(cd).slice(0,5)}.webp`;
        img.onerror = () => { img.src = 'img/00000.webp'; };
        img.style.width = '56px';
        img.style.borderRadius = '6px';

        const name = document.createElement('div');
        name.textContent = (window.cardMap?.[cd]?.name) || cd;
        name.style.fontSize = '.95rem';

        const qty = document.createElement('div');
        qty.textContent = '×' + n;
        qty.style.opacity = '.8';

        row.addEventListener('click', () => {
          if (typeof window.openCardOpModal === 'function'){
            const rect = row.getBoundingClientRect();
            window.openCardOpModal(cd, rect);
          } else {
            document.dispatchEvent(new CustomEvent('open-cardop', { detail:{ cardId: cd }}));
          }
        });

        row.appendChild(img);
        row.appendChild(name);
        row.appendChild(qty);
        side.appendChild(row);
      }
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeNoteFull_(){
    const modal = document.getElementById('noteFullModal');
    const src = document.getElementById('post-note');
    const dst = document.getElementById('note-full-text');
    if (!modal || !src || !dst) return;

    src.value = dst.value || '';
    src.dispatchEvent(new Event('input', { bubbles:true })); // autosave連動

    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  // デッキ名と note-side-title の双方向同期
  function bindDeckNameSyncInNote_(){
    const infoDeckName  = document.getElementById('info-deck-name');
    const postDeckName  = document.getElementById('post-deck-name');
    const noteSideTitle = document.getElementById('note-side-title');

    function setAll(name){
      const v = String(name || '');
      if (infoDeckName && infoDeckName.value !== v) infoDeckName.value = v;
      if (postDeckName && postDeckName.value !== v) postDeckName.value = v;
      if (noteSideTitle && noteSideTitle.textContent !== v) noteSideTitle.textContent = v || 'デッキリスト';
    }

    infoDeckName?.addEventListener('input', ()=> setAll(infoDeckName.value));
    postDeckName?.addEventListener('input', ()=> setAll(postDeckName.value));

    if (noteSideTitle){
      noteSideTitle.addEventListener('click', ()=>{
        noteSideTitle.setAttribute('contenteditable', 'true');
        const range = document.createRange();
        range.selectNodeContents(noteSideTitle);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
        noteSideTitle.focus();
      });
      noteSideTitle.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter'){ e.preventDefault(); noteSideTitle.blur(); }
      });
      noteSideTitle.addEventListener('blur', ()=>{
        noteSideTitle.setAttribute('contenteditable', 'false');
        setAll(noteSideTitle.textContent.trim());
      });
    }

    setAll(postDeckName?.value || infoDeckName?.value || '');
  }

  function bindNoteFullModal_(){
    document.getElementById('note-fullscreen-btn')?.addEventListener('click', openNoteFull_);
    document.getElementById('note-full-close')?.addEventListener('click', closeNoteFull_);
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && document.getElementById('noteFullModal')?.style.display === 'flex') closeNoteFull_();
    });

    bindDeckNameSyncInNote_();
  }

  function insertPresetTo_(el, text){
    if (!el || !text) return;
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    const v = el.value || '';
    el.value = v.slice(0, start) + text + v.slice(end);
    el.focus();
    try { el.selectionStart = el.selectionEnd = start + text.length; } catch(_) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // プリセットクリック（委任）
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.note-preset-btn');
    if (!btn) return;
    const key = btn.dataset.preset;
    const text = NOTE_PRESETS[key];
    if (!text) return;

    // 全画面ノートが開いてるならそっちへ、なければpost-noteへ
    const modalEl = document.getElementById('noteFullModal');
    const isFullOpen = !!modalEl && getComputedStyle(modalEl).display !== 'none';

    const target = isFullOpen
      ? document.getElementById('note-full-text')
      : document.getElementById('post-note');

    insertPresetTo_(target, text);
  });

  // =====================================================
  // 2) tags（ユーザータグ）
  // =====================================================
  function readUserTags(){
    const box = document.getElementById('user-tags');
    if (!box) return [];

    return Array.from(box.querySelectorAll('.chip'))
      .map(ch => {
        // page2互換：dataset.key を優先
        const k = (ch.dataset?.key || '').trim();
        if (k) return k;

        // post.js 既存互換：末尾×を除去
        const raw = (ch.textContent || '').trim();
        const s = raw.endsWith('×') ? raw.slice(0, -1) : raw;
        return s.trim();
      })
      .filter(Boolean)
      .slice(0, 3);
  }

  function writeUserTags(arr){
    const box = document.getElementById('user-tags');
    if (!box) return;

    const tags = Array.isArray(arr)
      ? Array.from(new Set(arr.map(s => String(s).trim()).filter(Boolean))).slice(0, 3)
      : [];

    // 状態保持（任意：他コードが window.PostUserTags を参照してても壊れないように）
    window.PostUserTags = tags;

    box.innerHTML = '';

    for (const t of tags){
      const chip = document.createElement('span');
      chip.className = 'chip user-chip';
      chip.dataset.key = t;
      chip.textContent = t;

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'rm';
      rm.textContent = '×';

      const syncAfterRemove = () => {
        chip.remove();
        window.PostUserTags = readUserTags();
        window.scheduleAutosave?.();
      };

      // クリック削除（page2互換）
      chip.addEventListener('click', syncAfterRemove);

      // ×ボタン（post.js既存互換）
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        syncAfterRemove();
      });

      chip.appendChild(rm);
      box.appendChild(chip);
    }
  }

  // =====================================================
  // 追記： ユーザータグ履歴（最近使ったタグ）
  // =====================================================
  const USER_TAG_HISTORY_KEY = 'dm_user_tag_history_v1';

  function getUserTagHistory_(){
    try {
      const raw = localStorage.getItem(USER_TAG_HISTORY_KEY) || '[]';
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(s => String(s||'').trim()).filter(Boolean);
    } catch(_){}
    return [];
  }

  function pushUserTagHistory_(tag){
    const t = String(tag || '').trim();
    if (!t) return;

    let list = getUserTagHistory_();
    list = list.filter(x => x !== t);
    list.unshift(t);
    if (list.length > 20) list = list.slice(0, 20);

    try { localStorage.setItem(USER_TAG_HISTORY_KEY, JSON.stringify(list)); } catch(_){}
  }

  // どこからでも呼べるフック（既存があれば上書きしない）
  window.onUserTagAdded = window.onUserTagAdded || function(tag){
    pushUserTagHistory_(tag);
  };

  // =====================================================
  // 3) tags（選択タグ）
  // =====================================================
  const SELECT_TAGS_KEY = 'dm_post_select_tags_v1';

  function readSelectedTags(){
    try { return new Set(JSON.parse(localStorage.getItem(SELECT_TAGS_KEY) || '[]')); }
    catch { return new Set(); }
  }

  function writeSelectedTags(setOrArray){
    const arr = Array.isArray(setOrArray) ? setOrArray : Array.from(setOrArray);
    localStorage.setItem(SELECT_TAGS_KEY, JSON.stringify(arr));
  }

  // デッキ内カテゴリタグ化
  function getDeckCategoryTags(){
    const d = window.deck || {};
    const map = window.cardMap || window.allCardsMap || {};
    const bad = new Set(['ノーカテゴリ', 'なし', '-', '', null, undefined]);

    const set = new Set();
    Object.entries(d).forEach(([cd, n]) => {
      if (!n) return;
      const cat = map[cd]?.category;
      if (!bad.has(cat)) set.add(String(cat).trim());
    });
    return Array.from(set);
  }

  // 基本タグ + カテゴリ（五十音順） + コラボタグ（末尾）
  function buildMergedTagList(baseTags, categoryTags){
    const merged = [];
    const seen = new Set();
    baseTags.forEach(t => {
      const s = String(t || '').trim();
      if (!s || seen.has(s)) return;
      merged.push(s); seen.add(s);
    });

    categoryTags.sort((a,b)=>a.localeCompare(b,'ja')).forEach(t => {
      const s = String(t || '').trim();
      if (!s || seen.has(s)) return;
      merged.push(s); seen.add(s);
    });
    return merged;
  }

  // タグの（五十音改行）ラップ
  function formatTagLabelForWrap(label){
    return String(label).replace(/（/g, '<br>（');
  }

  // #select-tags 配下の .chip に対して適用（描画後フック）
  function applySelectTagWrap(){
    const root = document.getElementById('select-tags');
    if (!root) return;
    root.querySelectorAll('.chip').forEach(chip => {
      if (chip.__wrapped) return;
      const raw = chip.dataset.label || chip.textContent;
      chip.dataset.label = raw;
      chip.innerHTML = formatTagLabelForWrap(raw);
      chip.__wrapped = true;
    });
  }

  async function renderPostSelectTags(){
    const wrap = document.getElementById('select-tags');
    if (!wrap) return;

    const baseCandidates = Array.isArray(window.POST_TAG_CANDIDATES) ? window.POST_TAG_CANDIDATES : [];

    // いまの選択を保持
    const selected = readSelectedTags();

    // コラボ判定（DOM pack 依存）
    let hasCollab = false;
    (function syncCollabTag(){
      const d = window.deck || {};
      const keys = Object.keys(d || {});
      if (!keys.length) { hasCollab = false; return; }
      hasCollab = keys.some(cd => {
        const el = document.querySelector(`.card[data-cd="${cd}"]`);
        const pack = (el?.dataset?.pack || '').toLowerCase();
        return /コラボ|collab/.test(pack);
      });
    })();

    // デッキに含まれるカテゴリのみ（デッキが空なら[]）
    const categoryTags = getDeckCategoryTags();

    // 基本タグ + カテゴリ（五十音順）
    const merged = buildMergedTagList(baseCandidates, categoryTags);

    // アクティブキャンペーンタグを先頭に（重複は排除）
    const campTag = String(window.__activeCampaignTag || '').trim();
    if (campTag && !merged.includes(campTag)) merged.unshift(campTag);

    // コラボタグ（末尾）
    if (hasCollab && !merged.includes('コラボカードあり')) merged.push('コラボカードあり');

    // 画面再構築
    wrap.innerHTML = '';
    const hint = document.createElement('div');
    hint.className = 'post-hint';
    hint.textContent = '⇩タップでさらにタグを追加';
    wrap.appendChild(hint);

    const frag = document.createDocumentFragment();
    merged.forEach(label => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.dataset.label = label;
      chip.innerHTML = formatTagLabelForWrap(label);
      chip.dataset.tag = label;
      if (selected.has(label)) chip.classList.add('active');

      chip.addEventListener('click', () => {
        const now = readSelectedTags();
        if (chip.classList.toggle('active')) now.add(label);
        else now.delete(label);
        writeSelectedTags(now);
        window.scheduleAutosave?.();
      });

      frag.appendChild(chip);
    });
    wrap.appendChild(frag);

    const visible = new Set(merged);
    const cleaned = Array.from(selected).filter(t => visible.has(t) || baseCandidates.includes(t));
    writeSelectedTags(cleaned);

    window.getSelectedPostTags = () => Array.from(readSelectedTags());
    applySelectTagWrap();
  }

  // =====================================================
  //  追記：投稿タブ同期（サマリー/デッキ名/隠し値）
  // =====================================================
  function getDeckCount_(){
    try { return Object.values(window.deck || {}).reduce((a,b)=> a + (b|0), 0); }
    catch { return 0; }
  }

  function getRepresentativeImageUrl_(){
    const cd = window.representativeCd;
    return cd ? `img/${String(cd).slice(0,5)}.webp` : '';
  }

  function exportDeckCode_(){
    // page2互換：簡易Base64（後で独自コードに差し替え可）
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(window.deck || {})))); }
    catch { return ''; }
  }

  function refreshPostSummary(){
    const count = (typeof window.getDeckCount === 'function') ? window.getDeckCount() : getDeckCount_();

    const races = (typeof window.getMainRacesInDeck === 'function') ? (window.getMainRacesInDeck() || []) : [];
    const rep   = document.getElementById('deck-representative')?.textContent || '未選択';

    document.getElementById('post-deck-count')?.replaceChildren(document.createTextNode(String(count)));
    document.getElementById('post-deck-races')?.replaceChildren(document.createTextNode(races.join(' / ') || '-'));
    document.getElementById('post-representative')?.replaceChildren(document.createTextNode(rep));

    // 隠し値（送信用）
    document.getElementById('post-deck-code')?.setAttribute('value', exportDeckCode_());
    document.getElementById('post-races-hidden')?.setAttribute('value', races.join(','));
    document.getElementById('post-rep-img')?.setAttribute('value', getRepresentativeImageUrl_());
  }

  async function initDeckPostTab(){
    // デッキ名同期（空なら埋める）
    const srcName = document.getElementById('info-deck-name')?.value || '';
    const nameInput = document.getElementById('post-deck-name');
    if (nameInput && !nameInput.value) nameInput.value = srcName;

    // サマリー同期（存在すれば）
    try { window.updateDeckAnalysis?.(); } catch(_){}
    try { refreshPostSummary(); } catch(_){}
    try { window.renderPostSelectTags?.(); } catch(_){}
  }

  // cardsロード後にタグ再描画したい時の互換
  window.onCardsLoaded = window.onCardsLoaded || function(){
    try { window.rebuildCardMap?.(); } catch(_){}
    if (document.getElementById('select-tags')) {
      try { window.renderPostSelectTags?.(); } catch(_){}
    }
  };

  // 互換公開
  window.refreshPostSummary = window.refreshPostSummary || refreshPostSummary;
  window.initDeckPostTab    = window.initDeckPostTab    || initDeckPostTab;
  window.getDeckCount       = window.getDeckCount       || getDeckCount_;


  // =====================================================
  // 4) UI：同意チェック
  // =====================================================
  function bindMinimalAgreeCheck(){
    const agree  = document.getElementById('post-agree');
    const submit = document.getElementById('post-submit');
    if (!agree || !submit) return;

    const sync = () => {
      const ok = !!agree.checked;
      submit.disabled = !ok;
      submit.classList.toggle('is-disabled', !ok);
    };

    agree.addEventListener('change', sync);
    sync();
  }

  // =====================================================
  // 5) リセット
  // =====================================================
  function resetDeckPostForm(){
    const ok = window.confirm('投稿フォームの内容をすべて初期化します。\nよろしいですか？');
    if (!ok) return;

    const nameInput = document.getElementById('post-deck-name');
    if (nameInput) nameInput.value = '';

    writePostNote('');

    const notesWrap   = document.getElementById('post-card-notes');
    const notesHidden = document.getElementById('post-card-notes-hidden');
    if (notesWrap)   notesWrap.innerHTML = '';
    if (notesHidden) notesHidden.value = '[]';

    const selectTags = document.getElementById('select-tags');
    if (selectTags){
      selectTags.querySelectorAll('.chip.active').forEach(chip => chip.classList.remove('active'));
    }
    writeSelectedTags([]);

    const userTagsHidden = document.getElementById('post-user-tags-hidden');
    if (userTagsHidden) userTagsHidden.value = '';
    writeUserTags([]);

    const pastedPreview = document.getElementById('pasted-code-preview');
    const clearBtn      = document.getElementById('btn-clear-code');
    const shareHidden   = document.getElementById('post-share-code');
    if (pastedPreview) pastedPreview.textContent = '（未設定）';
    if (clearBtn)      clearBtn.disabled = true;
    if (shareHidden)   shareHidden.value = '';

    const agree = document.getElementById('post-agree');
    if (agree) agree.checked = false;

    const submit = document.getElementById('post-submit');
    if (submit){
      submit.disabled = true;
      submit.classList.add('is-disabled');
    }

    window.refreshPostSummary?.();
    window.scheduleAutosave?.();
  }

  // =====================================================
  // 6) 成功チェック
  // =====================================================
  function showSuccessCheck(){
    const el = document.getElementById('success-check');
    if (!el) return;

    el.style.display = 'flex';
    el.style.animation = 'popin 0.25s ease forwards';
    setTimeout(() => { el.style.animation = 'fadeout 0.5s ease forwards'; }, 1800);
    setTimeout(() => { el.style.display = 'none'; }, 2400);
  }

  // =====================================================
  // 7) 投稿トースト表示
  // =====================================================
  function renderPersistToastHtml_(message){
    return `
      <div>${String(message ?? '')}</div>
      <div style="margin-top:6px;font-size:0.8em;opacity:0.85">
        📸 エラーが続く場合は、このメッセージのスクリーンショットをご提出ください。
      </div>
      <div style="text-align:right;margin-top:8px;">
        <button id="toast-close-btn" style="
          background:#fff;color:#333;border:none;border-radius:6px;
          padding:4px 8px;cursor:pointer;font-size:0.75rem;">閉じる</button>
      </div>
    `;
  }

  function showPostToast(message, type = 'success', persist = false) {
    const box = document.getElementById('post-toast');
    if (!box) return;

    if (persist) box.innerHTML = renderPersistToastHtml_(message);
    else box.textContent = String(message ?? '');

    box.className = 'post-toast ' + type;
    box.style.display = 'block';

    if (persist) {
      document.getElementById('toast-close-btn')?.addEventListener('click', () => {
        box.style.display = 'none';
        box.innerHTML = '';
      });
      return;
    }

    clearTimeout(window._postToastTimer);
    window._postToastTimer = setTimeout(() => { box.style.display = 'none'; }, 3500);
  }

  // =====================================================
  // 8) 投稿成功モーダル（post.jsで完結）
  // =====================================================
  let _lastPostedId = '';

  function openPostSuccessModal(opts = {}) {
    const modal = document.getElementById('postSuccessModal');
    if (!modal) return;

    const nameEl = document.getElementById('post-success-deck-name');
    const deckName = (opts.deckName || (window.readDeckNameInput?.() || '').trim());
    if (nameEl) nameEl.textContent = deckName || '（デッキ名）';

    _lastPostedId = String(opts.postId || '');
    modal.dataset.postId = _lastPostedId;

    const campBox  = document.getElementById('post-success-campaign');
    const campText = document.getElementById('post-success-campaign-text');
    const camp     = opts.campaign || null;

    if (campBox && campText) {
      if (camp && (camp.isActive === true || String(camp.isActive) === 'true') && String(camp.campaignId || '')) {
        const title = String(camp.title || 'キャンペーン');
        const start = camp.startAt ? new Date(camp.startAt) : null;
        const end   = camp.endAt   ? new Date(camp.endAt)   : null;
        const fmt = (d) => (d && !isNaN(d)) ? window.formatYmd?.(d) || '' : '';
        const range = (start || end) ? `（${fmt(start)}〜${fmt(end)}）` : '';
        campText.textContent = `${title}${range}`;
        campBox.style.display = '';
      } else {
        campBox.style.display = 'none';
      }
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (typeof window.updatePostSuccessPreview === 'function') {
      window.updatePostSuccessPreview().catch(err => console.error('post-success preview error:', err));
    }
  }

  function initPostSuccessModal() {
    const modal = document.getElementById('postSuccessModal');
    if (!modal || modal.__bound) return;
    modal.__bound = true;

    const closeBtn  = document.getElementById('post-success-close');
    const openPosts = document.getElementById('post-success-open-posts');
    const tweetBtn  = document.getElementById('post-success-tweet');
    const genImgBtn = document.getElementById('post-success-gen-image');

    const closeModal = () => {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    };

    closeBtn?.addEventListener('click', closeModal);

    openPosts?.addEventListener('click', () => {
      closeModal();
      location.href = 'deck-post.html';
    });

    genImgBtn?.addEventListener('click', () => {
      try {
        if (typeof window.exportDeckImage === 'function') window.exportDeckImage();
        else if (window.DeckImg && typeof window.DeckImg.export === 'function') window.DeckImg.export();
        else if (window.DeckImg && typeof window.DeckImg.exportDeckImage === 'function') window.DeckImg.exportDeckImage();
        else alert('画像生成機能が見つかりませんでした。上部の「画像生成」ボタンをお使いください。');
      } catch (e) {
        console.error('post-success image gen error:', e);
        alert('画像生成中にエラーが発生しました。');
      }
    });

    tweetBtn?.addEventListener('click', () => {
      const deckName = (window.readDeckNameInput?.() || document.getElementById('post-success-deck-name')?.textContent || '').trim();
      const baseText = deckName ? `【神託のメソロギア】「${deckName}」デッキを投稿しました！` : '【神託のメソロギア】デッキを投稿しました！';
      const hashtags = '#神託のメソロギア #メソロギアデッキ';
      const text = `${baseText}\n${hashtags}`;
      const url = 'https://mosurogia.github.io/mesorogia-cards/deck-post.html';

      const intent =
        'https://twitter.com/intent/tweet?text=' +
        encodeURIComponent(text) +
        '&url=' +
        encodeURIComponent(url);

      window.open(intent, '_blank', 'noopener');
    });
  }

  (function bootPostSuccessModal(){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPostSuccessModal);
    else initPostSuccessModal();
  })();

  // =====================================================
  // 追記：投稿成功モーダル内：画像プレビュー（任意の共通関数がある場合のみ）
  // =====================================================
  async function updatePostSuccessPreview(){
    const container = document.getElementById('post-success-preview');
    if (!container) return;
    container.innerHTML = '';

    // デッキが空の場合は何もしない
    const deckObj = window.deck || {};
    const total = Object.values(deckObj).reduce((a,b)=> a + (b|0), 0);
    if (!total) return;

    // common-page24.js 側で公開されている想定（無ければ何もしない）
    //後々要チェックしてほしい
    if (typeof window.buildShareNodeForPreview       !== 'function' ||
        typeof window.buildDeckSummaryDataForPreview !== 'function' ||
        typeof window.getCanvasSpecForPreview        !== 'function') {
      return;
    }

    const data   = window.buildDeckSummaryDataForPreview();
    const aspect = '3:4';
    const kinds  = data.uniqueList ? data.uniqueList.length : 0;
    const spec   = window.getCanvasSpecForPreview(aspect, kinds);
    spec.cols = 5;

    try{
      const node = await window.buildShareNodeForPreview(data, spec);

      node.style.position = 'relative';
      node.style.left = '0';
      node.style.top  = '0';

      const containerWidth = container.clientWidth || spec.width;
      let scale = containerWidth / spec.width;
      if (scale > 1) scale = 1;

      container.style.width  = `${spec.width  * scale}px`;
      container.style.height = `${spec.height * scale}px`;
      container.style.overflow = 'hidden';

      node.style.width  = `${spec.width}px`;
      node.style.height = `${spec.height}px`;
      node.style.transformOrigin = 'top left';
      node.style.transform = `scale(${scale})`;

      container.appendChild(node);

    }catch(err){
      console.error('updatePostSuccessPreview error:', err);
    }
  }

  window.updatePostSuccessPreview = window.updatePostSuccessPreview || updatePostSuccessPreview;

  // デバッグ：投稿なしで成功モーダル確認
  window.debugShowPostSuccessModal = window.debugShowPostSuccessModal || async function(deckName){
    let campaign = null;
    try { campaign = await (window.fetchActiveCampaign?.() || Promise.resolve(null)); }
    catch(_){ campaign = null; }

    window.openPostSuccessModal?.({
      deckName: (deckName || (window.readDeckNameInput?.() || '').trim() || 'テスト用デッキ'),
      campaign,
    });
  };

  // =====================================================
  // 9) デッキ特徴量（コスト/タイプ/タイプ別パワー）を投稿用にまとめる
  // - 32本ヒスト：0..30 + 31+
  // =====================================================
  function buildDeckFeaturesForPost() {
    const deckObj = window.deck || {};
    const entries = Object.entries(deckObj).filter(([, n]) => (n | 0) > 0);

    const HLEN = 32, LIM = 31;
    const hCost = new Array(HLEN).fill(0);

    const byType = { Chg: [], Atk: [], Blk: [] };
    const typeMix = { Chg: 0, Atk: 0, Blk: 0 };

    const getCardLocal = (cd) => {
      const cd5 = String(cd ?? '').padStart(5, '0').slice(0, 5);
      return window.cardMap?.[cd5] || window.cardMap?.[String(cd)] || null;
    };

    for (const [cd, nRaw] of entries) {
      const cnt = nRaw | 0;
      const c = getCardLocal(cd) || {};
      const costN = Number(c.cost) || 0;
      const powerN = Number(c.power) || 0;

      const costBin = Math.max(0, Math.min(LIM, costN));
      hCost[costBin] += cnt;

      const typeKey =
        (c.type === 'チャージャー') ? 'Chg' :
        (c.type === 'アタッカー')  ? 'Atk' :
        (c.type === 'ブロッカー')  ? 'Blk' : null;

      if (typeKey) {
        typeMix[typeKey] += cnt;
        for (let i = 0; i < cnt; i++) byType[typeKey].push(powerN);
      }
    }

    function hist32(arr) {
      const h = new Array(HLEN).fill(0);
      arr.forEach(v => {
        const p = Math.max(0, Math.min(LIM, Number(v) || 0));
        h[p] += 1;
      });
      return h;
    }

    const typePower = {
      Chg: { hist: hist32(byType.Chg), sum: byType.Chg.reduce((a, b) => a + b, 0), n: byType.Chg.length },
      Atk: { hist: hist32(byType.Atk), sum: byType.Atk.reduce((a, b) => a + b, 0), n: byType.Atk.length },
      Blk: { hist: hist32(byType.Blk), sum: byType.Blk.reduce((a, b) => a + b, 0), n: byType.Blk.length },
    };
    ['Chg', 'Atk', 'Blk'].forEach(k => {
      const o = typePower[k];
      o.avg = o.n ? (o.sum / o.n) : 0;
    });

    return {
      costHistJSON: JSON.stringify(hCost),
      costHistV: 1,
      typeMixJSON: JSON.stringify([typeMix.Chg, typeMix.Atk, typeMix.Blk]),
      typePowerHistJSON: JSON.stringify(typePower),
      typePowerHistV: 1
    };
  }

  // =====================================================
  // 10) 投稿ペイロード（フォーム値）構築
  // =====================================================
  function buildDeckPostPayload() {
    const title   = document.getElementById('post-deck-name')?.value.trim() || '';
    const comment = document.getElementById('post-note')?.value.trim() || '';
    const code    = document.getElementById('post-deck-code')?.value || '';
    const races   = document.getElementById('post-races-hidden')?.value || '';
    const repImg  = document.getElementById('post-rep-img')?.value || '';
    const shareCode = document.getElementById('post-share-code')?.value.trim() || '';

    // 投稿者名
    let posterInp = '';
    try {
      const el = document.getElementById('auth-display-name');
      if (el) {
        posterInp = (typeof window.validatePosterNameOrThrow_ === 'function')
          ? window.validatePosterNameOrThrow_(el.value)
          : (el.value || '').trim();
        el.value = posterInp;
      }
    } catch (e) {
      throw e; // submit側でtoast
    }

    // X（正規化）
    let posterXIn = '';
    try {
      posterXIn = normalizeXInput_();
    } catch (_) {}

    // カード解説
    let cardNotes = [];
    try {
      if (window.CardNotes && typeof window.CardNotes.getList === 'function') {
        cardNotes = window.CardNotes.getList();
      } else {
        const hidden = document.getElementById('post-card-notes-hidden');
        if (hidden && hidden.value) {
          const arr = JSON.parse(hidden.value);
          if (Array.isArray(arr)) {
            cardNotes = arr.map(r => ({ cd: String(r.cd || ''), text: String(r.text || '') }));
          }
        }
      }
    } catch (_) { cardNotes = []; }

    // auth情報（あれば）
    const A = window.Auth || {};
    const token = A.token || '';
    const user  = A.user || null;

    const posterName = posterInp || user?.displayName || user?.username || '';
    const posterX    = posterXIn || user?.x || '';
    const username   = user?.username || '';

    // 枚数
    const count = (() => {
      try {
        if (typeof window.getDeckCount === 'function') return window.getDeckCount() | 0;
        const d = window.deck || {};
        return Object.values(d).reduce((a, n) => a + (n | 0), 0);
      } catch(_) { return 0; }
    })();

    // タグ（page2互換）
    const autoTags = Array.from(document.querySelectorAll('#auto-tags .chip[data-auto="true"]'))
      .map(el => el.textContent.trim()).filter(Boolean);

    const selectTags = Array.from(document.querySelectorAll('#select-tags .chip.active'))
      .map(el => (el.dataset.label || el.dataset.tag || el.textContent || '').trim())
      .filter(Boolean);

    const userTags = (() => {
      try {
        const tags = readUserTags();
        return Array.isArray(tags) ? tags.slice(0, 3) : [];
      } catch (_) { return []; }
    })();

    return {
      title, comment, code, count, races, repImg,
      cardNotes,
      shareCode,
      ua: navigator.userAgent,
      autoTags,
      selectTags,
      userTags,
      token,
      poster: { name: posterName, x: posterX, username },
    };
  }

  // =====================================================
  // 11) post.js 単体で submit を完結させる（キャンペーン込み）
  // =====================================================
  async function handlePostSubmit_(e){
    e?.preventDefault();

    let camp = null;
    try {
      if (typeof window.fetchActiveCampaign === 'function') {
        camp = await window.fetchActiveCampaign();
      }
    } catch (err) {
      console.warn('fetchActiveCampaign failed:', err);
      camp = null;
    }

    const isActive = !!(
      camp &&
      (camp.isActive === true || String(camp.isActive) === 'true') &&
      String(camp.campaignId || '')
    );

    let joinCampaign = false;

    if (isActive) {
      const title = String(camp.title || '開催中キャンペーン');
      joinCampaign = window.confirm(`${title} に参加しますか？\n\nOK：参加して投稿\nキャンセル：通常投稿`);
    }

    return submitDeckPost(e, { joinCampaign, campaign: camp });
  }

  // =====================================================
  // 12) submit 本体
  // =====================================================
  async function submitDeckPost(e, opts = {}){
    e?.preventDefault();

    if (isPostingDeck){
      showPostToast('投稿処理中です。完了までお待ちください。', 'info');
      return false;
    }
    isPostingDeck = true;

    const form = document.getElementById('deck-post-form');
    if (form && !form.reportValidity()){
      isPostingDeck = false;
      return false;
    }

    // 投稿前チェック（page2互換）
    const msgs = window.validateDeckBeforePost?.() || [];
    if (msgs.length){
      showPostToast(msgs.join('\n'), 'danger', true);
      isPostingDeck = false;
      return false;
    }

    try{
      const nameEl = document.getElementById('auth-display-name');
      if (nameEl){
        if (typeof window.validatePosterNameOrThrow_ === 'function') {
          nameEl.value = window.validatePosterNameOrThrow_(nameEl.value);
        } else {
          nameEl.value = String(nameEl.value || '').trim();
        }
      }

      normalizeXInput_();
    }catch(err){
      showPostToast(err?.message || '入力内容を確認してください', 'danger', true);
      isPostingDeck = false;
      return false;
    }

    // 代表カード未選択チェック
    const repValidator = document.getElementById('post-rep-validator');
    if (repValidator){
      repValidator.setCustomValidity('');
      const hasRep = !!window.representativeCd;
      if (!hasRep){
        repValidator.setCustomValidity('メインカードを選択してください');
        repValidator.reportValidity();
        isPostingDeck = false;
        return false;
      }
    }

    // カード解説未入力チェック
    const cardnoteValidator = document.getElementById('post-cardnote-validator');
    if (cardnoteValidator){
      cardnoteValidator.setCustomValidity('');
      let hasIncomplete = false;
      const rows = document.querySelectorAll('#post-card-notes .post-card-note, #post-card-notes .card-note-row');
      rows.forEach(row => {
        const cd = (row.dataset.cd || '').trim();
        if (!cd) return;
        const ta = row.querySelector('textarea');
        if (ta && !ta.value.trim()) hasIncomplete = true;
      });
      if (hasIncomplete){
        cardnoteValidator.setCustomValidity('カード解説が未入力の行があります');
        cardnoteValidator.reportValidity();
        isPostingDeck = false;
        return false;
      }
    }

    const btn = document.getElementById('post-submit');
    const spinner = document.getElementById('post-loading');
    if (btn){
      btn.disabled = true;
      btn.textContent = '投稿中…';
    }
    if (spinner) spinner.style.display = 'block';

    // representativeCd が空なら保険で自動補完
    if (!window.representativeCd){
      const d = window.deck || {};
      const cds = Object.entries(d)
        .filter(([, n]) => (n | 0) > 0)
        .map(([cd]) => cd);

      if (cds.length){
        cds.sort((a,b) => (parseInt(a,10)||0) - (parseInt(b,10)||0));
        const autoCd = cds[0];
        try{
          const info = (window.cardMap || window.allCardsMap || {})[autoCd] || {};
          window.setRepresentativeCard?.(autoCd, info.name || '');
        }catch(_){
          window.setRepresentativeCard?.(autoCd, '');
        }
      }
    }

    const base = buildDeckPostPayload();
    const feat = buildDeckFeaturesForPost();
    const payload = { ...base, ...feat };

    if (typeof window.buildCardsForPost_ === 'function'){
      payload.cards = window.buildCardsForPost_();
      payload.cardsJSON = JSON.stringify(payload.cards);
    } else {
      const cardsMap = {};
      try {
        const d = window.deck || {};
        Object.entries(d).forEach(([cd, n]) => {
          n = n | 0;
          if (n > 0) cardsMap[String(cd).padStart(5,'0')] = n;
        });
      } catch(_) {}
      payload.cards = cardsMap;
      payload.cardsJSON = JSON.stringify(cardsMap);
    }

    const joinCampaign = !!opts.joinCampaign;
    const camp = opts.campaign || null;
    const isActive = !!(camp && (camp.isActive === true || String(camp.isActive) === 'true') && String(camp.campaignId || ''));
    payload.joinCampaign = joinCampaign;
    payload.campaignId = (joinCampaign && isActive) ? String(camp.campaignId || '') : '';

    payload.repCd  = window.representativeCd || '';
    payload.repImg = payload.repCd ? `img/${String(payload.repCd).slice(0,5)}.webp` : '';

    try{
      const res = await fetch(`${GAS_POST_ENDPOINT}?mode=post`, {
        method : 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body   : JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.ok){
        showPostToast('投稿が完了しました', 'success');
        try { showSuccessCheck(); } catch(_){}

        const deckName =
          (window.readDeckNameInput?.() ||
            document.getElementById('post-deck-name')?.value ||
            '').trim();

        const postId = String(json.postId || '');
        openPostSuccessModal({ deckName, postId, campaign: camp });
      }else{
        if (json.error === 'too_many_posts'){
          showPostToast('短時間に連続して投稿することはできません。少し時間をおいて再度お試しください。', 'error');
        }else if (json.error === 'dup_post'){
          showPostToast('同じ内容の投稿を二重送信しそうだったのでブロックしました。', 'info');
        }else{
          showPostToast(`投稿失敗：${json.error || '不明なエラー'}`, 'error', true);
        }
      }
    }catch(err){
      console.error(err);
      showPostToast('通信エラーが発生しました', 'error', true);
    }finally{
      if (btn){
        btn.disabled = false;
        btn.textContent = '投稿';
      }
      if (spinner) spinner.style.display = 'none';
      isPostingDeck = false;
    }

    return false;
  }

  // =====================================================
  // 13) 投稿前チェック（page2互換：移植前と同じ仕様）
  // =====================================================
  function validateDeckBeforePost(){
    const msgs = [];

    const n = (typeof getDeckCount === 'function') ? getDeckCount() : 0;
    if (n < 30 || n > 40) msgs.push(`枚数が範囲外(${n})`);

    if (typeof validateDeckConstraints === 'function') {
      const more = validateDeckConstraints();
      if (Array.isArray(more)) msgs.push(...more);
    }

    const infoNameEl = document.getElementById('info-deck-name');
    const postNameEl = document.getElementById('post-deck-name');
    const title =
      (postNameEl?.value?.trim()) ||
      (infoNameEl?.value?.trim()) ||
      '';

    if (!title) msgs.push('デッキ名が未入力');

    if (!document.getElementById('post-agree')?.checked) msgs.push('ガイドライン未同意');

    return msgs;
  }


  // =====================================================
  // 追記：ユーザー用デッキコード貼り付け（軽量判定）
  //　移植予定：デッキ投稿でも使うので将来logic or domに移植予定
  // =====================================================
  function validateDeckCodeLight_(raw){
    const s = String(raw || '').trim();
    if (!s) return { ok:false, reason:'空文字' };
    if (s.length < 60)  return { ok:false, reason:'短すぎ' };
    if (s.length > 400) return { ok:false, reason:'長すぎ' };
    if (/\s/.test(s)) return { ok:false, reason:'空白/改行を含む' };
    if (/https?:\/\//i.test(s)) return { ok:false, reason:'URL形式' };
    if (/^[A-Za-z]{20,}$/.test(s)) return { ok:false, reason:'英字のみの単語' };
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(s)) return { ok:false, reason:'文字種/末尾が不正' };

    const padLen = (s.match(/=+$/) || [''])[0].length;
    if (padLen > 2) return { ok:false, reason:'パディング異常' };
    const coreLen = s.replace(/=+$/,'').length;
    if (coreLen % 4 === 1) return { ok:false, reason:'長さ整合×' };

    const hasLower = /[a-z]/.test(s);
    const hasUpper = /[A-Z]/.test(s);
    const hasDigit = /\d/.test(s);
    const hasMark  = /[+/_-]/.test(s);
    const mixedCnt = [hasLower,hasUpper,hasDigit,hasMark].filter(Boolean).length;
    if (mixedCnt < 3) return { ok:false, reason:'多様性不足' };

    const digitCount = (s.match(/\d/g) || []).length;
    if (digitCount < 6) return { ok:false, reason:'数字が少なすぎ' };

    return { ok:true, reason:'' };
  }

  function initUserPasteCode_(){
    const pasteBtn  = document.getElementById('btn-paste-code');
    const clearBtn  = document.getElementById('btn-clear-code');
    const previewEl = document.getElementById('pasted-code-preview');
    const hiddenEl  = document.getElementById('post-share-code'); // hidden
    if (!pasteBtn || !clearBtn || !previewEl || !hiddenEl) return;

    function reflectUI(s){
      const vr = validateDeckCodeLight_(s || '');
      const ok = !!vr.ok;

      //    未設定 or OK or NG（形式はデッキコードっぽいが何らかの理由でNG）
      previewEl.textContent = (ok && s) ? s : '（未設定）';
      previewEl.title = !s ? '' : (ok ? '判定: デッキコード（OK）' : `判定: 不明（${vr.reason || '形式不一致'}）`);

      previewEl.classList.toggle('ok', ok && !!s);
      previewEl.classList.toggle('ng', !ok && !!s);

      clearBtn.disabled = !(ok && !!s);
    }

    async function doPaste(){
      try{
        const t = await navigator.clipboard.readText();
        const s = String(t || '').trim();
        if (!s){ alert('クリップボードが空です'); return; }

        const vr = validateDeckCodeLight_(s);
        if (!vr.ok){
          hiddenEl.value = '';
          reflectUI('');
          window.scheduleAutosave?.();
          alert(`貼り付けた文字列はデッキコードではなさそうです。\n理由: ${vr.reason || '形式不一致'}`);
          return;
        }

        hiddenEl.value = s;
        reflectUI(s);
        window.scheduleAutosave?.();

      }catch(err){
        console.error(err);
        alert('デッキコードの貼り付けに失敗しました（権限やブラウザ設定をご確認ください）');
      }
    }

    function doClear(){
      hiddenEl.value = '';
      reflectUI('');
      window.scheduleAutosave?.();
    }

    pasteBtn.addEventListener('click', doPaste);
    clearBtn.addEventListener('click', doClear);

    // 外部から復元したい時用
    window.writePastedDeckCode = function(s){
      try{
        hiddenEl.value = String(s || '');
        reflectUI(hiddenEl.value);
      }catch(_){}
    };

    reflectUI(hiddenEl.value || '');
  }


  // =====================================================
  // 14) init（結線）
  // =====================================================
  function initPost(){
    bindMinimalAgreeCheck();

    const resetBtn = document.getElementById('post-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetDeckPostForm);

    const imgBtn = document.getElementById('post-open-imagegen');
    if (imgBtn){
      imgBtn.addEventListener('click', () => {
        if (typeof window.exportDeckImage === 'function'){
          window.exportDeckImage();
          return;
        }
        const proxy = document.getElementById('exportPngBtn');
        if (proxy){
          proxy.click();
          return;
        }
        alert('画像生成機能が見つかりませんでした（exportDeckImage / #exportPngBtn）');
      });
    }

    const xBtn = document.getElementById('x-link-btn');
    const xEl  = document.getElementById('auth-x');
    if (xBtn && xEl){
      xBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const norm = normalizeXInput_();

        const user = String(norm || '').replace(/^@/, '').trim();
        if (!user){
          alert('Xアカウント名を入力してください');
          return;
        }
        if (!isValidXHandle(norm)){
          alert('Xアカウント名が不正です（英数と_、最大15文字）');
          return;
        }
        window.open(`https://x.com/${encodeURIComponent(user)}`, '_blank', 'noopener');
      });
    }

    const form = document.getElementById('deck-post-form');
    if (form && !form.__postBound){
      form.__postBound = true;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handlePostSubmit_(e);
      });
    }

    // --- page2未移植分の初期化 ---
    setupPostFlowHelpModal_();
    setupExclusiveSubtabs_();
    bindNoteFullModal_();
    initUserPasteCode_();

    // 入力監視（note / user-tag追加でautosave）
    const note = document.getElementById('post-note');
    note?.addEventListener('input', () => window.scheduleAutosave?.());

    const userTagInput = document.getElementById('user-tag-input');
    const addBtn = document.getElementById('user-tag-add');
    if (userTagInput && addBtn){
      addBtn.addEventListener('click', ()=> setTimeout(()=>window.scheduleAutosave?.(), 0));
      userTagInput.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter') setTimeout(()=>window.scheduleAutosave?.(), 0);
      });
    }

    // 投稿タブ存在時：campaign mini/banner（存在すれば）
    const postTab = document.getElementById('post-tab');
    if (postTab){
      try { window.renderDeckmakerCampaignMiniNotice?.(); } catch(e){ console.warn('campaign mini error', e); }
      try { window.renderDeckmakerCampaignBanner?.(); } catch(e){ console.warn('campaign banner error', e); }
    }

    renderPostSelectTags().catch(console.error);
  }

  // =====================================================
  // 公開（互換のため window へ）※まとめ版
  // =====================================================
  window.DeckmakerPost = { init: initPost };
  window.submitDeckPost = submitDeckPost;
  window.renderPostSelectTags = renderPostSelectTags;
  window.openPostSuccessModal = window.openPostSuccessModal || openPostSuccessModal;

  window.readPostNote  = window.readPostNote  || readPostNote;
  window.writePostNote = window.writePostNote || writePostNote;
  window.readUserTags  = window.readUserTags  || readUserTags;
  window.writeUserTags = window.writeUserTags || writeUserTags;

  window.normalizeHandle = window.normalizeHandle || normalizeHandle;

  Object.assign(window, {
    showPostToast: window.showPostToast || showPostToast,
    buildDeckFeaturesForPost: window.buildDeckFeaturesForPost || buildDeckFeaturesForPost,
    buildDeckPostPayload: window.buildDeckPostPayload || buildDeckPostPayload,
    validateDeckBeforePost: window.validateDeckBeforePost || validateDeckBeforePost,
  });

})();