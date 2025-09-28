/*================
    1.初期設定
===============*/
// 起動時：OwnedStore自動保存OFF（このページは手動保存モード）
if (window.OwnedStore?.setAutosave) {
  window.OwnedStore.setAutosave(false);
}

// ===== 所持データ保存フロー（未保存検知 & 退避） =====
(function setupOwnershipSaveFlow() {
  // 未保存フラグ（このページ限定）
  window.__ownedDirty = false;

  // ---- OwnedStoreのスナップショット管理 ----
  function normalizeOwnedMap(src = {}) {
    const out = {};
    for (const cd in src) {
      const v = src[cd];
      out[cd] = (v && typeof v === 'object')
        ? { normal: v.normal|0, shine: v.shine|0, premium: v.premium|0 }
        : { normal: v|0,      shine: 0,           premium: 0 };
    }
    return out;
  }
  function readPersistedOwned() {
    try { return JSON.parse(localStorage.getItem('ownedCards') || '{}') || {}; }
    catch { return {}; }
  }
  function takeOwnedSnapshotFromPersist() {
    window.__ownedSnapshot = normalizeOwnedMap(readPersistedOwned());
    window.__ownedSnapshotInited = true;
  }
  function applyOwnedMapToStore(map) {
    if (!window.OwnedStore?.set) return;
    const current = (window.OwnedStore.getAll && window.OwnedStore.getAll()) || {};
    const keys = new Set([...Object.keys(current), ...Object.keys(map)]);
    keys.forEach(cd => {
      const v = map[cd] || { normal:0, shine:0, premium:0 };
      window.OwnedStore.set(String(cd), { normal: v.normal|0, shine: v.shine|0, premium: v.premium|0 });
    });
  }
  window.revertOwnedToSaved = function() {
    if (!window.__ownedSnapshotInited) takeOwnedSnapshotFromPersist();
    applyOwnedMapToStore(window.__ownedSnapshot || {});
    window.__ownedDirty = false;
    // 画面同期
    if (typeof window.applyGrayscaleFilter === 'function') window.applyGrayscaleFilter();
    if (typeof window.updateOwnedTotal === 'function') window.updateOwnedTotal();
    if (typeof window.updateSummary === 'function') window.updateSummary();
  };

  // 起動時：OwnedStoreを掴んでおく
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', takeOwnedSnapshotFromPersist, { once:true });
  } else {
    takeOwnedSnapshotFromPersist();
  }

  // 変更があれば未保存フラグON
  function markDirty(){ window.__ownedDirty = true; }
  if (window.OwnedStore?.onChange) {
    OwnedStore.onChange(markDirty);
  } else {
    window.addEventListener('load', () => {
      if (window.OwnedStore?.onChange) OwnedStore.onChange(markDirty);
    });
  }

  // 共通：未保存なら保存するか確認 → OKなら保存・NGなら巻き戻し
  window.saveOwnedIfDirty = function (reason='') {
    if (!window.OwnedStore) return;
    if (!window.__ownedDirty) return;
    const ok = confirm('所持データに未保存の変更があります。保存しますか？');
    if (ok) {
      try {
        OwnedStore.save();
        // 保存されたので A を更新
        takeOwnedSnapshotFromPersist();
        window.__ownedDirty = false;
        alert('所持データを保存しました');
      } catch (e) {
        console.error(e);
        alert('保存に失敗しました');
      }
    } else {
      // ★ 保存しない → OwnedStore に巻き戻す
      window.revertOwnedToSaved();
    }
  };

  // ブラウザ離脱（閉じる/リロード等）警告
  window.addEventListener('beforeunload', (e) => {
    if (window.__ownedDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // 別ページへのリンククリック時も保存確認（このページ内のみ）
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || a.target === '_blank') return;
    try { const u = new URL(href, location.href); if (u.origin !== location.origin) return; } catch {}
    if (!document.getElementById('checker') && !document.getElementById('owned')) return;

    if (window.__ownedDirty) {
      const ok = confirm('未保存の所持データがあります。保存しますか？');
      if (ok) {
        try { OwnedStore.save(); window.__ownedDirty = false; takeOwnedSnapshotFromPersist(); } catch {}
      } else {
        // ★ 保存しない →OwnedStore に巻き戻してから遷移
        window.revertOwnedToSaved();
      }
    }
  });

  // タブ切替時の保存確認（common-page23.js から呼ばれる）
  window.beforeTabSwitch = function(fromId, toId) {
    const leavingOwnedPages =
      (fromId === 'checker' && toId !== 'checker') ||
      (fromId === 'owned'   && toId !== 'owned');
    if (leavingOwnedPages) {
      window.saveOwnedIfDirty(`tab:${fromId}->${toId}`);
    }
  };
})();


document.addEventListener('DOMContentLoaded', () => {
  updateSummary(); // 初回反映
});
/*===================
    2.所持率コンプ率
====================*/
const packs = [
  { key:'awaking',
    nameMain:'Awaking The Oracle',
    nameSub:'「神託者の覚醒」',
    selector:'#pack-awaking'
  },
    { key:'beyond',
    nameMain:'Beyond the Sanctuary',
    nameSub:'「聖域の先へ」',
    selector:'#pack-beyond'
  },
    { key:'creeping',
    nameMain:'Creeping Souls',
    nameSub:'「忍び寄る魂達」',
    selector:'#pack-creeping'
  },
];

// ★ クリックハンドラで参照するため公開
window.packs = packs;

function calcSummary(nodeList){
  let owned = 0, ownedTypes = 0, total = 0, totalTypes = 0;
  nodeList.forEach(card => {
    const cnt = parseInt(card.dataset.count) || 0;
    owned += cnt;
    if (cnt > 0) ownedTypes++;
    // 旧神=1、それ以外=3 を分母に採用
    total += (card.dataset.race === '旧神') ? 1 : 3;
  });
  totalTypes = nodeList.length;
  const percent = total ? Math.round((owned/total)*100) : 0;                 // コンプ率%
  const typePercent = totalTypes ? Math.round((ownedTypes/totalTypes)*100) : 0; // 所持率%
  return { owned, ownedTypes, total, totalTypes, percent, typePercent };
}


// === 全体所持率（PCサイドバー & スマホ上部）を更新 ===
function updateOverallSummary(){
  const allCards = document.querySelectorAll('#packs-root .card');

  const s = calcSummary(allCards);

  // PCサイドバー #summary 内の .summary-rate を書き換え
  const pcRate = document.querySelector('#summary .summary-rate');
  if (pcRate){
    pcRate.innerHTML =
      `所持率: ${s.ownedTypes}/${s.totalTypes} (${s.typePercent}%)<br>` +
      `コンプ率: ${s.owned}/${s.total} (${s.percent}%)`;
  }

// 枚数＋%の所持率/コンプ率を含める
const pcTweet = document.querySelector('#summary .summary-share a');
if (pcTweet){
  const txt = buildShareText({
    header: '全カード',
    sum: s, // updateOverallSummary内で求めた全体サマリー
  });
  pcTweet.href = `https://twitter.com/intent/tweet?text=${txt}`;
}


  // スマホ上部バー（所持率・コンプ率・全体）を同期
  const moTypeCount   = document.getElementById('mobile-owned-type-count');
  const moTypeTotal   = document.getElementById('mobile-total-type-count');
  const moTypePercent = document.getElementById('mobile-owned-type-percent');
  const moOwned       = document.getElementById('mobile-owned-count');
  const moTotal       = document.getElementById('mobile-total-count');
  const moPercent     = document.getElementById('mobile-owned-percent');

  if (moTypeCount)   moTypeCount.textContent = s.ownedTypes;
  if (moTypeTotal)   moTypeTotal.textContent = s.totalTypes;
  if (moTypePercent) moTypePercent.textContent = `${s.typePercent}%`;
  if (moOwned)       moOwned.textContent = s.owned;
  if (moTotal)       moTotal.textContent = s.total;
  if (moPercent)     moPercent.textContent = `${s.percent}%`;


// 両方とも「枚数＋%」の所持率/コンプ率で出す
const mobileTweet = document.getElementById('mobile-tweet-link');
if (mobileTweet){
  const selKey = (document.getElementById('pack-selector')||{}).value;

  let packName = '';
  let packSum = null;
  if (selKey && selKey !== 'all') {
    const selPack = Array.isArray(packs) ? packs.find(p=>p.key===selKey) : null;
    if (selPack){
      packName = selPack.nameMain;
      const selCards = queryCardsByPack(selPack);
      packSum = calcSummary(selCards);
    }
  }

// モバイル：パック選択時は「全カード」を出さず、そのパックのみをポスト
  let mtxt;
  if (selKey && selKey !== 'all' && packSum && packName) {
    // パックが選ばれているとき → そのパックだけ
    mtxt = buildShareText({
      header: packName,
      sum: packSum
    });
  } else {
    // 「全カード」選択時 → 全体だけ
    mtxt = buildShareText({
      header: '全カード',
      sum: s
    });
  }
  mobileTweet.href = `https://twitter.com/intent/tweet?text=${mtxt}`;
}

}

  // モバイル：進捗バー付きサマリーHTMLを返す
  function renderMobilePackSummaryHTML(s){
    return `
      <div class="pack-meters">
        <div class="meter">
          <div class="meter-label">所持率</div>
          <div class="meter-track" role="progressbar"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.typePercent}">
            <span class="meter-bar" style="width:${s.typePercent}%"></span>
          </div>
          <div class="meter-val">${s.ownedTypes}/${s.totalTypes} (${s.typePercent}%)</div>
        </div>
        <div class="meter">
          <div class="meter-label">コンプ率</div>
          <div class="meter-track" role="progressbar"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.percent}">
            <span class="meter-bar -comp" style="width:${s.percent}%"></span>
          </div>
          <div class="meter-val">${s.owned}/${s.total} (${s.percent}%)</div>
        </div>
      </div>`;
  }


