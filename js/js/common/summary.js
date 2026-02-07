/* =========================
 * common/summary.js
 * - 所持率・コンプ率計算とUI更新
 * - updateSummary() を提供
 * - buildShareText() を提供
 * - カード所持率サマリーの計算と表示更新を担当
 * - 全体所持率 & モバイルパック別所持率
 * - X intent 用の共有テキスト生成も担当
    ========================= */

// ===== X intent 用：共有テキスト生成（checker専用リンクは持たない）=====
window.buildShareText = window.buildShareText || function buildShareText({
  header = '全カード',
  sum,
  packName = '',
  packSum = null,
  url = 'https://mosurogia.github.io/mesorogia-cards/cardcheker.html',
  useFullWidthHash = false,
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
  lines.push('モスロギア～所持率チェッカー～', hashTag, url);
  return encodeURIComponent(lines.join('\n'));
};



(function(){
  // ノードリストから所持情報を計算する
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
        const percent = total ? Math.round((owned/total)*100) : 0;
        const typePercent = totalTypes ? Math.round((ownedTypes/totalTypes)*100) : 0;
        return { owned, ownedTypes, total, totalTypes, percent, typePercent };
    }

    // 全体所持率を更新する
    function updateOverallSummary(){
        const allCards = document.querySelectorAll('#packs-root .card');
        const s = calcSummary(allCards);

    // PCサイドバー
    const pcRate = document.querySelector('#summary .summary-rate');
    if (pcRate){
        pcRate.innerHTML =
            `所持率: ${s.ownedTypes}/${s.totalTypes} (${s.typePercent}%)<br>` +
            `コンプ率: ${s.owned}/${s.total} (${s.percent}%)`;
    }

    // PC共有リンク
    const pcTweet = document.querySelector('#summary .summary-share a');
    if (pcTweet){
        const txt = buildShareText({ header: '全カード', sum: s });
        pcTweet.href = `https://twitter.com/intent/tweet?text=${txt}`;
    }

    // モバイル上部の数値
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

    // モバイル共有リンク（選択中パックを優先、なければ全体）
    const mobileTweet = document.getElementById('mobile-tweet-link');
    if (mobileTweet){
        const selKey = (document.getElementById('pack-selector')||{}).value;
        let mtxt;

        if (selKey && selKey !== 'all') {
            const selPack = Array.isArray(window.packs) ? window.packs.find(p=>p.key===selKey) : null;
            if (selPack){
            const selCards = queryCardsByPack(selPack);
            const sum = calcSummary(selCards);
            mtxt = buildShareText({ header: selPack.nameMain, sum });
            }
        }

        if (!mtxt) mtxt = buildShareText({ header: '全カード', sum: s });
        mobileTweet.href = `https://twitter.com/intent/tweet?text=${mtxt}`;
        }
    }

    // モバイルのパックサマリーHTMLを返す
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

// 各パック所持率を更新する
function updatePackSummary(){
  const pcList = document.getElementById('pack-summary-list');
  const mobileSelect = document.getElementById('pack-selector');
  const mobileSummary = document.getElementById('mobile-pack-summary');
  if (!pcList) return;

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

  // queryCardsByPack が無ければ fallback
  if (typeof window.queryCardsByPack !== 'function') {
    window.queryCardsByPack = function (pack) {
      const en = (pack?.nameMain || '').trim();
      return en
        ? document.querySelectorAll(`#packs-root .card[data-pack^="${CSS.escape(en)}"]`)
        : document.querySelectorAll('#packs-root .card');
    };
  }

  const packArr = getPackArray_();

  // UI初期化
  pcList.innerHTML = '';

  let prev = '';
  if (mobileSelect) {
    prev = mobileSelect.value || '';
    mobileSelect.innerHTML = '';

    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = '全カード';
    mobileSelect.appendChild(optAll);
  }

  // PCパック一覧
  packArr.forEach(pack => {
    const cards = window.queryCardsByPack(pack);
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

    // ポスト（これは残す）
    const share = document.createElement('div');
    share.className = 'summary-share';
    share.innerHTML = `
      <a class="custom-tweet-button" target="_blank" rel="noopener">
        <img class="tweet-icon" src="img/x-logo.svg" alt="Post"><span>ポスト</span>
      </a>
    `;
    share.querySelector('a').href =
      `https://twitter.com/intent/tweet?text=${buildShareText({ header: pack.nameMain, sum: s })}`;

    wrap.appendChild(share);
    pcList.appendChild(wrap);

    // mobile select
    if (mobileSelect){
      const opt = document.createElement('option');
      opt.value = pack.key;
      opt.textContent = pack.nameMain;
      mobileSelect.appendChild(opt);
    }
  });

  // mobile: 選択値を復元（なければ all）
  if (mobileSelect) {
    if (prev && [...mobileSelect.options].some(o => o.value === prev)) mobileSelect.value = prev;
    else mobileSelect.value = 'all';
  }

  // mobile: 現在選択中パックの概要
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
    if (jumpBtn) jumpBtn.style.display = (key==='all' ? 'none' : 'inline-block');
  }
}



  // 全体と各パックサマリーをまとめて更新
    function updateSummary(){
        updateOverallSummary();
        updatePackSummary();
    }

    // グローバルに公開
    window.Summary = {
        calcSummary,
        updateOverallSummary,
        updatePackSummary,
        renderMobilePackSummaryHTML,
        updateSummary,
    };

    // ✅ 互換エイリアス：古いコードが updateSummary() を呼んでも落ちないようにする
    if (typeof window.updateSummary !== 'function') {
        window.updateSummary = function () {
        try { return window.Summary?.updateSummary?.(); } catch (e) { console.warn(e); }
        };
    }
})();



