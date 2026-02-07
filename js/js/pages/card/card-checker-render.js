/**
 * js/pages/card/card-checker-render.js
 * - 所持率チェッカー：パック/種族ごとのカードDOM生成（#packs-root）
 * - 不足カードリスト（全体/パック別）生成＆モーダル表示
 * - パック/種族の一括操作（+1 / +3 / 全解除）
 * - 初期化：packs確定 → renderAllPacks → OwnedUI同期 → summary更新
 *
 * 依存（読み込み順）:
 * - common/defs.js（RACE_ORDER_all など）
 * - common/card-core.js（loadPackCatalog, splitPackName, makePackSlug など）
 * - common/owned.js（OwnedStore / OwnedUI）
 * - common/summary.js（updateSummary / calcSummary 等）
 * - pages/card/card-checker-owned-ops.js（toggleOwnership / bumpOwnership 等）
 */

// =====================================================
// 1) 定数・ユーティリティ
// =====================================================

// 種族表示順
const RACE_ORDER = window.RACE_ORDER_all.slice();

// 種族名 → slug
const RACE_SLUG = {
  'ドラゴン':'dragon',
  'アンドロイド':'android',
  'エレメンタル':'elemental',
  'ルミナス':'luminous',
  'シェイド':'shade',
  'イノセント':'innocent',
  '旧神':'oldgod',
};

// レアリティ → class slug
const RARITY_CLASS = {
  'レジェンド': 'legend',
  'ゴールド':   'gold',
  'シルバー':   'silver',
  'ブロンズ':   'bronze',
};

// タイプ順（種族内の並びで使用）
const TYPE_ORDER = { 'チャージャー': 0, 'アタッカー': 1, 'ブロッカー': 2 };

// HTMLエスケープ（属性崩れ防止）
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const viewCategory = (s) => String(s ?? '').replace(/\s*[（(][^（）()]*[）)]\s*$/g, '');

// レアリティclassを作る
function rarityClassOf(rarity) {
  const slug = RARITY_CLASS[rarity] || String(rarity).toLowerCase();
  return `rarity-${slug}`;
}

// 種族内：タイプ → コスト → パワー → cd
function typeCostPowerCd(a, b) {
  const ta = TYPE_ORDER[a.type] ?? 999;
  const tb = TYPE_ORDER[b.type] ?? 999;
  if (ta !== tb) return ta - tb;

  const ca = Number.isFinite(a.cost) ? a.cost : Number.MAX_SAFE_INTEGER;
  const cb = Number.isFinite(b.cost) ? b.cost : Number.MAX_SAFE_INTEGER;
  if (ca !== cb) return ca - cb;

  const pa = Number.isFinite(a.power) ? a.power : Number.MAX_SAFE_INTEGER;
  const pb = Number.isFinite(b.power) ? b.power : Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;

  const cda = Number.isFinite(+a.cd) ? +a.cd : Number.MAX_SAFE_INTEGER;
  const cdb = Number.isFinite(+b.cd) ? +b.cd : Number.MAX_SAFE_INTEGER;
  return cda - cdb;
}


// =====================================================
// 2) チェッカーDOM生成（パック→種族→カード）
// =====================================================

