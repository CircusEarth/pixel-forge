// ============================================
// PIXEL FORGE — Core Application
// ============================================

// --- State ---
let gridSize = 24;
let currentColor = '#ff004d';
let currentTool = 'brush';
let isDrawing = false;
let pixelData = [];
let undoStack = [];
let redoStack = [];
let maxUndo = 50;

// PICO-8 palette
const PALETTE = [
  '#000000', '#1d2b53', '#7e2553', '#008751',
  '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
  '#ff004d', '#ffa300', '#ffec27', '#00e436',
  '#29adff', '#83769c', '#ff77a8', '#ffccaa'
];

// --- DOM refs ---
const pixelCanvas = document.getElementById('pixelCanvas');
const gridCanvas = document.getElementById('gridCanvas');
const cursorCanvas = document.getElementById('cursorCanvas');
const canvasWrapper = document.getElementById('canvasWrapper');
const colorPicker = document.getElementById('colorPicker');
const colorPreview = document.getElementById('colorPreview');
const paletteEl = document.getElementById('palette');
const canvasSizeLabel = document.getElementById('canvasSize');
const cursorPosLabel = document.getElementById('cursorPos');
const soundToggle = document.getElementById('soundToggle');
const soundIcon = document.getElementById('soundIcon');

const pCtx = pixelCanvas.getContext('2d');
const gCtx = gridCanvas.getContext('2d');
const cCtx = cursorCanvas.getContext('2d');

// --- Compute canvas display size ---
function getCanvasDisplaySize() {
  const area = document.querySelector('.canvas-area');
  const maxW = area.clientWidth - 48;
  const maxH = area.clientHeight - 60;
  const maxDim = Math.min(maxW, maxH, 640);
  // Snap to pixel multiple
  const cellSize = Math.floor(maxDim / gridSize);
  return cellSize * gridSize;
}

// --- Initialize ---
function initCanvas() {
  const displaySize = getCanvasDisplaySize();
  const cellSize = displaySize / gridSize;

  [pixelCanvas, gridCanvas, cursorCanvas].forEach(c => {
    c.width = displaySize;
    c.height = displaySize;
    c.style.width = displaySize + 'px';
    c.style.height = displaySize + 'px';
  });

  canvasWrapper.style.width = displaySize + 'px';
  canvasWrapper.style.height = displaySize + 'px';

  // Init pixel data if size changed
  pixelData = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => null)
  );

  undoStack = [];
  redoStack = [];

  drawGrid();
  renderPixels();
  canvasSizeLabel.textContent = `${gridSize} × ${gridSize}`;
}

// --- Draw Grid ---
function drawGrid() {
  const size = gridCanvas.width;
  const cellSize = size / gridSize;

  gCtx.clearRect(0, 0, size, size);
  gCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  gCtx.lineWidth = 1;

  for (let i = 0; i <= gridSize; i++) {
    const pos = Math.floor(i * cellSize) + 0.5;
    gCtx.beginPath();
    gCtx.moveTo(pos, 0);
    gCtx.lineTo(pos, size);
    gCtx.stroke();
    gCtx.beginPath();
    gCtx.moveTo(0, pos);
    gCtx.lineTo(size, pos);
    gCtx.stroke();
  }
}

// --- Render Pixels ---
function renderPixels() {
  const size = pixelCanvas.width;
  const cellSize = size / gridSize;

  pCtx.clearRect(0, 0, size, size);

  // Draw checker background for transparency
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const px = Math.floor(x * cellSize);
      const py = Math.floor(y * cellSize);
      const pw = Math.floor((x + 1) * cellSize) - px;
      const ph = Math.floor((y + 1) * cellSize) - py;

      // Checkerboard
      const isLight = (x + y) % 2 === 0;
      pCtx.fillStyle = isLight ? '#1a1a2e' : '#151528';
      pCtx.fillRect(px, py, pw, ph);

      // Pixel color
      if (pixelData[y] && pixelData[y][x]) {
        pCtx.fillStyle = pixelData[y][x];
        pCtx.fillRect(px, py, pw, ph);
      }
    }
  }
}

// --- Get cell from mouse ---
function getCellFromEvent(e) {
  const rect = cursorCanvas.getBoundingClientRect();
  const scaleX = cursorCanvas.width / rect.width;
  const scaleY = cursorCanvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const cellSize = cursorCanvas.width / gridSize;
  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);
  return { col: Math.max(0, Math.min(gridSize - 1, col)), row: Math.max(0, Math.min(gridSize - 1, row)) };
}

