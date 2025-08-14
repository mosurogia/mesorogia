/*================
    1.初期設定
===============*/
// 起動時：OwnedStore自動保存OFF（このページは手動保存モード）
if (window.OwnedStore?.setAutosave) {
  window.OwnedStore.setAutosave(false);
}


document.addEventListener('DOMContentLoaded', () => {
  updateSummary(); // 初回反映
});
/*===================
    .所持率コンプ率
====================*/
const packs = [
  { key:'awaking',
    nameMain:'Awaking The Oracle',
    nameSub:'「神託者の覚醒」',
    selector:'#pack-awaking'
  },
    { key:'beyond',
    nameMain:'Beyond the Sanctuary ',
    nameSub:'「聖域の先へ」',
    selector:'#pack-beyond'
  },
];

function calcSummary(nodeList){
  let owned = 0, ownedTypes = 0, total = 0, totalTypes = 0;
  nodeList.forEach(card => {
    const cnt = parseInt(card.dataset.count) || 0;
    owned += cnt;
    if (cnt > 0) ownedTypes++;
    // 旧神=1、それ以外=3 を分母に採用:contentReference[oaicite:1]{index=1}
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

  // PCサイドバーの全体ツイートリンク（id=tweet-link）を更新:contentReference[oaicite:3]{index=3}
  const pcTweet = document.querySelector('#summary .summary-share a');
  if (pcTweet){
    const txt = encodeURIComponent(
`【神託のメソロギア】
全カード所持率${s.typePercent}％
モスロギア～所持率チェッカー～
＃信託のメソロギア
https://mosurogia.github.io/cardcheker/`
    );
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

  // スマホ上部 全体+選択パックのツイート（id=mobile-tweet-link）
  const mobileTweet = document.getElementById('mobile-tweet-link');
  if (mobileTweet){
    // 選択中パックの所持率（種類）も文言に含める
    const selKey = (document.getElementById('pack-selector')||{}).value;
    const selPack = (Array.isArray(packs) ? packs.find(p=>p.key===selKey) : null) || packs?.[0];
    let selTypePercent = 0;
    if (selPack){
      const selCards = document.querySelectorAll(`[data-pack*="${selPack.nameMain}"]`);
      selTypePercent = calcSummary(selCards).typePercent;
    }
    const mtxt = encodeURIComponent(
`【信託のメソロギア】
全カード所持率${s.typePercent}％
${selPack ? selPack.nameMain : ''}所持率${selTypePercent}％
モスロギア～所持率チェッカー～
＃信託のメソロギア
https://mosurogia.github.io/cardcheker/`
    );
    mobileTweet.href = `https://twitter.com/intent/tweet?text=${mtxt}`;
  }
}

// === 各パック所持率（PCの #pack-summary-list は li を使わず、指定の div 構成で生成） ===
function updatePackSummary(){
  const pcList = document.getElementById('pack-summary-list'); // PC側の入れ物（div）
  const mobileSelect = document.getElementById('pack-selector'); // スマホ上部プルダウン
  const mobileSummary = document.getElementById('mobile-pack-summary'); // スマホ上部パック概要

  if (!pcList) return;

  pcList.innerHTML = '';
  if (mobileSelect) mobileSelect.innerHTML = '';

  (packs || []).forEach(pack => {
    const cards = document.querySelectorAll(`[data-pack*="${pack.nameMain}"]`);
    const s = calcSummary(cards);

    // === PC側: 指定の構成で生成 ===
    const wrap = document.createElement('div');
    wrap.className = 'pack-summary';
    // a.pack-summary-link + 内部に name / rate（2行）
    wrap.innerHTML = `
      <a href="${pack.selector}" class="pack-summary-link">
        <span class="pack-summary-name">${pack.nameMain}<br><small>${pack.nameSub || ''}</small></span>
        <span class="pack-summary-rate">
          所持率: ${s.ownedTypes}/${s.totalTypes} (${s.typePercent}%)<br>
          コンプ率: ${s.owned}/${s.total} (${s.percent}%)
        </span>
      </a>
    `;

    // Xポストボタン（.summary-share 内に配置）
    const packTxt = encodeURIComponent(
`【信託のメソロギア】
${pack.nameMain}所持率${s.typePercent}％
モスロギア～所持率チェッカー～
＃信託のメソロギア
https://mosurogia.github.io/cardcheker/`
    );
    const share = document.createElement('div');
    share.className = 'summary-share';
    share.innerHTML = `
      <a class="custom-tweet-button" href="https://twitter.com/intent/tweet?text=${packTxt}" target="_blank" rel="noopener">
        <img class="tweet-icon" src="img/x-logo.svg" alt="Post"><span>ポスト</span>
      </a>
    `;
    wrap.appendChild(share);
    pcList.appendChild(wrap);

    // === スマホ: セレクトと概要も更新 ===
    if (mobileSelect){
      const opt = document.createElement('option');
      opt.value = pack.key;
      opt.textContent = pack.nameMain;
      mobileSelect.appendChild(opt);
    }
  });

  // スマホ：現在選択中パックの概要を書き換え
  if (mobileSelect && mobileSummary){
    const sel = packs.find(p => p.key === mobileSelect.value) || packs[0];
    if (sel){
      const cards = document.querySelectorAll(`[data-pack*="${sel.nameMain}"]`);
      const s = calcSummary(cards);
      mobileSummary.innerHTML = `
        <div class="pack-name">${sel.nameMain}</div>
        <div class="pack-rate">
          所持率: ${s.ownedTypes}/${s.totalTypes} (${s.typePercent}%)<br>
          コンプ率: ${s.owned}/${s.total} (${s.percent}%)
        </div>
      `;
    }
  }
}

// スマホのセレクト変更時ハンドラ（HTML側 onchange でもOK）
function selectMobilePack(packKey){
  const sel = document.getElementById('pack-selector');
  if (sel) sel.value = packKey;
  updatePackSummary();
  updateOverallSummary();
}

// 既存のトグル／+1ボタン等から呼ばれる updateSummary を差し替え（呼び出し名は据え置き）:contentReference[oaicite:15]{index=15}
function updateSummary(){
  updateOverallSummary();
  updatePackSummary();
}
/*===================
    .メニューボタン
====================*/

//所持率データ保存
function saveOwnership() {
  if (!window.OwnedStore?.save) { alert('保存機能が初期化されていません'); return; }
  OwnedStore.save();    // ← この瞬間だけ localStorage に書く
  alert('所持データを保存しました');
}



/*=======================
    2.所持率チェッカー変数
========================*/
//スラッグ：プログラム用文字列

// パック名表示順（未指定のものは末尾にアルファベット順で付く)
const PACK_ORDER = [
    'Awaking The Oracle',
    'Beyond the Sanctuary',
    // 新パックをここに追加（無くても自動検出されます）
];

// パック名→id（スラッグ）化
const PACK_SLUG_ALIAS = {
    'Awaking The Oracle': 'awaking',
    'Beyond the Sanctuary': 'beyond'
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
      html += `          <img alt="${esc(c.name)}" loading="lazy" src="img/${esc(c.cd)}.webp" />`;
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
    const count = Math.max(0, Math.min(3, n|0)); // 0..3
    // 合計表現に寄せる（checker仕様と同じ運用）
    OwnedStore.set(String(cd), { normal: count, shine: 0, premium: 0 });
  }

  // 1枚のカード要素を +times 増やす（上限3）
  function bumpOwnership(el, times = 1) {
    const cd = el?.dataset?.cd;
    if (!cd) return;
    const now = totalOf(cd);
    setTotal(cd, now + (times|0));
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

      const e = OwnedStore.get(cd);
      const now = (e.normal | 0) + (e.shine | 0) + (e.premium | 0);

      // 3のときだけ0に戻す。それ以外は +1（上限3）
      const next = (now >= 3) ? 0 : (now + 1);

      // checker運用に合わせて normal に寄せる
      OwnedStore.set(cd, { normal: next, shine: 0, premium: 0 });
    } catch (err) {
      console.error('toggleOwnership failed:', err);
    }
  };

})();


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

