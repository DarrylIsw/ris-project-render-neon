const assert = require('assert');
const { createInitialData } = require('../../app/containers/Ris/core/data');
const {
  applyProfileAccountAction, canManageProfileAccount, filterProfiles, getProfileMetrics
} = require('../../app/containers/Ris/features/profiles/workflows/researcherProfileWorkflow');
const { canChange } = require('../../server/services/risAccess');

const id = prefix => `${prefix}-test`;
const accountFor = (data, userId) => data.systemUsers.find(item => item.id === userId);
const profileFor = (data, userId) => data.researcherProfiles.find(item => item.userId === userId);

describe('RIS profile account actions', () => {
  it('deactivates and reactivates an account while preserving its profile state and research', () => {
    const data = createInitialData();
    const actor = accountFor(data, 'user-super-admin');
    const target = profileFor(data, 'user-lecturer');
    const initialStatus = target.profileStatus;
    const disabled = applyProfileAccountAction(data, target.profileId, 'deactivate', 'Cuti panjang', actor, id);
    const inactiveAccount = accountFor(disabled, target.userId);

    assert.strictEqual(inactiveAccount.isActive, false);
    assert.strictEqual(profileFor(disabled, target.userId).profileStatus, 'inactive');
    assert.strictEqual(canChange('systemUsers', accountFor(data, target.userId), inactiveAccount, actor, data), true);
    assert.strictEqual(disabled.drafts.length, data.drafts.length);

    const restored = applyProfileAccountAction(disabled, target.profileId, 'activate', '', actor, id);
    assert.strictEqual(accountFor(restored, target.userId).isActive, true);
    assert.strictEqual(profileFor(restored, target.userId).profileStatus, initialStatus);
    assert.strictEqual(restored.researcherStatusHistory.length, disabled.researcherStatusHistory.length + 1);
  });

  it('archives a deleted account but keeps its historical records', () => {
    const data = createInitialData();
    const actor = accountFor(data, 'user-super-admin');
    const target = profileFor(data, 'user-lecturer');
    const removed = applyProfileAccountAction(data, target.profileId, 'delete', 'Akun tidak diperlukan', actor, id);
    const account = accountFor(removed, target.userId);

    assert.strictEqual(account.isActive, false);
    assert.ok(account.deletedAt);
    assert.strictEqual(filterProfiles(removed.researcherProfiles, removed, {}).some(item => item.profileId === target.profileId), false);
    assert.strictEqual(getProfileMetrics(removed).totalProfiles, getProfileMetrics(data).totalProfiles - 1);
    assert.strictEqual(removed.drafts.length, data.drafts.length);
    assert.strictEqual(canChange('systemUsers', account, { ...account, isActive: true, deletedAt: null }, actor, removed), false);
  });

  it('enforces role boundaries and rejects removal of the current account', () => {
    const data = createInitialData();
    const admin = accountFor(data, 'user-admin-profile');
    const manager = accountFor(data, 'user-manager');
    const superAdmin = accountFor(data, 'user-super-admin');
    const lecturer = profileFor(data, 'user-lecturer');
    const managerProfile = profileFor(data, manager.id);

    assert.strictEqual(canManageProfileAccount(lecturer, admin, accountFor(data, lecturer.userId)), true);
    assert.strictEqual(canManageProfileAccount(managerProfile, admin, manager), false);
    assert.strictEqual(canManageProfileAccount(managerProfile, superAdmin, manager), true);
    assert.strictEqual(canChange('systemUsers', manager, { ...manager, isActive: false }, admin, data), false);
    assert.strictEqual(canChange('systemUsers', superAdmin, { ...superAdmin, isActive: false }, superAdmin, data), false);
    assert.throws(() => applyProfileAccountAction(data, managerProfile.profileId, 'delete', 'Tidak dipakai', admin, id));
  });
});
