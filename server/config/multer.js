const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Detecção por magic bytes (sem pacote file-type — evita ERR_PACKAGE_PATH_NOT_EXPORTED na Vercel/Node 18).
 * Suporta apenas os tipos listados em ALLOWED_TYPES (jpeg, png, webp).
 */
function detectImageMimeFromBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function loadSharp() {
  try {
    return require('sharp');
  } catch (err) {
    const e = new Error(
      'Biblioteca de imagem indisponível neste ambiente. Em produção na Vercel, confira dependência sharp e logs do deploy.'
    );
    e.cause = err;
    throw e;
  }
}

const { UPLOAD_DIR } = require('./constants');

const isVercel = !!process.env.VERCEL;
const effectiveUploadDir = isVercel ? '/tmp/uploads' : UPLOAD_DIR;

const allowedMimes = (process.env.ALLOWED_TYPES || 'image/jpeg,image/png,image/webp')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const maxFileSize = Number(process.env.MAX_FILE_SIZE || 5 * 1024 * 1024);

const upload = multer({ limits: { fileSize: maxFileSize } });

const uploadSingle = fieldName => upload.single(fieldName);

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function getFileBuffer(file) {
  if (file.buffer) return file.buffer;
  if (file.stream) return streamToBuffer(file.stream);
  throw new Error('Arquivo sem conteúdo');
}

async function validateAndProcessImage(file) {
  const buffer = await getFileBuffer(file);
  const sharp = loadSharp();

  const mime = detectImageMimeFromBuffer(buffer);
  if (!mime || !allowedMimes.includes(mime)) {
    throw new Error('Apenas JPEG, PNG e WebP são permitidos');
  }

  const meta = await sharp(buffer).metadata();

  const mainBuffer = await sharp(buffer)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .toFormat('webp', { quality: 80 })
    .toBuffer();

  const thumbBuffer = await sharp(buffer)
    .resize(480, 320, { fit: 'cover' })
    .toFormat('webp', { quality: 70 })
    .toBuffer();

  const ImageStore = require('../models/ImageStore');

  const mainDoc = await ImageStore.create({
    data: mainBuffer,
    mimetype: 'image/webp',
    width: meta.width || null,
    height: meta.height || null,
    size: mainBuffer.length,
    originalName: file.originalname || 'upload.webp',
    isThumb: false
  });

  const thumbDoc = await ImageStore.create({
    data: thumbBuffer,
    mimetype: 'image/webp',
    size: thumbBuffer.length,
    originalName: file.originalname || 'upload-thumb.webp',
    isThumb: true,
    parentId: mainDoc._id
  });

  return {
    url: `/api/images/${mainDoc._id}`,
    thumb: `/api/images/${thumbDoc._id}`,
    mimetype: 'image/webp',
    size: buffer.length,
    width: meta.width || null,
    height: meta.height || null
  };
}

function deleteUploadByUrl(url) {
  if (!url) return;

  const mongoIdMatch = url.match(/\/api\/images\/([a-f0-9]{24})$/);
  if (mongoIdMatch) {
    const ImageStore = require('../models/ImageStore');
    ImageStore.deleteOne({ _id: mongoIdMatch[1] }).catch(() => {});
    ImageStore.deleteMany({ parentId: mongoIdMatch[1] }).catch(() => {});
    return;
  }

  const filename = url.split('/').pop();
  if (!filename) return;
  const abs = path.join(effectiveUploadDir, filename);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

module.exports = {
  uploadSingle,
  validateAndProcessImage,
  deleteUploadByUrl
};
