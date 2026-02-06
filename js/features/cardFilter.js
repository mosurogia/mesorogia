/*==================================================
  CARD FILTER / カード一覧フィルター（UI生成＋適用）
  - filterModal / main-filters / detail-filters が存在するページだけ動作
  - グリッド/リスト切替（#grid.is-list）にも対応
==================================================*/

(function () {
    'use strict';

    // -----------------------
    // 表示用ラベル
    // -----------------------
    const DISPLAY_LABELS = {
        true: 'BPあり',
        false: 'BPなし',

        draw: 'ドロー',
        graveyard_recovery: '墓地回収',
        cardsearch: 'サーチ',
        destroy_opponent: '相手破壊',
        destroy_self: '自己破壊',
        heal: '回復',
        power_up: 'バフ',
        power_down: 'デバフ',
    };
    window.DISPLAY_LABELS = DISPLAY_LABELS;

    // -----------------------
    // Safe owned reader（無ければフォールバック）
    // ※ owned.js 側に同名があるならそっちが優先される
    // -----------------------
    function readOwnedDataSafe() {
        try {
        if (window.readOwnedDataSafe) return window.readOwnedDataSafe();
        } catch {}

        // OwnedStore 優先
        try {
        if (window.OwnedStore?.getAll) {
            const s = window.OwnedStore.getAll();
            if (s && typeof s === 'object') return s;
        }
        } catch {}

        // localStorage フォールバック
        try {
        const raw = localStorage.getItem('ownedCards');
        const obj = raw ? JSON.parse(raw) : {};
        if (obj && typeof obj === 'object') return obj;
        } catch {}

        return {};
    }

    // -----------------------
    // debounce
    // -----------------------
    function debounce(fn, ms = 300) {
        let t = 0;
        return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
        };
    }

    // ==============================
    // UI生成ヘルパ
    // ==============================
    function createFilterBlock_(titleText) {
        const wrapper = document.createElement('div');
        wrapper.className = 'filter-block';

        const strong = document.createElement('strong');
        strong.className = 'filter-title';
        strong.textContent = titleText;

        wrapper.appendChild(strong);
        return { wrapper, titleEl: strong };
    }

    function createButtonGroup_(title, list, filterKey) {
        const { wrapper } = createFilterBlock_(title);

        const groupDiv = document.createElement('div');
        groupDiv.className = 'filter-group';
        groupDiv.dataset.key = title;

        list.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-btn';
        btn.dataset[filterKey] = item;

        // is-ring 付与ルール
        if (filterKey === 'race' && item !== '旧神') btn.classList.add('is-ring');
        if (filterKey === 'category') btn.classList.add('is-ring');

        // カテゴリ枠線色用（data-cat-race）
        if (filterKey === 'category' && typeof window.getCategoryRace === 'function') {
            const r = window.getCategoryRace(item);
            btn.dataset.catRace = r || 'none';
        }

        // 表示（カテゴリだけ改行）
        if (filterKey === 'category' && String(item).includes('（')) {
            btn.innerHTML = String(item).replace('（', '<br>（');
        } else {
            btn.textContent =
            (window.DISPLAY_LABELS && window.DISPLAY_LABELS[item] != null)
                ? window.DISPLAY_LABELS[item]
                : item;
        }

        groupDiv.appendChild(btn);
        });

        wrapper.appendChild(groupDiv);
        return wrapper;
    }

    // 2択/複数の横並び（タイプ・レア・BP・特殊効果など）
    function createRangeStyleWrapper_(title, list, filterKey) {
        const wrapper = document.createElement('div');
        wrapper.className = 'filter-block filter-range-wrapper';

        const strong = document.createElement('strong');
        strong.className = 'filter-title';
        strong.textContent = title;
        wrapper.appendChild(strong);

        const groupDiv = document.createElement('div');
        groupDiv.className = 'filter-group';
        groupDiv.dataset.key = title;

        list.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-btn';
        btn.dataset[filterKey] = item;

        btn.textContent =
            (window.DISPLAY_LABELS && window.DISPLAY_LABELS[item] != null)
            ? window.DISPLAY_LABELS[item]
            : item;

        groupDiv.appendChild(btn);
        });

        wrapper.appendChild(groupDiv);
        return wrapper;
    }

    // 範囲セレクタ（コスト/パワー）
    function createRangeSelector_(title, filterKey, list, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'filter-block filter-range-wrapper';

        const strong = document.createElement('strong');
        strong.className = 'filter-title';
        strong.textContent = title;
        wrapper.appendChild(strong);

        const groupDiv = document.createElement('div');
        groupDiv.className = 'filter-group';
        groupDiv.dataset.key = title;

        const selectMin = document.createElement('select');
        const selectMax = document.createElement('select');
        selectMin.id = `${filterKey}-min`;
        selectMax.id = `${filterKey}-max`;

        const minOptions = [...list];
        const maxOptions = [...list, '上限なし'];

        minOptions.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        if (v === 0) o.selected = true;
        selectMin.appendChild(o);
        });

        maxOptions.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        if (v === '上限なし') o.selected = true;
        selectMax.appendChild(o);
        });

        groupDiv.appendChild(selectMin);

        const wave = document.createElement('span');
        wave.className = 'tilde';
        wave.textContent = '～';
        groupDiv.appendChild(wave);

        groupDiv.appendChild(selectMax);
        wrapper.appendChild(groupDiv);

        selectMin.addEventListener('change', onChange);
        selectMax.addEventListener('change', onChange);

        return wrapper;
    }

    // ==============================
    // モーダル制御
    // ==============================
    function openFilterModal() {
        const m = document.getElementById('filterModal');
        if (m) m.style.display = 'flex';
    }
    function closeFilterModal() {
        const m = document.getElementById('filterModal');
        if (m) m.style.display = 'none';
    }
    function toggleDetailFilters() {
        const detail = document.getElementById('detail-filters');
        if (!detail) return;
        detail.style.display = (detail.style.display === 'none') ? 'block' : 'none';
    }

    // ==============================
    // フィルターUI生成
    // ==============================
    async function generateFilterUI() {
        const cards = await window.fetchLatestCards?.();
        if (!Array.isArray(cards)) return;

        const mainFilters = document.getElementById('main-filters');
        const detailFilters = document.getElementById('detail-filters');
        if (!mainFilters || !detailFilters) return;

        mainFilters.innerHTML = '';
        detailFilters.innerHTML = '';

        const getUniqueValues = (key) =>
        [...new Set(cards.map(card => card[key]).filter(Boolean))];

        // カテゴリ順（Excel「リスト集」順）
        const catOrder = (typeof window.getCategoryOrder === 'function')
        ? window.getCategoryOrder
        : ((_) => 9999);

        const categories = getUniqueValues('category').sort((a, b) => catOrder(a) - catOrder(b));
        const races = getUniqueValues('race');
        const costs = [...new Set(cards.map(c => parseInt(c.cost)).filter(Number.isFinite))].sort((a, b) => a - b);
        const powers = [...new Set(cards.map(c => parseInt(c.power)).filter(Number.isFinite))].sort((a, b) => a - b);

        const types = ['チャージャー', 'アタッカー', 'ブロッカー'];
        const rarities = ['レジェンド', 'ゴールド', 'シルバー', 'ブロンズ'];

        // ---- パック（英名＋仮名）----
        let packCatalog = null;
        try { packCatalog = await window.loadPackCatalog?.(); } catch {}
        window.__PACK_EN_TO_JP = window.__PACK_EN_TO_JP || {};

        const packWrapper = document.createElement('div');
        packWrapper.className = 'filter-block';

        const packTitle = document.createElement('strong');
        packTitle.className = 'filter-title';
        packTitle.textContent = 'パック名';
        packWrapper.appendChild(packTitle);

        const packGroup = document.createElement('div');
        packGroup.className = 'filter-group';
        packGroup.dataset.key = 'パック名';

        const addPackBtn = (en, jp) => {
        if (!en) return;
        window.__PACK_EN_TO_JP[en] = jp || '';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-btn is-ring';
        btn.dataset.pack = en;
        btn.innerHTML = `<span class="pack-en">${en}</span><br><small class="pack-kana">${jp || ''}</small>`;
        packGroup.appendChild(btn);
        };

        if (packCatalog && Array.isArray(packCatalog.list)) {
        packCatalog.list.forEach(p => addPackBtn(p.en || '', p.jp || ''));
        } else {
        const packsRaw = getUniqueValues('pack_name');
        const splitPackLabel = (s) => {
            const m = String(s || '').match(/^([^「]+)(?:「([^」]*)」)?/);
            return { en: (m?.[1] || '').trim(), jp: (m?.[2] || '').trim() };
        };
        const uniq = [...new Map(packsRaw.map(n => {
            const sp = splitPackLabel(n);
            return [sp.en, sp];
        })).values()].sort((a, b) => a.en.localeCompare(b.en, 'en'));
        uniq.forEach(sp => addPackBtn(sp.en, sp.jp));
        }

        packWrapper.appendChild(packGroup);

        // ---- 詳細 ----
        const effect_name = [...new Set(
        cards.flatMap(card => [card.effect_name1, card.effect_name2]).filter(Boolean)
        )].sort();

        const FIELD_DISPLAY = {
        'フィールド関係なし': 'フィールド関係なし',
        'ドラゴンフィールド': 'ドラゴン',
        'アンドロイドフィールド': 'アンドロイド',
        'エレメンタルフィールド': 'エレメンタル',
        'ルミナスフィールド': 'ルミナス',
        'シェイドフィールド': 'シェイド',
        'ノーマルフィールド': 'ノーマル',
        };

        const SPECIAL_ABILITIES = ['特殊効果未所持', '燃焼', '拘束', '沈黙'];
        const OTHER_BOOLEAN_KEYS = [
        'draw', 'cardsearch', 'graveyard_recovery', 'destroy_opponent', 'destroy_self',
        'heal', 'power_up', 'power_down'
        ];

        // ---- メイン ----
        mainFilters.appendChild(createRangeStyleWrapper_('タイプ', types, 'type'));
        mainFilters.appendChild(createRangeStyleWrapper_('レアリティ', rarities, 'rarity'));
        mainFilters.appendChild(packWrapper);
        mainFilters.appendChild(createButtonGroup_('種族', races, 'race'));
        mainFilters.appendChild(createButtonGroup_('カテゴリ', categories, 'category'));
        mainFilters.appendChild(createRangeSelector_('コスト', 'cost', costs, () => applyFilters()));
        mainFilters.appendChild(createRangeSelector_('パワー', 'power', powers, () => applyFilters()));

        // ---- 詳細 ----
        detailFilters.appendChild(createButtonGroup_('効果名', effect_name, 'effect'));

        // フィールド：表示名短縮
        const fieldKeys = Object.keys(FIELD_DISPLAY);
        const fieldWrapper = createButtonGroup_('フィールド', fieldKeys, 'field');
        fieldWrapper.querySelectorAll('.filter-btn').forEach(btn => {
        const val = btn.dataset.field;
        btn.textContent = FIELD_DISPLAY[val] ?? val;
        });
        detailFilters.appendChild(fieldWrapper);

        detailFilters.appendChild(createRangeStyleWrapper_('BP（ブレッシングポイント）要素', ['true', 'false'], 'bp'));
        detailFilters.appendChild(createRangeStyleWrapper_('特殊効果', SPECIAL_ABILITIES, 'ability'));

        // その他（boolean）
        const otherWrap = document.createElement('div');
        otherWrap.className = 'filter-block filter-range-wrapper';

        const otherTitle = document.createElement('strong');
        otherTitle.className = 'filter-title';
        otherTitle.textContent = 'その他';
        otherWrap.appendChild(otherTitle);

        const otherGroup = document.createElement('div');
        otherGroup.className = 'filter-group';
        otherGroup.dataset.key = 'その他';

        OTHER_BOOLEAN_KEYS.forEach(key => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-btn';
        btn.dataset[key] = 'true';
        btn.textContent = DISPLAY_LABELS[key] ?? key;
        otherGroup.appendChild(btn);
        });

        otherWrap.appendChild(otherGroup);
        detailFilters.appendChild(otherWrap);

        // サブタイトル（1回だけ）
        const df = document.getElementById('detail-filters');
        if (df && !document.querySelector('.filter-subtitle')) {
        const h = document.createElement('h4');
        h.className = 'filter-subtitle';
        h.textContent = 'さらに詳しい条件フィルター';
        df.parentNode.insertBefore(h, df);
        }
    }

    // ==============================
    // チップバー
    // ==============================
    function updateChipsOffset() {
        const parts = [
        // document.querySelector('.search-bar'),
        // document.querySelector('.main-header'),
        // document.querySelector('.subtab-bar'),
        ].filter(Boolean);

        const sum = parts.reduce((h, el) => h + el.offsetHeight, 0);
        document.documentElement.style.setProperty('--chips-offset', `${sum}px`);
    }

    // アクティブチップ表示
    function renderActiveFilterChips() {
        const grid = document.getElementById('grid');
        if (!grid) return;

        let bar = document.getElementById('active-chips-bar');
        if (!bar) {
        bar = document.createElement('div');
        bar.id = 'active-chips-bar';
        const sc = document.createElement('div');
        sc.className = 'chips-scroll';
        bar.appendChild(sc);
        const sb = document.querySelector('.search-bar');
        if (sb && sb.parentNode) sb.insertAdjacentElement('afterend', bar);
        else grid.parentNode.insertBefore(bar, grid);
        }

        const scroll = bar.querySelector('.chips-scroll');
        scroll.innerHTML = '';

        const chips = [];

        // キーワード
        const kwEl = document.getElementById('keyword');
        const kw = (kwEl?.value || '').trim();
        if (kw) chips.push({ label: `検索:${kw}`, onRemove: () => { kwEl.value = ''; applyFilters(); } });

        // 範囲
        const cminEl = document.getElementById('cost-min');
        const cmaxEl = document.getElementById('cost-max');
        const pminEl = document.getElementById('power-min');
        const pmaxEl = document.getElementById('power-max');

        const cmin = cminEl?.value, cmax = cmaxEl?.value;
        const pmin = pminEl?.value, pmax = pmaxEl?.value;

        if (cminEl && cmaxEl) {
        const isDefault = (cmin | 0) === (cminEl.options[0]?.value | 0) && cmax === '上限なし';
        if (!isDefault) chips.push({
            label: `コスト:${cmin}–${cmax === '上限なし' ? '∞' : cmax}`,
            onRemove: () => { cminEl.selectedIndex = 0; cmaxEl.selectedIndex = cmaxEl.options.length - 1; applyFilters(); }
        });
        }
        if (pminEl && pmaxEl) {
        const isDefault = (pmin | 0) === (pminEl.options[0]?.value | 0) && pmax === '上限なし';
        if (!isDefault) chips.push({
            label: `パワー:${pmin}–${pmax === '上限なし' ? '∞' : pmax}`,
            onRemove: () => { pminEl.selectedIndex = 0; pmaxEl.selectedIndex = pmaxEl.options.length - 1; applyFilters(); }
        });
        }

        // ボタン系
        const GROUPS = [
        ['種族', 'race'], ['カテゴリ', 'category'],
        // ✅ ['タイプ', 'type'] は削除（チップバーに出さない）
        ['レア', 'rarity'], ['パック', 'pack'],
        ['効果名', 'effect'], ['フィールド', 'field'],
        ['BP', 'bp'], ['特効', 'ability'],
        ['その他', 'draw'], ['その他', 'cardsearch'], ['その他', 'graveyard_recovery'],
        ['その他', 'destroy_opponent'], ['その他', 'destroy_self'],
        ['その他', 'heal'], ['その他', 'power_up'], ['その他', 'power_down'],
        ];

        GROUPS.forEach(([title, key]) => {
        document.querySelectorAll(`.filter-btn.selected[data-${key}]`).forEach(btn => {
            const val = btn.dataset[key];
            let labelText;

            if (key === 'pack') {
            const jp = (window.__PACK_EN_TO_JP && window.__PACK_EN_TO_JP[val]) || '';
            labelText = jp ? `${val} / ${jp}` : val;
            } else if (['draw', 'cardsearch', 'graveyard_recovery', 'destroy_opponent', 'destroy_self', 'heal', 'power_up', 'power_down'].includes(key)) {
            labelText = DISPLAY_LABELS[key] ?? key;
            } else {
            labelText = (DISPLAY_LABELS && DISPLAY_LABELS[val] != null) ? DISPLAY_LABELS[val] : val;
            }

            chips.push({
            label: `${title}:${labelText}`,
            onRemove: () => { btn.classList.remove('selected'); applyFilters(); }
            });
        });
        });

        chips.forEach(({ label, onRemove }) => {
        const chip = document.createElement('span');
        chip.className = 'chip-mini';
        chip.textContent = label;

        const x = document.createElement('button');
        x.className = 'x';
        x.type = 'button';
        x.textContent = '×';
        x.addEventListener('click', (e) => { e.stopPropagation(); onRemove(); });
        chip.appendChild(x);

        scroll.appendChild(chip);
        });

        // 全解除
        if (chips.length) {
        const clr = document.createElement('span');
        clr.className = 'chip-mini chip-clear';
        clr.textContent = 'すべて解除';
        clr.addEventListener('click', () => resetFilters());
        scroll.appendChild(clr);
        }

        bar.style.display = chips.length ? '' : 'none';
    }

    // ==============================
    // 所持フィルター（サイクル）
    // ==============================
    function updateOwnedCycleBtn(btn) {
        const state = btn.dataset.state || 'off';
        let label = '';
        switch (state) {
        case 'owned': label = '所持カードのみ'; break;
        case 'incomplete': label = '未コンプカードのみ'; break;
        case 'complete': label = 'コンプカードのみ'; break;
        default: label = '所持フィルターOFF';
        }
        btn.textContent = label;
        btn.classList.toggle('selected', state !== 'off');
    }

    function cycleOwnedFilter(btn) {
        const order = ['off', 'owned', 'incomplete', 'complete'];
        const cur = btn.dataset.state || 'off';
        const idx = order.indexOf(cur);
        const next = order[(idx + 1) % order.length];
        btn.dataset.state = next;
        updateOwnedCycleBtn(btn);
        applyFilters();
    }

    // ==============================
    // applyFilters 本体
    // ==============================
    function getSelectedFilterValues(key) {
        return Array.from(document.querySelectorAll(`.filter-btn.selected[data-${key}]`))
        .map(btn => btn.dataset[key]);
    }

    // Booleanフィルター取得
    function getBooleanFilter(key) {
        const btn = document.querySelector(`.filter-group [data-${key}].selected`);
        return btn ? ['true'] : [];
    }

    function applyFilters() {
        const opened = document.querySelector('.card-detail.active');
        if (opened) opened.remove();

        const keyword = (document.getElementById('keyword')?.value || '').trim().toLowerCase();
        const tokens = keyword.split(/\s+/).filter(Boolean);

        const selectedFilters = {
        race: getSelectedFilterValues('race'),
        category: getSelectedFilterValues('category'),
        type: getSelectedFilterValues('type'),
        rarity: getSelectedFilterValues('rarity'),
        pack: getSelectedFilterValues('pack'),
        effect: getSelectedFilterValues('effect'),
        field: getSelectedFilterValues('field'),
        bp: getSelectedFilterValues('bp'),
        ability: getSelectedFilterValues('ability'),
        draw: getBooleanFilter('draw'),
        cardsearch: getBooleanFilter('cardsearch'),
        graveyard_recovery: getBooleanFilter('graveyard_recovery'),
        destroy_opponent: getBooleanFilter('destroy_opponent'),
        destroy_self: getBooleanFilter('destroy_self'),
        heal: getBooleanFilter('heal'),
        power_up: getBooleanFilter('power_up'),
        power_down: getBooleanFilter('power_down'),
        };

        const toIntOr = (v, fallback) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : fallback;
        };

        const costMinEl = document.getElementById('cost-min');
        const costMaxEl = document.getElementById('cost-max');
        const costMin = toIntOr(costMinEl?.value, 0);

        const costMaxVal = costMaxEl?.value;
        const costMax = (!costMaxEl || costMaxVal == null || costMaxVal === '上限なし')
        ? Infinity
        : toIntOr(costMaxVal, Infinity);

        const powerMinEl = document.getElementById('power-min');
        const powerMaxEl = document.getElementById('power-max');
        const powerMin = toIntOr(powerMinEl?.value, 0);

        const powerMaxVal = powerMaxEl?.value;
        const powerMax = (!powerMaxEl || powerMaxVal == null || powerMaxVal === '上限なし')
        ? Infinity
        : toIntOr(powerMaxVal, Infinity);


        // 所持/コンプ（1ボタン）
        const ownedFilterGroup = document.querySelector('.filter-group[data-key="所持フィルター"]');
        let ownedBtnOn = false, compBtnOn = false, unCompBtnOn = false;

        if (ownedFilterGroup) {
        const cycleBtn = ownedFilterGroup.querySelector('.filter-btn[data-mode="owned-cycle"]');
        const state = cycleBtn?.dataset.state || 'off';
        ownedBtnOn = (state === 'owned');
        unCompBtnOn = (state === 'incomplete');
        compBtnOn = (state === 'complete');
        }

        const ownedDataMap = readOwnedDataSafe();

        const gridRoot = document.getElementById('grid') || document;

        gridRoot.querySelectorAll('.card').forEach(card => {
        const haystack =
            (card.dataset.keywords?.toLowerCase()) ||
            [
            card.dataset.name,
            card.dataset.effect,
            card.dataset.field,
            card.dataset.ability,
            card.dataset.category,
            card.dataset.race,
            ].filter(Boolean).join(' ').toLowerCase();

        const cardData = {
            race: card.dataset.race,
            category: card.dataset.category,
            type: card.dataset.type,
            rarity: card.dataset.rarity,
            pack: card.dataset.pack,
            effect: card.dataset.effect,
            field: card.dataset.field,
            bp: card.dataset.bp,
            ability: card.dataset.ability,
            draw: card.dataset.draw,
            cardsearch: card.dataset.cardsearch,
            graveyard_recovery: card.dataset.graveyard_recovery,
            destroy_opponent: card.dataset.destroy_opponent,
            destroy_self: card.dataset.destroy_self,
            heal: card.dataset.heal,
            power_up: card.dataset.power_up,
            power_down: card.dataset.power_down,
            cost: parseInt(card.dataset.cost),
            power: parseInt(card.dataset.power),
        };

        const matchesKeyword = tokens.length === 0
            ? true
            : tokens.every(t => haystack.includes(t));

        const matchesFilters = Object.entries(selectedFilters).every(([key, selectedValues]) => {
            if (!selectedValues || selectedValues.length === 0) return true;

            // pack：英名一致（カード側は "EN「仮名」" の可能性）
            if (key === 'pack') {
            const cardEn = (cardData.pack || '').split('「')[0].trim();
            return selectedValues.includes(cardEn);
            }

            // effect：含む
            if (key === 'effect') {
            const eff = cardData.effect || '';
            return selectedValues.some(v => eff.includes(v));
            }

            return selectedValues.includes(cardData[key]);
        });

        const matchesCost = cardData.cost >= costMin && cardData.cost <= costMax;
        const matchesPower = cardData.power >= powerMin && cardData.power <= powerMax;

        let visible = matchesKeyword && matchesFilters && matchesCost && matchesPower;

        // 所持フィルター反映
        if (ownedBtnOn || compBtnOn || unCompBtnOn) {
            const cd = String(card.dataset.cd || '');
            const entry = ownedDataMap[cd];
            let total = 0;
            if (typeof entry === 'number') {
            total = entry;
            } else if (entry && typeof entry === 'object') {
            total = (entry.normal | 0) + (entry.shine | 0) + (entry.premium | 0);
            }

            if (ownedBtnOn && total <= 0) visible = false;

            if (compBtnOn) {
            const isOldGod = (card.dataset.race === '旧神');
            const need = isOldGod ? 1 : 3;
            if (total < need) visible = false;
            }

            if (unCompBtnOn) {
            const isOldGod = (card.dataset.race === '旧神');
            const ok = isOldGod ? (total === 0) : (total <= 2);
            if (!ok) visible = false;
            }
        }

        // リスト表示は行(.list-row)を消す
        const isList = !!gridRoot.classList?.contains?.('is-list');

        if (isList) {
            // ✅ グリッド時に付いた display:none が残る事故を防ぐ
            // （リストでは row で制御するので card は必ず表示状態に戻す）
            card.style.display = '';

            const row = card.closest('.list-row');
            if (row) {
                row.style.display = visible ? '' : 'none';
            } else {
                // 万一 list-row が無いカードは保険で card 側を制御
                card.style.display = visible ? '' : 'none';
            }
        } else {
            card.style.display = visible ? '' : 'none';
        }
        });

        try { window.applyGrayscaleFilter?.(); } catch {}
        renderActiveFilterChips();
        // ✅ リスト表示の row 表示を最終確定（cardsViewMode 側の同期関数があれば呼ぶ）
        try { window.syncListRowVisibility_?.(); } catch {}
    }

    // ==============================
    // reset
    // ==============================
    function resetFilters() {
        const kw = document.getElementById('keyword');
        if (kw) kw.value = '';

        document.querySelectorAll('.filter-btn.selected').forEach(btn => {
        btn.classList.remove('selected');
        });

        const costMin = document.getElementById('cost-min');
        const costMax = document.getElementById('cost-max');
        const powerMin = document.getElementById('power-min');
        const powerMax = document.getElementById('power-max');

        if (costMin && costMax) {
        costMin.selectedIndex = 0;
        costMax.selectedIndex = costMax.options.length - 1;
        }
        if (powerMin && powerMax) {
        powerMin.selectedIndex = 0;
        powerMax.selectedIndex = powerMax.options.length - 1;
        }

        // 所持フィルター OFF
        const ownedGroup = document.querySelector('.filter-group[data-key="所持フィルター"]');
        if (ownedGroup) {
        const cycleBtn = ownedGroup.querySelector('.filter-btn[data-mode="owned-cycle"]');
        if (cycleBtn) {
            cycleBtn.dataset.state = 'off';
            updateOwnedCycleBtn(cycleBtn);
        }
        }

        applyFilters();
        setQuickTypeUI_('all');
    }

    // ==============================
    // タイプ即時ボタン：状態同期ヘルパ
    // ==============================
    function normalizeQuickType_(t) {
        t = String(t ?? '').trim();
        return (t === 'all') ? '' : t;
    }

    function setQuickTypeUI_(mode, activeType) {
        // mode: 'all' | 'single' | 'multi'
        const wrap = document.querySelector('.type-quick-filter');
        const btns = Array.from(document.querySelectorAll('.type-icon-btn'));
        if (!btns.length) return;

        const allBtn =
            document.querySelector('.type-icon-btn[data-type=""]') ||
            document.querySelector('.type-icon-btn[data-type="all"]') ||
            btns[0];

        // 初期化
        btns.forEach(b => b.classList.remove('is-active'));
        if (wrap) wrap.classList.remove('is-multi');

        if (mode === 'multi') {
            if (wrap) wrap.classList.add('is-multi');

            // ✅ モーダル側で選ばれている type をすべてアクティブ表示
            const selectedTypes = Array.from(
                document.querySelectorAll('.filter-btn.selected[data-type]')
            ).map(b => normalizeQuickType_(b.dataset.type));

            btns.forEach(b => {
                const t = normalizeQuickType_(b.dataset.type);
                if (selectedTypes.includes(t)) {
                    b.classList.add('is-active');
                }
            });
            return;
        }

        if (mode === 'single') {
            const t = normalizeQuickType_(activeType);
            const hit = btns.find(b => normalizeQuickType_(b.dataset.type) === t);
            (hit || allBtn)?.classList.add('is-active');
            return;
        }

        // mode === 'all'
        allBtn?.classList.add('is-active');
    }

    function syncQuickTypeFromModal_() {
        const selected = Array.from(document.querySelectorAll('.filter-btn.selected[data-type]'))
            .map(b => String(b.dataset.type || '').trim())
            .filter(Boolean);

        if (selected.length === 0) {
            setQuickTypeUI_('all');
        } else if (selected.length === 1) {
            setQuickTypeUI_('single', selected[0]);
        } else {
            setQuickTypeUI_('multi');
        }
    }

    // ==============================
    // 初期化
    // ==============================
    function init() {
        // cardFilter UIが無いページでは何もしない
        const hasCardFilterUI =
        document.getElementById('filterModal') &&
        document.getElementById('main-filters') &&
        document.getElementById('detail-filters');

        if (!hasCardFilterUI) return;

        // フィルターボタン（selected切替）＋タイプ即時フィルター
        document.addEventListener('click', (e) => {

        // ==============================
        // タイプ即時フィルター（search-bar）
        //  - 押したら「1種類に上書き」
        //  - チップバーにタイプは出さない
        // ==============================
        const typeBtn = e.target.closest('.type-icon-btn');
            if (typeBtn) {
            const type = normalizeQuickType_(typeBtn.dataset.type || '');

            // ✅ モーダル側 type を全解除→単一選択に上書き
            document.querySelectorAll('.filter-group[data-key="タイプ"] .filter-btn[data-type]')
                .forEach(fb => fb.classList.remove('selected'));

            if (type) {
                const target = document.querySelector(`.filter-group[data-key="タイプ"] .filter-btn[data-type="${CSS.escape(type)}"]`);
                if (target) target.classList.add('selected');
                setQuickTypeUI_('single', type);
            } else {
                setQuickTypeUI_('all');
            }

            applyFilters();
            return; // ← 下の filter-btn 処理へ落とさない
        }

        // ==============================
        // 既存：filter-btn
        // ==============================
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;

        // 投稿フィルター用タグボタンは別処理
        if (btn.classList.contains('post-filter-tag-btn')) return;

        btn.classList.toggle('selected');

        const group = btn.closest('.filter-group');
        if (group && group.dataset.key === 'タイプ') {
            // ✅ タイプ複数選択 → タイプボタンを「複数選択中」表示に
            syncQuickTypeFromModal_();
        }

        applyFilters();
        });
        document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('filterModal');
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') closeFilterModal();
        });

        // UI生成
        generateFilterUI().catch(console.warn);

        updateChipsOffset();
        window.addEventListener('resize', updateChipsOffset);

        // キーワード：デバウンス
        const kw = document.getElementById('keyword');
        if (kw) kw.addEventListener('input', debounce(() => applyFilters(), 300));

        // Applyボタン（モーダル内）
        document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
        applyFilters();
        closeFilterModal();
        });
    }

    // -----------------------
    // 外部公開（互換用）
    // -----------------------
    window.CardFilter = {
        init,
        applyFilters,
        resetFilters,
        openFilterModal,
        closeFilterModal,
        toggleDetailFilters,
        updateOwnedCycleBtn,
    };

    // 既存コード互換：グローバル関数名を維持
    window.applyFilters = applyFilters;
    window.resetFilters = resetFilters;
    window.openFilterModal = openFilterModal;
    window.closeFilterModal = closeFilterModal;
    window.toggleDetailFilters = toggleDetailFilters;
    window.updateOwnedCycleBtn = updateOwnedCycleBtn;
    window.cycleOwnedFilter = cycleOwnedFilter;

    // DOMContentLoaded で起動
    document.addEventListener('DOMContentLoaded', init);

})();