// === 各パック所持率（PCの #pack-summary-list は li を使わず、指定の div 構成で生成） ===
function updatePackSummary(){
  const pcList = document.getElementById('pack-summary-list');
  const mobileSelect = document.getElementById('pack-selector');
  const mobileSummary = document.getElementById('mobile-pack-summary');

  if (!pcList) return;

  pcList.innerHTML = '';
  if (mobileSelect) {
    // 既存の選択値を保持
    const prev = mobileSelect.value;
    mobileSelect.innerHTML = '';
    // 先頭に「全カード」
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = '全カード';
    mobileSelect.appendChild(optAll);
  }

  (packs || []).forEach(pack => {
    const cards = queryCardsByPack(pack);
    const s = calcSummary(cards);

    const wrap = document.createElement('div');
    wrap.className = 'pack-summary';
    wrap.innerHTML = `
      <a href="${pack.selector}" class="pack-summary-link">
        <span class="pack-summary-name">${pack.nameMain}<br><small>${pack.nameSub || ''}</small></span>
        <span class="pack-summary-rate">
          所持率: ${s.ownedTypes}/${s.totalTypes} (${s.typePercent}%)<br>
          コンプ率: ${s.owned}/${s.total} (${s.percent}%)
        </span>
      </a>
    `;
// 枚数＋%の所持率/コンプ率
const packTxt = buildShareText({
  header: pack.nameMain,
  sum: s, // そのパックのサマリー
});
const share = document.createElement('div');
share.className = 'summary-share';
share.innerHTML = `
  <a class="custom-tweet-button" href="https://twitter.com/intent/tweet?text=${packTxt}" target="_blank" rel="noopener">
    <img class="tweet-icon" src="img/x-logo.svg" alt="Post"><span>ポスト</span>
  </a>
`;

    wrap.appendChild(share);
    pcList.appendChild(wrap);

    // スマホ: セレクト
    if (mobileSelect){
      const opt = document.createElement('option');
      opt.value = pack.key;
      opt.textContent = pack.nameMain;
      mobileSelect.appendChild(opt);
    }
  });

  // ★ 初期値が空なら先頭を選ぶ（.value が空のままの環境対策）
  if (mobileSelect) {
    // 既存選択があれば維持、なければ "all"
    if (!mobileSelect.value) mobileSelect.value = 'all';
  }

  // スマホ: 現在選択中パックの概要
  if (mobileSelect && mobileSummary) {
    const key = mobileSelect.value;
    let s;
    if (key === 'all') {
      const all = document.querySelectorAll('#packs-root .card');
      s = calcSummary(all);
    } else {
      const sel = packs.find(p => p.key === key) || packs[0];
      const cards = queryCardsByPack(sel);
      s = calcSummary(cards);
    }
    mobileSummary.innerHTML = renderMobilePackSummaryHTML(s);

    // 初期ロード時もジャンプボタンを制御
    const jumpBtn = document.getElementById('jump-pack-btn');
    if (jumpBtn) jumpBtn.style.display = (key==='all' ? 'none' : 'inline-block');
  }
}



// 既存のトグル／+1ボタン等から呼ばれる updateSummary を差し替え（呼び出し名は据え置き）:contentReference[oaicite:15]{index=15}
function updateSummary(){
  updateOverallSummary();
  updatePackSummary();
}


// === スマホ: プルダウン変更で #mobile-pack-summary を更新 ===
function selectMobilePack(packKey) {
  // セレクトの表示値を同期
  const sel = document.getElementById('pack-selector');
  if (sel && sel.value !== packKey) sel.value = packKey;

  // packs から該当パックを取得（なければ先頭）
  let s;
  if (packKey === 'all') {
    const allCards = document.querySelectorAll('#packs-root .card');    s = calcSummary(allCards);
  } else {
    const pack = (Array.isArray(packs) ? packs.find(p => p.key === packKey) : null) || (packs?.[0]);
    if (!pack) return;
    const cards = queryCardsByPack(pack);
    s = calcSummary(cards);
  }

  // モバイル上部サマリーを書き換え
  const mobileSummary = document.getElementById('mobile-pack-summary');
  if (mobileSummary) {
    mobileSummary.innerHTML = renderMobilePackSummaryHTML(s);
  }

  //全カード時ジャンプボタン非表示
  document.getElementById('jump-pack-btn').style.display = (packKey==='all'?'none':'inline-block');

  // ツイート文言の選択パック率も更新
  updateOverallSummary();
}

//パックへジャンプ
function jumpToSelectedPack(){
  const sel = document.getElementById('pack-selector');
  const key = sel?.value;
  if(!key || key === 'all') return;

  // パックセクションに id="pack-〇〇" を振っている想定
  const target = document.querySelector(`#pack-${key}`);
  if(target){
    target.scrollIntoView({behavior:'smooth', block:'start'});
  }
}




// グローバル公開（HTML の onchange="selectMobilePack(this.value)" から呼ぶため）
window.selectMobilePack = selectMobilePack;

// ==== 共有用テキスト生成（Xのintent用） ====
function buildShareText({
  header = '全カード',
  sum,                // { ownedTypes, totalTypes, typePercent } を利用
  packName = '',      // 追加で表示したいパック名（任意）
  packSum = null,     // そのパックのサマリー（任意）
  url = 'https://mosurogia.github.io/cardcheker/', // 既存どおり
  useFullWidthHash = false, // 半角ハッシュ（#）
} = {}) {
  const hashTag = useFullWidthHash ? '＃神託のメソロギア' : '#神託のメソロギア';
  const lines = [
    '【神託のメソロギア】',
    header,
    `所持率: ${sum.ownedTypes}/${sum.totalTypes} (${sum.typePercent}%)`,
  ];
  if (packSum && packName) {
    lines.push(
      packName,
      `所持率: ${packSum.ownedTypes}/${packSum.totalTypes} (${packSum.typePercent}%)`,
    );
  }
  lines.push(
    'モスロギア～所持率チェッカー～',
    hashTag,
    url
  );
  return encodeURIComponent(lines.join('\n'));
}


/*===================
    3.メニューボタン
====================*/

// 所持率データ保存（保存後は未保存フラグをクリア & A更新）
function saveOwnership() {
  if (!window.OwnedStore?.save) { alert('保存機能が初期化されていません'); return; }
  try {
    OwnedStore.save();
    if (typeof localStorage !== 'undefined') {
      // OwnedStoreを取り直す
      try { window.__ownedSnapshot = JSON.parse(localStorage.getItem('ownedCards') || '{}') || {}; }
      catch { window.__ownedSnapshot = {}; }
      window.__ownedSnapshotInited = true;
    }
    window.__ownedDirty = false;
    alert('所持データを保存しました');
  } catch (e) {
    console.error(e);
    alert('保存に失敗しました');
  }
}


// カード順の共通化（cd昇順／is_latest優先）
async function getCanonicalOrderForOwned() {
  if (window.__CARD_ORDER && window.__CARD_ORDER.length) return window.__CARD_ORDER.slice();
  let cards = [];
  try {
    if (typeof fetchLatestCards === 'function') {
      cards = await fetchLatestCards(); // あるはず
    } else {
      const res = await fetch('./cards_latest.json');
      const all = await res.json();
      cards = all.filter(c => c.is_latest);
    }
  } catch (e) { console.error(e); }

  cards.sort((a,b) => (parseInt(a.cd,10)||0) - (parseInt(b.cd,10)||0));
  window.__CARD_ORDER = cards.map(c => String(c.cd));
  return window.__CARD_ORDER.slice();
}

