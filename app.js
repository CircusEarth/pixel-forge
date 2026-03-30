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
const bpmDisplay = document.getElementById('bpmDisplay');
const bpmUp = document.getElementById('bpmUp');
const bpmDown = document.getElementById('bpmDown');
const bpmControl = document.getElementById('bpmControl');

const pCtx = pixelCanvas.getContext('2d');
const gCtx = gridCanvas.getContext('2d');
const cCtx = cursorCanvas.getContext('2d');

// --- Compute canvas display size ---
function getCanvasDisplaySize() {
  const area = document.querySelector('.canvas-area');
  const maxW = area.clientWidth - 48;
  const maxH = area.clientHeight - 60;
  const maxDim = Math.min(maxW, maxH, 640);
  const cellSize = Math.floor(maxDim / gridSize);
  return cellSize * gridSize;
}

// --- Initialize ---
function initCanvas() {
  const displaySize = getCanvasDisplaySize();

  [pixelCanvas, gridCanvas, cursorCanvas].forEach(c => {
    c.width = displaySize;
    c.height = displaySize;
    c.style.width = displaySize + 'px';
    c.style.height = displaySize + 'px';
  });

  canvasWrapper.style.width = displaySize + 'px';
  canvasWrapper.style.height = displaySize + 'px';

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

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const px = Math.floor(x * cellSize);
      const py = Math.floor(y * cellSize);
      const pw = Math.floor((x + 1) * cellSize) - px;
      const ph = Math.floor((y + 1) * cellSize) - py;

      const isLight = (x + y) % 2 === 0;
      pCtx.fillStyle = isLight ? '#1a1a2e' : '#151528';
      pCtx.fillRect(px, py, pw, ph);

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

// ============================================
// EXPORT — Fixed for cross-origin iframes
// ============================================

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

  // Use toDataURL → base64 → POST to server (reliable in cross-origin iframes)
  const dataUrl = exportCanvas.toDataURL(mimeType, quality);
  const base64 = dataUrl.split(',')[1];
  const filename = `pixel-forge-${gridSize}x${gridSize}.${format}`;

  fetch('./api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64, filename, mimetype: mimeType })
  })
  .then(res => {
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  })
  .then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  })
  .catch(err => {
    console.error('Export error:', err);
    // Fallback: direct data URL download
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
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

  const base64 = btoa(unescape(encodeURIComponent(svg)));
  const filename = `pixel-forge-${gridSize}x${gridSize}.svg`;

  fetch('./api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64, filename, mimetype: 'image/svg+xml' })
  })
  .then(res => {
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  })
  .then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  })
  .catch(() => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
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
    case 'b': setTool('brush'); break;
    case 'e': setTool('eraser'); break;
    case 'f': setTool('fill'); break;
    case 'i': setTool('eyedropper'); break;
    case 'z':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) document.getElementById('redoBtn').click();
        else document.getElementById('undoBtn').click();
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
// PROCEDURAL CHIPTUNE ENGINE (Web Audio API)
// ============================================
// Generates a brand new song every time you toggle music on.
// Uses music theory: picks a random key/scale, generates
// melody, bass, and arp patterns procedurally.

let audioCtx = null;
let musicPlaying = false;
let musicNodes = [];
let musicInterval = null;
let masterGain = null;
let currentBPM = 140;
let melodyStep = 0;
let currentSong = null; // holds the generated patterns

const MIN_BPM = 60;
const MAX_BPM = 240;
const BPM_STEP = 10;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// --- SFX ---
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
      osc.start(now); osc.stop(now + 0.05);
      break;
    case 'erase':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
      break;
    case 'click':
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.start(now); osc.stop(now + 0.03);
      break;
    case 'fill':
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
      break;
    case 'pick':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.06);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now); osc.stop(now + 0.06);
      break;
    case 'export': {
      osc.type = 'square';
      osc.frequency.setValueAtTime(523, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
      const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
      o2.connect(g2); g2.connect(audioCtx.destination);
      o2.type = 'square'; o2.frequency.setValueAtTime(659, now + 0.1);
      g2.gain.setValueAtTime(0.1, now + 0.1);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      o2.start(now + 0.1); o2.stop(now + 0.2);
      const o3 = audioCtx.createOscillator(), g3 = audioCtx.createGain();
      o3.connect(g3); g3.connect(audioCtx.destination);
      o3.type = 'square'; o3.frequency.setValueAtTime(784, now + 0.2);
      g3.gain.setValueAtTime(0.1, now + 0.2);
      g3.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      o3.start(now + 0.2); o3.stop(now + 0.35);
      break;
    }
    case 'clear':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
  }
}

// ============================================
// PROCEDURAL SONG GENERATOR
// ============================================

