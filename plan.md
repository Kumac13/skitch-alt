# Skitch代替アプリ設計プラン

## 概要
macOS向けスクリーンショット注釈アプリをElectron + Fabric.jsで作成

## 実装ステップ

### Phase 1: 画像読み込み基盤
**目標:** 画像をキャンバスに表示できる状態にする

1. ファイルを開く → 画像をキャンバスに表示
2. スクリーンショット撮影 → 画像をキャンバスに表示

**確認方法:**
- 「ファイルを開く」→ 画像選択 → キャンバスに表示される
- 「スクリーンショット撮影」→ 範囲選択 → キャンバスに表示される

**現状:**
- ファイルを開く: ✅ 動作確認済み
- スクリーンショット: ✅ 動作確認済み（開発時はターミナルに画面収録権限が必要）
- グローバルショートカット: ✅ Cmd+Shift+5でバックグラウンドからも撮影可能

**既知の問題:**
- `pnpm start`で実行時、screencaptureは親プロセス（ターミナル）の権限で動く
- ビルド後の.appでは、アプリ自体に権限が求められる（正常動作）
- Cmd+Shift+5はmacOSシステムショートカットと競合（想定済み）

---

### Phase 1.5: 画像保存・配布
**目標:** 画像を保存でき、アプリとして配布できる状態にする

**現状:**
- クリップボードにコピー: ✅ 動作確認済み（デフォルト）
- ファイルに保存: ✅ 動作確認済み（ドロップダウンから選択）
- electron-builder設定: ✅ dmg/zip生成可能
- GitHub Actions: ❌ 削除済み（ローカルビルドに変更）
- アプリアイコン: ✅ 設定済み

**追加対応:**
- グローバルショートカット修正: ✅ ウィンドウ閉じた状態でも動作
  - スクショ撮影後にウィンドウ表示（撮影中は非表示）
  - ウィンドウ破棄時の再作成対応
- 画像解像度: ✅ 保存時は50%解像度（Retina対策、ファイルサイズ削減）
  - 将来的にオプションで切り替え可能にする（Phase 3予定）
- electron-builder: ✅ v26にアップデート（macOS 26対応）
- fabric依存削除: ✅ バンドル済みfabric.min.jsのみ使用

---

### Phase 1.6: キーボードショートカット
**目標:** よく使う操作をキーボードショートカットで実行可能にする

**現状:**
- Cmd+Shift+C: ✅ クリップボードにコピー

---

### Phase 1.7: 画面収録権限ダイアログ
**目標:** 権限がない場合にユーザーを設定画面に案内する

**背景:**
- ad-hoc署名のため、ビルドごとに署名が変わり権限がリセットされる
- Apple Developer ID署名（$99/年）で解決可能だが、個人プロジェクトのため見送り
- 代替として、権限チェック＆ガイドUIを実装

**現状:**
- 起動時権限チェック: ✅ `systemPreferences.getMediaAccessStatus('screen')`
- 権限ダイアログ表示: ✅ 権限がない場合に表示
- 設定画面を開く: ✅ システム環境設定の画面収録ページを直接開く

---

### Phase 2: 描画ツール

#### Phase 2.1: 矢印ツール ✅
**現状:**
- 矢印ツールボタン: ✅ ツールバーに追加
- カラーピッカー: ✅ 色変更可能
- 矢印描画: ✅ ドラッグで描画（リアルタイムプレビュー）
- 配置後自動OFF: ✅ すぐに調整可能
- 削除: ✅ Delete/Backspaceキー
- 移動・リサイズ・回転: ✅ Fabric.js標準機能

#### Phase 2.2: テキストツール ✅
**現状:**
- テキストツールボタン: ✅ ツールバーに追加
- カラーピッカー: ✅ 矢印ツールと共有
- テキスト配置: ✅ クリックで即編集モード
- 配置後自動OFF: ✅ すぐに調整可能
- 再編集: ✅ ダブルクリックで編集可能（Fabric.js IText）
- 空テキスト: ✅ 編集終了時に自動削除
- 削除: ✅ Delete/Backspaceキー
- 移動・リサイズ・回転: ✅ Fabric.js標準機能

#### Phase 2.3: 矩形ツール（未実装）

#### Phase 2.4: モザイクツール（未実装）

### Phase 3: その他（後で実装）
- キーボードショートカット追加
- 解像度オプション（100% / 50% 切り替え）

## 主要な実装ポイント

### スクリーンショット撮影
```javascript
const { exec } = require('child_process');
const path = require('path');
const os = require('os');

function captureScreen() {
  const tmpFile = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
  return new Promise((resolve, reject) => {
    exec(`screencapture -i ${tmpFile}`, (error) => {
      if (error) reject(error);
      else resolve(tmpFile);
    });
  });
}
```

### 矢印ツール（Fabric.js）
```javascript
function createArrow(points, color) {
  const line = new fabric.Line(points, {
    stroke: color,
    strokeWidth: 3
  });
  // 三角形の矢印ヘッドを追加
  const triangle = new fabric.Triangle({
    width: 15,
    height: 20,
    fill: color,
    // 位置と角度を計算
  });
  return new fabric.Group([line, triangle]);
}
```

### モザイク処理
```javascript
function applyMosaic(canvas, rect, blockSize = 10) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(rect.x, rect.y, rect.width, rect.height);
  // blockSizeごとに平均色を計算して塗りつぶし
}
```

## 作成場所
新規リポジトリとして `~/ghq/github.com/Kumac13/skitch-alt` に作成予定
（リポジトリ名は変更可能）

## 見積もり
基本機能が動作するMVPまで、段階的に実装