// Base64URL（= /+ → _-、=除去）
function b64urlFromBytes(bytes){
  let bin = '';
  for (let i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
// 1バイトXORの簡易チェックサム（短くて十分）
function xorChecksum(bytes){
  let x=0; for (let i=0;i<bytes.length;i++) x^=bytes[i];
  return (x & 0xff).toString(16).padStart(2,'0');
}


// 所持枚数（0..3）を2bitでパック
function pack2bit(counts){
  const n = counts.length;
  const out = new Uint8Array(Math.ceil(n/4));
  for (let i=0;i<n;i++){
    const q = i >> 2;
    const r = i & 3;
    out[q] |= (counts[i] & 3) << (r*2);
  }
  return out;
}




// OwnedStore から正規化して取得（normalのみ使用）
function getOwnedCountSafe(cd){
  if (!window.OwnedStore) return 0;
  const v = (OwnedStore.get && OwnedStore.get(String(cd))) || 0;
  if (typeof v === 'number') return Math.max(0, Math.min(3, v|0));
  const n = (v && v.normal != null) ? (v.normal|0) : 0;
  return Math.max(0, Math.min(3, n));
}


// --- v1: 全カード2bit固定 ---
async function buildOwnedPayloadV1() {
  const order = await getCanonicalOrderForOwned();
  const counts = new Uint8Array(order.length);
  for (let i = 0; i < order.length; i++) counts[i] = getOwnedCountSafe(order[i]) & 3;

  const bytes = pack2bit(counts); // 既存の pack2bit（4件/byte）を使う
  const cs = xorChecksum(bytes);
  return '1' + cs + b64urlFromBytes(bytes);
}

// --- v2: スパース（bitset + 非0のみ2bit値列） ---
function packBitsetFromCounts(counts) {
  const n = counts.length;
  const out = new Uint8Array(Math.ceil(n / 8));
  for (let i = 0; i < n; i++) {
    if ((counts[i] & 3) !== 0) {
      out[i >> 3] |= (1 << (i & 7)); // LSBファースト
    }
  }
  return out;
}
// --- v3: 位置デルタ(Varint) + 値(2bit) ---
// 構造: [K(varint)] [delta1..deltaK(varint)] [values(2bit packed K個)]
// delta は  (pos - prev)  をそのまま varint 化（最小値1。prevは開始時-1）
async function buildOwnedPayloadV3() {
  const order = await getCanonicalOrderForOwned();
  const countsAll = new Uint8Array(order.length);
  for (let i = 0; i < order.length; i++) countsAll[i] = getOwnedCountSafe(order[i]) & 3;

  // 非0の位置と値を抽出
  const pos = [];
  const nzv = [];
  for (let i = 0; i < countsAll.length; i++) {
    const c = countsAll[i] & 3;
    if (c !== 0) { pos.push(i); nzv.push(c); }
  }

  // K
  const K = pos.length;
  const head = encodeVarint(K);

  // Δエンコード（gapPlus = pos - prev、prev 初期値は -1）
  let prev = -1;
  const gaps = [];
  for (let i = 0; i < K; i++) {
    const gapPlus = pos[i] - prev;   // 1以上になる
    gaps.push(...encodeVarint(gapPlus));
    prev = pos[i];
  }

  // 値(2bit)をパック
  const values = pack2bitCompact(nzv);

  const body = concatBytes([Uint8Array.from(head), Uint8Array.from(gaps), values]);
  const cs = xorChecksum(body);
  return '3' + cs + b64urlFromBytes(body);
}

function pack2bitCompact(values) {
  // values: 非0の枚数配列（各要素1..3）
  const n = values.length;
  const out = new Uint8Array(Math.ceil(n / 4));
  for (let i = 0; i < n; i++) {
    const q = i >> 2, r = i & 3;
    out[q] |= (values[i] & 3) << (r * 2);
  }
  return out;
}
async function buildOwnedPayloadV2() {
  const order = await getCanonicalOrderForOwned();
  const countsAll = new Uint8Array(order.length);
  for (let i = 0; i < order.length; i++) countsAll[i] = getOwnedCountSafe(order[i]) & 3;

  const bitset = packBitsetFromCounts(countsAll);
  const nz = [];
  for (let i = 0; i < countsAll.length; i++) if (countsAll[i] !== 0) nz.push(countsAll[i] & 3);
  const vals = pack2bitCompact(nz);

  const combined = new Uint8Array(bitset.length + vals.length);
  combined.set(bitset, 0);
  combined.set(vals, bitset.length);

  const cs = xorChecksum(combined);
  return '2' + cs + b64urlFromBytes(combined);
}
// ---- varint (base128) helpers ----
function encodeVarint(n) {
  n = Math.max(0, n >>> 0);
  const out = [];
  while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
  out.push(n);
  return out;
}
function concatBytes(arrs){
  let len = 0; arrs.forEach(a => len += a.length);
  const out = new Uint8Array(len);
  let off = 0;
  arrs.forEach(a => { out.set(a, off); off += a.length; });
  return out;
}
function decodeVarint(bytes, offs = 0) {
  let x = 0, shift = 0, i = offs;
  for (; i < bytes.length; i++) {
    const b = bytes[i];
    x |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) { i++; break; }
    shift += 7;
  }
  return [x >>> 0, i - offs]; // [値, 消費バイト数]
}

// --- 自動（短い方を採用） ---
async function buildOwnedPayloadAuto() {
  const [p1, p2, p3] = await Promise.all([
    buildOwnedPayloadV1(),
    buildOwnedPayloadV2(),
    buildOwnedPayloadV3()
  ]);
  return [p1, p2, p3].reduce((a, b) => (b.length < a.length ? b : a));
}
(async () => {
  const p1 = await buildOwnedPayloadV1();
  const p2 = await buildOwnedPayloadV2();
  const p3 = await buildOwnedPayloadV3();
  const pa = await buildOwnedPayloadAuto();
  console.table([
    { ver:'v1', len:p1.length, sample:p1.slice(0,30)+'…' },
    { ver:'v2', len:p2.length, sample:p2.slice(0,30)+'…' },
    { ver:'v3', len:p3.length, sample:p3.slice(0,30)+'…' },
    { ver:'auto', len:pa.length, sample:pa.slice(0,30)+'…' },
  ]);
})();


// 共有URL作成（deckmaker.html?o=...）
async function buildOwnedShareURL(){
  const payload = await buildOwnedPayloadAuto();
  const base = (location.href.includes('cardcheker.html'))
    ? location.href.replace(/cardcheker\.html.*$/,'deckmaker.html')
    : (location.origin + '/deckmaker.html');
  return `${base}?o=${payload}`;
}


// 共有コピー（未保存時：1段目=保存&コピー / 2段目=保存せずコピー or 中止）
(function wireShareOwnedButton(){
  const btns = Array.from(document.querySelectorAll('.js-share-owned, #share-owned-url, #owned-share-button'));
  if (btns.length === 0) return;

  async function doCopyShareUrl() {
    const url = await buildOwnedShareURL(); // v1/v2/v3の最短自動
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      alert('デッキメーカーでの共有URLを作成しました！\n\n' + url);
    } else {
      prompt('このURLをコピーしてください', url);
    }
  }

  const handler = async () => {
    try {
      if (window.__ownedDirty) {
        // 1段目：保存してからコピー？
        const doSave = confirm(
          '所持データに未保存の変更があります。\n' +
          '保存してからコピーしますか？\n\n' +
          'OK：保存してコピー\n' +
          'キャンセル：他の選択へ'
        );
        if (doSave) {
          try {
            OwnedStore.save();
            window.__ownedDirty = false;
            // Aスナップショット更新
            try { window.__ownedSnapshot = JSON.parse(localStorage.getItem('ownedCards') || '{}') || {}; } catch {}
            window.__ownedSnapshotInited = true;
            // 必要ならUI同期
            if (typeof window.applyGrayscaleFilter === 'function') window.applyGrayscaleFilter();
            if (typeof window.updateOwnedTotal === 'function') window.updateOwnedTotal();
            if (typeof window.updateSummary === 'function') window.updateSummary();
          } catch (e) {
            console.error(e);
            // 保存失敗時はユーザーに選ばせる：保存せずコピー？（失敗でも進めたいことが多い）
            const copyAnyway = confirm('保存に失敗しました。保存せずにコピーしますか？\n\nOK：保存せずコピー\nキャンセル：中止');
            if (!copyAnyway) return;
          }
          // 保存成功 or 保存失敗でもコピー続行
          await doCopyShareUrl();
          return;
        }

        // 2段目：保存せずコピー？
        const copyWithoutSave = confirm(
          '保存せずにコピーしますか？\n\n' +
          'OK：保存せずコピー（現在の変更内容で共有）\n' +
          'キャンセル：コピーを中止'
        );
        if (!copyWithoutSave) return; // 中止
        await doCopyShareUrl();
        return;
      }

      // 未保存変更が無ければそのままコピー
      await doCopyShareUrl();

    } catch (e) {
      console.error(e);
      alert('共有URLの作成に失敗しました');
    }
  };

  btns.forEach(b => b.addEventListener('click', handler));
})();





/*=======================
    2.所持率チェッカー変数
========================*/
//スラッグ：プログラム用文字列

// パック名表示順（未指定のものは末尾にアルファベット順で付く)
const PACK_ORDER = [
    'Awaking The Oracle',
    'Beyond the Sanctuary',
    'Creeping Souls',
    // 新パックをここに追加（無くても自動検出されます）
];

// パック名→id（スラッグ）化
const PACK_SLUG_ALIAS = {
    'Awaking The Oracle': 'awaking',
    'Beyond the Sanctuary': 'beyond',
    'Creeping Souls': 'creeping'
};

// 種族表示順
const RACE_ORDER = ['ドラゴン','アンドロイド','エレメンタル','ルミナス','シェイド','イノセント','旧神'];

//種族名→スラッグ化
const RACE_SLUG = {
  'ドラゴン':'dragon',
  'アンドロイド':'android',
  'エレメンタル':'elemental',
  'ルミナス':'luminous',
  'シェイド':'shade',
  'イノセント':'innocent',
  '旧神':'oldgod',
};

// レアリティ→スラッグ化
const RARITY_CLASS = {
  'レジェンド': 'legend',
  'ゴールド':   'gold',
  'シルバー':   'silver',
  'ブロンズ':   'bronze',
};

//カードの並び順
const TYPE_ORDER = { 'チャージャー': 0, 'アタッカー': 1, 'ブロッカー': 2 };

