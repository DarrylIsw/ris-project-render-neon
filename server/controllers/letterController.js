/* eslint-disable no-await-in-loop */
const { z } = require('zod');
const model = require('../models/letterModel');
const {
  ensureInitialState, getRevision, loadState, resolveAccount
} = require('../services/risDataService');
const { projectState } = require('../services/risAccess');
const { saveState } = require('../services/risStateMutation');

const submissionSchema = z.object({
  definitionId: z.string().min(1).max(180),
  researchId: z.string().max(180).nullable().optional(),
  form: z.record(z.string(), z.string().max(10000)).default({}),
  managerMode: z.enum(['management', 'lecturer']).optional(),
}).strict();

const conflict = error => Boolean(error && (error.code === 'DATA_CONFLICT' || error.status === 409));
const createId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const submitLetter = async (req, res, next) => {
  try {
    const parsed = submissionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pengajuan surat tidak sesuai.' });
    require('@babel/register')({ envName: 'test' });
    const { createCatalogLetterDraft, saveCatalogLetter } = require('../../app/containers/Ris/features/letters/workflows/letterCatalogWorkflow');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await ensureInitialState();
      const state = await loadState();
      const account = resolveAccount(state, req.user);
      if (!account || account.isActive === false) return res.status(403).json({ message: 'Akun tidak aktif atau tidak ditemukan.' });
      const actor = account.role === 'manager' && parsed.data.managerMode === 'lecturer'
        ? { ...account, managerMode: 'lecturer' }
        : account;
      const visible = projectState(state, actor);
      const draft = createCatalogLetterDraft({
        definitionId: parsed.data.definitionId,
        researchId: parsed.data.researchId || null,
      }, actor, visible, createId);
      const allowedFields = new Set((draft.templateFields || []).map(field => field.key));
      const form = Object.fromEntries(Object.entries(parsed.data.form).filter(([key]) => allowedFields.has(key)));
      const submitted = saveCatalogLetter(visible, { ...draft, form }, actor, true);

      try {
        const saved = await saveState({
          databaseUser: req.user,
          submitted,
          expectedVersion: await getRevision(),
          // This endpoint constructs the request from the published definition
          // and canonical account data. The generic state endpoint cannot create
          // an already-submitted request.
          trustedDomains: ['letterRequests'],
        });
        return res.status(201).json({ ...saved, letterId: draft.id });
      } catch (error) {
        if (!conflict(error) || attempt === 1) throw error;
      }
    }
    return next(new Error('Pengajuan surat tidak dapat disimpan.'));
  } catch (error) {
    return next(error);
  }
};

const dbFallback = (res, error) => {
  if (error.code !== 'DB_NOT_CONFIGURED') throw error;
  return res.json({
    records: [],
    meta: {
      databaseConfigured: false,
      message: error.message,
    },
  });
};

const listLetters = async (req, res, next) => {
  try {
    const records = await model.listLetters();
    return res.json({ records });
  } catch (error) {
    try {
      return dbFallback(res, error);
    } catch (fallbackError) {
      return next(fallbackError);
    }
  }
};

module.exports = { listLetters, submitLetter };
