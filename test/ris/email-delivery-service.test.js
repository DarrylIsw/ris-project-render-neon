const assert = require('assert');
const { EventEmitter } = require('events');
const { createEmailDeliveryService } = require('../../server/services/emailDeliveryService');
const templates = require('../../server/services/emailTemplateService');

const baseConfig = overrides => ({
  enabled: true,
  active: true,
  missingConfiguration: [],
  provider: 'smtp',
  environment: 'test',
  from: 'RIS <ris@example.test>',
  replyTo: 'support@example.test',
  appBaseUrl: 'https://ris.example.test',
  brandName: 'RIS Test',
  supportEmail: 'support@example.test',
  redirectAllTo: 'mailbox@example.test',
  recipientAllowlist: [],
  smtp: {
    host: 'smtp.example.test',
    port: 587,
    secure: false,
    user: 'smtp-user',
    password: 'smtp-password',
    rejectUnauthorized: true,
  },
  worker: {
    pollIntervalMs: 30000,
    batchSize: 25,
    maxAttempts: 5,
    retryBaseMs: 1000,
    staleLockMinutes: 15,
  },
  ...(overrides || {}),
});

const quietLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe('RIS optional email delivery service', () => {
  it('stays inactive without touching the outbox when configuration is disabled', async () => {
    let enqueueCalls = 0;
    const model = {
      cancelByDeduplicationKeys: async () => 0,
      enqueue: async () => { enqueueCalls += 1; return []; },
    };
    const service = createEmailDeliveryService({
      config: baseConfig({ enabled: false, active: false, missingConfiguration: ['SMTP_HOST'] }),
      model,
      log: quietLogger,
    });
    const result = await service.enqueue([{ recipientEmail: 'user@example.test' }]);

    assert.deepStrictEqual(result, { accepted: 0, cancelled: 0, active: false });
    assert.strictEqual(enqueueCalls, 0);
  });

  it('sanitizes and queues valid records while reconciling cancelled reminders', async () => {
    let enqueued = [];
    let cancelledKeys = [];
    const model = {
      cancelByDeduplicationKeys: async keys => { cancelledKeys = keys; return keys.length; },
      enqueue: async records => { enqueued = records; return records; },
    };
    const service = createEmailDeliveryService({ config: baseConfig(), model, log: quietLogger });
    const result = await service.enqueue([
      {
        status: 'queued',
        recipientEmail: 'USER@example.test',
        subject: 'Proposal tersedia',
        bodyText: 'Proposal diperbarui. password: rahasia',
        notificationType: 'proposal_funded',
        deduplicationKey: 'proposal-funded-once',
        priority: 'high',
      },
      { status: 'cancelled', deduplicationKey: 'obsolete-reminder' },
      {
        status: 'queued', recipientEmail: 'invalid', notificationType: 'ignored', deduplicationKey: 'invalid-email'
      },
    ]);

    assert.strictEqual(result.accepted, 1);
    assert.strictEqual(result.cancelled, 1);
    assert.deepStrictEqual(cancelledKeys, ['obsolete-reminder']);
    assert.strictEqual(enqueued[0].recipientEmail, 'user@example.test');
    assert.strictEqual(enqueued[0].bodyText.includes('rahasia'), false);
  });

  it('combines due digest records and marks all rows sent', async () => {
    const sentMessages = [];
    const markedSent = [];
    const records = ['one', 'two'].map((id, index) => ({
      id,
      recipientEmail: 'admin@example.test',
      subject: `Aktivitas ${index + 1}`,
      bodyText: `Pesan ${index + 1}`,
      notificationType: 'proposal_submitted',
      deliveryMode: 'digest',
      attempts: 1,
      payload: { recipientName: 'Admin Penelitian' },
    }));
    const model = {
      claimDue: async () => records,
      markSent: async (ids, provider, messageId) => markedSent.push({ ids, provider, messageId }),
      markFailed: async () => { throw new Error('markFailed should not be called'); },
      markCancelled: async () => { throw new Error('markCancelled should not be called'); },
    };
    const transportFactory = () => ({
      sendMail: async message => { sentMessages.push(message); return { messageId: 'smtp-message-1' }; },
    });
    const service = createEmailDeliveryService({
      config: baseConfig(), model, transportFactory, log: quietLogger
    });
    const result = await service.processBatch();

    assert.deepStrictEqual(result, {
      claimed: 2, sent: 2, failed: 0, cancelled: 0
    });
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].to, 'mailbox@example.test');
    assert.strictEqual(sentMessages[0].subject, 'Ringkasan aktivitas RIS (2)');
    assert.deepStrictEqual(markedSent[0], { ids: ['one', 'two'], provider: 'smtp', messageId: 'smtp-message-1' });
  });

  it('contains provider failures and schedules retry without failing the caller', async () => {
    let failure = null;
    const model = {
      claimDue: async () => [{
        id: 'failed-row',
        recipientEmail: 'user@example.test',
        subject: 'Keputusan proposal',
        bodyText: 'Keputusan tersedia.',
        notificationType: 'research_decision',
        deliveryMode: 'immediate',
        attempts: 2,
        payload: {},
      }],
      markSent: async () => { throw new Error('markSent should not be called'); },
      markFailed: async (ids, message, availableAt) => { failure = { ids, message, availableAt }; },
      markCancelled: async () => {},
    };
    const service = createEmailDeliveryService({
      config: baseConfig(),
      model,
      transportFactory: () => ({ sendMail: async () => { throw new Error('SMTP unavailable'); } }),
      log: quietLogger,
    });
    const result = await service.processBatch();

    assert.deepStrictEqual(result, {
      claimed: 1, sent: 0, failed: 1, cancelled: 0
    });
    assert.deepStrictEqual(failure.ids, ['failed-row']);
    assert.strictEqual(failure.message, 'SMTP unavailable');
    assert.strictEqual(Number.isNaN(new Date(failure.availableAt).getTime()), false);
  });

  it('always sends through SMTP and records its message ID', async () => {
    const sent = [];
    const service = createEmailDeliveryService({
      config: baseConfig(),
      model: {
        claimDue: async () => [{
          id: 'smtp-row',
          recipientEmail: 'user@example.test',
          subject: 'Surat terbit',
          bodyText: 'Surat telah terbit.',
          notificationType: 'letter_issued',
          attempts: 1,
          payload: {}
        }],
        markSent: async (ids, provider, messageId) => sent.push({ ids, provider, messageId }),
      },
      transportFactory: () => ({ sendMail: async () => ({ messageId: 'smtp-1' }) }),
      log: quietLogger,
    });

    const result = await service.processBatch();
    assert.strictEqual(result.sent, 1);
    assert.deepStrictEqual(sent, [{ ids: ['smtp-row'], provider: 'smtp', messageId: 'smtp-1' }]);
  });

  it('sends a claimed batch with bounded concurrency', async () => {
    const records = Array.from({ length: 5 }, (_, index) => ({
      id: `concurrent-${index}`,
      recipientEmail: `lecturer-${index}@example.test`,
      subject: 'Pengujian antrean',
      bodyText: 'Pesan pengujian.',
      notificationType: 'development_queue_test',
      deliveryMode: 'immediate',
      attempts: 1,
      payload: {},
    }));
    let active = 0;
    let maximumActive = 0;
    const service = createEmailDeliveryService({
      config: baseConfig({ worker: { ...baseConfig().worker, sendConcurrency: 2 } }),
      model: {
        claimDue: async () => records,
        markSent: async () => {},
        markFailed: async () => {},
        markCancelled: async () => {},
      },
      transportFactory: () => ({
        sendMail: async () => {
          active += 1;
          maximumActive = Math.max(maximumActive, active);
          await new Promise(resolve => { setTimeout(resolve, 10); });
          active -= 1;
          return { messageId: 'smtp-concurrent' };
        },
      }),
      log: quietLogger,
    });

    const result = await service.processBatch();
    assert.strictEqual(result.sent, 5);
    assert.strictEqual(maximumActive, 2);
  });

  it('wakes immediately when PostgreSQL emits the committed outbox notification', async () => {
    const listener = new EventEmitter();
    listener.query = async () => ({ rows: [] });
    listener.release = () => {};
    let claims = 0;
    const service = createEmailDeliveryService({
      config: baseConfig({ worker: { ...baseConfig().worker, fallbackPollIntervalMs: 60000 } }),
      model: {
        enqueue: async () => [],
        cancelByDeduplicationKeys: async () => 0,
        claimDue: async () => { claims += 1; return []; },
      },
      transportFactory: () => ({ verify: async () => {}, sendMail: async () => ({ messageId: 'unused' }), close: () => {} }),
      database: { isDatabaseConfigured: () => true, pool: { connect: async () => listener } },
      loadApplicationState: async () => ({ emailOutbox: [] }),
      log: quietLogger,
    });

    service.start();
    await new Promise(resolve => { setTimeout(resolve, 5); });
    const beforeWake = claims;
    listener.emit('notification', { channel: 'email_outbox_new' });
    await new Promise(resolve => { setTimeout(resolve, 5); });
    service.stop();
    assert.strictEqual(claims > beforeWake, true);
  });
});

describe('RIS email templates', () => {
  it('renders safe HTML and absolute action links', () => {
    const content = templates.renderImmediate({
      subject: '<Keputusan>',
      bodyText: 'Proposal <A> didanai.',
      actionPath: '/ris/proposal/1',
      payload: { recipientName: 'Dosen <Satu>', actionLabel: 'Lihat Proposal' },
    }, baseConfig());

    assert.strictEqual(content.html.includes('&lt;Keputusan&gt;'), true);
    assert.strictEqual(content.html.includes('Dosen &lt;Satu&gt;'), true);
    assert.strictEqual(content.html.includes('https://ris.example.test/ris/proposal/1'), true);
    assert.strictEqual(content.html.includes('Proposal <A>'), false);
  });
});
