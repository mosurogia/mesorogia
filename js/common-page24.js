
//=======アカウント関連========

// --- authトースト/スピナーのフォールバック（未定義ページ用） ---
if (typeof window.setAuthChecking !== 'function') {
  window.setAuthChecking = function(){ /* no-op */ };
}

// ==== Auth 一本化（PIN撤去版・UI結線） ====
(function(){
  // 共通定義（common.js）から取得
  const API = window.AUTH_API_BASE || window.GAS_API_BASE;
  window.API = API;


  const LS_TOKEN = 'mos_auth_token_v1';

  const Auth = {
    user: null,
    token: null,
    verified: false,

    setDisplayName(name){
    if (!this.user) return;
    this.user.displayName = name || this.user.displayName;
    window.reflectLoginUI?.();
    },

    async whoami(){
        if (!this.token) {
          this._clear();
          window.reflectLoginUI?.();
          return { ok:false };
        }

      setAuthChecking?.(true);
      try{
        const res = await postJSON(`${API}?mode=whoami`, { token: this.token });
        if (!res?.ok || !res.user){
          this._clear();
          window.reflectLoginUI?.();
          return { ok:false };
        }
        this._save(res.user, this.token);
        this.verified = true;
        window.reflectLoginUI?.();
        return { ok:true, user: res.user };
      } finally {
        setAuthChecking?.(false);
      }
    },

      async init(){
        this.user = null;
        this.token = localStorage.getItem(LS_TOKEN) || null;
        this.verified = false;
        window.reflectLoginUI?.();

        if (this.token) {
          await this.whoami(); // ここで verified=true になる
        }
      },

    async signup(username, password, displayName='', x=''){
      const res = await postJSON(`${API}?mode=signup`, {username, password, displayName, x});
      if (!res.ok) throw new Error(res.error||'signup failed');
      this._save(res.user, res.token);
      window.reflectLoginUI?.();
      return res.user;
    },

    async login(username, password){
      const res = await postJSON(`${API}?mode=login`, {
        username,
        password,
        debug: true,   // ← ★これを足す
      });

      if (!res.ok) throw new Error(res.error||'login failed');

      // ★ デバッグ結果を確認
      if (res.__debug) {
        console.log('[login debug]', res.__debug);
      }

      this.user = res.user;
      this.token = res.token;
      this.verified = true;

      localStorage.setItem(LS_TOKEN, this.token);
      window.reflectLoginUI?.();

      return res.user;
    },

    async logout(){
      try { await postJSON(`${API}?mode=logout`, {token:this.token}); } catch(_){}
      this._clear();
      window.reflectLoginUI?.();
    },

    attachToken(body){return Object.assign({}, body, { token:this.token||'' }); },

    _save(user, token){
      this.user = user || null;
      this.token = token || null;
      this.verified = !!(user && token);

      if (this.token) localStorage.setItem(LS_TOKEN, this.token);
      else localStorage.removeItem(LS_TOKEN);
    },

    _clear(){
      this.user = null;
      this.token = null;
      this.verified = false;
      localStorage.removeItem(LS_TOKEN);
    },
  };
  window.Auth = Auth;

  async function postJSON(url, payload){
    const r = await fetch(url, {
      method: 'POST',
      // redirect: 'manual', // ❌消す（または 'follow'）
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
      body: JSON.stringify(payload || {})
    });

    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);

    try { return JSON.parse(text); }
    catch { throw new Error(`Non-JSON response: ${text.slice(0, 200)}`); }
  }

window.postJSON = postJSON;

  // ---- UI（グローバル公開版）----
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
    const $miniOut  = document.getElementById('auth-mini-loggedout');  // 「未ログイン＋ボタン」
    const $miniIn   = document.getElementById('auth-mini-loggedin');   // ログイン中（auth-logged-in-row）

    // ---- 既存エリア（大きいログイン枠）の表示/非表示 ----
    if ($form)   $form.style.display   = loggedIn ? 'none' : '';
    if ($logged) $logged.style.display = loggedIn ? '' : 'none';

    if (loggedIn){
      if ($disp)     $disp.textContent     = user.displayName || user.username || '(no name)';
    } else {
      if ($pw)       $pw.value = '';
      if ($disp)     $disp.textContent = '';
    }

    // ミニ側チップの中の ID 表示（auth-username-label）もここで更新
    if ($unameLbl){
      $unameLbl.textContent = loggedIn
        ? (user.username || user.displayName || '')
        : '';
    }

    // ---- 投稿フォーム内ミニ表示の切り替え ----
    if ($miniOut) $miniOut.style.display = loggedIn ? 'none' : '';
    if ($miniIn)  $miniIn.style.display  = loggedIn ? '' : 'none';

    // ★ mine-login-note の表示切り替え（マイ投稿ページ用）
    const note = document.querySelector('.mine-login-note');
    if (note) {
      // ログイン中なら非表示、未ログインなら表示
      note.style.display = loggedIn ? 'none' : '';
    }

    // ★ マイ投稿ヘッダーの「ログイン状況(ID)」表示を更新
    const mineName = document.getElementById('mine-login-username');
    if (mineName) {
      // ID欄なので username 優先で表示
      mineName.textContent = loggedIn
        ? (user.username || user.displayName || '')
        : '未ログイン';
    }

    // ---- デッキ投稿フォームの既定値（未入力時のみ自動入力） ----
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
  // ボタン disable / 文言
  const loginBtn  = document.getElementById('auth-login-btn-submit'); // ← 実際のログインボタン
  const signupBtn = document.getElementById('auth-signup-btn');
  if (loginBtn)  loginBtn.disabled  = !!on;
  if (signupBtn) signupBtn.disabled = !!on;

  // 上部バッジ側（あれば）
  if (typeof setAuthChecking === 'function') setAuthChecking(!!on);

  // インライン状態表示
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

      // Chrome が無視しないよう一瞬だけ表示
      form.style.left = '0px';
      form.style.top  = '0px';

      try {
          form.requestSubmit?.();
          form.submit?.();
      } catch(e){}

      // すぐ隠す（UIに見えない）
      setTimeout(() => {
          form.style.left = '-9999px';
          form.style.top  = '-9999px';
      }, 50);
  }

  // 事件: 新規登録
  async function doSignup(){
    const username    = (document.getElementById('auth-username')?.value || '').trim().toLowerCase();
    const password    = (document.getElementById('auth-password')?.value || '');
    const password2   = (document.getElementById('auth-password-confirm')?.value || '');
    const displayName = '';
    const x           = '';

    // 入力チェック
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
      const res = await Auth.signup(username, password, displayName, x);
      stopSlow();
      setAuthLoading(false, '');
      showAuthOK('登録完了');
      window.reflectLoginUI?.();
      window.onDeckPostAuthChanged?.();

      // ★ 入力欄を軽くリセット
      const modal = document.getElementById('authLoginModal');
      const pw    = document.getElementById('auth-password');
      const pw2   = document.getElementById('auth-password-confirm');
      if (pw)  pw.value  = '';
      if (pw2) pw2.value = '';

      // ★ モーダルを閉じる
      if (modal) modal.style.display = 'none';

      // ★ 閉じた後に alert（少し間をあける）
      setTimeout(() => {
        alert('新規登録しました');
      }, 100);

      // ★ パスワード保存
      triggerPasswordSave(username, password);

    }catch(e){
      stopSlow();
      setAuthLoading(false, '');
      showAuthError('登録失敗：' + (e?.message || 'unknown'));
    }
  }


  // 事件: ログイン
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
      const res = await Auth.login(username, password);
      stopSlow();
      setAuthLoading(false, '');
      showAuthOK('ログイン完了');
      window.reflectLoginUI?.();
      window.onDeckPostAuthChanged?.()

      // ★ モーダルを閉じる
      const modal = document.getElementById('authLoginModal');
      if (modal) modal.style.display = 'none';

      // ★ 閉じた後に alert（少し間をあける）
      setTimeout(() => {
        alert('ログインしました');
        location.hash = '#logged-in';
      }, 100);

      // ★ パスワード保存
      triggerPasswordSave(username, password);

    }catch(e){
      stopSlow();
      setAuthLoading(false, '');
      showAuthError('ログイン失敗：' + (e?.message || 'unknown'));
    }
  }

