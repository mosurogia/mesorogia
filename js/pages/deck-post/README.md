# デッキ投稿ページ JS構成 README

------------------------------------------------------------------------

## 0) 設計ルール（最重要）

このページは **「loader中心設計」＋「責務分離」** を前提とします。

- loader が唯一の読み込み順の正
- entry は起動ハブのみ
- 1ファイル＝1責務
- DOM操作はUIに集約
- ロジックは分散させない

巨大な単一ファイル化を防ぎ、
「どこを直せばいいか一目で分かる構成」を維持します。

------------------------------------------------------------------------

## 1) 最終ファイル構成（現在構成ベース）

js/pages/deck-post/

- deck-post-page-loader.js ... デッキ投稿ページ専用ローダー（唯一の正）
- deck-post-state.js ... グローバル状態管理（list/mine/postState）
- deck-post-api.js ... GAS通信ラッパー（JSONPフォールバック含む）
- deck-post-list.js ... 全投稿一覧取得・ページング・並び替え
- deck-post-filter.js ... フィルターモーダル・タグ管理・適用処理
- deck-post-cardpick.js ... カード選択モーダル（カード名検索・選択）
- deck-post-detail.js ... 右側詳細ペイン描画（デッキ表示・投稿者情報など）
- deck-post-editor.js ... 編集系モーダル（メモ/カード解説/タグ/コード）
- deck-post-export.js ... デッキ画像生成・共有URLコピー
- deck-post-modals.js ... 汎用モーダル・削除確認・トースト表示
- deck-post-utils.js ... 純粋ユーティリティ（正規化・URL生成など）
- page4.js ... 旧統合ファイル（完全移植後に削除予定）

※ すべて `deck-post-` 接頭辞で統一し、衝突を防止

------------------------------------------------------------------------

## 2) 各ファイルの役割

### deck-post-page-loader.js
- 依存順で直列ロード
- 最後に `deck-post-page:ready` を dispatch
- ページ初期化の唯一の正

### deck-post-state.js
- state.list / state.mine / postState 管理
- 現在ページ・ソートキー・キャッシュなど保持
- ゲッター/セッター提供

### deck-post-api.js
- GAS通信ラッパー
- JSONPフォールバック
- updateDeckNote / updateCardNotes / updateUserTags など提供
- 認証トークン管理

### deck-post-list.js
- 投稿一覧取得（loadListPage）
- マイ投稿プリフェッチ（prefetchMineItems）
- ページング
- ソート処理
- リスト描画制御

### deck-post-filter.js
- フィルター状態（PostFilterState / Draft）
- モーダル管理
- タグ候補生成
- 適用時に list を再描画

### deck-post-cardpick.js
- カード検索モーダル
- カード選択結果をコールバックで返す

### deck-post-detail.js
- 投稿クリック時の右側ペイン描画
- デッキカード表示
- 投稿者情報
- 公開/非公開表示
- デッキコードボックス生成

### deck-post-editor.js
- デッキメモ編集
- カード解説編集
- ユーザータグ編集
- デッキコード編集
- 保存後の state/UI 更新

### deck-post-export.js
- デッキ画像生成
- navigator.clipboard 共有処理
- トースト表示

### deck-post-modals.js
- 汎用モーダル
- 削除確認
- ヘルプモーダル
- トースト表示

### deck-post-utils.js
- escapeHtml
- buildPostShareUrl
- posterKey生成
- Xハンドル正規化
- デッキコード正規化
- DOM/API非依存の純粋関数

### page4.js
- 旧統合版
- 移植完了後に削除予定

------------------------------------------------------------------------

## 3) 初期化フロー

1. 共通JS読み込み
2. deck-post-page-loader.js 実行
3. 直列ロード完了 → deck-post-page:ready dispatch
4. loader内で初期化処理実行

------------------------------------------------------------------------

## 4) 責務分離ルール

### ❌ やらないこと

- filterロジックを list.js に混ぜない
- DOM操作を list.js / mine.js に書かない
- entry.js に実処理を書かない
- 正規化ロジックを各所に重複させない

### ✅ 守ること

- データ取得は list / mine
- DOM描画は ui
- フィルター状態は filter
- モーダルは専用ファイル
- loaderは唯一の読み込み順

------------------------------------------------------------------------

## 5) 変更時の早見表

- 投稿一覧がおかしい → deck-post-list.js
- マイ投稿がおかしい → deck-post-list.js（mine系も内包）
- フィルターが効かない → deck-post-filter.js
- カードモーダルがおかしい → deck-post-cardpick.js
- 詳細ペイン表示 → deck-post-detail.js
- 編集まわり → deck-post-editor.js
- 共有/画像生成 → deck-post-export.js
- モーダル/トースト → deck-post-modals.js
- 読み込み順がおかしい → deck-post-page-loader.js

------------------------------------------------------------------------

## 6) なぜこの構成が最適か

- 修正箇所が一瞬で特定できる
- 1ファイル肥大化を防げる
- Git競合を減らせる
- 将来の機能追加が安全

------------------------------------------------------------------------

## 7) 将来拡張方針

- ranking.js 追加
- favorite.js 追加
- campaign.js 追加（期間限定機能は必ず独立）
- filter-advanced.js 分離

ルールは変わらない：

**1ファイル1責務 + loader一元管理**