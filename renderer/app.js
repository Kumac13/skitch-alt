// Fabric.jsを読み込み（CDNから）
const fabricScript = document.createElement('script');
fabricScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';
fabricScript.onload = initApp;
document.head.appendChild(fabricScript);

// グローバル変数
let canvas;
let currentTool = 'select';
let currentColor = '#ff0000';
let backgroundImage = null;

// DOM要素
const canvasEl = document.getElementById('canvas');
const canvasContainer = document.getElementById('canvas-container');
const placeholder = document.getElementById('canvas-placeholder');
const colorPicker = document.getElementById('color-picker');
const colorPreview = document.getElementById('color-preview');

// アプリ初期化
function initApp() {
  // Fabric.jsキャンバス初期化
  canvas = new fabric.Canvas('canvas', {
    selection: true,
    preserveObjectStacking: true
  });

  // イベントリスナー設定
  setupEventListeners();

  console.log('Skitch Alt initialized');
}

// イベントリスナー設定
function setupEventListeners() {
  // ファイル操作ボタン
  document.getElementById('btn-capture').addEventListener('click', captureScreen);
  document.getElementById('btn-open').addEventListener('click', openFile);
  document.getElementById('btn-save').addEventListener('click', saveFile);
  document.getElementById('placeholder-capture').addEventListener('click', captureScreen);
  document.getElementById('placeholder-open').addEventListener('click', openFile);

  // ツールボタン
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
  });

  // 削除ボタン
  document.getElementById('btn-delete').addEventListener('click', deleteSelected);

  // カラーピッカー
  colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    colorPreview.style.backgroundColor = currentColor;
  });

  // キーボードショートカット
  document.addEventListener('keydown', handleKeyboard);

  // キャンバスイベント
  canvas.on('mouse:down', onMouseDown);
  canvas.on('mouse:move', onMouseMove);
  canvas.on('mouse:up', onMouseUp);
}

// スクリーンショット撮影
async function captureScreen() {
  try {
    const filePath = await window.electronAPI.captureScreen();
    if (filePath) {
      await loadImage(filePath);
    }
  } catch (error) {
    console.error('Screenshot failed:', error);
  }
}

// ファイルを開く
async function openFile() {
  try {
    const filePath = await window.electronAPI.openFile();
    if (filePath) {
      await loadImage(filePath);
    }
  } catch (error) {
    console.error('Open file failed:', error);
  }
}

// 画像を読み込み
async function loadImage(filePath) {
  try {
    const dataUrl = await window.electronAPI.readImage(filePath);

    fabric.Image.fromURL(dataUrl, (img) => {
      // キャンバスサイズを画像に合わせる
      canvas.setDimensions({
        width: img.width,
        height: img.height
      });

      // 背景画像として設定
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        originX: 'left',
        originY: 'top'
      });

      backgroundImage = img;

      // UIを更新
      canvasEl.classList.add('visible');
      placeholder.classList.add('hidden');

      console.log('Image loaded:', img.width, 'x', img.height);
    });
  } catch (error) {
    console.error('Load image failed:', error);
  }
}

// 画像を保存
async function saveFile() {
  if (!backgroundImage) {
    console.log('No image to save');
    return;
  }

  try {
    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1
    });

    const savedPath = await window.electronAPI.saveFile(dataUrl);
    if (savedPath) {
      console.log('Saved to:', savedPath);
    }
  } catch (error) {
    console.error('Save failed:', error);
  }
}

// ツール選択
function selectTool(tool) {
  currentTool = tool;

  // ボタンのアクティブ状態を更新
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });

  // 選択ツールの場合はオブジェクト選択を有効化
  canvas.selection = (tool === 'select');
  canvas.forEachObject(obj => {
    obj.selectable = (tool === 'select');
  });

  canvas.renderAll();
  console.log('Tool selected:', tool);
}

// 選択オブジェクトを削除
function deleteSelected() {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length > 0) {
    activeObjects.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
  }
}

// キーボードショートカット
function handleKeyboard(e) {
  // Delete/Backspace: 選択オブジェクトを削除
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement.tagName !== 'INPUT') {
      deleteSelected();
      e.preventDefault();
    }
  }

  // Ctrl/Cmd + Z: Undo（将来実装）
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    console.log('Undo (not implemented yet)');
  }

  // Escape: 選択解除
  if (e.key === 'Escape') {
    canvas.discardActiveObject();
    canvas.renderAll();
  }
}

// マウスイベント（ツールによって処理を分岐）
let isDrawing = false;
let drawingObject = null;
let startX, startY;

function onMouseDown(opt) {
  if (currentTool === 'select') return;

  const pointer = canvas.getPointer(opt.e);
  startX = pointer.x;
  startY = pointer.y;
  isDrawing = true;

  // ツールごとの開始処理（Phase 3で実装）
  switch (currentTool) {
    case 'arrow':
      // 矢印ツール開始
      break;
    case 'text':
      // テキストツール（クリックでテキスト追加）
      addText(pointer.x, pointer.y);
      isDrawing = false;
      break;
    case 'rect':
      // 矩形ツール開始
      break;
    case 'mosaic':
      // モザイクツール開始
      break;
  }
}

function onMouseMove(opt) {
  if (!isDrawing) return;

  const pointer = canvas.getPointer(opt.e);

  // ツールごとの描画処理（Phase 3で実装）
  switch (currentTool) {
    case 'arrow':
      break;
    case 'rect':
      break;
    case 'mosaic':
      break;
  }
}

function onMouseUp(opt) {
  if (!isDrawing) return;
  isDrawing = false;

  // ツールごとの終了処理（Phase 3で実装）
  switch (currentTool) {
    case 'arrow':
      break;
    case 'rect':
      break;
    case 'mosaic':
      break;
  }

  drawingObject = null;
}

// テキスト追加（基本実装）
function addText(x, y) {
  const text = new fabric.IText('テキスト', {
    left: x,
    top: y,
    fontSize: 24,
    fill: currentColor,
    fontFamily: 'sans-serif'
  });
  canvas.add(text);
  canvas.setActiveObject(text);
  text.enterEditing();
  canvas.renderAll();
}
