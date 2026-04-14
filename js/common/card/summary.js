/* =========================
 * js/common/card/summary.js
 * - 所持率・コンプ率計算とUI更新
 * - updateSummary() を提供
 * - buildShareText() を提供
 * - カード所持率サマリーの計算と表示更新を担当
 * - 全体所持率 / パック別所持率 / 種族・カテゴリ別所持率 / レアリティ別所持率
 * - X intent 用の共有テキスト生成も担当
 * ========================= */

// =====================================================
// 0. X intent 用：共有テキスト生成
// - checker専用リンクを使って共有文面を組み立てる
// =====================================================
window.buildShareText = window.buildShareText || function buildShareText({
  header = '全カード',
  sum,
  packName = '',
  packSum = null,

  // 図鑑ページ(cards.html)の所持率チェッカー(#checker)へ
  url = 'https://mosurogia.github.io/mesorogia-cards/cards.html#checker',

  useFullWidthHash = false,
} = {}) {
  const hashTag = useFullWidthHash ? '＃神託のメソロギア' : '#神託のメソロギア';
  const lines = [
    '【神託のメソロギア】',
    header,
    `所持率: ${sum.ownedTypes}/${sum.totalTypes} (${sum.typePercentText ?? sum.typePercent}%)`,
  ];

  if (packSum && packName) {
    lines.push(
      packName,
      `所持率: ${packSum.ownedTypes}/${packSum.totalTypes} (${packSum.typePercent}%)`,
    );
  }

  lines.push('モスロギア～所持率チェッカー～', hashTag, url);
  return encodeURIComponent(lines.join('\n'));
};

