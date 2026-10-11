(() => {
  'use strict';

  const els = {
    form: document.getElementById('profile-card-form'),
    playerName: document.getElementById('profile-player-name'),
    startedAtOptions: document.getElementById('profile-started-at-options'),
    favoriteRaceOptions: Array.from(document.querySelectorAll('input[name="profileFavoriteRace"]')),
    favoriteCategory: document.getElementById('profile-favorite-category'),
    favoriteCategoryLabel: document.getElementById('profile-favorite-category-label'),
    categoryOpen: document.getElementById('profile-category-open'),
    categoryModal: document.getElementById('profile-category-modal'),
    categoryModalCurrent: document.getElementById('profile-category-modal-current'),
    categoryOptions: document.getElementById('profile-category-options'),
    categoryClear: document.getElementById('profile-category-clear'),
    mainDeck: document.getElementById('profile-main-deck'),
    xAccount: document.getElementById('profile-x-account'),
    xOpen: document.getElementById('profile-x-open'),
    loginButton: document.getElementById('profile-login-button'),
    accountButton: document.getElementById('profile-account-button'),
    loginHint: document.getElementById('profile-login-hint'),
    loginResult: document.getElementById('profile-login-result'),
    loginResultData: document.getElementById('profile-login-result-data'),
    loginResultMessage: document.getElementById('profile-login-result-message'),
    loginResultApply: document.getElementById('profile-login-result-apply'),
    loginResultDecline: document.getElementById('profile-login-result-decline'),
    loginResultClose: document.getElementById('profile-login-result-close'),
    avatarFile: document.getElementById('profile-avatar-file'),
    avatarCrop: document.getElementById('profile-avatar-crop'),
    avatarCropPreview: document.getElementById('profile-avatar-crop-preview'),
    avatarZoom: document.getElementById('profile-avatar-zoom'),
    avatarPreset: document.getElementById('profile-avatar-preset'),
    avatarReset: document.getElementById('profile-avatar-reset'),
    favoriteCard: document.getElementById('profile-favorite-card'),
    favoriteCardOpen: document.getElementById('profile-favorite-card-open'),
    favoriteCardMediaOpen: document.getElementById('profile-favorite-card-media-open'),
    favoriteCardLabel: document.getElementById('profile-favorite-card-label'),
    favoriteCardMediaPreview: document.getElementById('profile-favorite-card-media-preview'),
    comment: document.getElementById('profile-card-comment'),
    characterCount: document.getElementById('profile-card-character-count'),
    tags: document.getElementById('profile-card-tags'),
    previewStage: document.getElementById('profile-card-preview-stage'),
    canvas: document.getElementById('profile-card-canvas'),
    avatarPreview: document.getElementById('profile-avatar-preview'),
    cardPreview: document.getElementById('profile-favorite-card-preview'),
    exportButton: document.getElementById('profile-card-export'),
    resetButton: document.getElementById('profile-card-reset'),
    error: document.getElementById('profile-card-error'),
    announcement: document.getElementById('profile-card-announcement'),
    playerNamePreview: document.getElementById('profile-player-name-preview'),
    startedAtPreview: document.getElementById('profile-started-at-preview'),
    favoriteRacePreview: document.getElementById('profile-favorite-race-preview'),
    favoriteCategoryPreview: document.getElementById('profile-favorite-category-preview'),
    mainDeckPreview: document.getElementById('profile-main-deck-preview'),
    commentPreview: document.getElementById('profile-card-comment-preview'),
    tagsPreview: document.getElementById('profile-card-tags-preview'),
    xAccountPreview: document.getElementById('profile-card-x-account-preview'),
    xAccountLogo: document.getElementById('profile-card-x-logo'),
    xAccountValue: document.getElementById('profile-card-x-account-value')
  };

  const DEFAULT_CARD_CD = '00000';
  const DEFAULT_PLAYER_NAME = '';
  const DEFAULT_AVATAR_SRC = 'img/appicon_1024.webp';
  const DEFAULT_STARTED_AT = '2025年夏ごろ';
  const SEASON_NAMES = ['春', '夏', '秋', '冬'];
  const DEFAULT_TAGS = ['ランクガチ勢', 'デッキ相談歓迎', '交流歓迎'];
  const PROFILE_CARD_WIDTH = 500;
  const PROFILE_CARD_HEIGHT = 625;
  let avatarObjectUrl = '';
  let playerNameAutoFillAllowed = true;
  let xAccountAutoFillAllowed = true;
  let xAccountAutoFilledValue = '';
  let pendingLoginAttempt = null;
  let lastCompletedLoginAttempt = null;
  let pendingLoginData = null;
  let loginReturnFocus = null;
  const AVATAR_ZOOM_MIN = 0.5;
  const AVATAR_ZOOM_MAX = 2;
  const DEFAULT_AVATAR_ZOOM = 1;
  const avatarPosition = { x: 0, y: 0, zoom: DEFAULT_AVATAR_ZOOM };
  let avatarDrag = null;
  const avatarPointers = new Map();
  let avatarPinchStart = null;

  function updatePreviewScale() {
    const stageWidth = els.previewStage.getBoundingClientRect().width;
    const scale = Math.min(1, stageWidth / PROFILE_CARD_WIDTH);
    els.canvas.style.setProperty('--profile-card-preview-scale', String(scale));
  }

  function getFavoriteRace() {
    return els.favoriteRaceOptions.find((input) => input.checked)?.value || 'ドラゴン';
  }

  function getStartedAtOptions() {
    return Array.from(els.startedAtOptions.querySelectorAll('input[name="profileStartedAt"]'));
  }

  function getStartedAt() {
    return getStartedAtOptions().find((input) => input.checked)?.value || '始めた時期';
  }

  function getCategoryRace(category) {
    const groups = Array.isArray(window.CATEGORY_GROUPS) ? window.CATEGORY_GROUPS : [];
    return groups.find((group) => group.list?.includes(category))?.race || 'none';
  }

  function formatCategoryLabel(category) {
    const readingIndex = category.indexOf('（');
    if (readingIndex < 0) return escapeHtml(category);
    return `${escapeHtml(category.slice(0, readingIndex))}<wbr>（${escapeHtml(category.slice(readingIndex + 1))}`;
  }

  function fitCategoryOptionLabels() {
    const options = Array.from(els.categoryOptions.querySelectorAll('.profile-card-category-option'));
    options.forEach((option) => {
      option.classList.remove('is-compact', 'is-wrap');
      if (option.scrollWidth > option.clientWidth + 1) option.classList.add('is-compact');
    });
    window.requestAnimationFrame(() => {
      options.forEach((option) => {
        if (option.scrollWidth > option.clientWidth + 1) option.classList.add('is-wrap');
      });
    });
  }

  function renderCategoryOptions() {
    const groups = Array.isArray(window.CATEGORY_GROUPS) ? window.CATEGORY_GROUPS : [];
    const selectedCategory = els.favoriteCategory.value;
    const categories = groups.map((group) => ({ race: group.race, list: group.list || [] }));
    const categoryOrder = Array.isArray(window.CATEGORY_ORDER_LIST) ? window.CATEGORY_ORDER_LIST : [];
    const groupedNames = new Set(categories.flatMap((group) => group.list));
    const otherCategories = categoryOrder.filter((category) => !groupedNames.has(category));
    if (otherCategories.length) categories.push({ race: 'none', list: otherCategories });

    els.categoryOptions.innerHTML = categories.map((group) => `
      <section class="profile-card-category-group">
        <h3>${escapeHtml(group.race === 'none' ? 'その他' : group.race)}</h3>
        <div class="profile-card-category-group__items">
          ${group.list.map((category) => `<button type="button" class="profile-card-category-option${category === selectedCategory ? ' is-selected' : ''}" aria-pressed="${category === selectedCategory}" data-category="${escapeHtml(category)}" data-race="${escapeHtml(group.race || getCategoryRace(category))}"><span class="profile-card-category-option__label">${formatCategoryLabel(category)}</span></button>`).join('')}
        </div>
      </section>
    `).join('');
  }

  function closeCategoryModal() {
    els.categoryModal.hidden = true;
    els.categoryOpen.focus();
  }

  function openCategoryModal() {
    els.categoryModal.hidden = false;
    window.requestAnimationFrame(() => {
      fitCategoryOptionLabels();
      els.categoryModal.querySelector(`[data-category="${CSS.escape(els.favoriteCategory.value)}"]`)?.focus();
    });
  }

  function setFavoriteCategory(category) {
    els.favoriteCategory.value = category;
    els.favoriteCategoryLabel.textContent = category || '未選択';
    els.categoryModalCurrent.textContent = category || '未選択';
    renderCategoryOptions();
    fitCategoryOptionLabels();
    updatePreview();
    closeCategoryModal();
  }

  function getSeasonOrder(year, seasonIndex) {
    return year * SEASON_NAMES.length + seasonIndex;
  }

  function getCurrentSeason() {
    const now = new Date();
    const month = now.getMonth();
    let seasonIndex;
    let seasonYear = now.getFullYear();
    if (month < 3) {
      seasonIndex = 3;
      seasonYear -= 1;
    } else if (month < 6) {
      seasonIndex = 0;
    } else if (month < 9) {
      seasonIndex = 1;
    } else {
      seasonIndex = 2;
    }
    return { year: seasonYear, seasonIndex };
  }

  function renderStartedAtOptions() {
    const previousValue = getStartedAt();
    const current = getCurrentSeason();
    const startOrder = getSeasonOrder(2025, 1);
    const endOrder = Math.max(startOrder, getSeasonOrder(current.year, current.seasonIndex));
    const options = ['リリース初期から'];

    for (let order = startOrder; order <= endOrder; order += 1) {
      const year = Math.floor(order / SEASON_NAMES.length);
      const seasonIndex = order % SEASON_NAMES.length;
      options.push(`${year}年${SEASON_NAMES[seasonIndex]}ごろ`);
    }

    els.startedAtOptions.innerHTML = options.map((value) => `
      <label class="profile-card-period-option">
        <input type="radio" name="profileStartedAt" value="${escapeHtml(value)}"${value === previousValue || (!options.includes(previousValue) && value === DEFAULT_STARTED_AT) ? ' checked' : ''}>
        <span>${escapeHtml(value)}</span>
      </label>
    `).join('');
  }

  function scheduleStartedAtOptionsRefresh() {
    const now = new Date();
    const year = now.getFullYear();
    const nextStarts = [2, 5, 8, 11]
      .map((month) => new Date(year, month, 1))
      .find((date) => date > now) || new Date(year + 1, 2, 1);
    const refreshDelay = Math.min(2147483647, Math.max(1000, nextStarts.getTime() - now.getTime() + 1000));
    window.setTimeout(() => {
      renderStartedAtOptions();
      updatePreview();
      scheduleStartedAtOptionsRefresh();
    }, refreshDelay);
  }

  function setStatus(message, isError = false) {
    document.getElementById('profile-card-error-message').textContent = isError ? message : '';
    els.error.hidden = !isError;
    els.announcement.textContent = isError ? '' : message;
  }

  function applyAccountPlayerName() {
    if (!playerNameAutoFillAllowed || els.playerName.value.trim()) return;
    const displayName = String(window.Auth?.user?.displayName || '').trim();
    if (!displayName) return;
    els.playerName.value = displayName.slice(0, els.playerName.maxLength || 24);
    updatePreview();
    setStatus('ログイン中の表示名をプレイヤー名の初期値に反映しました。');
  }

  function updateProfileAuthActions() {
    const loggedIn = !!(window.Auth?.user && window.Auth?.token && window.Auth?.verified);
    els.loginButton.hidden = loggedIn;
    els.loginHint.hidden = loggedIn;
    els.accountButton.hidden = !loggedIn;
  }

  // 登録済みXは初期値として反映し、手入力や明示的な空欄を保護する
  function applyAccountX() {
    const loggedIn = !!(window.Auth?.user && window.Auth?.token && window.Auth?.verified);
    const registeredX = loggedIn ? String(window.Auth.user.x || '').trim() : '';
    if (xAccountAutoFilledValue && els.xAccount.value === xAccountAutoFilledValue) {
      if (!registeredX) {
        els.xAccount.value = '';
        xAccountAutoFilledValue = '';
        updatePreview();
        return;
      }
      if (window.normalizeHandle?.(registeredX) === window.normalizeHandle?.(xAccountAutoFilledValue)) return;
      els.xAccount.value = '';
      xAccountAutoFilledValue = '';
    }
    if (!xAccountAutoFillAllowed || els.xAccount.value.trim() || !registeredX) return;
    els.xAccount.value = registeredX;
    xAccountAutoFilledValue = registeredX;
    updatePreview();
  }

  // 実際のログイン操作だけで完了モーダルを開き、確認前の自動反映を止める
  function closeLoginResult({ apply = false } = {}) {
    const data = pendingLoginData;
    if (apply && data && window.Auth?.verified && window.Auth?.token) {
      if (data.displayName) els.playerName.value = data.displayName.slice(0, els.playerName.maxLength || 24);
      if (data.x) els.xAccount.value = data.x;
      updatePreview();
    }
    playerNameAutoFillAllowed = false;
    xAccountAutoFillAllowed = false;
    xAccountAutoFilledValue = '';
    pendingLoginData = null;
    pendingLoginAttempt = null;
    if (els.loginResult.open) els.loginResult.close();
    const target = loginReturnFocus?.isConnected && loginReturnFocus.getClientRects().length
      ? loginReturnFocus : (els.accountButton.hidden ? els.loginButton : els.accountButton);
    target?.focus();
  }

  document.addEventListener('click', (event) => {
    const entry = event.target.closest('[data-open="authLoginModal"], [data-header-action="login"], [data-auth-entry]');
    if (entry) loginReturnFocus = entry;
  }, true);
  window.addEventListener('auth:login-start', (event) => {
    pendingLoginAttempt = event.detail.attemptId;
  });
  window.addEventListener('auth:login-failed', (event) => {
    if (pendingLoginAttempt === event.detail.attemptId) pendingLoginAttempt = null;
  });
  window.addEventListener('auth:login-success', (event) => {
    event.preventDefault();
    const { attemptId, user } = event.detail;
    if (attemptId === lastCompletedLoginAttempt || attemptId !== pendingLoginAttempt) return;
    lastCompletedLoginAttempt = attemptId;
    pendingLoginData = {
      displayName: String(user?.displayName || '').trim(),
      x: String(user?.x || '').trim()
    };
    els.loginResultData.replaceChildren();
    for (const [key, label] of [['displayName', 'プレイヤー名'], ['x', 'Xアカウント']]) {
      if (!pendingLoginData[key]) continue;
      const row = document.createElement('div');
      const title = document.createElement('dt');
      const value = document.createElement('dd');
      title.textContent = label;
      value.textContent = pendingLoginData[key];
      row.append(title, value);
      els.loginResultData.append(row);
    }
    const hasData = !!(pendingLoginData.displayName || pendingLoginData.x);
    els.loginResultMessage.textContent = hasData ? '登録済みのデータを入力欄に反映しますか？' : 'ログインしました。登録済みのプレイヤー名・Xはありません。';
    els.loginResultApply.hidden = !hasData;
    els.loginResultDecline.textContent = hasData ? '反映しない' : '閉じる';
    els.loginResult.showModal();
    els.loginResultDecline.focus();
  });
  els.loginResultApply.addEventListener('click', () => closeLoginResult({ apply: true }));
  els.loginResultDecline.addEventListener('click', () => closeLoginResult());
  els.loginResultClose.addEventListener('click', () => closeLoginResult());
  els.loginResult.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeLoginResult();
  });
  els.loginResult.addEventListener('click', (event) => {
    if (event.target !== els.loginResult) return;
    const rect = els.loginResult.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeLoginResult();
  });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function getSelectedTags() {
    return Array.from(els.tags.querySelectorAll('input:checked')).map((input) => input.value);
  }

  function renderTags() {
    const tags = getSelectedTags();
    els.tagsPreview.innerHTML = tags.map((tag) => `<span class="profile-card-canvas__tag">${escapeHtml(tag)}</span>`).join('');
  }

  function formatXAccount(value) {
    let handle = String(value ?? '').trim();
    if (!handle) return '';
    handle = handle.replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, '');
    handle = handle.split(/[/?#]/)[0].replace(/^@+/, '').trim();
    return handle ? `@${handle}` : '';
  }

  function updatePreview() {
    const playerName = els.playerName.value.trim() || 'プレイヤー名';
    const startedAt = getStartedAt();
    const favoriteRace = getFavoriteRace();
    const favoriteCategory = els.favoriteCategory.value;
    const mainDeck = els.mainDeck.value.trim() || 'メインデッキ';
    const comment = els.comment.value.trim() || '自己紹介を入力してください。';
    const xAccount = formatXAccount(els.xAccount.value);

    els.playerNamePreview.textContent = playerName;
    els.startedAtPreview.textContent = startedAt;
    els.favoriteRacePreview.textContent = favoriteRace;
    els.favoriteCategoryPreview.textContent = favoriteCategory;
    els.mainDeckPreview.textContent = mainDeck;
    els.commentPreview.textContent = comment;
    els.xAccountValue.textContent = xAccount;
    els.xAccountPreview.hidden = !xAccount;
    els.canvas.dataset.race = favoriteRace;
    els.characterCount.textContent = `${els.comment.value.length} / 80文字`;
    renderTags();
  }

  function setCardPreview(card) {
    const previewImages = [els.cardPreview, els.favoriteCardMediaPreview].filter(Boolean);
    previewImages.forEach((image) => {
      if (typeof window.setCardImageSrc === 'function') {
        window.setCardImageSrc(image, card || DEFAULT_CARD_CD);
      } else {
        const imageSrc = window.getCardImageSrc?.(card || DEFAULT_CARD_CD) || `img/${card?.cd || DEFAULT_CARD_CD}.webp`;
        image.src = imageSrc;
      }
      image.alt = card?.name ? `推しカード：${card.name}` : '推しカード';
    });
  }

  function openFavoriteCardModal() {
    if (typeof window.openCardPickModal !== 'function') {
      setStatus('カード選択機能を読み込めませんでした。ページを再読み込みしてください。', true);
      return;
    }
    window.openCardPickModal({
      showDeckActions: false,
      onPicked: ({ cd, name }) => setFavoriteCard({ cd, name })
    });
  }

  function applyAvatarTransform() {
    const transform = `translate(${avatarPosition.x}%, ${avatarPosition.y}%) scale(${avatarPosition.zoom})`;
    [els.avatarCropPreview, els.avatarPreview].forEach((image) => {
      image.style.transform = transform;
      image.style.transformOrigin = 'center';
    });
  }

  function clampAvatarZoom(value) {
    return Math.max(AVATAR_ZOOM_MIN, Math.min(AVATAR_ZOOM_MAX, value));
  }

  function getAvatarPointerDistance() {
    const pointers = Array.from(avatarPointers.values());
    if (pointers.length < 2) return 0;
    return Math.hypot(pointers[1].x - pointers[0].x, pointers[1].y - pointers[0].y);
  }

  function updateAvatarPinch() {
    const distance = getAvatarPointerDistance();
    if (!distance) return;
    if (!avatarPinchStart) avatarPinchStart = { distance, zoom: avatarPosition.zoom };
    avatarPosition.zoom = clampAvatarZoom(avatarPinchStart.zoom * (distance / avatarPinchStart.distance));
    els.avatarZoom.value = avatarPosition.zoom.toFixed(2);
    applyAvatarTransform();
  }

  function resetAvatarPosition() {
    avatarPosition.x = 0;
    avatarPosition.y = 0;
    avatarPosition.zoom = DEFAULT_AVATAR_ZOOM;
    els.avatarZoom.value = String(DEFAULT_AVATAR_ZOOM);
    applyAvatarTransform();
  }

  function setFavoriteCard(card) {
    const cd = String(card?.cd || DEFAULT_CARD_CD).padStart(5, '0');
    const name = String(card?.name || '').trim();
    els.favoriteCard.value = cd;
    els.favoriteCardLabel.textContent = name || 'カードを選択';
    setCardPreview(card || { cd });
    updatePreview();
  }

  function populateCards(cardMap) {
    const cards = Object.values(cardMap || {})
      .filter((card) => card?.cd && card?.name)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ja'));
    if (cards.length > 0) {
      const defaultCard = cards.find((card) => card.cd === DEFAULT_CARD_CD) || cards[0];
      setFavoriteCard(defaultCard);
    } else {
      els.favoriteCardLabel.textContent = 'カードを読み込めませんでした';
      els.favoriteCard.disabled = true;
    }
  }

  async function loadCards() {
    try {
      const cardMap = await window.ensureCardMapLoaded();
      populateCards(cardMap);
    } catch (error) {
      els.favoriteCard.disabled = true;
      els.favoriteCardLabel.textContent = 'カードを読み込めませんでした';
      setStatus('カードデータを読み込めませんでした。', true);
      console.error('[profile-card] カードデータ読み込み失敗', error);
    }
  }

  function handleAvatarFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = URL.createObjectURL(file);
    els.avatarCropPreview.src = avatarObjectUrl;
    els.avatarPreview.src = avatarObjectUrl;
    els.avatarPreview.alt = '読み込んだアイコン画像';
    resetAvatarPosition();
    setStatus('アイコン画像を反映しました。');
  }

  function useDefaultAvatar() {
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = '';
    els.avatarFile.value = '';
    els.avatarCropPreview.src = DEFAULT_AVATAR_SRC;
    els.avatarPreview.src = DEFAULT_AVATAR_SRC;
    els.avatarPreview.alt = '基本アイコン';
    resetAvatarPosition();
    setStatus('基本アイコンを反映しました。');
  }

  // 書き出しライブラリが未対応の色表記を、複製上だけ同じRGB色に変換する
  function normalizeExportColors(clonedDocument, clonedCanvas) {
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    function toRgb(color) {
      if (!/^(color|lab|lch|oklab|oklch)\(/.test(color)) return color;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    }
    const colorProperties = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'];
    for (const element of [clonedCanvas, ...clonedCanvas.querySelectorAll('*')]) {
      const style = clonedDocument.defaultView.getComputedStyle(element);
      for (const property of colorProperties) element.style[property] = toRgb(style[property]);
      for (const property of ['boxShadow', 'textShadow']) {
        element.style[property] = style[property].replace(/(?:color|lab|lch|oklab|oklch)\([^)]*\)/g, toRgb);
      }
    }
  }

  let generatedFile = null;
  let generatedDataUrl = '';
  let sharing = false;
  const saveActions = document.getElementById('profile-card-save-actions');
  const shareButton = document.getElementById('profile-card-share');
  const saveHint = document.getElementById('profile-card-save-hint');

  function downloadGeneratedImage() {
    try {
      const link = document.createElement('a');
      link.href = generatedDataUrl;
      link.download = 'mesorogia-profile-card.png';
      link.click();
      setStatus('PNG画像のダウンロードを開始しました。');
    } catch (error) {
      setStatus('ダウンロードを開始できませんでした。もう一度お試しください。', true);
    }
  }

  function canShareGeneratedImage() {
    try {
      return typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [generatedFile] });
    } catch (error) { return false; }
  }

  async function shareGeneratedImage() {
    if (sharing || !generatedFile) return;
    sharing = true;
    shareButton.disabled = true;
    shareButton.textContent = '共有中…';
    shareButton.setAttribute('aria-busy', 'true');
    setStatus('');
    try {
      // 再試行ボタンでは、非同期処理を挟まずユーザー操作から共有を開始する
      await navigator.share({ files: [generatedFile], title: 'メソロギア プロフィールカード' });
      setStatus('共有メニューの操作が完了しました。');
    } catch (error) {
      if (error?.name === 'AbortError') {
        setStatus('共有をキャンセルしました。');
      } else if (error?.name === 'NotAllowedError') {
        saveHint.textContent = '「共有する」を押して共有メニューを開くか、PNGをダウンロードしてください。';
      } else {
        setStatus('画像を共有できませんでした。再度共有するか、PNGをダウンロードしてください。', true);
      }
    } finally {
      sharing = false;
      shareButton.disabled = false;
      shareButton.textContent = '共有する';
      shareButton.removeAttribute('aria-busy');
    }
  }

  shareButton.addEventListener('click', shareGeneratedImage);
  document.getElementById('profile-card-download').addEventListener('click', downloadGeneratedImage);
  document.getElementById('profile-card-error-close').addEventListener('click', () => { els.error.hidden = true; });

  async function exportCardImage() {
    if (els.exportButton.disabled || sharing) return;
    const isDesktop = window.matchMedia('(min-width: 769px)').matches;
    if (typeof html2canvas !== 'function') {
      setStatus('画像生成機能を読み込めませんでした。ページを再読み込みしてください。', true);
      return;
    }
    saveActions.hidden = true;
    generatedFile = null;
    generatedDataUrl = '';
    setStatus('画像を生成しています…');
    els.exportButton.disabled = true;
    els.exportButton.textContent = '生成中…';
    els.exportButton.setAttribute('aria-busy', 'true');
    try {
      // 表示中のXロゴは読み込み完了を待ってから書き出す
      if (!els.xAccountPreview.hidden) await els.xAccountLogo.decode();
      const canvas = await html2canvas(els.canvas, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
        width: PROFILE_CARD_WIDTH,
        height: PROFILE_CARD_HEIGHT,
        onclone: (clonedDocument) => {
          const clonedCanvas = clonedDocument.getElementById('profile-card-canvas');
          if (clonedCanvas) {
            clonedCanvas.style.transform = 'none';
            normalizeExportColors(clonedDocument, clonedCanvas);
          }
        }
      });
      generatedDataUrl = canvas.toDataURL('image/png');
      if (isDesktop) {
        downloadGeneratedImage();
      } else {
        const blob = await new Promise((resolve, reject) => canvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error('PNG生成失敗')), 'image/png'));
        generatedFile = new File([blob], 'mesorogia-profile-card.png', { type: 'image/png' });
        const supported = canShareGeneratedImage();
        shareButton.hidden = !supported;
        saveHint.textContent = supported
          ? '共有メニューから送信先や保存先を選べます。'
          : 'この環境では画像ファイルの共有に対応していません。PNGをダウンロードしてください。';
        saveActions.hidden = false;
        if (supported) await shareGeneratedImage();
      }
    } catch (error) {
      console.error('[profile-card] 画像生成失敗', error);
      setStatus('画像生成に失敗しました。入力内容を確認して再度お試しください。', true);
    } finally {
      els.exportButton.disabled = false;
      els.exportButton.textContent = '画像を保存';
      els.exportButton.removeAttribute('aria-busy');
    }
  }

  function resetForm() {
    els.form.reset();
    playerNameAutoFillAllowed = true;
    xAccountAutoFillAllowed = true;
    xAccountAutoFilledValue = '';
    els.playerName.value = DEFAULT_PLAYER_NAME;
    getStartedAtOptions().forEach((input) => { input.checked = input.value === DEFAULT_STARTED_AT; });
    els.favoriteRaceOptions.forEach((input) => { input.checked = input.value === 'ドラゴン'; });
    els.favoriteCategory.value = '聖焔龍（フォルティア）';
    els.favoriteCategoryLabel.textContent = els.favoriteCategory.value;
    els.favoriteCard.value = DEFAULT_CARD_CD;
    els.favoriteCardLabel.textContent = 'カードを選択';
    setCardPreview({ cd: DEFAULT_CARD_CD });
    els.mainDeck.value = 'ドラゴン速攻';
    els.xAccount.value = '';
    els.comment.value = '色々なデッキを試しながら、ランクマッチを楽しんでいます！ 気軽に対戦や交流をお願いします。';
    els.tags.querySelectorAll('input').forEach((input) => { input.checked = DEFAULT_TAGS.includes(input.value); });
    els.avatarFile.value = '';
    useDefaultAvatar();
    updatePreview();
    applyAccountPlayerName();
    applyAccountX();
    setStatus('入力を初期状態に戻しました。');
  }

  // デッキメーカーと共通の正規化・検証を使ってXを確認する
  els.xOpen.addEventListener('click', () => {
    const norm = window.normalizeHandle?.(els.xAccount.value) || '';
    if (norm) {
      const wasAutoFilled = els.xAccount.value === xAccountAutoFilledValue;
      els.xAccount.value = norm;
      if (wasAutoFilled) xAccountAutoFilledValue = norm;
    }
    updatePreview();
    const user = norm.replace(/^@/, '').trim();
    if (!user) {
      alert('Xアカウント名を入力してください');
      return;
    }
    if (!window.isValidXHandle?.(norm)) {
      alert('Xアカウント名が不正です（英数と_、最大15文字）');
      return;
    }
    window.open(`https://x.com/${encodeURIComponent(user)}`, '_blank', 'noopener');
  });

  els.form.addEventListener('input', (event) => {
    if (event.target === els.playerName) playerNameAutoFillAllowed = false;
    if (event.target === els.xAccount) {
      xAccountAutoFillAllowed = false;
      xAccountAutoFilledValue = '';
    }
    updatePreview();
  });
  els.form.addEventListener('change', (event) => {
    if (event.target === els.xAccount) {
      xAccountAutoFillAllowed = false;
      xAccountAutoFilledValue = '';
    }
    if (event.target === els.avatarFile) handleAvatarFile(event);
    if (event.target.matches('#profile-card-tags input') && getSelectedTags().length > 4) {
      event.target.checked = false;
      setStatus('タグは4個まで選択できます。', true);
    }
    updatePreview();
  });
  els.avatarZoom.addEventListener('input', () => {
    avatarPosition.zoom = clampAvatarZoom(Number(els.avatarZoom.value) || DEFAULT_AVATAR_ZOOM);
    applyAvatarTransform();
  });
  els.avatarPreset.addEventListener('click', useDefaultAvatar);
  els.avatarReset.addEventListener('click', resetAvatarPosition);
  els.avatarCrop.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    avatarPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    els.avatarCrop.setPointerCapture(event.pointerId);
    if (avatarPointers.size >= 2) {
      avatarDrag = null;
      avatarPinchStart = null;
      updateAvatarPinch();
      return;
    }
    avatarDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: avatarPosition.x, y: avatarPosition.y };
    els.avatarCrop.classList.add('is-dragging');
  });
  els.avatarCrop.addEventListener('pointermove', (event) => {
    event.preventDefault();
    if (avatarPointers.has(event.pointerId)) avatarPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (avatarPointers.size >= 2) {
      updateAvatarPinch();
      return;
    }
    if (!avatarDrag || avatarDrag.pointerId !== event.pointerId) return;
    const rect = els.avatarCrop.getBoundingClientRect();
    avatarPosition.x = Math.max(-35, Math.min(35, avatarDrag.x + ((event.clientX - avatarDrag.startX) / rect.width) * 100));
    avatarPosition.y = Math.max(-35, Math.min(35, avatarDrag.y + ((event.clientY - avatarDrag.startY) / rect.height) * 100));
    applyAvatarTransform();
  });
  const endAvatarDrag = (event) => {
    avatarPointers.delete(event.pointerId);
    if (els.avatarCrop.hasPointerCapture(event.pointerId)) els.avatarCrop.releasePointerCapture(event.pointerId);
    if (avatarPointers.size >= 2) return;
    avatarPinchStart = null;
    if (avatarPointers.size === 1) {
      const [pointerId, pointer] = avatarPointers.entries().next().value;
      avatarDrag = { pointerId, startX: pointer.x, startY: pointer.y, x: avatarPosition.x, y: avatarPosition.y };
      return;
    }
    avatarDrag = null;
    els.avatarCrop.classList.remove('is-dragging');
  };
  els.avatarCrop.addEventListener('pointerup', endAvatarDrag);
  els.avatarCrop.addEventListener('pointercancel', endAvatarDrag);
  els.exportButton.addEventListener('click', exportCardImage);
  els.resetButton.addEventListener('click', resetForm);
  els.favoriteCardOpen.addEventListener('click', openFavoriteCardModal);
  els.favoriteCardMediaOpen.addEventListener('click', openFavoriteCardModal);
  els.categoryOpen.addEventListener('click', openCategoryModal);
  els.categoryOptions.addEventListener('click', (event) => {
    const option = event.target.closest('[data-category]');
    if (option) setFavoriteCategory(option.dataset.category || '');
  });
  els.categoryClear.addEventListener('click', () => setFavoriteCategory(''));
  els.categoryModal.addEventListener('click', (event) => {
    if (event.target.matches('[data-category-modal-close]')) closeCategoryModal();
  });
  const previousReflectLoginUI = window.reflectLoginUI;
  window.reflectLoginUI = function reflectLoginUIWithProfileCard() {
    if (typeof previousReflectLoginUI === 'function') previousReflectLoginUI.apply(this, arguments);
    updateProfileAuthActions();
    if (!window.Auth?.user || !window.Auth?.token || !window.Auth?.verified) {
      if (els.loginResult.open) closeLoginResult();
      applyAccountX();
    } else if (pendingLoginAttempt === null && !pendingLoginData) {
      applyAccountX();
      applyAccountPlayerName();
    }
  };
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.categoryModal.hidden) closeCategoryModal();
  });
  renderCategoryOptions();
  if (typeof ResizeObserver === 'function') {
    const previewResizeObserver = new ResizeObserver(updatePreviewScale);
    previewResizeObserver.observe(els.previewStage);
  } else {
    window.addEventListener('resize', updatePreviewScale);
  }
  updatePreviewScale();
  els.favoriteCategoryLabel.textContent = els.favoriteCategory.value;
  els.categoryModalCurrent.textContent = els.favoriteCategory.value || '未選択';
  renderStartedAtOptions();
  els.tags.querySelectorAll('input').forEach((input) => { input.checked = DEFAULT_TAGS.includes(input.value); });
  updatePreview();
  applyAvatarTransform();
  applyAccountPlayerName();
  applyAccountX();
  updateProfileAuthActions();
  scheduleStartedAtOptionsRefresh();
  loadCards();
})();
