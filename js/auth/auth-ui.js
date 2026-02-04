/* =========================
 * auth/auth-ui.js
 * - ログインUIの表示制御・イベント結線
 * - Auth（auth-core.js）を使ってログイン/登録/ログアウトを行う
 * 依存：
 *   - window.Auth / window.postJSON / window.API（auth-core.js）
 *   - window.normalizeHandle 等（auth-utils.js はアカウント保存側で使用）
 * 公開：
 *   - window.reflectLoginUI
 * ========================= */

(function(){
const Auth = window.Auth;

// ===== UI（グローバル公開版）====
window.reflectLoginUI = function reflectLoginUI(){
    const loggedIn = !!(Auth?.user && Auth?.token && Auth?.verified);
    const user = loggedIn ? (Auth.user || {}) : null;

    // 既存のログインフォーム周り（大きい方）
    const $form     = document.getElementById('auth-login-form');
    const $logged   = document.getElementById('auth-logged-in');
    const $disp     = document.getElementById('auth-display');
    const $unameLbl = document.getElementById('auth-username-label');
    const $pw       = document.getElementById('auth-password');

    // 投稿フォーム内のミニ表示
    const $miniOut  = document.getElementById('auth-mini-loggedout');
    const $miniIn   = document.getElementById('auth-mini-loggedin');

    if ($form)   $form.style.display   = loggedIn ? 'none' : '';
    if ($logged) $logged.style.display = loggedIn ? '' : 'none';

    if (loggedIn){
    if ($disp) $disp.textContent = user.displayName || user.username || '(no name)';
    } else {
    if ($pw)   $pw.value = '';
    if ($disp) $disp.textContent = '';
    }

    if ($unameLbl){
    $unameLbl.textContent = loggedIn
        ? (user.username || user.displayName || '')
        : '';
    }

    if ($miniOut) $miniOut.style.display = loggedIn ? 'none' : '';
    if ($miniIn)  $miniIn.style.display  = loggedIn ? '' : 'none';

    // mine-login-note（マイ投稿ページ用）
    const note = document.querySelector('.mine-login-note');
    if (note) note.style.display = loggedIn ? 'none' : '';

    const mineName = document.getElementById('mine-login-username');
    if (mineName) {
    mineName.textContent = loggedIn
        ? (user.username || user.displayName || '')
        : '未ログイン';
    }

    // デッキ投稿フォームの既定値（未入力時のみ自動入力）
    const $dispInput = document.getElementById('auth-display-name');
    if (loggedIn && $dispInput && !$dispInput.value){
    $dispInput.value = user.displayName || user.username || '';
    }

    const $xInput = document.getElementById('auth-x');
    if (loggedIn && $xInput && !$xInput.value){
    $xInput.value = user.x || '';
    }
};

// ===== 認証UIフィードバック =====
function setAuthLoading(on, msg){
    const loginBtn  = document.getElementById('auth-login-btn-submit');
    const signupBtn = document.getElementById('auth-signup-btn');
    if (loginBtn)  loginBtn.disabled  = !!on;
    if (signupBtn) signupBtn.disabled = !!on;

    if (typeof window.setAuthChecking === 'function') window.setAuthChecking(!!on);

    const st = document.getElementById('auth-inline-status');
    if (st) st.textContent = msg || '';
}

function showAuthOK(msg){
    const st = document.getElementById('auth-inline-status');
    if (st) st.textContent = msg || '完了しました';
}

function showAuthError(msg){
    const st = document.getElementById('auth-inline-status');
    if (st) st.textContent = msg || 'エラーが発生しました';
}

function startSlowTimer(ms = 5000) {
    const st = document.getElementById('auth-inline-status');
    let fired = false;

    const id1 = setTimeout(() => {
    if (st && !fired && st.textContent && /中…$/.test(st.textContent)) {
        st.textContent += '（少し時間がかかっています…）';
    }
    }, ms);

    const id2 = setTimeout(() => {
    if (st && !fired && st.textContent && /時間がかかっています/.test(st.textContent)) {
        st.textContent = st.textContent.replace(/（.*?）$/, '') + '（このままお待ちください…）';
    }
    }, 15000);

    return () => { fired = true; clearTimeout(id1); clearTimeout(id2); };
}

// パスワード保存トリガー
function triggerPasswordSave(username, password){
    const form = document.getElementById('auth-login-save');
    if (!form) return;

    const u = form.querySelector('input[name="username"]');
    const p = form.querySelector('input[name="password"]');
    if (!u || !p) return;

    u.value = username || '';
    p.value = password || '';

    form.style.left = '0px';
    form.style.top  = '0px';

    try {
    form.requestSubmit?.();
    form.submit?.();
    } catch(e){}

    setTimeout(() => {
    form.style.left = '-9999px';
    form.style.top  = '-9999px';
    }, 50);
}

async function doSignup(){
    const username  = (document.getElementById('auth-username')?.value || '').trim().toLowerCase();
    const password  = (document.getElementById('auth-password')?.value || '');
    const password2 = (document.getElementById('auth-password-confirm')?.value || '');

    const displayName = '';
    const x = '';

    if (!username || !password){
    alert('ユーザー名とパスワードを入力してください');
    return;
    }
    if (!password2){
    alert('確認用パスワードを入力してください');
    return;
    }
    if (password !== password2){
    alert('パスワードが一致しません。もう一度入力してください');
    return;
    }

    setAuthLoading(true, '登録中…');
    const stopSlow = startSlowTimer(5000);
    try{
    await Auth.signup(username, password, displayName, x);
    stopSlow();
    setAuthLoading(false, '');
    showAuthOK('登録完了');
    window.reflectLoginUI?.();
    window.onDeckPostAuthChanged?.();

    const modal = document.getElementById('authLoginModal');
    const pw    = document.getElementById('auth-password');
    const pw2   = document.getElementById('auth-password-confirm');
    if (pw)  pw.value  = '';
    if (pw2) pw2.value = '';
    if (modal) modal.style.display = 'none';

    setTimeout(() => alert('新規登録しました'), 100);

    triggerPasswordSave(username, password);
    }catch(e){
    stopSlow();
    setAuthLoading(false, '');
    showAuthError('登録失敗：' + (e?.message || 'unknown'));
    }
}

async function doLogin(){
    const username = (document.getElementById('auth-username')?.value || '').trim().toLowerCase();
    const password = (document.getElementById('auth-password')?.value || '');
    if (!username || !password){
    alert('ユーザー名とパスワードを入力してください');
    return;
    }

    setAuthLoading(true, 'ログイン中…');
    const stopSlow = startSlowTimer(5000);
    try{
    await Auth.login(username, password);
    stopSlow();
    setAuthLoading(false, '');
    showAuthOK('ログイン完了');
    window.reflectLoginUI?.();
    window.onDeckPostAuthChanged?.();

    const modal = document.getElementById('authLoginModal');
    if (modal) modal.style.display = 'none';

    setTimeout(() => {
        alert('ログインしました');
        location.hash = '#logged-in';
    }, 100);

    triggerPasswordSave(username, password);

    }catch(e){
    stopSlow();
    setAuthLoading(false, '');
    showAuthError('ログイン失敗：' + (e?.message || 'unknown'));
    }
}

async function doLogout(){
    const logoutBtn = document.getElementById('auth-logout-btn');
    const prevLabel = logoutBtn ? logoutBtn.textContent : '';

    if (logoutBtn){
    logoutBtn.disabled = true;
    logoutBtn.textContent = 'ログアウト中…';
    }

    setAuthLoading(true, 'ログアウト中…');
    const stopSlow = startSlowTimer(5000);

    try{
    await Auth.logout();
    try { window.onDeckPostAuthChanged?.(); } catch(_){}

    const st = document.getElementById('auth-inline-status');
    if (st) st.textContent = '';

    stopSlow();
    setAuthLoading(false, '');
    alert('ログアウトしました');

    } catch(e){
    stopSlow();
    setAuthLoading(false, '');
    showAuthError('ログアウト失敗：' + (e?.message || 'unknown'));
    } finally {
    if (logoutBtn){
        logoutBtn.disabled = false;
        logoutBtn.textContent = prevLabel || 'ログアウト';
    }
    }
}

// DOM 結線
window.addEventListener('DOMContentLoaded', () => {
    const pw = document.getElementById('auth-password');
    const toggle = document.getElementById('auth-pass-toggle');
    if (pw && toggle){
    toggle.addEventListener('click', () => {
        const isPw = pw.type === 'password';
        pw.type = isPw ? 'text' : 'password';
        toggle.textContent = isPw ? '非表示' : '表示';
    });
    }

    document.getElementById('auth-signup-btn')?.addEventListener('click', doSignup);
    document.getElementById('auth-logout-btn')?.addEventListener('click', doLogout);

    // 認証状態の初期化
    Auth?.init?.();

    // Enter 送信抑制（即ログイン防止）
    const loginForm = document.getElementById('auth-login-form');
    if (loginForm) {
    loginForm.addEventListener('submit', (e) => e.preventDefault());
    }

    // ログインはボタン経由のみ
    const loginBtn = document.getElementById('auth-login-btn-submit');
    if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        doLogin();
    });
    }

    // 確認パスワード欄 Enter→登録
    const pwConfirm = document.getElementById('auth-password-confirm');
    if (pwConfirm) {
    pwConfirm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
        e.preventDefault();
        doSignup();
        }
    });
    }
});
})();
