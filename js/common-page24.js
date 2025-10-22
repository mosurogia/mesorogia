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

  const VALID_ASPECTS = new Set(['3:4']);

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
  const deckObj = window.deck || {};
  const total = Object.values(deckObj).reduce((a,b)=>a+(b|0),0);
  if (total === 0){ alert('デッキが空です。カードを追加してください。'); return; }
  if (total > 40){ alert('デッキ枚数が多すぎます（40枚以内にしてください）'); return; }

  const aspect = '3:4';                        // 縦固定
  window.DeckImg?.setAspect?.('3:4');
  const data = buildDeckSummaryData();

  // ← ここがポイント：カード種類数から“ちょうど収まる高さ”を決める
  const kinds = data.uniqueList?.length || 0;
  const spec  = getCanvasSpec(aspect, kinds);  // ★ 引数に kinds を渡す

  spec.cols = 5;                                // 5列固定

  const node = await buildShareNode(data, spec);
  document.body.appendChild(node);

  const loader = showLoadingOverlay('画像生成中…');

  try {
    await nextFrame(); // 1回でOK
    const scale = getPreferredScale();
    const canvas = await html2canvas(node, {
      backgroundColor: null, // DOMグラデをそのまま撮る
      scale,
      useCORS: true,
      logging: false,
    });

    const name = (data.deckName || 'deck').replace(/[\/:*?"<>|]+/g,'_').slice(0,40);
    const fileName = `${name}_3x4.png`;
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
  function getCanvasSpec(aspect, kinds){
    // ---- 基本定数（縦固定・5列）----
    const WIDTH        = 1350;     // 横幅（固定）
    const PADDING      = 24;       // 外枠パディング
    const GRID_PAD_SUM = 24;       // グリッドパネル内の左右合計パディング（12px×2）
    const COLS         = 5;
    const GAP          = 12;       // カード間の隙間
    const CARD_AR      = 532/424;  // カード縦横比（縦/横）

    // ヘッダー/フッター（基準）
    const HEADER_H_STD = 320;      // 標準ヘッダー高さ
    const FOOTER_H     = 84;

    // 使える横幅
    const usableW = WIDTH - PADDING*2 - GRID_PAD_SUM;
    // カード1枚の横幅（横余白ゼロで割り切り）
    const cardW   = (usableW - GAP*(COLS-1)) / COLS;
    const cardH   = cardW * CARD_AR;

    // 行数
    const rows    = Math.max(1, Math.ceil((kinds||0) / COLS));
    const rowsStd = 4;                       // ★標準：20種＝4行

    // グリッドの高さ（行数ぶんぴったり）
    const gridH   = rows * cardH + GAP * (rows - 1);

    // ヘッダーのタイトルサイズを行数に応じて微調整
    // 4行なら 60px、1行多いごとに 2px ずつ小さく（下限48）
    const titleSize = Math.max(48, 60 - Math.max(0, rows - rowsStd) * 2);

    // 最終高さ：上下パディング＋ヘッダー＋グリッド＋フッター＋パネル余白
const height = PADDING + HEADER_H_STD + gridH + FOOTER_H + GRID_PAD_SUM;

    const theme = resolveTheme(); // スタイリッシュ薄色グラデ

    return {
      aspect,
      width: WIDTH,
      height,
      padding: PADDING,
      cols: COLS,
      headerH: HEADER_H_STD,
      footerH: FOOTER_H,
      gap: GAP,
      cardW, cardH, rows, // デバッグ・将来調整用
      titleSize,
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

// タイプごとの淡色背景
const TYPE_BG = {
  'チャージャー': { bg:'rgba(119, 170, 212, .2)', border:'rgba(119, 170, 212, .4)' },
  'アタッカー'  : { bg:'rgba(125,  91, 155, .2)', border:'rgba(125,  91, 155, .4)' },
  'ブロッカー'  : { bg:'rgba(214, 212, 204, .5)', border:'rgba(214, 212, 204, .8)' },
};

// メイン種族背景色
const RACE_BG = {
  'ドラゴン'   : 'rgba(255, 100, 100, 0.16)',
  'アンドロイド': 'rgba(100, 200, 255, 0.16)',
  'エレメンタル': 'rgba(100, 255, 150, 0.16)',
  'ルミナス'   : 'rgba(255, 250, 150, 0.16)',
  'シェイド'   : 'rgba(200, 150, 255, 0.16)',
};

function coloredChip(text, {bg, border, color='#0f172a', fz=22, pad='10px 14px'}){
  const span = document.createElement('span');
  span.style.display = 'inline-flex';
  span.style.alignItems = 'center';
  span.style.gap = '8px';
  span.style.background = bg || 'rgba(2,6,23,0.04)';
  span.style.border = `1px solid ${border || 'rgba(2,6,23,0.10)'}`;
  span.style.padding = pad;
  span.style.marginRight = '10px';
  span.style.borderRadius = '999px';
  span.style.fontSize = `${fz}px`;
  span.style.color = color;
  span.style.fontWeight = '700';
  span.textContent = text;
  return span.outerHTML;
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
      gridTemplateRows: `${spec.headerH}px auto ${spec.footerH}px`,
      gap: '6px',
    });

    // ---- ヘッダー ----
    const header = document.createElement('div');
    header.style.display = 'grid';
    header.style.gridTemplateColumns = (spec.aspect==='3:4' ? '240px 1fr' : '220px 1fr');
    header.style.gap = '10px';
    header.style.alignItems = 'center';
    header.style.background = spec.theme.panelBg;
    header.style.border = `1px solid ${spec.theme.panelEdge}`;
    header.style.borderRadius = '16px';
    header.style.padding = '16px';
    header.style.boxShadow = spec.theme.shadow;

    const rep = await buildRepThumb(data.representativeCd, spec);

    const headRight = document.createElement('div');

    // 2列グリッド：左=タイプ/レア、右=枚数/種族
    headRight.style.display = 'grid';
    headRight.style.gridTemplateColumns = '1fr 180px';
    headRight.style.gridTemplateRows = 'min-content min-content min-content';
    headRight.style.columnGap = '18px';
    headRight.style.rowGap = '0';
    headRight.style.alignItems = 'center'; // 各セル内は中央寄せ
    headRight.style.alignContent = 'space-evenly';// 3行を上下含め均等配分
    headRight.style.height = '100%';  // 親の高さにフィット
    headRight.style.alignSelf = 'stretch';  // 自身も伸ばす

    // タイトル
    const title = document.createElement('div');
    title.textContent = data.deckName || 'デッキ';
    Object.assign(title.style, {
      gridColumn: '1 / -1', // タイトルは2列ぶち抜き
      fontSize: `${spec.titleSize}px`,
      fontWeight: '900',
      letterSpacing: '.4px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      color: spec.theme.text,
    });

    // 左列：タイプ構成（絵文字を無くし色チップに）
    const leftRow1 = document.createElement('div');
    leftRow1.style.whiteSpace = 'nowrap';
    leftRow1.innerHTML =
      coloredChip(`チャージャー ${data.typeCounts['チャージャー']||0}枚`, TYPE_BG['チャージャー']) +
      coloredChip(`アタッカー ${data.typeCounts['アタッカー']||0}枚`, TYPE_BG['アタッカー']) +
      coloredChip(`ブロッカー ${data.typeCounts['ブロッカー']||0}枚`, TYPE_BG['ブロッカー']);

    // 左列：レアリティ構成（従来チップのままでもOK）
    const r = data.rarityMap;
    const leftRow2 = document.createElement('div');
    leftRow2.style.whiteSpace = 'nowrap';
    leftRow2.innerHTML =
      badge(spec, '🌈', `レジェンド ${r['レジェンド']||0}枚`) + ' ' +
      badge(spec, '🟡', `ゴールド ${r['ゴールド']||0}枚`)   + ' '+
      badge(spec, '⚪️', `シルバー ${r['シルバー']||0}枚`)  + ' ' +
      badge(spec, '🟤', `ブロンズ ${r['ブロンズ']||0}枚`);

    // 右列：デッキ枚数（大きめチップ）
    const rightRow1 = document.createElement('div');
    rightRow1.style.display = 'flex';
    rightRow1.style.justifyContent = 'flex-end';
    rightRow1.innerHTML = coloredChip(`📘${data.total} / 30`, {
    bg:'rgba(2,6,23,0.04)',
    border:'rgba(2,6,23,0.10)',
    fz:24,
    pad:'12px 16px'
    });


    // 右列：メイン種族（背景色で表現）
    const rightRow2 = document.createElement('div');
    rightRow2.style.display = 'flex';
    rightRow2.style.justifyContent = 'flex-end';
    const raceBg = RACE_BG[data.mainRace] || 'rgba(2,6,23,0.04)';
    rightRow2.innerHTML = coloredChip(`${data.mainRace}`, { bg: raceBg, border:'rgba(2,6,23,0.10)', fz:24, pad:'12px 16px' });

    // 配置
    // 1行目：タイトル（2列）
    headRight.appendChild(title);
    // 2行目：左=タイプ、右=枚数
    leftRow1.style.gridColumn = '1 / 2';
    rightRow1.style.gridColumn = '2 / 3';
    headRight.appendChild(leftRow1);
    headRight.appendChild(rightRow1);
    // 3行目：左=レア、右=種族
    leftRow2.style.gridColumn = '1 / 2';
    rightRow2.style.gridColumn = '2 / 3';
    headRight.appendChild(leftRow2);
    headRight.appendChild(rightRow2);

    // 既存の append
    header.appendChild(rep);
    header.appendChild(headRight);


    // ---- グリッド（カード一覧） ----
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${spec.cols}, 1fr)`;
    grid.style.gap = spec.gap + 'px';
    grid.style.alignContent = 'start';

    // パネル
    const gridPanel = document.createElement('div');
    gridPanel.style.background = spec.theme.panelBg;
    gridPanel.style.border = `1px solid ${spec.theme.panelEdge}`;
    gridPanel.style.borderRadius = '16px';
    gridPanel.style.padding = '12px';
    gridPanel.style.boxShadow = spec.theme.shadow;

    // タイル生成
    const tiles = await buildCardTilesUnified(data.uniqueList, data.countMap, spec);
    tiles.forEach(t => grid.appendChild(t));

    // そのまま入れる（スケールやラップなし）
    gridPanel.appendChild(grid);


    // ---- フッター（URL） ----
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.justifyContent = 'flex-end';
    footer.style.fontSize = '24px';
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
    span.style.fontSize = '24px';
    span.style.color = spec.theme.chipText;
    span.style.fontWeight = '700';

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
    const url = URL.createObjectURL(blob);

    // 📱💡 生成後に新しいタブで画像を開く
    const newTab = window.open(url, '_blank');
    if (!newTab) {
      alert('画像を開けませんでした。ポップアップブロックを解除してください。');
      URL.revokeObjectURL(url);
      return;
    }

    // メモリ解放（10秒後）
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, 'image/png', 1.0);
}


  function getPreferredScale(){
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    return Math.max(2, Math.min(3, dpr)); // 2〜3
  }

})();
