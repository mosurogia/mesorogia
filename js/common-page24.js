/* =============================
 * common-page24.js (rewrite)
 * デッキ投稿/共有向け「紹介画像」生成（3:4 縦 / 4:3 横）
 * - deckmaker.html に読み込む想定
 * - #exportPngBtn クリックで html2canvas によりPNG保存
 * - 生成中はオーバーレイで「画像生成中…」を表示
 * - コンソールAPI:
 *     DeckImg.getAspect(), DeckImg.setAspect('3:4'|'4:3')
 *     DeckImg.getCols(),   DeckImg.setCols(n)   // 横長時のみ有効
 *     DeckImg.getBg(),     DeckImg.setBg('dark'|'light'|'#f7f7fb'等)
 * ============================= */

(function(){
  const IMG_DIR = 'img/';
  const FALLBACK_IMG = IMG_DIR + '00000.webp';
  const BRAND_URL = 'https://mosurogia.github.io/mesorogia-cards/deckmaker.html';

  // ローカル保存キー
  const LS_KEY_ASPECT = 'deckimg_aspect_v2'; // 1:1 廃止後のv2
  const LS_KEY_COLS   = 'deckimg_cols_v1';   // 横長用の列数
  const LS_KEY_BG     = 'deckimg_bg_v1';     // 背景テーマ

  const VALID_ASPECTS = new Set(['3:4','4:3']);

  // ================= 公開API =================
  const DeckImg = {
    // 比率
    getAspect(){ return readAspect(); },
    setAspect(aspect){
      if (!VALID_ASPECTS.has(aspect)) { console.warn('Use "3:4" or "4:3".'); return; }
      localStorage.setItem(LS_KEY_ASPECT, aspect);
      console.log(`Aspect set to ${aspect}`);
    },
    // 横長の列数（縦長は常に5固定）
    getCols(){ return readCols(); },
    setCols(n){
      const v = Math.max(3, Math.min(10, parseInt(n,10)||0));
      localStorage.setItem(LS_KEY_COLS, String(v));
      console.log(`Cols set to ${v} (effective on 4:3)`);
    },
    // 背景（'dark'|'light'|任意カラー）
    getBg(){ return readBg(); },
    setBg(v){
      if (!v) return;
      localStorage.setItem(LS_KEY_BG, String(v));
      console.log(`Background set to ${v}`);
    },
    help(){
      console.log([
        'DeckImg.getAspect() / DeckImg.setAspect("3:4"|"4:3")',
        'DeckImg.getCols()   / DeckImg.setCols(3..10)   // 4:3時のみ適用',
        "DeckImg.getBg()     / DeckImg.setBg('dark'|'light'|'#f7f7fb'等)",
        'exportDeckImage()   // 直接呼び出しも可'
      ].join('\n'));
    }
  };
  window.DeckImg = DeckImg;

  function readAspect(){
    const v = localStorage.getItem(LS_KEY_ASPECT) || '3:4';
    return VALID_ASPECTS.has(v) ? v : '3:4';
  }
  function readCols(){
    return Math.max(3, Math.min(10, parseInt(localStorage.getItem(LS_KEY_COLS) || '7', 10)));
  }
  function readBg(){
    return localStorage.getItem(LS_KEY_BG) || 'dark';
  }

  // ============ 初期化 ============
  window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('exportPngBtn');
    if (!btn) return;
    btn.addEventListener('click', () => exportDeckImage());
  });

