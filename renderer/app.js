// Phase 1.5: Image Loading + Save
document.addEventListener('DOMContentLoaded', initApp);

let canvas;
let placeholder;
let hasImage = false;
let originalImageDataUrl = null;
let originalImageWidth = 0;
let originalImageHeight = 0;

// Canvas expansion state
let imageOffsetX = 0;        // Image X offset within canvas
let imageOffsetY = 0;        // Image Y offset within canvas
let displayScale = 1;        // Scale factor for display
let displayImageWidth = 0;   // Displayed image width (scaled)
let displayImageHeight = 0;  // Displayed image height (scaled)

// Drawing tool state
let currentTool = null;      // 'arrow' or null
let currentColor = '#ff0000';
let isDrawing = false;
let startPoint = null;
let drawingArrow = null;

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

  // Drawing tools
  document.getElementById('btn-arrow').addEventListener('click', toggleArrowTool);
  document.getElementById('btn-text').addEventListener('click', toggleTextTool);
  document.getElementById('color-picker').addEventListener('input', updateColor);
  updateColorPreview();

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

  // Permission dialog buttons
  document.getElementById('permission-later').addEventListener('click', hidePermissionDialog);
  document.getElementById('permission-open-settings').addEventListener('click', openPermissionSettings);

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

  // Canvas mouse events for drawing
  canvas.on('mouse:down', onCanvasMouseDown);
  canvas.on('mouse:move', onCanvasMouseMove);
  canvas.on('mouse:up', onCanvasMouseUp);

  // Remove empty text when editing is finished
  canvas.on('text:editing:exited', (e) => {
    if (e.target && e.target.text && e.target.text.trim() === '') {
      canvas.remove(e.target);
      console.log('[renderer] text:editing:exited: removed empty text');
    }
  });

  // Canvas auto-expansion: only after placement is complete
  canvas.on('object:modified', updateCanvasBounds);

  // Check screen recording permission on startup
  checkScreenPermission();

  console.log('[renderer] initApp: done');
}

// Keyboard shortcuts
function handleKeyboard(e) {
  // Cmd+Shift+5: Capture screenshot
  if (e.metaKey && e.shiftKey && e.key === '5') {
    e.preventDefault();
    captureScreen();
  }
  // Cmd+Shift+C: Copy to clipboard
  if (e.metaKey && e.shiftKey && e.key === 'c') {
    e.preventDefault();
    saveToClipboard();
  }
  // Delete/Backspace: Delete selected object (but not while editing text)
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const activeObject = canvas.getActiveObject();
    // Skip if text is being edited
    if (activeObject && activeObject.isEditing) {
      return;
    }
    if (activeObject && !activeObject._isBackground) {
      e.preventDefault();
      canvas.remove(activeObject);
      canvas.discardActiveObject();
      canvas.renderAll();
      console.log('[renderer] handleKeyboard: deleted object');
      // Check if canvas can shrink
      updateCanvasBounds();
    }
  }
  // Escape: Deselect tool
  if (e.key === 'Escape') {
    setTool(null);
  }
}

// Clear canvas
function clearCanvas() {
  console.log('[renderer] clearCanvas: start');
  canvas.clear();
  canvas.backgroundColor = null;
  canvas.wrapperEl.classList.remove('visible');
  placeholder.classList.remove('hidden');
  hasImage = false;
  originalImageDataUrl = null;
  originalImageWidth = 0;
  originalImageHeight = 0;
  // Reset canvas expansion state
  imageOffsetX = 0;
  imageOffsetY = 0;
  displayScale = 1;
  displayImageWidth = 0;
  displayImageHeight = 0;
  // Reset drawing state
  isDrawing = false;
  startPoint = null;
  drawingArrow = null;
  updateSaveButtons();
  console.log('[renderer] clearCanvas: done');
}

