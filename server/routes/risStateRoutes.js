const express = require('express');
const { z } = require('zod');
const { requireUser } = require('../middlewares/auth');
const {
  ensureInitialState, loadState, resolveAccount, getRevision, EMPTY_ARRAYS
} = require('../services/risDataService');
const { projectState } = require('../services/risAccess');
const { saveState } = require('../services/risStateMutation');
const prisma = require('../config/prisma');

const arrayDomains = new Set(EMPTY_ARRAYS);
const numericDomains = new Set([
  'catalogDemoSeedVersion', 'attachmentDemoSeedVersion', 'schemeDataDemoSeedVersion',
  'schemeMonitoringDemoSeedVersion', 'fundedReviewSeedVersion', 'letterWorkflowSeedVersion',
  'profileSequence', 'letterSequence', 'externalResearchSequence'
]);
const dataSchema = z.record(z.string(), z.unknown()).superRefine((data, context) => {
  Object.entries(data).forEach(([domain, value]) => {
    const valid = arrayDomains.has(domain) ? Array.isArray(value)
      : numericDomains.has(domain) ? Number.isSafeInteger(value) && value >= 0
        // A clean installation intentionally has no master template yet. Null is
        // therefore a valid persisted state, not an invalid client payload.
        : domain === 'letterMasterTemplate'
          ? (value === null || (typeof value === 'object' && !Array.isArray(value)))
          // New scalar domains can be added by a compatible server release.
          // They remain inert unless a domain-specific authorization rule accepts
          // a change in risAccess.canChange.
          : true;
    if (!valid) context.addIssue({ code: 'custom', path: [domain], message: 'Domain atau tipe data tidak sesuai.' });
  });
});
const stateSchema = z.object({ data: dataSchema, version: z.number().int().nonnegative() }).strict();

const router = express.Router();
router.use(requireUser);

router.get('/', async (req, res, next) => {
  try {
    await ensureInitialState();
    const state = await loadState();
    const account = resolveAccount(state, req.user);
    if (!account) return res.status(403).json({ message: 'Akun tidak ditemukan.' });
    const scopes = await prisma.user_admin_scopes.findMany({ where: { user_id: req.user.id }, select: { scope: true } });
    account.adminScopes = scopes.map(item => item.scope);
    return res.json({ data: projectState(state, account), version: await getRevision() });
  } catch (error) { return next(error); }
});

router.put('/', async (req, res, next) => {
  try {
    const parsed = stateSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue && issue.path && issue.path.length ? ` pada ${issue.path.join('.')}` : '';
      return res.status(400).json({
        code: 'INVALID_STATE_PAYLOAD',
        message: `Data atau versi tidak sesuai${path}.`,
      });
    }
    const result = await saveState({ databaseUser: req.user, submitted: parsed.data.data, expectedVersion: parsed.data.version });
    return res.json(result);
  } catch (error) { return next(error); }
});

module.exports = router;
