const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 1,
      maxlength: 64
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'E-mail inválido']
    },
    password: {
      type: String,
      required: true,
      minlength: [3, 'Senha precisa ter no mínimo 3 caracteres'],
      select: false
    },
    role: {
      type: String,
      enum: ['superadmin', 'editor'],
      default: 'editor'
    },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,

    // Refresh token rotativo (armazenar apenas HASH)
    refreshTokenHash: { type: String, select: false },
    refreshTokenExpiry: { type: Date, select: false }
  },
  { timestamps: true }
);

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);