// チェッカー反映
{
  const btn = document.getElementById('apply-to-checker');
  if (btn) {
    btn.addEventListener('click', () => {
      if (typeof window.OwnedStore === 'undefined') { alert('所持データの初期化前です。ページを再読み込みしてください。'); return; }
      if (!confirm('現在の所持カードデータを保存して所持率チェッカーに反映しますか？')) return;
      window.OwnedStore.clampForChecker(getCardsForOwnedOps()); // 旧神=1 / 他=3
      location.href = 'cardcheker.html';
    });
  }
}

// 余剰分リセット
{
  const btn = document.getElementById('reset-excess-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      if (typeof window.OwnedStore === 'undefined') { alert('所持データの初期化前です。ページを再読み込みしてください。'); return; }
      window.OwnedStore.resetExcess(getCardsForOwnedOps());
      updateOwnedTotal();
      if (typeof renderOwnedPage === 'function') renderOwnedPage();
      alert('余剰分を全て制限枚数にリセットしました！');
    });
  }
}


//総所持枚数反映
function updateOwnedTotal() {

  const all = OwnedStore.getAll();

  // cards 相当の索引を用意（cache → DOM の順で取得）
  const cardsArr = getCardsForOwnedOps();
  const index = new Map(cardsArr.map(c => [String(c.cd), c]));

  let total = 0, legend = 0, gold = 0, silver = 0, bronze = 0;

  for (const cd in all) {
    const sum = (all[cd].normal|0)+(all[cd].shine|0)+(all[cd].premium|0);
    if (sum<=0) continue;
    total += sum;
    const info = index.get(cd); if (!info) continue;
    switch (info.rarity) {
      case 'レジェンド': legend += sum; break;
      case 'ゴールド'  : gold   += sum; break;
      case 'シルバー'  : silver += sum; break;
      case 'ブロンズ'  : bronze += sum; break;
    }
  }

  // PC/タブレット
  document.getElementById('owned-total').textContent   = total;
  document.getElementById('owned-legend').textContent  = legend;
  document.getElementById('owned-gold').textContent    = gold;
  document.getElementById('owned-silver').textContent  = silver;
  document.getElementById('owned-bronze').textContent  = bronze;

  // モバイル
  document.getElementById('owned-total-mobile').textContent   = total;
  document.getElementById('owned-legend-mobile').textContent  = legend;
  document.getElementById('owned-gold-mobile').textContent    = gold;
  document.getElementById('owned-silver-mobile').textContent  = silver;
  document.getElementById('owned-bronze-mobile').textContent  = bronze;

  //calculateDismantleSand && calculateDismantleSand();
  //updateOwnedRaceSummary && updateOwnedRaceSummary();
  //updateOwnedRaceSummaryMobile && updateOwnedRaceSummaryMobile();
}

