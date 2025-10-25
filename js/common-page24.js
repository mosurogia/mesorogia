

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
  const deckObj = window.deck || {};
  const total = Object.values(deckObj).reduce((a,b)=>a+(b|0),0);
  if (total === 0){ alert('デッキが空です。カードを追加してください。'); return; }
  if (total > 40){ alert('デッキ枚数が多すぎます（40枚以内にしてください）'); return; }

  const aspect = '3:4';

  const data  = buildDeckSummaryData();
  const kinds = data.uniqueList?.length || 0;
  const spec  = getCanvasSpec(aspect, kinds);
  spec.cols = 5;// 5列固定

  //先にローディングを出す
  const loader = showLoadingOverlay('画像生成中…');
  await nextFrame();  // 1フレーム分、描画を譲る
  await nextFrame();  // 端末によっては2回あるとより安定

  // 以降が重い：DOM構築＆画像ロード
  const node = await buildShareNode(data, spec);
  document.body.appendChild(node);


  try {
    await nextFrame(); await nextFrame();
    const scale = getPreferredScale();
      const target = node;  // 生成ノードを直接キャプチャ
      const prevOverflow = target.style.overflow;
      target.style.overflow = 'visible';
      target.style.paddingRight = '20px';
      target.style.paddingBottom = '20px';
      target.scrollTop = 0;

      const canvas = await html2canvas(target, {
        scale,
        useCORS: true,
        backgroundColor: '#fff',
        scrollX: 0,
        scrollY: 0,
        width:  target.scrollWidth,
        height: target.scrollHeight,
        windowWidth:  document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        x: 0,
        y: 0,
        allowTaint: false,
      });

      target.style.overflow = prevOverflow;



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
      deckName, total, mainRace,
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
    const HEADER_H_STD = 330;      // 標準ヘッダー高さ
    const FOOTER_H     = 84;

    // 使える横幅
    const usableW = WIDTH - PADDING*2 - GRID_PAD_SUM;
    // カード1枚の横幅（横余白ゼロで割り切り）
    const cardW   = (usableW - GAP*(COLS-1)) / COLS;
    const cardH   = cardW * CARD_AR;

    // 行数
    const rows    = Math.max(1, Math.ceil((kinds||0) / COLS));
    const rowsStd = 4; // 標準：20種＝4行

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

//タイプ枚数
function coloredChip(text, {bg, border, color='#0f172a', fz=30, pad='10px 14px'}){
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

// ① 数字だけを強調する小ユーティリティ
function strongNum(n){
  return `<span style="
    font-size:1.2em;
    font-weight:900;
    line-height:1;
    letter-spacing:.3px;
  ">${n}</span>`;
}

// ② HTMLで内容を渡せる“リッチ版”チップ
function chipRich(html, {bg, border, color='#0f172a', fz=30, pad='10px 14px'} = {}){
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
  span.style.fontVariantNumeric = 'tabular-nums'; // ← 等幅数字で読みやすく
  span.innerHTML = html;
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
    header.style.padding = '10px';
    header.style.boxShadow = spec.theme.shadow;

    const rep = await buildRepThumb(data.representativeCd, spec);

    const headRight = document.createElement('div');

    // 2列グリッド：左=タイプ/レア、右=枚数/種族
    headRight.style.display = 'grid';
    headRight.style.gridTemplateColumns = '1fr 220px';
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
      chipRich(`チャージャー ${strongNum(data.typeCounts['チャージャー']||0)}枚`, TYPE_BG['チャージャー']) +
      chipRich(`アタッカー ${strongNum(data.typeCounts['アタッカー']||0)}枚`,   TYPE_BG['アタッカー']) +
      chipRich(`ブロッカー ${strongNum(data.typeCounts['ブロッカー']||0)}枚`,   TYPE_BG['ブロッカー']);


    // 左列：レアリティ構成（2行：上＝レジェンド/ゴールド、下＝シルバー/ブロンズ）
    const r = data.rarityMap;

    const rarityWrap = document.createElement('div');
    rarityWrap.style.display = 'flex';
    rarityWrap.style.flexDirection = 'column';
    rarityWrap.style.gap = '4px'; // 行間少し

    // 上段（レジェンド＋ゴールド）
    const rowTop = document.createElement('div');
    rowTop.style.whiteSpace = 'nowrap';
    rowTop.innerHTML =
      badge(spec, '🌈', `レジェンド ${strongNum(r['レジェンド']||0)}枚`) + ' ' +
      badge(spec, '🟡', `ゴールド ${strongNum(r['ゴールド']||0)}枚`);

    // 下段（シルバー＋ブロンズ）
    const rowBottom = document.createElement('div');
    rowBottom.style.whiteSpace = 'nowrap';
    rowBottom.innerHTML =
      badge(spec, '⚪️', `シルバー ${strongNum(r['シルバー']||0)}枚`) + ' ' +
      badge(spec, '🟤', `ブロンズ ${strongNum(r['ブロンズ']||0)}枚`);

    rarityWrap.appendChild(rowTop);
    rarityWrap.appendChild(rowBottom);

    // ← この rarityWrap をヘッダーの左下セルとして使用
    rarityWrap.style.gridColumn = '1 / 2';


    // 右列：デッキ枚数（大きめチップ）
    const rightRow1 = document.createElement('div');
    rightRow1.style.display = 'flex';
    rightRow1.style.justifyContent = 'flex-end';
    rightRow1.innerHTML = chipRich(
      `📘 ${strongNum(data.total)} <span style="opacity:.75">/ 30</span>`,
      {
        bg:'rgba(2,6,23,0.04)',
        border:'rgba(2,6,23,0.10)',
        fz:30,
        pad:'12px 16px'
      }
    );


    // 右列：メイン種族（背景色で表現）
    const rightRow2 = document.createElement('div');
    rightRow2.style.display = 'flex';
    rightRow2.style.justifyContent = 'flex-end';
    const raceBg = RACE_BG[data.mainRace] || 'rgba(2,6,23,0.04)';
    rightRow2.innerHTML = coloredChip(`${data.mainRace}`, { bg: raceBg, border:'rgba(2,6,23,0.10)', fz:30, pad:'12px 16px' });

    // 配置
    // 1行目：タイトル（2列）
    headRight.appendChild(title);
    // 2行目：左=タイプ、右=枚数
    leftRow1.style.gridColumn = '1 / 2';
    rightRow1.style.gridColumn = '2 / 3';
    headRight.appendChild(leftRow1);
    headRight.appendChild(rightRow1);
    // 3行目：左=レア、右=種族
    rightRow2.style.gridColumn = '2 / 3';
    headRight.appendChild(rarityWrap);
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
    grid.append(...tiles);

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
    span.style.fontSize = '30px';
    span.style.color = spec.theme.chipText;
    span.style.fontWeight = '700';

    const hasText = (text !== undefined);
    const e = document.createElement('span'); e.textContent = hasText ? (emoji || '') : '';
    const t = document.createElement('span');
    t.innerHTML = hasText ? text : (emoji || '');
    t.style.fontVariantNumeric = 'tabular-nums';
    span.appendChild(e);
    span.appendChild(t);
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
    const imgs = await Promise.all(uniqueList.map(cd => loadCardImageSafe(cd)));
    for (let i=0; i<uniqueList.length; i++){
      const cd = String(uniqueList[i]);
      const img = imgs[i];
      const wrap = document.createElement('div');
      wrap.style.position = 'relative';
      wrap.style.borderRadius = '12px';
      wrap.style.overflow = 'hidden';
      wrap.style.background = (spec.theme.panelBg.includes('linear-gradient') ? '#111' : '#fff');
      wrap.style.aspectRatio = '424 / 532';
      wrap.style.boxShadow = spec.theme.shadow;

      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      wrap.appendChild(img);

      const badgeDiv = document.createElement('div');
      badgeDiv.textContent = `×${countMap[cd]||1}`;
      Object.assign(badgeDiv.style, {
        position: 'absolute', right: '8px', top: '8px',
        background: spec.theme.badgeBg, color: '#fff', fontWeight: '900',
        padding: '10px 14px', borderRadius: '999px', fontSize: '40px',
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
  // Base64化（iPad/Safari対策：blobだと保存できない）
  const dataUrl = canvas.toDataURL('image/png');

  // 既に開いてたら消す
  document.getElementById('deckimg-preview-modal')?.remove();

  // モーダル本体
  const modal = document.createElement('div');
  modal.id = 'deckimg-preview-modal';
  Object.assign(modal.style, {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'flex-start',
    overflowY: 'auto',
    padding: '40px 0',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
  });

  // 🔹 背景スクロール抑制
  document.body.style.overflow = 'hidden';

  // 閉じるボタン
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(255,255,255,0.9)',
    color: '#111',
    border: 'none',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    fontSize: '22px',
    fontWeight: '700',
    lineHeight: '1',
    cursor: 'pointer',
    boxShadow: '0 0 6px rgba(0,0,0,0.3)',
  });
  closeBtn.addEventListener('click', () => {
    modal.remove();
    document.body.style.overflow = ''; // 🔹 背景スクロール再許可
  });
  modal.appendChild(closeBtn);

  // 操作バー（保存案内）
  const bar = document.createElement('div');
  Object.assign(bar.style, {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: 'clamp(14px, 2vw, 18px)',
    textAlign: 'center',
  });

  const hint = document.createElement('div');
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua))
    hint.textContent = '長押しで「写真に追加」や「共有」ができます';
  else if (/android/.test(ua))
    hint.textContent = '長押しで「画像をダウンロード」や「共有」ができます';
  else
    hint.textContent = '右クリックで「名前を付けて保存」できます';
  bar.appendChild(hint);

  // 画像と同じ幅のボタンバー（画像の“上”に置く）
    const btnBar = document.createElement('div');
    Object.assign(btnBar.style, {
      width: 'min(80vw, 500px)',   // ★ 画像と同じ幅
      maxWidth: 'min(80vw, 500px)',
      display: 'flex',
      gap: '8px',
      margin: '8px auto 12px',     // 上部少し空けて画像の直前に
    });

    // ボタン共通スタイル
    const mkBtn = (label) => {
      const el = document.createElement('a');
      el.textContent = label;
      Object.assign(el.style, {
        flex: '1 1 0',             // ★ 2つで横幅を等分
        display: 'inline-block',
        textAlign: 'center',
        textDecoration: 'none',
        background: '#fff',
        color: '#111',
        padding: '10px 12px',
        borderRadius: '10px',
        fontWeight: '800',
        fontSize: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,.25)',
      });
      return el;
    };

    // 保存（どの端末でも確実に使える）
    const saveBtn = mkBtn('保存');
    saveBtn.href = dataUrl;          // ★ toDataURL をそのまま
    saveBtn.download = fileName;     // PC なら即保存、モバイルは新規DL

    // 共有（対応端末のみ表示）
    const shareBtn = mkBtn('共有');
    if (navigator.share) {
      shareBtn.href = 'javascript:void(0)';
      shareBtn.onclick = async () => {
        try {
          const b = await (await fetch(dataUrl)).blob();
          const f = new File([b], fileName, { type: 'image/png' });
          await navigator.share({ files: [f], title: fileName, text: 'デッキ画像' });
        } catch (_) { /* キャンセルは無視 */ }
      };
    } else {
      shareBtn.style.display = 'none'; // 未対応環境では非表示（保存ボタンが全幅に）
    }

        btnBar.appendChild(saveBtn);
        btnBar.appendChild(shareBtn);
        modal.appendChild(bar);
        modal.appendChild(btnBar);

      // 画像
      const img = document.createElement('img');
      img.src = dataUrl;
      Object.assign(img.style, {
        maxWidth: 'min(80vw, 500px)',
        height: 'auto',
        borderRadius: '12px',
        boxShadow: '0 0 24px rgba(0,0,0,0.6)',
        objectFit: 'contain',
      });

      // 🔹 背景クリックで閉じる（×ボタンと同処理）
      modal.addEventListener('click', e => {
        if (e.target === modal && e.clientY < window.innerHeight * 0.9) {
          modal.remove();
          document.body.style.overflow = '';
        }
      });

      modal.appendChild(img);
  document.body.appendChild(modal);
}




  function getPreferredScale(){
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    return Math.max(2, Math.min(3, dpr)); // 2〜3
  }

})();