// Note frequencies for 3 octaves
function noteFreq(note, octave) {
  const semitones = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  const midi = 12 * (octave + 1) + (semitones[note] || 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Scale definitions (intervals from root)
const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

const ROOT_NOTES = ['C', 'D', 'E', 'F', 'G', 'A'];
const SCALE_NAMES = Object.keys(SCALES);

// Get frequencies for a scale across octaves
function getScaleFreqs(root, scaleName, octaveStart, octaveEnd) {
  const rootSemitone = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[root] || 0;
  const intervals = SCALES[scaleName];
  const freqs = [];
  for (let oct = octaveStart; oct <= octaveEnd; oct++) {
    for (const interval of intervals) {
      const midi = 12 * (oct + 1) + rootSemitone + interval;
      freqs.push(440 * Math.pow(2, (midi - 69) / 12));
    }
  }
  return freqs;
}

// Chord progressions (scale degree indices, 0-based)
const PROGRESSIONS = [
  [0, 3, 4, 4],   // I-IV-V-V
  [0, 0, 3, 4],   // I-I-IV-V
  [0, 5, 3, 4],   // I-vi-IV-V
  [0, 3, 5, 4],   // I-IV-vi-V
  [0, 2, 3, 4],   // I-iii-IV-V
  [0, 4, 5, 3],   // I-V-vi-IV
  [0, 3, 0, 4],   // I-IV-I-V
  [5, 3, 0, 4],   // vi-IV-I-V
];

// Melody rhythm patterns (1 = note, 0 = rest, per 16th note, 16 steps = 1 bar)
const RHYTHM_PATTERNS = [
  [1,0,1,0, 1,1,0,1, 0,1,0,0, 1,0,1,0],
  [1,1,0,1, 0,0,1,0, 1,0,1,1, 0,1,0,0],
  [1,0,0,1, 1,0,1,0, 0,1,0,1, 1,0,0,1],
  [1,1,1,0, 1,0,0,1, 1,0,1,0, 0,1,1,0],
  [1,0,1,1, 0,1,0,0, 1,1,0,1, 0,0,1,0],
  [0,1,1,0, 1,0,1,1, 0,0,1,0, 1,1,0,1],
];

// Bass rhythm patterns
const BASS_RHYTHMS = [
  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
  [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
  [1,0,1,0, 0,0,1,0, 1,0,1,0, 0,0,1,0],
  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,1,0,0],
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateSong() {
  const root = pick(ROOT_NOTES);
  const scaleName = pick(SCALE_NAMES);
  const progression = pick(PROGRESSIONS);
  const melodyRhythm = pick(RHYTHM_PATTERNS);
  const bassRhythm = pick(BASS_RHYTHMS);

  // Build scale frequencies
  const melodyFreqs = getScaleFreqs(root, scaleName, 4, 5);  // octaves 4-5
  const bassFreqs = getScaleFreqs(root, scaleName, 2, 3);     // octaves 2-3
  const arpFreqs = getScaleFreqs(root, scaleName, 4, 5);      // octaves 4-5

  const intervals = SCALES[scaleName];
  const SONG_LENGTH = 64; // 4 bars of 16 sixteenth notes

  // Generate melody: walk through scale with occasional jumps
  const melody = [];
  let melIdx = Math.floor(melodyFreqs.length / 3); // start mid-range
  for (let i = 0; i < SONG_LENGTH; i++) {
    const barBeat = i % 16;
    const rhythmHit = melodyRhythm[barBeat];
    if (rhythmHit) {
      // Stepwise motion with occasional jumps
      const jump = Math.random();
      if (jump < 0.5) melIdx += pick([-1, 1]);
      else if (jump < 0.75) melIdx += pick([-2, 2]);
      else if (jump < 0.9) melIdx += pick([-3, 3]);
      // On beat 0 of each bar, gravitate toward chord root
      if (barBeat === 0 && Math.random() < 0.6) {
        const chordIdx = progression[Math.floor(i / 16)];
        melIdx = chordIdx + intervals.length; // push to octave 5 range
      }
      melIdx = Math.max(0, Math.min(melodyFreqs.length - 1, melIdx));
      melody.push(melodyFreqs[melIdx]);
    } else {
      melody.push(0); // rest
    }
  }

  // Generate bass: root notes of chords following bass rhythm
  const bass = [];
  for (let i = 0; i < SONG_LENGTH; i++) {
    const bar = Math.floor(i / 16);
    const barBeat = i % 16;
    const chordDegree = progression[bar % progression.length];
    const bassHit = bassRhythm[barBeat];
    if (bassHit) {
      // Root of chord in bass range
      const bassIdx = Math.min(chordDegree, bassFreqs.length - 1);
      bass.push(bassFreqs[bassIdx]);
    } else {
      bass.push(0);
    }
  }

  // Generate arp: cycle through chord tones
  const arp = [];
  for (let i = 0; i < SONG_LENGTH; i++) {
    const bar = Math.floor(i / 16);
    const chordDegree = progression[bar % progression.length];
    // Build triad from scale degree
    const triad = [0, 2, 4].map(offset => {
      const idx = chordDegree + offset;
      return arpFreqs[Math.min(idx, arpFreqs.length - 1)];
    });
    // Cycle through triad notes
    const arpIdx = i % triad.length;
    // Arp on every other step
    if (i % 2 === 0) {
      arp.push(triad[arpIdx]);
    } else {
      arp.push(0);
    }
  }

  // Pick random waveforms for variety
  const leadWaves = ['square', 'sawtooth'];
  const leadWave = pick(leadWaves);
  const arpWave = pick(['square', 'triangle']);

  return { melody, bass, arp, leadWave, arpWave, root, scaleName, length: SONG_LENGTH };
}

// --- Play a note ---
function playNote(freq, time, duration, type, volume, dest) {
  if (freq === 0 || !audioCtx) return;
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
  if (!musicPlaying || !audioCtx || !currentSong) return;

  const now = audioCtx.currentTime;
  const beat = 60 / currentBPM;
  const sixteenth = beat / 4;

  for (let i = 0; i < 16; i++) {
    const time = now + i * sixteenth;
    const step = (melodyStep + i) % currentSong.length;

    // Lead
    if (currentSong.melody[step]) {
      playNote(currentSong.melody[step], time, sixteenth * 0.8, currentSong.leadWave, 0.08, masterGain);
    }
    // Bass
    if (currentSong.bass[step]) {
      playNote(currentSong.bass[step], time, sixteenth * 0.9, 'triangle', 0.1, masterGain);
    }
    // Arp
    if (currentSong.arp[step]) {
      playNote(currentSong.arp[step], time, sixteenth * 0.5, currentSong.arpWave, 0.03, masterGain);
    }
  }

  melodyStep = (melodyStep + 16) % currentSong.length;
}

function startMusic() {
  initAudio();
  if (musicPlaying) return;
  audioCtx.resume();

  // Generate a fresh song every time
  currentSong = generateSong();

  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  masterGain.connect(audioCtx.destination);

  musicPlaying = true;
  melodyStep = 0;

  const beat = 60 / currentBPM;
  const sixteenth = beat / 4;
  const batchInterval = sixteenth * 16 * 1000 * 0.9;

  scheduleMusicBatch();
  musicInterval = setInterval(scheduleMusicBatch, batchInterval);

  bpmControl.classList.add('active');
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
  bpmControl.classList.remove('active');
}

function restartMusicWithNewTiming() {
  if (!musicPlaying) return;
  // Stop scheduling, restart with new BPM
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
  }

  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  masterGain.connect(audioCtx.destination);

  const beat = 60 / currentBPM;
  const sixteenth = beat / 4;
  const batchInterval = sixteenth * 16 * 1000 * 0.9;

  scheduleMusicBatch();
  musicInterval = setInterval(scheduleMusicBatch, batchInterval);
}

// --- Sound Toggle ---
soundToggle.addEventListener('click', () => {
  initAudio();
  // Force resume AudioContext (required in sandboxed iframes and iOS Safari)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
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

// Also listen for touchstart on sound toggle (iOS needs it)
soundToggle.addEventListener('touchend', (e) => {
  // Prevent double-fire with click
  e.preventDefault();
  soundToggle.click();
});

// --- BPM Controls ---
bpmUp.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentBPM < MAX_BPM) {
    currentBPM += BPM_STEP;
    bpmDisplay.textContent = currentBPM;
    if (musicPlaying) restartMusicWithNewTiming();
    playSFX('click');
  }
});

bpmDown.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentBPM > MIN_BPM) {
    currentBPM -= BPM_STEP;
    bpmDisplay.textContent = currentBPM;
    if (musicPlaying) restartMusicWithNewTiming();
    playSFX('click');
  }
});