// ストア変化で自動集計
if (window.OwnedStore?.onChange) {
  window.OwnedStore.onChange(updateOwnedTotal);
} else {
  // 後から初期化される型なら load 後にもう一度呼ぶ等のケアを足してもOK
}





//所持カード分析用
function bindCardEvents(cardDiv) {
  const cd = String(cardDiv.dataset.cd);
  let mode = 'normal'; // 'normal' | 'shine' | 'premium'

  const editionBtn = cardDiv.querySelector('.edition-mode-btn');
  const decBtn     = cardDiv.querySelector('.decrement-btn');
  const incBtn     = cardDiv.querySelector('.increment-btn');

  const countSpan   = cardDiv.querySelector('.count-display');
  const normalSpan  = cardDiv.querySelector('.normal-count');
  const shineSpan   = cardDiv.querySelector('.shine-count');
  const premiumSpan = cardDiv.querySelector('.premium-count');

  const modeLabel = (m)=> m==='normal' ? '📇ノーマル' : m==='shine' ? '✨シャイン' : '🔮プレミアム';

  function updateDisplay() {
    const e = OwnedStore.get(cd);
    const total = e.normal + e.shine + e.premium;
    countSpan.textContent   = total;
    normalSpan.textContent  = `📇${e.normal}`;
    shineSpan.textContent   = `✨${e.shine}`;
    premiumSpan.textContent = `🔮${e.premium}`;
    editionBtn.textContent  = modeLabel(mode);
  }

  editionBtn.addEventListener('click', () => {
    const next = { normal:'shine', shine:'premium', premium:'normal' };
    mode = next[mode]; updateDisplay();
  });

  incBtn.addEventListener('click', () => {
    OwnedStore.inc(cd, mode, +1);
  });

  decBtn.addEventListener('click', () => {
    const e = OwnedStore.get(cd);
    if (e[mode] > 0) OwnedStore.inc(cd, mode, -1);
  });

  // ストア変化で自動更新
  const off = OwnedStore.onChange(updateDisplay);
  cardDiv.addEventListener('remove', off, { once:true });

  updateDisplay();
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
    div.className = 'card';

    // 再構築前の data-* を踏襲
    div.dataset.cd       = card.cd;
    div.dataset.type     = card.type;
    div.dataset.race     = card.race;
    div.dataset.category = card.category;
    div.dataset.pack     = card.pack || card.pack_name || '';
    div.dataset.cost     = card.cost;
    div.dataset.power    = card.power;
    div.dataset.rarity   = card.rarity;
    div.dataset.editionMode = 'all';
    if (card.effect_name1) div.dataset.effectname1 = card.effect_name1;
    if (card.effect_name2) div.dataset.effectname2 = card.effect_name2;
    if (card.effect_text1) div.dataset.effecttext1 = card.effect_text1;
    if (card.effect_text2) div.dataset.effecttext2 = card.effect_text2;

    // 再構築前のUI構成
    div.innerHTML = `
      <img alt="${card.name}" loading="lazy" src="img/${card.cd}.webp" />
      <div class="owned-card-info">
        <div class="card-name" title="${card.name}">${card.name}</div>

        <div class="owned-card-controls">
          <button class="decrement-btn">-</button>
          <span class="count-display">0</span>
          <button class="increment-btn">+</button>
        </div>

        <div class="owned-card-edition-counts">
          <span class="normal-count">📇0</span>
          <span class="shine-count">✨0</span>
          <span class="premium-count">🔮0</span>
        </div>

        <div class="edition-switch">
          <button class="edition-mode-btn">ノーマル</button>
        </div>
      </div>
    `;

    grid.appendChild(div);

    // 再構築前のイベント実装を流用（page3.js の bindCardEvents を想定）
    if (typeof window.bindCardEvents === 'function') {
      window.bindCardEvents(div);
    }
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${__ownedCurrentPage} / ${totalPages}`;
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