/* HTMLエスケープ
　*生成時にタグや属性などに解釈されコードが崩れたりすることがないようにするための措置
*/
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;')   // & → &amp;   （最優先：先にやる）
  .replace(/</g, '&lt;')    // < → &lt;
  .replace(/>/g, '&gt;')    // > → &gt;
  .replace(/"/g, '&quot;'); // " → &quot;  （属性が " で囲まれてるため必須）
const viewCategory = (s) => String(s ?? '').replace(/\s*[（(][^（）()]*[）)]\s*$/g, '');

/*=================================
    2.所持率チェッカー一覧生成
===================================*/

/*============生成前準備===========*/
//#regionready

// パック名分裂（英名和名で分裂）
function splitPackName(packName) {
    const i = packName.indexOf('「');
    if (i >= 0) return { en: packName.slice(0, i).trim(), jp: packName.slice(i).trim() };
    return { en: packName.trim(), jp: '' };
}
//パック英名→スラッグ用id生成
function makePackSlug(packEn) {
    return PACK_SLUG_ALIAS[packEn] || packEn.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

//レアリティclassを作る
function rarityClassOf(rarity) {
    const slug = RARITY_CLASS[rarity] || String(rarity).toLowerCase();
    return `rarity-${slug}`;
}


//カード並び替え
function typeCostPowerCd(a, b) {
  // 1) タイプ順（未定義は末尾へ）
    const ta = TYPE_ORDER[a.type] ?? 999;
    const tb = TYPE_ORDER[b.type] ?? 999;
    if (ta !== tb) return ta - tb;

  // 2) コスト昇順（数値化・未定義は大きく扱う）
    const ca = Number.isFinite(a.cost) ? a.cost : Number.MAX_SAFE_INTEGER;
    const cb = Number.isFinite(b.cost) ? b.cost : Number.MAX_SAFE_INTEGER;
    if (ca !== cb) return ca - cb;

  // 3) パワー昇順
    const pa = Number.isFinite(a.power) ? a.power : Number.MAX_SAFE_INTEGER;
    const pb = Number.isFinite(b.power) ? b.power : Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;

  // 4) cd昇順（数値化）
    const cda = Number.isFinite(+a.cd) ? +a.cd : Number.MAX_SAFE_INTEGER;
    const cdb = Number.isFinite(+b.cd) ? +b.cd : Number.MAX_SAFE_INTEGER;
    return cda - cdb;
}

//#endregionready

/*====一覧生成=======*/
//#regionroot
//所持率チェッカー生成構造
function buildPackSectionHTML(packEn, packJp, cardsGroupedByRace){
  const packSlug = makePackSlug(packEn);
  let html = '';
  html += `<section id="pack-${packSlug}" class="pack-section">`;
  html += `  <h3 class="pack-title">`;
  html += `    <span class="pack-name-main">${esc(packEn)}</span><br>`;
  html += `    <small class="pack-name-sub">${esc(packJp)}</small>`;
  html += `  </h3>`;
  html += `  <div class="race-controls">`;
  html += `    <button class="pack-select-all-btn">シルバーブロンズ+3</button>`;
  html += `    <button class="pack-clear-all-btn">全て選択解除</button>`;
  html += `<button class="missing-pack-btn">不足カード</button>
            `;
  html += `  </div>`;
  html += `  <div id="card-list-${packSlug}">`;

  for (const race of RACE_ORDER){
    const list = cardsGroupedByRace.get(race) || [];
    if (!list.length) continue;
    const raceSlug = RACE_SLUG[race] || race.toLowerCase();

    html += `    <section id="race-${raceSlug}-${packSlug}" class="race-group race-${esc(race)}">`;
    html += `      <h4>${esc(race)}</h4>`;
    html += `      <div class="race-controls">`;
    html += `        <button class="select-all-btn">全て選択+1</button>`;
    html += `        <button class="clear-all-btn">全て選択解除</button>`;
    html += `      </div>`;
    html += `      <div class="card-list">`;

    for (const c of list){
      const rarityCls = rarityClassOf(c.rarity);
      html += `        <div class="card ${rarityCls}" data-name="${esc(c.name)}" data-cd="${esc(c.cd)}"`;
      html += `          data-pack="${esc(c.pack_name)}" data-race="${esc(c.race)}" data-category="${esc(c.category)}"`;
      html += `          data-rarity="${esc(c.rarity)}" data-type="${esc(c.type)}" onclick="toggleOwnership(this)">`;
      html += `          <img alt="${esc(c.name)}" loading="lazy" src="img/${esc(c.cd)}.webp"
              onerror="if(!this.dataset.fallback){this.dataset.fallback=1;this.src='img/00000.webp';}" />`;

      html += `          <div class="owned-mark"></div>`;
      html += `        </div>`;
    }

    html += `      </div>`;
    html += `    </section>`;
  }

  html += `  </div>`;
  html += `</section>`;
  return html;
}

//jsonファイル→HTML生成
async function renderAllPacks({
    jsonUrl = './cards_latest.json',
    mountSelector = '#packs-root',
    isLatestOnly = true,// 最新版データのみ取得
    where = (c)=>true,// 追加の抽出条件（後で拡張しやすい）
    sortInRace = (a,b)=> (a.cd - b.cd), // 種族内の並び
    } = {}){

  //json取得
    let all;
    try {
    const res = await fetch(jsonUrl, { cache: 'no-store' }); // 更新が反映されやすいように
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    all = await res.json();
    } catch (err) {
    console.error('カードJSONの読み込みに失敗:', err);
    const mount = document.querySelector(mountSelector);
    if (mount) mount.textContent = 'データの読み込みに失敗しました。再読み込みしてください。';
    return; // 以降の処理を中断
    }


  // 抽出
    const source = all
    .filter(c => (!isLatestOnly || c.is_latest))
    .filter(where);//追加抽出用
    window.__cardsCache = source;

  // パック検出＆グループ化
    const byPack = new Map(); // key=英名, value={jp, cards:[]}
    for (const c of source){
        const pn = splitPackName(c.pack_name);
        if (!byPack.has(pn.en)) byPack.set(pn.en, { jp: pn.jp, cards: [] });
        byPack.get(pn.en).cards.push(c);
    }
    if (byPack.size === 0) return;

  // パック並び順
    const allPackEns = Array.from(byPack.keys());
    const rest = allPackEns
    .filter(p => !PACK_ORDER.includes(p))//PACK_ORDER優先
    .sort((a,b)=>a.localeCompare(b));//その他アルファベット順
    const orderedPacks = [...PACK_ORDER.filter(p=>byPack.has(p)), ...rest];

  // パックごとに種族で整列
    const parts = [];
    for (const packEn of orderedPacks){
        const { jp, cards } = byPack.get(packEn);

        // 種族グループ初期化
        const byRace = new Map(); for (const r of RACE_ORDER) byRace.set(r, []);// 表示順を固定
        for (const c of cards){
        if (!byRace.has(c.race)) byRace.set(c.race, []);
        byRace.get(c.race).push(c);
        }
        for (const r of byRace.keys()){
        byRace.get(r).sort(sortInRace);//カード並び順適用
        }
        parts.push(buildPackSectionHTML(packEn, jp, byRace));
    }

    const mount = document.querySelector(mountSelector);
    if (!mount) { console.error('mountSelectorが見つかりません:', mountSelector); return; }
    mount.innerHTML = parts.join('');

  // 生成後にコントロールイベントを委譲で付与
    attachPackControls(mount);
}

// 所持合計を読む（OwnedStore 優先）
function ownedTotal(cd){
  if (!window.OwnedStore) return 0;
  const e = OwnedStore.get(String(cd));
  return (e?.normal|0) + (e?.shine|0) + (e?.premium|0);
}

// 不足カード収集（scope === 'all' か pack オブジェクト）
function collectMissing(scope='all'){
  // 対象集合
  let list = [];
  if (scope === 'all'){
    list = Array.isArray(window.__cardsCache) ? window.__cardsCache : [];
  } else {
    const els = queryCardsByPack(scope); // 既存ヘルパ
    const byCd = new Set(Array.from(els).map(el => String(el.dataset.cd)));
    list = (Array.isArray(window.__cardsCache) ? window.__cardsCache : [])
            .filter(c => byCd.has(String(c.cd)));
  }

  const missing = [];
  for (const c of list){
    const max = (c.race === '旧神') ? 1 : 3;
    const own = ownedTotal(c.cd);
    const need = Math.max(0, max - own);
    if (need <= 0) continue;
    missing.push({
      cd:String(c.cd),
      name:c.name,
      need,
      max,
      rarity:c.rarity,
      cost:c.cost|0,
      power:c.power|0,
      type:c.type||'',
      race:c.race || ''
 });
  }

  // 並び順：パック → 種族 → タイプ → コスト → パワー → cd
  const packIdx = getPackOrderIndex();
  missing.sort((a,b)=>{
    // 1) パック順
    const pa = packIdx[packEnOf(a)] ?? 9999;
    const pb = packIdx[packEnOf(b)] ?? 9999;
    if (pa !== pb) return pa - pb;

    // 2) 種族
    const ra = raceRankOf(a.race || ''), rb = raceRankOf(b.race || '');
    if (ra !== rb) return ra - rb;

    // 3) タイプ
    const ta = TYPE_ORDER[a.type] ?? 999;
    const tb = TYPE_ORDER[b.type] ?? 999;
    if (ta !== tb) return ta - tb;

    // 4) コスト
    const ca = Number.isFinite(a.cost) ? a.cost : Number.MAX_SAFE_INTEGER;
    const cb = Number.isFinite(b.cost) ? b.cost : Number.MAX_SAFE_INTEGER;
    if (ca !== cb) return ca - cb;

    // 5) パワー
    const pa2 = Number.isFinite(a.power) ? a.power : Number.MAX_SAFE_INTEGER;
    const pb2 = Number.isFinite(b.power) ? b.power : Number.MAX_SAFE_INTEGER;
    if (pa2 !== pb2) return pa2 - pb2;

    // 6) cd
    const cda = Number.isFinite(+a.cd) ? +a.cd : Number.MAX_SAFE_INTEGER;
    const cdb = Number.isFinite(+b.cd) ? +b.cd : Number.MAX_SAFE_INTEGER;
    return cda - cdb;
  });
  return missing;
}

function openMissingDialog(title, items){
  const dlg  = document.getElementById('missing-dialog');
  const body = document.getElementById('missing-body');
  const ttl  = document.getElementById('missing-title');
  if (!dlg || !body || !ttl) return;

  ttl.textContent = title;
  if (!items.length){
    body.innerHTML = '<p>不足カードはありません。</p>';
  } else {
    const ul = document.createElement('ul');
    items.forEach(it=>{
      const li = document.createElement('li');
      li.innerHTML = `<span class="missing-name">${it.name}x${it.need}</span>`;
      li.dataset.cd  = String(it.cd || '');
      li.classList.add('missing-item');
      // 種族クラス付与（小文字対応済み）
      const race = it.race || '';
      if (race) li.classList.add(`race-${race}`);
      ul.appendChild(li);
    });
    body.replaceChildren(ul);
  }

  const copyBtn = document.getElementById('missing-copy');
  const text = items.map(it => `${it.name}x${it.need}`).join('\n');
  copyBtn.onclick = async ()=>{
    try{
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else prompt('以下をコピーしてください', text);
      copyBtn.textContent = 'コピーしました';
      setTimeout(()=> copyBtn.textContent = '一覧をコピー', 1400);
    }catch{ alert('コピーに失敗しました'); }
  };

  dlg.style.left = '50%';
  dlg.style.top  = '15vh';
  dlg.style.transform = 'translateX(-50%)';
  dlg.showModal();
}

// 画像プレビュー
if (!window.__wiredMissingPreview){
  window.__wiredMissingPreview = true;

  // マウス：ホバーで表示、外れたら隠す
  document.addEventListener('mouseover', (e)=>{
    const span = e.target.closest('#missing-body li.missing-item .missing-name');
    const li = span ? span.closest('li.missing-item') : null;
    if (!li || !li.dataset.cd) return;
    showCardPreviewNextTo(li, li.dataset.cd);
  });
    document.addEventListener('mousemove', (e)=>{
    const span = e.target.closest('#missing-body li.missing-item .missing-name');
    if (!span) { hideCardPreview(); return; }
    const li = span.closest('li.missing-item');
    if (!li || !li.dataset.cd) { hideCardPreview(); return; }
    showCardPreviewAt(e.clientX, e.clientY, li.dataset.cd);
  });
  document.addEventListener('mouseout', (e)=>{
    if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#card-preview-pop')) return;
    if (e.target.closest && e.target.closest('#missing-body')) {
      // missing-body内から外へ出たら隠す
      if (!e.relatedTarget || !e.relatedTarget.closest('#missing-body')) hideCardPreview();
    }
  });

  // タッチ：長押し(500ms)で表示、離したら隠す
    let pressTimer = 0;
    let pressTarget = null;
    document.addEventListener('touchstart', (e)=>{
    const span = e.target.closest && e.target.closest('#missing-body li.missing-item .missing-name');
    if (!span) return;
    const li = span.closest('li.missing-item');
    if (!li || !li.dataset.cd) return;
    pressTarget = li;
    const touch = e.touches[0];
    pressTimer = window.setTimeout(()=>{
      showCardPreviewAt(touch.clientX, touch.clientY, li.dataset.cd);
    }, 500); // 長押し閾値
  }, {passive:true});

  ['touchend','touchcancel','touchmove'].forEach(type=>{
    document.addEventListener(type, ()=>{
      if (pressTimer){ clearTimeout(pressTimer); pressTimer = 0; }
      hideCardPreview();
      pressTarget = null;
    }, {passive:true});
  });

  // モーダルを閉じたらプレビューも隠す
  document.getElementById('missing-dialog')?.addEventListener('close', hideCardPreview);
}


// === パック順インデックス（PACK_ORDER優先→残りは英字→仮名字で自然順） ===
let __PACK_INDEX_CACHE = null;
function getPackOrderIndex() {
  if (__PACK_INDEX_CACHE) return __PACK_INDEX_CACHE;

  // ① JSONから英名（en）リスト抽出
  const cards = Array.isArray(window.__cardsCache) ? window.__cardsCache : [];
  const byEn = new Map(); // en -> jp
  for (const c of cards) {
    const pn = splitPackName(c.pack_name || c.pack || '');
    if (!pn.en) continue;
    if (!byEn.has(pn.en)) byEn.set(pn.en, pn.jp || '');
  }

  // ② 既定順（PACK_ORDER）→残りは英名のアルファベット順
  const rest = [...byEn.keys()]
    .filter(en => !PACK_ORDER.includes(en))
    .sort((a,b)=> String(a).localeCompare(String(b), 'ja')); // 英字→仮名の自然順

  const ordered = [...PACK_ORDER.filter(en => byEn.has(en)), ...rest];

  // ③ en -> index の辞書
  const idx = {};
  ordered.forEach((en, i) => { idx[en] = i; });
  __PACK_INDEX_CACHE = idx;
  return idx;
}

// カードからパック英名(en)を取り出す
function packEnOf(card){
  const pn = splitPackName(card.pack_name || card.pack || '');
  return pn.en || '';
}

// 種族→数値順位
function raceRankOf(r){
  return (RACE_ORDER.indexOf(r) >= 0) ? RACE_ORDER.indexOf(r) : 999;
}

// 全カード（PC/モバイル共通）
['show-missing-all','show-missing-all-mobile'].forEach(id=>{
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', ()=>{
    const items = collectMissing('all');
    openMissingDialog('不足カード（全カード）', items);
  });
});