// Mouse wheel on BPM display for quick adjustment
bpmControl.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.deltaY < 0 && currentBPM < MAX_BPM) {
    currentBPM += BPM_STEP;
  } else if (e.deltaY > 0 && currentBPM > MIN_BPM) {
    currentBPM -= BPM_STEP;
  }
  bpmDisplay.textContent = currentBPM;
  if (musicPlaying) restartMusicWithNewTiming();
}, { passive: false });

// ============================================
// MOBILE UI — Drawers & Tool Sync
// ============================================

const mobileColorsDrawer = document.getElementById('mobileColorsDrawer');
const mobileSettingsDrawer = document.getElementById('mobileSettingsDrawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const mobileColorPreview = document.getElementById('mobileColorPreview');
const mobileColorPicker = document.getElementById('mobileColorPicker');
const mobilePalette = document.getElementById('mobilePalette');

let activeDrawer = null;

function openDrawer(drawerId) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;

  // If same drawer, close it
  if (activeDrawer === drawerId) {
    closeDrawers();
    return;
  }

  // Close any open drawer first
  document.querySelectorAll('.mobile-drawer.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.mobile-tab-btn').forEach(b => b.classList.remove('active'));

  drawer.classList.add('open');
  drawerBackdrop.classList.add('visible');
  activeDrawer = drawerId;

  // Highlight the tab
  const panel = drawerId === 'mobileColorsDrawer' ? 'colors' : 'settings';
  document.querySelector(`.mobile-tab-btn[data-panel="${panel}"]`)?.classList.add('active');
}

