// js/pages/deckmaker/deck-ui.js
(function () {
  'use strict';

  //デッキ分析用変数
  let costChart = null;
  let powerChart = null;

  // ★ 毎回 最新参照（読み込み順に左右されない）
  function getDeck_() {
    return window.deck || (window.deck = {});
  }
  function getCardMap_() {
    return window.cardMap || window.allCardsMap || {};
  }

  // ===== デッキ分析更新 =====
  function updateDeckAnalysis() {
    const deck = getDeck_();
    const cardMap = getCardMap_();

    // deck と cardMap からカード詳細を展開
    const deckCards = [];
    Object.entries(deck).forEach(([cd, count]) => {
      const card = cardMap[cd];
      if (!card) return;
      for (let i = 0; i < (count | 0); i++) {
        deckCards.push({
          cd,
          race: card.race,
          type: card.type,
          category: card.category,
          cost: parseInt(card.cost, 10) || 0,
          power: parseInt(card.power, 10) || 0,
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

      raritySummary.innerHTML = `
        <span class="rar-item">🌈レジェンド${legend}枚</span>
        <span class="rar-item">🟡ゴールド${gold}枚</span>
        <span class="rar-item">⚪️シルバー${silver}枚</span>
        <span class="rar-item">🟤ブロンズ${bronze}枚</span>
      `;
    }

    function isCostFreeBySpecialSummon(c) {
      return c?.type === 'アタッカー'
        && c?.category === 'ロスリス'
        && Number(c?.cost) === 66;
    }

    // ✅ コスト分布だけ：66ロスリスアタッカーを除外
    const excludedLosslis66Atk = deckCards.filter(isCostFreeBySpecialSummon).length;
    const deckCardsForCostChart = deckCards.filter(c => !isCostFreeBySpecialSummon(c));

    // 1) 分布を集計
    const costCount = {};
    const powerCount = {};

    deckCardsForCostChart.forEach(c => {
      const v = Number(c.cost);
      if (!Number.isNaN(v)) costCount[v] = (costCount[v] || 0) + 1;
    });

    deckCards.forEach(c => {
      const v = Number(c.power);
      if (!Number.isNaN(v)) powerCount[v] = (powerCount[v] || 0) + 1;
    });

    // 2) ラベル（空バーも出す）
    const alwaysShowCosts  = [0, 2, 4, 6, 8, 10, 12];
    const alwaysShowPowers = [4, 5, 6, 7, 8, 10, 14, 16];

    const costLabels = [...new Set([...alwaysShowCosts, ...Object.keys(costCount).map(Number)])].sort((a,b)=>a-b);
    const powerLabels = [...new Set([...alwaysShowPowers, ...Object.keys(powerCount).map(Number)])].sort((a,b)=>a-b);

    // 3) 総コスト表示
    const sumCost = deckCards.reduce((sum, c) => {
      if (isCostFreeBySpecialSummon(c)) return sum;
      return sum + (Number(c.cost) || 0);
    }, 0);

    const sumCostEl = document.getElementById('total-cost');
    if (sumCostEl) sumCostEl.textContent = String(sumCost);

    const costSummary = document.getElementById('cost-summary-deckmaker');
    if (costSummary) costSummary.innerHTML = `<span class="stat-chip">総コスト ${sumCost}</span>`;

    // タイプ別総パワー + 平均チャージ量
    let chargerPower = 0;
    let attackerPower = 0;

    let chargerChargeSum = 0;
    let chargerChargeCnt = 0;

    deckCards.forEach(c => {
      if (c.type === 'チャージャー') {
        const p = (c.power || 0);
        const cost = (c.cost || 0);

        chargerPower += p;

        const charge = p - cost;
        if (charge > 0) {
          chargerChargeSum += charge;
          chargerChargeCnt += 1;
        }
      }
      if (c.type === 'アタッカー') {
        attackerPower += (c.power || 0);
      }
    });

    const avgChargeEl = document.getElementById('avg-charge');
    if (avgChargeEl) {
      const avg = chargerChargeCnt > 0 ? (chargerChargeSum / chargerChargeCnt) : null;
      avgChargeEl.textContent = avg !== null ? avg.toFixed(2) : '-';
    }

    // ✅ マナ効率（30109除外）
    const EXCLUDE_MANA_COST_CDS = new Set(['30109']);

    const sumCostForMana = deckCards.reduce((sum, c) => {
      if (isCostFreeBySpecialSummon(c)) return sum;

      const cd5 = String(c.cd ?? '').padStart(5, '0');
      if (EXCLUDE_MANA_COST_CDS.has(cd5)) return sum;

      return sum + (Number(c.cost) || 0);
    }, 0);

    const manaEffEl = document.getElementById('mana-efficiency');
    if (manaEffEl) {
      const BASE_MANA = 4;
      const totalMana = chargerPower + BASE_MANA;

      const manaEff = (sumCostForMana > 0) ? (totalMana / sumCostForMana) : null;

      let label = '';
      if (manaEff === null) label = '';
      else if (manaEff > 1.5) label = 'マナ過剰';
      else if (manaEff > 1) label = '適正';
      else label = 'マナ不足';

      if (manaEff !== null) {
        manaEffEl.textContent = `${manaEff.toFixed(2)}${label ? `（${label}）` : ''}`;
      } else {
        manaEffEl.textContent = '-';
      }

      manaEffEl.className = 'mana-eff';
      if (manaEff !== null) {
        if (manaEff > 1.1) manaEffEl.classList.add('mana-good');
        else if (manaEff > 0.9) manaEffEl.classList.add('mana-ok');
        else manaEffEl.classList.add('mana-bad');
      }
    }

    const sumPowerEl = document.getElementById('total-power');
    if (sumPowerEl) sumPowerEl.textContent = "";

    const powerSummary = document.getElementById('power-summary-deckmaker');
    if (powerSummary) {
      powerSummary.innerHTML = `
        <span class="type-chip" data-type="チャージャー">チャージャー ${chargerPower}</span>
        <span class="type-chip" data-type="アタッカー">アタッカー ${attackerPower}</span>
      `;
    }

    // ===== グラフ描画（Chart が無い/Canvas が無いなら安全にスキップ）=====
    const ChartCtor = window.Chart;
    if (!ChartCtor) {
      // Chart 未ロードでも他表示は出す
      return;
    }

    // datalabels は任意
    try { ChartCtor.register(window.ChartDataLabels); } catch (_) {}

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
        if (!Number.isNaN(v) && table[t] && (v in table[t])) table[t][v]++;
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

    const costDatasets  = buildStackCounts(deckCardsForCostChart, 'cost',  costLabels);
    const powerDatasets = buildStackCounts(deckCards,            'power', powerLabels);

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false, drawBorder: false }, ticks: { autoSkip: false } },
        y: { stacked: true, beginAtZero: true, grid: { display: false, drawBorder: false }, ticks: { display: false } }
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true,
          anchor: 'center',
          align: 'center',
          formatter: v => v > 0 ? v : '',
          font: { weight: 600 },
          clamp: true
        },
        tooltip: { enabled: true },
      },
    };

    if (costChart)  costChart.destroy();
    if (powerChart) powerChart.destroy();

    const costCtx  = document.getElementById('costChart-deckmaker')?.getContext('2d');
    const powerCtx = document.getElementById('powerChart-deckmaker')?.getContext('2d');

    if (costCtx) {
      costChart = new ChartCtor(costCtx, {
        type: 'bar',
        data: { labels: costLabels, datasets: costDatasets },
        options: commonOptions
      });
    }

    // ✅ 66ロスリスアタッカー注記
    const costCanvas = document.getElementById('costChart-deckmaker');
    if (costCanvas) {
      const parent = costCanvas.parentElement;
      let noteEl = parent?.querySelector?.('.chart-note');

      if (!noteEl) {
        noteEl = document.createElement('div');
        noteEl.className = 'chart-note';
        parent?.appendChild(noteEl);
      }
      noteEl.textContent = (excludedLosslis66Atk > 0)
        ? `※66ロスリスアタッカー（${excludedLosslis66Atk}枚）は除く`
        : '';
    }

    if (powerCtx) {
      powerChart = new ChartCtor(powerCtx, {
        type: 'bar',
        data: { labels: powerLabels, datasets: powerDatasets },
        options: commonOptions
      });
    }

    // 自動タグ（UIがある時だけ）
    window.updateAutoTags?.();

    // 投稿サマリー更新
    if (typeof window.refreshPostSummary === 'function') window.refreshPostSummary();
  }

  // 代表カードデッキ情報表示
  function updateDeckSummaryDisplay() {
    const cardMap = getCardMap_();
    const repCd = window.representativeCd;

    let name = "未選択";
    if (repCd && cardMap[repCd]) name = cardMap[repCd].name;

    const infoEl = document.getElementById("deck-representative");
    const postEl = document.getElementById("post-representative");
    if (infoEl) infoEl.textContent = name;
    if (postEl) postEl.textContent = name;
  }

  function updateAutoTags() {
    const deck = getDeck_();
    const cardMap = getCardMap_();

    const autoWrap = document.getElementById('auto-tags');
    if (!autoWrap) return;

    const deckCount = Object.values(deck).reduce((sum, n) => sum + (n | 0), 0);
    if (deckCount === 0) {
      autoWrap.innerHTML = '';
      return;
    }

    const autoTags = [];

    const mainRace = window.computeMainRace?.();
    if (mainRace) autoTags.push(mainRace);

    const rarityCounts = { 'レジェンド': 0, 'ゴールド': 0, 'シルバー': 0, 'ブロンズ': 0 };
    Object.entries(deck).forEach(([cd, n]) => {
      const r = cardMap[cd]?.rarity;
      if (r && rarityCounts[r] != null) rarityCounts[r] += (n | 0);
    });

    const legendNone = rarityCounts['レジェンド'] === 0;
    const goldNone   = rarityCounts['ゴールド']   === 0;

    if (legendNone && goldNone) autoTags.push('レジェンドゴールドなし');
    else if (legendNone) autoTags.push('レジェンドなし');

    const hasOldGod = Object.keys(deck).some(cd => cardMap[cd]?.race === '旧神');
    if (!hasOldGod && !legendNone) autoTags.push('旧神なし');

    // 単一英語パック
    (function(){
      const englishPacks = new Set();
      for (const [cd, n] of Object.entries(deck)) {
        if (!(n | 0)) continue;
        const infoRaw = (window.cardMap?.[cd]) || (window.allCardsMap?.[cd]);
        if (!infoRaw) continue;

        let info = infoRaw;
        if (infoRaw.link) {
          const srcCd = String(infoRaw.linkCd || infoRaw.link_cd || '');
          if (srcCd) {
            const base = (window.cardMap?.[srcCd]) || (window.allCardsMap?.[srcCd]);
            if (base) info = base;
          }
        }

        const packEn = window.getPackEnName?.(info.packName || info.pack_name || info.pack || '');
        if (!packEn) continue;

        const first = packEn.charAt(0);
        if (first >= 'A' && first <= 'Z') englishPacks.add(packEn);
      }
      if (englishPacks.size === 1) {
        const onlyPackEn = Array.from(englishPacks)[0];
        const key = onlyPackEn.charAt(0).toUpperCase();
        autoTags.push(`${key}パックのみ`);
      }
    })();

    // ハイランダー
    const isHighlander =
      deckCount >= 30 &&
      Object.values(deck).every(n => (n | 0) === 1);

    if (isHighlander) autoTags.push('ハイランダー');

    autoWrap.innerHTML = '';
    autoTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = tag;
      chip.dataset.auto = 'true';
      autoWrap.appendChild(chip);
    });
  }

  // 公開API（deckmaker版を優先して上書き）
  window.updateDeckAnalysis = updateDeckAnalysis;
  window.updateDeckSummaryDisplay = updateDeckSummaryDisplay;
  window.updateAutoTags = updateAutoTags;
})();