// パックごと（パック名直下の単体ボタン）
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('.missing-pack-btn');
  if (!btn) return;
  const section = btn.closest('.pack-section');
  const slug = section?.id?.replace(/^pack-/, '');
  const pack = Array.isArray(window.packs) ? window.packs.find(p => makePackSlug(p.nameMain) === slug) : null;
  const items = collectMissing(pack || 'all');
  openMissingDialog(pack ? `不足カード（${pack.nameMain}）` : '不足カード', items);
});

// ===== 不足リスト：カード画像プレビュー =====
function ensurePreviewEl(){
  let el = document.getElementById('card-preview-pop');
  // ★ モーダルが開いているときはモーダルにぶら下げる
  const dlg = document.getElementById('missing-dialog');
  if (dlg && dlg.open && el.parentElement !== dlg) {
    dlg.appendChild(el);
  }
  // 位置は viewport 基準にしたいので fixed
  el.style.position = 'fixed';
  return el;
  }

function showCardPreviewAt(x, y, cd){
  const box = ensurePreviewEl();
  const img = box.querySelector('img');
  img.removeAttribute('data-fallback');
  img.src = `img/${cd}.webp`;

  const dlg = document.getElementById('missing-dialog');
  const w  = img.clientWidth || 180;
  const h  = img.clientHeight || 256;
  const pad = 40;
  let left, top;

  if (dlg && dlg.open && box.parentElement === dlg) {
    // dialog 内：dialog の矩形を基準に absolute 配置
    const dr = dlg.getBoundingClientRect();
    const vw = dr.width, vh = dr.height;
   // 横方向
    left = window.innerWidth - w - pad -20;
    if (left + w + 16 > vw) left = (x - dr.left) + pad + 100;

    // 縦方向：下に余裕があればカーソルの下、無ければ上
 if (y + h +280  < window.innerHeight) {
   top = y - pad*3;
 } else {
   top = y - h - pad*2;
   if (top < pad) top = pad;
 }
}



  box.style.left = `${Math.round(left)}px`;
  box.style.top  = `${Math.round(top)}px`;
  box.style.display = 'block';
}

function showCardPreviewNextTo(el, cd){
  const rect = el.getBoundingClientRect();
  showCardPreviewAt(rect.right, rect.top, cd);
}

function hideCardPreview(){
  const box = document.getElementById('card-preview-pop');
  if (box) box.style.display = 'none';
}




//#endregionroot
/*====================================
    2.所持率チェッカー所持データ反映編集
======================================*/
//cards配列を取得（cacheがあれば優先、無ければDOMから復元）
function getCardsForOwnedOps() {
  if (Array.isArray(window.__cardsCache) && window.__cardsCache.length) {
    return window.__cardsCache; // renderAllPacks 内で設定していれば使う
  }
  const list = [];
  document.querySelectorAll('#packs-root .card').forEach(el => {
    const cd = parseInt(el.dataset.cd, 10);
    if (!Number.isFinite(cd)) return;
    list.push({
      cd,
      race: el.dataset.race || '',     // 旧神判定に使用
      rarity: el.dataset.rarity || ''  // レアリティ集計に使用
    });
  });
  return list;
}


//所持データ反映
(function () {
// 所持マップ取得（OwnedStore が空なら localStorage をフォールバック）
function readOwnedMap() {
  let storeAll = {};
  try { if (window.OwnedStore?.getAll) storeAll = window.OwnedStore.getAll(); } catch {}
  let lsAll = {};
  try { lsAll = JSON.parse(localStorage.getItem('ownedCards') || '{}'); } catch {}

  // どちらも空でなければ、キー数が多い方を採用
  const src = (Object.keys(storeAll).length >= Object.keys(lsAll).length) ? storeAll : lsAll;

  // 正規化 { normal, shine, premium }
  const normalized = {};
  for (const cd in src) {
    const v = src[cd];
    normalized[cd] =
      typeof v === 'object'
        ? { normal: v.normal | 0, shine: v.shine | 0, premium: v.premium | 0 }
        : { normal: v | 0, shine: 0, premium: 0 };
  }
  return normalized;
}


  // 1枚のカード要素に対して見た目を反映
  function paintCard(cardEl, total) {
    // 上限3でクランプ
    const count = Math.max(0, Math.min(3, total | 0));

    // 表示用クラスのリセット
    cardEl.classList.remove('owned-1', 'owned-2', 'owned-3', 'owned', 'grayscale');

    if (count === 0) {
      // 0枚 → モノクロ
      cardEl.classList.add('grayscale');
    } else {
      // 1～3 → owned-mark に数字、インラインdisplayで確実に表示
      cardEl.classList.add(`owned-${count}`);
      // 既存CSSが .card.owned .owned-mark を表示トリガーにしている場合もあるので保険で付与
      cardEl.classList.add('owned');
    }

    const mark = cardEl.querySelector('.owned-mark');
    if (mark) {
      mark.textContent = count > 0 ? String(count) : '';
      mark.style.display = count > 0 ? 'flex' : 'none';
    }

    // データ属性（既存コード互換）
    cardEl.dataset.count = String(count);
  }

  // packs-root 全カードへ一括反映
  function syncOwnedMarksWithStore() {
    const owned = readOwnedMap();
    const cards = document.querySelectorAll('#packs-root .card');
    cards.forEach((el) => {
      const cd = String(el.dataset.cd || '');
      const e = owned[cd] || { normal: 0, shine: 0, premium: 0 };
      const total = (e.normal | 0) + (e.shine | 0) + (e.premium | 0);
      paintCard(el, total);
    });
    updateSummary();
  }

  // フィルター実行時に未所持をモノクロ化する既存フック名が呼ばれているので、そこに同じ同期を割り当て
  // （applyFilters() の最後で applyGrayscaleFilter() が呼ばれている前提）
  window.applyGrayscaleFilter = syncOwnedMarksWithStore;

  // 初期同期：packs-root が描画されるのを待ってから一度反映
function waitForPacksAndSync() {
  const root = document.querySelector('#packs-root');
  if (!root) return;
  if (root.querySelector('.card')) {
    syncOwnedMarksWithStore();
    updateOwnedTotal && updateOwnedTotal();
    updateSummary();
    return;
  }
  const mo = new MutationObserver(() => {
    if (root.querySelector('.card')) {
      mo.disconnect();
      syncOwnedMarksWithStore();
      updateOwnedTotal && updateOwnedTotal();
      updateSummary();
    }
  });
  mo.observe(root, { childList: true, subtree: true });
}

  waitForPacksAndSync();

  // 所持データが変わったら自動で再反映（OwnedStore がある場合）
  if (typeof window.OwnedStore !== 'undefined' && typeof window.OwnedStore.onChange === 'function') {
    window.OwnedStore.onChange(syncOwnedMarksWithStore);
  }else {
  // まだ未定義なら、ページロード後にもう一度試す
  window.addEventListener('load', () => {
    if (typeof window.OwnedStore !== 'undefined' && typeof window.OwnedStore.onChange === 'function') {
      window.OwnedStore.onChange(syncOwnedMarksWithStore);
      // 初回一発反映
      syncOwnedMarksWithStore();
      updateOwnedTotal && updateOwnedTotal();
      updateSummary();
    }
  });
  }

})();

/* ===== 所持カウント操作（ボタン用の受け皿） =====
   仕様：
   - 合計＝ normal + shine + premium
   - 0〜3 にクランプ
   - set 系は normal に寄せて保存（shine/premium は 0 にする）
*/
(function () {
  function ensureStore() {
    if (!window.OwnedStore) throw new Error('OwnedStore 未初期化');
  }
  function totalOf(cd) {
    ensureStore();
    const e = OwnedStore.get(String(cd));
    return (e.normal|0) + (e.shine|0) + (e.premium|0);
  }
  function setTotal(cd, n) {
    ensureStore();
    const max = maxAllowedCount(cd);
    const count = Math.max(0, Math.min(max, n|0));
    OwnedStore.set(String(cd), { normal: count, shine: 0, premium: 0 });
  }
  // 1枚のカード要素を +times 増やす（上限3）
  function bumpOwnership(el, times = 1) {
    const cd = el?.dataset?.cd;
    if (!cd) return;
    const max = maxAllowedCount(cd, el?.dataset?.race);
    const now = totalOf(cd);
    setTotal(cd, Math.min(max, now + (times|0)));
  }


  // 1枚のカード要素の合計を指定数にする
  function setOwnership(el, count) {
    const cd = el?.dataset?.cd;
    if (!cd) return;
    setTotal(cd, count);
  }

  // 1枚のカード要素の合計を 0 にする
  function clearOwnership(el) {
    const cd = el?.dataset?.cd;
    if (!cd) return;
    setTotal(cd, 0);
  }

  // 既存のフォールバックフックが先にこれらを探しに来るので、window に公開
  window.bumpOwnership  = bumpOwnership;
  window.setOwnership   = setOwnership;
  window.clearOwnership = clearOwnership;

  // カード単体クリック時の挙動：0→1→2→3→0 とラップ
  window.toggleOwnership = function (el) {
    try {
      if (!el || !el.dataset) return;
      const cd = String(el.dataset.cd || '');
      if (!cd || !window.OwnedStore) return;

      const max = maxAllowedCount(cd, el.dataset.race);
      const e = OwnedStore.get(cd);
      const now = (e?.normal|0) + (e?.shine|0) + (e?.premium|0);
      const next = (now >= max) ? 0 : (now + 1);

      OwnedStore.set(cd, { normal: next, shine: 0, premium: 0 });
    } catch (err) {
      console.error('toggleOwnership failed:', err);
    }
  };

})();
// === 共通：カードごとの上限枚数（旧神は1、それ以外は3） ===
function maxAllowedCount(cd, raceHint) {
  if (raceHint === '旧神') return 1;

  // race が未指定ならキャッシュ/DOMから引く
  let race = raceHint || '';
  if (!race && typeof cd !== 'undefined') {
    if (Array.isArray(window.__cardsCache)) {
      const hit = window.__cardsCache.find(c => String(c.cd) === String(cd));
      if (hit?.race) race = hit.race;
    }
    if (!race) {
      const el = document.querySelector(`#packs-root .card[data-cd="${cd}"]`);
      race = el?.dataset?.race || '';
    }
  }
  return (race === '旧神') ? 1 : 3;
}


