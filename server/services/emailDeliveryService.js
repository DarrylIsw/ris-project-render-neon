/* eslint-disable no-await-in-loop */
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');
const emailConfig = require('../config/email');
const db = require('../config/db');
const logger = require('../logger');
const outboxModel = require('../models/emailOutboxModel');
const templateService = require('./emailTemplateService');
const { loadState } = require('./risDataService');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ENQUEUE_BATCH = 100;

const cleanText = (value, limit) => String(value || '')
  .replace(/\b(password|kata sandi|token|secret)\s*[:=]\s*\S+/gi, '$1: [disembunyikan]')
  .slice(0, limit)
  .trim();

const normalizeRecord = record => {
  const recipientEmail = String(record.recipientEmail || record.to || '').trim().toLowerCase();
  const deduplicationKey = cleanText(record.deduplicationKey, 500);
  const notificationType = cleanText(record.notificationType || record.type, 100);
  if (!EMAIL_PATTERN.test(recipientEmail) || !deduplicationKey || !notificationType) return null;
  const availableAt = new Date(record.availableAt || record.queuedAt || record.createdAt || Date.now());
  return {
    recipientUserId: cleanText(record.recipientUserId || record.userId, 120) || null,
    recipientEmail,
    subject: cleanText(record.subject || 'Pemberitahuan RIS', 240),
    bodyText: cleanText(record.bodyText || record.message || 'Ada pembaruan penting pada sistem RIS.', 12000),
    bodyHtml: null,
    templateKey: cleanText(record.templateKey, 100) || null,
    notificationType,
    entityType: cleanText(record.entityType, 100) || null,
    entityId: cleanText(record.entityId, 120) || null,
    actionPath: cleanText(record.actionPath, 1000) || null,
    priority: ['low', 'normal', 'high', 'critical'].includes(record.priority) ? record.priority : 'normal',
    deliveryMode: 'immediate',
    deduplicationKey,
    sourceEventId: cleanText(record.sourceEventId, 255) || null,
    payload: {
      recipientName: cleanText(record.payload && record.payload.recipientName, 180),
      actionPath: cleanText(record.payload && record.payload.actionPath, 1000),
      actionLabel: cleanText(record.payload && record.payload.actionLabel, 80),
      managerMode: cleanText(record.payload && record.payload.managerMode, 30),
    },
    availableAt: record.deliveryMode === 'digest' || Number.isNaN(availableAt.getTime())
      ? new Date().toISOString()
      : availableAt.toISOString(),
  };
};

const publicStatus = config => ({
  enabled: config.enabled,
  configured: config.missingConfiguration.length === 0,
  active: config.active,
  provider: config.provider,
  smtpConfigured: Boolean(config.smtpConfigured || (
    config.smtp && config.smtp.host && config.smtp.user && config.smtp.password
  )),
  persistence: db.isDatabaseConfigured() ? 'postgresql' : 'memory',
  deliverySafety: config.redirectAllTo
    ? 'redirect'
    : (config.recipientAllowlist.length ? 'allowlist' : 'direct'),
  missingConfiguration: config.missingConfiguration,
});

