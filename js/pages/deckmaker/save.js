// js/pages/deckmaker/save.js
(function () {
  'use strict';

  /**
   * 現在のデッキを JSON としてダウンロード保存する。
   */
  function saveDeckAsJson() {
    const payload = {
      cards: { ...window.deck },
      representativeCd: window.representativeCd || null,
      name: window.readDeckNameInput?.() || '',
      note: window.readPostNote?.() || '',
      date: window.formatYmd?.()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${payload.name || 'deck'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * デッキリストを画像として出力する。
   * page2.js 内の html2canvas を用いた処理をここに移植。
   */
  async function saveDeckAsImage() {
    const target = document.getElementById('deck-card-list');
    if (!target) return;
    // html2canvas で画像化
    try {
      const canvas = await html2canvas(target, { backgroundColor: null });
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'deck.png';
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (e) {
      console.error('デッキ画像の作成に失敗:', e);
    }
  }

  // 公開API
  window.saveDeckAsJson = window.saveDeckAsJson || saveDeckAsJson;
  window.saveDeckAsImage = window.saveDeckAsImage || saveDeckAsImage;
})();
