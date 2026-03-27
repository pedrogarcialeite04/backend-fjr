require('dotenv').config();

const { connectDb } = require('../config/db');
const Admin = require('../models/Admin');
const { logger } = require('./logger');

async function run() {
  await connectDb();

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@fjs-topografia.com';
  const username = (process.env.SEED_ADMIN_USERNAME || 'admin').toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || '123';
  const name = process.env.SEED_ADMIN_NAME || 'Admin';

  const existing = await Admin.findOne({
    $or: [{ email }, { username }]
  });
  if (existing) {
    existing.username = username;
    existing.password = password;
    await existing.save();
    logger.info({ msg: 'Admin atualizado (credenciais sincronizadas com o seed)', email: existing.email, username });
    process.exit(0);
  }

  const admin = await Admin.create({
    name,
    email,
    username,
    password,
    role: 'superadmin'
  });
  logger.info({ msg: 'Admin criado', id: admin._id, email: admin.email, username });
  process.exit(0);
}

run().catch(err => {
  logger.error({ msg: 'Seed falhou', error: err.message, stack: err.stack });
  process.exit(1);
});

