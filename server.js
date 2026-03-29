const express = require('express');
const multer = require('multer');
const app = express();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static('.'));

// Download endpoint — serves file with Content-Disposition header
// Required because the download attribute doesn't work in cross-origin iframes
app.post('/api/download', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file');

  const filename = req.body.filename || 'pixel-art.png';
  const mimetype = req.body.mimetype || req.file.mimetype || 'application/octet-stream';

  res.setHeader('Content-Type', mimetype);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(req.file.buffer);
});

app.get('/{*path}', (req, res) => res.sendFile('index.html', { root: '.' }));

app.listen(5000, '0.0.0.0', () => console.log('Pixel Forge running on port 5000'));
