/*==================
      1.初期設定
===================*/
//#region
//カード呼び出し
window.addEventListener('DOMContentLoaded', () => {
  loadCards();
  setTimeout(() => window.__bindLongPressForCards?.('list'), 0);
});


//#endregion
/*====================
      2.一覧カード生成
===================*/

//#region

// 展開詳細生成（HTML文字列でOK）
function generateDetailHtml(card) {
  const typeClass = `type-${card.type}`;
  const raceClass = `race-${card.race}`;
  const detailId = `detail-${card.cd}`;

  const effectParts = [];

  if (card.effect_name1) {
    effectParts.push(`<div><strong class="effect-name">${card.effect_name1}</strong></div>`);
  }
  if (card.effect_text1) {
    effectParts.push(`<div>${card.effect_text1}</div>`);
  }
  if (card.effect_name2) {
    effectParts.push(`<div><strong class="effect-name">${card.effect_name2}</strong></div>`);
  }
  if (card.effect_text2) {
    effectParts.push(`<div>${card.effect_text2}</div>`);
  }

  const effectHtml = effectParts.join('\n');

  return `
    <div class="card-detail ${typeClass} ${raceClass}" data-name="${card.name}" id="${detailId}">
      <div class="card-name">${card.name}</div>
      <div class="card-meta card-pack">
      ${card.pack_name || ''}
      </div>
      <div class="card-meta">
        <span class="card-race">${card.race}</span> /
        <span class="card-category">${card.category}</span>
      </div>
      <div class="card-effect">
        ${effectHtml}
      </div>
    </div>
  `;
}


//#endregion




/*====================
      2.デッキ情報
====================*/


//#region
// デッキ内のカード枚数を管理するマップ
// キー: カードの cd（番号）、値: 枚数
const deckMap = {};


//#endregion

window.addEventListener('DOMContentLoaded', () => {
  loadCards();

  // owned-mark sync (card list)
  window.OwnedUI?.bind?.("#grid");

  setTimeout(() => window.__bindLongPressForCards?.('list'), 0);
});