function closeDrawers() {
  document.querySelectorAll('.mobile-drawer.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.mobile-tab-btn').forEach(b => b.classList.remove('active'));
  drawerBackdrop.classList.remove('visible');
  activeDrawer = null;
}

// Tab buttons
document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const panel = btn.dataset.panel;
    const drawerId = panel === 'colors' ? 'mobileColorsDrawer' : 'mobileSettingsDrawer';
    openDrawer(drawerId);
    playSFX('click');
  });
});

// Drawer handles (tap to close)
document.querySelectorAll('.drawer-handle').forEach(handle => {
  handle.addEventListener('click', () => {
    closeDrawers();
  });
});

// Backdrop tap closes
if (drawerBackdrop) {
  drawerBackdrop.addEventListener('click', closeDrawers);
}

// Mobile tool buttons
document.querySelectorAll('.mobile-tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    currentTool = tool;

    // Sync both mobile and desktop tool buttons
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    document.querySelectorAll('.mobile-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));

    closeDrawers();
    playSFX('click');
  });
});

// Build mobile palette
function buildMobilePalette() {
  if (!mobilePalette) return;
  mobilePalette.innerHTML = '';
  PALETTE.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'palette-color';
    swatch.style.background = color;
    if (color === currentColor) swatch.classList.add('active');
    swatch.addEventListener('click', () => {
      currentColor = color;
      syncColorUI();
      playSFX('click');
    });
    mobilePalette.appendChild(swatch);
  });
}

function syncColorUI() {
  colorPicker.value = currentColor;
  colorPreview.style.background = currentColor;
  if (mobileColorPicker) mobileColorPicker.value = currentColor;
  if (mobileColorPreview) mobileColorPreview.style.background = currentColor;
  updatePaletteSelection();
  // Sync mobile palette
  if (mobilePalette) {
    mobilePalette.querySelectorAll('.palette-color').forEach(el => {
      el.classList.toggle('active', rgbToHex(el.style.background) === currentColor);
    });
  }
}

// Mobile color picker
if (mobileColorPicker) {
  mobileColorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    syncColorUI();
  });
}
if (mobileColorPreview) {
  mobileColorPreview.style.background = currentColor;
}

// Mobile size buttons
document.querySelectorAll('.mobile-size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const newSize = parseInt(btn.dataset.size);
    if (newSize === gridSize) return;
    gridSize = newSize;
    // Sync both mobile and desktop size buttons
    document.querySelectorAll('.btn-size').forEach(b => b.classList.toggle('active', parseInt(b.dataset.size) === newSize));
    initCanvas();
    playSFX('click');
  });
});

// Mobile action buttons
const mobileClearBtn = document.getElementById('mobileClearBtn');
const mobileUndoBtn = document.getElementById('mobileUndoBtn');
const mobileRedoBtn = document.getElementById('mobileRedoBtn');

if (mobileClearBtn) {
  mobileClearBtn.addEventListener('click', () => {
    saveState();
    pixelData = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
    renderPixels();
    playSFX('clear');
  });
}
if (mobileUndoBtn) {
  mobileUndoBtn.addEventListener('click', () => {
    if (undoStack.length === 0) return;
    redoStack.push(pixelData.map(row => [...row]));
    pixelData = undoStack.pop();
    renderPixels();
    playSFX('click');
  });
}
if (mobileRedoBtn) {
  mobileRedoBtn.addEventListener('click', () => {
    if (redoStack.length === 0) return;
    undoStack.push(pixelData.map(row => [...row]));
    pixelData = redoStack.pop();
    renderPixels();
    playSFX('click');
  });
}

// Mobile export buttons
document.querySelectorAll('.mobile-export-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    exportImage(btn.dataset.format);
    playSFX('export');
  });
});

// Also sync desktop tool buttons with mobile
const origToolBtns = document.querySelectorAll('.tool-btn');
origToolBtns.forEach(btn => {
  const orig = btn.onclick;
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    document.querySelectorAll('.mobile-tool-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
  });
});

// --- Init ---
buildPalette();
buildMobilePalette();
initCanvas();
bpmDisplay.textContent = currentBPM;

// Audio init: try on first touch AND first click (mobile Safari needs touch)
['click', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }, { once: true });
});
