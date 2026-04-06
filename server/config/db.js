const mongoose = require('mongoose');

/**
 * Cache de conexão para ambientes serverless (Vercel): evita múltiplos connects
 * na mesma instância e reduz erro 500 por timeout/handshake.
 */
const g = global;

async function connectDb() {
  if (process.env.SKIP_DB === 'true' || !process.env.MONGODB_URI) return null;

  const uri = process.env.MONGODB_URI;
  mongoose.set('strictQuery', true);

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!g.__mongoosePromise) {
    const opts = {
      serverSelectionTimeoutMS: 15_000,
      maxPoolSize: 5
    };
    g.__mongoosePromise = mongoose
      .connect(uri, opts)
      .then(() => mongoose.connection);
  }

  try {
    return await g.__mongoosePromise;
  } catch (err) {
    g.__mongoosePromise = null;
    throw err;
  }
}

module.exports = { connectDb };