// 事件: ログアウト
async function doLogout(){
  const logoutBtn = document.getElementById('auth-logout-btn');
  const prevLabel = logoutBtn ? logoutBtn.textContent : '';

  // ボタン状態を「ログアウト中…」に
  if (logoutBtn){
    logoutBtn.disabled = true;
    logoutBtn.textContent = 'ログアウト中…';
  }

  // 上の「ログイン中…」バッジやインライン表示も連動
  setAuthLoading(true, 'ログアウト中…');
  const stopSlow = startSlowTimer(5000);

  try{
    // 実際のログアウト処理（token クリア＆ UI 更新）
    await Auth.logout();

    // ★ デッキ投稿側にも「ログアウトしたよ」と通知
    if (window.onDeckPostAuthChanged){
      try { window.onDeckPostAuthChanged(); } catch(_) {}
    }

    // ログイン完了メッセージなどをクリア
    const st = document.getElementById('auth-inline-status');
    if (st) st.textContent = '';

    stopSlow();
    setAuthLoading(false, '');
    alert('ログアウトしました');

  } catch(e){
    stopSlow();
    setAuthLoading(false, '');
    // 失敗時だけエラーメッセージを表示
    showAuthError('ログアウト失敗：' + (e?.message || 'unknown'));
  } finally {
    // ボタン表記を元に戻す（UIとしては未ログイン表示になっているはず）
    if (logoutBtn){
      logoutBtn.disabled = false;
      logoutBtn.textContent = prevLabel || 'ログアウト';
    }
  }
}

  // ===== X handle 正規化/検証（page2 と揃える） =====
  function normalizeHandle(raw){
    let s = String(raw || '').trim();
    if (!s) return '';

    // 全角→半角（＠含む） + 空白除去
    try { s = s.normalize('NFKC'); } catch(_) {}
    s = s.replace(/\s+/g, '');

    // URL貼り付け対策
    s = s.replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, '');

    // クエリ/パス除去
    s = s.split(/[/?#]/)[0];

    // @ は全部消して、先頭に1個だけ付け直す（途中@も消える）
    s = s.replace(/[＠@]/g, '');

    if (!s) return '';
    return '@' + s;
  }


  function isValidXHandle(handle){
    const h = String(handle || '').trim();
    // @ + 英数/_ 1〜15文字
    return /^@[A-Za-z0-9_]{1,15}$/.test(h);
  }

  // ★ 追加：他IIFEから使えるようにグローバル公開
  window.normalizeHandle  = normalizeHandle;
  window.isValidXHandle   = isValidXHandle;
  window.isEmailLikeName_ = isEmailLikeName_;

  // ===== 投稿者名のメアド混入対策（page2 と揃える） =====
  function isEmailLikeName_(s){
    const v = String(s || '').trim();
    if (!v) return false;
    if (/^mailto:/i.test(v)) return true;
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(v)) return true;
    return false;
  }


  // DOM 結線
  window.addEventListener('DOMContentLoaded', () => {
    // パスワード表示/非表示
    const pw = document.getElementById('auth-password');
    const toggle = document.getElementById('auth-pass-toggle');
    if (pw && toggle){
      toggle.addEventListener('click', () => {
        const isPw = pw.type === 'password';
        pw.type = isPw ? 'text' : 'password';
        toggle.textContent = isPw ? '非表示' : '表示';
      });
    }

    // 元の大きいログインフォーム
    document.getElementById('auth-signup-btn')?.addEventListener('click', doSignup);
    document.getElementById('auth-logout-btn')?.addEventListener('click', doLogout);


    // 認証状態の初期化（未ログイン表示からスタート）
    Auth.init();

    // Enter キーでのデフォルト送信を止める（即ログイン防止）
    const loginForm = document.getElementById('auth-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        // Enter で勝手にログインさせないため、送信そのものを止める
        e.preventDefault();
      });
    }

    // ログインボタン経由でのみログインを実行
    const loginBtn = document.getElementById('auth-login-btn-submit');
    if (loginBtn) {
      loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        doLogin();
      });
    }

    // 確認パスワード欄で Enter を押したら新規登録を実行（任意だけど便利）
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


