const mongoose = require('mongoose');

const serviceImageSchema = new mongoose.Schema(
  {
    service: {
      type: String,
      required: true,
      enum: [
        'levantamento-topografico',
        'nivelamento',
        'demarcacao',
        'locacao-de-obra',
        'calculo-de-volumetria',
        'georreferenciamento',
        'analise-por-drone'
      ]
    },
    url: { type: String, required: true }
  },
  { timestamps: true }
);

serviceImageSchema.index({ service: 1 });

module.exports = mongoose.model('ServiceImage', serviceImageSchema);
