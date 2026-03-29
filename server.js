const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Download endpoint — accepts base64 data, returns binary with Content-Disposition
app.post('/api/download', (req, res) => {
  const { data, filename, mimetype } = req.body;
  if (!data || !filename) return res.status(400).send('Missing data or filename');

  const buffer = Buffer.from(data, 'base64');
  res.setHeader('Content-Type', mimetype || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

app.get('/{*path}', (req, res) => res.sendFile('index.html', { root: '.' }));

app.listen(5000, '0.0.0.0', () => console.log('Pixel Forge running on port 5000'));
