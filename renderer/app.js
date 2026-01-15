// Phase 1.5: Image Loading + Save
document.addEventListener('DOMContentLoaded', initApp);

let canvas;
let placeholder;
let hasImage = false;
let originalImageDataUrl = null;
let originalImageWidth = 0;
let originalImageHeight = 0;

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

  // Save buttons
  document.getElementById('btn-save').addEventListener('click', saveToClipboard);
  document.getElementById('btn-save-toggle').addEventListener('click', toggleSaveMenu);
  document.getElementById('save-clipboard').addEventListener('click', () => {
    closeSaveMenu();
    saveToClipboard();
  });
  document.getElementById('save-file').addEventListener('click', () => {
    closeSaveMenu();
    saveToFile();
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('save-dropdown');
    if (!dropdown.contains(e.target)) {
      closeSaveMenu();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);

  // Listen for global shortcut trigger from main process
  window.electronAPI.onTriggerCapture(() => {
    console.log('[renderer] onTriggerCapture: received');
    captureScreen();
  });

  // Listen for image data from main process (via global shortcut)
  window.electronAPI.onLoadImageData((dataUrl) => {
    console.log('[renderer] onLoadImageData: received');
    loadImageFromDataUrl(dataUrl);
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
  hasImage = false;
  originalImageDataUrl = null;
  originalImageWidth = 0;
  originalImageHeight = 0;
  updateSaveButtons();
  console.log('[renderer] clearCanvas: done');
}

// Update save buttons state
function updateSaveButtons() {
  document.getElementById('btn-save').disabled = !hasImage;
  document.getElementById('btn-save-toggle').disabled = !hasImage;
}

// Toggle save menu
function toggleSaveMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('save-menu');
  menu.classList.toggle('show');
}

// Close save menu
function closeSaveMenu() {
  document.getElementById('save-menu').classList.remove('show');
}

// Get image as data URL (50% resolution for file size reduction)
function getCanvasDataUrl() {
  if (!originalImageDataUrl) return null;

  // Create offscreen canvas at 50% size
  const offscreen = document.createElement('canvas');
  const scale = 0.5;
  offscreen.width = Math.floor(originalImageWidth * scale);
  offscreen.height = Math.floor(originalImageHeight * scale);

  const img = new Image();
  img.src = originalImageDataUrl;

  const ctx = offscreen.getContext('2d');
  ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);

  return offscreen.toDataURL('image/png');
}

// Save to clipboard
async function saveToClipboard() {
  console.log('[renderer] saveToClipboard: start');
  if (!hasImage) return;

  try {
    const dataUrl = getCanvasDataUrl();
    const result = await window.electronAPI.saveToClipboard(dataUrl);
    if (result.success) {
      console.log('[renderer] saveToClipboard: done');
    } else {
      console.error('[renderer] saveToClipboard: failed', result.error);
    }
  } catch (error) {
    console.error('[renderer] saveToClipboard: error', error);
  }
}

// Save to file
async function saveToFile() {
  console.log('[renderer] saveToFile: start');
  if (!hasImage) return;

  try {
    const dataUrl = getCanvasDataUrl();
    const result = await window.electronAPI.saveToFile(dataUrl);
    if (result.success) {
      console.log('[renderer] saveToFile: saved -', result.filePath);
    } else if (result.cancelled) {
      console.log('[renderer] saveToFile: cancelled');
    } else {
      console.error('[renderer] saveToFile: failed', result.error);
    }
  } catch (error) {
    console.error('[renderer] saveToFile: error', error);
  }
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

// Load image from file path
async function loadImage(filePath) {
  console.log('[renderer] loadImage: start -', filePath);
  try {
    const dataUrl = await window.electronAPI.readImage(filePath);
    loadImageFromDataUrl(dataUrl);
  } catch (error) {
    console.error('[renderer] loadImage: error', error);
  }
}

// Load image from data URL
function loadImageFromDataUrl(dataUrl) {
  console.log('[renderer] loadImageFromDataUrl: start (length:', dataUrl.length, ')');

  // Store original for saving at full resolution
  originalImageDataUrl = dataUrl;

  fabric.Image.fromURL(dataUrl, (img) => {
    console.log('[renderer] loadImageFromDataUrl: Fabric.Image created -', img.width, 'x', img.height);

    // Store original dimensions for saving
    originalImageWidth = img.width;
    originalImageHeight = img.height;

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

    console.log('[renderer] loadImageFromDataUrl: scale =', scale, ', canvas =', canvasWidth, 'x', canvasHeight);

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
    hasImage = true;
    updateSaveButtons();

    console.log('[renderer] loadImageFromDataUrl: done');
  });
}
