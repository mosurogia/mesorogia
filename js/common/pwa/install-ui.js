(function () {
  'use strict';

  const STORAGE_PREFIX = 'mesorogiaPwaInstall';
  const DISMISS_KEY = `${STORAGE_PREFIX}:dismissedAt`;
  const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

  let deferredPrompt = null;
  let nudgeEl = null;

  const APP_NAV_ITEMS = [
    { href: 'cards.html', key: 'cards.html', label: '図鑑' },
    { href: 'deckmaker.html', key: 'deckmaker.html', label: 'デッキ' },
    { href: 'deck-post.html', key: 'deck-post.html', label: '投稿' },
    { href: 'settings.html', key: 'settings.html', label: '設定' }
  ];

  function isStandalone_() {
    return window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true;
  }

  function isIos_() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
  }

  function getCurrentPageKey_() {
    const path = window.location.pathname || '';
    const file = path.split('/').pop() || 'deckmaker.html';
    return file === '' ? 'deckmaker.html' : file;
  }

  function ensureAppBottomNav_() {
    let nav = document.querySelector('.app-bottom-nav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'app-bottom-nav';
      nav.setAttribute('aria-label', 'アプリメニュー');
      document.body.appendChild(nav);
    }

    const current = getCurrentPageKey_();
    nav.innerHTML = APP_NAV_ITEMS.map((item) => {
      const active = item.key === current;
      return `<a href="${item.href}" class="${active ? 'is-active' : ''}" ${active ? 'aria-current="page"' : ''}>${item.label}</a>`;
    }).join('');

    return nav;
  }

  function showAppNavLoading_() {
    if (!isStandalone_()) return;

    let overlay = document.querySelector('.app-nav-loading');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'app-nav-loading';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML = '<span class="app-nav-loading-spinner" aria-hidden="true"></span><span>読み込み中...</span>';
      document.body.appendChild(overlay);
    }

    overlay.hidden = false;
  }

  function bindAppBottomNavLoading_() {
    if (document.__appBottomNavLoadingBound) return;
    document.__appBottomNavLoadingBound = true;

    document.addEventListener('click', (event) => {
      const link = event.target.closest?.('.app-bottom-nav a');
      if (!link) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target && link.target !== '_self') return;

      const nextUrl = new URL(link.href, window.location.href);
      if (nextUrl.href === window.location.href) return;

      showAppNavLoading_();
    });
  }

  function refreshStandaloneChrome_() {
    const standalone = isStandalone_();
    document.body.classList.toggle('is-pwa-standalone', standalone);

    const nav = ensureAppBottomNav_();
    nav.hidden = !standalone;
  }

  function canShowNudge_() {
    if (isStandalone_()) return false;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (!dismissedAt) return true;

    return Date.now() - dismissedAt > NUDGE_COOLDOWN_MS;
  }

  function dismissNudge_() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    if (nudgeEl) nudgeEl.hidden = true;
  }

  async function runInstallPrompt_() {
    if (isStandalone_()) {
      showInstruction_('already');
      return;
    }

    if (deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptEvent.prompt();
      await promptEvent.userChoice.catch(() => null);
      refreshFooterButton_();
      dismissNudge_();
      return;
    }

    showInstruction_(isIos_() ? 'ios' : 'manual');
  }

  function showInstruction_(type) {
    const old = document.querySelector('.pwa-install-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.className = 'pwa-install-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    let title = 'アプリとして追加';
    let body = 'ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。';

    if (type === 'ios') {
      title = 'iPhoneで追加';
      body = 'Safariの共有ボタンから「ホーム画面に追加」を選んでください。';
    } else if (type === 'already') {
      title = '追加済みです';
      body = 'このサイトはアプリ表示で開かれています。';
    }

    modal.innerHTML = `
      <div class="pwa-install-dialog">
        <h3>${title}</h3>
        <p>${body}</p>
        <button type="button" class="pwa-install-primary">閉じる</button>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('.pwa-install-primary')) {
        close();
      }
    });
  }

  function refreshFooterButton_() {
    const button = document.querySelector('.js-pwa-install-footer');
    if (!button) return;

    const hidden = isStandalone_();
    button.hidden = hidden;
    button.previousElementSibling?.classList?.toggle('is-hidden', hidden);
    button.textContent = deferredPrompt ? 'アプリを追加' : 'アプリ追加方法';
  }

  function refreshToolbarButtons_() {
    document.querySelectorAll('.js-pwa-install-toolbar').forEach((button) => {
      button.hidden = isStandalone_();
      button.textContent = '📱 アプリで見る';
    });
  }

  function addFooterEntry_() {
    const footerLeft = document.querySelector('.site-footer .footer-mini-left');
    if (!footerLeft || footerLeft.querySelector('.js-pwa-install-footer')) return;

    const sep = document.createElement('span');
    sep.className = 'footer-sep footer-pwa-sep';
    sep.textContent = '・';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'footer-link footer-pwa-install js-pwa-install-footer';
    button.textContent = 'アプリ追加方法';
    button.addEventListener('click', runInstallPrompt_);

    footerLeft.append(sep, button);
    refreshFooterButton_();
  }

  function bindToolbarEntries_() {
    document.querySelectorAll('.js-pwa-install-toolbar').forEach((button) => {
      if (button.__pwaInstallToolbarBound) return;
      button.__pwaInstallToolbarBound = true;
      button.addEventListener('click', runInstallPrompt_);
    });

    refreshToolbarButtons_();
  }

  function ensureNudge_() {
    if (nudgeEl) return nudgeEl;

    nudgeEl = document.createElement('div');
    nudgeEl.className = 'pwa-install-nudge';
    nudgeEl.hidden = true;
    nudgeEl.innerHTML = `
      <div class="pwa-install-nudge-text">
        <strong>モスロギアをアプリに追加できます</strong>
        <span>ホーム画面からすぐに開けます。</span>
      </div>
      <div class="pwa-install-nudge-actions">
        <button type="button" class="pwa-install-nudge-primary">アプリを追加</button>
        <button type="button" class="pwa-install-nudge-later">あとで</button>
      </div>
    `;

    nudgeEl.querySelector('.pwa-install-nudge-primary')?.addEventListener('click', runInstallPrompt_);
    nudgeEl.querySelector('.pwa-install-nudge-later')?.addEventListener('click', dismissNudge_);
    document.body.appendChild(nudgeEl);
    return nudgeEl;
  }

  function showNudge_() {
    if (!canShowNudge_()) return;

    const el = ensureNudge_();
    el.hidden = false;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    refreshFooterButton_();
    refreshToolbarButtons_();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    dismissNudge_();
    refreshFooterButton_();
    refreshToolbarButtons_();
  });

  function init_() {
    refreshStandaloneChrome_();
    addFooterEntry_();
    bindToolbarEntries_();
    bindAppBottomNavLoading_();
    ensureNudge_();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init_, { once: true });
  } else {
    init_();
  }

  window.MesorogiaPwaInstall = {
    showNudge: showNudge_,
    open: runInstallPrompt_
  };

  window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', () => {
    refreshStandaloneChrome_();
    refreshFooterButton_();
    refreshToolbarButtons_();
  });
}());