//画像アスペクト確認
async function chooseAspectByPrompt() {
  // スマホでも確実に動く原始的UI：OK=縦 / Cancel=横
  const okIsPortrait = window.confirm('縦長（3:4）で出力しますか？\nOK：縦長（3:4） / キャンセル：横長（4:3）');
  return okIsPortrait ? '3:4' : '4:3';
}


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

    const aspect = await chooseAspectByPrompt(); // その場で選択（スマホ実機OK）
    window.DeckImg?.setAspect?.(aspect);         // ついでに保存（任意）
    const data = buildDeckSummaryData();
    const spec = getCanvasSpec(aspect);


    // 列数: 縦=5固定 / 横=コンソール可変
    spec.cols = (aspect === '3:4') ? 5 : readCols();

    const node = await buildShareNode(data, spec);
    document.body.appendChild(node);

    const loader = showLoadingOverlay('画像生成中…');

    try {
      await nextFrame(); await nextFrame(); // レイアウト安定待ち

      const scale = getPreferredScale();
      const canvas = await html2canvas(node, {
        backgroundColor: null,
        scale,
        useCORS: true,
        logging: false,
      });

      const name = (data.deckName || 'deck').replace(/[\/:*?"<>|]+/g,'_').slice(0,40);
      const suffix = (aspect === '3:4' ? '3x4' : '4x3');
      const fileName = `${name}_${suffix}.png`;
      downloadCanvas(canvas, fileName);
    } finally {
      node.remove();
      hideLoadingOverlay(loader);
    }
  }
  window.exportDeckImage = exportDeckImage;

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

    const uniqueList = entries.map(([cd]) => cd);
    const countMap   = Object.fromEntries(entries.map(([cd, n]) => [String(cd), n|0]));
    const rarityMap  = { 'レジェンド':0,'ゴールド':0,'シルバー':0,'ブロンズ':0 };
    entries.forEach(([cd, n])=>{
      const r = cardMap[cd]?.rarity; if (r && rarityMap[r] != null) rarityMap[r] += (n|0);
    });

    // 代表カード: 指定が有効でデッキ内にある → それ以外は先頭カード
    const repCd = (window.representativeCd && deck[window.representativeCd])
      ? window.representativeCd
      : (entries[0]?.[0] || null);

    return {
      deckName, total, mainRace, elderGodName,
      typeCounts, rarityMap,
      representativeCd: repCd,
      uniqueList, countMap,
    };
  }

  // ============ レイアウト仕様 ============
  function getCanvasSpec(aspect, bgChoice){
    let width, height, headerH, footerH;
    if (aspect === '3:4') { // 縦
      width  = 1350;
      height = 1800;
      headerH = 520;
      footerH = 84;
    } else { // 4:3 横
      width  = 1800;
      height = 1350;
      headerH = 360;
      footerH = 84;
    }

    const theme = resolveTheme();


    return {
      aspect, width, height,
      padding: 24,
      cols: 5, // デフォは後で上書き
      headerH, footerH,
      gap: 12,
      theme
    };
  }