/*========= パック/種族ボタンの挙動 =========
  既存の toggleOwnership(el) を利用。
    +1系は「要素ごとに1回 toggleOwnership」を実行。
    +3 等が必要な場合は3回呼ぶ（後で setOwnership 等があれば差し替えやすい形にしておく）。
*/

function bump(el, times=1){
  if (typeof window.bumpOwnership === 'function') return window.bumpOwnership(el, times);
  if (typeof window.setOwnership === 'function')  return window.setOwnership(el, times); // もし count 指定APIがあるなら使う
  for (let i=0;i<times;i++){ if (typeof window.toggleOwnership === 'function') window.toggleOwnership(el); }
}
function clearCard(el){
  if (typeof window.clearOwnership === 'function') return window.clearOwnership(el);
  // フォールバック：0になるまで回す（最大3回想定）
  for (let i=0;i<4;i++){ if (el.classList.contains('owned-0')) break; if (typeof window.toggleOwnership==='function') window.toggleOwnership(el); }
}
function attachPackControls(root){
  root.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;

    // パック範囲
    const packSection = e.target.closest('.pack-section');
    // 種族範囲
    const raceGroup   = e.target.closest('.race-group');

    // 1) パック：シルバー/ブロンズ +3
    if (btn.classList.contains('pack-select-all-btn') && packSection){
      const targets = packSection.querySelectorAll('.card.rarity-silver, .card.rarity-bronze');
      targets.forEach(el => bump(el, 3));
      return;
    }
    // 2) パック：全解除
    if (btn.classList.contains('pack-clear-all-btn') && packSection){
      const targets = packSection.querySelectorAll('.card');
      targets.forEach(el => clearCard(el));
      return;
    }
    // 3) 種族：全て選択 +1
    if (btn.classList.contains('select-all-btn') && raceGroup){
      const targets = raceGroup.querySelectorAll('.card');
      targets.forEach(el => bump(el, 1));
      return;
    }
    // 4) 種族：全解除
    if (btn.classList.contains('clear-all-btn') && raceGroup){
      const targets = raceGroup.querySelectorAll('.card');
      targets.forEach(el => clearCard(el));
      return;
    }
  });
}

// ========== 全パックをまとめて描画 ==========
renderAllPacks({
    jsonUrl: 'public/cards_latest.json',
    mountSelector: '#packs-root',
    isLatestOnly: true,
    sortInRace: typeCostPowerCd,
    }).then(() => {
  // 所持表示の同期 → サマリー更新
  if (typeof window.applyGrayscaleFilter === 'function') window.applyGrayscaleFilter();
  updateSummary();
});

// パック抽出の共通ヘルパ（英名で前方一致＋範囲限定）
function queryCardsByPack(pack) {
  const key = (pack?.nameMain || '').trim();
  if (!key) return document.querySelectorAll('#packs-root .card');
  return document.querySelectorAll(`#packs-root .card[data-pack^="${CSS.escape(key)}"]`);
}

// チェッカー反映（保存 → 反映 → チェッカータブへ）
// ※ 保存を拒否した場合は A に巻き戻してからタブ切替（クランプはしない）
['apply-to-checker', 'apply-to-checker-mobile'].forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!window.OwnedStore) { alert('所持データの初期化前です。ページを再読み込みしてください。'); return; }

    const ok = confirm('現在の所持カードデータを保存して所持率チェッカーに反映しますか？');
    if (ok) {
      try { OwnedStore.save(); window.__ownedDirty = false; } catch {}
      // OwnedStore更新
      try { window.__ownedSnapshot = JSON.parse(localStorage.getItem('ownedCards') || '{}') || {}; } catch {}
      window.__ownedSnapshotInited = true;

      // 旧神=1 / 他=3 にクランプしてチェッカー表示に反映
      try { window.OwnedStore.clampForChecker(getCardsForOwnedOps()); } catch {}
    } else {
      // ★ 保存しない → OwnedStore に巻き戻す（変更データは捨てる）
      window.revertOwnedToSaved();
    }

    // 同一ページ内のタブをチェッカーに切替
    const tabBtn = document.querySelector('.tab-bar .tab'); // 先頭タブ＝チェッカー想定
    if (tabBtn && typeof window.switchTab === 'function') {
      switchTab('checker', tabBtn);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      location.href = 'cardcheker.html';
    }
  });
});




//総所持枚数（フィルター結果に連動）
function updateOwnedTotal() {
  if (!window.OwnedStore) return;

  // いま画面に出す対象 = フィルター後の配列（未生成なら全体）
const scopeCards = Array.isArray(window.__ownedCardsData)
  ? window.__ownedCardsData
  : getCardsForOwnedOps();

  // cd -> { race, rarity } 索引
  const index = new Map(scopeCards.map(c => [String(c.cd), { race: c.race, rarity: c.rarity }]));

  const all = OwnedStore.getAll();
  let total = 0, legend = 0, gold = 0, silver = 0, bronze = 0;

  for (const cd in all) {
    const sum = (all[cd].normal|0) + (all[cd].shine|0) + (all[cd].premium|0);
    if (sum <= 0) continue;
    const info = index.get(String(cd));
    if (!info) continue; // フィルター外は数えない

    total += sum;
    switch (info.rarity) {
      case 'レジェンド': legend += sum; break;
      case 'ゴールド'  : gold   += sum; break;
      case 'シルバー'  : silver += sum; break;
      case 'ブロンズ'  : bronze += sum; break;
    }
  }

  // PC/タブレット
  document.getElementById('owned-total')?.replaceChildren(document.createTextNode(total));
  document.getElementById('owned-legend')?.replaceChildren(document.createTextNode(legend));
  document.getElementById('owned-gold')?.replaceChildren(document.createTextNode(gold));
  document.getElementById('owned-silver')?.replaceChildren(document.createTextNode(silver));
  document.getElementById('owned-bronze')?.replaceChildren(document.createTextNode(bronze));

  // モバイル
  document.getElementById('owned-total-mobile')?.replaceChildren(document.createTextNode(total));
  document.getElementById('owned-legend-mobile')?.replaceChildren(document.createTextNode(legend));
  document.getElementById('owned-gold-mobile')?.replaceChildren(document.createTextNode(gold));
  document.getElementById('owned-silver-mobile')?.replaceChildren(document.createTextNode(silver));
  document.getElementById('owned-bronze-mobile')?.replaceChildren(document.createTextNode(bronze));

  // フィルター非連動の「種族別」も更新
  updateOwnedRaceSummary();
  updateOwnedRaceSummaryMobile();
}

// ストア変化で自動集計
if (window.OwnedStore?.onChange) {
  window.OwnedStore.onChange(updateOwnedTotal);
} else {
  // 後から初期化される型なら load 後にもう一度呼ぶ等のケアを足してもOK
}

// ===== 置き換え：PC種族集計 =====
function updateOwnedRaceSummary() {
  const root = document.getElementById('owned-race-summary');
  if (!root || !window.OwnedStore) return;

  const RACES = (typeof RACE_ORDER !== 'undefined') ? RACE_ORDER
               : ['ドラゴン','アンドロイド','エレメンタル','ルミナス','シェイド','イノセント','旧神'];
  const RARS  = ['レジェンド','ゴールド','シルバー','ブロンズ'];
  const ICON  = { 'レジェンド':'🌈','ゴールド':'🟡','シルバー':'⚪️','ブロンズ':'🟤' };

  const cards = getCardsForOwnedOps();
  const idx = new Map(cards.map(c => [String(c.cd), { race:c.race, rarity:c.rarity }]));

  const table = new Map(RACES.map(r => [r, Object.fromEntries(RARS.map(x => [x,0]))]));

  const all = OwnedStore.getAll();
  for (const cd in all) {
    const sum = (all[cd].normal|0) + (all[cd].shine|0) + (all[cd].premium|0);
    if (sum <= 0) continue;
    const info = idx.get(String(cd)); if (!info) continue;
    if (!table.has(info.race)) continue;
    const row = table.get(info.race);
    if (row[info.rarity] != null) row[info.rarity] += sum;
  }

  const ul = document.createElement('ul');
  ul.className = 'race-summary'; // スコープ用

  RACES.forEach(r => {
    const row = table.get(r);
    const li = document.createElement('li');
    // ★ 種族ごとにクラスを付与（背景色などCSSで当てられる）
    li.className = `race-summary-item owned-race-${r} race-${r}`;

    li.innerHTML = `
      <div class="race-summary-title"><strong>${r}</strong></div>
      <div class="rar-rows">
        <p class="rar-line">
          <span class="rar-pair rar-legend"><i>${ICON['レジェンド']}</i><span class="num">${row['レジェンド'] ?? 0}</span></span>
          <span class="rar-pair rar-gold"><i>${ICON['ゴールド']}</i><span class="num">${row['ゴールド'] ?? 0}</span></span>
        </p>
        <p class="rar-line">
          <span class="rar-pair rar-silver"><i>${ICON['シルバー']}</i><span class="num">${row['シルバー'] ?? 0}</span></span>
          <span class="rar-pair rar-bronze"><i>${ICON['ブロンズ']}</i><span class="num">${row['ブロンズ'] ?? 0}</span></span>
        </p>
      </div>`;
    ul.appendChild(li);
  });

  root.replaceChildren(ul);
}