// Update save buttons state
function updateSaveButtons() {
  document.getElementById('btn-save').disabled = !hasImage;
  document.getElementById('btn-save-toggle').disabled = !hasImage;
  document.getElementById('btn-arrow').disabled = !hasImage;
  document.getElementById('btn-text').disabled = !hasImage;
  // Deselect tool when no image
  if (!hasImage && currentTool) {
    setTool(null);
  }
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

  // Calculate multiplier to get 50% of original resolution
  const saveScale = 0.5;
  const multiplier = (originalImageWidth * saveScale) / canvas.width;

  // Fabric.js toDataURL exports canvas with background and all objects
  return canvas.toDataURL({
    format: 'png',
    multiplier: multiplier
  });
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

    // Store display dimensions
    displayScale = scale;
    displayImageWidth = Math.floor(img.width * scale);
    displayImageHeight = Math.floor(img.height * scale);

    // No initial padding - expand only when needed
    imageOffsetX = 0;
    imageOffsetY = 0;

    const canvasWidth = displayImageWidth;
    const canvasHeight = displayImageHeight;

    console.log('[renderer] loadImageFromDataUrl: scale =', scale, ', canvas =', canvasWidth, 'x', canvasHeight);

    // Set canvas size with white background (for expansion)
    canvas.setDimensions({
      width: canvasWidth,
      height: canvasHeight
    });
    canvas.backgroundColor = '#ffffff';

    // Set as background image (with scale)
    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
      originX: 'left',
      originY: 'top',
      left: 0,
      top: 0,
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

// Check screen recording permission
async function checkScreenPermission() {
  console.log('[renderer] checkScreenPermission: start');
  try {
    const status = await window.electronAPI.checkScreenPermission();
    console.log('[renderer] checkScreenPermission: status =', status);

    // Show dialog if permission is not granted
    // 'granted' = permission granted
    // 'denied' = permission denied
    // 'restricted' = restricted by system policy
    // 'not-determined' = not yet asked (first launch)
    if (status !== 'granted') {
      showPermissionDialog();
    }
  } catch (error) {
    console.error('[renderer] checkScreenPermission: error', error);
  }
}

// Show permission dialog
function showPermissionDialog() {
  console.log('[renderer] showPermissionDialog');
  document.getElementById('permission-dialog').style.display = 'flex';
}

// Hide permission dialog
function hidePermissionDialog() {
  console.log('[renderer] hidePermissionDialog');
  document.getElementById('permission-dialog').style.display = 'none';
}

// Open permission settings
function openPermissionSettings() {
  console.log('[renderer] openPermissionSettings');
  window.electronAPI.openScreenPermissionSettings();
  hidePermissionDialog();
}

// ==================== Arrow Tool ====================

// Toggle arrow tool
function toggleArrowTool() {
  if (currentTool === 'arrow') {
    setTool(null);
  } else {
    setTool('arrow');
  }
}

// Toggle text tool
function toggleTextTool() {
  if (currentTool === 'text') {
    setTool(null);
  } else {
    setTool('text');
  }
}

// Set current tool
function setTool(tool) {
  currentTool = tool;
  console.log('[renderer] setTool:', tool);

  // Update button states
  document.getElementById('btn-arrow').classList.toggle('active', tool === 'arrow');
  document.getElementById('btn-text').classList.toggle('active', tool === 'text');

  // Update canvas selection mode
  if (tool) {
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor = 'crosshair';
  } else {
    canvas.selection = true;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
  }
}

// Update color from picker
function updateColor(e) {
  currentColor = e.target.value;
  updateColorPreview();
  console.log('[renderer] updateColor:', currentColor);
}

// Update color preview
function updateColorPreview() {
  const preview = document.getElementById('color-preview');
  if (preview) {
    preview.style.backgroundColor = currentColor;
  }
}

// Canvas mouse down
function onCanvasMouseDown(opt) {
  if (!currentTool || !hasImage) return;

  const pointer = canvas.getPointer(opt.e);

  // Text tool: create text at click position
  if (currentTool === 'text') {
    const text = new fabric.IText('Text', {
      left: pointer.x,
      top: pointer.y,
      fontSize: 24,
      fill: currentColor,
      fontFamily: 'sans-serif'
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    setTool(null);
    console.log('[renderer] onCanvasMouseDown: text created');
    // Check if canvas needs expansion
    updateCanvasBounds();
    return;
  }

  // Arrow tool: start drawing
  isDrawing = true;
  startPoint = { x: pointer.x, y: pointer.y };
  console.log('[renderer] onCanvasMouseDown:', startPoint);
}

// Canvas mouse move
function onCanvasMouseMove(opt) {
  if (!isDrawing || !startPoint || !currentTool) return;

  const pointer = canvas.getPointer(opt.e);

  // Remove previous preview arrow
  if (drawingArrow) {
    canvas.remove(drawingArrow);
  }

  // Create preview arrow
  if (currentTool === 'arrow') {
    drawingArrow = createArrow(startPoint.x, startPoint.y, pointer.x, pointer.y, currentColor);
    drawingArrow.selectable = false;
    drawingArrow.evented = false;
    canvas.add(drawingArrow);
    canvas.renderAll();
  }
}

// Canvas mouse up
function onCanvasMouseUp(opt) {
  if (!isDrawing || !startPoint || !currentTool) return;

  const pointer = canvas.getPointer(opt.e);

  // Remove preview arrow
  if (drawingArrow) {
    canvas.remove(drawingArrow);
    drawingArrow = null;
  }

  // Calculate distance
  const dx = pointer.x - startPoint.x;
  const dy = pointer.y - startPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Only create arrow if it's long enough (min 10px)
  if (distance >= 10 && currentTool === 'arrow') {
    const arrow = createArrow(startPoint.x, startPoint.y, pointer.x, pointer.y, currentColor);
    canvas.add(arrow);
    canvas.setActiveObject(arrow);
    canvas.renderAll();
    console.log('[renderer] onCanvasMouseUp: arrow created');
    // Deactivate tool after placing arrow
    setTool(null);
    // Check if canvas needs expansion
    updateCanvasBounds();
  }

  isDrawing = false;
  startPoint = null;
}

// Create arrow (line + triangle head)
function createArrow(x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Line
  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke: color,
    strokeWidth: 3,
    strokeLineCap: 'round'
  });

  // Arrow head (triangle)
  const headLength = 15;
  const triangle = new fabric.Triangle({
    width: 15,
    height: 20,
    fill: color,
    left: x2,
    top: y2,
    angle: (angle * 180 / Math.PI) + 90,
    originX: 'center',
    originY: 'center'
  });

  // Group line and triangle
  return new fabric.Group([line, triangle], {
    selectable: true,
    hasControls: true,
    hasBorders: true
  });
}

// ==================== Canvas Auto-Expansion ====================

// Update canvas bounds based on object positions
function updateCanvasBounds() {
  if (!hasImage) return;

  const objects = canvas.getObjects();
  const padding = 20;

  // Image bounds in canvas coordinates
  const imgLeft = imageOffsetX;
  const imgTop = imageOffsetY;
  const imgRight = imageOffsetX + displayImageWidth;
  const imgBottom = imageOffsetY + displayImageHeight;

  // If no objects, shrink to image size
  if (objects.length === 0) {
    if (canvas.width !== displayImageWidth || canvas.height !== displayImageHeight || imageOffsetX !== 0 || imageOffsetY !== 0) {
      shrinkToImageSize();
    }
    return;
  }

  // Calculate bounds of all objects
  let objMinX = Infinity, objMinY = Infinity;
  let objMaxX = -Infinity, objMaxY = -Infinity;

  objects.forEach(obj => {
    const bound = obj.getBoundingRect();
    objMinX = Math.min(objMinX, bound.left);
    objMinY = Math.min(objMinY, bound.top);
    objMaxX = Math.max(objMaxX, bound.left + bound.width);
    objMaxY = Math.max(objMaxY, bound.top + bound.height);
  });

  // Calculate required canvas bounds
  // Left: min of image left and (object left - padding if outside image)
  const requiredLeft = objMinX < imgLeft ? objMinX - padding : imgLeft;
  // Top: min of image top and (object top - padding if outside image)
  const requiredTop = objMinY < imgTop ? objMinY - padding : imgTop;
  // Right: max of image right and (object right + padding if outside image)
  const requiredRight = objMaxX > imgRight ? objMaxX + padding : imgRight;
  // Bottom: max of image bottom and (object bottom + padding if outside image)
  const requiredBottom = objMaxY > imgBottom ? objMaxY + padding : imgBottom;

  // Calculate new canvas dimensions
  const newWidth = requiredRight - requiredLeft;
  const newHeight = requiredBottom - requiredTop;

  // Calculate new image offset in new canvas coordinates
  const newOffsetX = imageOffsetX - requiredLeft;
  const newOffsetY = imageOffsetY - requiredTop;

  // Check if resize is needed
  const needsResize = Math.abs(newWidth - canvas.width) > 1 ||
                      Math.abs(newHeight - canvas.height) > 1 ||
                      Math.abs(newOffsetX - imageOffsetX) > 1 ||
                      Math.abs(newOffsetY - imageOffsetY) > 1;

  if (needsResize) {
    resizeCanvas(newWidth, newHeight, newOffsetX, newOffsetY, requiredLeft, requiredTop);
  }
}

// Shrink canvas back to image size (when no objects outside image)
function shrinkToImageSize() {
  console.log('[renderer] shrinkToImageSize');

  // Shift objects back if image was offset
  if (imageOffsetX !== 0 || imageOffsetY !== 0) {
    canvas.getObjects().forEach(obj => {
      obj.set({
        left: obj.left - imageOffsetX,
        top: obj.top - imageOffsetY
      });
      obj.setCoords();
    });
  }

  // Reset image offset
  imageOffsetX = 0;
  imageOffsetY = 0;

  // Update background image position
  const bgImg = canvas.backgroundImage;
  if (bgImg) {
    bgImg.set({ left: 0, top: 0 });
  }

  // Resize canvas to image size
  canvas.setDimensions({
    width: displayImageWidth,
    height: displayImageHeight
  });

  canvas.renderAll();
}

// Resize canvas to new dimensions
function resizeCanvas(newWidth, newHeight, newOffsetX, newOffsetY, originShiftX, originShiftY) {
  console.log('[renderer] resizeCanvas:', newWidth, 'x', newHeight, 'newOffset:', newOffsetX, newOffsetY, 'originShift:', originShiftX, originShiftY);

  // Shift all objects by the canvas origin change
  const shiftX = -originShiftX;
  const shiftY = -originShiftY;

  if (shiftX !== 0 || shiftY !== 0) {
    canvas.getObjects().forEach(obj => {
      obj.set({
        left: obj.left + shiftX,
        top: obj.top + shiftY
      });
      obj.setCoords();
    });
  }

  // Update image offset
  imageOffsetX = newOffsetX;
  imageOffsetY = newOffsetY;

  // Update background image position
  const bgImg = canvas.backgroundImage;
  if (bgImg) {
    bgImg.set({
      left: imageOffsetX,
      top: imageOffsetY
    });
  }

  // Resize canvas
  canvas.setDimensions({
    width: newWidth,
    height: newHeight
  });

  canvas.renderAll();
}
