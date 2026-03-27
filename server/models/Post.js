const mongoose = require('mongoose');
const xss = require('xss');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Título é obrigatório'],
      trim: true,
      maxlength: [200, 'Título não pode exceder 200 caracteres']
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [500, 'Legenda não pode exceder 500 caracteres']
    },
    body: {
      type: String,
      trim: true,
      maxlength: [5000, 'Corpo não pode exceder 5000 caracteres']
    },
    image: {
      url: String,
      thumb: String,
      mimetype: String,
      size: Number,
      width: Number,
      height: Number
    },
    page: {
      type: String,
      enum: ['home', 'sobre', 'servicos', 'projetos'],
      required: [true, 'Página de destino é obrigatória'],
      default: 'home'
    },
    status: {
      type: String,
      enum: ['published', 'draft', 'archived'],
      default: 'draft'
    },
    slug: {
      type: String,
      unique: true
    },
    order: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  { timestamps: true }
);

function toSlug(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

postSchema.pre('validate', function (next) {
  if (this.isModified('title') && this.title) {
    this.slug = toSlug(this.title);
  }
  next();
});

postSchema.pre('save', function (next) {
  // Sanitização final contra XSS persistente
  if (this.title) this.title = xss(this.title, { whiteList: {}, stripIgnoreTag: true });
  if (this.caption) this.caption = xss(this.caption, { whiteList: {}, stripIgnoreTag: true });
  if (this.body) this.body = xss(this.body, { whiteList: {}, stripIgnoreTag: true });
  next();
});

postSchema.index({ page: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);

