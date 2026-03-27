const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const { ok, created, fail } = require('../utils/response');
const { validateAndProcessImage, deleteUploadByUrl } = require('../config/multer');

const STORE_PATH = path.join(__dirname, '..', 'data', 'service-images.json');
const VALID_SERVICES = new Set([
  'levantamento-topografico',
  'nivelamento',
  'demarcacao',
  'locacao-de-obra',
  'calculo-de-volumetria',
  'georreferenciamento',
  'analise-por-drone'
]);

const useDb = () => mongoose.connection?.readyState === 1;
const isVercel = !!process.env.VERCEL;

function ensurePersistentStore(res) {
  if (useDb()) return true;
  if (isVercel) {
    fail(
      res,
      503,
      'Persistencia indisponivel: configure o MONGODB_URI para salvar fotos em producao.'
    );
    return false;
  }
  return true;
}

let ServiceImage;
function getModel() {
  if (!ServiceImage) ServiceImage = require('../models/ServiceImage');
  return ServiceImage;
}

async function readFileStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeFileStore(data) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

exports.getAll = async (_req, res) => {
  try {
    if (useDb()) {
      const Model = getModel();
      const docs = await Model.find({}).lean();
      const grouped = {};
      for (const doc of docs) {
        if (!grouped[doc.service]) grouped[doc.service] = [];
        grouped[doc.service].push(doc.url);
      }
      return ok(res, grouped);
    }
    const data = await readFileStore();
    return ok(res, data);
  } catch (err) {
    return fail(res, 500, 'Erro ao carregar imagens: ' + err.message);
  }
};

exports.add = async (req, res) => {
  try {
    if (!ensurePersistentStore(res)) return;
    const service = String(req.body.service || '').trim();
    if (!VALID_SERVICES.has(service)) return fail(res, 422, 'Serviço inválido');
    if (!req.file) return fail(res, 400, 'Arquivo não enviado');

    const image = await validateAndProcessImage(req.file);

    if (useDb()) {
      const Model = getModel();
      await Model.create({ service, url: image.url });
      const count = await Model.countDocuments({ service });
      global.broadcast?.('service:images:updated', { service, total: count });
      return created(res, { service, imageUrl: image.url, total: count });
    }

    const data = await readFileStore();
    const list = Array.isArray(data[service]) ? data[service] : [];
    list.push(image.url);
    data[service] = list;
    await writeFileStore(data);

    global.broadcast?.('service:images:updated', { service, total: list.length });
    return created(res, { service, imageUrl: image.url, total: list.length });
  } catch (err) {
    return fail(res, 500, 'Erro ao adicionar imagem: ' + err.message);
  }
};

exports.update = async (req, res) => {
  try {
    if (!ensurePersistentStore(res)) return;
    const service = String(req.body.service || '').trim();
    const id = String(req.body.id || '').trim();
    const currentUrl = String(req.body.currentUrl || '').trim();

    if (!VALID_SERVICES.has(service)) return fail(res, 422, 'Serviço inválido');
    if (!req.file) return fail(res, 400, 'Arquivo não enviado');
    if (!id && !currentUrl) return fail(res, 422, 'Informe id ou currentUrl para editar');

    const image = await validateAndProcessImage(req.file);

    if (useDb()) {
      const Model = getModel();
      let doc = null;
      if (id) {
        doc = await Model.findById(id);
      } else {
        doc = await Model.findOne({ service, url: currentUrl });
      }
      if (!doc) return fail(res, 404, 'Imagem não encontrada');

      const oldUrl = doc.url;
      doc.service = service;
      doc.url = image.url;
      await doc.save();

      deleteUploadByUrl(oldUrl);

      const count = await Model.countDocuments({ service });
      global.broadcast?.('service:images:updated', { service, total: count });
      return ok(res, { id: String(doc._id), service, imageUrl: image.url, total: count });
    }

    const data = await readFileStore();
    const list = Array.isArray(data[service]) ? data[service] : [];
    const idx = list.findIndex(url => String(url) === currentUrl);
    if (idx < 0) return fail(res, 404, 'Imagem não encontrada');

    const oldUrl = list[idx];
    list[idx] = image.url;
    data[service] = list;
    await writeFileStore(data);
    deleteUploadByUrl(oldUrl);

    global.broadcast?.('service:images:updated', { service, total: list.length });
    return ok(res, { service, imageUrl: image.url, total: list.length });
  } catch (err) {
    return fail(res, 500, 'Erro ao atualizar imagem: ' + err.message);
  }
};

exports.remove = async (req, res) => {
  try {
    if (!ensurePersistentStore(res)) return;
    const service = String(req.body.service || '').trim();
    const id = String(req.body.id || '').trim();
    const imageUrl = String(req.body.imageUrl || '').trim();

    if (!VALID_SERVICES.has(service)) return fail(res, 422, 'Serviço inválido');
    if (!id && !imageUrl) return fail(res, 422, 'Informe id ou imageUrl para excluir');

    if (useDb()) {
      const Model = getModel();
      let doc = null;
      if (id) {
        doc = await Model.findById(id);
      } else {
        doc = await Model.findOne({ service, url: imageUrl });
      }
      if (!doc) return fail(res, 404, 'Imagem não encontrada');

      const oldUrl = doc.url;
      await doc.deleteOne();
      deleteUploadByUrl(oldUrl);

      const count = await Model.countDocuments({ service });
      global.broadcast?.('service:images:updated', { service, total: count });
      return ok(res, { service, removed: true, total: count });
    }

    const data = await readFileStore();
    const list = Array.isArray(data[service]) ? data[service] : [];
    const idx = list.findIndex(url => String(url) === imageUrl);
    if (idx < 0) return fail(res, 404, 'Imagem não encontrada');

    const oldUrl = list[idx];
    list.splice(idx, 1);
    data[service] = list;
    await writeFileStore(data);
    deleteUploadByUrl(oldUrl);

    global.broadcast?.('service:images:updated', { service, total: list.length });
    return ok(res, { service, removed: true, total: list.length });
  } catch (err) {
    return fail(res, 500, 'Erro ao remover imagem: ' + err.message);
  }
};
