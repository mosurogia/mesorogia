
  // ==========================
  // 共通UI操作
  // ==========================
  //#region
  // タブ切り替え処理
function switchTab(id, clickedTab) {
  // 現在のタブグループを特定
  const tabGroup = clickedTab.closest('.tab-bar');
  const contentGroup = tabGroup.nextElementSibling?.classList.contains('tab-contents-group')
    ? tabGroup.nextElementSibling
    : document; // fallback: 全体対象

  // タブグループ内のタブボタンから active を外す
  tabGroup.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  clickedTab.classList.add('active');

  // 対応するコンテンツだけ表示（他は非表示）
  contentGroup.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const target = contentGroup.querySelector(`#${id}`) || document.getElementById(id);
  if (target) target.classList.add('active');

  // 特定タブの追加処理
  if (id === "edit") {
   // rebuildCardMap?.();
    //renderDeckList?.();
  }
}





  //#endregion