// パック1つ分のHTMLを組み立てる
function buildPackSectionHTML(packEn, packJp, cardsGroupedByRace){
  const packSlug = makePackSlug(packEn);
  let html = '';
  html += `<section id="pack-${packSlug}" class="pack-section">`;
  html += `  <h3 class="pack-title">`;
  html += `    <span class="pack-name-main">${esc(packEn)}</span><br>`;
  html += `    <small class="pack-name-sub">${esc(packJp)}</small>`;
  html += `  </h3>`;

  // パック単位の操作
  // パック単位の操作
  html += `  <div class="race-controls pack-controls">`;

  // 左：一括操作
  html += `    <div class="control-group control-group--bulk">`;
  html += `      <button class="pack-select-all-btn">シルバーブロンズ+3</button>`;
  html += `      <button class="pack-clear-all-btn">全て選択解除</button>`;
  html += `    </div>`;

  // 右：表示切替（セグメント）
  html += `    <div class="control-group control-group--view view-toggle">`;
  html += `      <button type="button" class="toggle-pack-view-btn is-active" data-view="all">全カード表示</button>`;
  html += `      <button type="button" class="toggle-pack-view-btn" data-view="incomplete">不足カード表示</button>`;
  html += `    </div>`;

  html += `  </div>`;

  html += `  <div id="card-list-${packSlug}">`;

  for (const race of RACE_ORDER){
    const list = cardsGroupedByRace.get(race) || [];
    if (!list.length) continue;

    const raceSlug = RACE_SLUG[race] || String(race).toLowerCase();

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


// JSON → パックごとのセクションHTMLを生成して mount に描画
async function renderAllPacks({
  jsonUrl = './cards_latest.json',
  mountSelector = '#packs-root',
  isLatestOnly = true,
  where = (c)=>true,
  sortInRace = (a,b)=> (a.cd - b.cd),
} = {}) {

  // --- JSON取得 ---
  let all;
  try {
    const res = await fetch(jsonUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    all = await res.json();
  } catch (err) {
    console.error('カードJSONの読み込みに失敗:', err);
    const mount = document.querySelector(mountSelector);
    if (mount) mount.textContent = 'データの読み込みに失敗しました。再読み込みしてください。';
    return;
  }

  // --- 抽出 ---
  const source = all
    .filter(c => (!isLatestOnly || c.is_latest))
    .filter(where);

  window.__cardsCache = source;

  // --- パック検出＆グループ化 ---
  const byPack = new Map(); // en -> {jp, cards:[]}
  for (const c of source){
    const pn = splitPackName(c.pack_name);
    if (!byPack.has(pn.en)) byPack.set(pn.en, { jp: pn.jp, cards: [] });
    byPack.get(pn.en).cards.push(c);
  }
  if (byPack.size === 0) return;

  // --- パック並び順 ---
  const allPackEns = Array.from(byPack.keys());
  const rest = allPackEns
    .filter(p => !PACK_ORDER.includes(p))
    .sort((a,b)=>a.localeCompare(b));

  const orderedPacks = [...PACK_ORDER.filter(p=>byPack.has(p)), ...rest];

  // --- パックごとに種族で整列 ---
  const parts = [];
  for (const packEn of orderedPacks){
    const { jp, cards } = byPack.get(packEn);

    const byRace = new Map();
    for (const r of RACE_ORDER) byRace.set(r, []);
    for (const c of cards){
      if (!byRace.has(c.race)) byRace.set(c.race, []);
      byRace.get(c.race).push(c);
    }
    for (const r of byRace.keys()){
      byRace.get(r).sort(sortInRace);
    }

    parts.push(buildPackSectionHTML(packEn, jp, byRace));
  }

  const mount = document.querySelector(mountSelector);
  if (!mount) { console.error('mountSelectorが見つかりません:', mountSelector); return; }
  mount.innerHTML = parts.join('');

  // 生成後にイベントを委譲で付与
  attachPackControls(mount);
}


// =====================================================
// 3) 不足カード（全体/パック別）
// =====================================================

// 所持合計（OwnedStore優先）
function ownedTotal(cd){
  if (!window.OwnedStore) return 0;
  const e = OwnedStore.get(String(cd));
  return (e?.normal|0) + (e?.shine|0) + (e?.premium|0);
}

// 不足カード収集（scope === 'all' or packオブジェクト）
function collectMissing(scope='all'){
  let list = [];

  if (scope === 'all'){
    list = Array.isArray(window.__cardsCache) ? window.__cardsCache : [];
  } else {
    const els = queryCardsByPack(scope);
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
    const pa = packIdx[packEnOf(a)] ?? 9999;
    const pb = packIdx[packEnOf(b)] ?? 9999;
    if (pa !== pb) return pa - pb;

    const ra = raceRankOf(a.race || ''), rb = raceRankOf(b.race || '');
    if (ra !== rb) return ra - rb;

    const ta = TYPE_ORDER[a.type] ?? 999;
    const tb = TYPE_ORDER[b.type] ?? 999;
    if (ta !== tb) return ta - tb;

    const ca = Number.isFinite(a.cost) ? a.cost : Number.MAX_SAFE_INTEGER;
    const cb = Number.isFinite(b.cost) ? b.cost : Number.MAX_SAFE_INTEGER;
    if (ca !== cb) return ca - cb;

    const pa2 = Number.isFinite(a.power) ? a.power : Number.MAX_SAFE_INTEGER;
    const pb2 = Number.isFinite(b.power) ? b.power : Number.MAX_SAFE_INTEGER;
    if (pa2 !== pb2) return pa2 - pb2;

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
    info.textContent = (/Mobi|Android/i.test(navigator.userAgent))
      ? '📱 タップで画像表示'
      : '🖱️ カーソル合わせて画像表示';

    const ul = document.createElement('ul');
    items.forEach(it=>{
      const li = document.createElement('li');
      li.innerHTML = `<span class="missing-name">${it.name}x${it.need}</span>`;
      li.dataset.cd  = String(it.cd || '');
      li.classList.add('missing-item');
      if (it.race) li.classList.add(`race-${it.race}`);
      ul.appendChild(li);
    });

    body.replaceChildren(info, ul);
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


// =====================================================
// 4) 不足リスト：カード画像プレビュー（PC hover / SP long-press）
// =====================================================

if (!window.__wiredMissingPreview){
  window.__wiredMissingPreview = true;

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
      if (!e.relatedTarget || !e.relatedTarget.closest('#missing-body')) hideCardPreview();
    }
  });

  let pressTimer = 0;
  document.addEventListener('touchstart', (e)=>{
    const span = e.target.closest && e.target.closest('#missing-body li.missing-item .missing-name');
    if (!span) return;
    const li = span.closest('li.missing-item');
    if (!li || !li.dataset.cd) return;
    const touch = e.touches[0];
    pressTimer = window.setTimeout(()=>{
      showCardPreviewAt(touch.clientX, touch.clientY, li.dataset.cd);
    }, 500);
  }, {passive:true});

  ['touchend','touchcancel','touchmove'].forEach(type=>{
    document.addEventListener(type, ()=>{
      if (pressTimer){ clearTimeout(pressTimer); pressTimer = 0; }
      hideCardPreview();
    }, {passive:true});
  });

  document.getElementById('missing-dialog')?.addEventListener('close', hideCardPreview);
}

function ensurePreviewEl(){
  let el = document.getElementById('card-preview-pop');
  const dlg = document.getElementById('missing-dialog');
  if (dlg && dlg.open && el && el.parentElement !== dlg) dlg.appendChild(el);
  if (el) el.style.position = 'fixed';
  return el;
}

function showCardPreviewAt(x, y, cd){
  const box = ensurePreviewEl();
  if (!box) return;
  const img = box.querySelector('img');
  if (!img) return;

  img.removeAttribute('data-fallback');
  img.src = `img/${cd}.webp`;

  const w  = img.clientWidth || 180;
  const h  = img.clientHeight || 256;
  const pad = 40;

  let left = Math.max(pad, Math.min(window.innerWidth - w - pad, x + pad));
  let top  = Math.max(pad, Math.min(window.innerHeight - h - pad, y - pad*3));

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

// =====================================================
// 5) 一括操作（高速版：まとめて更新）
// =====================================================

function getOwnedEntry_(map, cd){
  const e = map[String(cd)];
  if (e && typeof e === 'object') return {
    normal: Number(e.normal||0),
    shine: Number(e.shine||0),
    premium: Number(e.premium||0),
  };
  // 旧形式（数値）も一応吸収
  return { normal: Number(e||0), shine: 0, premium: 0 };
}

function setOwnedTotalToNormal_(map, cd, total){
  map[String(cd)] = { normal: total|0, shine: 0, premium: 0 };
}

// ✅ 一括変更：OwnedStore.replaceAll を1回だけ呼ぶ
function bulkUpdateOwned_(mutator){
  const S = window.OwnedStore;
  if (!S) return false;

  // ✅ patch があるなら差分だけで更新（速い）
  if (typeof S.patch === 'function') {
    const patch = {};
    mutator(patch);          // mutator は patch に cd->entry を詰める
    S.patch(patch);
    return true;
  }

  // フォールバック：replaceAll
  if (!S.getAll || !S.replaceAll) return false;
  const next = S.getAll() || {};
  mutator(next);
  S.replaceAll(next);
  return true;
}


// packが不足表示中なら、操作後にそのpackだけ再判定して表示を更新する
function reapplyPackIfIncomplete_(packSection){
  if (!packSection) return;
  const mode = packSection.dataset.viewMode || 'all';
  if (mode === 'incomplete') {
    // ✅ “切替時だけ再判定” ルールを保ちつつ、ここだけは明示的に更新
    applyPackView_(packSection, 'incomplete', true);
  }
}

// ✅ 一括操作後の重い処理は「次の描画フレーム」に逃がす（INP対策）
function schedulePostBulkUIUpdate_(packSection){
  const sel = (packSection && packSection.id)
    ? `#${CSS.escape(packSection.id)}`
    : '#packs-root';

  // ✅ INP対策：次タスクに逃がして先に描画させる
  setTimeout(() => {
    try {
      window.OwnedUI?.sync?.(sel, { grayscale: true, skipSummary: true, skipOwnedTotal: true });
    } catch (e) {
      window.OwnedUI?.sync?.('#packs-root', { grayscale: true, skipSummary: true, skipOwnedTotal: true });
    }

    // 不足表示中なら、そのpackだけ再判定
    reapplyPackIfIncomplete_(packSection);

    // summary は idle に（これも重い）
    const runSummary = () => {
      try {
        if (typeof window.updateSummary === 'function') window.updateSummary();
        else if (window.Summary?.updateSummary) window.Summary.updateSummary();
      } catch {}
    };

    if (window.requestIdleCallback) requestIdleCallback(runSummary, { timeout: 700 });
    else setTimeout(runSummary, 0);
  }, 0);
}


// =====================================================
// 5) 一括操作（+1/+3/解除）
// =====================================================

function bump_(el, times = 1) {
  if (typeof window.bumpOwnership === 'function') return window.bumpOwnership(el, times);
  for (let i = 0; i < times; i++) if (typeof window.toggleOwnership === 'function') window.toggleOwnership(el);
}

function clearCard_(el) {
  if (typeof window.clearOwnership === 'function') return window.clearOwnership(el);
  for (let i = 0; i < 4; i++) if (typeof window.toggleOwnership === 'function') window.toggleOwnership(el);
}

function attachPackControls(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const packSection = e.target.closest('.pack-section');
    const raceGroup   = e.target.closest('.race-group');

    // ------------------------------
    // ✅ パック：シルバーブロンズ+3（=最大まで埋める扱い）
    // ------------------------------
    if (btn.classList.contains('pack-select-all-btn') && packSection) {
      const targets = packSection.querySelectorAll('.card.rarity-silver, .card.rarity-bronze');

      const ok = bulkUpdateOwned_((map) => {
        targets.forEach(el => {
          const cd = el.dataset.cd;
          if (!cd) return;

          // 旧神=1 / それ以外=3（ただし対象はsilver/bronze想定なので基本3）
          const max = maxOwnedOfCardEl_(el);
          // “+3” は結局 max まで埋まるので max にしてOK
          setOwnedTotalToNormal_(map, cd, max);
        });
      });

      if (!ok) {
        // フォールバック（遅いけど動く）
        targets.forEach(el => bump_(el, 3));
      }

      // ✅ まとめて同期は1回だけ
schedulePostBulkUIUpdate_(packSection);
      return;
    }

    // ------------------------------
    // ✅ パック：全て選択解除（=0）
    // ------------------------------
    if (btn.classList.contains('pack-clear-all-btn') && packSection) {
      const targets = packSection.querySelectorAll('.card[data-cd]');

      const ok = bulkUpdateOwned_((map) => {
        targets.forEach(el => {
          const cd = el.dataset.cd;
          if (!cd) return;
          setOwnedTotalToNormal_(map, cd, 0);
        });
      });

      if (!ok) {
        targets.forEach(el => clearCard_(el));
      }

schedulePostBulkUIUpdate_(packSection);
      return;
    }

    // ------------------------------
    // ✅ 全カード/不足カード（パック単位）
    // ------------------------------
    if (btn.classList.contains('toggle-pack-view-btn') && packSection) {
      const mode = btn.dataset.view; // 'all' | 'incomplete'
      applyPackView_(packSection, mode, true);
      return;
    }

    // ------------------------------
    // ✅ 種族：全て選択+1（=1枚増やす、上限で止める）
    // ------------------------------
    if (btn.classList.contains('select-all-btn') && raceGroup) {
      const targets = raceGroup.querySelectorAll('.card[data-cd]');

      const ok = bulkUpdateOwned_((map) => {
        targets.forEach(el => {
          const cd = el.dataset.cd;
          if (!cd) return;

          const cur = getOwnedEntry_(map, cd);
          const curTotal = (cur.normal|0) + (cur.shine|0) + (cur.premium|0);
          const max = maxOwnedOfCardEl_(el);
          const nextTotal = Math.min(max, curTotal + 1);

          // 合計だけ合ってればよい前提で normal に寄せる
          setOwnedTotalToNormal_(map, cd, nextTotal);
        });
      });

      if (!ok) {
        targets.forEach(el => bump_(el, 1));
      }

schedulePostBulkUIUpdate_(packSection);
      return;
    }

    // ------------------------------
    // ✅ 種族：全て選択解除（=0）
    // ------------------------------
    if (btn.classList.contains('clear-all-btn') && raceGroup) {
      const targets = raceGroup.querySelectorAll('.card[data-cd]');

      const ok = bulkUpdateOwned_((map) => {
        targets.forEach(el => {
          const cd = el.dataset.cd;
          if (!cd) return;
          setOwnedTotalToNormal_(map, cd, 0);
        });
      });

      if (!ok) {
        targets.forEach(el => clearCard_(el));
      }

schedulePostBulkUIUpdate_(packSection);
      return;
    }
  });
}


// =====================================================
// 5.5) 表示切替：パック単位（全カード / 不足カード）
// =====================================================

// 旧神=1 / それ以外=3
function maxOwnedOfCardEl_(cardEl){
  const race = cardEl?.dataset?.race || '';
  return (race === '旧神') ? 1 : 3;
}

// ✅ パック内のボタン状態だけ更新
function syncPackToggleUI_(packSection, mode){
  packSection.querySelectorAll('.toggle-pack-view-btn').forEach(b => {
    const on = (b.dataset.view === mode);
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

// ✅ パック単位で “不足カードのみ” を適用
function applyPackView_(packSection, mode, forceRecalc = false){
  if (!packSection) return;

  // mode: 'all' | 'incomplete'
  packSection.dataset.viewMode = mode;

  // ②対策：不足表示中は “切替時だけ” 再計算（カード操作で勝手に消さない）
  if (
    mode === 'incomplete' &&
    packSection.classList.contains('is-incomplete-only') &&
    !forceRecalc
  ){
    syncPackToggleUI_(packSection, mode);
    return;
  }

  // all / incomplete のクラス切替
  packSection.classList.toggle('is-incomplete-only', mode === 'incomplete');

  const cards = packSection.querySelectorAll('.card[data-cd]');
  cards.forEach(el => {
    const cd  = el.dataset.cd;
    const own = ownedTotal(cd);
    const max = maxOwnedOfCardEl_(el);
    const isIncomplete = own < max;

    el.classList.toggle('is-incomplete', isIncomplete);
    el.classList.toggle('is-complete', !isIncomplete);
  });

  // 種族グループ：不足表示中のみ「未コンプ0なら隠す」
  packSection.querySelectorAll('.race-group').forEach(group => {
    if (mode !== 'incomplete') { group.style.display = ''; return; }
    group.style.display = group.querySelector('.card.is-incomplete') ? '' : 'none';
  });

  syncPackToggleUI_(packSection, mode);
}

// 初期化：全パックを all にそろえる
function initPackViews_(){
  document.querySelectorAll('#packs-root .pack-section').forEach(pack => {
    applyPackView_(pack, 'all', true);
  });
}


// =====================================================
// 6) pack抽出ヘルパ（summary / 不足カード用）
// =====================================================

function queryCardsByPack(pack) {
  const en = (pack?.nameMain || '').trim();
  return en
    ? document.querySelectorAll(`#packs-root .card[data-pack^="${CSS.escape(en)}"]`)
    : document.querySelectorAll('#packs-root .card');
}
window.queryCardsByPack = window.queryCardsByPack || queryCardsByPack;


// =====================================================
// 7) 初期化：packs確定 → renderAllPacks → OwnedUI同期 → summary更新
// =====================================================

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

  // チェッカー側だけ 0枚をグレー化する
  try { window.OwnedUI?.bind?.('#packs-root', { grayscale: true }); }
  catch (e) { console.warn('[checker] OwnedUI.bind(#packs-root) failed', e); }

  if (typeof window.applyGrayscaleFilter === 'function') window.applyGrayscaleFilter();
  if (typeof window.updateSummary === 'function') window.updateSummary();
  else if (window.Summary?.updateSummary) window.Summary.updateSummary();
  initPackViews_();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPacksThenRender, { once: true });
} else {
  initPacksThenRender();
}