function resolveTheme() {
  // 柔らかいライト系グラデ + 透明感のあるカードパネル
  return {
    // 角度を付けたうっすらグラデーション
    canvasBg: 'linear-gradient(160deg, #f7f8fb 0%, #ffffff 45%, #f3f6fb 100%)',
    // “カード置き場”っぽい半透明ホワイト
    panelBg: 'rgba(255,255,255,0.88)',
    panelEdge: 'rgba(15,23,42,0.10)',         // = #0f172a の10%
    text: '#0f172a',
    subText: 'rgba(15,23,42,0.72)',
    chipBg: 'rgba(2,6,23,0.04)',             // ごく薄いチップ背景
    chipEdge: 'rgba(2,6,23,0.10)',
    chipText: '#0f172a',
    badgeBg: 'rgba(3,7,18,0.78)',            // 濃色バッジ（白地で映える）
    shadow: '0 14px 34px rgba(2,6,23,0.10)'  // ふわっとした影
  };
}



  // ============ DOMビルド ============
  async function buildShareNode(data, spec){
    const root = document.createElement('div');
    root.className = 'deck-share-root';
    Object.assign(root.style, {
      position: 'fixed', left: '-9999px', top: '0',
      width: spec.width + 'px', height: spec.height + 'px',
      background: spec.theme.canvasBg,
      color: spec.theme.text,
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif',
      boxSizing: 'border-box',
      padding: spec.padding + 'px',
      display: 'grid',
      gridTemplateRows: `${spec.headerH}px 1fr ${spec.footerH}px`,
      gap: '6px',
    });

    // ---- ヘッダー ----
    const header = document.createElement('div');
    header.style.display = 'grid';
    header.style.gridTemplateColumns = (spec.aspect==='3:4' ? '260px 1fr' : '220px 1fr');
    header.style.gap = '18px';
    header.style.alignItems = 'center';
    header.style.background = spec.theme.panelBg;
    header.style.border = `1px solid ${spec.theme.panelEdge}`;
    header.style.borderRadius = '16px';
    header.style.padding = '16px';
    header.style.boxShadow = spec.theme.shadow;

    const rep = await buildRepThumb(data.representativeCd, spec);

    const headRight = document.createElement('div');
    headRight.style.display = 'grid';
    headRight.style.gridTemplateRows = 'min-content repeat(3, min-content)';
    headRight.style.gap = '8px';

    const title = document.createElement('div');
    title.textContent = data.deckName || 'デッキ';
    Object.assign(title.style, {
      fontSize: (spec.aspect==='3:4' ? '60px' : '48px'),
      fontWeight: '900', letterSpacing: '.4px',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      color: spec.theme.text,
    });

    const row1 = document.createElement('div');
    row1.innerHTML = badge(spec, undefined, `デッキ ${data.total}枚`) + ' ' + badge(spec, undefined, `種族 ${data.mainRace}`);

    const row2 = document.createElement('div');
    row2.innerHTML =
      badge(spec, '🔵', `チャージャー ${data.typeCounts['チャージャー']||0}枚`) + ' ' +
      badge(spec, '🟣', `アタッカー ${data.typeCounts['アタッカー']||0}枚`) + ' ' +
      badge(spec, '⚪️', `ブロッカー ${data.typeCounts['ブロッカー']||0}枚`);

    const r = data.rarityMap;
    const row3 = document.createElement('div');
    row3.innerHTML =
      badge(spec, '🌈', `レジェンド ${r['レジェンド']||0}枚`) + ' ' +
      badge(spec, '🟡', `ゴールド ${r['ゴールド']||0}枚`)   + ' '+
      badge(spec, '⚪️', `シルバー ${r['シルバー']||0}枚`)  + ' ' +
      badge(spec, '🟤', `ブロンズ ${r['ブロンズ']||0}枚`);

    headRight.appendChild(title);
    headRight.appendChild(row1);
    headRight.appendChild(row2);
    headRight.appendChild(row3);

    header.appendChild(rep);
    header.appendChild(headRight);

    // ---- グリッド（カード一覧） ----
    const grid = document.createElement('div');
    let gridHost = grid;
    const gap = spec.gap;
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${spec.cols}, 1fr)`;
    grid.style.gap = gap + 'px';
    grid.style.alignContent = 'start';

    // パネル化（ライトでも視認性）
    const gridPanel = document.createElement('div');
    gridPanel.style.background = spec.theme.panelBg;
    gridPanel.style.border = `1px solid ${spec.theme.panelEdge}`;
    gridPanel.style.borderRadius = '16px';
    gridPanel.style.padding = '12px';
    gridPanel.style.boxShadow = spec.theme.shadow;

    // すべてのカードをキャンバス内に収めるスケール計算
    const kinds = data.uniqueList?.length || 0;
    const rows = Math.ceil(kinds / spec.cols);

    const usableWidth  = spec.width  - spec.padding * 2 - 24; // gridPanel padding相当
    const usableHeight = spec.height - spec.headerH - spec.footerH - spec.padding * 2 - 24;

    const cardW = (usableWidth - gap * (spec.cols - 1)) / spec.cols;
    const cardH = cardW * (532 / 424);
    const naturalGridH = rows * cardH + gap * (rows - 1);

    const scale = Math.min(1, (usableHeight / naturalGridH) * 0.995);

    if (scale < 1) {
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

    const tiles = await buildCardTilesUnified(data.uniqueList, data.countMap, spec);
    tiles.forEach(t => grid.appendChild(t));

    gridPanel.appendChild(gridHost);

    // ---- フッター（URL） ----
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.justifyContent = 'flex-end';
    footer.style.fontSize = '22px';
    footer.style.background = spec.theme.panelBg;
    footer.style.border = `1px solid ${spec.theme.panelEdge}`;
    footer.style.borderRadius = '12px';
    footer.style.padding = '8px 12px';
    footer.style.boxShadow = spec.theme.shadow;

    const brand = document.createElement('div');
    brand.textContent = BRAND_URL;
    brand.style.opacity = '.9';
    brand.style.color = spec.theme.subText;
    footer.appendChild(brand);

    // まとめ
    root.appendChild(header);
    root.appendChild(gridPanel);
    root.appendChild(footer);

    return root;
  }

  function badge(spec, emoji, text){
    const span = document.createElement('span');
    span.style.display = 'inline-flex';
    span.style.alignItems = 'center';
    span.style.gap = '8px';
    span.style.background = spec.theme.chipBg;
    span.style.border = `1px solid ${spec.theme.chipEdge}`;
    span.style.padding = '8px 12px';
    span.style.marginRight = '8px';
    span.style.borderRadius = '999px';
    span.style.fontSize = '20px';
    span.style.color = spec.theme.chipText;

    const hasText = (text !== undefined);
    const e = document.createElement('span'); e.textContent = hasText ? (emoji || '') : '';
    const t = document.createElement('span'); t.textContent = hasText ? text : (emoji || '');
    span.appendChild(e); span.appendChild(t);
    return span.outerHTML;
  }

  // 代表カードの角丸サムネ
  async function buildRepThumb(cd, spec){
    const h = Math.min((spec.aspect==='3:4'? 280:220), Math.floor(spec.headerH * 0.9));
    const wrap = document.createElement('div');
    wrap.style.height = h + 'px';
    wrap.style.aspectRatio = '424 / 532';
    wrap.style.borderRadius = '16px';
    wrap.style.overflow = 'hidden';
    wrap.style.background = '#fff';
    wrap.style.boxShadow = spec.theme.shadow;

    const img = await loadCardImageSafe(cd);
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    wrap.appendChild(img);
    return wrap;
  }

  // 各カード（角丸＋影＋重複バッジ）
  async function buildCardTilesUnified(uniqueList, countMap, spec){
    const out = [];
    for (let i=0; i<uniqueList.length; i++){
      const cd = String(uniqueList[i]);
      const wrap = document.createElement('div');
      wrap.style.position = 'relative';
      wrap.style.borderRadius = '12px';
      wrap.style.overflow = 'hidden';
      wrap.style.background = (spec.theme.panelBg.includes('linear-gradient') ? '#111' : '#fff');
      wrap.style.aspectRatio = '424 / 532';
      wrap.style.boxShadow = spec.theme.shadow;

      const img = await loadCardImageSafe(cd);
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      wrap.appendChild(img);

      const badgeDiv = document.createElement('div');
      badgeDiv.textContent = `×${countMap[cd]||1}`;
      Object.assign(badgeDiv.style, {
        position: 'absolute', right: '8px', top: '8px',
        background: spec.theme.badgeBg, color: '#fff', fontWeight: '900',
        padding: '10px 14px', borderRadius: '999px', fontSize: '30px',
        lineHeight: '1',
      });
      wrap.appendChild(badgeDiv);

      out.push(wrap);
    }
    return out;
  }

  // 安全な画像ロード
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
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    return Math.max(2, Math.min(3, dpr)); // 2〜3
  }

})();