const createEmailDeliveryService = ({
  config = emailConfig,
  model = outboxModel,
  templates = templateService,
  transportFactory = options => nodemailer.createTransport(options),
  log = logger,
  database = db,
  loadApplicationState = loadState,
} = {}) => {
  let transporter = null;
  let timer = null;
  let processing = false;
  let wakePending = false;
  let listenerClient = null;
  let listenerReconnectTimer = null;
  let scheduleWake = () => {};
  const developmentRuns = new Map();
  const workerOptions = {
    batchSize: config.worker.batchSize || 25,
    maxAttempts: config.worker.maxAttempts || 5,
    processingTimeoutMinutes: config.worker.processingTimeoutMinutes || config.worker.staleLockMinutes || 10,
    workerId: config.worker.workerId || `ris-email-${process.pid}`,
  };
  const fallbackPollIntervalMs = config.worker.fallbackPollIntervalMs || config.worker.pollIntervalMs || 5000;
  const sendConcurrency = Math.max(1, config.worker.sendConcurrency || 5);

  const reconcileOutbox = async () => {
    if (!database.isDatabaseConfigured()) return;
    const state = await loadApplicationState();
    require('@babel/register')({ envName: 'test' });
    const { appendScheduledEmailReminders } = require('../../app/containers/Ris/shared/workflows/emailNotificationWorkflow');
    const reconciled = appendScheduledEmailReminders(state, new Date());
    const pending = (reconciled.emailOutbox || []).filter(record => record.status === 'queued' || record.status === 'cancelled');
    const cancelledKeys = pending.filter(record => record.status === 'cancelled').map(record => record.deduplicationKey).filter(Boolean);
    if (cancelledKeys.length) await model.cancelByDeduplicationKeys(cancelledKeys);
    const records = pending.filter(record => record.status === 'queued').map(normalizeRecord).filter(Boolean);
    if (records.length) await model.enqueue(records);
  };

  const getTransporter = () => {
    if (!transporter) {
      const options = {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        requireTLS: config.smtp.requireTls && !config.smtp.secure,
        pool: true,
        maxConnections: config.smtp.maxConnections || 5,
        maxMessages: config.smtp.maxMessages || 100,
        tls: { rejectUnauthorized: config.smtp.rejectUnauthorized },
      };
      if (config.smtp.user && config.smtp.password) {
        options.auth = { user: config.smtp.user, pass: config.smtp.password };
      }
      transporter = transportFactory(options);
    }
    return transporter;
  };

  const getDeliveryAddress = original => {
    if (config.redirectAllTo) return config.redirectAllTo;
    if (config.recipientAllowlist.length && !config.recipientAllowlist.includes(String(original).toLowerCase())) return '';
    return original;
  };

  const smtpConfigured = Boolean(config.smtpConfigured || (
    config.smtp && config.smtp.host && config.smtp.user && config.smtp.password
  ));

  const sendSmtp = async message => {
    const info = await getTransporter().sendMail({
      ...message,
      attachments: [{
        filename: 'UMNemaillogo.png',
        path: path.resolve(__dirname, '..', '..', 'public', 'images', 'ris', 'UMNemaillogo.png'),
        cid: templateService.LOGO_CID,
      }],
    });
    return { provider: 'smtp', messageId: info && info.messageId };
  };

  const enqueue = async records => {
    if (!config.active) return { accepted: 0, cancelled: 0, active: false };
    const source = Array.isArray(records) ? records.slice(0, MAX_ENQUEUE_BATCH) : [];
    const cancelledKeys = source
      .filter(record => record && record.status === 'cancelled')
      .map(record => cleanText(record.deduplicationKey, 500))
      .filter(Boolean);
    const cancelled = await model.cancelByDeduplicationKeys(cancelledKeys);
    const normalized = source
      .filter(record => record && record.status !== 'cancelled')
      .map(normalizeRecord)
      .filter(Boolean);
    const additions = await model.enqueue(normalized);
    return { accepted: additions.length, cancelled, active: true };
  };

  const retryAt = attempts => {
    const exponent = Math.max(0, Math.min(attempts - 1, 10));
    const delay = Math.min(config.worker.retryBaseMs * (2 ** exponent), 24 * 60 * 60 * 1000);
    return new Date(Date.now() + delay).toISOString();
  };

  const testRunFor = record => {
    const source = String(record.sourceEventId || '');
    const prefix = 'dev-email-queue:';
    return source.startsWith(prefix) ? developmentRuns.get(source.slice(prefix.length)) : null;
  };

  const recordTestTiming = (records, field) => {
    const timestamp = new Date().toISOString();
    records.forEach(record => {
      const run = testRunFor(record);
      if (!run) return;
      if (!run[field]) run[field] = timestamp;
      run.completed = field === 'smtpCompleted' ? run.completed + 1 : run.completed;
      run.updatedAt = timestamp;
    });
  };

  const runConcurrent = async (items, limit, handler) => {
    let cursor = 0;
    const workerCount = Math.min(limit, items.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await handler(items[index], index);
      }
    });
    await Promise.all(workers);
  };

  const deliverGroup = async records => {
    const ids = records.map(record => record.id);
    recordTestTiming(records, 'smtpStarted');
    log.info('email_smtp_delivery_started', { count: ids.length, deliveryMode: records[0].deliveryMode });
    const to = getDeliveryAddress(records[0].recipientEmail);
    if (!to) {
      await model.markCancelled(ids, 'Recipient is not included in EMAIL_RECIPIENT_ALLOWLIST.');
      return { sent: 0, cancelled: ids.length, failed: 0 };
    }
    const content = records[0].deliveryMode === 'digest' && records.length > 1
      ? templates.renderDigest(records, config)
      : templates.renderImmediate(records[0], config);
    let info;
    try {
      info = await sendSmtp({
        from: config.from,
        replyTo: config.replyTo || undefined,
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
        headers: { 'X-RIS-Notification': records.map(record => record.notificationType).join(',').slice(0, 500) },
      });
    } catch (error) {
      const highestAttempt = Math.max(...records.map(record => record.attempts || 1));
      await model.markFailed(ids, cleanText(error.message, 2000), retryAt(highestAttempt));
      log.warn('email_delivery_failed', {
        count: ids.length,
        deliveryMode: records[0].deliveryMode,
        attempts: highestAttempt,
        terminal: highestAttempt >= config.worker.maxAttempts,
        error: { name: error.name, code: error.code, message: cleanText(error.message, 500) },
      });
      log.warn(highestAttempt >= config.worker.maxAttempts ? 'email_permanently_failed' : 'email_retry_scheduled', {
        count: ids.length, attempts: highestAttempt, retryAt: highestAttempt >= config.worker.maxAttempts ? null : retryAt(highestAttempt)
      });
      recordTestTiming(records, 'smtpCompleted');
      return { sent: 0, cancelled: 0, failed: ids.length };
    }
    try {
      await model.markSent(ids, info.provider, info.messageId);
    } catch (error) {
      log.error(error, {
        event: 'email_outbox_receipt_failed',
        count: ids.length,
        provider: info.provider,
        providerMessageId: info.messageId,
      });
      throw error;
    }
    log.info('email_delivery_succeeded', {
      count: ids.length,
      deliveryMode: records[0].deliveryMode,
      provider: info.provider,
      providerMessageId: info.messageId,
    });
    recordTestTiming(records, 'smtpCompleted');
    return { sent: ids.length, cancelled: 0, failed: 0 };
  };

  const processBatch = async () => {
    if (!config.active || processing) {
      return {
        claimed: 0, sent: 0, failed: 0, cancelled: 0
      };
    }
    processing = true;
    try {
      try {
        await reconcileOutbox();
      } catch (error) {
        log.warn('email_outbox_reconciliation_failed', { error: { name: error.name, code: error.code, message: cleanText(error.message, 500) } });
      }
      if (model.promoteDigestToImmediate) await model.promoteDigestToImmediate();
      if (model.cancelExpired) await model.cancelExpired(config.worker.maxAgeHours || 72, config.worker.maxAttempts);
      const startedAt = Date.now();
      const records = await model.claimDue(workerOptions);
      if (records.length) log.info('email_batch_claimed', { count: records.length, workerId: workerOptions.workerId });
      recordTestTiming(records, 'pickedUp');
      const immediate = records.filter(record => record.deliveryMode !== 'digest').map(record => [record]);
      const digestMap = records.filter(record => record.deliveryMode === 'digest').reduce((groups, record) => {
        const key = record.recipientEmail.toLowerCase();
        groups.set(key, [...(groups.get(key) || []), record]);
        return groups;
      }, new Map());
      const groups = [...immediate, ...digestMap.values()];
      const summary = {
        claimed: records.length, sent: 0, failed: 0, cancelled: 0
      };
      let activeDeliveries = 0;
      let maximumActiveDeliveries = 0;
      await runConcurrent(groups, sendConcurrency, async group => {
        activeDeliveries += 1;
        maximumActiveDeliveries = Math.max(maximumActiveDeliveries, activeDeliveries);
        try {
          const result = await deliverGroup(group);
          summary.sent += result.sent;
          summary.failed += result.failed;
          summary.cancelled += result.cancelled;
        } finally {
          activeDeliveries -= 1;
        }
      });
      log.info('email_batch_completed', {
        ...summary,
        durationMs: Date.now() - startedAt,
        concurrencyLimit: sendConcurrency,
        maximumActiveConcurrency: maximumActiveDeliveries,
        workerId: workerOptions.workerId
      });
      return summary;
    } finally {
      processing = false;
      if (wakePending) {
        wakePending = false;
        scheduleWake('queued_during_processing');
      }
    }
  };

  scheduleWake = reason => {
    log.info('email_queue_wake_received', { reason, workerId: workerOptions.workerId });
    if (processing) {
      wakePending = true;
      return;
    }
    Promise.resolve().then(() => processBatch().catch(error => log.error(error, { event: 'email_worker_wake_failed' })));
  };

  const closeListener = () => {
    if (listenerReconnectTimer) clearTimeout(listenerReconnectTimer);
    listenerReconnectTimer = null;
    if (listenerClient) {
      listenerClient.removeAllListeners('notification');
      listenerClient.release();
      listenerClient = null;
    }
  };

  const connectListener = async () => {
    if (!database.isDatabaseConfigured() || listenerClient) return;
    try {
      const client = await database.pool.connect();
      client.on('notification', notification => {
        if (notification.channel === 'email_outbox_new') scheduleWake('postgres_notify');
      });
      client.on('error', error => {
        log.warn('email_queue_listener_error', { error: { name: error.name, code: error.code, message: cleanText(error.message, 500) } });
        if (listenerClient === client) {
          listenerClient = null;
          client.release(error);
          listenerReconnectTimer = setTimeout(() => connectListener(), fallbackPollIntervalMs);
          if (listenerReconnectTimer.unref) listenerReconnectTimer.unref();
        }
      });
      await client.query('LISTEN email_outbox_new');
      listenerClient = client;
      log.info('email_queue_listener_ready', { channel: 'email_outbox_new', workerId: workerOptions.workerId });
    } catch (error) {
      log.warn('email_queue_listener_unavailable', { error: { name: error.name, code: error.code, message: cleanText(error.message, 500) } });
      listenerReconnectTimer = setTimeout(() => connectListener(), fallbackPollIntervalMs);
      if (listenerReconnectTimer.unref) listenerReconnectTimer.unref();
    }
  };

  const getStatus = async includeSummary => ({
    ...publicStatus(config),
    outbox: includeSummary && config.active ? await model.getSummary() : undefined,
  });

  const enqueueDevelopmentTest = async count => {
    if (config.environment === 'production') throw new Error('Utilitas antrean email hanya tersedia di development.');
    if (![1, 5, 20].includes(Number(count))) throw new Error('Jumlah email uji harus 1, 5, atau 20.');
    const recipient = config.redirectAllTo || config.recipientAllowlist[0];
    if (!recipient) throw new Error('Atur EMAIL_REDIRECT_ALL_TO atau EMAIL_RECIPIENT_ALLOWLIST sebelum menjalankan uji antrean.');
    const runId = crypto.randomUUID();
    const enqueueStartedAt = new Date().toISOString();
    const records = Array.from({ length: Number(count) }, (_, index) => ({
      recipientEmail: recipient,
      subject: `Uji antrean email RIS ${index + 1}/${count}`,
      bodyText: 'Pesan pengujian antrean email development.',
      templateKey: 'development-queue-test',
      notificationType: 'development_queue_test',
      entityType: 'system',
      priority: 'low',
      deliveryMode: 'immediate',
      deduplicationKey: `dev-email-queue:${runId}:${index + 1}`,
      sourceEventId: `dev-email-queue:${runId}`,
      payload: { recipientName: 'RIS Development', actionLabel: 'Buka RIS' },
      availableAt: enqueueStartedAt,
    }));
    developmentRuns.set(runId, {
      runId,
      requested: Number(count),
      accepted: 0,
      completed: 0,
      enqueueStartedAt,
      enqueueCompletedAt: null,
      pickedUp: null,
      smtpStarted: null,
      smtpCompleted: null,
      updatedAt: enqueueStartedAt,
    });
    const result = await enqueue(records);
    const run = developmentRuns.get(runId);
    run.accepted = result.accepted;
    run.enqueueCompletedAt = new Date().toISOString();
    run.updatedAt = run.enqueueCompletedAt;
    return run;
  };

  const getDevelopmentTest = runId => developmentRuns.get(runId) || null;

  const verify = async () => {
    if (!smtpConfigured) {
      return false;
    }
    if (!config.active) return false;
    try {
      await getTransporter().verify();
      log.info('email_transport_ready', { provider: 'smtp' });
      return true;
    } catch (error) {
      log.warn('email_transport_unavailable', { error: { name: error.name, code: error.code, message: cleanText(error.message, 500) } });
      return false;
    }
  };

  const start = () => {
    if (!config.active || timer) {
      if (!config.active) log.info('email_delivery_inactive', publicStatus(config));
      return false;
    }
    verify();
    connectListener();
    processBatch().catch(error => log.error(error, { event: 'email_worker_cycle_failed' }));
    timer = setInterval(() => {
      processBatch().catch(error => log.error(error, { event: 'email_worker_cycle_failed' }));
    }, fallbackPollIntervalMs);
    if (timer.unref) timer.unref();
    return true;
  };

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (transporter && transporter.close) transporter.close();
    transporter = null;
    closeListener();
  };

  return {
    enqueue,
    processBatch,
    getStatus,
    verify,
    enqueueDevelopmentTest,
    getDevelopmentTest,
    start,
    stop,
  };
};

const emailDeliveryService = createEmailDeliveryService();

module.exports = emailDeliveryService;
module.exports.createEmailDeliveryService = createEmailDeliveryService;
module.exports.normalizeRecord = normalizeRecord;
module.exports.publicStatus = publicStatus;
