const router = require('express').Router();
const ImageStore = require('../models/ImageStore');

router.get('/:id', async (req, res) => {
  try {
    const image = await ImageStore.findById(req.params.id);
    if (!image || !image.data) {
      return res.status(404).json({ success: false, message: 'Imagem não encontrada' });
    }

    const buf = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data);

    const etag = `"${image._id}-${image.updatedAt?.getTime?.() || 0}"`;
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.set({
      'Content-Type': image.mimetype || 'image/webp',
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': etag
    });

    return res.send(buf);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

module.exports = router;
