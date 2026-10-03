const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const local = require('../../server/services/fileStorage/localStorage');
const s3 = require('../../server/services/fileStorage/s3Storage');

describe('file storage adapters', () => {
  it('keeps local object keys under the private storage root', async () => {
    const previousRoot = process.env.FILE_STORAGE_DIR;
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ris-file-storage-'));
    process.env.FILE_STORAGE_DIR = root;
    try {
      const bytes = Buffer.from('private-file');
      await local.putObject({ key: 'profiles/avatar.bin', bytes });
      assert.deepStrictEqual(await local.getObjectBuffer('profiles/avatar.bin'), bytes);
      await assert.rejects(local.getObjectBuffer('../outside.bin'), /Invalid file storage key/);
      await local.deleteObject('profiles/avatar.bin');
      await assert.rejects(local.getObjectBuffer('profiles/avatar.bin'), error => error.code === 'ENOENT');
    } finally {
      if (previousRoot === undefined) delete process.env.FILE_STORAGE_DIR;
      else process.env.FILE_STORAGE_DIR = previousRoot;
      await fs.promises.rm(root, { recursive: true, force: true });
    }
  });

  it('uses private bucket operations with the bucket and opaque key supplied by the server', async () => {
    const requests = [];
    const client = {
      send: async command => {
        requests.push(command);
        if (command.constructor.name === 'GetObjectCommand') return { Body: Readable.from([Buffer.from('s3-private')]) };
        return {};
      },
    };
    const adapter = s3.createS3Adapter(client, 'ris-testing-files');
    await adapter.putObject({ key: 'letters/opaque-id.pdf', bytes: Buffer.from('pdf'), mimeType: 'application/pdf' });
    assert.deepStrictEqual(await adapter.getObjectBuffer('letters/opaque-id.pdf'), Buffer.from('s3-private'));
    await adapter.deleteObject('letters/opaque-id.pdf');
    assert.strictEqual(requests.length, 3);
    assert.ok(requests.every(command => command.input.Bucket === 'ris-testing-files'));
    assert.deepStrictEqual(requests.map(command => command.input.Key), Array(3).fill('letters/opaque-id.pdf'));
  });

  it('requires secure S3 configuration and an HTTPS endpoint', () => {
    const keys = ['FILE_STORAGE_BUCKET', 'AWS_ENDPOINT_URL_S3', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'];
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    const config = {
      FILE_STORAGE_BUCKET: 'ris-testing-files',
      AWS_ENDPOINT_URL_S3: 'https://storage.example.test',
      AWS_ACCESS_KEY_ID: 'test-access',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
      AWS_REGION: 'us-east-2',
    };
    try {
      keys.forEach(key => { process.env[key] = config[key]; });
      assert.strictEqual(s3.configuration().bucket, 'ris-testing-files');
      process.env.AWS_ENDPOINT_URL_S3 = 'http://storage.example.test';
      assert.throws(() => s3.configuration(), /HTTPS/);
    } finally {
      keys.forEach(key => {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      });
    }
  });
});
