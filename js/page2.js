/*================
    1.初期設定
===============*/
//#region

//初期呼び出し
window.addEventListener('DOMContentLoaded', async () => {
  await loadCards(); // カードデータ読み込み

  updateSavedDeckList();  // その後に保存デッキ一覧を表示
  setTimeout(()=> window.__bindLongPressForCards('deckmaker'), 0);
});

// 日付フォーマット
function formatYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${da}`;
}

// 代表カードのグローバル変数
let representativeCd = null;

// iOS判定（画像生成時使用）
function isiOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
function isIOSChrome() {
  return isiOS() && /CriOS/.test(navigator.userAgent);
}


// === オートセーブ ===//
const AUTOSAVE_KEY = 'deck_autosave_v1';
let __autosaveTimer = 0;

function isDeckEmpty() {
  return !deck || Object.keys(deck).length === 0;
}

function readDeckNameInput() {
  const info = document.getElementById('info-deck-name')?.value?.trim() || '';
  const post = document.getElementById('post-deck-name')?.value?.trim() || '';
  return post || info || '';
}


function writeDeckNameInput(name) {
  const v = name || '';
  const info = document.getElementById('info-deck-name');
  const post = document.getElementById('post-deck-name');
  if (info) info.value = v;
  if (post) post.value = v;
}


function buildAutosavePayload() {
  return {
    cardCounts: { ...deck },
    m: representativeCd || null,
    name: readDeckNameInput(),
    date: formatYmd()
  };
}

function saveAutosaveNow() {
  try {
    const payload = buildAutosavePayload();
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('autosave failed', e);
  }
}

function scheduleAutosave() {
  clearTimeout(__autosaveTimer);
  __autosaveTimer = setTimeout(saveAutosaveNow, 250); // デバウンス
}

function clearAutosave() {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
}

function hasFreshParamOff() {
  // ?fresh=1 なら復元スキップ（新規開始）
  const sp = new URLSearchParams(location.search);
  return sp.get('fresh') === '1';
}

/*デッキ復元確認トースト*/
function loadAutosave(data){
  if (!data || !data.cardCounts) return;

  // デッキを入れ替え
  Object.keys(deck).forEach(k => delete deck[k]);
  Object.entries(data.cardCounts).forEach(([cd, n]) => { deck[cd] = n|0; });

  // 代表カード
  representativeCd = (data.m && deck[data.m]) ? data.m : null;
  writeDeckNameInput(data.name || '');

    // デッキ名（２つのタブ同期）
  if (typeof window.syncDeckNameFields === 'function') window.syncDeckNameFields();

  // UI更新（スクロール保持）
  withDeckBarScrollKept(() => {
    updateDeck();
    renderDeckList();
  });
  updateDeckSummaryDisplay();
  updateExchangeSummary();
}


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

 // オートセーブ復元確認
  if (!window.location.search.includes('fresh=1')) {
    const autosave = localStorage.getItem('deck_autosave_v1');
    if (autosave && isDeckEmpty()) {
      try {
        const data = JSON.parse(autosave);
        if (data && Object.keys(data.cardCounts || {}).length) {
          showToast("以前のデッキを復元しますか？", {
            action: { label: "復元する", onClick: () => loadAutosave(data) },
            secondary: { label: "削除する", onClick: () => clearAutosave() }
          });
        }
      } catch(e){}
    }
  }
//#endregion
/*===================
    2.一覧カード生成
================*/

//#regioncard
//カード一覧生成
function generateCardListElement(card) {
  const cardDiv = document.createElement('div');
  cardDiv.classList.add('card');

  cardDiv.setAttribute('data-cd', card.cd);
  cardDiv.setAttribute('data-name', card.name);
  cardDiv.setAttribute('data-effect1', card.effect_name1 ?? "");
  cardDiv.setAttribute('data-effect2', card.effect_name2 ?? "");
  cardDiv.setAttribute('data-effecttext1', card.effect_text1 ?? "");
  cardDiv.setAttribute('data-effecttext2', card.effect_text2 ?? "");
  cardDiv.setAttribute('data-race', card.race);
  cardDiv.setAttribute('data-category', card.category);
  cardDiv.setAttribute('data-rarity', card.rarity);
  cardDiv.setAttribute('data-type', card.type);
  cardDiv.setAttribute('data-cost', card.cost);
  cardDiv.setAttribute('data-power', card.power);
  cardDiv.setAttribute('data-pack', card.pack_name);
  const _effectJoined =
  [card.effect_name1, card.effect_text1, card.effect_name2, card.effect_text2]
  .filter(Boolean).join(' ');
  cardDiv.setAttribute('data-field', card.field);
  cardDiv.setAttribute('data-ability', card.special_ability);
  cardDiv.setAttribute('data-bp', String(card.BP_flag ?? "").toLowerCase());
  cardDiv.setAttribute('data-draw', String(card.draw ?? "").toLowerCase());
  cardDiv.setAttribute('data-graveyard_Recovery', String(card.graveyard_recovery ?? "").toLowerCase());
  cardDiv.setAttribute('data-cardsearch', String(card.cardsearch ?? "").toLowerCase());
  cardDiv.setAttribute('data-destroy_Opponent', String(card.destroy_opponent ?? "").toLowerCase());
  cardDiv.setAttribute('data-destroy_Self', String(card.destroy_self ?? "").toLowerCase());

  // 🔎 検索用にまとめた文字列（小文字化）
  const keywords = [
  card.name, card.race, card.category, card.type,
  card.field, card.special_ability,
  card.effect_name1, card.effect_text1,
  card.effect_name2, card.effect_text2
  ].filter(Boolean).join(' ').toLowerCase();
  cardDiv.setAttribute('data-keywords', keywords);
  // UIパーツ
  const zoomBtn = document.createElement('div');
  zoomBtn.classList.add('zoom-btn');
  zoomBtn.innerText = '🔎';
  zoomBtn.setAttribute('onclick', 'handleZoomClick(event, this)');
  cardDiv.appendChild(zoomBtn);

  const ownedMark = document.createElement('div');
  ownedMark.classList.add('owned-mark');
  cardDiv.appendChild(ownedMark);

const img = document.createElement('img');
img.alt = card.name;
img.loading = 'lazy';
img.src = `img/${card.cd}.webp`;

// フォールバック：個別画像が無いときは 00000.webp を使う
img.onerror = () => {
  if (img.dataset.fallbackApplied) return; // 無限ループ防止
  img.dataset.fallbackApplied = '1';
  img.src = 'img/00000.webp';
};

// 左クリックで addCard() を呼ぶ
img.onclick = (e) => { e.stopPropagation(); addCard(card.cd); };

// 右クリックメニューを出さない
img.addEventListener('contextmenu', e => {
  e.preventDefault();
});

// PCブラウザのダブルクリックによる拡大も抑止
img.addEventListener('dblclick', e => {
  e.preventDefault();
});

  cardDiv.appendChild(img);


  return cardDiv;
}


// 詳細情報生成
function generateDetailHtml(card) {
  const typeClass = `type-${card.type}`;
  const raceClass = `race-${card.race}`;
  const detailId = `detail-${card.cd}`;

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

//カード一覧再読み込み
function rebuildCardMap() {
  Object.keys(cardMap).forEach(key => delete cardMap[key]);
  document.querySelectorAll('.card').forEach(cardEl => {
    const cd = cardEl.dataset.cd;
    cardMap[cd] = {
      name: cardEl.querySelector('img')?.alt || "",
      race: cardEl.dataset.race || "",
      category: cardEl.dataset.category || "",
      type: cardEl.dataset.type || "",
      cost: parseInt(cardEl.dataset.cost) || 0,
      power: parseInt(cardEl.dataset.power) || 0,
      rarity: cardEl.dataset.rarity || ""
    };
  });
}

//#endregioncard

/*=================
    3.メニューバー
=================*/
//#region
/*=====使用不可種族判定=====*/
//#regionhiderace
  // 使用不可種族表示切替フラグ
  let hideInvalidRace = false;

// 使用不可種族表示/非表示ボタン
document.getElementById("toggle-invalid-race").addEventListener("click", function () {
  hideInvalidRace = !hideInvalidRace;
  this.classList.toggle("active", hideInvalidRace);
  this.textContent = hideInvalidRace ? "🚫使用不可種族を非表示" : "✅使用不可種族を表示(モノクロ)";
  applyGrayscaleFilter();
});

// 使用不可種族カードをモノクロ化 or 非表示にする
function applyGrayscaleFilter() {
  const cards = document.querySelectorAll(".card");
  cards.forEach(card => {
    const isGrayscale = card.classList.contains("grayscale");

    if (hideInvalidRace && isGrayscale) {
      card.classList.add("hidden-by-grayscale");
    } else {
      card.classList.remove("hidden-by-grayscale");
    }
  });
}
//#endregionhiderace

/* =========================
   所持カードオーバーレイ表示（デッキメーカー用／初期は未反映）
   ========================= */

// ON/OFF 状態（初期OFF：ボタン初期表示と合わせる）
let ownedOverlayOn = false;

// 所持データ取得（OwnedStore優先、なければ localStorage）
function readOwnedMapForDeckmaker() {
  // 1) 画面の真実は OwnedStore（ゲスト所持や未保存編集を含む）
  if (window.OwnedStore?.getAll) {
    return window.OwnedStore.getAll();
  }
  // 2) まれに OwnedStore 未初期化なら、最後に保存されたものを読む
  try {
    const raw = JSON.parse(localStorage.getItem('ownedCards') || '{}') || {};
    const norm = {};
    for (const cd in raw) {
      const v = raw[cd];
      norm[cd] = (v && typeof v === 'object')
        ? { normal: v.normal|0, shine: v.shine|0, premium: v.premium|0 }
        : { normal: v|0,      shine: 0,            premium: 0 };
    }
    return norm;
  } catch {
    return {};
  }
}


// 1枚のカード要素へ所持数を描画（未所持=0も表示）
function paintOwnedMarkDeckmaker(cardEl, total) {
  // デッキ構築の上限想定でクランプ（0〜3）
  const count = Math.max(0, Math.min(3, total|0));
  const mark = cardEl.querySelector('.owned-mark');

  if (ownedOverlayOn) {
    cardEl.classList.add('owned'); // CSSで表示トリガー
    mark.textContent = String(count); // 0 も表示
    mark.style.display = 'flex';      // 念のため強制表示
  } else {
    // OFF時は非表示
    cardEl.classList.remove('owned', 'owned-1', 'owned-2', 'owned-3');
    mark.textContent = '';
    mark.style.display = 'none';
  }

  if (window.__guestOwnedActive) mark.classList.add('guest-mode'); else mark.classList.remove('guest-mode');

  // 他ページ互換のため（必要なら）
  cardEl.dataset.count = String(count);
}

// 画面中のカード全てに反映（#grid を見る）
function refreshOwnedOverlay() {
  const ownedMap = readOwnedMapForDeckmaker();
  document.querySelectorAll('#grid .card').forEach(cardEl => {
    const cd = cardEl.dataset.cd;
    const v = ownedMap[cd] || { normal:0, shine:0, premium:0 };
    const total = (v.normal|0) + (v.shine|0) + (v.premium|0);
    paintOwnedMarkDeckmaker(cardEl, total);
  });
}

// トグル（ボタンと同期）
function toggleOwned() {
  if (window.__guestOwnedActive) return; // ゲストモードは操作不可
  ownedOverlayOn = !ownedOverlayOn;
  const btn = document.getElementById('toggleOwnedBtn');
  if (btn) btn.textContent = `所持カード${ownedOverlayOn ? '反映' : '未反映'}`;
  refreshOwnedOverlay();
  updateExchangeSummary();          // 数値/不足リストを最新化

}


document.addEventListener('DOMContentLoaded', () => {
  // 初期は「未反映」ラベルのままにしておく
  const btn = document.getElementById('toggleOwnedBtn');
  if (btn) btn.textContent = '所持カード未反映';

  // 初期正規化（非表示のまま整える）
  refreshOwnedOverlay();

  // #grid の再描画にも追従（ONのときのみ即時反映）
  const root = document.getElementById('grid');
  if (root) {
    let busy = false;
    new MutationObserver(muts => {
      if (busy || !ownedOverlayOn) return;
      if (!muts.some(m => m.addedNodes?.length || m.removedNodes?.length)) return;
      busy = true;
      requestAnimationFrame(() => { refreshOwnedOverlay(); busy = false; });
    }).observe(root, { childList: true, subtree: true });
  }
});

// グローバル公開（onclick から呼ぶため）
window.toggleOwned = toggleOwned;
window.refreshOwnedOverlay = refreshOwnedOverlay;


// デッキバー操作（右クリック防止）
document.addEventListener("contextmenu", e => {
  const deckBarTop = document.getElementById("deckBarTop");
  if (deckBarTop && deckBarTop.contains(e.target)) {
    e.preventDefault();
  }
});


//分析タブへ移動
function goToAnalyzeTab() {
  // 「デッキ分析」タブに切り替え
  const tab2 = document.querySelector('#tab2');
  if (tab2) switchTab('edit', tab2);
  renderDeckList();  // デッキに含まれるカード画像を一覧表示
  updateDeckAnalysis();  // 分析グラフやレアリティ比率などを更新
  updateExchangeSummary();  // ポイント等のサマリーを更新
}

//デッキ情報開閉
  function toggleDeckSummary() {
    const summary = document.getElementById('deck-summary');
    summary.classList.toggle('open');
  }


// =====================
// 共有URL（?o=...）受信 → ゲスト所持で反映
// =====================

// --- decoder helpers ---
function xorChecksumHex(bytes){
  let x = 0; for (let i = 0; i < bytes.length; i++) x ^= bytes[i];
  return (x & 0xff).toString(16).padStart(2, '0');
}
function decodeVarint(bytes, offs = 0){
  let x = 0, shift = 0, i = offs;
  for (; i < bytes.length; i++){
    const b = bytes[i];
    x |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0){ i++; break; }
    shift += 7;
  }
  return [x >>> 0, i - offs];
}
function unpack2bitExact(bytes, k){
  const out = new Uint8Array(k);
  for (let i = 0; i < k; i++){
    const q = i >> 2, r = i & 3;
    out[i] = (bytes[q] >> (r * 2)) & 3;
  }
  return out;
}
function bitsetGet(bitset, i){ return (bitset[i >> 3] >> (i & 7)) & 1; }

// v1/v2/v3 すべて読める汎用デコーダ
function decodeOwnedCountsFromPayload(payload, orderLen){
  if (!payload || payload.length < 3) throw new Error('invalid payload');
  const ver = payload[0];
  const csHex = payload.slice(1,3);
  const b64 = payload.slice(3);
  const bytes = bytesFromB64url(b64);
  const now = xorChecksumHex(bytes);
  if (now !== csHex) console.warn('Checksum mismatch: expected', csHex, 'got', now);

  if (ver === '1'){
    // 全カード2bit固定
    return unpack2bitExact(bytes, orderLen);

  } else if (ver === '2'){
    // bitset + 非0値列(2bit)
    const bitsetLen = Math.ceil(orderLen / 8);
    if (bytes.length < bitsetLen) throw new Error('bitset too short');
    const bitset = bytes.slice(0, bitsetLen);
    const valuesBytes = bytes.slice(bitsetLen);
    let K = 0; for (let i = 0; i < orderLen; i++) if (bitsetGet(bitset, i)) K++;
    const values = unpack2bitExact(valuesBytes, K);
    const counts = new Uint8Array(orderLen);
    let p = 0;
    for (let i = 0; i < orderLen; i++){
      counts[i] = bitsetGet(bitset, i) ? (values[p++] & 3) : 0;
    }
    return counts;

  } else if (ver === '3'){
    // [K(varint)] [gapPlus varint ×K] [values(2bit K個)]
    let idx = 0;
    const [K, used0] = decodeVarint(bytes, idx); idx += used0;
    const positions = new Array(K);
    let prev = -1;
    for (let i = 0; i < K; i++){
      const [gapPlus, used] = decodeVarint(bytes, idx); idx += used;
      const pos = prev + gapPlus; // gapPlus = pos - prev
      positions[i] = pos;
      prev = pos;
    }
    const valuesBytes = bytes.slice(idx);
    const values = unpack2bitExact(valuesBytes, K);
    const counts = new Uint8Array(orderLen);
    for (let i = 0; i < K; i++){
      const pos = positions[i];
      if (pos >= 0 && pos < orderLen) counts[pos] = values[i] & 3;
    }
    return counts;
  }

  throw new Error('unsupported version');
}




// カード順（cd昇順/is_latest）
async function getCanonicalOrderForOwned_DM(){
  if (window.__CARD_ORDER && window.__CARD_ORDER.length) return window.__CARD_ORDER.slice();
  let cards = [];
  try{
    if (typeof fetchLatestCards === 'function'){
      cards = await fetchLatestCards();
    }else{
      const res = await fetch('public/cards_latest.json'); // 環境に合わせて
      const all = await res.json();
      cards = all.filter(c => c.is_latest);
    }
  }catch(e){ console.error(e); }
  cards.sort((a,b) => (parseInt(a.cd,10)||0) - (parseInt(b.cd,10)||0));
  window.__CARD_ORDER = cards.map(c => String(c.cd));
  return window.__CARD_ORDER.slice();
}

// ゲスト所持を OwnedStore に反映（保存はしない）
async function applyGuestOwned(payload){
  const order = await getCanonicalOrderForOwned_DM();
  const counts = decodeOwnedCountsFromPayload(payload, order.length); // ← v3対応版を使用

  if (!window.OwnedStore?.set){
    console.warn('OwnedStore未初期化');
    return;
  }

  // ゲストモード：オートセーブ無効
  if (typeof OwnedStore.setAutosave === 'function') OwnedStore.setAutosave(false);
  window.__guestOwnedActive = true;
  window.__guestOwnedPayload = payload;

  // 反映
  for (let i=0;i<order.length;i++){
    const cd = String(order[i]);
    const n = counts[i] & 3;
    OwnedStore.set(cd, { normal: n, shine: 0, premium: 0 });
  }

  // UI更新（利用側に合わせて調整）
  if (typeof window.applyGrayscaleFilter === 'function') window.applyGrayscaleFilter();
  if (typeof window.updateOwnedTotal === 'function') window.updateOwnedTotal();
  if (typeof window.updateSummary === 'function') window.updateSummary();
  // ゲストUI適用（ボタン無効化・色変更・所持オーバーレイON）
  markGuestModeUI();
}

// ゲストモードのUI反映（ボタン無効化・色変更・所持オーバーレイON）
function markGuestModeUI() {
  // ボタンを置き換え＆無効化
  const btn = document.getElementById('toggleOwnedBtn');
  if (btn) {
    btn.textContent = '他人所持データ反映';
    btn.classList.add('guest-mode');
    btn.disabled = true;              // 機能オフ
    btn.title = '他人の所持データを表示中';
  }
  // 所持オーバーレイをONにして反映
  ownedOverlayOn = true;
  refreshOwnedOverlay();

  updateExchangeSummary();          // ゲスト所持での計算結果に更新

  // owned-markに目印クラス
  document.querySelectorAll('#grid .owned-mark').forEach(el => {
    el.classList.add('guest-mode');
  });
}


// 起動時に ?o= を検出（全スクリプト読了後に実行）
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const payload = params.get('o');
  if (!payload) return;
  (async () => {
    try{
      await applyGuestOwned(payload);
    }catch(e){
      console.error(e);
      alert('共有データの読み込みに失敗しました');
    }
  })();
});

// --- Base64URL → bytes（※パディング復元あり） ---
function bytesFromB64url(s){
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  const mod = s.length & 3;
  if (mod === 2) s += '==';
  else if (mod === 3) s += '=';
  else if (mod === 1) s += '===';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// v1用：フル2bit列を展開
function unpack2bit(bytes, length){
  const out = new Uint8Array(length);
  for (let i=0;i<length;i++){
    const q = i >> 2, r = i & 3;
    out[i] = (bytes[q] >> (r*2)) & 3;
  }
  return out;
}


//#endregion


/*======================
    4.デッキ情報読み取り
======================*/
//#regiondeck

/*=======デッキメイン種族判別======*/
//#regionMainraces
// 種族の種別判定ヘルパー
function getRaceType(race) {
  if (race === "旧神") return "kyuushin";
  if (race === "イノセント") return "innocent";
  if (["ドラゴン", "アンドロイド", "エレメンタル", "ルミナス", "シェイド"].includes(race)) return "main";
  return "other";
}

// メイン種族の定義とヘルパー
const MAIN_RACES = ["ドラゴン", "アンドロイド", "エレメンタル", "ルミナス", "シェイド"];

// メイン種族背景色
const RACE_BG = {
  'ドラゴン':    'rgba(255, 100, 100, 0.16)',
  'アンドロイド':'rgba(100, 200, 255, 0.16)',
  'エレメンタル':'rgba(100, 255, 150, 0.16)',
  'ルミナス':    'rgba(255, 250, 150, 0.16)',
  'シェイド':    'rgba(200, 150, 255, 0.16)',
};

// デッキ内に存在するメイン種族を（重複なしで）配列で返す
function getMainRacesInDeck() {
  const races = Object.keys(deck)
    .map(cd => cardMap[cd]?.race)
    .filter(r => MAIN_RACES.includes(r));
  return [...new Set(races)]; // 重複排除
}

// 配列からメイン種族を1つ決める（基本は先頭。万一複数なら優先順で決定）
function computeMainRace() {
  const arr = getMainRacesInDeck();
  if (arr.length <= 1) return arr[0] || null;
  for (const r of MAIN_RACES) if (arr.includes(r)) return r;
  return arr[0] || null;
}

// デッキの代表メイン種族（基本1つ想定）
function getMainRace() {
  const list = getMainRacesInDeck();
  return list[0] || null;
}

//#endregionMainraces




//#endregiondeck

/*==================
    5.デッキ操作
===================*/
//#region

//カード追加
function addCard(cd) {
  const card = cardMap[cd];
  if (!card) return;

  const race = card.race || "";
  const raceType = getRaceType(race);
  const isKyuushin = race === "旧神";

  // 既に3枚入っていれば追加不可
  if ((deck[cd] || 0) >= 3) return;

  // 旧神は1枚まで、かつ他の旧神がいる場合は追加不可
  if (isKyuushin) {
    if ((deck[cd] || 0) >= 1) return;
    const hasOtherOldGod = Object.keys(deck).some(id => cardMap[id]?.race === "旧神" && id !== cd);
    if (hasOtherOldGod) return;
  }

  // メイン種族は1種類のみ
  if (raceType === "main") {
    const currentMainRaces = getMainRacesInDeck();
    const unique = new Set([...currentMainRaces, race]);
    if (unique.size > 1) return; // 2種類目は追加不可
  }
  //カード追加
  deck[cd] = (deck[cd] || 0) + 1;
  withDeckBarScrollKept(() => updateDeck());//デッキ情報更新（デッキバースクロール固定）
  applyGrayscaleFilter();//他種族モノクロor非表示
}

//カード削除
function removeCard(cd) {
  if (!deck[cd]) return;
  if (deck[cd] > 1) {
    deck[cd]--;//1枚減らす
  } else {
    delete deck[cd];//削除
  }
  withDeckBarScrollKept(() => updateDeck());//デッキ情報更新（デッキバースクロール固定）
  applyGrayscaleFilter();//他種族モノクロor非表示
}


/*デッキ情報更新*/
/*説明
 * デッキバーとデッキ情報を更新するメイン関数。
 * デッキ内カードを並び替えて表示し、種族やタイプの内訳を集計する。
 */
function updateDeck() {
  const deckBarTop = document.getElementById("deckBarTop");
  deckBarTop.innerHTML = "";

  // サマリー集計
  let total = 0;
  const typeCount = { "チャージャー": 0, "アタッカー": 0, "ブロッカー": 0 };
  const races = new Set();
  let hasOldGod = false;

  Object.entries(deck).forEach(([cd, count]) => {
    const card = cardMap[cd];
    if (!card) return;
    total += count;
    typeCount[card.type] += count;
    if (card.race !== "イノセント" && card.race !== "旧神") {
      races.add(card.race);
    }
    if (card.race === "旧神") {
      hasOldGod = true;
    }
  });

  // デッキバー横のサマリーを更新（※0枚でもここでゼロが入る）
  const summary = document.getElementById("deck-summary");
  const info = summary.querySelector(".deck-info") || (() => {
    const el = document.createElement("div");
    el.className = "deck-info";
    summary.insertBefore(el, summary.firstChild);
    return el;
  })();
  info.innerHTML = `
    デッキ枚数：${total} /30~40<br>
    使用種族：${races.size > 0 ? Array.from(races).join("/") : "なし"}<br>
    旧神：${hasOldGod ? "採用中" : "未採用"}<br>
    🔵 ${typeCount["チャージャー"]} 🟣 ${typeCount["アタッカー"]} ⚪️ ${typeCount["ブロッカー"]}
  `;

  // 空のときはヘルプテキストを表示
  if (Object.keys(deck).length === 0) {
    deckBarTop.innerHTML = `
      <div id="deck-empty-text">
        <div style="font-size: 0.7rem;">カード操作</div>
        <div class="deck-help" id="deckHelp">
          <div>【PC】<br>・左クリック：追加<br>・右クリック：削除</div>
          <div>【スマホ】<br>・タップ,上フリック：追加<br>・下フリック：削除<br>・長押し：拡大表示</div>
        </div>
      </div>
    `;
    // 一覧側のカード状態と deck-info をリセット
    updateCardDisabling();
    updateDeckSummary([]);
    updateExchangeSummary();
    requestAnimationFrame(autoscaleAllBadges);

    return;
  }

  // デッキをタイプ→コスト→パワー→ID順にソート
  const typeOrder = { "チャージャー": 0, "アタッカー": 1, "ブロッカー": 2 };
  const entries = Object.entries(deck).sort((a, b) => {
    const [cdA, countA] = a;
    const [cdB, countB] = b;
    const cardA = cardMap[cdA];
    const cardB = cardMap[cdB];
    if (!cardA || !cardB) return 0;

    const tA = typeOrder[cardA.type] ?? 99;
    const tB = typeOrder[cardB.type] ?? 99;
    if (tA !== tB) return tA - tB;

    const cA = parseInt(cardA.cost) || 0;
    const cB = parseInt(cardB.cost) || 0;
    if (cA !== cB) return cA - cB;

    const pA = parseInt(cardA.power) || 0;
    const pB = parseInt(cardB.power) || 0;
    if (pA !== pB) return pA - pB;

    return cdA.localeCompare(cdB);
  });

  // 並び替えた順にデッキバーに表示
  entries.forEach(([cd, count]) => {
    const card = cardMap[cd];
    if (!card) return;

    const cardEl = document.createElement("div");
    cardEl.className = "deck-card";
    cardEl.dataset.cd = cd;
    cardEl.dataset.race = card.race;

    // 画像は5桁IDで読み込む
    const img = document.createElement("img");
    img.src = `img/${cd.slice(0, 5)}.webp`;
    // フォールバック：個別画像が無いときは 00000.webp を使う
    img.onerror = () => {
      if (img.dataset.fallbackApplied) return; // 無限ループ防止
      img.dataset.fallbackApplied = '1';
      img.src = 'img/00000.webp';
    };
    img.alt = card.name;
    cardEl.appendChild(img);

    // 枚数バッジ
    const badge = document.createElement("div");
    badge.className = "count-badge";
    badge.textContent = count;
    cardEl.appendChild(badge);

    // PCの場合：左クリック追加、右クリック削除
    cardEl.addEventListener("mousedown", e => {
      if (e.button === 2) {
        e.preventDefault();
        removeCard(cd);
      } else if (e.button === 0) {
        e.preventDefault();
        addCard(cd);
      }
    });
    //モバイルの場合：上下フリックで追加/削除
    (function attachTouchSwipe(el, cd){
      let startX = 0, startY = 0;
      const THRESHOLD = 20; // しきい値（px）
      const MAX_SHIFT = 40; // 視覚アニメ距離（px）

      const cleanUp = () => {
        el.style.transform = 'translateY(0)';
        el.style.zIndex = '';
      };

      el.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        el.style.transition = '';
        el.style.zIndex = '2000'; // ヘッダー等より前面
      }, {passive:true});

      el.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;

        // 横が優勢なら（deck-bar の pan-x を妨げない）
        if (Math.abs(dx) > Math.abs(dy)) return;

        // 視覚フィードバック（±40px に制限）
        let limited = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, dy));
        el.style.transform = `translateY(${limited}px)`;
      }, {passive:true});

      el.addEventListener('touchend', (e) => {
        const endY = e.changedTouches[0].clientY;
        const diffY = startY - endY; // 上=正、下=負
        el.style.transition = 'transform 0.2s ease';

        const isSwipe = Math.abs(diffY) > THRESHOLD;
        if (!isSwipe) {
          setTimeout(() => { el.style.transition = ''; cleanUp(); }, 200);
          return;
        }

        // 方向別に 40px だけスッと動かしてから確定
        const to = diffY > 0 ? -MAX_SHIFT : MAX_SHIFT;
        el.style.transform = `translateY(${to}px)`;
        setTimeout(() => {
          el.style.transition = '';
          cleanUp();
          if (diffY > 0) {
            // 上フリック：追加（上限/旧神/種族は addCard 内で判定）
            addCard(cd);
          } else {
            // 下フリック：削除
            removeCard(cd);
          }
        }, 200);
      }, {passive:true});

      el.addEventListener('touchcancel', () => {
        cleanUp();
      }, {passive:true});
    })(cardEl, cd);

    cardEl.addEventListener("contextmenu", e => e.preventDefault());

    deckBarTop.appendChild(cardEl);
    autoscaleBadgeForCardEl(cardEl);//枚数表示サイズ調整
  });


  // デッキカードの情報を配列化してサマリー更新
  const deckCards = [];
  Object.entries(deck).forEach(([cd, count]) => {
    const card = cardMap[cd];
    if (!card) return;
    for (let i = 0; i < count; i++) {
      deckCards.push({ 種族: card.race, タイプ: card.type });
    }
  });

  updateCardDisabling();// カード禁止表示・バッジ更新など
  updateDeckSummary(deckCards);//デッキ分析（タイプ等）
  updateDeckAnalysis();//デッキ詳細情報分析
  updateExchangeSummary();  // ポイント等のサマリーを更新
  updateDeckCardListBackground();//リスト背景変更
  scheduleAutosave();  //オートセーブ
  updateAutoTags();//自動タグ設定
  // ▼ デッキ由来カテゴリでタグ候補を更新（投稿タブがある時だけ）
if (document.getElementById('select-tags')) renderPostSelectTags();

}

// === デッキバーの横スクロールを保持したまま処理を実行 ===
function withDeckBarScrollKept(doRender) {
  const scroller = document.querySelector('.deck-bar-scroll');
  const prev = scroller ? scroller.scrollLeft : 0;
  // レンダリング実行
  doRender?.();
  // レンダリング直後はDOMがまだ安定していない可能性があるので2フレーム待って復元
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (scroller) scroller.scrollLeft = prev;
    });
  });
}


/*カード使用状況判定*/
/*説明
 * カードの使用状況に応じてデッキ外の一覧をグレースケールにしたり、「使用中×n」「旧神使用中」ラベルを付ける処理。（ここでは基本的な禁止/許可判定のみ抜粋しています）
 */
function updateCardDisabling() {
  const deckRaces = new Set();
  let currentOldGod = null;

// デッキに含まれる種族と旧神を集計
  Object.keys(deck).forEach(cd => {
    const card = cardMap[cd];
    if (!card) return;
    if (card.race !== "イノセント" && card.race !== "旧神") {
      deckRaces.add(card.race);
    }
    if (card.race === "旧神") {
      currentOldGod = card.name;
    }
  });

  document.querySelectorAll(".card").forEach(cardEl => {
    const cd = cardEl.dataset.cd;
    const card = cardMap[cd];
    if (!card) return;

// 使用種族以外（イノセント・旧神除く）の定義
    const isUnselectedRace =
      deckRaces.size > 0 &&//１枚存在
      card.race !== "イノセント" &&//イノセント以外
      card.race !== "旧神" &&//旧神以外
      !deckRaces.has(card.race);//使用種族を持たない
//使用種族以外をグレースケール化
    if (isUnselectedRace) {
      cardEl.classList.add("grayscale");
    } else {
      cardEl.classList.remove("grayscale");
    }

// 使用枚数や旧神利用中のラベル表示
    const label = cardEl.querySelector(".used-label") || document.createElement("div");
    label.className = "used-label";
    label.textContent = "";

    if (card.race === "旧神") {
      if (deck[cd]) {
        label.textContent = "旧神使用";
      } else if (currentOldGod) {
        label.textContent = "他の旧神を使用中";
      }
    } else {
      const count = deck[cd] || 0;
      if (count > 0) {
        label.textContent = `使用中 ×${count}`;
      }
    }
// ラベル生成・テキスト設定後
if (!label.dataset.listenerAttached) {
  // 右クリック：カードを1枚削除
  label.addEventListener("contextmenu", e => {
    e.preventDefault();
    e.stopPropagation();
    removeCard(cd);
  });
  // 左クリック：カードを1枚追加
  label.addEventListener("click", e => {
    e.stopPropagation();
    addCard(cd);
  });
  // リスナー登録済みフラグ
  label.dataset.listenerAttached = "true";
}

    // 既に付いていない場合だけ append
    if (!cardEl.contains(label)) {
      cardEl.appendChild(label);
    }
  });

}

//#endregion

/*==============================
    6.デッキ分析-デッキリスト画面
===============================*/
//#region

//デッキリスト表示
function renderDeckList() {
  const container = document.getElementById('deck-card-list');
  const emptyMessage = document.getElementById('deckcard-empty-message');
  if (!container) return;

  // クリア＆プレースホルダ差し戻し
  container.innerHTML = '';
  if (emptyMessage) container.appendChild(emptyMessage);

  // [cd, 枚数] へ変換
  const entries = Object.entries(deck);

  // ソート（タイプ→コスト→パワー→ID）
  const typeOrder = { 'チャージャー': 0, 'アタッカー': 1, 'ブロッカー': 2 };
  entries.sort((a, b) => {
    const [cdA] = a;
    const [cdB] = b;
    const cardA = cardMap[cdA];
    const cardB = cardMap[cdB];
    if (!cardA || !cardB) return 0;
    const typeA = typeOrder[cardA.type] ?? 99;
    const typeB = typeOrder[cardB.type] ?? 99;
    if (typeA !== typeB) return typeA - typeB;
    const costA  = (parseInt(cardA.cost)  || 0);
    const costB  = (parseInt(cardB.cost)  || 0);
    if (costA !== costB) return costA - costB;
    const powerA = (parseInt(cardA.power) || 0);
    const powerB = (parseInt(cardB.power) || 0);
    if (powerA !== powerB) return powerA - powerB;
    return cdA.localeCompare(cdB);
  });


  // 代表カードの整合性を先に確定
  const representativeExists = entries.some(([cd]) => cd === representativeCd);
  let nextRepresentative = representativeExists
    ? representativeCd
    : (entries.length > 0 ? entries[0][0] : null);

  // 空表示制御（この時点でOK）
  if (emptyMessage) {
    emptyMessage.style.display = entries.length === 0 ? 'flex' : 'none';
  }
  if (entries.length === 0) {
    // 空なら代表名表示だけ同期して終わり
    representativeCd = null;
    updateDeckSummaryDisplay();
    return;
  }

// 並び替え後をDOM化（この時点で代表クラスも付与）
  for (const [cd, count] of entries) {
    const card = cardMap[cd];
    if (!card) continue;

    const cardEl = document.createElement('div');
    cardEl.className = 'deck-entry';
    cardEl.dataset.cd = cd;
    cardEl.dataset.race = card.race;
    cardEl.dataset.type = card.type;
    cardEl.dataset.rarity = card.rarity || '';

    // 代表カードならその場でクラス付与
    if (cd === nextRepresentative) {
      cardEl.classList.add('representative');
    }

    const img = document.createElement('img');
    img.src = `img/${cd.slice(0, 5)}.webp`;
    // フォールバック：個別画像が無いときは 00000.webp を使う
    img.onerror = () => {
      if (img.dataset.fallbackApplied) return; // 無限ループ防止
      img.dataset.fallbackApplied = '1';
      img.src = 'img/00000.webp';
    };
    img.alt = card.name;
    cardEl.appendChild(img);

    const badge = document.createElement('div');
    badge.className = 'count-badge';
    badge.textContent = `×${count}`;
    cardEl.appendChild(badge);

    // クリックで代表カードを切替
  cardEl.addEventListener('click', () => {
  if (representativeCd === cd) return;
  // 新代表に付与＆変数更新
  representativeCd = cd;
  // グローバルにもコピーする
  window.representativeCd = representativeCd;
  updateDeckSummaryDisplay();
});


    container.appendChild(cardEl);
    autoscaleBadgeForCardEl(cardEl);//枚数表示サイズ調整
  }

  representativeCd = nextRepresentative;  // 代表カードの最終確定
  updateDeckSummaryDisplay();//代表カードデッキ情報表示
  updateDeckCardListBackground();//リスト背景変更
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



//代表カードクラス付与
  function updateRepresentativeHighlight() {
    document.querySelectorAll(".deck-entry").forEach(el => {
      el.classList.remove("representative");
      if (el.dataset.cd === representativeCd) {
        el.classList.add("representative");
      }
    });
  }


//代表カードデッキ情報表示
  function updateDeckSummaryDisplay() {
    const name = cardMap[representativeCd]?.name || "未選択";
    document.getElementById("deck-representative").textContent = name;
  }

//デッキリスト「デッキをここに表示」
  function updateDeckEmptyMessage() {
    const deck = document.getElementById("deck-card-list");
    const msg = document.getElementById("deckcard-empty-message");
    if (!deck || !msg) return;
    const cards = deck.querySelectorAll(".deck-entry"); // ← カードクラス名に合わせて変更

    if (cards.length === 0) {
      msg.style.display = "flex";
    } else {
      msg.style.display = "none";
    }
  }

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


//#endregion

/*==============================
    6.デッキ分析-デッキ情報-
===============================*/

//#region

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
  const countByType = type =>
    deckCards.filter(c => c.タイプ === type).length;
  document.getElementById("count-charger").textContent = countByType("チャージャー");
  document.getElementById("count-attacker").textContent = countByType("アタッカー");
  document.getElementById("count-blocker").textContent = countByType("ブロッカー");

  updateAutoTags();//自動タグ
}


// ===== デッキ分析更新 =====
function updateDeckAnalysis() {
  // deck と cardMap からカード詳細を展開
  const deckCards = [];
  Object.entries(deck).forEach(([cd, count]) => {
    const card = cardMap[cd];
    if (!card) return;
    for (let i = 0; i < count; i++) {
      deckCards.push({
        cd,
        race: card.race,
        type: card.type,
        cost: parseInt(card.cost) || 0,
        power: parseInt(card.power) || 0,
        rarity: card.rarity || ''
      });
    }
  });

// レアリティ集計
const rarityCounts = { 'レジェンド': 0, 'ゴールド': 0, 'シルバー': 0, 'ブロンズ': 0 };
deckCards.forEach(c => {
  if (rarityCounts.hasOwnProperty(c.rarity)) rarityCounts[c.rarity]++;
});

// 1行表示（🌈 / 🟡 / ⚪️ / 🟤）
const raritySummary = document.getElementById("rarity-summary");
if (raritySummary) {
  const legend = rarityCounts['レジェンド'];
  const gold   = rarityCounts['ゴールド'];
  const silver = rarityCounts['シルバー'];
  const bronze = rarityCounts['ブロンズ'];
  raritySummary.textContent = `🌈${legend}枚/ 🟡${gold}枚/ ⚪️${silver}枚 / 🟤${bronze}枚`;
}

  // コスト・パワーの棒グラフを生成
  // ===== コスト／パワー分布グラフ =====

  // 1) 分布を集計
  const costCount = {};
  const powerCount = {};
  deckCards.forEach(c => {
    if (!Number.isNaN(c.cost))  costCount[c.cost]  = (costCount[c.cost]  || 0) + 1;
    if (!Number.isNaN(c.power)) powerCount[c.power] = (powerCount[c.power] || 0) + 1;
  });

  // 2) ラベルを用意（常に見せたい目盛りを混ぜて空バーも0で出す）
  const alwaysShowCosts  = [2, 4, 6, 8, 10, 12];
  const alwaysShowPowers = [0, 4, 5, 6, 7, 8, 12, 16];

  const costLabels = [...new Set([...alwaysShowCosts, ...Object.keys(costCount).map(Number)])]
    .sort((a,b)=>a-b);
  const powerLabels = [...new Set([...alwaysShowPowers, ...Object.keys(powerCount).map(Number)])]
    .sort((a,b)=>a-b);

  const costData  = costLabels.map(k => costCount[k]  || 0);
  const powerData = powerLabels.map(k => powerCount[k] || 0);

// 3) 総コスト/パワー表示
// 総コスト計算
const sumCost = deckCards.reduce((s, c) => s + (c.cost || 0), 0);
const sumCostEl = document.getElementById('total-cost');
if (sumCostEl) sumCostEl.textContent = String(sumCost);

// タイプ別総パワー計算
let chargerPower = 0;
let attackerPower = 0;
deckCards.forEach(c => {
  if (c.type === "チャージャー") {
    chargerPower += (c.power || 0);
  } else if (c.type === "アタッカー") {
    attackerPower += (c.power || 0);
  }
});

// 表示
const sumPowerEl = document.getElementById('total-power');
if (sumPowerEl) {
  sumPowerEl.textContent = `🔵${chargerPower} 🟣${attackerPower}`;
}


// 4) 初手事故率（マリガン対応）
// 可とみなす条件：コスト4以下
const earlyPlayable = deckCards.filter(c => (c.cost || 0) <= 4).length;

// マリガン枚数の反映：value="0" のとき 4枚、以降 value の分だけ +1
const mulliganEl = document.getElementById('mulligan-count');
const mulliganVal = parseInt(mulliganEl?.value ?? '0', 10) || 0;
const draws = 4 + mulliganVal;

// 事故率（= 引いた全カードが「非プレイ可能」になる確率）
const badRatePercent = calculateBadHandRate(deckCards.length, earlyPlayable, draws) * 100;

// 表示
const badRateEl = document.getElementById('bad-hand-rate');
if (badRateEl) badRateEl.textContent = `${badRatePercent.toFixed(1)}%`;

// 1%以下なら注記を表示、それ以外は非表示
let freqEl = document.getElementById('bad-hand-frequency');
// 必要なら自動生成（HTMLに既にあるならこの塊は実行されません）
if (!freqEl && badRateEl) {
  freqEl = document.createElement('span');
  freqEl.id = 'bad-hand-frequency';
  freqEl.textContent = '（ほぼ事故なし）';
  badRateEl.insertAdjacentElement('afterend', freqEl);
}
if (freqEl) {
  freqEl.style.display = (badRatePercent <= 1) ? '' : 'none';
}


// 5) データラベル（最初に一度だけでOK）
try { Chart.register(window.ChartDataLabels); } catch (_) {}

// 6) 積み上げ棒グラフ（タイプ別）
const TYPES = ['チャージャー', 'アタッカー', 'ブロッカー'];
const COLORS = {
  'チャージャー': 'rgba(119, 170, 212, 0.7)',
  'アタッカー':   'rgba(125, 91, 155, 0.7)',
  'ブロッカー':   'rgba(214, 212, 204, 0.7)',
};

function buildStackCounts(cards, key, labels) {
  const table = {};
  TYPES.forEach(t => { table[t] = Object.fromEntries(labels.map(l => [l, 0])); });
  cards.forEach(c => {
    const v = Number(c[key]);
    const t = c.type;
    if (!Number.isNaN(v) && table[t] && v in table[t]) table[t][v]++;
  });
  return TYPES.map(t => ({
    label: t,
    data: labels.map(l => table[t][l] || 0),
    backgroundColor: COLORS[t],
    borderWidth: 0,
    barPercentage: 0.9,
    categoryPercentage: 0.9,
  }));
}

// costLabels / powerLabels はこれまで通り作成済みとする
const costDatasets  = buildStackCounts(deckCards, 'cost',  costLabels);
const powerDatasets = buildStackCounts(deckCards, 'power', powerLabels);

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { stacked: true, grid: { display: false, drawBorder: false }, title: { display: false }, ticks: { autoSkip: false } },
    y: { stacked: true, beginAtZero: true, grid: { display: false, drawBorder: false }, title: { display: false }, ticks: { display: false } }
  },
  plugins: {
    legend: { display: false },
    datalabels: { display: true, anchor: 'center', align: 'center', formatter: v => v > 0 ? v : '', font: { weight: 600 }, clamp: true },
    tooltip: { enabled: true },
  },
};

// 既存チャートがあれば破棄してから作り直し
if (costChart)  costChart.destroy();
if (powerChart) powerChart.destroy();

const costCtx  = document.getElementById('costChart')?.getContext('2d');
const powerCtx = document.getElementById('powerChart')?.getContext('2d');

if (costCtx) {
  costChart = new Chart(costCtx, { type: 'bar', data: { labels: costLabels,  datasets: costDatasets  }, options: commonOptions });
}
if (powerCtx) {
  powerChart = new Chart(powerCtx,{ type: 'bar', data: { labels: powerLabels, datasets: powerDatasets }, options: commonOptions });
}

  updateAutoTags();//自動タグ設定
}

// ===== 初手事故率計算用 =====
function combination(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}
function calculateBadHandRate(total, early, draws) {
  const nonPlayable = total - early;
  if (nonPlayable < draws) return 0;
  const numer = combination(nonPlayable, draws);
  const denom = combination(total, draws);
  return denom === 0 ? 0 : numer / denom;
}

// ===== 分析表示切替 =====
function toggleAnalysis() {
  const section = document.getElementById("analysis-section");
  const btn = document.getElementById("toggle-analysis-btn");
  const isOpen = section.classList.toggle("open");
  if (isOpen) {
    updateDeckAnalysis(); // 開くときだけ分析を更新
    updateExchangeSummary();// ポイント等のサマリーを更新
    btn.textContent = "⬆ 分析を隠す";
  } else {
    btn.textContent = "🔍 分析を表示";
  }
}


// マリガン枚数変更時に再計算
document.getElementById('mulligan-count')?.addEventListener('change', () => updateDeckAnalysis());

/* =========================
   交換ポイント計算と表示
   - 不足枚数 = デッキ要求 - 所持合計(normal+shine+premium)
   - 不足分のみをポイント/ダイヤ/砂に換算
   - 砂はUIに合わせてレジェンド/ゴールドのみ表示
========================= */

// 1枚あたりの交換レート（前に入れていた export は不要です）
const EXCHANGE_RATE = {
  point:   { LEGEND: 300, GOLD: 150, SILVER: 20,  BRONZE: 10 },
  diamond: { LEGEND: 4000, GOLD: 1000, SILVER: 250, BRONZE: 150 },
  sand:    { LEGEND: 300, GOLD: 150, SILVER: 20,  BRONZE: 10 },
};

/** レアリティ文字列 → キー/アイコン */
function rarityToKeyJP(r) {
  if (!r) return null;
  if (r.includes('レジェ'))  return 'LEGEND';
  if (r.includes('ゴールド')) return 'GOLD';
  if (r.includes('シルバー')) return 'SILVER';
  if (r.includes('ブロンズ')) return 'BRONZE';
  return null;
}
const RARITY_ICON = { LEGEND:'🌈', GOLD:'🟡', SILVER:'⚪️', BRONZE:'🟤' };


function rarityIconJP(rarity) {
  if (!rarity) return '';
  if (rarity.includes('レジェ'))  return '🌈';
  if (rarity.includes('ゴールド')) return '🟡';
  if (rarity.includes('シルバー')) return '⚪️';
  if (rarity.includes('ブロンズ')) return '🟤';
  return '';
}

/** 不足カード（配列）をレアリティ別に合計 {LEGEND:n,...} */
function groupShortageByRarity(shortages){
  const sum = { LEGEND:0, GOLD:0, SILVER:0, BRONZE:0 };
  shortages.forEach(s=>{
    const info = cardMap[s.cd] || {};
    const key = rarityToKeyJP(info.rarity);
    if (key) sum[key] += (s.shortage|0);
  });
  return sum;
}

// 所持＝OwnedStore優先（未初期化時は localStorage）
// 既に page2.js にある readOwnedMapForDeckmaker() をそのまま使います

function computeExchangeNeeds() {
  const owned = readOwnedMapForDeckmaker();
  let point = 0, diamond = 0;
  const sand = { LEGEND: 0, GOLD: 0, SILVER: 0, BRONZE: 0 };
  const shortages = [];

  for (const [cd, need] of Object.entries(deck)) {
    const info = cardMap[cd];
    if (!info) continue;
    const key = rarityToKeyJP(info.rarity);
    if (!key) continue;

    const v = owned[cd] || { normal:0, shine:0, premium:0 };
    const have = (v.normal|0) + (v.shine|0) + (v.premium|0);
    const shortage = Math.max(0, (need|0) - have);
    if (!shortage) continue;

    point   += EXCHANGE_RATE.point[key]   * shortage;
    diamond += EXCHANGE_RATE.diamond[key] * shortage;
    sand[key] += EXCHANGE_RATE.sand[key]  * shortage;


    shortages.push({ cd, name: info.name, shortage });
  }
  return { point, diamond, sand, shortages };
}

function updateExchangeSummary() {
  const els = {
    point:    document.getElementById('point-cost'),
    diamond:  document.getElementById('diamond-cost'),
    sandLeg:  document.getElementById('sand-leg'),
    sandGld:  document.getElementById('sand-gld'),
    sandSil:  document.getElementById('sand-sil'),
    sandBro:  document.getElementById('sand-bro'),
  };
  if (!els.point) return;

  const { point, diamond, sand, } = computeExchangeNeeds();
  const fmt = (n) => String(n);

  // 数値の更新
  els.point.textContent   = String(point);
  els.diamond.textContent = String(diamond);
  els.sandLeg.textContent = String(sand.LEGEND);
  els.sandGld.textContent = String(sand.GOLD);
  els.sandSil.textContent = String(sand.SILVER);
  els.sandBro.textContent = String(sand.BRONZE);

}



// 表示切り替え（ボタンの onclick="toggleExchange()" から呼ばれる）
let __exchangeMode = 'point'; // 'point' | 'diamond' | 'sand'

function setExchangeVisible(mode) {
  const elPoint = document.getElementById('exchange-point');
  const elDia   = document.getElementById('exchange-diamond');
  const elSand  = document.getElementById('exchange-sand');
  if (elPoint) elPoint.style.display = (mode === 'point'   ? '' : 'none');
  if (elDia)   elDia.style.display   = (mode === 'diamond' ? '' : 'none');
  if (elSand)  elSand.style.display  = (mode === 'sand'    ? '' : 'none');

  const btn = document.getElementById('exchange-toggle-btn');
  if (btn) {
    btn.textContent =
      mode === 'point'   ? '🟢 ポイント' :
      mode === 'diamond' ? '💎 ダイヤ' :
                           '🪨 砂';
  }
}
function toggleExchange() {
  __exchangeMode = (__exchangeMode === 'point')
    ? 'diamond'
    : (__exchangeMode === 'diamond' ? 'sand' : 'point');
  setExchangeVisible(__exchangeMode);
}

// 初期表示はポイント
document.addEventListener('DOMContentLoaded', () => {
  setExchangeVisible('point');
  updateExchangeSummary();
});


/* =========================
   🆕 マリガン練習ロジック
   ========================= */

(() => {
  const HAND_SIZE = 4;

    const els = {
    trainer:   document.getElementById('mulligan-trainer'),
    warning:   document.getElementById('mull-warning'),
    hand:      document.getElementById('mull-hand'),
    btn:       document.getElementById('btn-mull-or-reset'),
    remainList:document.getElementById('mull-remaining-by-type'),
  };

  if (!els.trainer) return; // 他ページ安全化

   // 共有（common.js）
  const getDeckObject = () => (window.deck || {});
  const getCardInfo   = (cd) => (window.cardMap?.[String(cd)] || window.allCardsMap?.[String(cd)]);

    // 状態
  const state = {
    pool: [],  // 山札（手札４枚以外のデッキリスト）
    hand: [],  // { cd, selected }
  };

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
  function renderHand(){
    els.hand.innerHTML = '';
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
        title.textContent = info?.name ? `${info.name}（${slot.cd}）` : `No Image (${slot.cd})`;
        wrap.appendChild(title);

        const errImg = document.createElement('img');
        errImg.alt = '';
        errImg.src = 'img/00000.webp';
        errImg.style.display = 'none';
        wrap.appendChild(errImg);
      };

      // タップで選択トグル
      wrap.addEventListener('click', () => {
        slot.selected = !slot.selected;
        wrap.dataset.selected = slot.selected ? 'true' : 'false';
        refreshUI();
      });

      wrap.appendChild(img);
      els.hand.appendChild(wrap);
    });
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

function renderRemainingByType() {
  if (!els.remainList) return;
  const types = [
    { key: 'チャージャー', emoji: '🔵', label: 'チャ' },
    { key: 'アタッカー',   emoji: '🟣', label: 'アタ' },
    { key: 'ブロッカー',   emoji: '⚪️', label: 'ブロ' },
  ];
  const counts = tallyPoolByType();
  els.remainList.innerHTML = '';

  for (const t of types) {
    const n = counts[t.key] ?? 0;
    const li = document.createElement('li');
    li.className = 'mrt-chip compact';
    li.dataset.type = t.key;
    li.textContent = `${t.emoji}${t.label}${n}`;
    els.remainList.appendChild(li);
  }
}





  // UI活性とボタン文言切替（単一ボタン仕様）
  function refreshUI(){
    const deckSize = Object.values(getDeckObject()).reduce((a,b)=>a+(b|0),0);
    const hasDeck  = deckSize >= 30;
    const anySelected = state.hand.some(h => h.selected);
    const canReset    = hasDeck && deckSize >= HAND_SIZE;
    const canMull     = hasDeck && anySelected && state.pool.length > 0;

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




// 所持データが変わったら自動で再計算（OwnedStore.onChange があるので利用）
if (window.OwnedStore?.onChange) {
  window.OwnedStore.onChange(() => updateExchangeSummary());
}


/** コンパクト不足UIの描画 */
function renderShortageCompact(shortages){
  const line  = document.getElementById('shortage-summary-line');
  const list  = document.getElementById('shortage-collapsible');
  if (!line || !list) return;

  const sum = groupShortageByRarity(shortages);
  line.textContent = `${RARITY_ICON.LEGEND}${sum.LEGEND}枚 / ${RARITY_ICON.GOLD}${sum.GOLD}枚 / ${RARITY_ICON.SILVER}${sum.SILVER}枚 / ${RARITY_ICON.BRONZE}${sum.BRONZE}枚`;

  // リスト再描画
  list.innerHTML = '';

  // ▼ ここから追記：先頭にヒント行を入れる
  const hint = document.createElement('div');
  hint.className = 'shortage-hint';
  hint.textContent = 'タップ/クリックでカード表示';
  list.appendChild(hint);
  // ▲ ここまで追記

  if (!shortages.length) {
    const div = document.createElement('div');
    div.textContent = '不足はありません';
    list.appendChild(div);
    return;
  }

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
/*不足リスト閉じるorタブ切り替え時にプレビュー閉じる*/
document.getElementById('shortage-toggle-btn')?.addEventListener('click', ()=> hideCardPreview());
document.addEventListener('deckTabSwitched', ()=> hideCardPreview()); // 既存フックが無ければ afterTabSwitched 内で直接呼んでもOK



/** 必要ポイント（コンパクト）の描画 */
let __exchangeModeCompact = 'point'; // 'point'|'diamond'|'sand'
function setExchangeCompact(values){
  const wrap = document.getElementById('exchange-values-compact');
  const btn  = document.getElementById('exchange-toggle-btn-compact');
  if (!wrap || !btn) return;

  const { point, diamond, sand } = values;
  const html =
    (__exchangeModeCompact === 'point')
      ? `🟢 必要ポイント：<strong>${point}</strong>`
      : (__exchangeModeCompact === 'diamond')
        ? `💎 必要ダイヤ：<strong>${diamond}</strong>`
        : `🪨 必要砂：<ul>
             <li>レジェンド：${sand.LEGEND}個</li>
             <li>ゴールド：${sand.GOLD}個</li>
             <li>シルバー：${sand.SILVER}個</li>
             <li>ブロンズ：${sand.BRONZE}個</li>
           </ul>`;

  wrap.innerHTML = html;
  btn.textContent =
    (__exchangeModeCompact === 'point')   ? '🟢 ポイント' :
    (__exchangeModeCompact === 'diamond') ? '💎 ダイヤ' : '🪨 砂';
}
function toggleExchangeCompact(){
  __exchangeModeCompact =
    (__exchangeModeCompact === 'point')   ? 'diamond' :
    (__exchangeModeCompact === 'diamond') ? 'sand'    : 'point';
  // 値は直近の計算結果から再描画
  const { point, diamond, sand } = computeExchangeNeeds();
  setExchangeCompact({ point, diamond, sand });
}
window.toggleExchangeCompact = toggleExchangeCompact;

/** まとめ：計算→新UI描画 */
function renderOwnedInfoCompact(){
  const ownedBox = document.getElementById('owned-info');
  if (!ownedBox) return;

  const { point, diamond, sand, shortages } = computeExchangeNeeds();
  renderShortageCompact(shortages);
  setExchangeCompact({ point, diamond, sand });
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
window.toggleExchange = toggleExchange;
window.updateExchangeSummary = updateExchangeSummary;

window.updateDeckAnalysis = updateDeckAnalysis;





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

// 画像読み込み（フォールバックは 00000.webp）
function loadCardImage(cd){
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { img.onerror = null; img.src = 'img/00000.webp'; };
    img.src = `img/${cd}.webp`;
  });
}

// <img>を枠いっぱいに「cover」させるための計算
function fitCover(sw, sh, dw, dh){
  const sr = sw/sh, dr = dw/dh;
  let w, h, dx, dy;
  if (sr > dr){ h = dh; w = h*sr; dx = -(w-dw)/2; dy = 0; }
  else       { w = dw; h = w/sr; dx = 0;         dy = -(h-dh)/2; }
  return {w,h,dx,dy};
}



/*デッキ名同期
*デッキ情報のデッキ名とデッキ投稿のデッキ名が同じになるようにする
*/
(function () {
  const $ = (id) => document.getElementById(id);
  const infoNameEl = $('info-deck-name');
  const postNameEl = $('post-deck-name');

  function setBoth(val) {
    if (infoNameEl && infoNameEl.value !== val) infoNameEl.value = val;
    if (postNameEl && postNameEl.value !== val) postNameEl.value = val;
  }

  // どちらかが入力されたら相互に反映
  infoNameEl?.addEventListener('input', () => setBoth(infoNameEl.value));
  postNameEl?.addEventListener('input', () => setBoth(postNameEl.value));

  // タブ切替や外部からも呼べる同期関数を公開
  window.syncDeckNameFields = function () {
    const cur = (postNameEl?.value?.trim()) || (infoNameEl?.value?.trim()) || '';
    setBoth(cur);
  };

  // 初期同期（片方が空で片方に値があるケースの吸収）
  window.addEventListener('DOMContentLoaded', () => window.syncDeckNameFields?.());
})();

//#endregion


/*=================================
      7.デッキ保存機能
================================*/
//#region


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
        deckData.date = formatYmd();
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
      date: formatYmd()
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
    date: formatYmd()
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
  scheduleAutosave();  //オートセーブ
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

  // データ初期化
  Object.keys(deck).forEach(k => delete deck[k]);
  representativeCd = null;

  //デッキ名（情報タブ＆投稿タブ）も空に
  writeDeckNameInput(''); // info側（#info-deck-name）
  const postNameEl = document.getElementById('post-deck-name');
  if (postNameEl) postNameEl.value = '';       // 投稿側（#post-deck-name）
  if (typeof window.syncDeckNameFields === 'function') window.syncDeckNameFields(); // 念のため同期
  clearAutosave(); // 🔁 オートセーブも消して復活しないように


  // UI更新（横スクロール保持）
  withDeckBarScrollKept(() => {
    updateDeck();       // デッキバー＆サマリー再計算
    renderDeckList();   // デッキリスト画像エリア再描画
  });

  // 付随パネルや数値も同期
  updateDeckSummaryDisplay();
  updateExchangeSummary();
  scheduleAutosave();  //オートセーブ
});


//#endregion



/*=================================
      8.デッキ投稿
================================*/

/** =========================
 *  デッキ投稿UI 初期化
 *  ========================= */

/*選択タグ設定*/
window.POST_TAG_CANDIDATES ??= [
  "アグロ","ミッドレンジ","コントロール","コンボ","バーン","初心者向け","趣味構築","ネタ構築","ランク戦用","大会用","格安"
];

// その後に通常の定数定義（必要なら）
const POST_TAG_CANDIDATES = window.POST_TAG_CANDIDATES;


// ===== カード読み込み完了後のフック =====
// common-page12.js の loadCards() 完了時に呼ばれる
window.onCardsLoaded = function() {
  if (typeof rebuildCardMap === 'function') rebuildCardMap();
  if (document.getElementById('select-tags')) renderPostSelectTags();
};


/* ✅ 保存キー（選択状態を保持） */
const SELECT_TAGS_KEY = 'dm_post_select_tags_v1';


/* 既存の選択状態 読み書き */
function readSelectedTags() {
  try { return new Set(JSON.parse(localStorage.getItem(SELECT_TAGS_KEY) || '[]')); }
  catch { return new Set(); }
}
function writeSelectedTags(setOrArray) {
  const arr = Array.isArray(setOrArray) ? setOrArray : Array.from(setOrArray);
  localStorage.setItem(SELECT_TAGS_KEY, JSON.stringify(arr));
}

/* cards データの取得（既にグローバルがあればそれを使う / なければ fetch） */
async function getAllCardsForTags() {
  // グローバルに置いてあるケースを広めに拾う
  const candidates = [window.cards, window.allCards, window.cardData, window.CARDS];
  for (const c of candidates) if (Array.isArray(c) && c.length) return c;

  // それでも無ければJSONから読む
  const res = await fetch('public/cards_latest.json', { cache: 'no-store' });
  const data = await res.json();
  // is_latest がある前提なら最新のみ
  const latest = Array.isArray(data) ? data.filter(x => x?.is_latest !== false) : [];
  return latest.length ? latest : (Array.isArray(data) ? data : []);
}

/* デッキに含まれるカテゴリ候補を抽出*/
function getDeckCategoryTags() {
  const bad = new Set(['ノーカテゴリ', 'なし', '-', '', null, undefined]);
  const set = new Set();
  Object.entries(deck || {}).forEach(([cd, n]) => {
    if (!n) return;
    const cat = cardMap[cd]?.category;
    if (!bad.has(cat)) set.add(String(cat).trim());
  });
  return Array.from(set); // 例：["アドミラルシップ","テックノイズ", ...]
}

/* 重複除去
  基本タグ + カテゴリタグ 並べ替え（基本→カテゴリの順）
  */
function buildMergedTagList(baseTags, categoryTags) {
  const merged = [];
  const seen = new Set();
  baseTags.forEach(t => { if (!seen.has(t)) { merged.push(t); seen.add(t); } });
  categoryTags.sort((a,b)=>a.localeCompare(b,'ja')).forEach(t => {
    if (!seen.has(t)) { merged.push(t); seen.add(t); }
  });
  return merged;
}


/* 実描画 */
async function renderPostSelectTags() {
  const wrap = document.getElementById('select-tags');
  if (!wrap) return;

  // いまの選択を保持
  const selected = readSelectedTags();

  // デッキに含まれるカテゴリのみ（デッキが空なら[]）
  const categoryTags = getDeckCategoryTags();

  // 基本タグ + カテゴリ（五十音）
  const merged = buildMergedTagList(POST_TAG_CANDIDATES, categoryTags);

  // 画面再構築
  wrap.innerHTML = '';
  const hint = document.createElement('div');
  hint.className = 'tags-hint';
  hint.textContent = 'タップでさらにタグを追加';
  wrap.appendChild(hint);
  const frag = document.createDocumentFragment();

  merged.forEach(label=> {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = label;
    chip.dataset.tag = label;

    // 復元（存在しないカテゴリは消すため、後で整合性をとる）
    if (selected.has(label)) chip.classList.add('active');

    chip.addEventListener('click', () => {
      const now = readSelectedTags();
      if (chip.classList.toggle('active')) now.add(label);
      else now.delete(label);
      writeSelectedTags(now);
    });

    frag.appendChild(chip);
  });

  wrap.appendChild(frag);

  // いま表示していない（=デッキから消えた）カテゴリは掃除（基本タグは残す）
  const visible = new Set(merged);
  const cleaned = Array.from(selected).filter(t => visible.has(t) || POST_TAG_CANDIDATES.includes(t));
  writeSelectedTags(cleaned);

  // 取得APIは据え置き
  window.getSelectedPostTags = () => Array.from(readSelectedTags());
}


/* タブ表示前に先に描画してもOK（非表示でも動きます） */
document.addEventListener('DOMContentLoaded', () => {
  // post-tab があるページだけで動く
  if (document.getElementById('post-tab')) {
    renderPostSelectTags().catch(console.error);
  }
});







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

// --- 骨組みコメント（初回のみ自動挿入） ---
function ensurePostCommentSkeleton() {
  const ta = document.getElementById('post-note');
  if (!ta) return;
  const SKELETON =
`【デッキの狙い】
・

