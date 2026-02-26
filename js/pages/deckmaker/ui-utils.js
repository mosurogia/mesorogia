// js/pages/deckmaker/ui-utils.js
(function () {
  'use strict';

  // キャンペーンバナー表示
  async function initCampaignBanner() {
    try {
      const camp = await window.fetchActiveCampaign?.({ ttlMs: 60000 });
      if (camp) {
        const mini = document.getElementById('campaign-mini');
        const text = document.getElementById('campaign-mini-text');
        if (mini && text) {
          text.textContent = camp.title || 'キャンペーン開催中';
          mini.style.display = '';
        }
      }
    } catch {}
  }

  // 共通ユーティリティ: トースト表示や escapeHtml_ などは defs.js にあるのでここでは不要。

  document.addEventListener('DOMContentLoaded', () => {
    initCampaignBanner();
    // 他に初期化するUIがあればここで呼び出す
  });
})();
