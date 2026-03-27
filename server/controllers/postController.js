const Post = require('../models/Post');
const { ok, created, fail } = require('../utils/response');
const { validateAndProcessImage, deleteUploadByUrl } = require('../config/multer');
const { logger } = require('../utils/logger');

// GET /api/posts
exports.getAll = async (req, res) => {
  const { page, status = 'published', limit = 20, sort = '-createdAt' } = req.query;

  const filter = { status };
  if (page) filter.page = page;

  const posts = await Post.find(filter)
    .sort(sort)
    .limit(Number(limit))
    .lean();

  return ok(res, posts);
};

// GET /api/posts/:slug
exports.getBySlug = async (req, res) => {
  const post = await Post.findOneAndUpdate(
    { slug: req.params.slug, status: 'published' },
    { $inc: { views: 1 } },
    { new: true }
  ).lean();

  if (!post) return fail(res, 404, 'Post não encontrado');
  return ok(res, post);
};

// GET /api/posts/id/:id (admin helper)
exports.getById = async (req, res) => {
  const post = await Post.findById(req.params.id).lean();
  if (!post) return fail(res, 404, 'Post não encontrado');
  return ok(res, post);
};

// POST /api/posts
exports.create = async (req, res) => {
  const data = { ...req.body, createdBy: req.admin._id };

  if (req.file) {
    data.image = await validateAndProcessImage(req.file);
  }

  const post = await Post.create(data);
  global.broadcast?.('post:created', { id: post._id, page: post.page, status: post.status });
  return created(res, post);
};

// PUT /api/posts/:id
exports.update = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return fail(res, 404, 'Post não encontrado');

  Object.assign(post, req.body);

  if (req.file) {
    deleteUploadByUrl(post.image?.url);
    deleteUploadByUrl(post.image?.thumb);
    post.image = await validateAndProcessImage(req.file);
  }

  await post.save();
  global.broadcast?.('post:updated', { id: post._id, page: post.page, status: post.status });
  return ok(res, post);
};

// PATCH /api/posts/:id
exports.patch = async (req, res) => {
  const allowed = ['title', 'caption', 'body', 'page', 'status', 'order'];
  const patch = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }

  const updated = await Post.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
  if (!updated) return fail(res, 404, 'Post não encontrado');

  global.broadcast?.('post:updated', { id: updated._id, page: updated.page, status: updated.status });
  return ok(res, updated);
};

// DELETE /api/posts/:id
exports.remove = async (req, res) => {
  const post = await Post.findByIdAndDelete(req.params.id);
  if (!post) return fail(res, 404, 'Post não encontrado');

  deleteUploadByUrl(post.image?.url);
  deleteUploadByUrl(post.image?.thumb);

  global.broadcast?.('post:deleted', { id: post._id });
  logger.info({ msg: 'Post removido', adminId: req.admin?._id, postId: post._id });
  return ok(res, { removed: true });
};

// PATCH /api/posts/:id/order
exports.reorder = async (req, res) => {
  const { order } = req.body;
  if (typeof order !== 'number') return fail(res, 422, 'Order inválido');

  const updated = await Post.findByIdAndUpdate(req.params.id, { order }, { new: true });
  if (!updated) return fail(res, 404, 'Post não encontrado');
  return ok(res, updated);
};

