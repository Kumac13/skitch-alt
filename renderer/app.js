// Phase 1: Image Loading Foundation
document.addEventListener('DOMContentLoaded', initApp);

let canvas;
let placeholder;

function initApp() {
  placeholder = document.getElementById('canvas-placeholder');

  // Initialize Fabric.js canvas
  canvas = new fabric.Canvas('canvas', {
    selection: false
  });

  // Setup event listeners
  document.getElementById('btn-capture').addEventListener('click', captureScreen);
  document.getElementById('btn-open').addEventListener('click', openFile);
  document.getElementById('btn-clear').addEventListener('click', clearCanvas);
  document.getElementById('placeholder-capture').addEventListener('click', captureScreen);
  document.getElementById('placeholder-open').addEventListener('click', openFile);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);

  // Listen for global shortcut trigger from main process
  window.electronAPI.onTriggerCapture(() => {
    console.log('[renderer] onTriggerCapture: received');
    captureScreen();
  });

  console.log('[renderer] initApp: done');
}

// Keyboard shortcuts
function handleKeyboard(e) {
  // Cmd+Shift+5: Capture screenshot
  if (e.metaKey && e.shiftKey && e.key === '5') {
    e.preventDefault();
    captureScreen();
  }
}

// Clear canvas
function clearCanvas() {
  console.log('[renderer] clearCanvas: start');
  canvas.clear();
  canvas.wrapperEl.classList.remove('visible');
  placeholder.classList.remove('hidden');
  console.log('[renderer] clearCanvas: done');
}

// Capture screenshot
async function captureScreen() {
  console.log('[renderer] captureScreen: start');
  try {
    const filePath = await window.electronAPI.captureScreen();
    console.log('[renderer] captureScreen: filePath =', filePath);
    if (filePath) {
      await loadImage(filePath);
    }
  } catch (error) {
    console.error('[renderer] captureScreen: error', error);
  }
}

// Open file
async function openFile() {
  console.log('[renderer] openFile: start');
  try {
    const filePath = await window.electronAPI.openFile();
    console.log('[renderer] openFile: filePath =', filePath);
    if (filePath) {
      await loadImage(filePath);
    }
  } catch (error) {
    console.error('[renderer] openFile: error', error);
  }
}

// Load image
async function loadImage(filePath) {
  console.log('[renderer] loadImage: start -', filePath);
  try {
    const dataUrl = await window.electronAPI.readImage(filePath);
    console.log('[renderer] loadImage: dataUrl received (length:', dataUrl.length, ')');

    fabric.Image.fromURL(dataUrl, (img) => {
      console.log('[renderer] loadImage: Fabric.Image created -', img.width, 'x', img.height);

      // Get editor area size
      const editorArea = document.getElementById('editor-area');
      const maxWidth = editorArea.clientWidth - 40;
      const maxHeight = editorArea.clientHeight - 40;

      // Calculate scale to fit in area
      let scale = 1;
      if (img.width > maxWidth || img.height > maxHeight) {
        scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      }

      const canvasWidth = Math.floor(img.width * scale);
      const canvasHeight = Math.floor(img.height * scale);

      console.log('[renderer] loadImage: scale =', scale, ', canvas =', canvasWidth, 'x', canvasHeight);

      // Set canvas size
      canvas.setDimensions({
        width: canvasWidth,
        height: canvasHeight
      });

      // Set as background image (with scale)
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        originX: 'left',
        originY: 'top',
        scaleX: scale,
        scaleY: scale
      });

      // Update UI
      canvas.wrapperEl.classList.add('visible');
      placeholder.classList.add('hidden');

      console.log('[renderer] loadImage: done');
    });
  } catch (error) {
    console.error('[renderer] loadImage: error', error);
  }
}