// ===== 置き換え：モバイル種族集計（横並びのまま、改行防止だけ反映）
function updateOwnedRaceSummaryMobile() {
  const root = document.getElementById('owned-race-summary-mobile');
  if (!root || !window.OwnedStore) return;

  const RACES = (typeof RACE_ORDER !== 'undefined') ? RACE_ORDER
               : ['ドラゴン','アンドロイド','エレメンタル','ルミナス','シェイド','イノセント','旧神'];
  const RARS  = ['レジェンド','ゴールド','シルバー','ブロンズ'];
  const ICON  = { 'レジェンド':'🌈','ゴールド':'🟡','シルバー':'⚪️','ブロンズ':'🟤' };

  const cards = getCardsForOwnedOps();
  const idx = new Map(cards.map(c => [String(c.cd), { race:c.race, rarity:c.rarity }]));

  const table = new Map(RACES.map(r => [r, Object.fromEntries(RARS.map(x => [x,0]))]));

  const all = OwnedStore.getAll();
  for (const cd in all) {
    const sum = (all[cd].normal|0) + (all[cd].shine|0) + (all[cd].premium|0);
    if (sum <= 0) continue;
    const info = idx.get(String(cd)); if (!info) continue;
    if (!table.has(info.race)) continue;
    const row = table.get(info.race);
    if (row[info.rarity] != null) row[info.rarity] += sum;
  }

  const frag = document.createDocumentFragment();
  RACES.forEach(r => {
    const row = table.get(r);
    const div = document.createElement('div');
    div.className = `race-row race-${r}`; // ★ 種族クラス付与

    div.innerHTML =
      `<span class="race-name"><strong>${r}</strong></span>
       <span class="rar-line">
         <span class="rar-pair rar-legend"><i>${ICON['レジェンド']}</i><span class="num">${row['レジェンド'] ?? 0}</span></span>
         <span class="rar-pair rar-gold"><i>${ICON['ゴールド']}</i><span class="num">${row['ゴールド'] ?? 0}</span></span>
         <span class="rar-pair rar-silver"><i>${ICON['シルバー']}</i><span class="num">${row['シルバー'] ?? 0}</span></span>
         <span class="rar-pair rar-bronze"><i>${ICON['ブロンズ']}</i><span class="num">${row['ブロンズ'] ?? 0}</span></span>
       </span>`;
    frag.appendChild(div);
  });
  root.replaceChildren(frag);
}




// デッキ分析カード部分処理
// 置き換え：小さな“ポップオーバー風”ダイアログを画像の上下に出す
function bindOwnedCardEventsSimple(cardDiv) {
  const cd   = String(cardDiv.dataset.cd);
  const race = cardDiv.dataset.race || '';
  const max  = (race === '旧神') ? 1 : 3;

  const decBtn = cardDiv.querySelector('.decrement-btn');
  const incBtn = cardDiv.querySelector('.increment-btn');
  const cntEl  = cardDiv.querySelector('.count-display');
  const imgEl  = cardDiv.querySelector('img');

  const read = ()=> {
    const e = OwnedStore.get(cd) || { normal:0, shine:0, premium:0 };
    return (e.normal|0) + (e.shine|0) + (e.premium|0);
  };
  const write = (n)=> {
    const v = Math.max(0, Math.min(max, n|0));
    OwnedStore.set(cd, { normal:v, shine:0, premium:0 });
  };
  const paint = ()=> { cntEl.textContent = String(read()); };

  // ⬇ ここを new：非モーダルで位置指定する openEffect
  const openEffect = (evt, anchorEl)=> {
    const name = cardDiv.querySelector('.card-name')?.textContent || `#${cd}`;
    const n1 = cardDiv.dataset.effectname1 || '';
    const t1 = cardDiv.dataset.effecttext1 || '';
    const n2 = cardDiv.dataset.effectname2 || '';
    const t2 = cardDiv.dataset.effecttext2 || '';
    const body = [
      n1 && `【${n1}】`, t1,
      n2 && `\n【${n2}】`, t2
    ].filter(Boolean).join('\n');

    const dlg = document.getElementById('effect-dialog');
    if (!dlg) return;

    // 必要最小情報だけ
    document.getElementById('dlg-title').textContent = name;
    document.getElementById('dlg-body').textContent  = body || '（効果テキストなし）';

    // 非モーダルで開く（背面が見える）
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = (anchorEl || cardDiv).getBoundingClientRect();

    // 先に幅だけ決めて open → 高さを測ってから最終座標を計算
  const desiredW = Math.min(520, Math.max(200, Math.round(vw * 0.6))); // 320〜520px、目安=画面幅の60%
  dlg.style.width = desiredW + 'px';
  dlg.style.maxWidth = '90vw'; // 端末が極端に狭い場合の保険（画面の90%まで）

    dlg.show(); // ← showModal() ではなく show()

    const dh = dlg.getBoundingClientRect().height;
    const below = evt ? (evt.clientY < vh / 2) : (rect.top < vh / 2); // 上下出し分け
    const gap = 8;

    // 左座標：画像中央に合わせつつ画面内にクランプ
    let left = rect.left + rect.width / 2 - desiredW / 2;
    left = Math.max(8, Math.min(left, vw - desiredW - 8));

    // 上座標：下に出す or 上に出す
    let top = below ? (rect.bottom + gap) : (rect.top - dh - gap);
    // はみ出し最終クランプ
    top = Math.max(8, Math.min(top, vh - dh - 8));

    dlg.style.left = Math.round(left) + 'px';
    dlg.style.top  = Math.round(top)  + 'px';
  };

  // ±ボタンはバブリング停止（ポップを出さない）
  decBtn?.addEventListener('click', (e)=> { e.stopPropagation(); write(read()-1); });
  incBtn?.addEventListener('click', (e)=> { e.stopPropagation(); write(read()+1); });

  // 🔽 画像だけで情報ポップ（非モーダル）
  imgEl?.addEventListener('click', (e) => {
    e.stopPropagation();
    openEffect(e, imgEl);
  });

  // 画面のどこかをクリックしたら閉じる
  if (!window.__effectOutsideCloser__) {
    window.__effectOutsideCloser__ = true;
    document.addEventListener('click', (ev) => {
      const dlg = document.getElementById('effect-dialog');
      if (dlg?.open && !dlg.contains(ev.target) && !ev.target.closest('#owned-card-grid .card img')) {
        dlg.close();
      }
    });
  }

  // ストア変化で自動更新
  if (OwnedStore?.onChange) OwnedStore.onChange(paint);

  // 初期表示
  paint();
}













// ==============================
// 所持カード枚数タブ：owned-card-grid 生成
// ==============================
let __ownedCardsData = [];
let __ownedCurrentPage = 1;
const __ownedCardsPerPage = 16;

// JSON取得＋並び替え（タイプ→コスト→パワー→cd）
async function generateOwnedCards() {
  // 既に読み込んでいれば再利用
  if (Array.isArray(window.__cardsCache) && window.__cardsCache.length) {
    __ownedCardsData = window.__cardsCache.slice();
  } else {
    const res = await fetch('public/cards_latest.json');
    const cards = await res.json();
    window.__cardsCache = cards;           // 他機能と共有
    __ownedCardsData = cards;
  }

  const typeOrder = { 'チャージャー':0, 'アタッカー':1, 'ブロッカー':2 };
  __ownedCardsData.sort((a,b)=>{
    const ta=(typeOrder[a.type] ?? 9), tb=(typeOrder[b.type] ?? 9);
    if (ta!==tb) return ta-tb;
    if (a.cost!==b.cost) return a.cost-b.cost;
    if (a.power!==b.power) return a.power-b.power;
    return (parseInt(a.cd,10)||0) - (parseInt(b.cd,10)||0);
  });
}

