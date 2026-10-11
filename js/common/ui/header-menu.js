/* =========================
 * js/common/ui/header-menu.js
 * - 共通ヘッダーの探索メニューを制御
 * ========================= */
(function () {
    'use strict';

    // 用語集とプロフィールの閲覧記録を独立して保存する。
    const GLOSSARY_SEEN_KEY = 'mesorogia:glossary:launch-seen';
    const PROFILE_SEEN_KEY = 'mesorogia:profile-card:launch-seen';
    let glossarySeen = false;
    let profileSeen = false;

    function updateMenuNotice() {
        const pageName = window.location.pathname.split('/').pop();
        glossarySeen = glossarySeen || pageName === 'glossary.html';
        profileSeen = profileSeen || pageName === 'profile-card.html';
        try {
            glossarySeen = glossarySeen || window.localStorage.getItem(GLOSSARY_SEEN_KEY) === '1';
            profileSeen = profileSeen || window.localStorage.getItem(PROFILE_SEEN_KEY) === '1';
            if (pageName === 'glossary.html') window.localStorage.setItem(GLOSSARY_SEEN_KEY, '1');
            if (pageName === 'profile-card.html') window.localStorage.setItem(PROFILE_SEEN_KEY, '1');
        } catch (_) {
            // 保存が制限されている場合は、このページ内の閲覧状態を使う。
        }
        // 用語集専用の表示は従来どおり用語集だけに連動させる。
        document.documentElement.classList.toggle('has-glossary-news', !glossarySeen);
        document.documentElement.classList.toggle('has-header-menu-news', !glossarySeen || !profileSeen);
        const unreadNames = [];
        if (!glossarySeen) unreadNames.push('用語集');
        if (!profileSeen) unreadNames.push('プロフィール');
        const label = document.querySelector('.header-menu-button--new .sr-only');
        if (label) label.textContent = unreadNames.length
            ? `探索・情報メニュー（新着：${unreadNames.join('、')}）`
            : '探索・情報メニュー';
    }

    updateMenuNotice();
    window.addEventListener('pageshow', updateMenuNotice);
    window.addEventListener('storage', (event) => {
        if (event.key === GLOSSARY_SEEN_KEY || event.key === PROFILE_SEEN_KEY || event.key === null) updateMenuNotice();
    });

    function getMenu(root) {
        return root?.querySelector('.header-menu-panel');
    }

    function getButton(root) {
        return root?.querySelector('.header-menu-button');
    }

    function closeMenu(root) {
        const menu = getMenu(root);
        const button = getButton(root);
        if (menu) menu.hidden = true;
        if (button) button.setAttribute('aria-expanded', 'false');
    }

    function closeOtherMenus(currentRoot) {
        document.querySelectorAll('[data-header-dropdown]').forEach((root) => {
            if (root !== currentRoot) closeMenu(root);
        });
    }

    function toggleMenu(root) {
        const menu = getMenu(root);
        const button = getButton(root);
        if (!menu || !button) return;

        const willOpen = menu.hidden;
        closeOtherMenus(root);
        menu.hidden = !willOpen;
        button.setAttribute('aria-expanded', String(willOpen));
    }

    function runAppAction(action) {
        if (action === 'install') {
            if (typeof window.MesorogiaPwaInstall?.open === 'function') {
                window.MesorogiaPwaInstall.open();
            } else {
                alert('ブラウザのメニューからホーム画面に追加してください。');
            }
            return;
        }
    }

    function updateHeaderLogoTitle() {
        const header = document.querySelector('.main-header');
        const title = header?.querySelector('.header-logo-title');
        const nav = header?.querySelector('.header-nav');
        if (!header || !title || !nav) return;

        header.classList.remove('is-header-logo-title-hidden');

        if (window.matchMedia('(max-width: 560px)').matches) {
            header.classList.add('is-header-logo-title-hidden');
            return;
        }

        const titleRect = title.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        const hasHorizontalOverflow = header.scrollWidth > Math.ceil(header.clientWidth + 1);
        const touchesNav = titleRect.right + 8 > navRect.left;
        const outsideHeader = titleRect.right > headerRect.right - 4;

        if (hasHorizontalOverflow || touchesNav || outsideHeader) {
            header.classList.add('is-header-logo-title-hidden');
        }
    }

    function bindHeaderLogoTitle() {
        let frameId = 0;
        const requestUpdate = () => {
            if (frameId) cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => {
                frameId = 0;
                updateHeaderLogoTitle();
            });
        };

        requestUpdate();
        window.addEventListener('resize', requestUpdate);
        window.addEventListener('load', requestUpdate);

        const account = document.querySelector('.main-header .header-account');
        if (account && typeof MutationObserver === 'function') {
            new MutationObserver(requestUpdate).observe(account, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
    }

    // プロフィールは認証状態に依存しない探索メニューへ集約する。
    function addProfileLinks() {
        document.querySelectorAll('.header-explore-menu .header-menu-panel').forEach((menu) => {
            const glossary = Array.from(menu.querySelectorAll('a')).find((link) =>
                new URL(link.href).pathname.endsWith('/glossary.html'));
            if (!glossary) return;
            const profileLinks = Array.from(menu.querySelectorAll('a')).filter((link) =>
                new URL(link.href).pathname.endsWith('/profile-card.html'));
            const link = profileLinks.shift() || document.createElement('a');
            profileLinks.forEach((duplicate) => duplicate.remove());
            link.setAttribute('role', 'menuitem');
            link.href = new URL('profile-card.html', glossary.href).href;
            link.innerHTML = '<span>プロフィール</span><span class="header-menu-badge">NEW</span>';
            if (window.location.pathname.endsWith('/profile-card.html')) link.setAttribute('aria-current', 'page');
            glossary.after(link);
        });
    }

    function bindEvents() {
        document.querySelectorAll('.header-explore-menu .header-menu-button').forEach((button) => button.classList.add('header-menu-button--new'));
        updateMenuNotice();
        addProfileLinks();
        bindHeaderLogoTitle();

        document.addEventListener('click', (event) => {
            const disabledLink = event.target.closest('[data-header-disabled-link]');
            if (disabledLink) {
                event.preventDefault();
                return;
            }

            const appActionButton = event.target.closest('[data-header-app-action]');
            if (appActionButton) {
                event.preventDefault();
                const root = appActionButton.closest('[data-header-dropdown]');
                closeMenu(root);
                runAppAction(appActionButton.getAttribute('data-header-app-action'));
                return;
            }

            const button = event.target.closest('.header-menu-button');
            if (button) {
                const root = button.closest('[data-header-dropdown]');
                if (!root) return;
                event.preventDefault();
                toggleMenu(root);
                return;
            }

            const root = event.target.closest('[data-header-dropdown]');
            if (root && event.target.closest('.header-menu-panel a')) closeMenu(root);
            if (!root) {
                document.querySelectorAll('[data-header-dropdown]').forEach(closeMenu);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            document.querySelectorAll('[data-header-dropdown]').forEach((root) => {
                if (!getMenu(root)?.hidden) { closeMenu(root); getButton(root)?.focus(); }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindEvents, { once: true });
    } else {
        bindEvents();
    }
})();
