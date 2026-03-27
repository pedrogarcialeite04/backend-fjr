const mongoose = require('mongoose');

const imageStoreSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    mimetype: { type: String, required: true, default: 'image/webp' },
    width: Number,
    height: Number,
    size: Number,
    originalName: String,
    isThumb: { type: Boolean, default: false },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImageStore' }
  },
  { timestamps: true }
);

imageStoreSchema.index({ parentId: 1 });
imageStoreSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ImageStore', imageStoreSchema);
