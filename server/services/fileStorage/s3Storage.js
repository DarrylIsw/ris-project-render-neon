/* eslint-disable no-restricted-syntax */
const {
  DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client,
} = require('@aws-sdk/client-s3');

let client;

const configuration = () => {
  const bucket = String(process.env.FILE_STORAGE_BUCKET || '').trim();
  const endpoint = String(process.env.AWS_ENDPOINT_URL_S3 || process.env.FILE_STORAGE_S3_ENDPOINT || '').trim();
  const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || '');
  const region = String(process.env.FILE_STORAGE_S3_REGION || process.env.AWS_REGION || '').trim();
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey || !region) {
    throw new Error('Neon Object Storage requires FILE_STORAGE_BUCKET, AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION.');
  }
  let parsedEndpoint;
  try { parsedEndpoint = new URL(endpoint); } catch (_) { throw new Error('AWS_ENDPOINT_URL_S3 must be a valid HTTPS URL.'); }
  if (parsedEndpoint.protocol !== 'https:') throw new Error('Object storage endpoint must use HTTPS.');
  return {
    bucket,
    endpoint: parsedEndpoint.toString().replace(/\/$/, ''),
    accessKeyId,
    secretAccessKey,
    region,
  };
};

const getClient = config => {
  if (!client) {
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: true,
    });
  }
  return client;
};

const createS3Adapter = (s3Client, bucket) => {
  const getObjectStream = async key => {
    try {
      const result = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body) throw new Error('Object storage returned an empty file body.');
      return result.Body;
    } catch (error) {
      if (error.name === 'NoSuchKey' || (error.$metadata && error.$metadata.httpStatusCode === 404)) error.status = 404;
      throw error;
    }
  };
  const getObjectBuffer = async key => {
    const body = await getObjectStream(key);
    if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  };
  return {
    getObjectStream,
    getObjectBuffer,
    putObject: async ({ key, bytes, mimeType }) => s3Client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: bytes, ContentType: mimeType,
    })),
    deleteObject: async key => s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
  };
};

const configuredAdapter = () => {
  const config = configuration();
  return createS3Adapter(getClient(config), config.bucket);
};
const getObjectStream = key => configuredAdapter().getObjectStream(key);
const getObjectBuffer = key => configuredAdapter().getObjectBuffer(key);
const putObject = input => configuredAdapter().putObject(input);
const deleteObject = key => configuredAdapter().deleteObject(key);

const resetClientForTests = () => {
  if (client) client.destroy();
  client = null;
};

module.exports = {
  configuration,
  createS3Adapter,
  putObject,
  getObjectStream,
  getObjectBuffer,
  deleteObject,
  resetClientForTests,
};
