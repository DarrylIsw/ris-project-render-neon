const fs = require('fs');
const path = require('path');

const storageRoot = () => path.resolve(process.env.FILE_STORAGE_DIR || path.join(process.cwd(), 'var', 'uploads'));

const resolveKey = key => {
  if (typeof key !== 'string' || !key || key.includes('\\') || path.isAbsolute(key)) throw new Error('Invalid file storage key.');
  const root = storageRoot();
  const absolute = path.resolve(root, key);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error('Invalid file storage key.');
  return absolute;
};

const putObject = async ({ key, bytes }) => {
  const absolute = resolveKey(key);
  await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
  await fs.promises.writeFile(absolute, bytes, { flag: 'wx' });
};

const getObjectStream = key => fs.createReadStream(resolveKey(key));
const getObjectBuffer = async key => fs.promises.readFile(resolveKey(key));
const deleteObject = async key => {
  try {
    await fs.promises.unlink(resolveKey(key));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

module.exports = {
  storageRoot,
  putObject,
  getObjectStream,
  getObjectBuffer,
  deleteObject,
};
