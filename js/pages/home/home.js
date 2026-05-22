/* =========================
 * ホームページ用の仮データ描画
 * 後でGASやJSON取得に差し替える場合は、この配列を取得結果に置き換える
 * ========================= */
(function () {
    'use strict';

    const NEWS_ITEMS = [
        {
            date: '2026-05-22',
            title: 'ホームページ基盤を追加',
            description: '主要ページへの導線、更新履歴、イベント情報、ページ紹介の枠を作成しました。'
        },
        {
            date: '2026-05-20',
            title: 'Tier表ページを更新',
            description: '環境デッキの確認用ページを追加しました。'
        },
        {
            date: '2026-05-17',
            title: 'カード図鑑の表示を調整',
            description: 'スマホ表示と検索まわりの使いやすさを調整しました。'
        },
        {
            date: '2026-05-13',
            title: 'デッキ投稿機能を調整',
            description: '投稿デッキの確認と編集まわりを更新しました。'
        },
        {
            date: '2026-05-05',
            title: 'PWA関連を更新',
            description: 'アプリとして使うための基本設定を調整しました。'
        }
    ];

    const EVENT_ITEMS = [
        {
            date: '2026-06-01',
            type: 'official',
            label: '公式イベント',
            title: 'シーズンイベント',
            description: '公式情報の確認後に詳細を差し替える想定です。'
        },
        {
            date: '2026-06-08',
            type: 'prediction',
            label: '予測',
            title: 'カード追加予測期間',
            description: '過去更新ペースをもとにした仮の予定です。'
        },
        {
            date: '2026-06-15',
            type: 'user',
            label: 'ユーザー申請イベント',
            title: 'コミュニティ大会',
            description: '申請フォーム公開後、ユーザーイベントを掲載します。'
        }
    ];

    function formatDate(dateText) {
        const date = new Date(`${dateText}T00:00:00`);
        if (Number.isNaN(date.getTime())) return dateText;

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
    }

    function createTextElement(tagName, text, className) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        element.textContent = text;
        return element;
    }

    function renderNews() {
        const list = document.querySelector('[data-home-news-list]');
        if (!list) return;

        list.replaceChildren(...NEWS_ITEMS.slice(0, 5).map((item) => {
            const article = document.createElement('article');
            article.className = 'home-list-item';

            const time = createTextElement('time', formatDate(item.date));
            time.dateTime = item.date;

            const body = document.createElement('div');
            body.append(
                createTextElement('h3', item.title),
                createTextElement('p', item.description)
            );

            article.append(time, body);
            return article;
        }));
    }

    function renderEvents() {
        const list = document.querySelector('[data-home-event-list]');
        if (!list) return;

        list.replaceChildren(...EVENT_ITEMS.map((item) => {
            const article = document.createElement('article');
            article.className = 'home-list-item';

            const time = createTextElement('time', formatDate(item.date));
            time.dateTime = item.date;

            const label = createTextElement('span', item.label, `home-label home-label--${item.type}`);
            const body = document.createElement('div');
            body.append(
                label,
                createTextElement('h3', item.title),
                createTextElement('p', item.description)
            );

            article.append(time, body);
            return article;
        }));
    }

    function bindDisabledLinks() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest('[data-home-disabled-link]');
            if (!link) return;
            event.preventDefault();
        });
    }

    function init() {
        renderNews();
        renderEvents();
        bindDisabledLinks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