// --- Save state for undo ---
function saveState() {
  undoStack.push(pixelData.map(row => [...row]));
  if (undoStack.length > maxUndo) undoStack.shift();
  redoStack = [];
}

// --- Apply tool ---
function applyTool(col, row) {
  if (col < 0 || col >= gridSize || row < 0 || row >= gridSize) return;

  if (currentTool === 'brush') {
    pixelData[row][col] = currentColor;
    playSFX('draw');
  } else if (currentTool === 'eraser') {
    pixelData[row][col] = null;
    playSFX('erase');
  } else if (currentTool === 'fill') {
    floodFill(col, row, currentColor);
    playSFX('fill');
  } else if (currentTool === 'eyedropper') {
    const c = pixelData[row][col];
    if (c) {
      currentColor = c;
      colorPicker.value = c;
      colorPreview.style.background = c;
      updatePaletteSelection();
      playSFX('pick');
    }
  }

  renderPixels();
}

// --- Flood Fill ---
function floodFill(startX, startY, fillColor) {
  const targetColor = pixelData[startY][startX];
  if (targetColor === fillColor) return;

  const stack = [[startX, startY]];
  const visited = new Set();

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
    if (pixelData[y][x] !== targetColor) continue;

    visited.add(key);
    pixelData[y][x] = fillColor;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

// --- Cursor highlight ---
function drawCursorHighlight(col, row) {
  const size = cursorCanvas.width;
  const cellSize = size / gridSize;
  cCtx.clearRect(0, 0, size, size);

  if (col < 0 || col >= gridSize || row < 0 || row >= gridSize) return;

  const px = Math.floor(col * cellSize);
  const py = Math.floor(row * cellSize);
  const pw = Math.floor((col + 1) * cellSize) - px;
  const ph = Math.floor((row + 1) * cellSize) - py;

  cCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  cCtx.lineWidth = 2;
  cCtx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
}

// --- Mouse Events ---
let lastCell = null;

cursorCanvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isDrawing = true;
  const { col, row } = getCellFromEvent(e);
  saveState();
  applyTool(col, row);
  lastCell = { col, row };
});

cursorCanvas.addEventListener('mousemove', (e) => {
  const { col, row } = getCellFromEvent(e);
  drawCursorHighlight(col, row);
  cursorPosLabel.textContent = `${col}, ${row}`;

  if (isDrawing && (currentTool === 'brush' || currentTool === 'eraser')) {
    if (!lastCell || lastCell.col !== col || lastCell.row !== row) {
      // Bresenham line for smooth drawing
      if (lastCell) {
        bresenhamLine(lastCell.col, lastCell.row, col, row, (cx, cy) => {
          applyTool(cx, cy);
        });
      } else {
        applyTool(col, row);
      }
      lastCell = { col, row };
    }
  }
});

cursorCanvas.addEventListener('mouseup', () => {
  isDrawing = false;
  lastCell = null;
});

cursorCanvas.addEventListener('mouseleave', () => {
  isDrawing = false;
  lastCell = null;
  cCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  cursorPosLabel.textContent = '—, —';
});

// Bresenham line algorithm
function bresenhamLine(x0, y0, x1, y1, callback) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    callback(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

// --- Touch support ---
cursorCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY, button: 0 });
  cursorCanvas.dispatchEvent(mouseEvent);
}, { passive: false });

cursorCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
  cursorCanvas.dispatchEvent(mouseEvent);
}, { passive: false });

cursorCanvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  cursorCanvas.dispatchEvent(new MouseEvent('mouseup'));
}, { passive: false });

// --- Palette ---
function buildPalette() {
  paletteEl.innerHTML = '';
  PALETTE.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'palette-color';
    swatch.style.background = color;
    if (color === currentColor) swatch.classList.add('active');
    swatch.addEventListener('click', () => {
      currentColor = color;
      colorPicker.value = color;
      colorPreview.style.background = color;
      updatePaletteSelection();
      playSFX('click');
    });
    paletteEl.appendChild(swatch);
  });
}

function updatePaletteSelection() {
  document.querySelectorAll('.palette-color').forEach(el => {
    el.classList.toggle('active', el.style.background === currentColor || rgbToHex(el.style.background) === currentColor);
  });
}

function rgbToHex(rgb) {
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/\d+/g);
  if (!match) return rgb;
  return '#' + match.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}

// --- Color picker ---
colorPicker.addEventListener('input', (e) => {
  currentColor = e.target.value;
  colorPreview.style.background = currentColor;
  updatePaletteSelection();
});

colorPreview.style.background = currentColor;

// --- Tool selection ---
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentTool = btn.dataset.tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playSFX('click');
  });
});