【キーカード／採用理由】
・

【マリガンの基準】
・

【立ち回りのコツ】
・

【弱点・苦手対面】
・`;
  if (!ta.value.trim()) ta.value = SKELETON;
}





// デッキ投稿タブが開かれたタイミングで一度だけ
document.addEventListener('DOMContentLoaded', () => {
  // post-tab が存在するページのみ
  if (document.getElementById('post-tab')) {
    ensurePostCommentSkeleton();
  }
});



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

/** タブ遷移時に同期（既に afterTabSwitched があるなら post-tab を足す） */
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

// ===== 自動タグ生成 =====
function updateAutoTags() {
  const autoWrap = document.getElementById('auto-tags');
  if (!autoWrap) return;

    // 🟣 デッキが空ならタグを生成しない
  const deckCount = Object.values(deck).reduce((sum, n) => sum + n, 0);
  if (deckCount === 0) {
    autoWrap.innerHTML = '';
    return;
  }

  const autoTags = [];

  // === 1.メイン種族 ===
  const mainRace = computeMainRace?.();
  if (mainRace) autoTags.push(mainRace);

  // === 2.レアリティ関連 ===
  const rarityCounts = { 'レジェンド': 0, 'ゴールド': 0, 'シルバー': 0, 'ブロンズ': 0 };
  Object.entries(deck).forEach(([cd, n]) => {
    const r = cardMap[cd]?.rarity;
    if (r && rarityCounts[r] != null) rarityCounts[r] += n;
  });

  const legendNone = rarityCounts['レジェンド'] === 0;
  const goldNone = rarityCounts['ゴールド'] === 0;
  if (legendNone && goldNone) {
    autoTags.push('レジェンドゴールドなし');
  } else if (legendNone) {
    autoTags.push('レジェンドなし');
  }

  // === 3.旧神 ===
  const hasOldGod = Object.keys(deck).some(cd => cardMap[cd]?.race === '旧神');
  if (!hasOldGod) autoTags.push('旧神なし');

    // === 4.コラボカード ===
    //デッキ内に1枚でもコラボカードが入っている
  const hasCollab = Object.keys(deck).some(cd => {
    const el = document.querySelector(`.card[data-cd="${cd}"]`);
    const pack = (el?.dataset?.pack || '').toLowerCase();
    // 「コラボ」や「collab」を含むものをコラボとみなす
    return /コラボ|collab/.test(pack);
  });
  if (hasCollab) autoTags.push('コラボカード');

  // === 5.ハイランダー ===
  // デッキ30枚以上、かつ全カードが1枚ずつ（重複なし）
  const deckCountForHL = Object.values(deck).reduce((s, n) => s + (n | 0), 0);
  const isHighlander = deckCountForHL >= 30 && Object.values(deck).every(n => (n | 0) === 1);
  if (isHighlander) autoTags.push('ハイランダー');



  // === 出力 ===
  autoWrap.innerHTML = '';
  autoTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = tag;
    chip.dataset.auto = "true";
    autoWrap.appendChild(chip);
  });
}

/*同意チェック*/
function bindMinimalAgreeCheck() {
  const agree = document.getElementById('post-agree');
  const submit = document.getElementById('post-submit');
  const preview = document.querySelector('#post-tab .post-actions button[type="button"]');
  if (!agree || !submit) return;

  const sync = () => {
    const ok = !!agree.checked;
    submit.disabled = !ok;
    if (preview) preview.disabled = !ok;
    submit.classList.toggle('is-disabled', !ok);
    if (preview) preview.classList.toggle('is-disabled', !ok);
  };

  agree.addEventListener('change', sync);
  sync();
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('post-tab')) bindMinimalAgreeCheck();
});



// ==== 不足カード画像プレビュー共通層 ====
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
// 画面のどこかをクリックしたら閉じる（プレビュー上のクリックは除外）
document.addEventListener('click', (e) => {
  const pop = document.getElementById('card-preview-pop');
  if (pop && pop.style.display !== 'none' && !e.target.closest('#card-preview-pop')) {
    hideCardPreview();
  }
});



/** 送信 */
async function submitDeckPost(e) {
  e.preventDefault();
  refreshPostSummary();

  // 簡易バリデーション
  const errors = validateDeckBeforePost();
  const status = document.getElementById('post-status');
  if (errors.length) {
    status.textContent = '⚠ ' + errors.join(' / ');
    return;
  }

  const btn = document.getElementById('post-submit');
  btn.disabled = true;
  status.textContent = '送信中…';

  const payload = buildDeckPostPayload();

  try {
    // 送信（プリフライト回避版）
    const res = await fetch(GAS_POST_ENDPOINT, {
        method: 'POST',
        body: new URLSearchParams({
          payload: JSON.stringify(payload) // ← 文字列1個
        })
      });
      const text = await res.text();
      let json = {};
      try { json = JSON.parse(text); } catch {}
      if (json.ok) {
        status.textContent = '✅ 投稿しました';
      } else {
        status.textContent = '❌ エラー：' + (json.error || '不明');
      }
  } catch (err) {
    console.error('POST failed:', err);
    status.textContent = '❌ 通信失敗：' + (err?.message || err);
  } finally {
    btn.disabled = false;
  }
}

// ================================
// カード解説（複数行）管理：デッキ内カードのみ / 画像モーダル選択 / 5列 / 重複名OK / 既選択は無効化
// ================================
(function(){
  const MAX_NOTES = Infinity;            // 上限は後で数値に
  let cardNotes = [];                    // [{ cd:'12345', text:'...' }, ...]
  let pickingIndex = -1;                 // どの行の選択中か
  const TYPE_ORDER = { 'チャージャー':0,'アタッカー':1,'ブロッカー':2 };

  // 参照キャッシュ
  const elNotes     = () => document.getElementById('post-card-notes');
  const elHidden    = () => document.getElementById('post-card-notes-hidden');
  const elModal     = () => document.getElementById('cardNoteSelectModal');
  const elCandidates= () => document.getElementById('cardNoteCandidates');

  // === ユーティリティ ===
  const typeOrderOf = (t)=> TYPE_ORDER[t] ?? 99;
  const ensureImg = (imgEl, cd) => {
    imgEl.src = `img/${String(cd).slice(0,5)}.webp`;
    imgEl.onerror = () => { imgEl.onerror=null; imgEl.src='img/00000.webp'; };
  };
  const currentDeckUniqueCds = () => Object.keys(window.deck || {});
  function sortByRule(cds){
    return cds.sort((a,b)=>{
      const A = cardMap[a] || {}, B = cardMap[b] || {};
      const t = typeOrderOf(A.type) - typeOrderOf(B.type); if (t) return t;
      const c = (A.cost|0) - (B.cost|0);                   if (c) return c;
      const p = (A.power|0) - (B.power|0);                 if (p) return p;
      return String(a).localeCompare(String(b));
    });
  }

  // === 画面レンダリング ===
function renderRows() {
  const root = elNotes();
  if (!root) return;
  root.innerHTML = '';

  cardNotes.forEach((row, idx) => {
    const cd = row.cd ? String(row.cd) : '';
    const item = document.createElement('div');
    item.className = 'post-card-note';
    item.dataset.index = idx;

    const cardName = cd ? (cardMap[cd]?.name || '') : 'カードを選択';

    item.innerHTML = `
      <div class="left">
        <div class="thumb">
          <img alt="" src="${cd ? `img/${cd.slice(0,5)}.webp` : 'img/00000.webp'}"
               onerror="this.src='img/00000.webp'">
        </div>
        <div class="actions">
          <button type="button" class="note-move" data-dir="-1">↑</button>
          <button type="button" class="note-move" data-dir="1">↓</button>
          <button type="button" class="note-remove">削除</button>
        </div>
      </div>

      <button type="button" class="pick-btn">${cardName}</button>

      <textarea class="note" placeholder="このカードの採用理由・使い方など">${row.text || ''}</textarea>
    `;

    root.appendChild(item);
  });

  if (elHidden()) elHidden().value = JSON.stringify(cardNotes);
  }



  function addRow(initial={cd:'', text:''}){
    if (cardNotes.length >= MAX_NOTES) { alert(`カード解説は最大 ${MAX_NOTES} 件までです`); return; }
    cardNotes.push({ cd: initial.cd || '', text: initial.text || '' });
    renderRows();
  }
  function removeRow(index){ cardNotes.splice(index,1); renderRows(); }
  function moveRow(index, dir){
    const j = index + dir;
    if (j < 0 || j >= cardNotes.length) return;
    [cardNotes[index], cardNotes[j]] = [cardNotes[j], cardNotes[index]];
    renderRows();
  }

  // === 候補モーダル ===
  function openPickerFor(index) {
  pickingIndex = index | 0;

  const list = currentDeckUniqueCds();
  if (!list.length) {
    alert('デッキが空です。先にデッキへカードを追加してください。');
    return;
  }

  const used = new Set(
    cardNotes
      .filter((_, i) => i !== pickingIndex)
      .map(row => String(row.cd))
      .filter(Boolean)
  );

  const sorted = sortByRule(list.slice());
  const grid = elCandidates();
  grid.innerHTML = '';

  sorted.forEach(cd => {
    const wrap = document.createElement('div');
    wrap.className = 'item' + (used.has(cd) ? ' disabled' : '');
    wrap.dataset.cd = cd;

    const img = document.createElement('img');
    ensureImg(img, cd);
    wrap.appendChild(img);

    if (!used.has(cd)) {
      wrap.addEventListener('click', () => pickCard(cd));
    }
    grid.appendChild(wrap);
  });

  showPickerModal(true);
}

  function showPickerModal(open){
    const m = elModal();
    if (!m) return;
    m.style.display = open ? 'block' : 'none';
  }

  function pickCard(cd){
    if (pickingIndex < 0) return;
    cardNotes[pickingIndex].cd = String(cd);
    renderRows();
    showPickerModal(false);
    pickingIndex = -1;
  }

  // === イベント結線（デリゲーション） ===
  document.addEventListener('click', (e)=>{
    // 追加ボタン
    if (e.target.id === 'add-card-note') { addRow(); return; }

    // 行内の操作
    const rowEl = e.target.closest('.post-card-note');
    if (rowEl) {
      const idx = rowEl.dataset.index|0;

      if (e.target.matches('.pick-btn')) { openPickerFor(idx); return; }
      if (e.target.matches('.note-remove')) { removeRow(idx); return; }
      if (e.target.matches('.note-move')) {
        const dir = parseInt(e.target.dataset.dir, 10) || 0;
        moveRow(idx, dir);
        return;
      }
    }

    // モーダルの閉じる
    if (e.target.id === 'cardNoteClose' || (e.target.id === 'cardNoteSelectModal' && e.target === elModal())) {
      showPickerModal(false);
      pickingIndex = -1;
    }
  });

  // テキスト入力でモデル更新
  document.addEventListener('input', (e)=>{
    const rowEl = e.target.closest('.post-card-note');
    if (!rowEl) return;
    const idx = rowEl.dataset.index|0;
    if (e.target.matches('.note')) {
      cardNotes[idx].text = e.target.value;
      if (elHidden()) elHidden().value = JSON.stringify(cardNotes);
    }
  });

  // カードデータ読込後・最初の描画
  window.onCardsLoaded = (function(prev){
    return function(){
      if (typeof prev === 'function') prev();
      if (elNotes() && !elNotes().children.length) {
        if (!Array.isArray(cardNotes) || !cardNotes.length) cardNotes = [{ cd:'', text:'' }];
        renderRows();
      }
    };
  })(window.onCardsLoaded);

  // 投稿時に hidden を同期（保険）
  window.__collectCardNotesForSubmit = function(){
    if (elHidden()) elHidden().value = JSON.stringify(cardNotes);
    return cardNotes;
  };
  const hookSubmit = (prev)=> function(e){ try{ window.__collectCardNotesForSubmit(); }catch{} return prev?.call(this,e); };
  if (typeof window.submitDeckPost === 'function') window.submitDeckPost = hookSubmit(window.submitDeckPost);

})();




function validateDeckBeforePost(){
  const msgs = [];
  // 30〜40枚
  const n = typeof getDeckCount==='function' ? getDeckCount() : 0;
  if (n < 30 || n > 40) msgs.push(`枚数が範囲外(${n})`);
  // 同名3枚/旧神1種1枚/種族制限は、あなたの既存ロジックがあればそれを利用して判定メッセージをpush
  if (typeof validateDeckConstraints==='function') {
    const more = validateDeckConstraints(); // 例：配列で返す
    if (Array.isArray(more)) msgs.push(...more);
  }
  // デッキ名の取得（info/postどちらからでもOK）
  const infoNameEl = document.getElementById('info-deck-name');
  const postNameEl = document.getElementById('post-deck-name');
  const title =
    (postNameEl?.value?.trim()) ||
    (infoNameEl?.value?.trim()) ||
    ''; // 両方空なら空文字

  if (!title) msgs.push('デッキ名が未入力');
  // 同意
  if (!document.getElementById('post-agree')?.checked) msgs.push('ガイドライン未同意');
  return msgs;
}

function buildDeckPostPayload(){
  const title = document.getElementById('post-deck-name')?.value.trim() || '';
  const comment = document.getElementById('post-note')?.value.trim() || '';
  const tags = Array.from(document.querySelectorAll('#post-tags .chip.active')).map(b=>b.textContent);
  const code = document.getElementById('post-deck-code')?.value || '';
  const races = document.getElementById('post-races-hidden')?.value || '';
  const repImg = document.getElementById('post-rep-img')?.value || '';
  const count = typeof getDeckCount==='function' ? getDeckCount() : 0;

  // 必要に応じてカード配列・代表カードcdなども付与
  const cards = typeof getDeckAsArray==='function' ? getDeckAsArray() : []; // [{cd, count}, ...] を想定

  return {
    title,
    comment,
    tags,
    code,
    count,
    races,
    repImg,
    cards,
    includeImage: !!document.getElementById('post-include-image')?.checked,
    ua: navigator.userAgent,
    ts: Date.now()
  };
}

const GAS_POST_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxDi1ymeMAT-RKA9DszfI1jOAfgh00zU60TPUltLsiLkXvIlRyFkvDmKUTvN-AYCDjp/exec';

