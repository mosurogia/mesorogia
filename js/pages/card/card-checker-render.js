

/*=======================
    2.所持率チェッカー変数
========================*/

// 種族表示順
const RACE_ORDER = window.RACE_ORDER_all.slice();

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
    const info = document.createElement('p');
    info.className = 'missing-info';
    // PC/モバイル判定して文言を変える
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      info.textContent = '📱 タップで画像表示';
    } else {
      info.textContent = '🖱️ カーソル合わせて画像表示';
    }

    const ul = document.createElement('ul');
    items.forEach(it=>{
      const li = document.createElement('li');
      li.innerHTML = `<span class="missing-name">${it.name}x${it.need}</span>`;
      li.dataset.cd  = String(it.cd || '');
      li.classList.add('missing-item');
      const race = it.race || '';
      if (race) li.classList.add(`race-${race}`);
      ul.appendChild(li);
    });

    body.replaceChildren(info, ul); // ← 先に説明、次にリスト
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
/*=================================
  3. パック/種族ボタン（+1/+3/解除）
===================================*/

function bump_(el, times = 1) {
  if (typeof window.bumpOwnership === 'function') return window.bumpOwnership(el, times);
  // フォールバック：toggle を times 回
  for (let i = 0; i < times; i++) {
    if (typeof window.toggleOwnership === 'function') window.toggleOwnership(el);
  }
}

function clearCard_(el) {
  if (typeof window.clearOwnership === 'function') return window.clearOwnership(el);
  // フォールバック（最大3回想定）
  for (let i = 0; i < 4; i++) {
    if (typeof window.toggleOwnership === 'function') window.toggleOwnership(el);
  }
}

function attachPackControls(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const packSection = e.target.closest('.pack-section');
    const raceGroup   = e.target.closest('.race-group');

    // 1) パック：シルバー/ブロンズ +3
    if (btn.classList.contains('pack-select-all-btn') && packSection) {
      const targets = packSection.querySelectorAll('.card.rarity-silver, .card.rarity-bronze');
      targets.forEach(el => bump_(el, 3));
      return;
    }

    // 2) パック：全解除
    if (btn.classList.contains('pack-clear-all-btn') && packSection) {
      const targets = packSection.querySelectorAll('.card');
      targets.forEach(el => clearCard_(el));
      return;
    }

    // 3) 種族：全て選択 +1
    if (btn.classList.contains('select-all-btn') && raceGroup) {
      const targets = raceGroup.querySelectorAll('.card');
      targets.forEach(el => bump_(el, 1));
      return;
    }

    // 4) 種族：全解除
    if (btn.classList.contains('clear-all-btn') && raceGroup) {
      const targets = raceGroup.querySelectorAll('.card');
      targets.forEach(el => clearCard_(el));
      return;
    }
  });
}

// パック抽出ヘルパ（不足カードなどが参照する場合用）
function queryCardsByPack(pack) {
  const en = (pack?.nameMain || '').trim();
  return en
    ? document.querySelectorAll(`#packs-root .card[data-pack^="${CSS.escape(en)}"]`)
    : document.querySelectorAll('#packs-root .card');
}
window.queryCardsByPack = window.queryCardsByPack || queryCardsByPack;

/*=================================
  1回だけ起動：packs を確定 → renderAllPacks
===================================*/
async function initPacksThenRender() {
  try {
    const catalog = await window.loadPackCatalog();
    window.PACK_ORDER = catalog.order;
    window.packs = catalog.list.map(p => ({
      key: p.key,
      nameMain: p.en,
      nameSub:  p.jp,
      selector: `#pack-${p.slug}`
    }));
  } catch (e) {
    console.warn('packカタログ初期化に失敗:', e);
    window.PACK_ORDER = [];
    window.packs = [];
  }

  await renderAllPacks({
    jsonUrl: 'public/cards_latest.json',
    mountSelector: '#packs-root',
    isLatestOnly: true,
    sortInRace: typeCostPowerCd
  });

  if (typeof window.applyGrayscaleFilter === 'function') window.applyGrayscaleFilter();
  if (typeof window.updateSummary === 'function') window.updateSummary();
  else if (window.Summary?.updateSummary) window.Summary.updateSummary();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPacksThenRender, { once: true });
} else {
  initPacksThenRender();
}