// --- Size selection ---
document.querySelectorAll('.btn-size').forEach(btn => {
  btn.addEventListener('click', () => {
    const newSize = parseInt(btn.dataset.size);
    if (newSize === gridSize) return;
    gridSize = newSize;
    document.querySelectorAll('.btn-size').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    initCanvas();
    playSFX('click');
  });
});

// --- Actions ---
document.getElementById('clearBtn').addEventListener('click', () => {
  saveState();
  pixelData = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
  renderPixels();
  playSFX('clear');
});

document.getElementById('undoBtn').addEventListener('click', () => {
  if (undoStack.length === 0) return;
  redoStack.push(pixelData.map(row => [...row]));
  pixelData = undoStack.pop();
  renderPixels();
  playSFX('click');
});

document.getElementById('redoBtn').addEventListener('click', () => {
  if (redoStack.length === 0) return;
  undoStack.push(pixelData.map(row => [...row]));
  pixelData = redoStack.pop();
  renderPixels();
  playSFX('click');
});

// --- Export ---
document.querySelectorAll('.btn-export').forEach(btn => {
  btn.addEventListener('click', () => {
    const format = btn.dataset.format;
    exportImage(format);
    playSFX('export');
  });
});

function exportImage(format) {
  if (format === 'svg') {
    exportSVG();
    return;
  }

  // Create a clean export canvas (no grid, no checker)
  const scale = Math.max(1, Math.ceil(512 / gridSize));
  const exportSize = gridSize * scale;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportSize;
  exportCanvas.height = exportSize;
  const ctx = exportCanvas.getContext('2d');

  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportSize, exportSize);
  }

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (pixelData[y][x]) {
        ctx.fillStyle = pixelData[y][x];
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'jpeg' ? 0.95 : undefined;

  exportCanvas.toBlob((blob) => {
    triggerDownload(blob, `pixel-forge-${gridSize}x${gridSize}.${format}`, mimeType);
  }, mimeType, quality);
}

function exportSVG() {
  let rects = '';
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (pixelData[y][x]) {
        rects += `  <rect x="${x}" y="${y}" width="1" height="1" fill="${pixelData[y][x]}" />\n`;
      }
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gridSize} ${gridSize}" width="${gridSize * 16}" height="${gridSize * 16}" shape-rendering="crispEdges">
${rects}</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  triggerDownload(blob, `pixel-forge-${gridSize}x${gridSize}.svg`, 'image/svg+xml');
}

function triggerDownload(blob, filename, mimeType) {
  // Use server endpoint for Content-Disposition download
  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('filename', filename);
  formData.append('mimetype', mimeType);

  fetch('./api/download', {
    method: 'POST',
    body: formData
  }).then(res => res.blob()).then(dlBlob => {
    const url = URL.createObjectURL(dlBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }).catch(() => {
    // Fallback: direct blob URL
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// --- Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.key.toLowerCase()) {
    case 'b':
      setTool('brush');
      break;
    case 'e':
      setTool('eraser');
      break;
    case 'f':
      setTool('fill');
      break;
    case 'i':
      setTool('eyedropper');
      break;
    case 'z':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
          document.getElementById('redoBtn').click();
        } else {
          document.getElementById('undoBtn').click();
        }
      }
      break;
  }
});

function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  playSFX('click');
}

// --- Resize ---
window.addEventListener('resize', () => {
  const oldData = pixelData.map(row => [...row]);
  initCanvas();
  pixelData = oldData;
  renderPixels();
});

// ============================================
// CHIPTUNE MUSIC ENGINE (Web Audio API)
// ============================================

let audioCtx = null;
let musicPlaying = false;
let musicNodes = [];
let musicInterval = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// SFX
function playSFX(type) {
  if (!audioCtx) return;
  audioCtx.resume();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  switch (type) {
    case 'draw':
      osc.type = 'square';
      osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
    case 'erase':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;
    case 'click':
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.03);
      break;
    case 'fill':
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    case 'pick':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.06);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
      break;
    case 'export':
      osc.type = 'square';
      osc.frequency.setValueAtTime(523, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      // Second note
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(659, now + 0.1);
      gain2.gain.setValueAtTime(0.1, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.2);
      // Third note
      const osc3 = audioCtx.createOscillator();
      const gain3 = audioCtx.createGain();
      osc3.connect(gain3);
      gain3.connect(audioCtx.destination);
      osc3.type = 'square';
      osc3.frequency.setValueAtTime(784, now + 0.2);
      gain3.gain.setValueAtTime(0.1, now + 0.2);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc3.start(now + 0.2);
      osc3.stop(now + 0.35);
      break;
    case 'clear':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
  }
}

