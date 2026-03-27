const { ok, fail } = require('../utils/response');
const { validateAndProcessImage } = require('../config/multer');

// POST /api/upload/image
exports.uploadImage = async (req, res) => {
  if (!req.file) return fail(res, 400, 'Arquivo não enviado');
  const image = await validateAndProcessImage(req.file);
  return ok(res, image);
};