// ========================================================
//  アカウントデータ モーダル（共通）
//  - data-open / data-close で開閉
//  - パス表示切替、Xプロフィール確認
//  - 保存: mode=updateProfile を GAS へPOST
//  - 成功時: localStorage に posterName/xAccount を保存
// ========================================================
(function(){
  function $(sel){ return document.querySelector(sel); }
  function openModal(id){ const m = document.getElementById(id); if (m) m.style.display = 'flex'; }
  function closeModal(id){ const m = document.getElementById(id); if (m) m.style.display = 'none'; }

  document.addEventListener('DOMContentLoaded', () => {

function ensureCampaignDetailModal_(){
  if (document.getElementById('campaignDetailModal')) return;

  const wrap = document.createElement('div');
  wrap.className = 'account-modal';
  wrap.id = 'campaignDetailModal';
  wrap.style.display = 'none';

  wrap.innerHTML = `
    <div class="modal-content campaign-modal" role="dialog" aria-modal="true" aria-labelledby="campaignDetailTitle">
      <div class="account-modal-head campaign-modal-head">
        <div class="campaign-head-left">
          <h3 id="campaignDetailTitle">🎉 キャンペーン詳細</h3>
          <div id="campaignDetailNameInline" class="campaign-head-sub" aria-label="キャンペーン名">（キャンペーン）</div>
        </div>
      </div>

      <div class="account-modal-body campaign-modal-body">

        <!-- 📅 開催期間（バナー表示をそのまま差し込み） -->
        <div class="campaign-card">
          <div class="campaign-card-title">📅 開催期間</div>
          <div class="campaign-card-text">
            <span id="campaignDetailRange" class="campaign-range">（日程はバナー表示に合わせて運用）</span>
          </div>
        </div>

        <!-- 🎁 報酬 -->
        <div class="campaign-card">
          <div class="campaign-card-title">🎁 報酬</div>
          <div class="campaign-card-text" id="campaignDetailPrizesText">
            （報酬：準備中）
          </div>
        </div>

        <!-- 参加方法 -->
        <div class="campaign-card">
          <div class="campaign-card-title">📝 参加方法（投稿の仕方）</div>
          <ol class="campaign-steps">
            <li><b>アカウント新規登録 or ログイン</b></li>
            <li>
              <b>投稿内のXアカウント欄を記入</b>
              <div class="campaign-warn">未入力だと、当選しても届けられません（重要）</div>
            </li>
            <li>
              <b>デッキ投稿にキャンペーン対象のタグが付いていれば応募完了</b>
              <div class="campaign-tagbox tag-chips post-tags-main" data-campaign-tagbox>
                <span class="chip active">（対象タグ：準備中）</span>
              </div>
            </li>
          </ol>
        </div>

        <!-- 応募口数 -->
        <div class="campaign-card">
          <div class="campaign-card-title">🎟 応募口数</div>
          <div class="campaign-card-text">
            <b>1ユーザーにつき最大3口まで応募OK</b><br>
            <span class="campaign-boost">たくさん投稿すると当選確率アップ！</span>
          </div>
        </div>

                <!-- 🎲 抽選方法 -->
        <div class="campaign-card">
          <div class="campaign-card-title">🎲 抽選方法</div>
          <div class="campaign-card-text" id="campaignDetailDrawText">
            【抽選枠】
            応募口数（最大3口）をもとに抽選します。
            ・同一ユーザーは最大3口まで（投稿数が多いほど当選確率アップ）

            【選考枠（オリジナリティ賞など）】
            運営が「面白い／独自性が高い」と感じたデッキを選考します。
            ・環境テンプレの丸写しではなく、狙いや工夫が伝わる構築を優先
            ・採用理由／コンセプトが分かる投稿ほど選ばれやすい
            ※選考枠は“強さ”だけで決まりません
          </div>
        </div>

        <div class="campaign-modal-footer">
          <button type="button" class="btn primary" data-close="campaignDetailModal">閉じる</button>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(wrap);
}

const DEFAULT_DRAW_TEXT =
`【抽選枠】
応募口数（最大3口）をもとに抽選します。
・同一ユーザーは最大3口まで（投稿数が多いほど当選確率アップ）

【選考枠（オリジナリティ賞など）】
運営が「面白い／独自性が高い」と感じたデッキを選考します。
・環境テンプレの丸写しではなく、狙いや工夫が伝わる構築を優先
・採用理由／コンセプトが分かる投稿ほど選ばれやすい
※選考枠は“強さ”だけで決まりません`;



  // （任意）後から対象タグを差し込む用
  window.setCampaignDetailTags = function(tags){
    const modal = document.getElementById('campaignDetailModal');
    const box = modal?.querySelector('[data-campaign-tagbox]');
    if (!box) return;

    const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
    box.replaceChildren();

    if (!list.length){
      const s = document.createElement('span');
      s.className = 'chip active';
      s.textContent = '（対象タグ：準備中）';
      box.appendChild(s);
      return;
    }
    list.forEach(t=>{
      const s = document.createElement('span');
      s.className = 'campaign-tag chip active';
      s.textContent = t;
      box.appendChild(s);
    });
  };


function escapeHtml_(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

function parseRules_(camp){
  // camp.rulesJSON が「文字列JSON」でも「オブジェクト」でも動くようにする
  const raw = camp?.rulesJSON;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(String(raw)); } catch(_) { return null; }
}

// draw: string / prizes: string[] を想定（後述）
window.setCampaignDetailRules = function(camp){
  const rules = parseRules_(camp) || {};
  const drawEl   = document.getElementById('campaignDetailDrawText');
  const prizesEl = document.getElementById('campaignDetailPrizesText');

  // 抽選方法：固定
  if (drawEl){
    drawEl.innerHTML = escapeHtml_(DEFAULT_DRAW_TEXT).replaceAll('\n','<br>');
  }

  if (!prizesEl) return;

  // ---- 報酬：新旧どっちでも表示できるようにする ----
  // 旧: rules.prizes = ["...","..."]
  // 新: rules.prize = { lottery:[{label,amount,winners}], selection:[...] }

  // 1) 旧形式（prizes配列）
  const legacy = Array.isArray(rules.prizes) ? rules.prizes.filter(Boolean) : [];

  // 2) 新形式（prize.lottery / prize.selection）
  const prizeObj = rules.prize || {};
  const lottery  = Array.isArray(prizeObj.lottery)   ? prizeObj.lottery   : [];
  const selection= Array.isArray(prizeObj.selection) ? prizeObj.selection : [];

  // 表示用文字列生成
  const fmt = (p) => {
    const label   = String(p?.label ?? '').trim();
    const amount  = Number(p?.amount ?? 0);
    const winners = Number(p?.winners ?? p?.qty ?? 0);
    const yen = amount ? `${amount.toLocaleString()}円` : '';
    const win = winners ? `${winners}名` : '';
    const mid = [yen, win].filter(Boolean).join(' / ');
    return `${label || '賞'}${mid ? `（${mid}）` : ''}`;
  };

  const blocks = [];

  if (lottery.length){
    blocks.push(`<div class="campaign-prize-block"><b>【抽選枠】</b><ul class="campaign-prize-list">${
      lottery.map(p=>`<li>${escapeHtml_(fmt(p))}</li>`).join('')
    }</ul></div>`);
  }
  if (selection.length){
    blocks.push(`<div class="campaign-prize-block"><b>【選考枠】</b><ul class="campaign-prize-list">${
      selection.map(p=>`<li>${escapeHtml_(fmt(p))}</li>`).join('')
    }</ul></div>`);
  }

  if (blocks.length){
    prizesEl.innerHTML = blocks.join('');
    return;
  }

  // 新形式が無い場合は旧形式で表示
  if (legacy.length){
    prizesEl.innerHTML =
      `<ul class="campaign-prize-list">` +
      legacy.map(p=>`<li>${escapeHtml_(p)}</li>`).join('') +
      `</ul>`;
    return;
  }

  prizesEl.textContent = '（報酬：準備中）';
};





    ensureCampaignDetailModal_();

    // モーダル開閉（全ページ共通）
    document.querySelectorAll('[data-open]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{   // ★ async を付ける
        const id = btn.getAttribute('data-open');
        if (id) openModal(id);
        // 開いたタイミングで既知情報を流し込み（whoami or localStorage）
        if (id === 'accountDataModal') {
          const uname = (window.Auth?.user?.username) || '';
          const disp  = (window.Auth?.user?.displayName) || '';
          const x     = (window.Auth?.user?.x) || '';
          const lsName = localStorage.getItem('posterName') || '';
          const lsX    = localStorage.getItem('xAccount') || '';

          const loginName  = uname || (window.Auth?.lastLoginName) || '';
          const posterName = disp || lsName || '';
          const xAccount   = x || lsX || '';

          const $login = document.getElementById('acct-login-name');
          const $pname = document.getElementById('acct-poster-name');
          const $x     = document.getElementById('acct-x');

          // 現在の情報は placeholder に表示し、value は空（＝未入力扱い）
          if ($login){ $login.placeholder = loginName ? `現在: ${loginName}` : '（未設定）'; $login.value = ''; }
          if ($pname){ $pname.placeholder = posterName ? `現在: ${posterName}` : '（未設定）'; $pname.value = ''; }
          if ($x)    { $x.placeholder     = xAccount ? `現在: ${xAccount}` : '（未設定）'; $x.value = ''; }


          // パスワード欄も毎回クリア（＝「新しいパスワード」入力欄）
          const passInput = document.getElementById('acct-password');
          if (passInput){ passInput.value = ''; }

          // 保存ボタンは「何か入力したら有効」にする（Bでロジック更新）
          const saveBtn = document.getElementById('acct-save-btn');
          if (saveBtn) saveBtn.disabled = true;
        }
        if (id === 'campaignDetailModal') {
        try {
        const camp = window.__activeCampaign || await (window.fetchActiveCampaign?.() || Promise.resolve(null));
        window.setCampaignDetailRules?.(camp);
        } catch(_) {}
        // 開催期間
        const $range = document.getElementById('campaignDetailRange');
        const $srcRange = document.getElementById('campaign-banner-range');
        if ($range) {
          const t = ($srcRange?.textContent || '').trim();
          $range.textContent = t || '（日程はバナー表示に合わせて運用）';
        }

        // キャンペーン名
        const $name = document.getElementById('campaignDetailNameInline');
        const $srcName = document.getElementById('campaign-banner-title');
        if ($name) {
          const n = ($srcName?.textContent || '').trim();
          $name.textContent = n || 'キャンペーン';
        }
        const n = (document.getElementById('campaign-banner-title')?.textContent || '').trim();
        if (n && window.setCampaignDetailTags) window.setCampaignDetailTags([n]);
        }
      });
    });
    document.querySelectorAll('[data-close]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-close');
        if (id) closeModal(id);
      });
    });

    // パスワード表示切替
    const passInput = $('#acct-password');
    const passToggle= $('#acct-pass-toggle');
    if (passToggle && passInput){
      passToggle.addEventListener('click', ()=>{
        const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passInput.setAttribute('type', type);
        passToggle.textContent = (type === 'password' ? '表示' : '非表示');
      });
    }

    // X確認（page2 と同じ仕様：正規化→検証→open）
    const xBtn = $('#acct-x-open');
    const xInput = $('#acct-x');
    if (xBtn && xInput){
      xBtn.addEventListener('click', (e)=>{
        e.preventDefault();

        const norm = normalizeHandle(xInput.value);
        if (norm) xInput.value = norm;

        const user = String(norm || '').replace(/^@/, '').trim();
        if (!user){
          alert('Xアカウント名を入力してください');
          return;
        }
        if (!isValidXHandle(norm)){
          alert('Xアカウント名が不正です（英数と_、最大15文字）');
          return;
        }
        window.open(`https://x.com/${encodeURIComponent(user)}`, '_blank', 'noopener');
      });
    }

    // ===== 保存ボタンの有効/無効（入力監視） =====
    document.addEventListener('input', () => {
      const $login = document.getElementById('acct-login-name');
      const $pwd   = document.getElementById('acct-password');
      const $pname = document.getElementById('acct-poster-name');
      const $x     = document.getElementById('acct-x');
      const btn    = document.getElementById('acct-save-btn');
      if (!btn) return;
      const any =
        ($login?.value?.trim()?.length || 0) > 0 ||
        ($pwd  ?.value?.trim()?.length || 0) > 0 ||
        ($pname?.value?.trim()?.length || 0) > 0 ||
        ($x    ?.value?.trim()?.length || 0) > 0;
      btn.disabled = !any;
    });

  });
})();