// --- Chiptune Music ---
// A catchy, looping 8-bit melody using Web Audio API
const BPM = 140;
const BEAT = 60 / BPM;
const NOTE_FREQS = {
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99,
  'R': 0 // rest
};

// Lead melody (two bars repeated)
const melody = [
  'E4','E4','R','E4','R','C4','E4','R',
  'G4','R','R','R','G3','R','R','R',
  'C4','R','R','G3','R','R','E3','R',
  'R','A3','R','B3','R','A3','G3','R',
  'E4','G4','A4','R','F4','G4','R','E4',
  'R','C4','D4','B3','R','R','R','R',
  'C4','R','R','G3','R','R','E3','R',
  'R','A3','R','B3','R','A3','G3','R',
];

// Bass line
const bassLine = [
  'C3','R','C3','R','G3','R','G3','R',
  'E3','R','E3','R','C3','R','C3','R',
  'A3','R','A3','R','F3','R','F3','R',
  'G3','R','G3','R','G3','R','G3','R',
  'C3','R','C3','R','G3','R','G3','R',
  'E3','R','E3','R','C3','R','C3','R',
  'A3','R','A3','R','F3','R','F3','R',
  'G3','R','G3','R','G3','R','G3','R',
];

// Arp pattern
const arpPattern = [
  'C5','E5','G5','E5','C5','E5','G5','E5',
  'E5','G5','C5','G5','E5','G5','C5','G5',
  'A4','C5','E5','C5','A4','C5','E5','C5',
  'G4','B4','D5','B4','G4','B4','D5','B4',
  'C5','E5','G5','E5','C5','E5','G5','E5',
  'E5','G5','C5','G5','E5','G5','C5','G5',
  'A4','C5','E5','C5','A4','C5','E5','C5',
  'G4','B4','D5','B4','G4','B4','D5','B4',
];

let melodyStep = 0;
let masterGain = null;

function playNote(freq, time, duration, type, volume, dest) {
  if (freq === 0) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(volume, time);
  gain.gain.setValueAtTime(volume, time + duration * 0.7);
  gain.gain.linearRampToValueAtTime(0, time + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + duration + 0.01);
  musicNodes.push(osc, gain);
}

function scheduleMusicBatch() {
  if (!musicPlaying || !audioCtx) return;

  const now = audioCtx.currentTime;
  const sixteenth = BEAT / 4;

  // Schedule 16 steps ahead
  for (let i = 0; i < 16; i++) {
    const time = now + i * sixteenth;
    const step = (melodyStep + i) % melody.length;

    // Lead melody
    const melNote = NOTE_FREQS[melody[step]];
    if (melNote) playNote(melNote, time, sixteenth * 0.8, 'square', 0.08, masterGain);

    // Bass
    const bassNote = NOTE_FREQS[bassLine[step]];
    if (bassNote) playNote(bassNote, time, sixteenth * 0.9, 'triangle', 0.1, masterGain);

    // Arp (quieter)
    const arpNote = NOTE_FREQS[arpPattern[step]];
    if (arpNote) playNote(arpNote, time, sixteenth * 0.5, 'square', 0.03, masterGain);
  }

  melodyStep = (melodyStep + 16) % melody.length;
}

function startMusic() {
  initAudio();
  if (musicPlaying) return;
  audioCtx.resume();

  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  masterGain.connect(audioCtx.destination);

  musicPlaying = true;
  melodyStep = 0;

  const sixteenth = BEAT / 4;
  const batchInterval = sixteenth * 16 * 1000 * 0.9; // Schedule slightly early

  scheduleMusicBatch();
  musicInterval = setInterval(scheduleMusicBatch, batchInterval);
}

function stopMusic() {
  musicPlaying = false;
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
  musicNodes.forEach(node => {
    try { node.disconnect(); } catch (e) {}
  });
  musicNodes = [];
  if (masterGain) {
    try { masterGain.disconnect(); } catch (e) {}
    masterGain = null;
  }
}

// --- Sound Toggle ---
soundToggle.addEventListener('click', () => {
  initAudio();
  if (musicPlaying) {
    stopMusic();
    soundToggle.classList.remove('active');
    soundIcon.textContent = '♪ OFF';
  } else {
    startMusic();
    soundToggle.classList.add('active');
    soundIcon.textContent = '♪ ON';
  }
});

// --- Init ---
buildPalette();
initCanvas();

// Init audio context on first interaction
document.addEventListener('click', () => {
  initAudio();
}, { once: true });
