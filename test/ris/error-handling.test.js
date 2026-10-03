const assert = require('assert');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
const NotFoundPage = require('../../app/containers/Ris/shared/components/NotFoundPage').default;
const errorTracker = require('../../server/observability/errorTracker');
const { apiNotFound, errorHandler } = require('../../server/middlewares/errorHandler');

const response = () => ({
  headersSent: false,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe('RIS application and API error handling', () => {
  it('renders an in-app 404 with a dashboard action', () => {
    const markup = renderToStaticMarkup(React.createElement(
      MemoryRouter,
      null,
      React.createElement(NotFoundPage, { insideLayout: true, signedIn: true })
    ));
    assert.match(markup, /Halaman tidak ditemukan/);
    assert.match(markup, /Kembali ke Dashboard/);
    assert.match(markup, /href="\/ris"/);
  });

  it('renders a standalone 404 with a sign-in action', () => {
    const markup = renderToStaticMarkup(React.createElement(
      MemoryRouter,
      null,
      React.createElement(NotFoundPage)
    ));
    assert.match(markup, /Kembali ke Masuk/);
    assert.match(markup, /href="\/login"/);
  });

  it('returns a consistent localized API 404 response', () => {
    const res = response();
    apiNotFound({ requestId: 'req-test' }, res);
    assert.strictEqual(res.statusCode, 404);
    assert.deepStrictEqual(res.body, {
      message: 'Alamat API tidak ditemukan.',
      code: 'API_NOT_FOUND',
      requestId: 'req-test',
    });
  });

  it('normalizes invalid error status codes and hides internal server messages', () => {
    const originalCapture = errorTracker.captureException;
    errorTracker.captureException = () => 'event-test';
    try {
      const res = response();
      errorHandler(Object.assign(new Error('private database detail'), { status: 200 }), {
        requestId: 'req-test', method: 'GET', path: '/api/test', user: null,
      }, res, () => {});
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.message, 'Terjadi gangguan pada server. Coba lagi atau hubungi pengelola dengan ID permintaan ini.');
      assert.strictEqual(res.body.code, 'SERVER_ERROR');
      assert.strictEqual(res.body.eventId, 'event-test');
      assert(!JSON.stringify(res.body).includes('private database detail'));
    } finally {
      errorTracker.captureException = originalCapture;
    }
  });

  it('delegates errors after response headers have been sent', () => {
    const res = response();
    res.headersSent = true;
    const failure = new Error('stream failed');
    let forwarded;
    errorHandler(failure, {}, res, error => { forwarded = error; });
    assert.strictEqual(forwarded, failure);
    assert.strictEqual(res.statusCode, undefined);
  });
});
