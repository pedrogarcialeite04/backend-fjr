const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ['home', 'sobre', 'servicos', 'projetos', 'contato']
    },
    title: { type: String, trim: true, maxlength: 120 },
    content: { type: Object, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Page', pageSchema);