// 1ページ分を描画
function renderOwnedPage() {
  const grid = document.getElementById('owned-card-grid');
  if (!grid) return;

  grid.innerHTML = '';

  const totalPages = Math.max(1, Math.ceil(__ownedCardsData.length / __ownedCardsPerPage));
  if (__ownedCurrentPage < 1) __ownedCurrentPage = 1;
  if (__ownedCurrentPage > totalPages) __ownedCurrentPage = totalPages;

  const start = (__ownedCurrentPage - 1) * __ownedCardsPerPage;
  const end   = start + __ownedCardsPerPage;
  const pageCards = __ownedCardsData.slice(start, end);

  pageCards.forEach(card => {
    const div = document.createElement('div');
    // レアリティ枠線用クラス（CSSで枠線に）
    div.className ='card ' +(RARITY_CLASS[card.rarity] ? `rarity-${RARITY_CLASS[card.rarity]} ` : '') ;


    // 既存 data-* 踏襲
    div.dataset.cd       = card.cd;
    div.dataset.type     = card.type;
    div.dataset.race     = card.race;
    div.dataset.category = card.category;
    div.dataset.pack     = card.pack || card.pack_name || '';
    div.dataset.cost     = card.cost;
    div.dataset.power    = card.power;
    div.dataset.rarity   = card.rarity;
    if (card.effect_name1) div.dataset.effectname1 = card.effect_name1;
    if (card.effect_name2) div.dataset.effectname2 = card.effect_name2;
    if (card.effect_text1) div.dataset.effecttext1 = card.effect_text1;
    if (card.effect_text2) div.dataset.effecttext2 = card.effect_text2;

div.innerHTML = `
  <img alt="${esc(card.name)}" loading="lazy" src="img/${card.cd}.webp"
       onerror="if(!this.dataset.fallback){this.dataset.fallback=1;this.src='img/00000.webp';}" />
  <div class="owned-card-info">
    <div class="card-name owned-race-${esc(card.race ?? '-')}" title="${esc(card.name)}">${esc(card.name)}</div>

    <div class="owned-card-controls">
      <button class="decrement-btn">-</button>
      <span class="count-display">0</span>
      <button class="increment-btn">+</button>
    </div>

    <div class="owned-card-meta">
      <div class="meta-row">
        <span class="meta-label">レアリティ：</span>
        <span class="meta-value">${esc(card.rarity)}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">種族：</span>
        <span class="meta-value">${esc(card.race ?? '-')}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">カテゴリ：</span>
        <span class="meta-value">${esc(viewCategory(card.category) ?? '-')}</span>
      </div>
    </div>
  </div>
`;

    grid.appendChild(div);
    bindOwnedCardEventsSimple(div);
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${__ownedCurrentPage} / ${totalPages}`;
  if (window.updateOwnedTotal) updateOwnedTotal();
}



// 矢印・ボタンのページ送り（存在する場合のみ）
function initOwnedPager() {
  const left  = document.querySelector('.grid-page-arrow.left-arrow');
  const right = document.querySelector('.grid-page-arrow.right-arrow');
  const prev  = document.getElementById('prev-page');
  const next  = document.getElementById('next-page');

  function go(delta){
    __ownedCurrentPage += delta;
    renderOwnedPage();
    if (window.updateOwnedTotal) updateOwnedTotal();
  }
  left  && left .addEventListener('click', ()=>go(-1));
  right && right.addEventListener('click', ()=>go(+1));
  prev  && prev .addEventListener('click', ()=>go(-1));
  next  && next .addEventListener('click', ()=>go(+1));
}



// 初期化
(async function initOwnedGrid(){
  await generateOwnedCards();
  renderOwnedPage();
  initOwnedPager();

  // 所持合計などは OwnedStore の onChange 側で自動集計している想定
  if (window.updateOwnedTotal) window.updateOwnedTotal();
})();

/* =========================
   フィルター：条件モデル
========================= */
const filterConditions = {
  keyword: '',
  type: 'all',
  race: [],
  category: [],
  rarity: [],
  pack: []
};

/* すべてのカード配列を取得（JSONキャッシュ優先） */
function getAllCardsForFilter(){
  if (Array.isArray(window.__cardsCache) && window.__cardsCache.length) return window.__cardsCache;
  if (Array.isArray(window.__ownedCardsData) && window.__ownedCardsData.length) return window.__ownedCardsData;
  return []; // 最悪空
}

/* ================ 置き換え：フィルター選択肢の生成 ================ */
function generateFilterOptions() {
  const cardsAll = getAllCardsForFilter();

  const races = ['ドラゴン', 'アンドロイド', 'エレメンタル', 'ルミナス', 'シェイド', 'イノセント', '旧神'];
  const categories = [
    '聖焔龍（フォルティア）','ドラゴライダー','メイドロボ','アドミラルシップ',
    'ナチュリア','鬼刹（きせつ）','ロスリス','白騎士','昏き霊園','マディスキア','ノーカテゴリ'
  ];
  const rarities = ['レジェンド', 'ゴールド', 'シルバー', 'ブロンズ'];

  // JSONからユニークなパック名を抽出
  const packs = [...new Set(cardsAll.map(c => c.pack || c.pack_name).filter(Boolean))]
    .sort((a,b)=> String(a).localeCompare(String(b), 'ja'));

  const raceArea     = document.getElementById('filter-race');
  const categoryArea = document.getElementById('filter-category');
  const rarityArea   = document.getElementById('filter-rarity');
  const packArea     = document.getElementById('filter-pack');

  if (!raceArea || !categoryArea || !rarityArea) return;

  raceArea.innerHTML = '';
  categoryArea.innerHTML = '';
  rarityArea.innerHTML = '';
  if (packArea) packArea.innerHTML = '';

  // ボタン生成ヘルパ
const makeBtns = (area, values, key) => {
  const group = document.createElement('div');
  group.className = 'filter-group';

  // まとめて append するためのフラグメント
  const frag = document.createDocumentFragment();

  values.forEach(v => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-btn';
    btn.dataset.value = v;
    btn.textContent = v;

    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      filterConditions[key] = [...area.querySelectorAll('button.selected')].map(b => b.dataset.value);
      applyFilterAndSearch();
    });

    frag.appendChild(btn);
  });

  group.appendChild(frag);
  area.appendChild(group);
};


  makeBtns(raceArea, races, 'race');
  makeBtns(categoryArea, categories, 'category');
  makeBtns(rarityArea, rarities, 'rarity');
  if (packArea) makeBtns(packArea, packs, 'pack');
}

/* ================ 置き換え：絞り込み実行 ================ */
function applyFilterAndSearch() {
  const src = getAllCardsForFilter();
  const kw  = (filterConditions.keyword || '').toLowerCase();
  const t   = filterConditions.type;
  const pickR = filterConditions.race;
  const pickC = filterConditions.category;
  const pickRy= filterConditions.rarity;
  const pickP = filterConditions.pack;

  const filtered = src.filter(card => {
    // キーワード
    if (kw) {
      const hay =
        `${card.name||''}\n${card.effect_name1||''}\n${card.effect_name2||''}\n${card.effect_text1||''}\n${card.effect_text2||''}`
        .toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    // タイプ
    if (t !== 'all' && card.type !== t) return false;
    // 種族
    if (pickR.length){
      const races = Array.isArray(card.race) ? card.race : [card.race||''];
      if (!races.some(r => pickR.includes(r))) return false;
    }
    // カテゴリ
    if (pickC.length && !pickC.includes(card.category)) return false;
    // レアリティ
    if (pickRy.length && !pickRy.includes(card.rarity)) return false;
    // パック
    if (pickP.length){
      const p = card.pack || card.pack_name || '';
      if (!pickP.includes(p)) return false;
    }
    return true;
  });
 // ★ 並び順：
 //   （全カード＝パック未選択）→ パック順 → 種族 → タイプ → コスト → パワー → cd
 //   （パック選択あり）        → 種族 → タイプ → コスト → パワー → cd
 const hasPackFilter = (pickP && pickP.length > 0);
 const packIdx = hasPackFilter ? null : getPackOrderIndex();
 filtered.sort((a, b) => {
   if (!hasPackFilter) {
     // 1) パック順（PACK_ORDER優先＋残りは英字→仮名字順）
     const pa = packIdx[packEnOf(a)] ?? 9999;
     const pb = packIdx[packEnOf(b)] ?? 9999;
     if (pa !== pb) return pa - pb;
   }
   // 2) 種族
   const ra = raceRankOf(a.race || ''), rb = raceRankOf(b.race || '');
   if (ra !== rb) return ra - rb;
   // 3) タイプ（チャージャー→アタッカー→ブロッカー）
   const ta = TYPE_ORDER[a.type] ?? 999;
   const tb = TYPE_ORDER[b.type] ?? 999;
   if (ta !== tb) return ta - tb;
   // 4) コスト
   const ac = Number.isFinite(a.cost) ? a.cost : Number.MAX_SAFE_INTEGER;
   const bc = Number.isFinite(b.cost) ? b.cost : Number.MAX_SAFE_INTEGER;
   if (ac !== bc) return ac - bc;
   // 5) パワー
   const ap = Number.isFinite(a.power) ? a.power : Number.MAX_SAFE_INTEGER;
   const bp = Number.isFinite(b.power) ? b.power : Number.MAX_SAFE_INTEGER;
   if (ap !== bp) return ap - bp;
   // 6) cd（数値昇順）
   const aid = Number.isFinite(+a.cd) ? +a.cd : Number.MAX_SAFE_INTEGER;
   const bid = Number.isFinite(+b.cd) ? +b.cd : Number.MAX_SAFE_INTEGER;
   return aid - bid;
 });

  // ★ 所持カード分析グリッドのデータを書き換えて再描画
  __ownedCardsData = filtered;
  __ownedCurrentPage = 1;
  renderOwnedPage();
  updateOwnedTotal();
}

/* ================ 追加：UI初期化（開閉・タイプ・キーワード・リセット） ================ */
(function initFilterUI(){
  const modal    = document.getElementById('filter-modal');
  const backdrop = document.getElementById('modal-backdrop');

  const openBtns = [
    document.getElementById('open-filter-modal'),
    document.getElementById('open-filter-modal-mobile')
  ].filter(Boolean);

  function openModal(){
    // 初回だけ選択肢を生成
    if (!modal.dataset.inited){
      generateFilterOptions();
      modal.dataset.inited = '1';
    }
    modal.style.display = 'block';
    if (backdrop) backdrop.style.display = 'block';
  }
  function closeModal(){
    modal.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
  }

  openBtns.forEach(btn => btn.addEventListener('click', openModal));
  backdrop?.addEventListener('click', closeModal);
  document.getElementById('filter-close')?.addEventListener('click', closeModal);

  // リセット
  document.getElementById('filter-reset')?.addEventListener('click', () => {
    filterConditions.type     = 'all';
    filterConditions.keyword  = '';
    filterConditions.race     = [];
    filterConditions.category = [];
    filterConditions.rarity   = [];
    filterConditions.pack     = [];

    // UIリセット
    document.querySelectorAll('#filter-race button, #filter-category button, #filter-rarity button, #filter-pack button')
      .forEach(b => b.classList.remove('selected'));
    // タイプトグル
    document.querySelectorAll('#type-toggle .type-btn, #type-toggle-mobile .type-btn')
      .forEach(b => b.classList.remove('selected'));
    document.querySelector('#type-toggle .type-btn[data-type="all"]')?.classList.add('selected');
    document.querySelector('#type-toggle-mobile .type-btn[data-type="all"]')?.classList.add('selected');
    // キーワード
    const kw1 = document.getElementById('keyword-input');
    const kw2 = document.getElementById('keyword-input-mobile');
    if (kw1) kw1.value = '';
    if (kw2) kw2.value = '';

    applyFilterAndSearch();
  });

  // タイプ切替（PC/モバイル共通）
  ['#type-toggle', '#type-toggle-mobile'].forEach(sel => {
    const wrap = document.querySelector(sel);
    if (!wrap) return;
    wrap.addEventListener('click', (e)=>{
      const b = e.target.closest('.type-btn'); if (!b) return;
      wrap.querySelectorAll('.type-btn').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      filterConditions.type = b.dataset.type || 'all';
      applyFilterAndSearch();
    });
  });

  // キーワード（PC/モバイル）
  ['#keyword-input', '#keyword-input-mobile'].forEach(sel=>{
    const el = document.querySelector(sel); if (!el) return;
    el.addEventListener('input', (e)=>{
      filterConditions.keyword = e.target.value.trim();
      applyFilterAndSearch();
    });
  });

})();




// 初期選択（全タイプ）を強制
(function initTypeDefault(){
  // モデル側
  filterConditions.type = 'all';

  // UI側（PC/モバイル両方）
  ['#type-toggle', '#type-toggle-mobile'].forEach(sel=>{
    const wrap = document.querySelector(sel); if (!wrap) return;
    wrap.querySelectorAll('.type-btn').forEach(b=>b.classList.remove('selected'));
    wrap.querySelector('.type-btn[data-type="all"]')?.classList.add('selected');
  });

  // データが読めているなら初回フィルタを実行
  if (typeof getAllCardsForFilter === 'function' && getAllCardsForFilter().length){
    applyFilterAndSearch();
  }
})();
