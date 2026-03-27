const Page = require('../models/Page');
const { ok, created, fail } = require('../utils/response');

exports.getAll = async (_req, res) => {
  const pages = await Page.find({}).sort('key').lean();
  return ok(res, pages);
};

exports.getByKey = async (req, res) => {
  const page = await Page.findOne({ key: req.params.key }).lean();
  if (!page) return fail(res, 404, 'Página não encontrada');
  return ok(res, page);
};

exports.upsert = async (req, res) => {
  const { key } = req.params;
  const payload = {
    title: req.body.title,
    content: req.body.content || {},
    updatedBy: req.admin._id
  };

  const updated = await Page.findOneAndUpdate({ key }, payload, { new: true, upsert: true, runValidators: true });
  if (!updated) return fail(res, 500, 'Falha ao salvar página');
  return created(res, updated);
};

