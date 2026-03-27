const mongoose = require('mongoose');

async function connectDb() {
  if (process.env.SKIP_DB === 'true' || !process.env.MONGODB_URI) return null;
  const uri = process.env.MONGODB_URI;

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

module.exports = { connectDb };

