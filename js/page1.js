// 一覧カード生成
function generateCardListElement(card) {
  const cardDiv = document.createElement('div');
  cardDiv.classList.add('card');

  cardDiv.setAttribute('data-cd', card.cd);
  cardDiv.setAttribute('data-race', card.race);
  cardDiv.setAttribute('data-category', card.category);
  cardDiv.setAttribute('data-rarity', card.rarity);
  cardDiv.setAttribute('data-type', card.type);
  cardDiv.setAttribute('data-cost', card.cost);
  cardDiv.setAttribute('data-power', card.power);
  cardDiv.setAttribute('data-pack', card.pack_name);
  cardDiv.setAttribute('data-effect', [card.effect_name1, card.effect_name2].filter(Boolean).join(','));
  cardDiv.setAttribute('data-field', card.field);
  cardDiv.setAttribute('data-ability', card.special_ability);
  cardDiv.setAttribute('data-bp', String(card.BP_flag ?? "").toLowerCase());
  cardDiv.setAttribute('data-draw', String(card.draw ?? "").toLowerCase());
  cardDiv.setAttribute('data-graveyard_Recovery', String(card.graveyard_recovery ?? "").toLowerCase());
  cardDiv.setAttribute('data-cardsearch', String(card.cardsearch ?? "").toLowerCase());
  cardDiv.setAttribute('data-destroy_Opponent', String(card.destroy_opponent ?? "").toLowerCase());
  cardDiv.setAttribute('data-destroy_Self', String(card.destroy_self ?? "").toLowerCase());

  // 🔍 展開用クリックイベント（カード全体）
  cardDiv.setAttribute('onclick', 'handleZoomClick(event, this)');

  // 画像
  const img = document.createElement('img');
  img.alt = card.name;
  img.loading = 'lazy';
  img.src = `img/${card.cd}.webp`;

  cardDiv.appendChild(img);


  return cardDiv;
}



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