// ===== アカウント保存（共通・一元化） =====
(function setupAccountSaveOnce(){
  if (window.__acctSaveBound) return;
  window.__acctSaveBound = true;

  const API     = window.API;
  const postJSON= window.postJSON;
  const Auth    = window.Auth;

  // 差分ペイロードを作る補助
  function buildPayloadFromForm(){
    // 現在値は placeholder に「現在: foo」と入っている前提
    const curLoginRaw = (document.getElementById('acct-login-name')?.placeholder || '').trim();
    const curLogin    = curLoginRaw.replace(/^現在:\s*/,'').trim();

    const curNameRaw  = (document.getElementById('acct-poster-name')?.placeholder || '').trim();
    const curName     = curNameRaw.replace(/^現在:\s*/,'').trim();

    const curXRaw     = (document.getElementById('acct-x')?.placeholder || '').trim();
    const curX        = curXRaw.replace(/^現在:\s*/,'').trim();

    // 入力（変更希望）
    const newLogin = (document.getElementById('acct-login-name')?.value || '').trim();
    const newPass  = (document.getElementById('acct-password')?.value || '').trim();
    const newNameRaw = (document.getElementById('acct-poster-name')?.value || '').trim();
    const newXRaw    = (document.getElementById('acct-x')?.value || '').trim();

    // 差分のみ送る（GAS側は loginName で現在ユーザを特定）
    const payload = { loginName: curLogin };

    if (newLogin && newLogin.toLowerCase() !== curLogin.toLowerCase()){
      payload.newLoginName = newLogin.toLowerCase();
    }
    if (newPass){
      payload.newPassword = newPass;
    }
    // 投稿者名：メアドっぽいのは保存させない
    if (newNameRaw && isEmailLikeName_(newNameRaw)){
      alert('投稿者名にメールアドレスは入れないでください');
      return null; // 呼び出し側でハンドリング
    }
    // X：正規化して検証、OKなら payload へ（保存時もガード）
    let newXNorm = '';
    if (newXRaw){
      const norm = normalizeHandle(newXRaw);
      if (!isValidXHandle(norm)){
        alert('Xアカウント名が不正です（英数と_、最大15文字）');
        return null;
      }
      newXNorm = norm.replace(/^@/, ''); // 保存は @なし形式に統一
    }

    // 差分のみ送る
    if (newNameRaw && newNameRaw !== curName){
      payload.posterName = newNameRaw;
    }
    if (newXNorm && newXNorm !== curX){
      payload.xAccount = newXNorm;
    }
    return payload;
  }

  // 成功後に placeholder と入力欄を更新する
  function applyResultToForm(resUser){
    const $login = document.getElementById('acct-login-name');
    const $name  = document.getElementById('acct-poster-name');
    const $x     = document.getElementById('acct-x');
    const $pw    = document.getElementById('acct-password');

    if ($login){
      const now = resUser?.username || ($login.placeholder || '').replace(/^現在:\s*/,'').trim();
      $login.value = '';
      $login.placeholder = now ? `現在: ${now}` : '（未設定）';
    }
    if ($name){
      const now = resUser?.displayName ?? ($name.placeholder || '').replace(/^現在:\s*/,'').trim();
      $name.value = '';
      $name.placeholder = now ? `現在: ${now}` : '（未設定）';
    }
    if ($x){
      const now = resUser?.x ?? ($x.placeholder || '').replace(/^現在:\s*/,'').trim();
      $x.value = '';
      $x.placeholder = now ? `現在: ${now}` : '（未設定）';
    }
    if ($pw){ $pw.value = ''; }
  }

  // ★ ここを「ボタンクリック」→「フォーム submit」に変更
  const form = document.getElementById('account-data-form');
  if (!form) return;

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const btn = document.getElementById('acct-save-btn');
    if (!btn) return;

    // 1) 差分作成
    const payload = buildPayloadFromForm();
    if (!payload) return;

    // 2) 変更がない場合はブロック
    const keys = Object.keys(payload);
    if (keys.length <= 1){ // loginName しか入っていない
      alert('新しい変更データを入力してください');
      return;
    }

    // 3) 毎回パスワード確認（仕様：保存時は毎回確認する）
    const curPw = window.prompt('現在のパスワードを入力してください');
    if (!curPw || !curPw.trim()){
      alert('保存をキャンセルしました');
      return;
    }
    payload.password = curPw.trim();

    // 4) トークン添付（どちらでも認証できるが、あれば付ける）
    const sendBody = (Auth && typeof Auth.attachToken === 'function')
      ? Auth.attachToken(payload)
      : payload;

    // 5) 送信
    btn.disabled = true;
    const keep = btn.textContent;
    btn.textContent = '送信中...';

    try{
      const res = await postJSON(`${API}?mode=updateProfile`, sendBody);
      if (!res?.ok) throw new Error(res?.error || 'update failed');

      // 1) 返ってきた user があれば一旦キャッシュ更新
      if (res.user && Auth) {
        Auth._save(res.user, Auth.token);
      }

      // 2) whoami でサーバ最新を再取得
      try {
        if (typeof window.refreshWhoAmI === 'function') {
          await window.refreshWhoAmI();
        } else if (Auth && typeof Auth.whoami === 'function') {
          await Auth.whoami();
        }
      } catch(_) { /* noop */ }

      // 3) 最終ユーザーを取得してフォームの placeholder を更新
      const newUser = (Auth && Auth.user) ? Auth.user : (res.user || null);
      applyResultToForm(newUser);

      // 4) ログイン表示更新
      window.reflectLoginUI?.();

      // 5) モーダルを閉じる
      const m = document.getElementById('accountDataModal');
      if (m) m.style.display = 'none';

      alert('アカウント情報を更新しました');

    }catch(err){
      console.error(err);
      alert('保存に失敗しました：' + err.message);
    }finally{
      btn.disabled = false;
      btn.textContent = keep;
    }
  });
})();


// ======================================
//  マイ投稿用: whoami → ユーザー名反映
// ======================================
window.refreshWhoAmI = async function refreshWhoAmI(){
  if (!window.Auth) return;

  const span = document.getElementById('mine-login-username');
  const note = document.querySelector('.mine-login-note');

  const res = await Auth.whoami();  // token が無い場合は ok:false で返る想定

  const loggedIn = !!(res && res.ok && res.user);

  if (span){
    if (loggedIn){
      const u = res.user;
      span.textContent = u.displayName || u.username || 'ログイン中';
    } else {
      span.textContent = '未ログイン';
    }
  }

  // 説明文：「ログイン中は非表示」のまま維持
  if (note){
    note.style.display = loggedIn ? 'none' : '';
  }
};
