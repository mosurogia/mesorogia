/* =============================
 * common-page24.js
 * デッキ投稿と共有向け「紹介画像」生成（高解像度・1:1固定）
 * - deckmaker.html に読み込む想定（common-page23.js, page2.js 依存）
 * - #exportPngBtn クリックで html2canvas によりPNG保存
 * - 生成中はオーバーレイで「画像生成中…」を表示
 * ============================= */

(function(){
  const IMG_DIR = 'img/';
  const FALLBACK_IMG = IMG_DIR + '00000.webp';
  const BRAND_URL = 'https://mosurogia.github.io/mesorogia-cards/deckmaker.html';

  // ============ 初期化 ============
  window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('exportPngBtn');
    if (!btn) return;
    btn.addEventListener('click', () => exportDeckImage());
  });

  // ============ 画像生成メイン ============
  async function exportDeckImage(){
    // デッキが空ならアラート
    const deckObj = window.deck || {};
    const total = Object.values(deckObj).reduce((a,b)=>a+(b|0),0);
    if (total === 0){
      alert('デッキが空です。カードを追加してください。');
      return;
    }
    if (total > 40){
    alert('デッキ枚数が多すぎます（40枚以内にしてください）');
    return;
    }

    // 高解像度設計：DOM実寸は大きめ + html2canvas の scale も上げる
    // まずデッキ情報を収集し、そのデータに基づいてキャンバス仕様を計算する
    const data = buildDeckSummaryData();
    const spec = getCanvasSpec(data);


    // 種類数や枚数でcolsを動的変更
    try {
        const kinds = data.uniqueList?.length || 0;
    if (kinds <= 16)      spec.cols = 8;
    else                  spec.cols = 10;
    } catch (e) {
      console.warn('生成中断:', e.message);
      return; // 制限違反時は生成しない
    }

    const node = await buildShareNode(data, spec);
    document.body.appendChild(node);

    const loader = showLoadingOverlay('画像生成中…');

    try {
      // レイアウト安定を2フレーム待機
      await nextFrame();
      await nextFrame();

      const scale = getPreferredScale();
      const canvas = await html2canvas(node, {
        backgroundColor: '#0b0b10',
        scale,                 // 2〜3倍を推奨（環境で自動）
        useCORS: true,
        logging: false,
      });

      // 保存
      const name = (data.deckName || 'deck')
        .replace(/[\/:*?"<>|]+/g,'_')
        .slice(0,40);
      const fileName = `${name}.png`;
      downloadCanvas(canvas, fileName);
    } finally {
      node.remove();
      hideLoadingOverlay(loader);
    }
  }

  window.exportDeckImage = exportDeckImage; // ほかからも呼べるよう公開

  // ============ データ収集 ============
  function buildDeckSummaryData(){
    const deck = window.deck || {};
    const cardMap = window.cardMap || {};

    const entries = Object.entries(deck);
    const TYPE_ORDER = { 'チャージャー':0, 'アタッカー':1, 'ブロッカー':2 };
    entries.sort((a,b)=>{
      const A = cardMap[a[0]]||{}, B = cardMap[b[0]]||{};
      const tA = TYPE_ORDER[A.type] ?? 99, tB = TYPE_ORDER[B.type] ?? 99;
      if (tA !== tB) return tA - tB;
      const cA = (parseInt(A.cost)||0), cB = (parseInt(B.cost)||0); if (cA !== cB) return cA - cB;
      const pA = (parseInt(A.power)||0), pB = (parseInt(B.power)||0); if (pA !== pB) return pA - pB;
      return String(a[0]).localeCompare(String(b[0]));
    });

    const deckName = document.getElementById('info-deck-name')?.value?.trim()
      || document.getElementById('post-deck-name')?.value?.trim()
      || '';

    const mainRace = (typeof computeMainRace==='function' ? computeMainRace() : null) || '未選択';

    let elderGodName = '未採用';
    for (const [cd] of entries){
      if (cardMap[cd]?.race === '旧神') { elderGodName = cardMap[cd].name || '旧神'; break; }
    }

    const typeCounts = { 'チャージャー':0, 'アタッカー':0, 'ブロッカー':0 };
    let total = 0;
    entries.forEach(([cd, n])=>{
      total += (n|0);
      const t = cardMap[cd]?.type;
      if (t && typeCounts[t] != null) typeCounts[t] += (n|0);
    });

    // カード配列（同名カード重複版）
    const uniqueList = entries.map(([cd]) => cd);
    const countMap   = Object.fromEntries(entries.map(([cd, n]) => [String(cd), n|0]));
    // レアリティ集計
    const rarityMap = { 'レジェンド':0,'ゴールド':0,'シルバー':0,'ブロンズ':0 };
    entries.forEach(([cd, n])=>{
      const r = cardMap[cd]?.rarity; if (r && rarityMap[r] != null) rarityMap[r] += (n|0);
    });

    // 代表画像（最初のカード or 代表指定）
    const representativeCd = window.representativeCd && deck[window.representativeCd]
      ? window.representativeCd
      : (entries[0]?.[0] || null);

    return {
      deckName,
      total,
      mainRace,
      elderGodName,
      typeCounts,
      rarityMap,
      representativeCd,
      uniqueList,
      countMap,
    };
  }



  /**
 * キャンバス寸法やヘッダーサイズなどを計算。
 * @param {Object} data - buildDeckSummaryData() の結果
 * @returns {{width:number,height:number,padding:number,cols:number,headerH:number,footerH:number}}
 */
  // ============ レイアウト仕様 ============
  function getCanvasSpec(data) {
  // 種類数が多いとき（31〜40枚）は4:3比率に変更
    const kinds = data?.uniqueList?.length || 0;
    const isTall = kinds >= 31;
    const width  = isTall ? 1440 : 1920;  // 4:3 比率
    const height = 1080;                  // 高さは固定
    return {
      width, height,
      padding: 20,
      cols: 8,
      headerH: 300,
      footerH: 72,
    };
  }


  // ============ DOMビルド ============
  async function buildShareNode(data, spec){
    const root = document.createElement('div');
    root.className = 'deck-share-root';
    Object.assign(root.style, {
      position: 'fixed', left: '-9999px', top: '0',
      width: spec.width + 'px', height: spec.height + 'px',
      background: 'linear-gradient(180deg, #0b0b10 0%, #161621 100%)',
      color: '#fff', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif',
      boxSizing: 'border-box',
      padding: spec.padding + 'px',
      display: 'grid',
      gridTemplateRows: `${spec.headerH}px 1fr ${spec.footerH}px`,
      gap: '5px',
    });

    // ---- ヘッダー（タイトル・要約）----
    const header = document.createElement('div');
    header.style.display = 'grid';
    header.style.gridTemplateColumns = '260px 1fr';       header.style.gap = '18px';
    header.style.alignItems = 'center';

    const rep = await buildRepThumb(data.representativeCd, spec);



    const headRight = document.createElement('div');
    headRight.style.display = 'grid';
    headRight.style.gridTemplateRows = 'min-content 1fr';
    headRight.style.gap = '10px';

    const title = document.createElement('div');
    title.textContent = data.deckName || 'デッキ';
    Object.assign(title.style, {
    fontSize: '60px', fontWeight: '900', letterSpacing: '.4px',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    });

    // 右側3列（1: デッキ＆種族 / 2: タイプ / 3: レアリティ）

    const row1 = document.createElement('div');
    row1.innerHTML =
    badge(`デッキ ${data.total}枚`) + ' ' +
    badge(`種族 ${data.mainRace}`);

    const row2 = document.createElement('div');
    row2.innerHTML =
    badge('🔵', `チャージャー ${data.typeCounts['チャージャー']||0}枚`) + ' ' +
    badge('🟣', `アタッカー ${data.typeCounts['アタッカー']||0}枚`) + ' ' +
    badge('⚪️', `ブロッカー ${data.typeCounts['ブロッカー']||0}枚`);

    const r = data.rarityMap;
    const row3 = document.createElement('div');
    row3.innerHTML =
      badge('🌈', `レジェンド ${r['レジェンド']||0}枚`) + ' ' +
      badge('🟡', `ゴールド ${r['ゴールド']||0}枚`)   + ' '+
      badge('⚪️', `シルバー ${r['シルバー']||0}枚`)  + ' ' +
      badge('🟤', `ブロンズ ${r['ブロンズ']||0}枚`);

    // 組み立て
      headRight.appendChild(title);
      headRight.appendChild(row1);
      headRight.appendChild(row2);
      headRight.appendChild(row3);

      header.appendChild(rep);
      header.appendChild(headRight);

    // ---- グリッド（カード一覧） ----
    const grid = document.createElement('div');
    let gridHost = grid;
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${spec.cols}, 1fr)`;
    grid.style.gap = '10px';
    grid.style.alignContent = 'start';


  // 🔹31〜40種類：ラッパー方式で縦方向圧縮
  const kinds = data.uniqueList?.length || 0;
  if (kinds >= 31) {
    const gap = 10;
    const usableWidth  = spec.width  - spec.padding * 2;
    const usableHeight = spec.height - spec.headerH - spec.footerH - spec.padding * 2;
    const cols = spec.cols;
    const rows = Math.ceil(kinds / cols);
    const cardW = (usableWidth - gap * (cols - 1)) / cols;
    const cardH = cardW * (532 / 424);
    const naturalGridH = rows * cardH + gap * (rows - 1);

    const targetRows = 4;
    const targetRowH = (usableHeight - gap * (targetRows - 1)) / targetRows;
    const scale = Math.min(1, (targetRows * targetRowH + gap * (targetRows - 1)) / naturalGridH) * 0.995;

    const wrap = document.createElement('div');
    wrap.style.height = `${usableHeight}px`;
    wrap.style.overflow = 'hidden';
    wrap.style.position = 'relative';
    wrap.style.transformOrigin = 'top center';
    wrap.style.display = 'block';

    grid.style.transformOrigin = 'top center';
    grid.style.transform = `scale(${scale})`;

    wrap.appendChild(grid);
    gridHost = wrap;
  }



    const tiles = await buildCardTilesUnified(data.uniqueList, data.countMap);
    tiles.forEach(t => grid.appendChild(t));

    // ---- フッター（URLのみ） ----
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.justifyContent = 'flex-end';
    footer.style.fontSize = '22px';

    const brand = document.createElement('div');
    brand.textContent = BRAND_URL;
    brand.style.opacity = '.9';

    footer.appendChild(brand);

    // まとめ
    root.appendChild(header);
    root.appendChild(gridHost);
    root.appendChild(footer);

    return root;
  }

  function badge(emoji, text){
    const span = document.createElement('span');
    span.style.display = 'inline-flex';
    span.style.alignItems = 'center';
    span.style.gap = '8px';
    span.style.background = 'rgba(255,255,255,.08)';
    span.style.border = '1px solid rgba(255,255,255,.14)';
    span.style.padding = '8px 12px';
    span.style.marginRight = '8px';
    span.style.borderRadius = '999px';
    span.style.fontSize = '22px';
    span.style.backdropFilter = 'blur(2px)';

    const hasText = (text !== undefined);
    const e = document.createElement('span'); e.textContent = hasText ? emoji : ''; // アイコン無し許可
    const t = document.createElement('span'); t.textContent = hasText ? text : emoji; // 単一引数なら本文扱い
    span.appendChild(e); span.appendChild(t);
    return span.outerHTML;
  }

  // 代表カードの角丸サムネ
  async function buildRepThumb(cd, spec){
    const h = Math.min(280, Math.floor(spec.headerH * 0.9));
    const wrap = document.createElement('div');
    wrap.style.height = h + 'px';
    wrap.style.aspectRatio = '424 / 532';
    wrap.style.borderRadius = '16px';
    wrap.style.overflow = 'hidden';
    wrap.style.boxShadow = '0 8px 20px rgba(0,0,0,.45)';
    wrap.style.background = '#111';

    const img = await loadCardImageSafe(cd);
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    wrap.appendChild(img);
    return wrap;
  }

    // 各カード（カード + 角丸 + 影 + 重複バッジ　重複版）
  async function buildCardTilesUnified(uniqueList, countMap){
  const out = [];
  for (let i=0; i<uniqueList.length; i++){
    const cd = String(uniqueList[i]);
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.borderRadius = '12px';
    wrap.style.overflow = 'hidden';
    wrap.style.background = '#111';
    wrap.style.boxShadow = '0 4px 12px rgba(0,0,0,.35)';
    wrap.style.aspectRatio = '424 / 532';

    const img = await loadCardImageSafe(cd);
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    wrap.appendChild(img);

    const badgeDiv = document.createElement('div');
    badgeDiv.textContent = `×${countMap[cd]||1}`;
    Object.assign(badgeDiv.style, {
      position: 'absolute', right: '8px', top: '8px',
      background: 'rgba(0,0,0,.65)', color: '#fff', fontWeight: '800',
      padding: '6px 10px', borderRadius: '999px', fontSize: '18px',
    });
    wrap.appendChild(badgeDiv);

    out.push(wrap);
  }
  return out;
}


  // 安全な画像ロード（5桁化→失敗でフォールバック）
  function loadCardImageSafe(cd){
    return new Promise((resolve)=>{
      const code5 = (cd && String(cd).slice(0,5)) || '';
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.crossOrigin = 'anonymous';
      img.onload = ()=> resolve(img);
      img.onerror = ()=> { img.onerror = null; img.src = FALLBACK_IMG; };
      img.src = code5 ? (IMG_DIR + code5 + '.webp') : FALLBACK_IMG;
    });
  }

  // ============ ローディングUI ============
  function showLoadingOverlay(message){
    const ov = document.createElement('div');
    ov.className = 'deckimg-loading-overlay';
    Object.assign(ov.style, {
      position: 'fixed', inset: '0', zIndex: 9999,
      display: 'grid', placeItems: 'center',
      background: 'rgba(0,0,0,.45)',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: 'rgba(20,20,28,.9)',
      border: '1px solid rgba(255,255,255,.12)',
      borderRadius: '14px',
      padding: '18px 22px',
      boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '18px',
    });

    const spinner = document.createElement('div');
    Object.assign(spinner.style, {
      width: '18px', height: '18px', borderRadius: '999px',
      border: '3px solid rgba(255,255,255,.2)',
      borderTopColor: '#fff',
      animation: 'deckimg-spin 0.9s linear infinite'
    });

    const text = document.createElement('div');
    text.textContent = message || '生成中…';

    box.appendChild(spinner);
    box.appendChild(text);
    ov.appendChild(box);

    const style = document.createElement('style');
    style.textContent = `@keyframes deckimg-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`;
    ov.appendChild(style);

    document.body.appendChild(ov);
    return ov;
  }

  function hideLoadingOverlay(overlay){
    if (!overlay) return;
    overlay.remove();
  }

  // ============ ユーティリティ ============
  function nextFrame(){ return new Promise(r=>requestAnimationFrame(()=>r())); }

  function downloadCanvas(canvas, fileName){
    canvas.toBlob((blob)=>{
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    }, 'image/png', 1.0);
  }

  function getPreferredScale(){
    // 高解像度を優先。DPRが高ければそのまま、低ければ2以上に底上げ
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    return Math.max(2, Math.min(3, dpr)); // 2〜3 に丸める
  }

})();


