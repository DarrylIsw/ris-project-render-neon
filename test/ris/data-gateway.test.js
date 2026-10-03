const assert = require('assert');
const { STORAGE_KEYS, createLocalDataGateway } = require('../../app/containers/Ris/core/dataGateway');

const createStorage = initial => {
  const values = new Map(Object.entries(initial || {}));
  return {
    getItem: key => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    has: key => values.has(key),
  };
};

describe('RIS prototype data gateway', () => {
  it('migrates legacy state without losing domain records', () => {
    const legacyKey = 'ris-react-module-four-data-v2';
    const storage = createStorage({
      [legacyKey]: JSON.stringify({ schemes: [{ id: 'scheme-preserved', name: 'Preserved' }] }),
    });
    const gateway = createLocalDataGateway(storage);
    const data = gateway.loadData();

    assert.strictEqual(data.schemes.some(item => item.id === 'scheme-preserved'), true);
    assert.strictEqual(storage.has(STORAGE_KEYS.data), true);
    assert.strictEqual(storage.has(legacyKey), false);
  });

  it('keeps the application usable when storage throws', () => {
    const failingStorage = {
      getItem: () => { throw new Error('disabled'); },
      setItem: () => { throw new Error('disabled'); },
      removeItem: () => { throw new Error('disabled'); },
    };
    const gateway = createLocalDataGateway(failingStorage);
    const data = gateway.loadData();
    assert.ok(Array.isArray(data.schemes));
    assert.strictEqual(data.schemes.every(scheme => Number(scheme.maximumBudget) >= 0), true);
  });

  it('migrates permanent roles and funded proposal status', () => {
    const storage = createStorage({
      [STORAGE_KEYS.data]: JSON.stringify({
        systemUsers: [
          { id: 'legacy-admin', role: 'lppm_admin', email: 'legacy-admin@umn.ac.id' },
          { id: 'user-admin', role: 'lppm_admin', email: 'admin@umn.ac.id' },
          { id: 'user-reviewer', role: 'reviewer', email: 'reviewer@umn.ac.id' },
          { id: 'user-student', role: 'student', email: 'student@umn.ac.id' },
        ],
        drafts: [{
          id: 'legacy-funded', userId: 'owner', status: 'approved', assignment: { reviewerUserId: 'user-reviewer', reviewerProfileId: 'reviewer-1', status: 'submitted' }, review: { submittedAt: '2026-01-01T00:00:00.000Z', totalScore: 80 }
        }],
      }),
    });
    const data = createLocalDataGateway(storage).loadData();
    const permanentRoles = [...new Set(data.systemUsers.map(item => item.role))];

    assert.strictEqual(permanentRoles.every(role => ['super_admin', 'manager', 'admin', 'lecturer'].includes(role)), true);
    assert.strictEqual(data.systemUsers.some(item => item.id === 'user-reviewer'), false);
    assert.strictEqual(data.systemUsers.some(item => item.id === 'user-student'), false);
    assert.deepStrictEqual(data.systemUsers.find(item => item.id === 'legacy-admin').adminScopes.sort(), ['letter_management', 'research_management', 'researcher_profile_management']);
    assert.strictEqual(data.systemUsers.some(item => item.id === 'user-admin' && item.email === 'admin.penelitian@umn.ac.id' && item.adminScopes.includes('research_management')), true);
    assert.strictEqual(data.systemUsers.some(item => item.email === 'superadmin@umn.ac.id' && item.role === 'super_admin'), true);
    assert.strictEqual(data.lecturers.some(item => item.id === 'manager-1' && item.userId === 'user-manager'), true);
    assert.strictEqual(data.applicantProfiles.some(item => item.id === 'manager-1' && item.userId === 'user-manager'), true);
    assert.strictEqual(data.systemUsers.some(item => item.email === 'admin.surat@umn.ac.id' && item.adminScopes.includes('letter_management')), true);
    assert.strictEqual(data.systemUsers.some(item => item.email === 'admin.profil@umn.ac.id' && item.adminScopes.includes('researcher_profile_management')), true);
    assert.strictEqual(data.drafts[0].status, 'funded');
    assert.strictEqual(data.drafts[0].assignments[0].status, 'revoked');
  });

  it('normalizes legacy email outbox rows and removes exposed demo credentials', () => {
    const storage = createStorage({
      [STORAGE_KEYS.data]: JSON.stringify({
        emailOutbox: [{
          id: 'legacy-email',
          userId: 'user-lecturer',
          to: 'lecturer@umn.ac.id',
          notificationType: 'account_created',
          message: 'Akun dibuat. Password demo: password123.',
          status: 'queued',
          queuedAt: '2026-07-20T08:00:00.000Z',
        }],
      }),
    });
    const data = createLocalDataGateway(storage).loadData();
    const email = data.emailOutbox[0];
    assert.strictEqual(email.recipientUserId, 'user-lecturer');
    assert.strictEqual(email.recipientEmail, 'lecturer@umn.ac.id');
    assert.ok(email.deduplicationKey);
    assert.strictEqual(email.deliveryMode, 'immediate');
    assert.strictEqual(email.attempts, 0);
    assert.strictEqual(/password123/i.test(email.bodyText), false);
  });
});
