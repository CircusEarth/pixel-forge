# Pixel Forge — 8-Bit Pixel Art Studio

A retro arcade-themed pixel art editor with procedural chiptune music, built entirely with vanilla HTML, CSS, and JavaScript.

![Pixel Forge Screenshot](https://img.shields.io/badge/style-retro%20arcade-ff004d?style=flat-square)

## Features

### Canvas
- Default 24×24 grid with one-click switching to 16, 32, or 64 pixels
- Checkerboard transparency background
- Live pixel coordinates in the status bar

### Tools
- **Brush** — pixel-by-pixel drawing with Bresenham line interpolation
- **Eraser** — removes pixels individually
- **Fill Bucket** — flood-fill any connected region
- **Eyedropper** — sample any color from the canvas

### Color
- Full PICO-8 16-color palette
- Native color picker for custom colors

### Export
- **PNG** — transparent background, scaled to 512px+
- **JPEG** — white background
- **SVG** — true vector output with `crispEdges` rendering

### Procedural Chiptune Music
Every time you toggle the music on, a brand-new song is generated:
- Random key (C, D, E, F, G, A) and scale (major, minor, pentatonic, dorian, mixolydian)
- Randomly selected chord progressions
- Melody built with stepwise motion and occasional jumps
- Bass line following chord roots
- Arpeggios cycling through chord triads
- Randomized waveforms (square/sawtooth/triangle)

### BPM Control
- Adjustable from 60–240 BPM in steps of 10
- +/− buttons or mouse wheel
- Changes apply instantly while music plays

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| B | Brush |
| E | Eraser |
| F | Fill |
| I | Eyedropper |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS, Web Audio API
- **Backend:** Express.js (serves files + download endpoint)
- **Fonts:** Press Start 2P, Share Tech Mono (Google Fonts)
- **No build step required**

## Running Locally

```bash
npm install
node server.js
```

Open `http://localhost:5000` in your browser.

## Deployment

The app runs on any Node.js host. Some options:

- **Vercel / Netlify** — convert the download endpoint to a serverless function
- **Railway / Render** — deploy the Node.js server as-is
- **VPS** — run behind nginx with PM2

## License

MIT