(function(){
  'use strict';

  // =====================================================
  // 1. 基本ユーティリティ
  // =====================================================

  // cd から所持合計を取得
  function ownedTotalByCd_(cd){
    const S = window.OwnedStore;
    if (!S?.get) return 0;

    const e = S.get(String(cd));
    return (e?.normal | 0) + (e?.shine | 0) + (e?.premium | 0);
  }

  // =====================================================
  // 2. 所持率オプション（SP/PC共通）
  // - コラボ/特殊を母数に含めるかどうか
  // =====================================================
  const SUMMARY_OPT_KEY = 'mosurogia_summary_include_unobtainable';

  function getIncludeUnobtainable_(){
    try {
      return localStorage.getItem(SUMMARY_OPT_KEY) === '1';
    } catch(e){
      return false;
    }
  }

  function setIncludeUnobtainable_(v){
    try {
      localStorage.setItem(SUMMARY_OPT_KEY, v ? '1' : '0');
    } catch(e){}
  }

  // パック情報から「コラボ/特殊」判定用タグを得る
  function getPackAvailabilityTag_(packLike){
    const key = String(packLike?.key ?? packLike?.packKey ?? '').toLowerCase();
    const nameMain = String(packLike?.nameMain ?? packLike?.packEn ?? '');
    const nameSub  = String(packLike?.nameSub ?? packLike?.packJp ?? '');
    const any = `${key} ${nameMain} ${nameSub}`.toLowerCase();

    if (any.includes('コラボ') || any.includes('collab')) return 'collab';
    if (any.includes('特殊') || any.includes('special')) return 'special';
    return null;
  }

  // カードが「入手不可カテゴリ（コラボ/特殊）」か判定
  function isUnobtainableCard_(card){
    const sec = card?.closest?.('.pack-section');
    if (!sec) return false;

    // 1) data-packgroup
    const g = String(sec.getAttribute('data-packgroup') || '').toLowerCase();
    if (g === 'collab' || g === 'special') return true;

    // 2) パック情報
    const packTag = getPackAvailabilityTag_({
      packKey: sec.getAttribute('data-packkey') || '',
      packEn: sec.querySelector('.pack-name-main')?.textContent || '',
      packJp: sec.querySelector('.pack-name-sub')?.textContent || '',
    });
    if (packTag) return true;

    // 3) 見出しテキスト
    const title = sec.querySelector('.pack-title-text, .pack-title, h3, h2');
    const t = String(title?.textContent || '').trim();
    if (t.includes('コラボ')) return true;
    if (t.includes('特殊')) return true;

    return false;
  }

  // =====================================================
  // 3. 共通集計
  // - nodeList から所持率・コンプ率を計算
  // =====================================================
  function calcSummary(nodeList){
    let owned = 0;
    let ownedTypes = 0;
    let total = 0;
    let totalTypes = 0;

    const includeUnobtainable = getIncludeUnobtainable_();

    nodeList.forEach(card => {
      if (!includeUnobtainable && isUnobtainableCard_(card)) return;

      totalTypes++;

      const cd = card.dataset.cd;
      const cnt = cd ? ownedTotalByCd_(cd) : 0;

      owned += cnt;
      if (cnt > 0) ownedTypes++;

      total += (card.dataset.race === '旧神') ? 1 : 3;
    });

    const percentRaw = total ? (owned / total) * 100 : 0;
    const typePercentRaw = totalTypes ? (ownedTypes / totalTypes) * 100 : 0;

    const percent = Math.round(percentRaw * 10) / 10;
    const typePercent = Math.round(typePercentRaw * 10) / 10;

    return {
      owned,
      ownedTypes,
      total,
      totalTypes,
      percent,
      typePercent,
      percentText: percent.toFixed(1),
      typePercentText: typePercent.toFixed(1),
    };
  }

  // =====================================================
  // 4. 種族・カテゴリ別サマリー
  // =====================================================

  // 種族名正規化
  function normalizeRace_(s){
    const v = String(s ?? '').trim();
    return v ? v.replace(/\s*[（(][^（）()]*[）)]\s*$/g, '') : '不明';
  }

  // 種族 → アクセント色
  function raceToAccentVar_(race){
    switch (race) {
      case 'ドラゴン': return 'var(--race-dragon)';
      case 'アンドロイド': return 'var(--race-android)';
      case 'エレメンタル': return 'var(--race-elemental)';
      case 'ルミナス': return 'var(--race-luminous)';
      case 'シェイド': return 'var(--race-shade)';
      case 'イノセント': return 'var(--race-innocent)';
      case '旧神': return '#a78bfa';
      default: return 'rgba(140,140,140,1)';
    }
  }

  // カテゴリ名正規化
  function normalizeCategory_(s){
    const v = String(s ?? '').trim();
    return v ? v.replace(/\s*[（(][^（）()]*[）)]\s*$/g, '') : 'ノーカテゴリ';
  }

  // カテゴリ別所持率用の並び順を取得
  function getCategorySummarySort_(category){
    const name = normalizeCategory_(category);
    if (name === 'ノーカテゴリ') {
      return { group: 2, order: 9999 };
    }

    const groups = Array.isArray(window.CATEGORY_GROUPS) ? window.CATEGORY_GROUPS : [];
    let offset = 0;

    for (const group of groups) {
      const list = Array.isArray(group?.list) ? group.list : [];
      const index = list.findIndex(item => normalizeCategory_(item) === name);
      if (index >= 0) {
        return { group: 0, order: offset + index };
      }
      offset += list.length;
    }

    return { group: 1, order: 9999 };
  }

  // 種族配下のカテゴリ行データを作成
  function buildCategoryRowsForRace_(raceName, cards){
    const map = new Map();

    cards.forEach(card => {
      const raw = card.dataset.category || 'ノーカテゴリ';
      const name = normalizeCategory_(raw);
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(card);
    });

    const rows = [...map.entries()].map(([name, list]) => ({
      name,
      sum: calcSummary(list),
      accent: raceToAccentVar_(raceName),
      sort: getCategorySummarySort_(name),
    }));

    rows.sort((a, b) => {
      if (a.sort.group !== b.sort.group) return a.sort.group - b.sort.group;
      if (a.sort.order !== b.sort.order) return a.sort.order - b.sort.order;
      if (b.sum.totalTypes !== a.sum.totalTypes) return b.sum.totalTypes - a.sum.totalTypes;
      return a.name.localeCompare(b.name, 'ja');
    });

    return rows;
  }

  // カテゴリ一覧HTML
  function renderCategorySummaryHTML_(raceName, rows){
    if (!rows.length) return '';

    const items = rows.map(r => {
      const s = r.sum;
      return `
        <div class="summary-breakdown-item summary-breakdown-item-sub category-${r.name}" style="--accent:${r.accent}">
          <div class="summary-breakdown-head">
            <span class="summary-breakdown-dot" aria-hidden="true"></span>
            <span class="summary-breakdown-name">${r.name}</span>
            <span class="summary-breakdown-val">${s.ownedTypes}/${s.totalTypes} (${s.typePercentText}%)</span>
          </div>

          <div class="meter">
            <div class="meter-label">所持率</div>
            <div class="meter-track" role="progressbar"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.typePercent}">
              <span class="meter-bar -own" style="width:${s.typePercentText}%"></span>
            </div>
            <div class="meter-val">
              <span class="meter-frac">${s.ownedTypes}/${s.totalTypes}</span>
              <span class="meter-pct">(${s.typePercentText}%)</span>
            </div>
          </div>

          <div class="meter -sub">
            <div class="meter-label">コンプ率</div>
            <div class="meter-track" role="progressbar"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.percent}">
              <span class="meter-bar -comp" style="width:${s.percentText}%"></span>
            </div>
            <div class="meter-val">
              <span class="meter-frac">${s.owned}/${s.total}</span>
              <span class="meter-pct">(${s.percentText}%)</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="summary-breakdown-sublist" data-race-sublist="${raceName}" hidden>
        ${items}
      </div>
    `;
  }

  // PC/SP の種族サマリー置き場を確保
  function ensureRaceContainers_(){
    // PC：#pack-summary-list の直前
    let pc = document.getElementById('race-summary-list');
    const packList = document.getElementById('pack-summary-list');
    if (!pc && packList && packList.parentElement){
      pc = document.createElement('div');
      pc.id = 'race-summary-list';
      pc.className = 'summary-breakdown-block -race -pc';
      packList.parentElement.insertBefore(pc, packList);
    }

    // SP：#packs-root の先頭
    let mo = document.getElementById('race-summary-mobile');
    const packsRoot = document.getElementById('packs-root');
    if (!mo && packsRoot){
      mo = document.createElement('div');
      mo.id = 'race-summary-mobile';
      mo.className = 'summary-breakdown-block -race -mobile';
      packsRoot.insertBefore(mo, packsRoot.firstChild);
    }

    // SP注意書きバー
    if (packsRoot) {
      let note = document.getElementById('checker-note-mobile');
      if (!note) {
        note = document.createElement('div');
        note.id = 'checker-note-mobile';
        note.className = 'checker-note';

        note.innerHTML = `
<div class="checker-note-sub">
  ● 所持状況は自動保存されます（保存ボタン不要）
</div>
<div class="checker-note-sub">
  ● 保存はこの端末/ブラウザ内です
</div>
<div class="checker-note-sub">
  ● 将来的にログイン機能により、所持状況を他端末と同期できる予定です
</div>

<div class="checker-note-row">
  <label class="checker-note-toggle">
    <input type="checkbox" id="toggle-unobtainable">
    <span>コラボ/特殊を所持率に含める</span>
  </label>
</div>
<div class="checker-note-sub">
  ● OFF時：コラボ/特殊は母数から除外（現在入手不可のため）
</div>
        `;
      }

      if (mo && note.nextSibling !== mo) {
        packsRoot.insertBefore(note, mo);
      }
    }

    // 注意書きUIのイベント配線
    if (packsRoot) {
      const note = document.getElementById('checker-note-mobile');
      if (note && !note.dataset.wired) {
        note.dataset.wired = '1';

        const cb = note.querySelector('#toggle-unobtainable');
        if (cb) {
          cb.checked = getIncludeUnobtainable_();
          cb.addEventListener('change', () => {
            setIncludeUnobtainable_(cb.checked);
            window.Summary?.updateSummary?.();
          });
        }
      }
    }

    return { pc, mo };
  }

  // 種族サマリー本体HTML
  function renderRaceSummaryHTML_(rows){
    if (!rows.length) return '';

    const items = rows.map(r => {
      const s = r.sum;
      const raceClass = `race-${r.name}`;
      const categoryHtml = renderCategorySummaryHTML_(r.name, r.categories || []);

      return `
        <div class="summary-breakdown-item ${raceClass}" style="--accent:${r.accent}">
          <div class="summary-breakdown-head">
            <span class="summary-breakdown-dot" aria-hidden="true"></span>
            <span class="summary-breakdown-name">${r.name}</span>
            <span class="summary-breakdown-val">${s.ownedTypes}/${s.totalTypes} (${s.typePercentText}%)</span>
          </div>

          <div class="meter">
            <div class="meter-label">所持率</div>
            <div class="meter-track" role="progressbar"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.typePercent}">
              <span class="meter-bar -own" style="width:${s.typePercentText}%"></span>
            </div>
            <div class="meter-val">
              <span class="meter-frac">${s.ownedTypes}/${s.totalTypes}</span>
              <span class="meter-pct">(${s.typePercentText}%)</span>
            </div>
          </div>

          <div class="meter -sub">
            <div class="meter-label">コンプ率</div>
            <div class="meter-track" role="progressbar"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.percent}">
              <span class="meter-bar -comp" style="width:${s.percentText}%"></span>
            </div>
            <div class="meter-val">
              <span class="meter-frac">${s.owned}/${s.total}</span>
              <span class="meter-pct">(${s.percentText}%)</span>
            </div>
          </div>

          <div class="summary-breakdown-subtoggle-row">
            <button
              type="button"
              class="summary-breakdown-subtoggle"
              data-category-toggle="${r.name}"
              aria-expanded="false">
              カテゴリごとでさらに見る
            </button>
          </div>

          ${categoryHtml}
        </div>
      `;
    }).join('');

    return `
      <div class="summary-breakdown-header" role="button" tabindex="0"
          data-break-toggle="header" aria-expanded="false">
        <span class="summary-breakdown-title">種族・カテゴリ別所持率</span>
        <span class="summary-breakdown-toggle" data-break-toggle="icon" aria-hidden="true">＋</span>
      </div>

      <div class="summary-breakdown-body" data-break-toggle="body" hidden>
        <div class="summary-breakdown-list">
          ${items}
        </div>
      </div>
    `;
  }

  // 種族サマリー更新
  function updateRaceSummary(){
    const allCards = document.querySelectorAll('#packs-root .card');
    if (!allCards || !allCards.length) return;

    const { pc, mo } = ensureRaceContainers_();
    if (!pc && !mo) return;

    // race -> Node[]
    const map = new Map();
    allCards.forEach(card => {
      const raw = card.dataset.race || '不明';
      const name = normalizeRace_(raw);
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(card);
    });

    // rows 作成
    // ※ ここで categories を入れないと「カテゴリごとでさらに見る」の開き先が生成されない
    const rows = [...map.entries()].map(([name, list]) => {
      return {
        name,
        sum: calcSummary(list),
        accent: raceToAccentVar_(name),
        categories: buildCategoryRowsForRace_(name, list),
      };
    });

    // 並び順
    const order = Array.isArray(window.RACE_ORDER_all) ? window.RACE_ORDER_all : null;
    if (order) {
      const idx = new Map(order.map((x, i) => [String(x), i]));
      rows.sort((a, b) => {
        const ia = idx.has(a.name) ? idx.get(a.name) : 999;
        const ib = idx.has(b.name) ? idx.get(b.name) : 999;
        if (ia !== ib) return ia - ib;
        return b.sum.totalTypes - a.sum.totalTypes;
      });
    } else {
      rows.sort((a, b) => {
        if (b.sum.totalTypes !== a.sum.totalTypes) return b.sum.totalTypes - a.sum.totalTypes;
        return a.name.localeCompare(b.name, 'ja');
      });
    }

    (window.Summary ||= {})._lastRaces = rows;

    // 開閉イベント配線
    function wireToggle_(root){
      if (!root) return;

      if (!root.dataset.wiredRaceToggle) {
        root.dataset.wiredRaceToggle = '1';

        const toggle = () => {
          const header = root.querySelector('[data-break-toggle="header"]');
          const body   = root.querySelector('[data-break-toggle="body"]');
          const icon   = root.querySelector('[data-break-toggle="icon"]');
          if (!header || !body || !icon) return;

          const isOpen = !body.hidden;
          body.hidden = isOpen;
          header.setAttribute('aria-expanded', String(!isOpen));
          icon.textContent = isOpen ? '＋' : '－';
        };

        root.addEventListener('click', (e) => {
          const catBtn = e.target.closest('[data-category-toggle]');
          if (catBtn) {
            e.preventDefault();
            e.stopPropagation();

            const raceName = catBtn.getAttribute('data-category-toggle') || '';
            if (!raceName) return;

            const item = catBtn.closest('.summary-breakdown-item');
            const sublist = item?.querySelector(`[data-race-sublist="${raceName}"]`);
            if (!sublist) return;

            const isOpen = !sublist.hidden;
            sublist.hidden = isOpen;
            catBtn.setAttribute('aria-expanded', String(!isOpen));
            catBtn.textContent = isOpen ? 'カテゴリごとでさらに見る' : 'カテゴリ所持率を閉じる';
            return;
          }

          const headerBtn = e.target.closest('[data-break-toggle="header"]');
          if (headerBtn) {
            toggle();
          }
        });

        root.addEventListener('keydown', (e) => {
          if (!e.target.closest('[data-break-toggle="header"]')) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        });
      }
    }

    const html = renderRaceSummaryHTML_(rows);

    // 再描画前の開閉状態を保持
    const wasOpenPc = (() => {
      const body = pc?.querySelector?.('[data-break-toggle="body"]');
      return body ? !body.hidden : false;
    })();

    const wasOpenMo = (() => {
      const body = mo?.querySelector?.('[data-break-toggle="body"]');
      return body ? !body.hidden : false;
    })();

    if (pc) {
      pc.innerHTML = html;
      wireToggle_(pc);

      const header = pc.querySelector('[data-break-toggle="header"]');
      const body   = pc.querySelector('[data-break-toggle="body"]');
      const icon   = pc.querySelector('[data-break-toggle="icon"]');
      if (header && body && icon) {
        body.hidden = !wasOpenPc;
        header.setAttribute('aria-expanded', String(wasOpenPc));
        icon.textContent = wasOpenPc ? '－' : '＋';
      }
    }

    if (mo) {
      mo.innerHTML = html;
      wireToggle_(mo);

      const header = mo.querySelector('[data-break-toggle="header"]');
      const body   = mo.querySelector('[data-break-toggle="body"]');
      const icon   = mo.querySelector('[data-break-toggle="icon"]');
      if (header && body && icon) {
        body.hidden = !wasOpenMo;
        header.setAttribute('aria-expanded', String(wasOpenMo));
        icon.textContent = wasOpenMo ? '－' : '＋';
      }
    }
  }

  // =====================================================
  // 5. レアリティ別サマリー
  // =====================================================

  function normalizeRarity_(s){
    const v = String(s ?? '').trim();
    return v ? v.replace(/\s*[（(][^（）()]*[）)]\s*$/g, '') : '不明';
  }

  function rarityToAccent_(rar){
    switch (rar) {
      case 'レジェンド': return '#91e4fb';
      case 'ゴールド':   return '#eab308';
      case 'シルバー':   return '#94a3b8';
      case 'ブロンズ':   return '#c08457';
      default:           return '#aaa';
    }
  }

  // レアリティ内のパック行データを作成
  function buildPackRowsForRarity_(rarityName, cards){
    const map = new Map();

    cards.forEach(card => {
      const raw = String(card.dataset.pack || '').trim() || '不明なパック';
      if (!map.has(raw)) map.set(raw, []);
      map.get(raw).push(card);
    });

    const order = Array.isArray(window.PACK_ORDER) ? window.PACK_ORDER : [];
    const idx = new Map(order.map((name, i) => [String(name || '').trim(), i]));

    const rows = [...map.entries()].map(([name, list]) => {
      const split = typeof window.splitPackName === 'function'
        ? window.splitPackName(name)
        : { en: name, jp: '' };
      const en = String(split.en || name).trim();
      const sum = calcSummary(list);
      const packSection = list[0]?.closest?.('.pack-section');
      const packAccentRgb = packSection
        ? getComputedStyle(packSection).getPropertyValue('--pack-accent-rgb').trim()
        : '';

      return {
        name,
        sum,
        accent: rarityToAccent_(rarityName),
        packAccentRgb,
        order: idx.has(en) ? idx.get(en) : 9999,
      };
    }).filter(row => row.sum.totalTypes > 0);

    rows.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      if (b.sum.totalTypes !== a.sum.totalTypes) return b.sum.totalTypes - a.sum.totalTypes;
      return a.name.localeCompare(b.name, 'ja');
    });

    return rows;
  }

  // パック別一覧HTML
  function renderPackSummaryHTML_(rows){
    if (!rows.length) return '';

    const items = rows.map(r => {
      const s = r.sum;
      const accentStyle = r.packAccentRgb
        ? `--pack-accent-rgb:${r.packAccentRgb}; --accent:rgb(var(--pack-accent-rgb));`
        : `--accent:${r.accent};`;
      return `
        <div class="summary-breakdown-item summary-breakdown-item-sub summary-breakdown-item-pack" style="${accentStyle}">
          <div class="summary-breakdown-head">
            <span class="summary-breakdown-dot" aria-hidden="true"></span>
            <span class="summary-breakdown-name">${r.name}</span>
            <span class="summary-breakdown-val">${s.ownedTypes}/${s.totalTypes} (${s.typePercentText}%)</span>
          </div>

          <div class="meter">
            <div class="meter-label">所持率</div>
            <div class="meter-track" role="progressbar"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.typePercent}">
              <span class="meter-bar -own" style="width:${s.typePercentText}%"></span>
            </div>
            <div class="meter-val">
              <span class="meter-frac">${s.ownedTypes}/${s.totalTypes}</span>
              <span class="meter-pct">(${s.typePercentText}%)</span>
            </div>
          </div>

          <div class="meter -sub">
            <div class="meter-label">コンプ率</div>
            <div class="meter-track" role="progressbar"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.percent}">
              <span class="meter-bar -comp" style="width:${s.percentText}%"></span>
            </div>
            <div class="meter-val">
              <span class="meter-frac">${s.owned}/${s.total}</span>
              <span class="meter-pct">(${s.percentText}%)</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="summary-breakdown-sublist" data-rarity-pack-sublist hidden>
        ${items}
      </div>
    `;
  }

  // レアリティサマリー置き場確保
  function ensureRarityContainers_(){
    let pc = document.getElementById('rarity-summary-list');
    const raceList = document.getElementById('race-summary-list');
    const packList = document.getElementById('pack-summary-list');

    if (!pc) {
      pc = document.createElement('div');
      pc.id = 'rarity-summary-list';
      pc.className = 'summary-breakdown-block -rarity -pc';

      if (raceList && raceList.parentElement) {
        raceList.parentElement.insertBefore(pc, raceList.nextSibling);
      } else if (packList && packList.parentElement) {
        packList.parentElement.insertBefore(pc, packList);
      } else {
        pc = null;
      }
    }

    let mo = document.getElementById('rarity-summary-mobile');
    const packsRoot = document.getElementById('packs-root');

    if (!mo && packsRoot) {
      mo = document.createElement('div');
      mo.id = 'rarity-summary-mobile';
      mo.className = 'summary-breakdown-block -rarity -mobile';

      const raceMobile = document.getElementById('race-summary-mobile');
      if (raceMobile && raceMobile.parentElement === packsRoot) {
        packsRoot.insertBefore(mo, raceMobile.nextSibling);
      } else {
        packsRoot.insertBefore(mo, packsRoot.firstChild);
      }
    }

    return { pc, mo };
  }

  // レアリティサマリーHTML
  function renderRaritySummaryHTML_(rows){
    if (!rows.length) return '';

    const items = rows.map(r => {
      const s = r.sum;
      const rarClass = `rarity-${r.name}`;
      const packHtml = renderPackSummaryHTML_(r.packs || []);
      const hasPackRows = !!packHtml;

      return `
        <div class="summary-breakdown-item ${rarClass}" style="--accent:${r.accent}">
          <div class="summary-breakdown-head">
            <span class="summary-breakdown-dot" aria-hidden="true"></span>
            <span class="summary-breakdown-name">${r.name}</span>
            <span class="summary-breakdown-val">${s.ownedTypes}/${s.totalTypes} (${s.typePercentText}%)</span>
          </div>

          <div class="meter">
            <div class="meter-label">所持率</div>
            <div class="meter-track" role="progressbar"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.typePercent}">
              <span class="meter-bar -own" style="width:${s.typePercentText}%"></span>
            </div>
            <div class="meter-val">
              <span class="meter-frac">${s.ownedTypes}/${s.totalTypes}</span>
              <span class="meter-pct">(${s.typePercentText}%)</span>
            </div>
          </div>

          <div class="meter -sub">
            <div class="meter-label">コンプ率</div>
            <div class="meter-track" role="progressbar"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.percent}">
              <span class="meter-bar -comp" style="width:${s.percentText}%"></span>
            </div>
            <div class="meter-val">
              <span class="meter-frac">${s.owned}/${s.total}</span>
              <span class="meter-pct">(${s.percentText}%)</span>
            </div>
          </div>

          ${hasPackRows ? `
            <div class="summary-breakdown-subtoggle-row">
              <button
                type="button"
                class="summary-breakdown-subtoggle"
                data-pack-toggle
                aria-expanded="false">
                パック別でさらに見る
              </button>
            </div>

            ${packHtml}
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="summary-breakdown-header" role="button" tabindex="0"
          data-break-toggle="header" aria-expanded="false">
        <span class="summary-breakdown-title">レアリティ別所持率</span>
        <span class="summary-breakdown-toggle" data-break-toggle="icon" aria-hidden="true">＋</span>
      </div>

      <div class="summary-breakdown-body" data-break-toggle="body" hidden>
        <div class="summary-breakdown-list">
          ${items}
        </div>
      </div>
    `;
  }

  // レアリティサマリー更新
  function updateRaritySummary(){
    const allCards = document.querySelectorAll('#packs-root .card');
    if (!allCards || !allCards.length) return;

    const { pc, mo } = ensureRarityContainers_();
    if (!pc && !mo) return;

    const map = new Map();
    allCards.forEach(card => {
      const raw = card.dataset.rarity || '不明';
      const name = normalizeRarity_(raw);
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(card);
    });

    const rows = [...map.entries()].map(([name, list]) => {
      return {
        name,
        sum: calcSummary(list),
        accent: rarityToAccent_(name),
        packs: buildPackRowsForRarity_(name, list),
      };
    });

    const ORDER = ['レジェンド','ゴールド','シルバー','ブロンズ'];
    const idx = new Map(ORDER.map((x, i) => [x, i]));
    rows.sort((a, b) => {
      const ia = idx.has(a.name) ? idx.get(a.name) : 999;
      const ib = idx.has(b.name) ? idx.get(b.name) : 999;
      if (ia !== ib) return ia - ib;
      return b.sum.totalTypes - a.sum.totalTypes;
    });

    (window.Summary ||= {})._lastRarities = rows;

    function wireToggle_(root){
      if (!root) return;

      if (!root.dataset.wiredRarityToggle) {
        root.dataset.wiredRarityToggle = '1';

        const toggle = () => {
          const header = root.querySelector('[data-break-toggle="header"]');
          const body   = root.querySelector('[data-break-toggle="body"]');
          const icon   = root.querySelector('[data-break-toggle="icon"]');
          if (!header || !body || !icon) return;

          const isOpen = !body.hidden;
          body.hidden = isOpen;
          header.setAttribute('aria-expanded', String(!isOpen));
          icon.textContent = isOpen ? '＋' : '－';
        };

        root.addEventListener('click', (e) => {
          const packBtn = e.target.closest('[data-pack-toggle]');
          if (packBtn) {
            e.preventDefault();
            e.stopPropagation();

            const item = packBtn.closest('.summary-breakdown-item');
            const sublist = item?.querySelector('[data-rarity-pack-sublist]');
            if (!sublist) return;

            const isOpen = !sublist.hidden;
            sublist.hidden = isOpen;
            packBtn.setAttribute('aria-expanded', String(!isOpen));
            packBtn.textContent = isOpen ? 'パック別でさらに見る' : 'パック別所持率を閉じる';
            return;
          }

          if (e.target.closest('[data-break-toggle="header"]')) toggle();
        });

        root.addEventListener('keydown', (e) => {
          if (!e.target.closest('[data-break-toggle="header"]')) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        });
      }

      const header = root.querySelector('[data-break-toggle="header"]');
      const body   = root.querySelector('[data-break-toggle="body"]');
      const icon   = root.querySelector('[data-break-toggle="icon"]');
      if (header && body && icon) {
        body.hidden = true;
        header.setAttribute('aria-expanded', 'false');
        icon.textContent = '＋';
      }
    }

    const html = renderRaritySummaryHTML_(rows);

    const wasOpenPc = (() => {
      const body = pc?.querySelector?.('[data-break-toggle="body"]');
      return body ? !body.hidden : false;
    })();

    const wasOpenMo = (() => {
      const body = mo?.querySelector?.('[data-break-toggle="body"]');
      return body ? !body.hidden : false;
    })();

    if (pc) {
      pc.innerHTML = html;
      wireToggle_(pc);

      const header = pc.querySelector('[data-break-toggle="header"]');
      const body   = pc.querySelector('[data-break-toggle="body"]');
      const icon   = pc.querySelector('[data-break-toggle="icon"]');
      if (header && body && icon) {
        body.hidden = !wasOpenPc;
        header.setAttribute('aria-expanded', String(wasOpenPc));
        icon.textContent = wasOpenPc ? '－' : '＋';
      }
    }

    if (mo) {
      mo.innerHTML = html;
      wireToggle_(mo);

      const header = mo.querySelector('[data-break-toggle="header"]');
      const body   = mo.querySelector('[data-break-toggle="body"]');
      const icon   = mo.querySelector('[data-break-toggle="icon"]');
      if (header && body && icon) {
        body.hidden = !wasOpenMo;
        header.setAttribute('aria-expanded', String(wasOpenMo));
        icon.textContent = wasOpenMo ? '－' : '＋';
      }
    }
  }

  // =====================================================
  // 6. 全体所持率サマリー
  // =====================================================

  function updateOverallSummary(){
    const allCards = document.querySelectorAll('#packs-root .card');
    const s = calcSummary(allCards);
    (window.Summary ||= {})._lastOverall = s;

    // PCサイドバー
    const pcRate = document.querySelector('#summary .summary-rate');
    if (pcRate){
      pcRate.innerHTML =
        `所持率: ${s.ownedTypes}/${s.totalTypes} (${s.typePercentText}%)<br>` +
        `コンプ率: ${s.owned}/${s.total} (${s.percentText}%)`;
    }

    // PC共有リンク
    const pcTweet = document.querySelector('#summary .summary-share a');
    if (pcTweet){
      const txt = window.buildShareText({ header: '全カード', sum: s });
      pcTweet.href = `https://twitter.com/intent/tweet?text=${txt}`;
    }

    // モバイル上部の数値
    const moTypeCount   = document.getElementById('mobile-owned-type-count');
    const moTypeTotal   = document.getElementById('mobile-total-type-count');
    const moTypePercent = document.getElementById('mobile-owned-type-percent');
    const moOwned       = document.getElementById('mobile-owned-count');
    const moTotal       = document.getElementById('mobile-total-count');
    const moPercent     = document.getElementById('mobile-owned-percent');

    // 不足カード種類数
    const missingTypes = (() => {
      const S = window.OwnedStore;

      if (!S || typeof S.get !== 'function') return s.totalTypes | 0;

      let n = 0;
      allCards.forEach(cardEl => {
        const cd = cardEl?.dataset?.cd;
        if (!cd) return;

        const e = S.get(String(cd));
        const own = (e?.normal | 0) + (e?.shine | 0) + (e?.premium | 0);

        const race = cardEl?.dataset?.race || '';
        const max = (race === '旧神') ? 1 : 3;

        if (own < max) n++;
      });
      return n;
    })();

    const missBtnMobile = document.getElementById('show-missing-all-mobile');
    if (missBtnMobile) missBtnMobile.dataset.count = String(missingTypes);

    const missBtnPc = document.getElementById('show-missing-all');
    if (missBtnPc) missBtnPc.dataset.count = String(missingTypes);

    if (moTypeCount)   moTypeCount.textContent = s.ownedTypes;
    if (moTypeTotal)   moTypeTotal.textContent = s.totalTypes;
    if (moTypePercent) moTypePercent.textContent = `${s.typePercentText}%`;
    if (moPercent)     moPercent.textContent = `${s.percentText}%`;
    if (moOwned)       moOwned.textContent = s.owned;
    if (moTotal)       moTotal.textContent = s.total;

    // モバイル共有リンク
    const mobileTweet = document.getElementById('mobile-tweet-link');
    if (mobileTweet){
      const selKey = (document.getElementById('pack-selector') || {}).value;
      let mtxt;

      if (selKey && selKey !== 'all') {
        const selPack = Array.isArray(window.packs) ? window.packs.find(p => p.key === selKey) : null;
        if (selPack){
          const selCards = window.queryCardsByPack(selPack);
          const sum = calcSummary(selCards);
          mtxt = window.buildShareText({ header: selPack.nameMain, sum });
        }
      }

      if (!mtxt) mtxt = window.buildShareText({ header: '全カード', sum: s });
      mobileTweet.href = `https://twitter.com/intent/tweet?text=${mtxt}`;
    }
  }

  // モバイルパックサマリーHTML
  function renderMobilePackSummaryHTML(s){
    return `
      <div class="pack-meters">
        <div class="meter">
          <div class="meter-label">所持率</div>
          <div class="meter-track" role="progressbar"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.typePercent}">
            <span class="meter-bar -own" style="width:${s.typePercentText}%"></span>
          </div>
          <div class="meter-val">
            <span class="meter-frac">${s.ownedTypes}/${s.totalTypes}</span>
            <span class="meter-pct">(${s.typePercentText}%)</span>
          </div>
        </div>

        <div class="meter">
          <div class="meter-label">コンプ率</div>
          <div class="meter-track" role="progressbar"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.percent}">
            <span class="meter-bar -comp" style="width:${s.percentText}%"></span>
          </div>
          <div class="meter-val">
            <span class="meter-frac">${s.owned}/${s.total}</span>
            <span class="meter-pct">(${s.percentText}%)</span>
          </div>
        </div>
      </div>`;
  }

  // =====================================================
  // 7. 各パック所持率サマリー
  // =====================================================
  function updatePackSummary(){
    const pcList = document.getElementById('pack-summary-list');
    const mobileSelect = document.getElementById('pack-selector');
    const mobileSummary = document.getElementById('mobile-pack-summary');

    const hasPC = !!pcList;
    const hasMobile = !!mobileSelect || !!mobileSummary;
    if (!hasPC && !hasMobile) return;

    function getPackArray_(){
      const p = window.packs;

      if (Array.isArray(p)) return p;

      if (p && Array.isArray(p.list)) {
        return p.list.map(x => ({
          key: x.key || x.slug || x.en,
          nameMain: x.en || x.nameMain || '',
          nameSub:  x.jp || x.nameSub || '',
          selector: x.selector || `#pack-${x.slug || x.key || ''}`,
        }));
      }

      if (p && Array.isArray(p.packs)) {
        return p.packs.map(x => ({
          key: x.key || x.slug || x.en,
          nameMain: x.en || x.nameMain || '',
          nameSub:  x.jp || x.nameSub || '',
          selector: x.selector || `#pack-${x.slug || x.key || ''}`,
        }));
      }

      return [];
    }

    if (typeof window.queryCardsByPack !== 'function') {
      window.queryCardsByPack = function (pack) {
        const en = (pack?.nameMain || '').trim();
        return en
          ? document.querySelectorAll(`#packs-root .card[data-pack^="${CSS.escape(en)}"]`)
          : document.querySelectorAll('#packs-root .card');
      };
    }

    const packArr = getPackArray_();

    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

    const isUnavailablePack = (pack) => getPackAvailabilityTag_(pack);
    const normalPacks = packArr.filter(p => !isUnavailablePack(p));
    const normalGroupByKey = new Map();

    normalPacks.forEach((p, i) => {
      normalGroupByKey.set(p.key, letters[i] || 'z');
    });

    function detectPackGroup_(pack){
      const tag = isUnavailablePack(pack);
      if (tag) return tag;

      const k = pack?.key;
      if (k && normalGroupByKey.has(k)) return normalGroupByKey.get(k);

      return letters[normalPacks.length] || 'z';
    }

    // A〜Z → コラボ → 特殊
    packArr.sort((a, b) => {
      const rank = (p) => {
        const key = String(p?.key ?? '').toLowerCase();
        const nameMain = String(p?.nameMain ?? '');
        const nameSub  = String(p?.nameSub ?? '');
        const any = (key + ' ' + nameMain + ' ' + nameSub).toLowerCase();

        if (any.includes('コラボ') || any.includes('collab')) return 10;
        if (any.includes('特殊')) return 20;
        return 0;
      };

      return rank(a) - rank(b);
    });

    if (pcList) pcList.innerHTML = '';

    let prev = '';
    if (mobileSelect) {
      prev = mobileSelect.value || '';
      mobileSelect.innerHTML = '';

      const optAll = document.createElement('option');
      optAll.value = 'all';
      optAll.textContent = '全カード';
      mobileSelect.appendChild(optAll);
    }

    packArr.forEach((pack) => {
      const cards = window.queryCardsByPack(pack);
      const s = calcSummary(cards);
      const isUnavailable = !!isUnavailablePack(pack);

      const wrap = document.createElement('div');
      wrap.className = 'pack-summary';
      wrap.hidden = !getIncludeUnobtainable_() && isUnavailable;

      const group = detectPackGroup_(pack);
      wrap.dataset.packGroup = group;
      wrap.dataset.unobtainable = isUnavailable ? '1' : '0';

      wrap.dataset.ownedTypes = String(s.ownedTypes);
      wrap.dataset.totalTypes = String(s.totalTypes);
      wrap.dataset.typePercent = String(s.typePercent);
      wrap.dataset.typePercentText = String(s.typePercentText);

      wrap.dataset.owned = String(s.owned);
      wrap.dataset.total = String(s.total);
      wrap.dataset.percent = String(s.percent);
      wrap.dataset.percentText = String(s.percentText);

      wrap.innerHTML = `
        <a href="${pack.selector}" class="pack-summary-link">
          <span class="pack-summary-name">
            ${pack.nameMain}<br><small>${pack.nameSub || ''}</small>
          </span>
        </a>
      `;

      if (pcList) pcList.appendChild(wrap);

      if (mobileSelect) {
        const opt = document.createElement('option');
        opt.value = pack.key;
        opt.textContent = pack.nameMain;
        mobileSelect.appendChild(opt);
      }
    });

    // PC側パック名クリック
    if (pcList && !pcList.dataset.wiredPackJump) {
      pcList.dataset.wiredPackJump = '1';

      pcList.addEventListener('click', (e) => {
        const a = e.target.closest('a.pack-summary-link');
        if (!a) return;

        e.preventDefault();
        e.stopPropagation();

        const href = a.getAttribute('href') || '';
        const m = href.match(/^#pack-(.+)$/);
        const slug = m ? m[1] : '';
        if (!slug) return;

        if (typeof window.jumpToPack === 'function') {
          window.jumpToPack(slug);
        } else {
          const el = document.getElementById(`pack-${slug}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, { passive: false });
    }

    if (mobileSelect) {
      if (prev && [...mobileSelect.options].some(o => o.value === prev)) mobileSelect.value = prev;
      else mobileSelect.value = 'all';
    }

    if (mobileSelect && mobileSummary) {
      const key = mobileSelect.value || 'all';
      let s;

      if (key === 'all') {
        const all = document.querySelectorAll('#packs-root .card');
        s = calcSummary(all);
      } else {
        const sel = packArr.find(p => p.key === key) || packArr[0];
        const cards = window.queryCardsByPack(sel);
        s = calcSummary(cards);
      }

      mobileSummary.innerHTML = renderMobilePackSummaryHTML(s);

      const jumpBtn = document.getElementById('jump-pack-btn');
      if (jumpBtn) jumpBtn.style.display = (key === 'all' ? 'none' : 'inline-block');
    }
  }

  // =====================================================
  // 8. 全体更新
  // =====================================================
  function updateSummary(){
    updateOverallSummary();
    updatePackSummary();
    updateRaceSummary();
    updateRaritySummary();
    window.dispatchEvent(new Event('summary:updated'));
  }

  // =====================================================
  // 9. 公開API
  // =====================================================
  window.Summary = {
    calcSummary,
    updateOverallSummary,
    updatePackSummary,
    updateRaceSummary,
    updateRaritySummary,
    renderMobilePackSummaryHTML,
    updateSummary,
  };

  // 互換エイリアス
  if (typeof window.updateSummary !== 'function') {
    window.updateSummary = function () {
      try {
        return window.Summary?.updateSummary?.();
      } catch (e) {
        console.warn(e);
      }
    };
  }
})();
