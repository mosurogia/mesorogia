// カテゴリ順を定義（番号は飛び飛びでもOK）
const getCategoryOrder = (category) => {
const order = {
"聖焔龍（フォルティア）": 11,
"ドラゴライダー": 12,
"メイドロボ": 21,
"アドミラルシップ": 22,
"ナチュリア": 31,
"鬼刹（きせつ）": 32,
"風花森（ふかしん）":33,
"ロスリス": 41,
"白騎士": 42,
"愚者愚者":43,
"昏き霊園": 51,
"マディスキア": 52,
"ノーカテゴリ": 999
};
return order[category] ?? 9999;
};

// タイプ順を定義
const getTypeOrder = (type) => {
if (type === "チャージャー") return 0;
if (type === "アタッカー") return 1;
if (type === "ブロッカー") return 2;
return 3;
};



//ページトップ移動ボタン
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}





// 一覧のカードをソート
function sortCards() {
const sortValue = document.getElementById("sort-select").value;
const grid = document.getElementById("grid");
const cards = Array.from(grid.children).filter(card => card.classList.contains("card"));

cards.sort((a, b) => {
const typeA = getTypeOrder(a.dataset.type);
const typeB = getTypeOrder(b.dataset.type);
const costA = parseInt(a.dataset.cost);
const costB = parseInt(b.dataset.cost);
const powerA = parseInt(a.dataset.power);
const powerB = parseInt(b.dataset.power);
const cdA = parseInt(a.dataset.cd);
const cdB = parseInt(b.dataset.cd);
const catA = getCategoryOrder(a.dataset.category);
const catB = getCategoryOrder(b.dataset.category);

switch (sortValue) {
    case "cost-asc":
    return costA - costB || typeA - typeB || powerA - powerB || cdA - cdB;
    case "cost-desc":
    return costB - costA || typeA - typeB || powerA - powerB || cdA - cdB;
    case "power-asc":
    return powerA - powerB || typeA - typeB || costA - costB || cdA - cdB;
    case "power-desc":
    return powerB - powerA || typeA - typeB || costA - costB || cdA - cdB;
    case "category-order":
    return catA - catB || typeA - typeB || costA - costB || powerA - powerB || cdA - cdB;
    default:
    return typeA - typeB || costA - costB || powerA - powerB || cdA - cdB;
}
});

cards.forEach(card => grid.appendChild(card));
}
